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

## Development

```sh
npm ci
npm run lint
aem up   # local dev with @adobe/aem-cli
```
