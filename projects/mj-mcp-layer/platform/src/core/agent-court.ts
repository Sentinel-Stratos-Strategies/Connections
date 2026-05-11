import type { ProviderAdapter } from "../adapters/provider.interface.js";
import type { PolicyCompiler, CompiledPlan, IntentRequest } from "./policy-compiler.js";
import type { MutationTester, MutationTestReport } from "./mutation-tester.js";
import type { RollbackEngine, RollbackTestResult } from "./rollback-engine.js";
import type { EvidenceEngine, EvidenceBundle } from "./evidence-engine.js";
import type { MutationBudgetEngine, BudgetCheckResult } from "./mutation-budget.js";
import type { ReputationEngine, AgentReputation } from "./reputation-engine.js";
import type { InventorySnapshot, ProviderName } from "./types.js";

export type CourtRole =
  | "petitioner"
  | "compiler"
  | "prosecutor"
  | "defender"
  | "historian"
  | "economist"
  | "judge"
  | "bailiff"
  | "archivist";

export interface RoleVerdict {
  role: CourtRole;
  decision: "pass" | "fail" | "warn";
  reasoning: string;
  evidence?: Record<string, unknown>;
  duration_ms: number;
}

export interface CourtReview {
  case_id: string;
  timestamp: string;
  intent: IntentRequest;
  plan: CompiledPlan;
  verdicts: Record<CourtRole, RoleVerdict>;
  final_verdict: "approved" | "denied" | "escalated";
  approval_path: "auto" | "operator" | "court";
  evidence_bundle?: EvidenceBundle;
  summary: string;
}

interface CourtDependencies {
  compiler: PolicyCompiler;
  mutationTester: MutationTester;
  rollbackEngine: RollbackEngine;
  evidenceEngine: EvidenceEngine;
  budgetEngine: MutationBudgetEngine;
  reputationEngine: ReputationEngine;
  adapters: Map<ProviderName, ProviderAdapter>;
}

export class AgentCourt {
  private deps: CourtDependencies;

  constructor(deps: CourtDependencies) {
    this.deps = deps;
  }

