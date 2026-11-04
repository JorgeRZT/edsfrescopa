# Fréscopa on AEM Edge Delivery Services + Document Authoring

A migration of [frescopa.coffee](https://frescopa.coffee/) to an AEM Edge Delivery Services project with content in Document Authoring (da.live). It is built on the [`aemsites/da-block-collection`](https://github.com/aemsites/da-block-collection) template. The visual blocks, styles, fonts and icons are ported from the source project [`aem-showcase/frescopa`](https://github.com/aem-showcase/frescopa) (Apache-2.0).

- **Content (DA):** https://da.live/#/jorgerzt/edsfrescopa. Pages are in the root (EN), `/en/`, `/es/`, `/fr/` and `/jp/`. Images are in `/media/`, header and footer in `nav` and `footer` (plus `/<locale>/nav|footer`), and the enquiry form in `/forms/enquire`.
- **Preview:** https://main--edsfrescopa--jorgerzt.aem.page/. This is a demo site and is not published to `.aem.live`. `head.html` sets `noindex, nofollow`.

## Differences from the source site

The source is an xwalk site (Universal Editor + AEM Author) with Adobe Commerce drop-ins. In this project:

| Area | Source | Here |
| --- | --- | --- |
| `offer`, `article`, `quiz` | AEM Content Fragments via GraphQL persisted queries | Fragment data captured at migration time and authored as rows in the block table (see each block's JS header comment). The quiz is plain JS with no React. |
| `product-list-page-custom` (coffee, tea, machines, accessories, `/products`) | Adobe Commerce catalog service | Static rows (`image \| name \| description \| price`) captured from the rendered source. Client-side sorting and the product count still work. The links to product detail pages are removed. |
| `store-locator` | Google Maps + location API | Static panel (title, CTA, post-code field) with an illustrated map background. |
| Header | Commerce mini-cart, auth, CUG, search autocomplete | Same look. The cart, account and sign-in are visual only. Search posts to `/search`. An EN/ES/FR/JP language switcher was added. Each locale loads its own `/<locale>/nav`. |
| Forms (`form`, `embed-adaptive-form`) | AEM Forms | Form definitions are kept in the DA documents. They render fully, but there is no submission or prefill backend. |
| `dm-video`, `dm-scene7-template`, `video`, Dynamic Media images | Dynamic Media | Unchanged; they still load from the source DM delivery hosts. The DM player on `/sustainability` fails on the source as well. |
| Experimentation, UE instrumentation, importmap, commerce drop-ins | yes | removed |

The source references a few DAM assets that return 404 (for example `AdobeStock_278243111.jpeg` and the `/rise-and-shine` mp4). Those were dropped.

## Desarrollos en el portal

What was built on top of the migrated site to show EDS capabilities, where to see each one working, and where its code, content and configuration live. Nothing in this list depends on Universal Editor or AEM Author: everything is an EDS capability, used here from Experience Workspace (da.live).

| # | Development | Status | Try it | Docs |
| --- | --- | --- | --- | --- |
| 1 | BYOM: a page served by an external system | Live in preview | [/integrations/byom](https://main--edsfrescopa--jorgerzt.aem.page/integrations/byom) | [docs/byom.md](docs/byom.md) |
| 2 | json2html: external JSON + a Mustache template | Live in preview | [/integrations/json2html](https://main--edsfrescopa--jorgerzt.aem.page/integrations/json2html) | [docs/json2html.md](docs/json2html.md) |
| 3 | Redirects authored in Experience Workspace | Live in preview | [/cafe](https://main--edsfrescopa--jorgerzt.aem.page/cafe) → /coffee | [docs/redirects.md](docs/redirects.md) |
| 4 | Redirects defined by an external API | Live in preview | [/products/cold-brew-kit](https://main--edsfrescopa--jorgerzt.aem.page/products/cold-brew-kit) → /coffee | [docs/redirects.md](docs/redirects.md#redirects-defined-by-an-api) |
| 5 | Multi-language site and language switcher | Live in preview | [/es/](https://main--edsfrescopa--jorgerzt.aem.page/es/), [/fr/](https://main--edsfrescopa--jorgerzt.aem.page/fr/), [/jp/](https://main--edsfrescopa--jorgerzt.aem.page/jp/) | This README |
| 6 | Private area | Documented (patterns) | — | [docs/private-area.md](docs/private-area.md) |
| 7 | Adobe Edge Functions | Documented (needs a connected domain) | — | [docs/edge-workers.md](docs/edge-workers.md) |
| 8 | Reference architecture | Documented | [diagram](docs/architecture.svg) | [docs/architecture.md](docs/architecture.md) |

The external service used by 1, 2 and 4 is [my-custom-api](https://my-custom-api.lopezpellicerjorge.workers.dev/llms.txt), a Cloudflare Worker that stands in for a commerce, PIM or headless CMS.

### 1. BYOM

- **What:** [/integrations/byom](https://main--edsfrescopa--jorgerzt.aem.page/integrations/byom) is not authored in DA. An external service returns finished EDS HTML (sections and block tables) and EDS treats it like any other document.
- **How:** the site's content **overlay** (site config in the Admin API) points at `https://my-custom-api.lopezpellicerjorge.workers.dev/api/frescopa/byom`. EDS asks the overlay first; a 404 falls back to da.live, so only the paths the service knows are taken over.
- **Where it lives:** site config (overlay), endpoint `frescopa/byom` in my-custom-api. No code in this repo: the page uses the existing blocks.
- **When it updates:** when the page is previewed or published.

### 2. json2html

- **What:** [/integrations/json2html](https://main--edsfrescopa--jorgerzt.aem.page/integrations/json2html) is built from raw JSON (`frescopa/roasts`) and a template.
- **How:** the overlay answers that path with a 302 to Adobe's json2html worker, which fetches the JSON and renders it with [`templates/json2html/todays-roasts.html`](templates/json2html/todays-roasts.html) (Mustache). The output is EDS HTML, decorated by the normal blocks.
- **Where it lives:** template in this repo, json2html config for `jorgerzt/edsfrescopa`, JSON endpoint in my-custom-api.
- **When it updates:** when the page is previewed or published.

### 3. Redirects authored in Experience Workspace

- **What:** 301 redirects such as [/cafe](https://main--edsfrescopa--jorgerzt.aem.page/cafe) → /coffee, [/maquinas](https://main--edsfrescopa--jorgerzt.aem.page/maquinas) → /machines and [/tiendas](https://main--edsfrescopa--jorgerzt.aem.page/tiendas) → /locations.
- **How:** a `redirects` sheet in the root of the content with `Source` and `Destination` columns. Authors edit it in Experience Workspace and preview or publish it like any page. No code.
- **Where it lives:** [`redirects`](https://da.live/sheet#/jorgerzt/edsfrescopa/redirects) in da.live, rows with `Origin = EW`.

### 4. Redirects defined by an external API

- **What:** the (fictional) Fréscopa commerce decides redirects when it retires products, closes stores or ends campaigns, for example [/products/cold-brew-kit](https://main--edsfrescopa--jorgerzt.aem.page/products/cold-brew-kit) → /coffee and [/stores/madrid-gran-via](https://main--edsfrescopa--jorgerzt.aem.page/stores/madrid-gran-via) → /locations.
- **How:** EDS only applies the `redirects` sheet, so the API is synced into it. [`tools/redirects-sync/sync-redirects.mjs`](tools/redirects-sync/sync-redirects.mjs) reads [the API](https://my-custom-api.lopezpellicerjorge.workers.dev/api/frescopa/redirects), keeps the authored rows, regenerates the rows with `Origin = API`, writes the sheet to da.live and previews it (or publishes it with `--publish`). Authored rows win on conflict.
- **Trigger:** the GitHub Action [`.github/workflows/redirects-sync.yaml`](.github/workflows/redirects-sync.yaml), started by the external system (`repository_dispatch`, event `redirects-updated`), by hand or by a cron. It needs the `DA_TOKEN` secret; without it, it only runs a dry run.
- **Where it lives:** script and workflow in this repo, endpoint `frescopa/redirects` in my-custom-api, rows with `Origin = API` in the same sheet.

### 5. Multi-language site

- **What:** language copies in `/en/`, `/es/`, `/fr/` and `/jp/`, each with its own `nav` and `footer`, and an EN/ES/FR/JP switcher in the header.
- **Where it lives:** content folders in da.live and the `header` block. Translation projects with the Experience Workspace app are not set up yet.

### 6. Private area

Documented, not deployed: site authentication, a members-only section with login at the edge (protected repoless site + site token), and private data through an API. See [docs/private-area.md](docs/private-area.md).

### 7. Adobe Edge Functions

Documented, not deployed (they need a domain connected to the Adobe-managed CDN): where each piece runs and what an Edge Function would look like in this project. See [docs/edge-workers.md](docs/edge-workers.md).

### 8. Reference architecture

[docs/architecture.md](docs/architecture.md) shows how EDS, content sources (da.live, AEM Sites, commerce, headless CMS), the BYOM and json2html integrations, the code repo (GitHub or BYO Git) and the Adobe CDN fit together.

![Architecture](docs/architecture.svg)

## Development

```sh
npm ci
npm run lint
aem up   # local dev with @adobe/aem-cli
```
