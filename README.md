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

## Integrations: BYOM, json2html and edge workers

Two pages are not authored in DA. Their content comes from an external service ([my-custom-api](https://my-custom-api.lopezpellicerjorge.workers.dev/llms.txt), a Cloudflare Worker):

| Page | Technique | How |
| --- | --- | --- |
| [/integrations/byom](https://main--edsfrescopa--jorgerzt.aem.page/integrations/byom) | BYOM | The site's content **overlay** points at my-custom-api, which returns finished EDS HTML. Other paths return 404 there and fall back to da.live. See [docs/byom.md](docs/byom.md). |
| [/integrations/json2html](https://main--edsfrescopa--jorgerzt.aem.page/integrations/json2html) | json2html | The overlay returns a 302 to Adobe's json2html worker. The worker renders JSON from my-custom-api with [`templates/json2html/todays-roasts.html`](templates/json2html/todays-roasts.html). See [docs/json2html.md](docs/json2html.md). |

Both pages are built when they are previewed or published. For per-request logic at the CDN (AEM Edge Functions), and how all these pieces fit together, see [docs/edge-workers.md](docs/edge-workers.md).

- **Architecture:** [docs/architecture.md](docs/architecture.md) shows how EDS, content sources (da.live, AEM Sites, commerce, headless CMS), the BYOM and json2html integrations, the code repo (GitHub or BYOGit) and the Adobe CDN fit together.

  ![Architecture](docs/architecture.svg)
- **Redirects:** [docs/redirects.md](docs/redirects.md). A `redirects` sheet in da.live, for example [/cafe](https://main--edsfrescopa--jorgerzt.aem.page/cafe) → /coffee (301). Redirects owned by an external system arrive through an API and are synced into the same sheet (`tools/redirects-sync`, GitHub Action `redirects-sync.yaml`), for example [/products/cold-brew-kit](https://main--edsfrescopa--jorgerzt.aem.page/products/cold-brew-kit) → /coffee.
- **Private areas:** [docs/private-area.md](docs/private-area.md) covers site authentication and a members-only section using edge login, a protected repoless site and a site token.

## Development

```sh
npm ci
npm run lint
aem up   # local dev with @adobe/aem-cli
```
