# BYOM (Bring Your Own Markup)

Live page: https://main--edsfrescopa--jorgerzt.aem.page/integrations/byom

Official docs: https://www.aem.live/developer/byom

## What it is

Edge Delivery Services (EDS) does not care where a page was authored. When a page is previewed, the AEM admin service asks a **content source** for that path and converts the answer into its internal model:

1. HTML is converted to Markdown.
2. The Markdown is stored in the content bus.
3. The result is rendered as `.plain.html` and full HTML, and served through the CDN.

For this site the primary source is da.live. With BYOM, any HTTP service that returns **semantic EDS HTML** can also be a content source. That includes a PIM, a headless CMS, a legacy system or an API. The service needs nothing more than a `<main>` with sections and block tables written as `div`s.

A site may declare a primary source and one optional **overlay**. The overlay is asked first. If it answers `404`, the admin falls back to the primary source.

## How it is configured in this project

The site config (`admin.hlx.page/config/jorgerzt/sites/edsfrescopa.json`, `content` section):

```json
{
  "source":  { "url": "https://content.da.live/jorgerzt/edsfrescopa/", "type": "markup" },
  "overlay": {
    "url": "https://my-custom-api.lopezpellicerjorge.workers.dev/api/frescopa/byom",
    "type": "markup",
    "suffix": ".html"
  }
}
```

To set it, POST the whole `content` object to `https://admin.hlx.page/config/jorgerzt/sites/edsfrescopa/content.json` with an admin token. POSTing to `content/overlay.json` is rejected.

When `/integrations/byom` is previewed, the admin requests:

```
{overlay.url}{path}{suffix}
= https://my-custom-api.lopezpellicerjorge.workers.dev/api/frescopa/byom/integrations/byom.html
```

`my-custom-api` is a Cloudflare Worker mock-API service. Endpoints are created with its admin API (`PUT /_admin/endpoints/<slug>`). It returns `404` for any slug it does not know, so every other path (`/coffee`, `/es/...`) still comes from da.live. You can check which source was used for a page:

```sh
curl -H "Authorization: Bearer $TOKEN" \
  https://admin.hlx.page/status/jorgerzt/edsfrescopa/main/integrations/byom
# preview.sourceLocation = markup:https://my-custom-api.../integrations/byom.html
```

## The markup contract

The service must return a full HTML document:

```html
<html>
<head>
  <title>Page title</title>                      <!-- becomes <title>, og:title -->
  <meta name="description" content="...">        <!-- becomes description, og:description -->
  <meta property="og:image" content="https://...">
</head>
<body>
  <header></header>
  <main>
    <div>                                         <!-- section -->
      <div class="teaser light left">             <!-- block: class = block name + variants -->
        <div><div>cell</div><div>cell</div></div> <!-- row / cells -->
      </div>
    </div>
    <div><h2>Next section</h2><p>Default content</p></div>
  </main>
  <footer></footer>
</body>
</html>
```

The page uses the same blocks as the authored pages (`teaser`, `cards`, `columns`), so the project code renders it with no special handling.

- **Metadata** comes from `<head>` (`title`, `meta name/property`). Do not add a `metadata` block: in BYOM markup it is not lifted to `<head>` and would render as content.
- **Images** must be absolute, publicly reachable URLs. On preview they are downloaded into the media bus and rewritten to `./media_<hash>.<ext>`. Here they point at images already ingested from DA.
- **Links** can be relative (`/coffee`) or absolute.
- The demo endpoint is public. If a real source needs credentials, see the authentication options for content sources in the BYOM docs.

## Change the page

1. Update the endpoint body in my-custom-api (`PUT /_admin/endpoints/frescopa/byom/integrations/byom.html`, with `body` as an HTML string).
2. Preview again:

   ```sh
   curl -X POST -H "Authorization: Bearer $TOKEN" \
     https://admin.hlx.page/preview/jorgerzt/edsfrescopa/main/integrations/byom
   ```

Nothing reaches the site until it is previewed or published. BYOM is **pull-at-publish**, not per request. To keep a page in sync automatically, the source system (or a webhook or cron) calls the admin preview/publish API when its content changes.

## Coexisting with json2html (one overlay, two integrations)

A site has only **one** overlay, and json2html is normally configured *as* that overlay. To show both techniques on one site, the overlay stays on my-custom-api, and the slug for `/integrations/json2html` returns a redirect:

```
GET .../api/frescopa/byom/integrations/json2html.html
-> 302 Location: https://json2html.adobeaem.workers.dev/jorgerzt/edsfrescopa/main/integrations/json2html
```

The admin follows the redirect, so json2html produces that one page. See [json2html.md](json2html.md). In a real project you would usually choose one overlay: either a BYOM service that routes internally, or json2html directly.

## When to use it

- Content that lives in another system and must look native: product pages from a PIM, legacy articles, regulated content from a records system.
- Bulk or generated pages where authoring in documents makes no sense.
- Do not use it when authors should edit the page. In that case keep it in da.live, and use BYOM only for the generated part.
