/* eslint-disable no-console */
/**
 * Pushes the search & sitemap configuration of this folder to the AEM configuration service.
 *
 *   AEM_TOKEN=<admin token> node tools/search-config/apply-config.mjs [org] [site]
 *
 * - query.yaml   -> /config/{org}/sites/{site}/content/query.yaml   (query indexes)
 * - sitemap.yaml -> /config/{org}/sites/{site}/content/sitemap.yaml (sitemaps + hreflang)
 * - robots.txt   -> /config/{org}/sites/{site}/robots.txt           (only served on the prod host)
 */
import { readFile } from 'node:fs/promises';

const [org = 'jorgerzt', site = 'edsfrescopa'] = process.argv.slice(2);
const token = process.env.AEM_TOKEN;
if (!token) {
  console.error('Set AEM_TOKEN (e.g. the token from https://admin.hlx.page/login or da.live)');
  process.exit(1);
}

const base = `https://admin.hlx.page/config/${org}/sites/${site}`;
const files = [
  ['query.yaml', 'content/query.yaml', 'text/yaml'],
  ['sitemap.yaml', 'content/sitemap.yaml', 'text/yaml'],
  ['robots.txt', 'robots.txt', 'text/plain'],
];

async function push([file, target, type]) {
  const body = await readFile(new URL(file, import.meta.url), 'utf8');
  const res = await fetch(`${base}/${target}`, {
    method: 'POST',
    headers: { 'content-type': type, authorization: `Bearer ${token}` },
    body,
  });
  console.log(`${file} -> ${target}: ${res.status} ${res.ok ? '' : await res.text()}`);
}

await files.reduce((prev, f) => prev.then(() => push(f)), Promise.resolve());
