# MJ Edge dashboard vendor bundle (CP-3)

Runtime loads **only same-origin** `/dashboard/vendor/*` — no `fonts.googleapis.com`, `fonts.gstatic.com`, or third-party CDNs.

| Artifact | Pinned source (download / verification only) |
|----------|-----------------------------------------------|
| `lucide.min.js` | https://unpkg.com/lucide@**0.469.0**/dist/umd/lucide.min.js |
| `fonts/inter-latin-wght-normal.woff2` | Google Fonts CSS (`Inter` variable latin); fetched from `fonts.gstatic.com` URL at pin time |
| `fonts/space-grotesk-latin-wght-normal.woff2` | Same pattern for `Space Grotesk` variable latin |
| `fonts.css` | Local `@font-face` pointing at the two `.woff2` files |

**SRI:** `mj-edge-v2.html` sets `integrity="sha384-…"` on the Lucide `<script>`. Recompute after any Lucide upgrade:

```bash
openssl dgst -sha384 -binary dashboard/vendor/lucide.min.js | openssl base64 -A
# use as integrity="sha384-<output>"
```

**CSP:** Dashboard HTML includes a matching `<meta http-equiv="Content-Security-Policy">`; the Worker also sets the same policy on `*.html` asset responses (`DASHBOARD_CSP` in `mcp-layer/src/index.ts`).

Bump Lucide or fonts: re-download into `vendor/`, refresh SRI + this table, run `sync-public.sh`.
