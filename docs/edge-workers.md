# Edge workers: AEM Edge Functions and other workers in this project

BYOM and json2html run **at publish time**: the page is built once, when it is previewed or published, and then served from cache. Anything that must differ **per request** (the visitor's location, live stock, a personalised price, an authenticated area) belongs at the edge: code that runs in the CDN in front of the site. In AEM this is **AEM Edge Functions**.

Official docs:
- AEM Edge Functions: https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/implementing/developing/edge-functions
- Tutorial for Edge Delivery Services (it uses Frescopa as the demo site): https://experienceleague.adobe.com/en/docs/experience-manager-learn/cloud-service/edge-functions/edge-functions-setup/setup-eds
- Boilerplate: https://github.com/adobe/aem-edge-functions-boilerplate · Examples: https://github.com/adobe/aem-edge-functions-examples

## Where each piece runs

```
                    publish time (admin)                              request time (CDN)
 da.live ───────┐
 my-custom-api ─┼─> admin.hlx.page ─> content bus ─> aem.live origin ─> Adobe Managed CDN ─> browser
 json2html ─────┘     (BYOM overlay)                                     │
                                                                         └─> AEM Edge Function (per request)
                                                                               ├─ fetch origin page / APIs
                                                                               └─ return HTML / JSON
```

| Piece | Who runs it | When | In this project |
| --- | --- | --- | --- |
| da.live | Adobe | Publish time | Main content source |
| my-custom-api | Cloudflare Worker (yours) | Publish time | BYOM overlay and JSON data |
| json2html | Cloudflare Worker (Adobe) | Publish time | Renders `/integrations/json2html` |
| AEM Edge Functions | Adobe Managed CDN (Fastly Compute) | Every request | Not deployed (see below) |
| Client-side blocks | Browser | Every request | `blocks/*` (decoration, sorting) |

## AEM Edge Functions in short

- JavaScript modules (Fastly Compute runtime, `@fastly/js-compute`) deployed to the **Adobe Managed CDN**. They work for EDS and for the AEM Java stack.
- Common uses:
  - Personalise by geo or device before the page loads.
  - Act as middleware between the CDN and the origin.
  - Aggregate or reshape third-party APIs while keeping their keys server-side.
  - Render HTML at the edge from several backends, which suits SEO and AI crawlers.
- Limits:
  - About 100 ms average execution time.
  - 1 s of CPU per request and 120 s wall time.
  - 128 MB heap.
  - EDS programs get **3 functions** (dev / stage / prod).
- There are two caches to manage: the CDN cache and the function's fetch cache. A data change can require purging both, using surrogate keys.

### Prerequisites (why this demo does not have one deployed)

1. A **Cloud Manager program with the Edge Delivery Services add-on**, and the EDS site onboarded in Cloud Manager (origin `https://main--edsfrescopa--jorgerzt.aem.live/`).
2. A **custom domain** with a certificate, mapped to the Adobe Managed CDN. `*.aem.page` / `*.aem.live` URLs cannot route to edge functions.
3. The **Deployment Manager** role and an EDS configuration pipeline.
4. `aio` CLI with the plugin: `aio plugins install @adobe/aio-cli-plugin-aem-edge-functions`.

This demo site runs only on `aem.page`, with no Cloud Manager program or custom domain, so the edge layer is documented here but not deployed.

### What it would look like here

1. Declare the function (`config/edgeFunctions.yaml`, in the Cloud Manager config repo):

   ```yaml
   kind: "EdgeFunctions"
   version: "1"
   data:
     functions:
       - name: frescopa-edge
   ```

2. Route paths to it (`config/cdn.yaml`):

   ```yaml
   kind: "CDN"
   version: "1"
   data:
     originSelectors:
       rules:
         - name: live-roasts
           when: { reqProperty: path, equals: "/api/live-roasts" }
           action: { type: selectAemOrigin, originName: edgefunction-frescopa-edge }
   ```

3. Write the code (`src/index.js` from the boilerplate). For example, take the stock and the visitor's country at request time, while the catalogue itself still comes from json2html:

   ```js
   /// <reference types="@fastly/js-compute" />
   import { getGeolocationForIpAddress } from 'fastly:geolocation';

   addEventListener('fetch', (event) => event.respondWith(handle(event)));

   async function handle(event) {
     const url = new URL(event.request.url);
     if (url.pathname === '/api/live-roasts') {
       const geo = getGeolocationForIpAddress(event.client.address);
       const res = await fetch('https://my-custom-api.lopezpellicerjorge.workers.dev/api/frescopa/data/todays-roasts.json',
         { backend: 'mycustomapi' });
       const data = await res.json();
       return new Response(JSON.stringify({ country: geo?.country_code, products: data.products }), {
         headers: { 'content-type': 'application/json', 'cache-control': 'max-age=60' },
       });
     }
     return new Response('Not found', { status: 404 });
   }
   ```

   A block on `/integrations/json2html` would then call `/api/live-roasts` on the same domain to overlay stock or local prices.

4. Build, test and deploy:

   ```sh
   aio aem edge-functions setup                     # choose program, "Edge Delivery Services", site
   aio aem edge-functions serve                     # local, http://127.0.0.1:7676
   aio aem edge-functions build
   aio aem edge-functions deploy frescopa-edge
   aio aem edge-functions tail-logs frescopa-edge
   ```

   `edgeFunctions.yaml` and `cdn.yaml` are deployed through the Cloud Manager Edge Delivery pipeline.

## BYO CDN workers (alternative)

Without the Adobe Managed CDN, many EDS sites put their own CDN in front of `aem.live`, for example Cloudflare, Akamai or Fastly. In that case a worker in that CDN plays the same role. aem.live publishes reference setups, such as https://www.aem.live/docs/byo-cdn-cloudflare-worker-setup. The trade-off is that you operate the CDN and the worker yourself, while AEM Edge Functions run inside Adobe's managed and supported CDN.

## Choosing the right layer

| Need | Use |
| --- | --- |
| Authors write and edit the page | da.live |
| Markup already exists in another system | BYOM |
| Data is JSON and the page is a template over it | json2html |
| Varies per visitor or second, or needs secrets | AEM Edge Functions (or a BYO CDN worker) |
| Small interactive behaviour in the page | A block (client-side JS) |
