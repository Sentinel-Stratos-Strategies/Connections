# Autonomous Delivery Nervous System — Build Plan

> Every infrastructure mutation becomes explainable, bounded, reversible, signed, and audited across providers.

MJ Layer is not CI/CD. It is the **court system for autonomous infrastructure**.

---

## Architecture Target

```
mj-core/
  policy-compiler          # Intent → plan → risk → diff → approval path
  evidence-engine          # Signed bundles per deploy
  ledger-engine            # HMAC-SHA256 immutable log (exists)
  risk-engine              # Blast radius, error budget, mutation budget
  runtime-verifier         # Live monitors generated from policy YAML
  mutation-budget-engine   # Per-actor spending limits
  agent-court              # Multi-role review: prosecutor, defender, judge, etc.

adapters/
  cloudflare               # (exists — real API)
  aws                      # (exists — stub)
  kubernetes               # (exists — stub)
  terraform                # (exists — stub)
  github                   # NEW — issues, PRs, comments, labels
  fastly                   # future
  vercel                   # future
  supabase                 # future

interfaces/
  cli                      # (exists — mcp-cli)
  worker-api               # (exists — Cloudflare Worker)
  github-actions           # (exists — workflows)
  webhook-intake           # NEW — receive approval events
  dashboard                # future

storage/
  file                     # (exists — FileLedgerBackend)
  d1                       # (exists — Worker D1)
  r2                       # future
  s3                       # future
```

---

## CLI Target Shape

```
mj intent submit request.json          # Submit intent for review
mj plan --provider cloudflare          # Generate provider-specific plan
mj prove --policy mj-edge-unified.yaml # Run mutation tests against policy
mj apply --receipt approved.json       # Execute approved change
mj scan --provider cloudflare          # Run drift scan
mj drift classify                      # Classify drift by severity
mj evidence export --control soc2      # Export compliance evidence
mj ledger verify                       # Verify ledger signatures
mj court review request.json           # Run multi-role agent review
mj budget show --actor codex           # Show mutation budget
mj visa mint --scope add_dns --ttl 15m # Mint capability visa
```

---

## Phase 1: Delivery Airlock (Days 1–15)

### What it is
The core control path. Every mutation flows through intake → validation → risk → approval → execution → evidence → ledger. No shortcuts.

### Idea #1: Intent-to-Production Compiler

**Where it lives:** `platform/src/core/policy-compiler.ts`

**What to build:**

```typescript
interface IntentRequest {
  intent: string;            // "protect /mcp from unauthenticated bursts"
  tenant: string;
  risk_tolerance: "low" | "medium" | "high";
  rollback_required: boolean;
}

interface CompiledPlan {
  policy_diff: string;
  provider_plans: Record<ProviderName, string>;
  blast_radius: BlastRadius;
  test_cases: TestCase[];
  rollback_recipe: RollbackRecipe;
  evidence_requirements: string[];
  approval_path: "auto" | "operator" | "court";
}

class PolicyCompiler {
  compile(intent: IntentRequest, currentState: InventorySnapshot): CompiledPlan;
  estimateBlastRadius(plan: CompiledPlan): BlastRadius;
  generateTestCases(plan: CompiledPlan): TestCase[];
  generateRollbackRecipe(plan: CompiledPlan, preInventory: InventorySnapshot): RollbackRecipe;
}
```

**How it connects:** Extends the existing `ChangeRequestWorkflow`. The current `submitChangeRequest` accepts a full `SecurityPolicy` — the compiler sits in front and converts natural-language intent into that policy. First version: template matching against known intents (rate-limit, waf-rule, dns-record). Later: LLM-assisted compilation with human approval.

**Depends on:** Existing `CrossProviderOrchestrator`, `PolicyTranslator`

---

### Idea #7: Evidence Bundles as First-Class Release Artifacts

**Where it lives:** `platform/src/core/evidence-engine.ts`

**What to build:**

