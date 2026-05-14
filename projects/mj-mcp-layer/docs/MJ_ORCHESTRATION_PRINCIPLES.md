# MJ Orchestration Principles

## Origin

MJ Layer is named after Michael Jordan as the perfect orchestrator: offense and defense in balance, able to close doors, open lanes, score when needed, and elevate the whole system without having to personally dominate every role.

This matters architecturally. MJ Layer is not only a security agent. It is not only a worker agent. It is the orchestrator that decides when to defend, when to create a lane, when to pass work to a specialist, and when to execute directly.

## Product definition

MJ Layer is an equally balanced security and worker orchestration layer for:

- MCP control-plane routing
- cloud shell command orchestration
- provider and connector actions
- third-party platform lanes
- CI/CD execution
- policy enforcement
- evidence and ledger proof
- runtime verification

## The cloud shell is the orchestration language

The MJ cloud shell is the ultimate orchestration language for the platform. It speaks the languages of the tools MJ coordinates:

```text
GitHub CLI
Cloudflare Wrangler
Terraform
Kubernetes kubectl
OpenAI tooling
provider CLIs
connector APIs
local/project scripts
CI/CD commands
```

The shell is not a random terminal. It is the language MJ uses to call plays across connectors and clouds, piece by piece, under policy.

## Offense and defense

MJ must support both sides of the platform:

### Defense

- deny unsafe requests
- enforce capability boundaries
- block secret reads
- detect drift
- validate runtime behavior
- protect tenant lanes
- require approval for high-risk moves
- generate rollback proof

### Offense

- deploy Workers
- run migrations
- create preview environments
- connect third-party lanes
- translate policy across providers
- execute approved CLI workflows
- generate evidence bundles
- open and close operational lanes

The platform is incomplete if it can only defend. It is also incomplete if it can only execute. MJ must do both.

## Lane orchestration

MJ opens and closes lanes:

```text
Intent
  -> policy read
  -> risk decision
  -> lane selection
  -> connector/provider action
  -> cloud shell command if needed
  -> evidence
  -> ledger
  -> runtime verification
```

No lane should become a skeleton key. GitHub, Cloudflare, OpenAI, Google, Vercel, Railway, Terraform, Kubernetes, and future lanes remain scoped. MJ routes, governs, and verifies.

## Shell command philosophy

Every command should be understood as an orchestration move.

| Command type | Meaning |
|---|---|
| read-only command | court vision: inspect the floor |
| diagnostic command | defensive check: find weak spots |
| dry-run/plan command | play design: predict movement |
| deploy command | offensive execution: open the lane |
| hardening command | defensive execution: close the door |
| rollback command | recovery: reset possession |
| drift scan | surveillance: watch the court |

## Non-negotiables

1. MJ can orchestrate many tools, but no tool bypasses MJ.
2. Cloud shell commands must be policy-aware.
3. CLI tools are capabilities, not free-for-all access.
4. Security and execution must be balanced.
5. Every meaningful action must produce evidence.
6. Every privileged action must have a capability, budget, approval, or breakglass reason.
7. The cloud shell must unify connector languages without becoming an unsafe superuser.

## Architectural implication

The correct architecture is:

```text
MJ Core = play caller
Cloud Shell = orchestration language
Lanes = specialists
Provider adapters = translators
Policy = rules of play
Capability visas = temporary permission to move
Mutation budgets = possession control
Ledger = game tape
Evidence bundles = official box score
Runtime verifier = referee
Agent court = review booth
```

## Definition of maturity

MJ Layer reaches maturity when an operator can say:

```text
Deploy the next safe version, prove it, watch it, and recover if it goes wrong.
```

And MJ can turn that into:

```text
policy plan
cloud shell plan
provider diffs
approval requirements
execution commands
runtime checks
evidence bundle
ledger receipts
rollback path
```

That is the real product spine.
