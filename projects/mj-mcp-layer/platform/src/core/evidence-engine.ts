import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type {
  ExecutionReport,
  InventorySnapshot,
  ProviderName,
} from "./types.js";
import type { CompiledPlan, IntentRequest, RollbackRecipe, TestCase } from "./policy-compiler.js";
import type { SignedEntry } from "./types.js";

export interface VerificationResult {
  monitor_id: string;
  assertion: string;
  passed: boolean;
  observed?: unknown;
  timestamp: string;
}

export interface TestResult {
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
  duration_ms: number;
}

export interface EvidenceBundle {
  id: string;
  version: "1.0";
  timestamp: string;
  intent: IntentRequest;
  compiled_plan_id: string;
  policy_diff: string;
  provider_plans: Record<ProviderName, string>;
  inventory_before: InventorySnapshot | null;
  inventory_after: InventorySnapshot | null;
  execution_report: ExecutionReport | null;
  runtime_verification: VerificationResult[];
  mutation_test_results: TestResult[];
  rollback_recipe: RollbackRecipe;
  rollback_tested: boolean;
  ledger_entries: SignedEntry[];
  evidence_requirements: string[];
  evidence_satisfied: string[];
  evidence_missing: string[];
  hash: string;
  signature: string;
}

export interface AuditExport {
  framework: string;
  export_timestamp: string;
  bundles: AuditBundleSummary[];
  controls_covered: string[];
  controls_missing: string[];
}

interface AuditBundleSummary {
  bundle_id: string;
  timestamp: string;
  intent: string;
  providers: ProviderName[];
  risk: string;
  outcome: string;
  evidence_complete: boolean;
}

interface BundleInput {
  plan: CompiledPlan;
  inventoryBefore?: InventorySnapshot;
  inventoryAfter?: InventorySnapshot;
  executionReport?: ExecutionReport;
  verificationResults?: VerificationResult[];
  mutationTestResults?: TestResult[];
  rollbackTested?: boolean;
  ledgerEntries?: SignedEntry[];
}

export class EvidenceEngine {
  private signingKey: string;
  private outputDir: string;

  constructor(signingKey: string, outputDir: string) {
    this.signingKey = signingKey;
    this.outputDir = outputDir;
  }

  createBundle(input: BundleInput): EvidenceBundle {
    const {
      plan,
      inventoryBefore,
      inventoryAfter,
      executionReport,
      verificationResults = [],
      mutationTestResults = [],
      rollbackTested = false,
      ledgerEntries = [],
    } = input;

    const evidenceSatisfied: string[] = [];
    const evidenceMissing: string[] = [];

    for (const req of plan.evidence_requirements) {
      if (this.isRequirementSatisfied(req, input)) {
        evidenceSatisfied.push(req);
      } else {
        evidenceMissing.push(req);
      }
    }

    const bundle: EvidenceBundle = {
      id: `evidence-${plan.id}-${Date.now()}`,
      version: "1.0",
      timestamp: new Date().toISOString(),
      intent: plan.intent,
      compiled_plan_id: plan.id,
      policy_diff: plan.policy_diff,
      provider_plans: plan.provider_plans,
      inventory_before: inventoryBefore ?? null,
      inventory_after: inventoryAfter ?? null,
      execution_report: executionReport ?? null,
      runtime_verification: verificationResults,
      mutation_test_results: mutationTestResults,
      rollback_recipe: plan.rollback_recipe,
      rollback_tested: rollbackTested,
      ledger_entries: ledgerEntries,
      evidence_requirements: plan.evidence_requirements,
      evidence_satisfied: evidenceSatisfied,
      evidence_missing: evidenceMissing,
      hash: "",
      signature: "",
    };

    bundle.hash = this.hashBundle(bundle);
    bundle.signature = this.signBundle(bundle);
    return bundle;
  }

  signBundle(bundle: EvidenceBundle): string {
    return createHmac("sha256", this.signingKey)
      .update(canonicalStringify({ ...bundle, signature: "" }))
      .digest("hex");
  }

  verifyBundle(bundle: EvidenceBundle): boolean {
    const expectedHash = this.hashBundle(bundle);
    if (bundle.hash !== expectedHash) return false;

    const expectedSignature = this.signBundle({ ...bundle, signature: "" });
    try {
      return timingSafeEqual(
        Buffer.from(bundle.signature, "hex"),
        Buffer.from(expectedSignature, "hex"),
      );
    } catch {
      return false;
    }
  }

  isComplete(bundle: EvidenceBundle): boolean {
    return bundle.evidence_missing.length === 0;
  }

  persistBundle(bundle: EvidenceBundle): string {
    const dir = join(this.outputDir, "evidence");
    mkdirSync(dir, { recursive: true });

    const filename = `${bundle.id}.json`;
    const path = join(dir, filename);
    writeFileSync(path, JSON.stringify(bundle, null, 2));

    const manifestPath = join(dir, `${bundle.id}-manifest.md`);
    writeFileSync(manifestPath, this.formatManifest(bundle));

    return path;
  }

