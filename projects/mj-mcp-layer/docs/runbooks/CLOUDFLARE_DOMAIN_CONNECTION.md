# Cloudflare Domain Connection

This is the exact connection contract for wiring the enterprise MJ MCP Layer to Cloudflare without mixing it into the separate security-agent lane.

## Authority

- Cloudflare account: `5b94eedaff8fb3ccaa1b607f57963e10`
- Primary authority zone: `ellis-aegis.us`
- Primary Worker: `mj-edge`
- Primary public endpoints:
  - `https://mj.ellis-aegis.us`
  - `https://mcp.ellis-aegis.us`
  - `https://codex.ellis-aegis.us`

## Required Cloudflare Resources

| Resource | Name | Binding |
|---|---|---|
| Worker | `mj-edge` | runtime |
| D1 | `ellis-aegis-control-plane` | `DB` |
| KV | existing namespace id `5a7fbf6b63bf4b02bb14ab7cd3d2f521` | `FLAGS` |
| R2 | `ellis-aegis-evidence` | `EVIDENCE_BUCKET` |
| Queue | `ellis-aegis-watchers` | `WATCHER_QUEUE` |

The Worker config lives at `projects/mj-mcp-layer/mcp-layer/wrangler.jsonc`.

## Required Worker Routes

| Host route | Worker | Purpose |
|---|---|---|
| `mj.ellis-aegis.us/*` | `mj-edge` | operator control plane |
| `mcp.ellis-aegis.us/*` | `mj-edge` | MCP protocol entry |
| `codex.ellis-aegis.us/*` | `mj-edge` | Codex mini-lane authority |

Project lanes stay narrow:

| Route | Worker | Rule |
|---|---|---|
| `kevis.online/api/*` | `kevis-mj-edge` | project-specific API only |
| `kevis.online/mcp/*` | `mj-edge` | protected MJ lane after DNS is stable |
| `kevis.online/turn/*` | `mj-edge` | protected MJ lane after DNS is stable |
| `kevis.online/audit/*` | `mj-edge` | protected MJ lane after DNS is stable |
| `hitch.guru/mcp/*` | `mj-edge` | protected MJ lane after DNS is stable |
| `hitch.guru/turn/*` | `mj-edge` | protected MJ lane after DNS is stable |
| `hitch.guru/audit/*` | `mj-edge` | protected MJ lane after DNS is stable |

Do not steal apex or app routes from Kevis/Hitch public surfaces.

## Required GitHub Secrets

- `CF_API_TOKEN`
- `CF_ACCOUNT_ID`
- `CF_ZONE_ID_ELLIS`
- `CF_ZONE_ID_HITCH`
- `CF_ZONE_ID_KEVIS`
- `OPERATOR_TOKEN`
- optional `MCP_SMOKE_BASE_URL`, default `https://mcp.ellis-aegis.us`

## Required Cloudflare API Token Scopes

- Account > Workers Scripts > Edit
- Account > Workers Routes > Edit
- Account > D1 > Edit
- Account > Workers KV Storage > Edit
- Account > R2 > Edit
- Account > Queues > Edit
- Account > Audit Logs > Read
- Account > Account Settings > Read
- Zone > Zone > Read for `ellis-aegis.us`, `hitch.guru`, and `kevis.online`
- Zone > DNS > Edit for those zones
- Zone > Workers Routes > Edit for those zones
- Zone > Rulesets > Edit and Zone > Firewall Services > Edit for WAF/rate-limit hardening
- Zone > Access: Apps and Policies > Edit, if Access is used as the outer identity gate

## Host Connection Commands

From the repo root:

```bash
cd projects/mj-mcp-layer/mcp-layer
npm ci
npx wrangler whoami
npx wrangler secret put OPERATOR_TOKEN
npx wrangler d1 execute ellis-aegis-control-plane --remote --file=./migrations/0001_init.sql
npx wrangler deploy --dry-run
npx wrangler deploy
OPERATOR_TOKEN="$OPERATOR_TOKEN" npm run smoke -- --base-url https://mcp.ellis-aegis.us
npm run manifest:deployment
```

The smoke must prove:

- `/healthz` returns `200`.
- `/mcp` without MJ policy headers returns `403`.
- `/mcp` with policy headers plus operator auth returns `200`.
- `/api/change-request` cannot bypass the policy gate.
- `/api/ledger?limit=abc` succeeds and falls back to a bounded limit.
- `/audit/events?limit=abc` succeeds with `forensic.read`.

## Live Auth Note

Codex can run the deploy only when this shell can see one of these:

- `CF_API_TOKEN` or `CLOUDFLARE_API_TOKEN`
- authenticated `wrangler login`

Do not print token values in logs. Use presence checks only.