```typescript
interface EvidenceBundle {
  id: string;
  timestamp: string;
  intent: IntentRequest;
  policy_diff: string;
  provider_plan: Record<string, string>;
  inventory_before: InventorySnapshot;
  inventory_after: InventorySnapshot;
  runtime_verification: VerificationResult[];
  negative_smoke_results: TestResult[];
  rollback_recipe: RollbackRecipe;
  ledger_entry: SignedEntry;
  signature: string;       // HMAC-SHA256 of entire bundle
}

class EvidenceEngine {
  createBundle(context: ExecutionContext): EvidenceBundle;
  signBundle(bundle: EvidenceBundle): string;
  verifyBundle(bundle: EvidenceBundle): boolean;
  exportForAudit(bundle: EvidenceBundle, framework: "soc2" | "pci" | "hipaa"): AuditExport;
}
```

**How it connects:** Called at the end of every `CrossProviderOrchestrator.applyPolicyToAllProviders()`. The orchestrator already captures pre/post inventory and writes ledger entries. The evidence engine wraps all of that into a signed, portable artifact.

**Output format:** JSON bundle written to `artifacts/evidence/` and optionally uploaded to R2/S3.

**Depends on:** Existing `UniversalLedger.sign()`, `CrossProviderOrchestrator`

---

### Idea #9: Counterfactual Rollback

**Where it lives:** `platform/src/core/rollback-engine.ts`

**What to build:**

```typescript
interface RollbackRecipe {
  steps: RollbackStep[];
  verification: string[];    // what to check after rollback
  tested: boolean;           // was this tested in the digital twin?
  test_result?: TestResult;
}

interface RollbackStep {
  order: number;
  provider: ProviderName;
  action: "remove" | "restore" | "invalidate" | "verify";
  resource: string;
  detail: string;
}

class RollbackEngine {
  generateRecipe(plan: CompiledPlan, preInventory: InventorySnapshot): RollbackRecipe;
  testRecipe(recipe: RollbackRecipe, twin: DigitalTwin): TestResult;
  executeRecipe(recipe: RollbackRecipe): ExecutionReport;
}
```

**Gate rule:** `No tested rollback, no production deploy.` Enforced in the orchestrator — `applyPolicyToAllProviders` refuses to execute if `rollback.tested !== true` and the policy requires `rollback_required: true`.

**Depends on:** PolicyCompiler, EvidenceEngine, DigitalTwin (Phase 2)

---

## Phase 2: Runtime Proof (Days 16–30)

### Idea #5: Policy Genome + Mutation Testing

**Where it lives:** `platform/src/core/mutation-tester.ts`

**What to build:**

```typescript
interface PolicyMutant {
  name: string;
  description: string;
  request: MockRequest;      // the hostile request
  expected_outcome: "block" | "challenge" | "deny";
}

class MutationTester {
  generateMutants(policy: SecurityPolicy): PolicyMutant[];
  runMutants(mutants: PolicyMutant[], endpoint: string): MutationTestResult;
}
```

**Mutant generation from policy YAML:** The existing `mj-edge-unified-v2.yaml` declares `required_headers`, `allowed_paths`, `method_matrix`, `deny_by_default`. For each constraint, generate the inverse:

| Policy constraint | Generated mutant |
|---|---|
| `required_headers: [x-tenant-id]` | Request without `x-tenant-id` → expect block |
| `allowed_paths: [/mcp, /turn/*]` | Request to `/admin` → expect block |
| `method_matrix: {"/mcp": ["GET","POST"]}` | `DELETE /mcp` → expect block |
| `deny_by_default: true` | Request with no headers → expect block |
| Rate limit: 120/min | 121 requests in 60s → expect challenge |

**How it connects:** CLI command `mj prove --policy policy.yaml --endpoint https://worker.dev`. Can run against the real Worker or a local `wrangler dev` instance. Results feed into the evidence bundle.

**Depends on:** Existing policy manifest format, Worker endpoint

---

### Idea #6: Runtime Verification Gates

**Where it lives:** `platform/src/core/runtime-verifier.ts`

**What to build:**

```typescript
interface RuntimeMonitor {
  id: string;
  source_policy: string;     // which policy YAML generated this
  assertion: string;         // human-readable
  check: (event: AuditEvent) => boolean;
}

class RuntimeVerifier {
  generateMonitors(policy: SecurityPolicy): RuntimeMonitor[];
  verify(monitors: RuntimeMonitor[], events: AuditEvent[]): VerificationResult[];
}
```

**Monitor generation from policy:** Parse `mj-edge-unified-v2.yaml` and generate:
- Monitor 1: Every `/mcp` request has `x-tenant-id` header
- Monitor 2: Every `GET /turn/*` is blocked (only POST allowed)
- Monitor 3: Every policy version mismatch is logged
- Monitor 4: Every tool action emits a ledger event