  async review(intent: IntentRequest): Promise<CourtReview> {
    const caseId = `case-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const verdicts: Partial<Record<CourtRole, RoleVerdict>> = {};

    const firstAdapter = this.deps.adapters.values().next().value;
    const inventory: InventorySnapshot = firstAdapter
      ? await firstAdapter.getInventory()
      : { provider: "cloudflare", timestamp: new Date().toISOString(), resources: {} };

    verdicts.petitioner = this.petitioner(intent);
    if (verdicts.petitioner.decision === "fail") {
      return this.buildReview(caseId, intent, null, verdicts as Record<CourtRole, RoleVerdict>, "denied");
    }

    const plan = this.deps.compiler.compile(intent, inventory, this.deps.adapters);
    verdicts.compiler = this.compilerRole(plan);

    verdicts.prosecutor = await this.prosecutor(plan, intent);
    verdicts.defender = await this.defender(plan, intent);
    verdicts.historian = this.historian(intent);
    verdicts.economist = this.economist(intent, plan);
    verdicts.judge = this.judge(verdicts as Record<CourtRole, RoleVerdict>, plan);

    const finalVerdict = verdicts.judge.decision === "pass"
      ? "approved"
      : verdicts.judge.decision === "warn"
        ? "escalated"
        : "denied";

    if (finalVerdict === "approved") {
      verdicts.bailiff = this.bailiff(plan);
      verdicts.archivist = this.archivist(plan);
    } else {
      verdicts.bailiff = { role: "bailiff", decision: "pass", reasoning: "Execution not required — case not approved", duration_ms: 0 };
      verdicts.archivist = { role: "archivist", decision: "pass", reasoning: "Archive deferred — case not approved", duration_ms: 0 };
    }

    return this.buildReview(caseId, intent, plan, verdicts as Record<CourtRole, RoleVerdict>, finalVerdict);
  }

  private petitioner(intent: IntentRequest): RoleVerdict {
    const start = Date.now();
    const issues: string[] = [];

    if (!intent.intent || intent.intent.trim().length < 5) {
      issues.push("Intent description too short or missing");
    }
    if (!intent.tenant) {
      issues.push("Tenant not specified");
    }
    if (!intent.risk_tolerance) {
      issues.push("Risk tolerance not specified");
    }

    return {
      role: "petitioner",
      decision: issues.length === 0 ? "pass" : "fail",
      reasoning: issues.length === 0
        ? `Intent well-formed: "${intent.intent}" for tenant ${intent.tenant}`
        : `Malformed petition: ${issues.join("; ")}`,
      evidence: { issues },
      duration_ms: Date.now() - start,
    };
  }

  private compilerRole(plan: CompiledPlan): RoleVerdict {
    const start = Date.now();
    const issues: string[] = [];

    if (plan.policy.policies.waf.rules.length === 0 && plan.policy.policies.rateLimit.rules.length === 0) {
      issues.push("Compiled plan has no WAF or rate limit rules — intent may not have matched a template");
    }
    if (plan.test_cases.length === 0) {
      issues.push("No test cases generated from plan");
    }

    return {
      role: "compiler",
      decision: issues.length === 0 ? "pass" : "warn",
      reasoning: issues.length === 0
        ? `Plan compiled: ${plan.policy.policies.waf.rules.length} WAF rules, ${plan.policy.policies.rateLimit.rules.length} rate limits, ${plan.test_cases.length} test cases`
        : `Compilation warnings: ${issues.join("; ")}`,
      evidence: {
        plan_id: plan.id,
        waf_rules: plan.policy.policies.waf.rules.length,
        rate_limits: plan.policy.policies.rateLimit.rules.length,
        test_cases: plan.test_cases.length,
        issues,
      },
      duration_ms: Date.now() - start,
    };
  }

  private async prosecutor(plan: CompiledPlan, intent: IntentRequest): Promise<RoleVerdict> {
    const start = Date.now();
    const charges: string[] = [];

    if (plan.blast_radius.estimated_risk === "critical") {
      charges.push(`CRITICAL blast radius: affects ${plan.blast_radius.max_users_impacted} users across ${plan.blast_radius.providers_affected.join(", ")}`);
    }
    if (plan.blast_radius.estimated_risk === "high") {
      charges.push(`HIGH blast radius: ${plan.blast_radius.endpoints_affected.join(", ")} affected`);
    }

    if (intent.rollback_required && plan.rollback_recipe.steps.length === 0) {
      charges.push("Rollback required but no rollback recipe generated");
    }

    if (plan.policy.policies.waf.rules.some((r) => !r.expression.includes("http.request.uri.path"))) {
      charges.push("WAF rule without path scoping — could affect all traffic");
    }

    if (!plan.policy.securityDefaults.denyByDefault) {
      charges.push("Deny-by-default is DISABLED — violates security baseline");
    }

    const budgetCheck = this.deps.budgetEngine.checkBudget(intent.tenant, intent.intent);
    if (!budgetCheck.allowed) {
      charges.push(`Budget exhausted: ${budgetCheck.message}`);
    }

    return {
      role: "prosecutor",
      decision: charges.length === 0 ? "pass" : charges.some((c) => c.startsWith("CRITICAL")) ? "fail" : "warn",
      reasoning: charges.length === 0
        ? "No charges. Plan appears safe."
        : `${charges.length} charge(s): ${charges.join("; ")}`,
      evidence: { charges, budget_check: budgetCheck },
      duration_ms: Date.now() - start,
    };
  }

  private async defender(plan: CompiledPlan, intent: IntentRequest): Promise<RoleVerdict> {
    const start = Date.now();
    const defenses: string[] = [];

    if (plan.blast_radius.reversible) {
      defenses.push("All changes are reversible");
    }
    if (plan.rollback_recipe.steps.length > 0) {
      defenses.push(`Rollback recipe has ${plan.rollback_recipe.steps.length} steps (est. ${plan.rollback_recipe.estimated_duration_seconds}s)`);
    }
    if (plan.test_cases.length > 0) {
      defenses.push(`${plan.test_cases.length} test cases validate the change`);
    }
    if (plan.policy.securityDefaults.denyByDefault) {
      defenses.push("Deny-by-default remains active");
    }
    if (plan.policy.audit.enabled) {
      defenses.push("Audit logging is enabled");
    }

    const rep = this.deps.reputationEngine.getReputation(intent.tenant);
    if (rep.trust_score >= 90) {
      defenses.push(`Agent "${intent.tenant}" has high trust score: ${rep.trust_score}/100`);
    }

    return {
      role: "defender",
      decision: defenses.length >= 3 ? "pass" : "warn",
      reasoning: `${defenses.length} defense(s): ${defenses.join("; ")}`,
      evidence: { defenses, agent_trust: rep.trust_score },
      duration_ms: Date.now() - start,
    };
  }

  private historian(intent: IntentRequest): RoleVerdict {
    const start = Date.now();
    const rep = this.deps.reputationEngine.getReputation(intent.tenant);

    const findings: string[] = [];
    if (rep.reverted_changes > 0) {
      findings.push(`${rep.reverted_changes} prior reverted change(s)`);
    }
    if (rep.denied_requests > 0) {
      findings.push(`${rep.denied_requests} prior denied request(s)`);
    }
    if (rep.malformed_requests > 0) {
      findings.push(`${rep.malformed_requests} prior malformed request(s)`);
    }

    const risky = rep.reverted_changes > 3 || rep.malformed_requests > 5;

    return {
      role: "historian",
      decision: risky ? "warn" : "pass",
      reasoning: findings.length === 0
        ? `Clean history for "${intent.tenant}": ${rep.successful_changes} successful changes, trust ${rep.trust_score}/100`
        : `History flags for "${intent.tenant}": ${findings.join("; ")}`,
      evidence: {
        trust_score: rep.trust_score,
        successful: rep.successful_changes,
        reverted: rep.reverted_changes,
        denied: rep.denied_requests,
        malformed: rep.malformed_requests,
      },
      duration_ms: Date.now() - start,
    };
  }

  private economist(intent: IntentRequest, plan: CompiledPlan): RoleVerdict {
    const start = Date.now();

    const budgetCheck = this.deps.budgetEngine.checkBudget(intent.tenant, intent.intent);
    const rollbackCost = plan.rollback_recipe.estimated_duration_seconds;
    const ruleCount = plan.policy.policies.waf.rules.length + plan.policy.policies.rateLimit.rules.length;

    const costs: string[] = [];
    costs.push(`Mutation cost: ${ruleCount} rule(s)`);
    costs.push(`Rollback cost: ${rollbackCost}s estimated`);
    costs.push(`Budget: ${budgetCheck.remaining} remaining of ${budgetCheck.limit}`);

    if (plan.blast_radius.estimated_risk === "critical") {
      costs.push("Error budget impact: HIGH — critical blast radius");
    }

    return {
      role: "economist",
      decision: budgetCheck.allowed ? "pass" : "fail",
      reasoning: costs.join("; "),
      evidence: {
        budget: budgetCheck,
        rule_count: ruleCount,
        rollback_seconds: rollbackCost,
        blast_radius_risk: plan.blast_radius.estimated_risk,
      },
      duration_ms: Date.now() - start,
    };
  }

  private judge(verdicts: Record<CourtRole, RoleVerdict>, plan: CompiledPlan): RoleVerdict {
    const start = Date.now();
    const failures = Object.values(verdicts).filter((v) => v.decision === "fail");
    const warnings = Object.values(verdicts).filter((v) => v.decision === "warn");

    if (failures.length > 0) {
      return {
        role: "judge",
        decision: "fail",
        reasoning: `DENIED. ${failures.length} role(s) voted fail: ${failures.map((f) => f.role).join(", ")}`,
        evidence: { failures: failures.map((f) => ({ role: f.role, reason: f.reasoning })) },
        duration_ms: Date.now() - start,
      };
    }

    if (warnings.length >= 3) {
      return {
        role: "judge",
        decision: "warn",
        reasoning: `ESCALATED. ${warnings.length} warnings from: ${warnings.map((w) => w.role).join(", ")}. Requires operator review.`,
        evidence: { warnings: warnings.map((w) => ({ role: w.role, reason: w.reasoning })) },
        duration_ms: Date.now() - start,
      };
    }

    if (plan.approval_path === "court" || plan.blast_radius.estimated_risk === "critical") {
      return {
        role: "judge",
        decision: "warn",
        reasoning: "ESCALATED. Plan requires court-level approval due to risk classification.",
        evidence: { approval_path: plan.approval_path, risk: plan.blast_radius.estimated_risk },
        duration_ms: Date.now() - start,
      };
    }

    return {
      role: "judge",
      decision: "pass",
      reasoning: `APPROVED. All roles passed (${warnings.length} warning(s) noted but within tolerance).`,
      evidence: { warnings: warnings.length },
      duration_ms: Date.now() - start,
    };
  }

  private bailiff(plan: CompiledPlan): RoleVerdict {
    const start = Date.now();
    return {
      role: "bailiff",
      decision: "pass",
      reasoning: `Ready to execute plan ${plan.id}: ${plan.policy.targetProviders.join(", ")}`,
      evidence: { plan_id: plan.id, providers: plan.policy.targetProviders },
      duration_ms: Date.now() - start,
    };
  }

  private archivist(plan: CompiledPlan): RoleVerdict {
    const start = Date.now();
    return {
      role: "archivist",
      decision: "pass",
      reasoning: `Evidence requirements: ${plan.evidence_requirements.join(", ")}`,
      evidence: { requirements: plan.evidence_requirements },
      duration_ms: Date.now() - start,
    };
  }

  private buildReview(
    caseId: string,
    intent: IntentRequest,
    plan: CompiledPlan | null,
    verdicts: Record<CourtRole, RoleVerdict>,
    finalVerdict: CourtReview["final_verdict"],
  ): CourtReview {
    const dummyPlan = plan ?? {
      id: "none",
      intent,
      timestamp: new Date().toISOString(),
      policy: { version: 0, name: "", targetProviders: [], zones: [], securityDefaults: { denyByDefault: true, requiredHeaders: [] }, policies: { waf: { rules: [] }, rateLimit: { rules: [] } }, rbac: { tenants: [] }, audit: { enabled: true, retention: "90 days", immutable: true } },
      policy_diff: "",
      provider_plans: {},
      blast_radius: { tenants_affected: [], endpoints_affected: [], providers_affected: [], estimated_risk: "low", max_users_impacted: "0", reversible: true },
      test_cases: [],
      rollback_recipe: { steps: [], verification: [], estimated_duration_seconds: 0 },
      evidence_requirements: [],
      approval_path: "operator" as const,
    };

    const totalMs = Object.values(verdicts).reduce((sum, v) => sum + v.duration_ms, 0);

    return {
      case_id: caseId,
      timestamp: new Date().toISOString(),
      intent,
      plan: dummyPlan,
      verdicts,
      final_verdict: finalVerdict,
      approval_path: dummyPlan.approval_path,
      summary: this.buildSummary(caseId, verdicts, finalVerdict, totalMs),
    };
  }

  private buildSummary(
    caseId: string,
    verdicts: Record<CourtRole, RoleVerdict>,
    finalVerdict: CourtReview["final_verdict"],
    totalMs: number,
  ): string {
    const icon = { approved: "✅", denied: "❌", escalated: "⚠️" }[finalVerdict];

    const lines = [
      `# Court Review: ${caseId}`,
      "",
      `**Verdict: ${icon} ${finalVerdict.toUpperCase()}** (${totalMs}ms)`,
      "",
      "| Role | Decision | Summary |",
      "|------|----------|---------|",
    ];

    const roleOrder: CourtRole[] = ["petitioner", "compiler", "prosecutor", "defender", "historian", "economist", "judge", "bailiff", "archivist"];

    for (const role of roleOrder) {
      const v = verdicts[role];
      if (!v) continue;
      const dIcon = { pass: "✅", fail: "❌", warn: "⚠️" }[v.decision];
      lines.push(`| ${v.role} | ${dIcon} ${v.decision} | ${v.reasoning.slice(0, 100)} |`);
    }

    return lines.join("\n");
  }

  formatReview(review: CourtReview): string {
    return review.summary;
  }
}
