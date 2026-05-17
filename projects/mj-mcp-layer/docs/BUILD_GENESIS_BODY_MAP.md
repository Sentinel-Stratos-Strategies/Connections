# Build Genesis Multi-Repo Body Map

## Purpose

Build Genesis is not one repository. It is a multi-repo organism. Each repo is a body part with a specific role in the franchise operating model.

This map prevents MJ Layer from absorbing responsibilities that belong to domain authority, Genesis OS, Genesis Method, Memory, Voice, or specialist product repos.

## Current body parts

| Body part | Repository | Franchise role | Primary responsibility |
|---|---|---|---|
| Domain authority | `Sentinel-Stratos-Strategies/Cloudflare-ellis-aegis` | owner / root authority | domains, zones, DNS authority, edge trust, Cloudflare root posture |
| Operating system | `Sentinel-Stratos-Strategies/GENESIS_OS` | head coach / system strategy | OS-level direction, system identity, platform standards, top-level coordination |
| Method / doctrine | `Sentinel-Stratos-Strategies/the-genesis-method` | playbook / training method | methodology, protocols, repeatable build process, doctrine |
| MJ orchestration layer | `Sentinel-Stratos-Strategies/Connections` | star orchestrator / quarterback | MCP routing, connector lanes, cloud shell orchestration, provider adapters, CI/CD control plane |
| Memory layer | `Sentinel-Stratos-Strategies/Memory-Contract` | institutional memory / film room | memory rules, projections, durable context, truth boundaries, recall contracts |
| Voice layer | `Sentinel-Stratos-Strategies/Voice-Contract` | communication identity / public voice | voice, tone, interface behavior, communication contracts, interaction style |
| Product/project repos | `Hitch`, `hitch2`, `Kevis-keyring-007`, etc. | team/project lanes | product-specific apps, tenants, or specialized execution surfaces |

## Authority chain

```text
Cloudflare/domain authority
  -> Genesis OS
    -> Genesis Method
      -> Memory Contract + Voice Contract
        -> MJ Layer / Connections
          -> lanes, providers, connectors, CLIs
            -> project/product repos
```

This is not a rigid ownership hierarchy for every action. It is a trust and responsibility map.

## What each repo should own

### Cloudflare-ellis-aegis

Owns root edge authority:

```text
domain records
zone posture
DNS truth
Cloudflare account-level posture
edge security controls
root domain runbooks
```

Should not own:

```text
agent court logic
provider-agnostic orchestration
Genesis methodology
product UI logic
```

### GENESIS_OS

Owns the operating system identity and top-level direction:

```text
system ontology
OS contracts
platform-level standards
franchise model
cross-repo governance
root build philosophy
```

Should not own:

```text
Cloudflare DNS mutations
raw connector execution
project-specific app code
```

### the-genesis-method

Owns the doctrine and repeatable method:

```text
build rituals
decision frameworks
prompting/build protocols
review standards
quality bars
teaching/training material
```

Should not own:

```text
runtime execution state
provider credentials
production deployment controls
```

### Memory-Contract

Owns the memory layer of Genesis OS:

```text
what can be remembered
what must be forgotten
projection-only memory rules
truth boundaries
recall contracts
context handoff rules
memory audit expectations
```

Memory is not just storage. It is the system's film room: what the franchise can study, replay, learn from, and carry forward without corrupting truth.

Should not own:

```text
live provider mutations
cloud shell execution
CI/CD deployment authority
voice/tone rules
```

### Voice-Contract

Owns the voice layer of Genesis OS:

```text
communication identity
operator interaction style
assistant/persona boundaries
public-facing language constraints
voice consistency
interface phrasing contracts
```

Voice is not decoration. It is how the system speaks with continuity across apps, agents, docs, and operators.

Should not own:

```text
memory truth
provider mutations
ledger signing
cloud shell execution
```

### Connections / MJ Layer

Owns orchestration and routing:

```text
MCP control plane
cloud shell orchestration language
connector lanes
provider adapters
capability visas
mutation budgets
runtime verification
ledger/evidence handoff
CI/CD play calling
```

Should not own:

```text
root domain authority
OS-level identity doctrine
methodology canon
memory truth contracts
voice identity contracts
project-specific product business logic
```

## Why Cloudflare repo is domain authority

The Cloudflare repo is the domain authority because the domain is root trust. It owns the field where plays happen: zones, DNS, edge policy, routing posture, and the first security perimeter.

MJ Layer can request or orchestrate Cloudflare changes, but it should not become the source of domain truth. MJ calls plays. Domain authority owns the stadium.

## Why MJ Layer still needs Cloudflare integration

MJ needs Cloudflare because orchestration must reach the edge. But it should interact through:

```text
approved provider adapter
capability visa
mutation budget
change request
evidence bundle
ledger receipt
```

The rule is:

```text
MJ may orchestrate domain moves.
Cloudflare authority owns domain truth.
```

## Memory and voice as OS organs

Memory and Voice are not utilities. They are core organs of Genesis OS.

```text
Memory = what the system can carry forward
Voice = how the system expresses itself
Method = how the system builds
OS = how the system coordinates
MJ = how the system acts
Cloudflare authority = where the system anchors trust
```

MJ should consume Memory and Voice contracts. It should not redefine them.

## Cross-repo event model

Important actions should emit an event that can be understood across repos:

```json
{
  "event_type": "domain.policy.change_requested",
  "source_repo": "Connections",
  "authority_repo": "Cloudflare-ellis-aegis",
  "actor": "operator",
  "tenant": "ellis",
  "risk": "medium",
  "memory_policy_ref": "Memory-Contract:...",
  "voice_policy_ref": "Voice-Contract:...",
  "evidence_ref": "...",
  "ledger_ref": "..."
}
```

## Cross-repo CI/CD maturity target

Each repo should have a local golden path, and MJ should eventually orchestrate a franchise-level golden path.

```text
Cloudflare repo golden path: validate domain authority and edge posture
GENESIS_OS golden path: validate OS contracts and ontology
Genesis Method golden path: validate method docs/schemas/protocols
Memory Contract golden path: validate recall/projection/truth-boundary rules
Voice Contract golden path: validate voice/interface contracts
Connections/MJ golden path: validate orchestration, shell, adapters, evidence
Franchise golden path: prove all body parts agree on authority and execution boundaries
```

## Design rule

Before adding a feature, ask:

```text
Is this authority, OS direction, method doctrine, memory, voice, orchestration, or product execution?
```

Then place it in the correct repo.

If it spans repos, create a contract, event, receipt, or reference. Do not copy the organ into the wrong body part.

## Immediate implications for MJ Layer

1. Keep cloud shell and orchestration inside `Connections`.
2. Keep domain truth in `Cloudflare-ellis-aegis`.
3. Keep OS ontology and franchise-wide strategy in `GENESIS_OS`.
4. Keep build doctrine in `the-genesis-method`.
5. Keep memory rules in `Memory-Contract`.
6. Keep voice rules in `Voice-Contract`.
7. Use contracts/events/receipts to cross repo boundaries.
8. Do not let MJ become the entire body.

MJ is the orchestrator, not the whole organism.
