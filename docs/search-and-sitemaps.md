# Search, sitemaps and robots

Fréscopa has a site search per language, hreflang sitemaps and a `robots.txt`. All three are built on the same EDS feature: the **query index**, a JSON file that EDS generates from the published pages.

| Piece | Where it lives | Live URL |
| --- | --- | --- |
| Query indexes (one per language) | [`tools/search-config/query.yaml`](../tools/search-config/query.yaml) → config service | [/query-index.json](https://main--edsfrescopa--jorgerzt.aem.live/query-index.json), [/es/query-index.json](https://main--edsfrescopa--jorgerzt.aem.live/es/query-index.json), `/fr/…`, `/jp/…` |
| Sitemaps with hreflang | [`tools/search-config/sitemap.yaml`](../tools/search-config/sitemap.yaml) → config service | [/sitemap-en.xml](https://main--edsfrescopa--jorgerzt.aem.live/sitemap-en.xml), `/sitemap-es.xml`, `/sitemap-fr.xml`, `/sitemap-jp.xml` |
| Sitemap index | [`sitemap-index.xml`](../sitemap-index.xml) (code) | [/sitemap-index.xml](https://main--edsfrescopa--jorgerzt.aem.live/sitemap-index.xml) |
| robots.txt | [`tools/search-config/robots.txt`](../tools/search-config/robots.txt) → config service | Served only on the production domain (see below) |
| Search block | [`blocks/search/search.js`](../blocks/search/search.js) | [/search?q=coffee](https://main--edsfrescopa--jorgerzt.aem.live/search?q=coffee), [/es/search?q=café](https://main--edsfrescopa--jorgerzt.aem.live/es/search?q=caf%C3%A9) |
| Search box in the header | [`blocks/header/header.js`](../blocks/header/header.js) | Posts to `/search` or `/<locale>/search` |
| Search pages | da.live: `/search`, `/es/search`, `/fr/search`, `/jp/search` | Each page has `Robots: noindex` metadata |

## How it works, end to end

```
publish page ──► indexer renders the page, reads <head> meta per query.yaml
                 └► row in /query-index.json  (or /es/, /fr/, /jp/ by path)
                       │
     ┌─────────────────┼─────────────────────────────┐
     ▼                 ▼                             ▼
search block      sitemap job                   robots.txt (prod host)
fetches the       reads the 4 indexes,          points crawlers to
index of the      writes /sitemap-xx.xml        /sitemap-index.xml
current locale,   with <xhtml:link hreflang>
filters in the    between language copies
browser
```

1. **Publishing feeds the index.** When a page is published to live, EDS renders it and extracts the properties defined in `query.yaml` from its `<head>`. The row lands in the index whose `include` / `exclude` match the path. **Only published pages are indexed**: a page that is only previewed is not in any index, on `aem.page` or `aem.live`. Unpublishing removes the row.
2. **The search block reads the index of its language.** `getRootPath()` returns `''`, `/es`, `/fr` or `/jp`, so `/es/search` fetches `/es/query-index.json`. It drops rows whose `robots` contains `noindex` and matches the query in the browser: first on the title, then on title + description + the last path segment. Results are rendered as cards with the page image. Labels ("Buscar...", "No se han encontrado resultados.") come from `placeholders.json` if it exists, otherwise from the `LABELS` map in the block.
3. **Sitemaps are built from the indexes.** The `frescopa` sitemap in `sitemap.yaml` has one language per index. EDS writes `/sitemap-en.xml` etc. and adds `<xhtml:link rel="alternate" hreflang>` between pages that share the same relative path (`/coffee` ↔ `/es/coffee` ↔ `/fr/coffee` ↔ `/jp/coffee`). `jp` uses `hreflang="ja"`, the ISO code, and `default: en` adds an `x-default` alternate pointing to the English page. Sitemaps regenerate automatically when an index changes.
4. **robots.txt points to the sitemap index.** EDS serves the custom `robots.txt` only on the **production host** (`cdn.prod.host`). On `*.aem.page` and `*.aem.live` it always serves `Disallow: /`, so the demo URLs are never crawled.

## The four indexes (`query.yaml`)

| Index | Include | Target |
| --- | --- | --- |
| `en` | `/**` minus `/en/**`, `/es/**`, `/fr/**`, `/jp/**` | `/query-index.json` |
| `es` | `/es`, `/es/**` | `/es/query-index.json` |
| `fr` | `/fr`, `/fr/**` | `/fr/query-index.json` |
| `jp` | `/jp`, `/jp/**` | `/jp/query-index.json` |

All of them exclude `nav`, `footer`, `search`, `signup`, `/forms/**`, `/drafts/**` and `/fragments/**`. `/en/**` is excluded because it is a partial duplicate of the root, which is the English site.

Properties of each row:

| Property | Source in `<head>` | Used by |
| --- | --- | --- |
| `title` | `meta[property="og:title"]` | Search (match + card title), sitemap |
| `description` | `meta[name="description"]` | Search (match + card text) |
| `image` | `meta[property="og:image"]`, path only | Search card image |
| `template` | `meta[name="template"]` | Future listings (e.g. blog) |
| `robots` | `meta[name="robots"]` | Search filter; the sitemap skips `noindex` rows |
| `lastModified` | `Last-Modified` header | Sitemap `<lastmod>` |

`path` is always added by EDS.

## Keeping a page out of search and sitemaps

Add a `Robots` row with `noindex` to the page's **metadata** block in da.live. The page stays in the index (with BYOM or DA sources pages cannot be filtered server-side), but:

- the search block hides it, and
- the sitemap skips it, because the index has a `robots` column.

> **Do not put `noindex` in `head.html`.** It applies to every page, so every index row gets `noindex` and both search and sitemaps end up empty. This project used to have it there; it was removed in favour of per-page metadata. The demo hosts are already protected by EDS's `Disallow: /` robots on `*.aem.page` / `*.aem.live`.

## Applying or changing the configuration

The YAML and robots files in `tools/search-config/` are the source of truth. Push them to the [configuration service](https://www.aem.live/docs/config-service-setup):

```bash
AEM_TOKEN=<admin token> node tools/search-config/apply-config.mjs jorgerzt edsfrescopa
```

| File | Config service endpoint |
| --- | --- |
| `query.yaml` | `POST /config/{org}/sites/{site}/content/query.yaml` (`text/yaml`) |
| `sitemap.yaml` | `POST /config/{org}/sites/{site}/content/sitemap.yaml` (`text/yaml`) |
| `robots.txt` | `POST /config/{org}/sites/{site}/robots.txt` (`text/plain`) |

After changing `query.yaml`, existing rows keep the old shape until the pages are indexed again. Re-publish them (bulk publish below), or reindex with `POST https://admin.hlx.page/index/{org}/{site}/main/{path}`.

### Useful Admin API calls

| Need | Call |
| --- | --- |
| Publish many pages (indexes them) | `POST /live/{org}/{site}/main/*` with `{"paths": [...], "forceUpdate": true}`, then poll the job's `links.self` + `/details` |
| Inspect a page's index record | `GET /index/{org}/{site}/main/{path}` |
| Regenerate a sitemap now | `POST /sitemap/{org}/{site}/main/sitemap-en.xml` |

All on `https://admin.hlx.page` with `Authorization: Bearer <token>`.

## Production domain checklist

When the site gets a real domain behind the Adobe-managed CDN:

1. Set `cdn.prod.host` in the site config. The sitemaps then use that host automatically; remove `origin` from `sitemap.yaml`.
2. Replace the `aem.live` host in `robots.txt` and `sitemap-index.xml` with the production domain.
3. Re-apply the config, regenerate the sitemaps and submit `/sitemap-index.xml` in Google Search Console.

## Reusing this in another project

1. Copy `tools/search-config/` and `sitemap-index.xml`; change the languages, paths, `origin` and hosts.
2. Make sure pages have `og:title`, `description` and `og:image` (EDS writes them from the metadata block and the first image).
3. Copy the locale-aware `blocks/search` (it needs a `getRootPath()` helper like the one in `scripts/scripts.js`).
4. Create a `search` page per language with an empty `search` block and `Robots: noindex`.
5. Apply the config, **publish** the pages, check `/query-index.json`, then the sitemaps.

## References

- [Indexing](https://www.aem.live/developer/indexing)
- [Sitemaps](https://www.aem.live/developer/sitemap)
- [Search block (block collection)](https://www.aem.live/developer/block-collection/search)
- [Configuration service](https://www.aem.live/docs/config-service-setup)
