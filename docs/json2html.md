# json2html

Live page: https://main--edsfrescopa--jorgerzt.aem.page/integrations/json2html

Official docs: https://www.aem.live/developer/json2html

## What it is

json2html is a generic BYOM service hosted by Adobe (a Cloudflare Worker at `json2html.adobeaem.workers.dev`). Instead of writing a service that outputs EDS markup, you give it two things:

- a **JSON endpoint** that holds the data (any API: PIM, commerce, a CMS, a spreadsheet published as JSON), and
- a **Mustache template**, kept in the code repo, that turns that JSON into EDS markup.

On preview, the worker fetches the JSON and renders the template. It returns the HTML to the admin, which ingests it like any other BYOM page: images go to the media bus and the page goes to the CDN.

## Request flow in this project

```
admin.hlx.page  preview /integrations/json2html
  |  overlay (see byom.md)
  v
my-custom-api   /api/frescopa/byom/integrations/json2html.html
  |  302 Location: json2html worker
  v
json2html.adobeaem.workers.dev/jorgerzt/edsfrescopa/main/integrations/json2html
  |  1. looks up the config entry that matches /integrations/json2html
  |  2. GET endpoint  -> my-custom-api /api/frescopa/data/todays-roasts.json
  |  3. GET template -> main--edsfrescopa--jorgerzt.aem.page/templates/json2html/todays-roasts.html
  |  4. Mustache render -> EDS HTML
  v
admin ingests the HTML -> content bus -> .aem.page
```

The 302 step exists only because this site shows BYOM and json2html side by side and has a single overlay. In a json2html-only project, the overlay URL is the worker itself:

```json
"overlay": { "url": "https://json2html.adobeaem.workers.dev/jorgerzt/edsfrescopa/main", "type": "markup" }
```

## Worker config

The config is stored per org/site/branch in the worker:

```sh
curl -X POST https://json2html.adobeaem.workers.dev/config/jorgerzt/edsfrescopa/main \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  --data '[{
    "path": "/integrations/json2html",
    "endpoint": "https://my-custom-api.lopezpellicerjorge.workers.dev/api/frescopa/data/todays-roasts.json",
    "template": "/templates/json2html/todays-roasts.html"
  }]'
```

`$TOKEN` must belong to a site admin. The official docs use `Authorization: token <admin API key>`. With an IMS login, as here, `Bearer <IMS token>` was accepted, while `token <IMS token>` returned 401.

| Option | Use |
| --- | --- |
| `path` | Path prefix that this entry handles. |
| `endpoint` | JSON URL. It can contain `{{id}}`, filled from `regex`, to build one page per record. |
| `regex` | Extracts the `{{id}}` from the request path, e.g. `"/[^/]+$/"` takes the last segment (`/products/house-blend` → `house-blend`). |
| `template` | Mustache template path on the site (code bus) or an absolute URL. |
| `arrayKey` / `pathKey` | Use one JSON array and pick the item whose `pathKey` matches the page path. |
| `headers` / `forwardHeaders` | Headers sent to the endpoint (API keys) or forwarded from the admin request. |
| `relativeURLPrefix` | Makes relative image URLs in the JSON absolute. |

With `regex` and `endpoint` templated, a single entry can produce hundreds of product or store pages from one template.

## The template

[`templates/json2html/todays-roasts.html`](../templates/json2html/todays-roasts.html) is plain Mustache that outputs the same markup contract as BYOM (see [byom.md](byom.md#the-markup-contract)):

- `{{title}}`, `{{heroImage.src}}`: values and dotted paths.
- `{{#products}} … {{/products}}`: loops over arrays. Here it builds the rows of `product-list-page-custom`.
- `{{#featured}}` inside the loop: conditionals that only render the cards for featured products.
- `{{#hasBrewGuide}}`: an optional section. Mustache has no `if length`, so the JSON includes a boolean.
- `{{products.length}}`: the array length.

The template is served from `aem.page` like any other code file, so a `git push` (with AEM Code Sync) updates it. Then preview the page again.

## The data

`GET https://my-custom-api.lopezpellicerjorge.workers.dev/api/frescopa/data/todays-roasts.json`

```json
{
  "title": "Today's Roasts",
  "seoTitle": "Today's Roasts | json2html",
  "description": "...",
  "eyebrow": "json2html",
  "intro": "...",
  "heroImage": { "src": "https://...", "alt": "..." },
  "updated": "2026-11-03",
  "products": [
    { "sku": "...", "name": "...", "description": "...", "price": "$14.99",
      "image": "https://...", "roast": "Dark", "origin": "Brazil & Vietnam", "featured": true }
  ],
  "brewGuide": [ { "method": "Espresso", "ratio": "1:2", "time": "25-30 s", "tip": "..." } ],
  "hasBrewGuide": true
}
```

## Demo script: change data, see the page change

1. Edit the JSON in my-custom-api (`PUT /_admin/endpoints/frescopa/data/todays-roasts.json`). For example, change a price or add a product.
2. Optional: check the render directly at `https://json2html.adobeaem.workers.dev/jorgerzt/edsfrescopa/main/integrations/json2html`.
3. Preview the page again:

   ```sh
   curl -X POST -H "Authorization: Bearer $TOKEN" \
     https://admin.hlx.page/preview/jorgerzt/edsfrescopa/main/integrations/json2html
   ```

Like BYOM, json2html runs **when the page is previewed or published**, not on every visit. The output is static and cached, so it stays fast. For per-request data, such as stock, personalised prices or the visitor's location, see [edge-workers.md](edge-workers.md).
