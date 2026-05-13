# Cloudflare Lane — MJ MCP Connection Handoff

**Lane:** `mj-cloudflare`  
**Platform:** Cloudflare (Workers, D1, KV, R2, AI Gateway, Access, WAF)  
**MCP Endpoint:** `https://mcp.ellis-aegis.us/mcp`  
**Capabilities:** `cloud.ops`, `security.status`, `forensic.read`  
**Auth Mode:** Cloudflare API token (scoped)  
**Owner:** Sentinel (internal — not a third-party lane)  

---

## Overview

The Cloudflare lane is the **security membrane lane** for the entire MJ platform. It is operated by Sentinel, not handed to external third parties. This document describes what the Cloudflare lane does and what credentials are needed to operate it.

---

## What the Cloudflare Lane Does

- Enforces WAF rules, rate limits, cache policies, and bot management posture across all three zones
- Runs idempotent drift scans every 6 hours against `ellis-aegis.us`, `hitch.guru`, and `kevis.online`
- Maintains the pre-mutation inventory backup before any Cloudflare change
- Enforces secret rotation policy
- Writes every hardening action to the MJ audit ledger
- Manages the `mj-edge` Worker deployment and route bindings

---

## Required Secrets for Cloudflare Hardening

These must be set as GitHub Actions secrets in the Connections repository:

| Secret | Scope | Description |
|--------|-------|-------------|
| `CF_API_TOKEN` | Account + Zone Edit | Cloudflare API token with full hardening scopes |
| `CF_ACCOUNT_ID` | Account | `5b94eedaff8fb3ccaa1b607f57963e10` |
| `CF_ZONE_ID_ELLIS` | Zone | Zone ID for `ellis-aegis.us` |
| `CF_ZONE_ID_HITCH` | Zone | Zone ID for `hitch.guru` |
| `CF_ZONE_ID_KEVIS` | Zone | Zone ID for `kevis.online` |
| `OPERATOR_TOKEN` | Worker | Runtime operator token for smoke tests |

### CF_API_TOKEN Required Permissions

The token must include:

**Account-level:**
- Workers Scripts Edit
- D1 Edit
- R2 Edit
- KV Storage Edit
- Queues Edit
- Vectorize Edit
- Account Settings Read (for audit log access)

**Zone-level (for each zone):**
- Zone Read
- DNS Read + Edit
- Workers Routes Read + Edit
- Rulesets Read + Edit (WAF, rate limit, cache, bot posture)
- Zone Settings Read + Edit (SSL, security level)

---

## Hardening Run (Manual)

```/dev/null/harden.sh#L1-15
# From Stratos host
export CF_API_TOKEN="your-cloudflare-token"
export CF_ZONE_ID="zone-id-for-ellis-aegis"
export CF_ACCOUNT_ID="5b94eedaff8fb3ccaa1b607f57963e10"

cd /Volumes/Stratos_Tools/projects/Connections/projects/mj-mcp-layer

# Full hardening run
bash cloudflare/99-run-cloudflare-hardening.sh

# Drift scan only (read-only, safe to run any time)
bash cloudflare/sentinel-scan.sh
```

---

## Hardening Script Sequence

| Script | Purpose |
|--------|---------|
| `00-preflight.sh` | Verify auth before any mutations |
| `10-inventory-cf.sh` | Snapshot current Cloudflare state |
| `20-health-check.sh` | Health probe all MCP hosts |
| `30-apply-waf.sh` | Apply WAF rules (idempotent, fingerprinted) |
| `40-apply-ratelimit.sh` | Apply rate limits |
| `50-apply-cache.sh` | Apply cache bypass rules for dynamic endpoints |
| `60-bot-posture.sh` | Configure bot exemption for MCP fleet |
| `70-post-verify.sh` | Diff post-apply inventory against pre |
| `80-generate-baseline-sheet.sh` | Human-readable security posture sheet |
| `90-generate-runbooks.sh` | Generate rotation and summary docs |
| `99-run-cloudflare-hardening.sh` | Orchestrates all of the above |

---

## Drift Scan Schedule

The `mj-layer-scan.yml` GitHub Actions workflow runs the sentinel scan every 6 hours across all three zones. Drift is reported as a GitHub issue if detected.

---

## Approved Lane Actions

| Action | Description |
|--------|-------------|
| `worker.read` | Read Worker script metadata |
| `worker.deploy_preview` | Deploy a preview Worker |
| `r2.object.read_metadata` | Read R2 object metadata |
| `d1.query_read` | Read-only D1 query |
| `kv.read` | Read KV values |
| `queue.enqueue` | Enqueue a watcher job |
| `audit.record` | Write an audit event |
| `security.check` | Run a security posture check |

### Approval Required (even for Sentinel)

- `worker.deploy_production`
- `dns.update`
- `r2.object.delete_bulk`
- `d1.schema_migrate_remote`
- `access.policy_update`
