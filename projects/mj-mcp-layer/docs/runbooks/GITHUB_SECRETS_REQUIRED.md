# GitHub Secrets Required

Set these in the repository settings (`Settings > Secrets and variables > Actions`):

## Required Secrets

| Secret | Description | Used By |
|--------|-------------|---------|
| `CF_API_TOKEN` | Cloudflare API token with zone edit permissions across all target zones | All workflows |
| `CF_ZONE_ID_ELLIS` | Zone ID for primary authority zone (ellis-aegis.us) | Deploy + Scan |
| `CF_ZONE_ID_HITCH` | Zone ID for hitch.guru | Deploy + Scan |
| `CF_ZONE_ID_KEVIS` | Zone ID for kevis.online | Deploy + Scan |

## Optional Secrets

| Secret | Description | Used By |
|--------|-------------|---------|
| `CF_ACCOUNT_ID` | Cloudflare account ID (enables audit log scanning in sentinel-scan) | Scan workflow |

## Workflows

- `.github/workflows/mj-layer-deploy.yml` — Hardening + deployment on push to MJ_Layer
- `.github/workflows/mj-layer-scan.yml` — Scheduled drift scan every 6 hours

## Token Permissions Required

The `CF_API_TOKEN` must have:
- Zone > Firewall Services > Edit
- Zone > Zone Settings > Read
- Zone > DNS > Read
- Zone > Workers Routes > Read
- Account > Audit Logs > Read (optional, for sentinel-scan)

## Setting Secrets via CLI

```bash
gh secret set CF_API_TOKEN --body "your-token-here"
gh secret set CF_ZONE_ID_ELLIS --body "zone-id-here"
gh secret set CF_ZONE_ID_HITCH --body "zone-id-here"
gh secret set CF_ZONE_ID_KEVIS --body "zone-id-here"
gh secret set CF_ACCOUNT_ID --body "account-id-here"
```
