# MJ MCP Platform Mesh

MJ MCP is the main orchestration layer for platform operations. Each external tool or platform runs in its own lane: a scoped mini-MJ with isolated permissions, platform-specific actions, auditable memory projections, and explicit security gates.

## Core principle

MJ Core routes intent. Lanes execute scoped actions. Cloudflare security can veto. The ledger records every meaningful event. Memory stores projections by default, not unrestricted truth.

```text
Operator: Codex / ChatGPT / CLI / approved UI
        ↓
MJ Core MCP Router
        ↓
Policy + Permission Engine
        ↓
Lane Selector
        ↓
Specific MJ Lane Agent
        ↓
Official Platform API
        ↓
Audit + Projection Memory
```

## Why lanes exist

Each platform has different permissions, identity flows, data shapes, rate limits, security risk, and operational blast radius. Lanes prevent one integration from becoming a skeleton key.

Examples:

- MJ-Notion can read and update approved docs, but cannot deploy infrastructure.
- MJ-Linear can create and update issues, but cannot read Firebase data.
- MJ-Vercel can create preview deployments, but production deploys require approval.
- MJ-Google can use approved Workspace/Firebase/Vertex paths, but cannot touch OpenAI secrets.
- MJ-Cloudflare enforces policy, audit, memory boundaries, and security checks.

## Directory map

```text
projects/mj-mcp/
  core/
    router.md
    policy-engine.md
    lane-contract.md
  lanes/
    codex/lane.manifest.json
    openai/lane.manifest.json
    google/lane.manifest.json
    notion/lane.manifest.json
    linear/lane.manifest.json
    gadget/lane.manifest.json
    vercel/lane.manifest.json
    railway/lane.manifest.json
    github/lane.manifest.json
    cloudflare/lane.manifest.json
  connections/
    infrastructure-connections.json
  console/
    CONSOLE_CONNECTIONS.md
  schemas/
    lane.schema.json
    action.schema.json
    audit-event.schema.json
    memory-projection.schema.json
    infrastructure-connections.schema.json
  policies/
    platform-permissions.json
    data-boundaries.md
    approval-gates.md
```

## Operating model

1. The operator submits intent through Codex, ChatGPT, CLI, or an approved UI.
2. MJ Core normalizes the request into one or more lane actions.
3. The policy engine checks actor, lane, action, scope, risk, and approval requirements.
4. A lane executes only through official APIs or approved connectors.
5. Every action produces an audit event.
6. Memory stores projections, hashes, links, and metadata unless an internal-only truth write is explicitly allowed.

## Sacred boundary

```text
MJ Core can route.
Lanes can act.
Security can veto.
Memory can remember projections.
Truth cannot be overwritten by external lanes.
```

## Build status

This scaffold is intentionally separate from the enterprise runtime in `projects/mj-mcp-layer/`.
It defines mini-MJ lane contracts and the connection map that lets Codex, Cloudflare, GitHub,
OpenAI, Google, Notion, Linear, and future lanes attach to the enterprise control plane without
becoming a single over-privileged integration.

## Runtime connection

The deployed enterprise runtime now mirrors the console registry at:

```text
GET https://mcp.ellis-aegis.us/api/console/lanes
```

That route is protected by the same operator-token and policy-header gate as the rest of the MCP control plane. See `console/CONSOLE_CONNECTIONS.md` for the exact console connection pattern.