**How it connects:** After deploy, query the Worker's `/audit/events` endpoint for recent events and verify them against monitors. Can also run as a scheduled GitHub Action that queries audit logs continuously.

**CLI:** `mj verify --policy policy.yaml --since "1 hour ago"`

**Depends on:** Worker `/audit` endpoint, policy manifest

---

### Idea #2: Infrastructure Digital Twin

**Where it lives:** `platform/src/core/digital-twin.ts`

**What to build:**

```typescript
interface TwinState {
  inventory: InventorySnapshot;
  policy: SecurityPolicy;
  synthetic_traffic: TrafficPattern[];
}

interface SimulationResult {
  passed: boolean;
  scenarios: ScenarioResult[];
}

class DigitalTwin {
  loadState(inventory: InventorySnapshot, policy: SecurityPolicy): TwinState;
  simulate(state: TwinState, change: CompiledPlan): SimulationResult;
  formatAsPRComment(result: SimulationResult): string;
}
```

**First version:** Not a full simulation engine. It's a **policy evaluator** that takes the proposed WAF rules, rate limits, and required headers, then runs the mutation test suite against the proposed state (not the live endpoint). Fast, deterministic, no network calls.

**PR comment output:**
```
🟢 safe under normal load (all 12 legitimate patterns pass)
🟡 risky under burst traffic (rate limit triggers at 120rpm for tenant kevis)
🔴 breaks /turn/* POST for tenant hitch (missing capability: script.run)
```

**How it connects:** GitHub Actions step that runs after `policy-apply --dry-run` and posts the comment on the PR.

**Depends on:** MutationTester, PolicyCompiler, existing inventory

---

## Phase 3: Drift Immunity (Days 31–45)

### Idea #8: Drift Immune System

**Where it lives:** `platform/src/automation/drift-classifier.ts`

**What to build:**

```typescript
type DriftSeverity = "harmless" | "suspicious" | "policy_violation" | "active_threat" | "emergency_drift";

interface ClassifiedDrift {
  change: DriftChange;
  severity: DriftSeverity;
  response: DriftResponse;
  antibody?: Antibody;
}

interface Antibody {
  trigger: string;
  action: "observe" | "quarantine" | "revert" | "lockdown";
  requires_approval: boolean;
  evidence_required: boolean;
}

class DriftClassifier {
  classify(change: DriftChange, context: DriftContext): ClassifiedDrift;
  generateAntibody(classified: ClassifiedDrift): Antibody;
  storeAntibody(antibody: Antibody): void;   // learns from incidents
  matchAntibody(change: DriftChange): Antibody | null;  // recalls past responses
}
```

**Classification rules (first version):**

| Pattern | Class | Auto-response |
|---|---|---|
| Cloudflare-generated ID rotation | harmless | observe |
| New DNS record not in ledger | suspicious | open issue |
| WAF rule disabled | policy_violation | revert + approval |
| Scanner disabled + token rotated in same window | active_threat | lockdown |
| Human applied hotfix during incident | emergency_drift | retroactive change request |

**How it connects:** Replaces the simple `DRIFT_FOUND=1` logic in `sentinel-scan.sh`. The bash scanner produces the raw scan JSON; the classifier runs in the platform CLI and produces classified output with auto-responses.

**Antibody storage:** YAML file `cloudflare/antibodies.yaml` — version-controlled immune memory.

**Depends on:** Existing `sentinel-scan.sh`, `DriftScanner`, `AutoRemediation`

---

## Phase 4: Capability Controls (Days 46–60)

### Idea #3: Mutation Budget Wallets

**Where it lives:** `platform/src/core/mutation-budget.ts`

**What to build:**

```typescript
interface MutationBudget {
  actor: string;
  limits: Record<string, BudgetLimit>;
  spent: Record<string, number>;
  reset_at: string;
}

interface BudgetLimit {
  max_per_day: number;
  current: number;
  last_reset: string;
}

class MutationBudgetEngine {
  loadBudget(actor: string): MutationBudget;
  checkBudget(actor: string, intent: string): { allowed: boolean; remaining: number };
  spendBudget(actor: string, intent: string): void;
  requestIncrease(actor: string, intent: string, justification: string): ChangeRequest;
}
```

