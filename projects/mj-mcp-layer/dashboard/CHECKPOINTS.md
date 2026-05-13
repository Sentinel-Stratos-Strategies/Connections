# MJ Edge — numbered checkpoints

Use this list when running `checkpoint.sh` or opening a PR: mention **`CP-<n>`** in the commit message when a step completes.

| CP | Name | Goal | Status |
|----|------|------|--------|
| **1** | **Static snapshot** | Canonical `mj-edge-v2.html` + README under `dashboard/`; local preview works. | Done |
| **2** | **Worker surface** | `GET /dashboard` via Wrangler `assets` + `ASSETS` binding; `sync-public.sh`; tests for 503 vs delegate; `checkpoint*.sh` automation. | Done |
| **3** | **Supply chain hardening** | Pin or self-host Lucide + fonts; Subresource Integrity or CSP that matches real script/style URLs; document allowed third-party origins. | Done |
| **4** | **Read-only live probe** | Dashboard loads public Worker facts (e.g. `GET /healthz`) with `fetch`, no operator token; display pass/fail only; graceful offline copy. | Next |
| **5** | **Copy / trust audit** | Remove or qualify demo labels (billing, MRR, “Stripe live”) until backend exists; align UI with “prototype / roadmap” truth. | Planned |
| **6** | **Operator data rail** | Small authenticated JSON route(s) for cockpit metrics (reuse policy headers + operator token); dashboard consumes read-only summaries, never raw secrets. | Planned |
| **7** | **Tenant isolation stub** | Single `tenant` query param or path prefix for customer view; server rejects cross-tenant bodies; matches handoff tenant-scoped rules. | Planned |
| **8** | **CI gate** | Workflow step: `sync-public.sh`, `npm test`, `wrangler deploy --dry-run` on PRs touching `dashboard/` or `mcp-layer/public/`. | Planned |
| **9** | **Deploy smoke** | Post-deploy check: `curl -f …/dashboard` returns `200` and `text/html`; optional artifact screenshot / hash of `index.html`. | Planned |
| **10** | **Productization handoff** | Hand off billing, tenant registry, custom hostnames to `product/mj-layer-platformization` (or equivalent); dashboard tracks only shipped backend capabilities. | Planned |

## Convention

- **Done** — merged or accepted on the review branch you care about.
- **Next** — default priority after CP-3.
- **Planned** — ordered backlog; re-sequence with Sentinel if product priorities shift.

Reference: MJ MCP 10/10 handoff (`dashboard` routes, evidence, tenant isolation) and enterprise MJ Layer non-goals for PR scope.
