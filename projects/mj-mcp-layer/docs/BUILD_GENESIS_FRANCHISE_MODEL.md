# Build Genesis OS Franchise Model

## Core metaphor

Build Genesis OS follows the operating model of an elite professional sports franchise. A great franchise does not win because one role does everything. It wins because authority, strategy, orchestration, specialists, execution, review, and memory all have clear lanes.

The franchise model gives the platform its hierarchy:

```text
Domain authority
  -> Operating system direction
  -> MJ orchestration layer
  -> Team lanes and specialists
  -> Execution tools and connectors
  -> Evidence, review, and memory
```

## Role mapping

| Franchise role | Build Genesis OS role | Responsibility |
|---|---|---|
| Owner / franchise authority | Domain authority | ultimate control, ownership, identity, root trust |
| Front office / governor | Build Genesis OS policy layer | long-term direction, standards, approvals, constraints |
| Head coach | OS orchestration direction | strategy, playbook, coordination model |
| Star orchestrator | MJ Layer | reads the floor, opens lanes, closes doors, routes work, executes when needed |
| Assistant coaches | Agent court / runtime verifier / policy engines | review, risk assessment, correction, discipline |
| Players / position groups | Lanes, adapters, third-party connectors | specialized execution under role-specific rules |
| Playbook | Policy manifests and shell contracts | approved moves and execution patterns |
| Game tape | Ledger and evidence bundles | record of what happened and why |
| Referees / review booth | Runtime verification and CI/CD gates | enforce rules and validate outcomes |
| Stadium / field | Cloud infrastructure and execution environments | where plays happen |

## Domain authority

The domain is the ultimate authority. In the franchise metaphor, this is ownership-level control. It defines what belongs to the organization and what root trust everything else inherits.

The domain layer answers:

```text
Who owns the system?
What identity anchors the system?
What zones, brands, tenants, and roots are authoritative?
What must never be bypassed?
```

This layer should remain boring, protected, and hard to mutate.

## Build Genesis OS

Build Genesis OS is the platform-level operating system. It defines the franchise playbook, direction, and standards. It decides how the organization operates, how agents behave, how policies are structured, and how platform memory is preserved.

It answers:

```text
What is the system trying to do?
What rules govern execution?
What lanes exist?
What approvals are required?
What evidence must be produced?
```

## MJ Layer

MJ Layer is the orchestration layer. It is named after Michael Jordan because it balances offense and defense. It can close doors, open lanes, pass to specialists, score when needed, and elevate the system without pretending to be every player on the court.

MJ Layer owns:

```text
intent routing
policy-aware orchestration
cloud shell play-calling
connector coordination
provider adapter dispatch
capability checks
mutation budgets
ledger/evidence handoff
runtime verification handoff
```

MJ is not only a defender. MJ is not only a scorer. MJ is the orchestrator that knows when each mode is needed.

## Cloud shell as play-calling language

The cloud shell is MJ's orchestration language. It lets MJ speak the languages of the tools and teams:

```text
GitHub CLI
Cloudflare Wrangler
Terraform
kubectl
OpenAI tooling
provider CLIs
connector APIs
local scripts
CI/CD commands
```

A raw shell would be dangerous. An MJ cloud shell is governed. Every command is a play call with policy, evidence, approvals, budgets, and receipts.

## Lanes and specialists

Third parties, connectors, providers, and tools are the team. Each has a role. No lane is allowed to become the entire franchise.

Examples:

```text
GitHub lane: code, PRs, issues, releases
Cloudflare lane: edge, WAF, DNS, Workers, D1
OpenAI lane: model/API/tooling workflows
Google lane: Workspace/Firebase/Vertex paths
Vercel/Railway lane: app hosting and previews
Terraform/Kubernetes lane: infrastructure substrate
```

Lanes execute scoped work. MJ routes and governs. Policy can veto. Ledger records.

## Offense and defense

Build Genesis OS must support both sides.

### Defense

```text
block unsafe actions
enforce zero-trust defaults
detect drift
verify runtime behavior
protect secrets
close exposed paths
validate approvals
require rollback plans
```

### Offense

```text
deploy applications
create previews
run migrations
connect providers
open new lanes
translate policy
execute approved shell workflows
scale infrastructure
```

A mature platform does both without confusing the responsibilities.

## Football variant

The same model maps to a football franchise:

```text
Owner / Robert Kraft = domain authority
Head coach / Bill Belichick = OS strategy and discipline
Quarterback / Tom Brady = orchestration at execution time
Coordinators = policy engines and agent court
Position groups = lanes and adapters
Playbook = policies, contracts, shell recipes
Film room = ledger, evidence, runtime analysis
```

This reinforces the same idea: the quarterback does not own the franchise, but the quarterback orchestrates execution under strategy, rules, and field conditions.

## Product implication

The product is not merely an AI app, a cloud shell, an MCP server, or CI/CD automation. It is a franchise operating system for governed AI execution.

The platform should let an operator say:

```text
Run the next safe play, use the right team, prove what happened, and recover if it fails.
```

And the system should produce:

```text
intent plan
lane routing
cloud shell plan
provider diffs
approval requirements
execution receipts
evidence bundle
ledger entries
runtime verification
rollback path
```

## Design rule

When adding features, ask:

```text
Which franchise role owns this?
Is this authority, strategy, orchestration, lane execution, evidence, or review?
Does it open a lane, close a door, or record the play?
```

If the answer is unclear, the module boundary is unclear.
