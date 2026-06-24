# Connections

> **Enterprise MCP Edge Routing, Multi-Tenant Policy Enforcement, and AI Connector Platform — built on Cloudflare Workers.**

A production-grade platform that enforces deny-by-default security, capability-scoped routing, and immutable audit trails across agentic AI tool calls. Built for operators who need to know exactly what AI is doing, why it was allowed, and what happened when it wasn't.

---

## What This Is

This repository is the full source and documentation for three integrated systems:

1. **MJ MCP Layer** — An enterprise Cloudflare Worker implementing the Model Context Protocol with deny-by-default policy enforcement, per-route capability matrices, multi-tenant isolation, and a full audit ledger backed by D1, KV, R2, and Queues.
2. **MJ Mini-Lane Mesh** (`mj-mcp`) — A lightweight connector mesh that maps external platforms (Perplexity, GitHub, Cloudflare, OpenAI, Notion, Linear, and others) into scoped, auditable lanes with per-lane data boundary enforcement.
3. **macOS GUI → OpenAI Platform Bridge** — A CLI bridge that validates kit schemas, creates OpenAI Assistants, seeds threads, and runs agents via the Responses API with optional MCP server wiring.

---

## Architecture

```
External AI / Agent
        │
        ▼
  MJ Edge Worker          ← Cloudflare Worker (this repo)
  mcp.ellis-aegis.us      ← deny-by-default policy, capability headers, CORS
        │
        ▼
  genesisd (local)        ← tunnel-backed policy authority
        │
        ▼
  Lane Executor           ← per-platform connector (Perplexity, GitHub, CF, etc.)
        │
        ▼
  Audit Ledger (D1)       ← every event logged, no execution without approval
```

No action executes without passing policy. No policy decision is made in the cloud — the edge Worker is a relay, not an authority.

---

## Key Files

| File | What it does |
|---|---|
| [`projects/mj-mcp-layer/mcp-layer/src/index.ts`](projects/mj-mcp-layer/mcp-layer/src/index.ts) | Main Cloudflare Worker — MCP endpoints, policy enforcement, audit logging, change requests, ledger, memory, voice, drift alerts |
| [`projects/mj-mcp-layer/mcp-layer/src/console-lanes.ts`](projects/mj-mcp-layer/mcp-layer/src/console-lanes.ts) | Console lane registry and activation state |
| [`projects/mj-mcp-layer/mcp-layer/wrangler.jsonc`](projects/mj-mcp-layer/mcp-layer/wrangler.jsonc) | Cloudflare deploy config — D1, KV, R2, Queues, cron triggers |
| [`projects/mj-mcp-layer/cloudflare/`](projects/mj-mcp-layer/cloudflare/) | Hardening pipeline: WAF, rate limiting, cache, bot posture, runbooks (scripts `00`–`99`) |
| [`projects/mj-mcp/lanes/perplexity/lane.manifest.json`](projects/mj-mcp/lanes/perplexity/lane.manifest.json) | Perplexity connector lane — Sonar, sonar-pro, chat completions, search, data boundary enforcement |
| [`docs/superpowers/plans/2026-05-13-mj-layer-completion-handoff.md`](docs/superpowers/plans/2026-05-13-mj-layer-completion-handoff.md) | Enterprise handoff plan — go/no-go gates, security review checklist, productization roadmap |

---

## Security Model

Every inbound request passes through `enforceMcpPolicy()` before any handler is reached. Policy is applied at three layers:

- **Route allowlist** — only explicitly listed paths are reachable; everything else returns `403`
- **Required headers** — `x-tenant-id`, `x-request-id`, `x-policy-version`, `x-operator-capability` must all be present
- **Capability matrix** — each route × method combination has an explicit list of allowed operator capabilities; any mismatch is denied

Authentication uses timing-safe token comparison. All audit events are written to D1 via `ctx.waitUntil()` — non-blocking but guaranteed. Secrets are never printed in logs and are validated for presence before any protected operation.

---

## Connector Platform (Mini-Lane Mesh)

The `mj-mcp` project defines a set of mini-lanes — scoped, per-platform connectors that attach to the enterprise control plane without becoming a single over-privileged integration. Each lane has:

- A `lane.manifest.json` declaring auth mode, data boundaries, denied actions, and operator proxy routes
- Enforced `secret.read` denial and `truthWrite` scoping at validation time
- An explicit activation order (Codex → GitHub → Cloudflare first; write-capable lanes gated until smoke and audit are stable)

**Current lanes:** Perplexity, GitHub, Cloudflare, OpenAI, Google, Notion, Linear, Gadget, Vercel, Railway

---

## Cloudflare Stack

| Resource | Purpose |
|---|---|
| **Worker** (`mj-edge`) | MCP protocol, API routing, SPA serving |
| **D1** (`ellis-aegis-control-plane`) | Events, change requests, ledger, checks, assets, incidents |
| **KV** (`FLAGS`) | Feature flags, fast state |
| **R2** (`ellis-aegis-evidence`) | Evidence and audit artifact storage |
| **Queue** (`ellis-aegis-watchers`) | Watcher jobs: `edge-abuse`, `drift`, `origin-health`, `digest` |
| **Cron** | Every 2 hours + 6:15 AM daily sweep |

---

## Compliance and Boundaries

All work in this repository is:

- **Legal** — no unauthorized access, no policy bypass, no non-compliant automation
- **Auditable** — every action logged with actor, category, severity, source, and metadata
- **Approval-gated** — no deploy, merge, or secret rotation without explicit operator approval
- **Fail-closed** — missing secrets, failed policy checks, and unconfigured bindings all return deny responses, never silent success

---

## Project Structure

```
projects/
  mj-mcp-layer/          # Enterprise MCP edge Worker (Cloudflare)
    mcp-layer/src/       # Worker source (index.ts, console-lanes.ts, memory, voice, drift)
    cloudflare/          # Hardening scripts 00–99
    manifests/           # GitOps YAML (per-zone, per-tenant, per-policy)
    platform/            # Provider-agnostic SDK adapters (Cloudflare, AWS, Kubernetes)
    docs/                # Security reviews, runbooks, productization blueprint
  mj-mcp/               # Mini-lane connector mesh
    lanes/               # Per-platform lane manifests
    connections/         # Infrastructure connection map
    schemas/             # JSON Schema validation
  macos-gui-openai-bridge/  # CLI bridge: kit validation → OpenAI Assistants → MCP
docs/
  superpowers/plans/     # Handoff plans, go/no-go gates, task breakdowns
  openai-skillset-playbook.md
skills/
  openai-platform-builder/
```

---

## Status

The enterprise Worker is deployed and the hardening pipeline is validated. PR #5 (`cursor/mj-layer-enterprise-ready-1c9b → MJ_Layer`) is the current enterprise landing branch. Productization (Stripe, dynamic dispatch, customer portal, tenant provisioning) is a separate follow-on track and is not in the current PR.