  formatManifest(bundle: EvidenceBundle): string {
    const lines: string[] = [
      `# Evidence Bundle: ${bundle.id}`,
      "",
      `| Field | Value |`,
      `|-------|-------|`,
      `| Timestamp | ${bundle.timestamp} |`,
      `| Intent | ${bundle.intent.intent} |`,
      `| Tenant | ${bundle.intent.tenant} |`,
      `| Risk Tolerance | ${bundle.intent.risk_tolerance} |`,
      `| Plan ID | ${bundle.compiled_plan_id} |`,
      `| Hash | \`${bundle.hash}\` |`,
      `| Signature | \`${bundle.signature.slice(0, 16)}...\` |`,
      `| Complete | ${bundle.evidence_missing.length === 0 ? "YES" : "NO"} |`,
      "",
      "## Evidence Requirements",
      "",
    ];

    for (const req of bundle.evidence_requirements) {
      const satisfied = bundle.evidence_satisfied.includes(req);
      lines.push(`- ${satisfied ? "[x]" : "[ ]"} ${req}`);
    }

    lines.push("", "## Inventory", "");
    lines.push(`- Before: ${bundle.inventory_before?.timestamp ?? "not captured"}`);
    lines.push(`- After: ${bundle.inventory_after?.timestamp ?? "not captured"}`);

    lines.push("", "## Execution", "");
    if (bundle.execution_report) {
      for (const [provider, result] of Object.entries(bundle.execution_report.results)) {
        lines.push(`- ${provider}: ${result.status}${result.reason ? ` (${result.reason})` : ""}`);
      }
    } else {
      lines.push("- Not executed yet");
    }

    lines.push("", "## Verification", "");
    lines.push(`- Runtime checks: ${bundle.runtime_verification.length}`);
    lines.push(`- Mutation tests: ${bundle.mutation_test_results.length}`);
    const failedTests = bundle.mutation_test_results.filter((t) => !t.passed);
    if (failedTests.length > 0) {
      lines.push(`- FAILED tests: ${failedTests.length}`);
      for (const t of failedTests) {
        lines.push(`  - ${t.name}: expected ${t.expected}, got ${t.actual}`);
      }
    }

    lines.push("", "## Rollback", "");
    lines.push(`- Recipe steps: ${bundle.rollback_recipe.steps.length}`);
    lines.push(`- Tested: ${bundle.rollback_tested ? "YES" : "NO"}`);
    lines.push(`- Estimated duration: ${bundle.rollback_recipe.estimated_duration_seconds}s`);

    lines.push("", "## Policy Diff", "", "```", bundle.policy_diff, "```");

    return lines.join("\n");
  }

  exportForAudit(bundles: EvidenceBundle[], framework: string): AuditExport {
    const controlMap: Record<string, string[]> = {
      soc2: ["CC6.1", "CC7.2", "CC8.1"],
      pci: ["6.5", "6.6", "10.1", "10.2"],
      hipaa: ["164.312(a)", "164.312(b)", "164.312(c)"],
    };

    const controls = controlMap[framework] ?? [];
    const covered: string[] = [];
    const missing: string[] = [];

    for (const control of controls) {
      const hasEvidence = bundles.some((b) => b.evidence_satisfied.length > 0);
      if (hasEvidence) covered.push(control);
      else missing.push(control);
    }

    return {
      framework,
      export_timestamp: new Date().toISOString(),
      bundles: bundles.map((b) => ({
        bundle_id: b.id,
        timestamp: b.timestamp,
        intent: b.intent.intent,
        providers: b.intent.target_providers ?? ["cloudflare"],
        risk: b.intent.risk_tolerance,
        outcome: b.execution_report
          ? Object.values(b.execution_report.results).every((r) => r.status === "success")
            ? "success"
            : "partial"
          : "pending",
        evidence_complete: b.evidence_missing.length === 0,
      })),
      controls_covered: covered,
      controls_missing: missing,
    };
  }

  private isRequirementSatisfied(
    requirement: string,
    input: BundleInput,
  ): boolean {
    switch (requirement) {
      case "inventory_before":
        return input.inventoryBefore != null;
      case "inventory_after":
        return input.inventoryAfter != null;
      case "policy_diff":
        return input.plan.policy_diff.length > 0;
      case "ledger_entry":
        return (input.ledgerEntries?.length ?? 0) > 0;
      case "rollback_recipe_tested":
        return input.rollbackTested === true;
      case "mutation_test_results":
        return (input.mutationTestResults?.length ?? 0) > 0
          && input.mutationTestResults!.every((t) => t.passed);
      case "operator_sign_off":
        return false;
      case "blast_radius_review":
        return false;
      default:
        return false;
    }
  }

  private hashBundle(bundle: EvidenceBundle): string {
    return createHash("sha256")
      .update(canonicalStringify({ ...bundle, hash: "", signature: "" }))
      .digest("hex");
  }
}

function canonicalStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalStringify(item)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalStringify(item)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
