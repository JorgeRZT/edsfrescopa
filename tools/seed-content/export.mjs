#!/usr/bin/env node
/* eslint-disable no-console, no-await-in-loop */
/*
 * Regenera `demo-content/` descargando el contenido actual del sitio de origen en da.live
 * (por defecto jorgerzt/edsfrescopa) con la DA List/Source API. Ejecútalo cuando cambie el
 * contenido y haz commit del resultado, para que `seed.mjs` siembre la versión al día.
 *
 * Uso:  DA_TOKEN=... node tools/seed-content/export.mjs
 * Si no hay DA_TOKEN se usa ~/.aem/da-token.json. Node 18+, sin dependencias.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { ORG = 'jorgerzt', SITE = 'edsfrescopa' } = process.env;
const DA_ADMIN = 'https://admin.da.live';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../demo-content');

const TOKEN = process.env.DA_TOKEN || (() => {
  try {
    return JSON.parse(fs.readFileSync(path.join(os.homedir(), '.aem', 'da-token.json'), 'utf8')).access_token;
  } catch {
    return null;
  }
})();
if (!TOKEN) {
  console.error('✖ Falta DA_TOKEN.');
  process.exit(1);
}
const auth = { Authorization: `Bearer ${TOKEN}` };

async function list(rel, out = []) {
  const resp = await fetch(`${DA_ADMIN}/list/${ORG}/${SITE}${rel}`, { headers: auth });
  if (!resp.ok) throw new Error(`list ${rel}: ${resp.status}`);
  const items = await resp.json();
  const folders = [];
  items.forEach((item) => {
    const child = item.path.replace(`/${ORG}/${SITE}`, '');
    if (!item.ext) folders.push(child);
    else if (!child.includes('/drafts/')) out.push(child);
  });
  await Promise.all(folders.map((f) => list(f, out)));
  return out;
}

const files = await list('');
fs.readdirSync(ROOT, { withFileTypes: true })
  .filter((e) => !e.name.endsWith('.md'))
  .forEach((e) => fs.rmSync(path.join(ROOT, e.name), { recursive: true, force: true }));

let i = 0;
await Promise.all(Array.from({ length: 5 }, async () => {
  while (i < files.length) {
    const rel = files[i];
    i += 1;
    const resp = await fetch(`${DA_ADMIN}/source/${ORG}/${SITE}${rel}`, { headers: auth });
    if (!resp.ok) throw new Error(`source ${rel}: ${resp.status}`);
    const dest = path.join(ROOT, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, Buffer.from(await resp.arrayBuffer()));
  }
}));
console.log(`✔ ${files.length} ficheros exportados de ${ORG}/${SITE} a demo-content/`);
