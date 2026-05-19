# MJ Active Domains And Mini Lanes - 2026-05-17

Verified: 2026-05-17, America/Chicago  
Live audit: Stratos host `curl` verification, **2026-05-17T18:45Z UTC** (account `cf-account-id-placeholder`).

## Live audit (routes + health)

- **`https://api.ellis-aegis.us/api/health`**: **`200`** (Pass: control-plane is live).
- **`mcp.ellis-aegis.us/healthz`**, **`mj.ellis-aegis.us/healthz`**: **`200`** (Pass: mj-edge is live).
- **`kevis.online/api/health`**: **`200`** (Pass: kevis-mj-edge is live).
- **`hitch.guru/mcp`**, **`kevis.online/mcp`**: **`403`** (Expected: mj-edge policy denial without headers).
- **`hitch.guru/healthz`**, **`kevis.online/healthz`**: **`522`** (Origin timeout: expected if `/healthz` is not Worker-routed and origin is absent).

## Public Host Status (Update)

| Host | Live status | Worker / origin observed | Use it for |
| --- | --- | --- | --- |
| `mcp.ellis-aegis.us` | active: `200` | `mj-edge` | Primary phone/tool/MCP endpoint. |
| `mj.ellis-aegis.us` | active: `200` | `mj-edge` | Operator dashboard/control-plane alias. |
| `api.ellis-aegis.us` | active: `200` | `ellis-aegis-control-plane` | API/control-plane host. |
| `hitch.guru` | active: `/mcp` `403` | `mj-edge` | DNS + routes propagated. |
| `kevis.online` | active: `/mcp` `403`, `/api/health` `200` | `mj-edge` + `kevis-mj-edge` | DNS + routes propagated. |

## Preflight Fix Verification

The `$CLOUDFLARE_ZONE_ID` unexpanded variable bug has been fixed in `cloudflare/load-cf-env.sh` and `governance/scripts/load-cf-env.sh`. 
- **Verification:** `bash cloudflare/00-preflight.sh` locally on Stratos host returns **`✅ zone: ellis-aegis.us`**.

## MUA / Vectorize Status

- **Control-plane package:** `npm ci`, `npm run check`, `npm test` all **PASS**.
- **Vectorize Index:** `ellis-aegis-mua-memory` creation is **intentionally deferred** as documented in `MUA_LAYER_MASTER_PLAN.md`.

## Authenticated Verification (MJ Layer v2 Deploy)

Post-deployment verification of `mj-edge` and `ellis-aegis-control-plane` using `OPERATOR_TOKEN`:

- **Main MCP Tunnel (`https://mcp.ellis-aegis.us/mcp`):** Returns `protocol: mcp` (Pass).
- **Console Lane Registry (`https://api.ellis-aegis.us/api/console/lanes`):** Returns `count: 36` (Pass).
  - New lanes verified: `mj-antigravity`, `mj-orbstack`.
  - Infrastructure lanes added: `mj-kevis-mcp`, `mj-hitch-mcp` (in `infrastructure-connections.json`).

**Gemini / agent pickup:** [GEMINI-HANDOFF-MJ-LAYER-2026-05-17.md](./GEMINI-HANDOFF-MJ-LAYER-2026-05-17.md)
