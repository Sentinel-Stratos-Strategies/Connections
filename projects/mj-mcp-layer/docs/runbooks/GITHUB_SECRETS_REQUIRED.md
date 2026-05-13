# GitHub Secrets Required

Set these in the repository settings (`Settings > Secrets and variables > Actions`):

## Required Secrets

| Secret | Description | Used By |
|--------|-------------|---------|
| `CLOUDFLARE_API_TOKEN` or `CF_API_TOKEN` | Cloudflare API token for the `ellis-aegis.us`, `hitch.guru`, and `kevis.online` zones plus the MJ Worker resources. Workflows prefer `CLOUDFLARE_API_TOKEN` and fall back to `CF_API_TOKEN`. | All workflows |
| `CF_ACCOUNT_ID` | Cloudflare account ID (`5b94eedaff8fb3ccaa1b607f57963e10`) | Deploy + Scan |
| `CF_ZONE_ID_ELLIS` | Zone ID for primary authority zone (ellis-aegis.us) | Deploy + Scan |
| `CF_ZONE_ID_HITCH` | Zone ID for hitch.guru | Deploy + Scan |
| `CF_ZONE_ID_KEVIS` | Zone ID for kevis.online | Deploy + Scan |
| `OPERATOR_TOKEN` | Runtime operator token used by the Worker and smoke tests | Manual deploy smoke |
| `MCP_LEDGER_KEY` | Production signing key for ledger, visa, court, and evidence signatures | Platform proof + signed operations |

## Optional Secrets

| Secret | Description | Used By |
|--------|-------------|---------|
| `MCP_SMOKE_BASE_URL` | Override smoke base URL; defaults to `https://mcp.ellis-aegis.us` | Manual deploy smoke |
| `CODEX_ACTOR_EMAIL` | Expected Codex actor email for audit-log drift filtering | Scan workflow |

## Workflows

- `.github/workflows/mj-layer-deploy.yml` — Validation on push; manual deploy/hardening only through `workflow_dispatch`
- `.github/workflows/mj-layer-scan.yml` — Scheduled drift scan every 6 hours

## Token Permissions Required

The Cloudflare deploy token must have:
- Account > Workers Scripts > Edit
- Account > Workers Routes > Edit
- Account > D1 > Edit
- Account > Workers KV Storage > Edit
- Account > R2 > Edit
- Account > Queues > Edit
- Account > Vectorize > Edit, when vector search is enabled
- Account > Workers AI > Read, when Workers AI is enabled
- Account > Audit Logs > Read
- Account > Account Settings > Read
- Zone > Zone > Read for `ellis-aegis.us`, `hitch.guru`, and `kevis.online`
- Zone > DNS > Edit for those zones
- Zone > Workers Routes > Edit for those zones
- Zone > Rulesets > Edit and Zone > Firewall Services > Edit for WAF/rate-limit hardening
- Zone > Access: Apps and Policies > Edit, if Access is used as an outer identity gate

If deploy fails with `kv bindings require kv write perms [code: 10023]`, the token is missing `Account > Workers KV Storage > Edit`.

## Setting Secrets via CLI

```bash
gh secret set CLOUDFLARE_API_TOKEN --body "your-token-here"
# Optional compatibility alias if older scripts still reference CF_API_TOKEN:
gh secret set CF_API_TOKEN --body "your-token-here"
gh secret set CF_ACCOUNT_ID --body "5b94eedaff8fb3ccaa1b607f57963e10"
gh secret set CF_ZONE_ID_ELLIS --body "zone-id-here"
gh secret set CF_ZONE_ID_HITCH --body "zone-id-here"
gh secret set CF_ZONE_ID_KEVIS --body "zone-id-here"
gh secret set OPERATOR_TOKEN --body "long-random-operator-token"
gh secret set MCP_SMOKE_BASE_URL --body "https://mcp.ellis-aegis.us"
gh secret set MCP_LEDGER_KEY --body "long-random-ledger-signing-key"
```

Set the same runtime token in Cloudflare before deploy:

```bash
cd projects/mj-mcp-layer/mcp-layer
npx wrangler secret put OPERATOR_TOKEN
```
