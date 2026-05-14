# MJ Layer Module Boundaries

This document defines the boundaries required for MJ Layer to remain understandable as it grows from Cloudflare/MCP automation into a provider-agnostic governed execution platform.

## Boundary principles

1. Control planes authorize. Execution planes execute.
2. Provider adapters mutate providers. Governance modules decide whether mutation is allowed.
3. Ledger and evidence modules record proof. They do not approve or execute.
4. The cloud shell is a governed lane, not an unrestricted terminal.
5. Tests must enforce these boundaries as contracts.

## Current top-level areas

```text
projects/mj-mcp-layer/
  mcp-layer/       # Cloudflare Worker control plane
  platform/        # provider-agnostic orchestration engine
  cloudflare/      # Cloudflare shell automation and drift scripts
  manifests/       # policies, tenants, zones, budgets, compliance
  docs/            # specs, architecture, runbooks

projects/mj-mcp/
  core/            # lane routing and policy concepts
  lanes/           # mini-MJ lane manifests
  schemas/         # lane/action/audit schemas
  policies/        # connection/data/approval boundaries
```

## Allowed dependency direction

```text
Worker -> platform core/policy/evidence/ledger
CLI -> platform core/adapters/governance/cloud-shell
Runner -> cloud-shell contract + governance + ledger/evidence
Adapters -> provider APIs + ledger record payloads
Governance -> policy decisions only
Ledger/Evidence -> proof only
```

## Explicitly denied dependency direction

```text
Worker must not execute arbitrary shell commands.
Worker must not bypass policy and call provider mutations directly.
Runner must not approve its own commands.
Adapters must not mint capability visas.
Adapters must not spend mutation budgets without governance approval.
Ledger must not modify provider resources.
Evidence engine must not hide failed checks.
Cloud shell must not read secrets or print raw secret-like output.
```

## Module responsibilities

| Module | Owns | Must not own |
|---|---|---|
| Worker | HTTP/MCP routes, auth, request normalization | raw shell execution, direct provider mutation without orchestration |
| Platform core | orchestration, policy compile, rollback, runtime verification | provider-specific credential storage |
| Adapters | provider API translation and mutation | governance decisions |
| Governance | agent court, capability visas, mutation budgets, reputation | provider API calls |
| Ledger | signed event storage and drift baseline | approval decisions |
| Evidence | evidence bundle generation and attestation | hiding failed checks |
| Cloud shell | session policy, command classification, redaction, transcript model | arbitrary production execution |
| Cloudflare scripts | operational hardening and drift scanning | cross-provider abstractions |
| MJ mesh lanes | platform-specific permissions and action manifests | sideways lane calls |

## Golden path

Every mature change should support this path:

```text
intent
  -> policy compile
  -> plan/diff
  -> governance decision
  -> rollback simulation
  -> evidence preview
  -> approved apply
  -> runtime verification
  -> signed ledger/evidence bundle
  -> drift scan
```

## Required check command

The workspace exposes a single golden path command:

```bash
npm --prefix projects/mj-mcp-layer run mj:golden
```

This should remain the minimum local proof that the branch is internally coherent.

## Future package split

When the platform grows beyond the current branch, split toward:

```text
apps/worker
apps/cli
apps/runner
packages/core
packages/policy
packages/ledger
packages/evidence
packages/adapters
packages/governance
packages/cloud-shell
```

Do not do this split until the current golden path is stable; otherwise the repo will churn before the platform hardens.