**Budget config:** `manifests/budgets/` directory with per-actor YAML:

```yaml
# manifests/budgets/codex.yaml
actor: codex
limits:
  dns_create: { max_per_day: 2 }
  waf_modify: { max_per_day: 5 }
  worker_route_modify: { max_per_day: 1 }
  destructive_changes: { max_per_day: 0 }
```

**How it connects:** The Worker's `handleChangeRequest` checks budget before accepting. The `CrossProviderOrchestrator.applyPolicyToAllProviders` checks budget before executing. Budget state stored in KV (`FLAGS` binding already exists but is unused).

**Depends on:** Worker KV binding, ChangeRequestWorkflow

---

### Idea #4: Capability Visas

**Where it lives:** `platform/src/core/capability-visa.ts`

**What to build:**

```typescript
interface CapabilityVisa {
  id: string;
  agent: string;
  scope: string;             // "add_acme_txt_record"
  zone: string;
  ttl_minutes: number;
  max_mutations: number;
  mutations_used: number;
  receipt_required: boolean;
  issued_at: string;
  expires_at: string;
  reason: string;            // why this visa was minted
  signature: string;
}

class VisaEngine {
  mint(request: VisaRequest): CapabilityVisa;
  validate(visa: CapabilityVisa): { valid: boolean; reason?: string };
  consume(visa: CapabilityVisa): void;
  revoke(visaId: string): void;
}
```

**How it connects:** The change-request protocol already has temporary token concepts. Visas replace long-lived `CF_API_TOKEN` usage. An approved change request mints a visa; the executor uses the visa; the visa dies after TTL or max_mutations. Visa state stored in D1 `change_requests` table (new column or separate `visas` table).

**Product rule:** No standing privileges for humans, agents, or pipelines.

**Depends on:** ChangeRequestWorkflow, Worker D1, existing auth system

---

### Idea #12: Agent Reputation Scores

**Where it lives:** `platform/src/core/reputation-engine.ts`

**What to build:**

```typescript
interface AgentReputation {
  actor: string;
  successful_changes: number;
  reverted_changes: number;
  denied_requests: number;
  malformed_requests: number;
  average_risk: "low" | "medium" | "high";
  trust_score: number;        // 0-100
  effective_policy: "auto" | "approval" | "read-only";
}

class ReputationEngine {
  getReputation(actor: string): AgentReputation;
  recordOutcome(actor: string, outcome: ChangeOutcome): void;
  computeTrustScore(actor: string): number;
  getEffectivePolicy(actor: string): "auto" | "approval" | "read-only";
}
```

**Trust thresholds:**
- `>= 90` → auto-execute low-risk changes
- `60-89` → approval required for all changes
- `< 60` → read-only access only

**Data source:** Ledger entries. Every `change_request_submitted`, `change_request_executed`, `auto_remediation` entry has an actor field. Aggregate success/failure/revert counts from ledger history.

**Depends on:** UniversalLedger, existing `authorized-agents.yaml`

---

## Phase 5: Compliance Autopilot (Days 61–75)

### Idea #15: Compliance Autopilot

**Where it lives:** `platform/src/automation/compliance-autopilot.ts`

**What to build:**

```typescript
interface ControlMapping {
  framework: "soc2" | "pci" | "hipaa";
  controls: ControlEvidence[];
}

interface ControlEvidence {
  control_id: string;
  control_name: string;
  evidence_sources: EvidenceSource[];
}

type EvidenceSource =
  | { type: "change_request"; query: string }
  | { type: "drift_scan"; query: string }
  | { type: "capability_visa"; query: string }
  | { type: "runtime_verification"; query: string }
  | { type: "evidence_bundle"; query: string };

class ComplianceAutopilot {
  mapControls(framework: string): ControlMapping;
  gatherEvidence(mapping: ControlMapping): AuditPacket;
  exportReport(packet: AuditPacket, format: "pdf" | "json" | "markdown"): string;
}
```

**Control map config:** `manifests/compliance/soc2.yaml`:

