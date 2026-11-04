# Redirects

Fréscopa manages redirects the standard EDS way: a sheet called `redirects` in the root of the content (da.live / Experience Workspace). No code is involved.

## What is configured

Sheet: [da.live/sheet#/jorgerzt/edsfrescopa/redirects](https://da.live/sheet#/jorgerzt/edsfrescopa/redirects) · JSON: [/redirects.json](https://main--edsfrescopa--jorgerzt.aem.page/redirects.json)

| Source | Destination | Why |
| --- | --- | --- |
| [/cafe](https://main--edsfrescopa--jorgerzt.aem.page/cafe) | /coffee | Spanish-friendly alias |
| [/maquinas](https://main--edsfrescopa--jorgerzt.aem.page/maquinas) | /machines | Spanish-friendly alias |
| [/tiendas](https://main--edsfrescopa--jorgerzt.aem.page/tiendas) | /locations | Spanish-friendly alias |
| [/nosotros](https://main--edsfrescopa--jorgerzt.aem.page/nosotros) | /about-us | Spanish-friendly alias |
| [/promo](https://main--edsfrescopa--jorgerzt.aem.page/promo) | /subscription | Campaign vanity URL |
| [/en/accessories](https://main--edsfrescopa--jorgerzt.aem.page/en/accessories) | /accessories | Page that doesn't exist in `/en` |
| [/blog/rise-and-shine](https://main--edsfrescopa--jorgerzt.aem.page/blog/rise-and-shine) | /rise-and-shine | Old URL from a previous site structure |

All of them return **301** on the preview site (`aem.page`). The sheet has only been previewed; publish it to make the redirects work on `aem.live`.

## How it works

- The sheet needs two columns: `Source` (a path relative to the site) and `Destination` (a relative path or a full URL to another site).
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
