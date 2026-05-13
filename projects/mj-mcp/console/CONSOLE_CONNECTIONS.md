# MJ MCP Console Connections

The main MJ MCP endpoint is the authority surface for the console:

```text
https://mcp.ellis-aegis.us/mcp
```

Use the Cloudflare plugin/app for Cloudflare operations because Cloudflare is the runtime substrate: Workers, D1, R2, KV, Queues, routes, WAF, DNS, and smoke checks. Do not make Cloudflare the whole product boundary. MJ remains the main connector control plane and Cloudflare is one provider lane.

## Required Remote MCP Headers

Every protected call uses:

```text
Authorization: Bearer <OPERATOR_TOKEN>
x-ellis-aegis-token: <OPERATOR_TOKEN>
x-tenant-id: operator
x-request-id: <generated per request>
x-policy-version: mj-edge-unified-v2
x-operator-capability: mcp.admin
```

Read-only console discovery can use:

```text
x-operator-capability: forensic.read
```

## Runtime Registry

The deployed Worker now exposes the console lane registry:

```text
GET /api/console/lanes
```

This route is protected by the same deny-by-default policy as `/mcp`, `/audit/*`, and `/api/ledger`. It returns the active authority map, lane statuses, required secrets, headers, connector names, connection mode, and activation notes.

## Activation Pattern

1. Keep GitHub Actions as the enterprise deploy and proof gate.
2. Keep Cloudflare Workers Builds as a secondary native Git deployment lane after its build command is corrected.
3. Store real secrets only in GitHub/Cloudflare/connector secret stores.
4. Connect console apps to MJ through lane manifests, the protected registry, and official app connectors.
5. Do not copy secret values into source, docs, lane manifests, or screenshots.

## Current Console Lane Families

```text
Codex
Browser / Chrome / Computer
Superpowers
GitHub
Cloudflare
OpenAI Developers
Figma
Google / Drive / Calendar
Notion
Linear
Gmail
CircleCI
Build iOS / macOS / Web
Network Solutions
Codex Security
Scite
Canva
Supabase
Documents / Presentations / Spreadsheets
Test Android
Vercel / Railway / Gadget
Zed / Cursor / Local Models
```

The mini-lane manifest source of truth lives in `projects/mj-mcp/lanes/**/lane.manifest.json`. The deployed runtime registry mirror lives in `projects/mj-mcp-layer/mcp-layer/src/console-lanes.ts`.