```yaml
framework: soc2
controls:
  - control_id: CC6.1
    control_name: Access Control
    evidence_sources:
      - type: capability_visa
        query: "all visas issued in period"
      - type: mutation_budget
        query: "all budget checks"
  - control_id: CC7.2
    control_name: System Monitoring
    evidence_sources:
      - type: drift_scan
        query: "all scan reports"
      - type: runtime_verification
        query: "all verification results"
  - control_id: CC8.1
    control_name: Change Management
    evidence_sources:
      - type: change_request
        query: "all requests with receipts"
      - type: evidence_bundle
        query: "all signed bundles"
```

**CLI:** `mj evidence export --control soc2 --since 2026-01-01 --output audit-q1.json`

**Depends on:** EvidenceEngine, ChangeRequestWorkflow, DriftScanner, RuntimeVerifier

---

## Phase 6: The Agent Court (Days 76–90)

### Idea: The Delivery Court

**Where it lives:** `platform/src/core/agent-court.ts`

**What to build:**

```typescript
type CourtRole = "petitioner" | "compiler" | "prosecutor" | "defender" |
                 "historian" | "economist" | "judge" | "bailiff" | "archivist";

interface CourtReview {
  case_id: string;
  intent: IntentRequest;
  roles: Record<CourtRole, RoleVerdict>;
  final_verdict: "approved" | "denied" | "escalated";
  evidence: EvidenceBundle;
}

interface RoleVerdict {
  role: CourtRole;
  decision: "pass" | "fail" | "warn";
  reasoning: string;
  evidence?: unknown;
}

class AgentCourt {
  async review(intent: IntentRequest): Promise<CourtReview>;
  private petitioner(intent: IntentRequest): RoleVerdict;    // validates request format
  private compiler(intent: IntentRequest): RoleVerdict;      // generates plan
  private prosecutor(plan: CompiledPlan): RoleVerdict;       // finds risk
  private defender(plan: CompiledPlan): RoleVerdict;          // explains safety
  private historian(intent: IntentRequest): RoleVerdict;      // checks prior incidents
  private economist(plan: CompiledPlan): RoleVerdict;         // estimates budget cost
  private judge(verdicts: RoleVerdict[]): RoleVerdict;        // final decision
  private bailiff(plan: CompiledPlan): RoleVerdict;           // executes if approved
  private archivist(review: CourtReview): RoleVerdict;        // signs and archives
}
```

**First version: deterministic.** Each role is a function that evaluates rules, not an LLM. The prosecutor checks blast radius, missing rollback, untested mutations. The defender checks test results, prior success history, low risk score. The judge applies a policy matrix. The bailiff calls the existing orchestrator.

**Later version:** Roles can be backed by LLM agents for reasoning about novel intents. But execution always goes through the deterministic bailiff/orchestrator path.

**CLI:** `mj court review request.json`

**Depends on:** PolicyCompiler, MutationTester, RollbackEngine, ReputationEngine, EvidenceEngine, MutationBudgetEngine

---

## Phase 7: Progressive Delivery (Post-90 days)

### Idea #10: Risk-Weighted Progressive Delivery

**Where it lives:** `platform/src/core/progressive-delivery.ts`

```yaml
blast_radius:
  tenants: [kevis]
  endpoints: [/mcp]
  traffic_percent: 10
  max_error_budget_burn: 0.5%
  auto_revert_on:
    auth_failures: +20%
    p95_latency: +100ms
    policy_denials: unexpected
```

**Depends on:** Runtime verifier, Worker analytics, canary routing in Cloudflare Workers

### Idea #11: SLO-Collateralized Deploys

**Where it lives:** `platform/src/core/slo-engine.ts`

Every release posts collateral from the error budget. If it burns too fast: auto-revert, lock future deploys, open incident, attach evidence.

**Depends on:** Progressive delivery, runtime verifier, observability integration

### Idea #13: Shadow Tenant Lab

**Where it lives:** `platform/src/core/shadow-lab.ts`

Ghost twin per tenant. Policy changes land in shadow first. Synthetic traffic replays. Red/blue agent testing in shadow zone.

**Depends on:** Digital twin, mutation tester, multi-tenant Worker routing

### Idea #14: Self-Rewriting Runbooks

**Where it lives:** `platform/src/automation/runbook-generator.ts`

Every incident updates the runbook automatically. Root cause → remediation → operator note → runbook patch PR.

**Depends on:** GitHub adapter, incident tracking in D1, existing runbook markdown format

### Idea #16: Policy Translation Marketplace

