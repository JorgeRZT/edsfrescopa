#!/usr/bin/env node
/* eslint-disable no-console */
/*
 * Sincroniza redirecciones definidas en una API externa con la hoja `redirects`
 * del sitio en da.live (Experience Workspace) y lanza el preview (y opcionalmente publish).
 *
 * - Las filas autoradas en EW (Origin vacío o "EW") se conservan tal cual.
 * - Las filas con Origin = "API" se regeneran en cada ejecución desde la API.
 * - Si una Source ya existe como fila manual, gana la fila manual y se avisa del conflicto.
 *
 * Uso:  DA_TOKEN=... node tools/redirects-sync/sync-redirects.mjs [--dry-run] [--publish]
 * Node 18+ (fetch nativo), sin dependencias.
 */

const {
  DA_TOKEN,
  ORG = 'jorgerzt',
  SITE = 'edsfrescopa',
  REF = 'main',
  SHEET = 'redirects',
  REDIRECTS_API = 'https://my-custom-api.lopezpellicerjorge.workers.dev/api/frescopa/redirects',
} = process.env;

const DRY_RUN = process.argv.includes('--dry-run');
const PUBLISH = process.argv.includes('--publish');
const API_ORIGIN = 'API';

const fail = (msg) => { console.error(`✖ ${msg}`); process.exit(1); };
if (!DA_TOKEN && !DRY_RUN) fail('Falta DA_TOKEN (token IMS con permisos de escritura en da.live y en el Admin API).');

const auth = DA_TOKEN ? { Authorization: `Bearer ${DA_TOKEN}` } : {};
const sheetUrl = `https://admin.da.live/source/${ORG}/${SITE}/${SHEET}.json`;

const normPath = (p) => {
  const v = String(p || '').trim();
  if (!v) return '';
  if (/^https?:\/\//i.test(v)) return v;
  return `/${v.replace(/^\/+/, '')}`.replace(/\/+$/, '') || '/';
};

async function readApi() {
  const res = await fetch(REDIRECTS_API, { headers: { accept: 'application/json' } });
  if (!res.ok) fail(`La API de redirecciones respondió ${res.status}`);
  const json = await res.json();
  const list = Array.isArray(json) ? json : json.redirects;
  if (!Array.isArray(list)) fail('La API no devolvió un array de redirecciones');
  return list
    .map((r) => ({ Source: normPath(r.source), Destination: normPath(r.destination), Note: r.reason || '' }))
    .filter((r) => r.Source.startsWith('/') && r.Destination && r.Source !== r.Destination);
}

async function readSheet() {
  // Sin token (solo dry run) se lee la versión en preview, que es pública.
  const url = DA_TOKEN ? sheetUrl : `https://${REF}--${SITE}--${ORG}.aem.page/${SHEET}.json`;
  const res = await fetch(url, { headers: auth });
  if (res.status === 404) return [];
  if (!res.ok) fail(`No se pudo leer ${SHEET}.json en da.live (${res.status})`);
  const json = await res.json();
  // Hoja simple o workbook multi-hoja: las redirecciones viven en la primera / default.
  const sheet = json[':type'] === 'multi-sheet' ? (json['helix-default'] || json[json[':names'][0]]) : json;
  return sheet.data || [];
}

function merge(current, fromApi) {
  const manual = current
    .filter((r) => (r.Origin || '').toUpperCase() !== API_ORIGIN)
    .map((r) => ({
      Source: r.Source, Destination: r.Destination, Origin: r.Origin || 'EW', Note: r.Note || '',
    }));
  const manualSources = new Set(manual.map((r) => normPath(r.Source)));
  const conflicts = [];
  const seen = new Set();
  const apiRows = [];
  fromApi.forEach((r) => {
    if (manualSources.has(r.Source)) { conflicts.push(r.Source); return; }
    if (seen.has(r.Source)) return;
    seen.add(r.Source);
    apiRows.push({ ...r, Origin: API_ORIGIN });
  });
  return {
    rows: [...manual, ...apiRows], manual, apiRows, conflicts,
  };
}

async function writeSheet(rows) {
  const body = {
    total: rows.length, limit: rows.length, offset: 0, data: rows, ':type': 'sheet',
  };
  const form = new FormData();
  form.append('data', new Blob([JSON.stringify(body)], { type: 'application/json' }), `${SHEET}.json`);
  const res = await fetch(sheetUrl, { method: 'PUT', headers: auth, body: form });
  if (!res.ok) fail(`Error al escribir la hoja en da.live (${res.status})`);
}

async function admin(action) {
  const url = `https://admin.hlx.page/${action}/${ORG}/${SITE}/${REF}/${SHEET}.json`;
  const res = await fetch(url, { method: 'POST', headers: auth });
  if (!res.ok) fail(`${action} falló (${res.status}): ${res.headers.get('x-error') || ''}`);
}

const fromApi = await readApi();
const current = await readSheet();
const {
  rows, manual, apiRows, conflicts,
} = merge(current, fromApi);

console.log(`API: ${fromApi.length} · manuales (EW): ${manual.length} · API aplicadas: ${apiRows.length} · total: ${rows.length}`);
conflicts.forEach((s) => console.warn(`⚠ Conflicto en ${s}: ya existe como redirección manual en EW, se mantiene la manual.`));
apiRows.forEach((r) => console.log(`  ${r.Source} → ${r.Destination}`));

if (DRY_RUN) { console.log('Dry run: no se ha escrito nada.'); process.exit(0); }

await writeSheet(rows);
await admin('preview');
console.log(`✔ Hoja actualizada y en preview: https://${REF}--${SITE}--${ORG}.aem.page/${SHEET}.json`);
if (PUBLISH) {
  await admin('live');
  console.log(`✔ Publicada: https://${REF}--${SITE}--${ORG}.aem.live/${SHEET}.json`);
}
