# MJ Layer (Connections) — tools & packages

Machine-readable twin: [`manifests/catalog/project-tools.yaml`](../../manifests/catalog/project-tools.yaml).  
Manifest hub: [`docs/MANIFEST_INDEX.md`](../MANIFEST_INDEX.md).

## Host toolchain

| Tool | Notes |
|------|--------|
| **Node.js** | **20+** recommended (align with Ellis Aegis Workers tooling). |
| **npm** | `npm ci` / `npm install` per package below. |
| **Wrangler** | Dev dependency in `mcp-layer`; use `npx wrangler` from `projects/mj-mcp-layer/mcp-layer`. |
| **git** | Push/pull for GitHub. |
| **gh** | Optional — workflows, secrets, PRs. |

## NPM packages

| Path | Package | Role |
|------|---------|------|
| `projects/mj-mcp-layer/mcp-layer/` | `mj-mcp-layer` | **`mj-edge`** Worker — MCP routing, policy, dashboard assets |
| `projects/mj-mcp-layer/platform/` | `@mj-mcp/platform` | **`mcp-cli`** — platform automation / ledger helpers |
| `projects/mj-mcp-layer/frontend/` | `@mj-layer/control-panel` | Vite + React operator UI |

### `mcp-layer` (Worker)

| Script | Purpose |
|--------|---------|
| `npm run dev` | `wrangler dev` |
| `npm run deploy` | `wrangler deploy` |
| `npm run test` | `tsx --test tests/*.test.ts` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run smoke` | Control-plane smoke script |
| `npm run manifest:deployment` | Deployment manifest writer |
| `npm run tail` | `wrangler tail` |

### `platform`

| Script | Purpose |
|--------|---------|
| `npm run build` | Compile `dist/` |
| `npm run test` | Platform tests |
| `npm run cli` | `tsx src/cli/index.ts` |

### `frontend`

| Script | Purpose |
|--------|---------|
| `npm run dev` | Vite dev server |
| `npm run build` | Production build |
| `npm run preview` | Preview build |

## Declarative manifests

| Area | Location |
|------|----------|
| Edge routing | `projects/mj-mcp-layer/cloudflare/manifests/mj-edge-routing.yaml` |
| Zones / tenants / policy | `projects/mj-mcp-layer/manifests/zones|tenants|policies/` |
| Lane packages | `projects/mj-mcp/lanes/*/lane.manifest.json` |
| Lane identities map | `projects/mj-mcp/lanes/lane-identities.v1.json` |
| Connection catalog | `projects/mj-mcp/connections/infrastructure-connections.json` |
| Manifest catalog (this repo) | `projects/mj-mcp-layer/manifests/catalog/project-manifest-catalog.yaml` |

## GitHub Actions

| Workflow | Role |
|----------|------|
| `mj-layer-deploy.yml` | Deploy MJ Layer / mj-edge |
| `mj-layer-scan.yml` | Scheduled or manual scans |
| `mj-layer-canary.yml` | Canary path |

## Sentinel mirror

Copied inventories + strat-tools lists: **`docs/references/sentinel-volume/MANIFEST_INDEX.md`**.

## Sibling repo

Cloudflare Workers substrate (control plane, MUA, Brady, security-agent, hardening): **Cloudflare-ellis-aegis** — see `docs/MANIFEST_INDEX.md` there.
