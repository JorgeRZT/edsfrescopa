#!/usr/bin/env node
/* eslint-disable no-console, no-await-in-loop */
/*
 * Siembra el contenido demo de Fréscopa (carpeta `demo-content/`) en un sitio nuevo de
 * da.live (Experience Workspace) y lanza un preview masivo. Replica lo que hace
 * https://da.live/start con su "demo content", pero con el contenido de este repositorio.
 *
 * - Sube páginas (.html), hojas (.json) e imágenes con la DA Source API
 *   (POST https://admin.da.live/source/{org}/{site}/{path}, multipart, campo `data`).
 * - Reescribe las referencias al sitio de origen (/jorgerzt/edsfrescopa) por /{org}/{site}.
 * - Hace preview masivo de páginas y hojas con el Admin API
 *   (POST https://admin.hlx.page/preview/{org}/{site}/{ref}/*).
 * - Activa la Library de da.live (Blocks, Templates, Icons de `docs/library/`) añadiendo la
 *   hoja `library` a la configuración del sitio (https://admin.da.live/config/{org}/{site}/),
 *   conservando el resto de hojas que ya existan.
 *
 * Uso:  DA_TOKEN=... ORG=<org> SITE=<site> node tools/seed-content/seed.mjs
 *         [--dry-run] [--force] [--no-preview]
 * Si no hay DA_TOKEN se usa ~/.aem/da-token.json (npx -y github:adobe-rnd/da-auth-helper token).
 * Node 18+ (fetch nativo), sin dependencias.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const {
  ORG, SITE, REF = 'main', CONCURRENCY = '5',
} = process.env;
const SOURCE_PREFIX = '/jorgerzt/edsfrescopa';
const SOURCE_HOST = '--edsfrescopa--jorgerzt.';
const LIBRARY = [
  { title: 'Blocks', path: '/docs/library/blocks.json' },
  { title: 'Templates', path: '/docs/library/templates.json' },
  { title: 'Icons', path: '/docs/library/icons.json' },
];
const DA_ADMIN = 'https://admin.da.live';
const HLX_ADMIN = 'https://admin.hlx.page';

const DRY_RUN = process.argv.includes('--dry-run');
const FORCE = process.argv.includes('--force');
const NO_PREVIEW = process.argv.includes('--no-preview');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../demo-content');
const TEXT_TYPES = { html: 'text/html', json: 'application/json', svg: 'image/svg+xml' };
const MEDIA_TYPES = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', avif: 'image/avif', mp4: 'video/mp4', pdf: 'application/pdf',
};
const PREVIEW_EXT = ['html', 'json'];

const fail = (msg) => { console.error(`✖ ${msg}`); process.exit(1); };
if (!ORG || !SITE) fail('Indica el sitio destino: ORG=<org> SITE=<site> (en minúsculas, como en da.live).');

function readToken() {
  if (process.env.DA_TOKEN) return process.env.DA_TOKEN;
  try {
    const file = path.join(os.homedir(), '.aem', 'da-token.json');
    return JSON.parse(fs.readFileSync(file, 'utf8')).access_token;
  } catch {
    return null;
  }
}
const TOKEN = readToken();
if (!TOKEN && !DRY_RUN) fail('Falta DA_TOKEN (token IMS con permisos de escritura en el sitio de da.live).');
const auth = { Authorization: `Bearer ${TOKEN}` };

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return walk(full);
    if (e.name.startsWith('.') || e.name.endsWith('.md')) return [];
    return [`/${path.relative(ROOT, full).split(path.sep).join('/')}`];
  });
}

const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });

async function request(url, opts, attempt = 1) {
  const resp = await fetch(url, opts);
  if ((resp.status === 429 || resp.status >= 500) && attempt < 4) {
    await sleep(1000 * attempt);
    return request(url, opts, attempt + 1);
  }
  return resp;
}

function bodyFor(rel) {
  const ext = rel.split('.').pop().toLowerCase();
  const buf = fs.readFileSync(path.join(ROOT, rel));
  if (TEXT_TYPES[ext]) {
    const text = buf.toString('utf8').replaceAll(SOURCE_PREFIX, `/${ORG}/${SITE}`)
      .replaceAll(SOURCE_HOST, `--${SITE}--${ORG}.`);
    return new Blob([text], { type: TEXT_TYPES[ext] });
  }
  return new Blob([buf], { type: MEDIA_TYPES[ext] || 'application/octet-stream' });
}

async function upload(rel) {
  const form = new FormData();
  form.append('data', bodyFor(rel));
  const resp = await request(`${DA_ADMIN}/source/${ORG}/${SITE}${rel}`, { method: 'POST', headers: auth, body: form });
  return resp.ok ? null : `${resp.status} ${rel}`;
}

async function pool(items, fn) {
  const errors = [];
  let i = 0;
  let done = 0;
  const workers = Array.from({ length: Number(CONCURRENCY) }, async () => {
    while (i < items.length) {
      const item = items[i];
      i += 1;
      const err = await fn(item);
      if (err) errors.push(err);
      done += 1;
      if (done % 25 === 0 || done === items.length) console.log(`  ${done}/${items.length}`);
    }
  });
  await Promise.all(workers);
  return errors;
}

const files = walk(ROOT).sort();
const toPreview = files
  .filter((f) => PREVIEW_EXT.includes(f.split('.').pop()) && !f.startsWith('/drafts/') && f !== '/redirects.json')
  .map((f) => f.replace(/\.html$/, ''));

console.log(`Contenido demo: ${files.length} ficheros (${toPreview.length} páginas/hojas para preview)`);
console.log(`Destino: https://da.live/#/${ORG}/${SITE}  ·  rama ${REF}`);

if (DRY_RUN) {
  files.forEach((f) => console.log(`  ${f}`));
  process.exit(0);
}

const list = await request(`${DA_ADMIN}/list/${ORG}/${SITE}/`, { headers: auth });
if (list.status === 401 || list.status === 403) fail(`Sin permisos en ${ORG}/${SITE} (${list.status}). Renueva el token o revisa los permisos del sitio.`);
const existing = list.ok ? await list.json() : [];
if (existing.length && !FORCE) fail(`El sitio ${ORG}/${SITE} no está vacío. Usa --force para sobrescribir las rutas coincidentes.`);

console.log('Subiendo a da.live…');
const errors = await pool(files, upload);
if (errors.length) {
  console.error(`✖ ${errors.length} ficheros no se pudieron subir:`);
  errors.forEach((e) => console.error(`  ${e}`));
  process.exit(1);
}
console.log(`✔ ${files.length} ficheros subidos`);

async function configureLibrary() {
  const url = `${DA_ADMIN}/config/${ORG}/${SITE}/`;
  const current = await request(url, { headers: auth });
  let config = current.ok ? await current.json() : {};
  if (config[':type'] !== 'multi-sheet') {
    const sheets = config.data ? { data: { ...config, data: config.data } } : {};
    config = {
      ...sheets, ':names': Object.keys(sheets), ':version': 3, ':type': 'multi-sheet',
    };
  }
  if (config.library && !FORCE) return 'ya existía, no se modifica (usa --force para reemplazarla)';
  config.library = {
    total: LIBRARY.length, limit: LIBRARY.length, offset: 0, data: LIBRARY,
  };
  config[':names'] = [...new Set([...(config[':names'] || []), 'library'])];
  const form = new FormData();
  form.append('config', JSON.stringify(config));
  const resp = await request(url, { method: 'POST', headers: auth, body: form });
  if (!resp.ok) fail(`No se pudo guardar la configuración del sitio (${resp.status}). ¿Eres admin del sitio?`);
  return 'configurada (Blocks, Templates, Icons)';
}
console.log(`✔ Library de da.live ${await configureLibrary()}`);

if (NO_PREVIEW) process.exit(0);

console.log('Lanzando preview masivo…');
const preview = await request(`${HLX_ADMIN}/preview/${ORG}/${SITE}/${REF}/*`, {
  method: 'POST',
  headers: { ...auth, 'Content-Type': 'application/json' },
  body: JSON.stringify({ paths: toPreview, forceUpdate: true }),
});
if (!preview.ok) {
  fail(`Preview masivo rechazado (${preview.status}: ${preview.headers.get('x-error') || ''}). ¿Está AEM Code Sync instalado en el repo y el sitio creado en da.live?`);
}
const job = await preview.json().catch(() => ({}));
console.log(`✔ Preview en curso${job?.links?.self ? `: ${job.links.self}` : ''}`);

// AEM only materialises the redirects that differ from the previous preview of
// /redirects.json, so preview an empty sheet first and then the real one.
async function previewRedirects() {
  const rel = '/redirects.json';
  const sheet = JSON.parse(await bodyFor(rel).text());
  const put = async (body) => {
    const form = new FormData();
    form.append('data', new Blob([JSON.stringify(body)], { type: 'application/json' }));
    const up = await request(`${DA_ADMIN}/source/${ORG}/${SITE}${rel}`, { method: 'POST', headers: auth, body: form });
    const pv = await request(`${HLX_ADMIN}/preview/${ORG}/${SITE}/${REF}${rel}`, { method: 'POST', headers: auth });
    return up.ok && pv.ok;
  };
  const ok = await put({
    ...sheet, total: 0, limit: 0, data: [],
  }) && await put(sheet);
  return ok ? `${sheet.data.length} redirecciones activas en preview` : 'no se pudieron activar en preview (revisa /redirects.json)';
}
if (files.includes('/redirects.json')) console.log(`✔ Redirects: ${await previewRedirects()}`);
console.log(`  https://${REF}--${SITE}--${ORG}.aem.page/`);
