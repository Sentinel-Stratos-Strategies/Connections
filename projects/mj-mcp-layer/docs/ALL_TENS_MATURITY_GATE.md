# MJ Layer All-Tens Maturity Gate

## Purpose

This document defines what it takes for MJ Layer to honestly claim 10/10 maturity across CI/CD, code organization, tests, provider abstraction, and Cloudflare implementation.

A 10 is not a feeling. A 10 means the platform has repeatable proof.

## Current maturity push

The enterprise branch now includes:

- Cloud shell catch-up spec
- Cloud shell contract engine
- Cloud shell contract tests
- MJ orchestration principles
- Build Genesis franchise model
- Build Genesis multi-repo body map
- Module boundary doctrine
- Workspace golden path command
- CI golden path integration
- Provider contract v2 capability model
- Provider contract v2 tests

## Scoring gates

| Area | 10/10 gate | Branch status |
|---|---|---|
| CI/CD maturity | One golden path runs typecheck, tests, build, shell syntax, dry-run, and hardening failure checks | Implemented for workspace and workflow; requires CI run |
| Code organization | Boundaries are documented and enforced by tests/contracts | Documented; enforcement started via contract tests |
| Tests | Worker, platform, cloud shell, provider v2, visa/budget/ledger tests cover safety behavior | Cloud shell and provider v2 added; existing Worker/provider tests present; ledger/visa/budget expansion still recommended |
| Provider abstraction | Providers declare capabilities and separate plan/diff/apply/verify/rollback | Provider contract v2 added and tested; Cloudflare apply v2 still facade-only |
| Cloudflare implementation | Cloudflare has typed plans, budget categories, approval gates, live mutation support declared | Contract layer added; existing adapter remains v1 mutation engine |

## What is complete now

### CI/CD

- `npm --prefix projects/mj-mcp-layer run mj:golden` added.
- Deploy workflow now runs the golden path.
- Deploy workflow now triggers on the enterprise branch and PRs.
- Hardening job now fails if `artifacts/stage-failures.log` exists.

### Code organization

- `MODULE_BOUNDARIES.md` defines allowed and denied dependency directions.
- `BUILD_GENESIS_BODY_MAP.md` defines the multi-repo organism:
  - Cloudflare authority
  - GENESIS_OS
  - Genesis Method
  - Memory Contract
  - Voice Contract
  - MJ Layer / Connections
- `BUILD_GENESIS_FRANCHISE_MODEL.md` defines the franchise hierarchy.
- `MJ_ORCHESTRATION_PRINCIPLES.md` defines MJ as balanced offense-defense orchestrator.

### Tests

- Cloud shell contract tests added.
- Provider contract v2 tests added.
- Existing Worker policy tests remain part of the golden path.
- Existing provider preview tests remain part of the golden path.

### Provider abstraction

- `ProviderCapabilities` added.
- `ProviderContractV2` added.
- `ProviderV2Facade` added.
- Cloudflare declares live mutation capability.
- Preview providers declare dry-run/non-live capability.

### Cloud shell

- Cloud shell is now a first-class governed lane.
- Shell sessions, command classification, approval requirements, budget categories, denial decisions, redaction, and transcript manifests are modeled in code.
- No arbitrary command execution has been added yet, intentionally.

## What still requires validation

These items require either CI execution, live Cloudflare canary access, or a follow-up implementation pass:

1. Run GitHub Actions on PR #5 and confirm `mj:golden` passes.
2. Run Cloudflare hardening in a canary or staging zone.
3. Expand ledger tamper tests.
4. Expand capability visa tamper tests.
5. Add mutation budget atomic reserve tests.
6. Wire provider contract v2 apply/verify/rollback into the Cloudflare adapter with receipts.
7. Add structured Cloudflare drift diffs beyond full-inventory hash comparison.
8. Add shell Stage B only after Stage A passes: local sandbox executor with allowlist, timeout, and redaction.

## Definition of done for true all-tens

MJ Layer reaches true all-tens when this command passes locally and in CI:

```bash
npm --prefix projects/mj-mcp-layer run mj:golden
```

And a canary Cloudflare workflow proves:

```text
plan
approval
apply
verify
scan
rollback
verify clean state
evidence bundle
ledger receipt
```

## Rule

Do not mark PR #5 ready for review until the golden path passes and the remaining typecheck blockers, if any, are resolved.

Imagination got the branch here. Proof gets it merged.
