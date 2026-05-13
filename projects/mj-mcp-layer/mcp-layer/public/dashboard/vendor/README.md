# MJ Edge dashboard vendor bundle (CP-3)

All assets here are **pinned** and **self-hosted** so `/dashboard` does not load `fonts.googleapis.com`, `fonts.gstatic.com`, or `unpkg.com` at runtime.

| File | Source (download only; not loaded from CDN in prod) |
|------|------------------------------------------------------|
| `lucide-0.468.0.min.js` | https://unpkg.com/lucide@0.468.0/dist/umd/lucide.min.js |
| `fonts/inter-latin-*.woff2` | `@fontsource/inter@5.0.16` on jsDelivr (build-time mirror) |
| `fonts/space-grotesk-latin-*.woff2` | `@fontsource/space-grotesk@5.0.16` on jsDelivr |

**SRI:** `mj-edge-v2.html` sets `integrity="sha384-…"` on the Lucide script. Recompute after any Lucide upgrade:

```bash
openssl dgst -sha384 -binary vendor/lucide-0.468.0.min.js | openssl base64 -A
# prefix with sha384- in HTML
```

Updating Lucide or fonts: bump versions here, re-download, update CHECKPOINTS CP-3 notes, run `sync-public.sh`.
