import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, test } from "node:test";
import { AutoRemediation } from "../src/automation/auto-remediation.js";
import { ComplianceAutopilot } from "../src/automation/compliance-autopilot.js";
import type { ProviderAdapter } from "../src/adapters/provider.interface.js";
import { EvidenceEngine, type EvidenceBundle } from "../src/core/evidence-engine.js";
import type { UniversalLedger } from "../src/core/ledger.js";
import { MutationBudgetEngine } from "../src/core/mutation-budget.js";
import { RuntimeVerifier } from "../src/core/runtime-verifier.js";
import type {
  ChangeRequest,
  DriftReport,
  InventorySnapshot,
  LedgerEntry,
  SecurityPolicy,
} from "../src/core/types.js";

describe("review fixes", () => {
  test("runtime verifier requires non-empty required headers", async () => {
    const verifier = new RuntimeVerifier();
    const monitors = verifier.generateMonitors({
      name: "header-policy",
      securityDefaults: {
        denyByDefault: true,
        requiredHeaders: ["x-tenant-id"],
      },
    } as SecurityPolicy);

    const [result] = await verifier.verify(monitors, [{
      actor: "operator",
      category: "mcp.execute",
      id: "evt-1",
      message: "request",
      metadata: {
        headers: {
          "x-tenant-id": "",
        },
      },
      severity: "info",
      source: "worker",
      timestamp: new Date().toISOString(),
    }]);

    assert.equal(result.passed, false);
  });

  test("audit export computes coverage per control", () => {
    const engine = new EvidenceEngine("test-key", tmpdir());
    const audit = engine.exportForAudit([
      evidenceBundle(["ledger_entry"]),
    ], "soc2");

    assert.deepEqual(audit.controls_covered, ["CC8.1"]);
    assert.deepEqual(audit.controls_missing.sort(), ["CC6.1", "CC7.2"]);
  });

  test("ESM loaders read compliance mappings and budget configs", () => {
    const root = mkdtempSync(join(tmpdir(), "mj-platform-review-"));
    const mappingsDir = join(root, "mappings");
    const budgetsDir = join(root, "budgets");
    const stateFile = join(root, "state", "budget.json");

    mkdirSync(mappingsDir);
    mkdirSync(budgetsDir);
    writeFileSync(join(mappingsDir, "pci.yaml"), [
      "framework: pci",
      "version: '4.0'",
      "controls:",
      "  - control_id: '10.1'",
      "    control_name: Audit Trails",
      "    description: Audit trail coverage",
      "    required: true",
      "    evidence_sources:",
      "      - type: ledger_entry",
      "        description: Ledger entries",
      "        query: all",
      "",
    ].join("\n"), { flag: "wx" });
    writeFileSync(join(budgetsDir, "codex.yaml"), [
      "actor: codex",
      "reset_schedule: daily",
      "last_global_reset: '2026-05-13T00:00:00.000Z'",
      "limits:",
      "  general_modify:",
      "    max_per_period: 3",
      "    current: 0",
      "    last_reset: '2026-05-13T00:00:00.000Z'",
      "",
    ].join("\n"), { flag: "wx" });

    const autopilot = new ComplianceAutopilot(mappingsDir);
    const report = autopilot.generateReport("pci", [], "2026-01-01", "2026-06-01");
    assert.equal(report.framework, "pci");
    assert.equal(report.summary.total_controls, 1);

    const budgetEngine = new MutationBudgetEngine(budgetsDir, stateFile);
    assert.equal(budgetEngine.getBudgetSummary("codex").configured, true);
  });

  test("auto remediation reverts drift resources instead of baseline labels", async () => {
    const reverted: string[] = [];
    const recorded: LedgerEntry[] = [];
    const adapter = providerAdapter({
      async revertPolicy(version: string): Promise<ChangeRequest> {
        reverted.push(version);
        return changeRequest(`change-${reverted.length}`);
      },
    });
    const ledger = {
      async recordEntry(entry: LedgerEntry) {
        recorded.push(entry);
      },
    } as unknown as UniversalLedger;

    const remediation = new AutoRemediation(
      new Map([["cloudflare", adapter]]),
      ledger,
      { autoApprove: true },
    );
    const drift: DriftReport = {
      provider: "cloudflare",
      timestamp: "2026-05-13T00:00:00.000Z",
      severity: "low",
      unauthorizedChanges: [{
        current: "present",
        expected: "absent",
        resource: "waf-rule:block-test",
        type: "added",
      }],
    };

    const result = await remediation.remediateWithApproval(drift);

    assert.equal(result.status, "remediated");
    assert.deepEqual(reverted, ["rollback-waf-rule:block-test"]);
    assert.equal(recorded.length, 1);
  });
});

function evidenceBundle(evidenceSatisfied: string[]): EvidenceBundle {
  return {
    compiled_plan_id: "plan-1",
    evidence_missing: [],
    evidence_requirements: evidenceSatisfied,
    evidence_satisfied: evidenceSatisfied,
    execution_report: null,
    hash: "hash",
    id: `bundle-${evidenceSatisfied.join("-")}`,
    intent: {
      intent: "change policy",
      risk_tolerance: "low",
      rollback_required: true,
      target_providers: ["cloudflare"],
      tenant: "operator",
    },
    inventory_after: null,
    inventory_before: null,
    ledger_entries: [],
    mutation_test_results: [],
    policy_diff: "diff",
    provider_plans: { cloudflare: "plan" },
    rollback_recipe: {
      estimated_duration_seconds: 0,
      steps: [],
      verification: [],
    },
    rollback_tested: false,
    runtime_verification: [],
    signature: "signature",
    timestamp: new Date().toISOString(),
    version: "1.0",
  };
}

function providerAdapter(overrides: Partial<ProviderAdapter> = {}): ProviderAdapter {
  return {
    name: "cloudflare",
    async applyPolicy(_policy: SecurityPolicy): Promise<ChangeRequest> {
      return changeRequest("apply");
    },
    async generateDiff(_policy: SecurityPolicy): Promise<string> {
      return "";
    },
    async getAuditLog(_since: Date): Promise<LedgerEntry[]> {
      return [];
    },
    async getInventory(): Promise<InventorySnapshot> {
      return {
        provider: "cloudflare",
        resources: {},
        timestamp: new Date().toISOString(),
      };
    },
    async healthCheck() {
      return { latency: 1, ok: true };
    },
    async recordChange(_entry: LedgerEntry): Promise<void> {
      return;
    },
    async revertPolicy(_version: string): Promise<ChangeRequest> {
      return changeRequest("revert");
    },
    async validateAccess() {
      return { ok: true, permissions: [] };
    },
    async validatePolicy(_policy: SecurityPolicy) {
      return { errors: [], ok: true };
    },
    ...overrides,
  };
}

function changeRequest(id: string): ChangeRequest {
  return {
    createdAt: new Date().toISOString(),
    id,
    name: id,
    policy: {} as SecurityPolicy,
    requester: "test",
    status: "executed",
    targetProviders: ["cloudflare"],
  };
}
