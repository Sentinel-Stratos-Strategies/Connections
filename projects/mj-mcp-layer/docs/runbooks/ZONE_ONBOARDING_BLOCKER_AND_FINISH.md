# Zone Onboarding Blocker + Finish Steps

## Current blocker
Cloudflare API token in use cannot create zones.
Error:
- `Requires permission "com.cloudflare.api.account.zone.create" to create zones for the selected account`

## What is already done
- MJ layer build package pushed to `Connections` branch `MJ_Layer`
- GitHub secrets set for:
  - `CF_API_TOKEN`
  - `CLOUDFLARE_API_TOKEN`
  - `CLOUDFLARE_ACCOUNT_ID`
  - `CF_ZONE_ID_ELLIS`
  - `MJ_EDGE_OPERATOR_TOKEN`
  - `JWT_SECRET`
- Kevis repo secrets set for deploy path

## What remains
- Create/add zones in Cloudflare account:
  - `hitch.guru`
  - `kevis.online`
- Then set:
  - `CF_ZONE_ID_HITCH`
  - `CF_ZONE_ID_KEVIS`
  in both repos:
  - `Sentinel-Stratos-Strategies/Connections`
  - `Sentinel-Stratos-Strategies/Cloudflare-ellis-aegis`

## Minimal finish commands
After zones exist and IDs are known:

```bash
gh secret set CF_ZONE_ID_HITCH -R Sentinel-Stratos-Strategies/Connections --body "<HITCH_ZONE_ID>"
gh secret set CF_ZONE_ID_KEVIS -R Sentinel-Stratos-Strategies/Connections --body "<KEVIS_ZONE_ID>"
gh secret set CF_ZONE_ID_HITCH -R Sentinel-Stratos-Strategies/Cloudflare-ellis-aegis --body "<HITCH_ZONE_ID>"
gh secret set CF_ZONE_ID_KEVIS -R Sentinel-Stratos-Strategies/Cloudflare-ellis-aegis --body "<KEVIS_ZONE_ID>"
```

Then run workflow:
- `MJ Layer Deploy` on `Connections` `MJ_Layer` branch.
