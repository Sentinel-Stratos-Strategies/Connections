# GitHub Secrets Required

Set these in `Sentinel-Stratos-Strategies/Cloudflare-ellis-aegis`:

- `CF_API_TOKEN` (token with permissions across all target zones)
- `CF_ZONE_ID_ELLIS`
- `CF_ZONE_ID_HITCH`
- `CF_ZONE_ID_KEVIS`
- Optional: `CF_ACCOUNT_ID`

Workflows using them:
- `.github/workflows/hitch-kevis-hardening.yml`
- `.github/workflows/hitch-kevis-scan.yml`
