# MJ Edge dashboard vendor bundle (CP-3)

Runtime `/dashboard` loads **only** same-origin assets under `./vendor/` (no Google Fonts or unpkg in the HTML).

| File | Source (pinned; audit / refresh when upgrading) |
|------|--------------------------------------------------|
| `lucide-0.468.0.min.js` | `https://unpkg.com/lucide@0.468.0/dist/umd/lucide.min.js` |
| `fonts/inter-latin-wght-normal.woff2` | `@fontsource-variable/inter@5.1.1` (jsDelivr file mirror) |
| `fonts/space-grotesk-latin-wght-normal.woff2` | `@fontsource-variable/space-grotesk@5.1.1` |
| `fonts.css` | repo-owned `@font-face` for those woff2 files |

**SRI** on Lucide in `mj-edge-v2.html`. Recompute after any Lucide file change:

```bash
node -e "const c=require('crypto');const fs=require('fs');const b=fs.readFileSync('vendor/lucide-0.468.0.min.js');console.log('sha384-'+c.createHash('sha384').update(b).digest('base64'));"
```
