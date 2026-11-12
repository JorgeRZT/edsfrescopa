#!/usr/bin/env node
/* eslint-disable no-console */
/*
 * Replica en un sitio nuevo la configuración de integraciones de Fréscopa, que no es código
 * ni contenido y por tanto no viaja con "Use this template" ni con `npm run seed:content`:
 *
 * - search   : query index, sitemaps y robots.txt (tools/search-config) en el config service,
 *              con el origen reescrito a https://{ref}--{site}--{org}.aem.live.
 * - json2html: entrada de /integrations/json2html en el worker json2html de Adobe para vuestro
 *              sitio (POST https://json2html.adobeaem.workers.dev/config/{org}/{site}/{ref}),
 *              con la plantilla de vuestro propio repo.
 * - overlay  : overlay de contenido del sitio (POST .../config/{org}/sites/{site}/content.json).
 *                --overlay=byom (por defecto): igual que Fréscopa. La API mock compartida sirve
 *                  /integrations/byom y redirige /integrations/json2html al worker json2html.
 *                --overlay=json2html: el overlay es el worker json2html de vuestro sitio
 *                  (configuración estándar de json2html; /integrations/byom deja de existir).
 *                --overlay=none: no toca el overlay.
 * - Al final hace preview de /integrations/byom y /integrations/json2html.
 *
 * Uso:  ORG=<org> SITE=<site> node tools/setup-integrations/setup.mjs
 *         [--only=search,json2html,overlay] [--overlay=byom|json2html|none]
 *         [--no-preview] [--dry-run]
 * Token: AEM_TOKEN o DA_TOKEN, o ~/.aem/da-token.json (npx -y github:adobe-rnd/da-auth-helper
 * token). Debe ser de un usuario admin del sitio en el config service.
 * Node 18+ (fetch nativo), sin dependencias.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { ORG, SITE, REF = 'main' } = process.env;
const HLX_ADMIN = 'https://admin.hlx.page';
const JSON2HTML = 'https://json2html.adobeaem.workers.dev';
const MOCK_API = 'https://my-custom-api.lopezpellicerjorge.workers.dev/api/frescopa';
const SOURCE_HOST = 'main--edsfrescopa--jorgerzt';
const STEPS = ['search', 'json2html', 'overlay'];
const PREVIEW_PATHS = ['/integrations/byom', '/integrations/json2html'];

const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
const DRY_RUN = process.argv.includes('--dry-run');
const NO_PREVIEW = process.argv.includes('--no-preview');
const ONLY = (arg('only') || STEPS.join(',')).split(',');
const OVERLAY = arg('overlay') || 'byom';

const fail = (msg) => { console.error(`✖ ${msg}`); process.exit(1); };
if (!ORG || !SITE) fail('Indica el sitio destino: ORG=<org> SITE=<site> (en minúsculas).');
if (ONLY.some((s) => !STEPS.includes(s))) fail(`--only admite: ${STEPS.join(', ')}`);
if (!['byom', 'json2html', 'none'].includes(OVERLAY)) fail('--overlay admite: byom, json2html, none');

function readToken() {
  const env = process.env.AEM_TOKEN || process.env.DA_TOKEN;
  if (env) return env;
  try {
    const file = path.join(os.homedir(), '.aem', 'da-token.json');
    return JSON.parse(fs.readFileSync(file, 'utf8')).access_token;
  } catch {
    return null;
  }
}
const TOKEN = readToken();
if (!TOKEN && !DRY_RUN) fail('Falta el token IMS (AEM_TOKEN/DA_TOKEN o ~/.aem/da-token.json).');
const auth = { Authorization: `Bearer ${TOKEN}` };

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const TARGET_HOST = `${REF}--${SITE}--${ORG}`;
const configBase = `${HLX_ADMIN}/config/${ORG}/sites/${SITE}`;

async function send(label, url, opts = {}) {
  if (DRY_RUN && opts.method) {
    console.log(`· [dry-run] ${opts.method} ${url}`);
    return null;
  }
  const resp = await fetch(url, { ...opts, headers: { ...auth, ...opts.headers } });
  const text = await resp.text();
  if (!resp.ok) fail(`${label}: ${resp.status} ${resp.headers.get('x-error') || text}`);
  console.log(`✔ ${label} (${resp.status})`);
  return text;
}

async function setupSearch() {
  const files = [
    ['query.yaml', 'content/query.yaml', 'text/yaml'],
    ['sitemap.yaml', 'content/sitemap.yaml', 'text/yaml'],
    ['robots.txt', 'robots.txt', 'text/plain'],
  ];
  await files.reduce((prev, [file, target, type]) => prev.then(() => {
    const body = fs.readFileSync(path.join(ROOT, 'tools/search-config', file), 'utf8')
      .replaceAll(SOURCE_HOST, TARGET_HOST);
    return send(`search · ${file}`, `${configBase}/${target}`, {
      method: 'POST', headers: { 'content-type': type }, body,
    });
  }), Promise.resolve());
}

async function setupJson2html() {
  const entries = [{
    path: '/integrations/json2html',
    endpoint: `${MOCK_API}/data/todays-roasts.json`,
    template: '/templates/json2html/todays-roasts.html',
  }];
  await send('json2html · config', `${JSON2HTML}/config/${ORG}/${SITE}/${REF}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(entries),
  });
}

async function setupOverlay() {
  if (OVERLAY === 'none') return;
  const overlay = OVERLAY === 'byom'
    ? { url: `${MOCK_API}/byom`, type: 'markup', suffix: '.html' }
    : { url: `${JSON2HTML}/${ORG}/${SITE}/${REF}`, type: 'markup' };
  if (DRY_RUN) {
    console.log(`· [dry-run] overlay → ${JSON.stringify(overlay)}`);
    return;
  }
  // El config service solo acepta el objeto `content` completo (content/overlay.json da error).
  const site = JSON.parse(await send('overlay · leer config del sitio', `${configBase}.json`));
  if (!site.content?.source) fail('El sitio no tiene content.source; ¿se creó en da.live/start?');
  await send(`overlay · ${OVERLAY}`, `${configBase}/content.json`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...site.content, overlay }),
  });
}

async function preview() {
  await PREVIEW_PATHS.reduce((prev, p) => prev.then(async () => {
    if (DRY_RUN) {
      console.log(`· [dry-run] preview ${p}`);
      return;
    }
    const resp = await fetch(`${HLX_ADMIN}/preview/${ORG}/${SITE}/${REF}${p}`, {
      method: 'POST', headers: auth,
    });
    const note = resp.ok ? '' : ` ${resp.headers.get('x-error') || ''}`;
    console.log(`${resp.ok ? '✔' : '⚠'} preview ${p} (${resp.status})${note}`);
  }), Promise.resolve());
}

console.log(`Sitio: ${ORG}/${SITE} (${REF}) · pasos: ${ONLY.join(', ')} · overlay: ${OVERLAY}`);
if (ONLY.includes('search')) await setupSearch();
if (ONLY.includes('json2html')) await setupJson2html();
if (ONLY.includes('overlay')) await setupOverlay();
if (!NO_PREVIEW && ONLY.includes('overlay') && OVERLAY !== 'none') await preview();
console.log(`\nPreview: https://${TARGET_HOST}.aem.page/integrations/byom`);
console.log('Publicad el sitio para generar /query-index.json y los sitemaps en aem.live.');
