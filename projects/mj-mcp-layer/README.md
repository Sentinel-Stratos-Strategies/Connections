# MJ MCP Layer

Enterprise-grade MCP Edge Routing & Multi-Tenant Policy Enforcement platform.

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    Operator CLI / API                     │
│          (Policy manifest input, approval workflows)     │
└────────────────────────┬─────────────────────────────────┘
                         │
┌────────────────────────▼─────────────────────────────────┐
│                Core Orchestration Engine                  │
│          (Ledger, drift detection, policy evaluation)    │
└────────────────────────┬─────────────────────────────────┘
                         │
          ┌──────────────┼──────────────────┐
          │              │                  │
    ┌─────▼─────┐  ┌────▼──────┐  ┌───────▼────┐
    │ Cloudflare │  │    AWS    │  │ Kubernetes  │  ... (pluggable)
    │  Adapter   │  │  Adapter  │  │   Adapter   │
    └────────────┘  └───────────┘  └────────────┘
```

## Components

### `mcp-layer/` — Cloudflare Worker (Control Plane)

The edge Worker implementing:
- **`/mcp`** — MCP protocol endpoint (tools/list, tools/call)
- **`/turn/*`** — Turn execution for multi-step workflows
- **`/audit/*`** — Immutable audit event stream
- **`/healthz`** — Health check
- **`/api/change-request`** — Change request intake and approval
- **`/api/ledger`** — Immutable ledger query
- **`/api/assets|events|incidents`** — Resource management
- **`/api/checks/run`** — Watcher job dispatch

### `platform/` — Enterprise Orchestration Platform

Provider-agnostic TypeScript platform for multi-cloud security:
- **Provider Adapters** — Cloudflare, AWS, Kubernetes (pluggable)
- **Universal Ledger** — SHA-256 signed, immutable change tracking
- **Cross-Provider Orchestrator** — Apply policies across all providers
- **Drift Scanner** — Detect unauthorized configuration changes
- **Compliance Checker** — Validate security posture (SOC2/PCI/HIPAA)
- **Health Aggregator** — Multi-provider health monitoring
- **CLI Tool** — `mcp-cli` for all operations

### `cloudflare/` — Hardening Automation

Orchestrated security scripts:
- `00-preflight.sh` — Verify auth before mutations
- `10-inventory-cf.sh` — Snapshot current state
- `20-health-check.sh` — Health probe all MCP hosts
- `30-apply-waf.sh` — Apply WAF rules with error trapping + idempotency
- `40-apply-ratelimit.sh` — Apply rate limits with fingerprint tracking
- `50-apply-cache.sh` — Apply cache policies
- `60-bot-posture.sh` — Bot exemption management
- `70-post-verify.sh` — Post-apply inventory diff
- `80-generate-baseline-sheet.sh` — Human-readable security sheet
- `90-generate-runbooks.sh` — Generate rotation + summary docs
- `99-run-cloudflare-hardening.sh` — Orchestrator (with backup + rotation check)
- `bootstrap-ledger.sh` — First-run baseline capture
- `sentinel-scan.sh` — Recurring drift detection

### `manifests/` — GitOps Configuration

- `policies/` — Unified security policy definitions
- `zones/` — Per-zone DNS/routing/SSL config
- `tenants/` — Per-tenant capabilities and rate limits

### `docs/runbooks/` — Operational Documentation

- Domain state, secrets required, automation execution, cutover procedures

## Quick Start

### Deploy the Worker

```bash
cd mcp-layer
npm install
npx wrangler deploy
```

### Run Hardening

```bash
export CF_API_TOKEN="your-token"
export CF_ZONE_ID="your-zone-id"
cd projects/mj-mcp-layer
bash cloudflare/99-run-cloudflare-hardening.sh
```

### Use the CLI

```bash
cd platform
npm install
npx tsx src/cli/index.ts init
npx tsx src/cli/index.ts health-check --all-providers
npx tsx src/cli/index.ts drift-scan --provider cloudflare
npx tsx src/cli/index.ts compliance-check --format json
npx tsx src/cli/index.ts policy-apply --file manifests/unified-security-v1.yaml --dry-run
```

### Validate Endpoints

```bash
# Health check
curl https://your-worker.workers.dev/healthz

# MCP capabilities (requires auth headers)
curl -H "x-tenant-id: kevis" \
     -H "x-request-id: $(uuidgen)" \
     -H "x-policy-version: v2" \
     -H "x-operator-capability: mcp.admin" \
     -H "x-ellis-aegis-token: YOUR_TOKEN" \
     https://your-worker.workers.dev/mcp

# Audit events
curl -H "x-tenant-id: kevis" \
     -H "x-request-id: $(uuidgen)" \
     -H "x-policy-version: v2" \
     -H "x-operator-capability: forensic.read" \
     -H "x-ellis-aegis-token: YOUR_TOKEN" \
     "https://your-worker.workers.dev/audit/events?since=2026-05-01&limit=50"
```

## CI/CD

### Automated Workflows

- **`mj-layer-deploy.yml`** — Triggered on push to MJ_Layer; runs hardening + sentinel scan per zone
- **`mj-layer-scan.yml`** — Scheduled every 6 hours; drift detection across all zones

### Required GitHub Secrets

| Secret | Description |
|--------|-------------|
| `CF_API_TOKEN` | Cloudflare API token with zone edit permissions |
| `CF_ZONE_ID_ELLIS` | Zone ID for primary authority zone |
| `CF_ZONE_ID_HITCH` | Zone ID for hitch.guru |
| `CF_ZONE_ID_KEVIS` | Zone ID for kevis.online |
| `CF_ACCOUNT_ID` | Cloudflare account ID (for audit log access) |

## Security Model

- **Deny-by-default** — All requests without required headers are blocked
- **Immutable audit trail** — SHA-256 signed JSONL ledger
- **Multi-tenant governance** — Per-tenant capabilities and rate limits
- **Fail-closed** — Misconfiguration results in deny, not allow
- **Idempotent operations** — Fingerprint-based skip logic prevents duplicates
- **Error trapping** — Every API call is verified; failures are logged and reported
- **KV backup** — State snapshot before mutations enables rollback
- **Rotation enforcement** — Automated check for overdue secret rotations
