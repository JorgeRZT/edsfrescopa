# Redirects

Fréscopa manages redirects the standard EDS way: a sheet called `redirects` in the root of the content (da.live / Experience Workspace). The sheet is fed from two places:

1. **Authors in Experience Workspace** edit rows by hand (no code).
2. **An external system exposes redirects through an API**, and a sync job writes them into the same sheet. See [Redirects defined by an API](#redirects-defined-by-an-api).

The `Origin` column tells them apart: `EW` for authored rows, `API` for rows managed by the sync.

## Authored redirects (Experience Workspace)

Sheet: [da.live/sheet#/jorgerzt/edsfrescopa/redirects](https://da.live/sheet#/jorgerzt/edsfrescopa/redirects) · JSON: [/redirects.json](https://main--edsfrescopa--jorgerzt.aem.page/redirects.json)

| Source | Destination | Origin | Why |
| --- | --- | --- | --- |
| [/cafe](https://main--edsfrescopa--jorgerzt.aem.page/cafe) | /coffee | EW | Spanish-friendly alias |
| [/maquinas](https://main--edsfrescopa--jorgerzt.aem.page/maquinas) | /machines | EW | Spanish-friendly alias |
| [/tiendas](https://main--edsfrescopa--jorgerzt.aem.page/tiendas) | /locations | EW | Spanish-friendly alias |
| [/nosotros](https://main--edsfrescopa--jorgerzt.aem.page/nosotros) | /about-us | EW | Spanish-friendly alias |
| [/promo](https://main--edsfrescopa--jorgerzt.aem.page/promo) | /subscription | EW | Campaign vanity URL |
| [/en/accessories](https://main--edsfrescopa--jorgerzt.aem.page/en/accessories) | /accessories | EW | Page that doesn't exist in `/en` |
| [/blog/rise-and-shine](https://main--edsfrescopa--jorgerzt.aem.page/blog/rise-and-shine) | /rise-and-shine | EW | Old URL from a previous site structure |

All of them return **301** on the preview site (`aem.page`). The sheet has only been previewed; publish it to make the redirects work on `aem.live`.

## Redirects defined by an API

**Can an API pass redirects to EDS?** Yes, but EDS does not call your API on every request. EDS applies whatever is in the `redirects` sheet of the content source, so the API has to land in that sheet, which then goes through preview and publish like any other content. Fréscopa implements this as a sync.

### The scenario

The Fréscopa commerce retires products, replaces machine models, closes stores and ends campaigns. It owns those URL changes and publishes them through an API:

`GET` [my-custom-api.../api/frescopa/redirects](https://my-custom-api.lopezpellicerjorge.workers.dev/api/frescopa/redirects)

```json
{
  "system": "frescopa-commerce",
  "updatedAt": "2026-11-04T13:30:00Z",
  "redirects": [
    { "source": "/products/cold-brew-kit", "destination": "/coffee", "reason": "Producto descatalogado" },
    { "source": "/products/frescopa-barista-pro", "destination": "/machines", "reason": "Modelo sustituido por la nueva gama" },
    { "source": "/campaigns/black-friday", "destination": "/subscription", "reason": "Campaña finalizada" },
    { "source": "/stores/madrid-gran-via", "destination": "/locations", "reason": "Tienda cerrada" }
  ]
}
```

### The flow

```
Commerce / PIM / CMS ──(1) API with its redirects
        │
        └─(2) repository_dispatch "redirects-updated" (or manual run / cron)
                 │
GitHub Action  .github/workflows/redirects-sync.yaml
        │  node tools/redirects-sync/sync-redirects.mjs
        ├─(3) GET  admin.da.live/source/<org>/<site>/redirects.json   keep rows with Origin = EW
        ├─(4) GET  the API                                            rebuild rows with Origin = API
        ├─(5) PUT  admin.da.live/source/<org>/<site>/redirects.json   merged sheet
        └─(6) POST admin.hlx.page/preview/<org>/<site>/main/redirects.json  (+ /live with --publish)
                 │
EDS edge ── 301 for every row on aem.page (and aem.live once published)
```

### Rules of the merge

- Rows authored in EW (`Origin` empty or `EW`) are never touched.
- Rows with `Origin = API` are regenerated on each run, so a redirect removed from the API disappears from the site on the next sync.
- If the API sends a `Source` that an author already defined, **the authored row wins** and the job logs a conflict.
- Authors see the API rows in the sheet, but should not edit them: the next sync overwrites them.

### Result (preview)

| Source | Destination | Origin |
| --- | --- | --- |
| [/products/cold-brew-kit](https://main--edsfrescopa--jorgerzt.aem.page/products/cold-brew-kit) | /coffee | API |
| [/products/frescopa-barista-pro](https://main--edsfrescopa--jorgerzt.aem.page/products/frescopa-barista-pro) | /machines | API |
| [/campaigns/black-friday](https://main--edsfrescopa--jorgerzt.aem.page/campaigns/black-friday) | /subscription | API |
| [/stores/madrid-gran-via](https://main--edsfrescopa--jorgerzt.aem.page/stores/madrid-gran-via) | /locations | API |

### Run it

```bash
# Locally, with an IMS token that can write to da.live and preview through the Admin API
DA_TOKEN=... node tools/redirects-sync/sync-redirects.mjs --dry-run   # show what would change
DA_TOKEN=... node tools/redirects-sync/sync-redirects.mjs             # write + preview
DA_TOKEN=... node tools/redirects-sync/sync-redirects.mjs --publish   # write + preview + publish

# From the external system, trigger the GitHub Action
curl -X POST https://api.github.com/repos/<owner>/<repo>/dispatches \
  -H "Authorization: Bearer <github token>" \
  -d '{"event_type":"redirects-updated","client_payload":{"publish":false}}'
```

Environment variables: `DA_TOKEN` (required), `ORG`, `SITE`, `REF`, `SHEET`, `REDIRECTS_API`. In the workflow, store the token as the repository secret `DA_TOKEN`; without it, the action only runs a dry run.

**Token in production:** a personal IMS token expires in about 24 hours. For an unattended job, use an IMS technical account (service credentials) with write permission on the da.live site and preview/publish permission in the site's Admin API configuration.

### Other ways to do it, and when

| Option | How | Use when | Watch out |
| --- | --- | --- | --- |
| **Sync to the sheet** (implemented) | Job writes the API rows into `redirects` + preview/publish | Exact URL redirects owned by another system | Not real time: changes apply when the job runs |
| **Overlay owns the sheet** | The BYOM overlay (or another content source) answers `/redirects.json` | The external system is the *only* owner of redirects | The overlay is checked first, so the API replaces the authored EW sheet entirely |
| **Edge / CDN at request time** | Edge Function or BYO CDN worker reads a redirect map (from an API or KV) | Patterns, wildcards, geo, headers, other status codes (302/307/308) | Code and latency in the CDN; needs a connected domain. See [edge-workers.md](edge-workers.md) |

Recommendation: keep exact redirects as content (sheet, synced if needed) and reserve the edge for rules that the sheet cannot express.

## How it works

- The sheet needs two columns: `Source` (a path relative to the site) and `Destination` (a relative path or a full URL to another site). Extra columns such as `Origin` or `Note` are allowed and ignored by EDS.
- Redirects take precedence over content: if a page exists at a `Source` path, the redirect hides it until the row is removed.
- Changes follow the usual flow. Preview the sheet and test on `.page`, then publish it for `.live` and production.
- If the workbook has several sheets, only the one named `helix-default` is used for redirects.
- The redirects are evaluated before the BYOM content overlay, so they work alongside the [BYOM](byom.md) and [json2html](json2html.md) setup.

```bash
curl -sI https://main--edsfrescopa--jorgerzt.aem.page/cafe | grep -iE '^(HTTP|location)'
# HTTP/2 301
# location: https://main--edsfrescopa--jorgerzt.aem.page/coffee
```

## What the sheet doesn't do

- **No wildcards or patterns.** Each row is an exact path. Pattern redirects (for example `/old/*` → `/new/$1`) belong in the CDN; see [edge-workers.md](edge-workers.md) and [architecture.md](architecture.md).
- **No status code choice.** Sheet redirects are always 301.
- **Migrations:** map your most visited old URLs one to one. Don't send pruned content to the home page, and watch 404s in Operational Telemetry after go-live.

Reference: [aem.live/docs/redirects](https://www.aem.live/docs/redirects).