**Where it lives:** Adapter registry pattern. `adapters/` becomes a plugin system.

```
adapter-cloudflare     # included
adapter-aws            # included
adapter-kubernetes     # included
adapter-terraform      # included
adapter-fastly         # community
adapter-vercel         # community
adapter-istio          # community
adapter-supabase       # community
```

**Depends on:** Stable `ProviderAdapter` interface, npm package publishing

---

## Industry-Standard Floor (Parallel Track)

These are table stakes implemented through the automation modules above:

| Area | Implementation |
|---|---|
| CI/CD gates | GitHub Actions: lint, typecheck, build, deploy, smoke → `mj-layer-deploy.yml` |
| DevSecOps | Mutation tester (SAST equivalent for policy), secret scan in preflight |
| Supply chain | Evidence bundles = SBOM + signed artifacts + provenance |
| IaC | Plan/apply separation via PolicyCompiler, approval gates via ChangeRequestWorkflow |
| Release safety | Counterfactual rollback, progressive delivery, digital twin |
| Observability | Runtime verifier, health aggregator, drift scanner |
| Performance | Mutation tester burst scenarios, rate limit validation |
| DORA metrics | Computed from ledger: deploy frequency, lead time (intent→execute), MTTR (drift→remediate), change failure rate (reverted/total) |

---

## Monetization Wedges (in order)

### 1. Auditor-Ready CI/CD Evidence
Signed evidence bundles, control mapping, change receipts, drift reports, exportable audit packets.
**Buyer:** Compliance-heavy SaaS, fintech, healthcare.

### 2. AI-Agent Infrastructure Airlock
Agent change requests, capability visas, mutation budgets, signed receipts, no-standing-privilege execution.
**Buyer:** Teams adopting Cursor, Codex, Gemini, internal agents.

### 3. Multi-Cloud Policy Translation
Write once, translate policies, preview differences, apply through adapters, verify drift.
**Buyer:** DevOps/security teams with Cloudflare + AWS + Kubernetes.

### 4. Drift Immune System
Scheduled scans, drift classification, GitHub issues, approved auto-remediation, ledger proof.
**Buyer:** SRE/security teams.

---

## File Map: What Exists vs. What to Build

### Exists (built)
- `platform/src/core/types.ts` — shared types
- `platform/src/core/ledger.ts` — universal ledger with signing
- `platform/src/core/orchestrator.ts` — cross-provider orchestrator
- `platform/src/adapters/` — cloudflare, aws, kubernetes, terraform
- `platform/src/automation/drift-scanner.ts`
- `platform/src/automation/compliance-checker.ts`
- `platform/src/automation/health-aggregator.ts`
- `platform/src/automation/change-request-workflow.ts`
- `platform/src/automation/auto-remediation.ts`
- `platform/src/automation/policy-translator.ts`
- `platform/src/cli/index.ts` — 12 commands
- `mcp-layer/src/index.ts` — Worker with MCP/turn/audit/healthz endpoints

### To Build (Phase 1–3, first 45 days)
- `platform/src/core/policy-compiler.ts` — intent → plan → risk → diff
- `platform/src/core/evidence-engine.ts` — signed bundles
- `platform/src/core/rollback-engine.ts` — counterfactual rollback
- `platform/src/core/mutation-tester.ts` — policy genome testing
- `platform/src/core/runtime-verifier.ts` — live monitors from policy
- `platform/src/core/digital-twin.ts` — simulation engine
- `platform/src/automation/drift-classifier.ts` — immune system
- `cloudflare/antibodies.yaml` — immune memory

### To Build (Phase 4–6, days 46–90)
- `platform/src/core/mutation-budget.ts` — spending limits
- `platform/src/core/capability-visa.ts` — short-lived scoped tokens
- `platform/src/core/reputation-engine.ts` — agent trust scores
- `platform/src/automation/compliance-autopilot.ts` — SOC2/PCI mapping
- `platform/src/core/agent-court.ts` — multi-role review
- `manifests/budgets/` — per-actor budget YAML
- `manifests/compliance/` — control mapping YAML

### To Build (Post-90 days)
- `platform/src/core/progressive-delivery.ts`
- `platform/src/core/slo-engine.ts`
- `platform/src/core/shadow-lab.ts`
- `platform/src/automation/runbook-generator.ts`
- Adapter marketplace packaging
