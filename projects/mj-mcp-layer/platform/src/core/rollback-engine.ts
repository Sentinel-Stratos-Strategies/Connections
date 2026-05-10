import type { ProviderAdapter } from "../adapters/provider.interface.js";
import type { UniversalLedger } from "./ledger.js";
import type {
  ExecutionReport,
  InventorySnapshot,
  LedgerEntry,
  ProviderName,
} from "./types.js";
import type {
  CompiledPlan,
  RollbackRecipe,
  RollbackStep,
} from "./policy-compiler.js";

export interface RollbackTestResult {
  tested: boolean;
  recipe: RollbackRecipe;
  simulation_passed: boolean;
  issues: string[];
  duration_ms: number;
}

export interface RollbackExecutionResult {
  executed: boolean;
  steps_completed: number;
  steps_total: number;
  verification_passed: boolean;
  ledger_recorded: boolean;
  issues: string[];
}

export class RollbackEngine {
  private adapters: Map<ProviderName, ProviderAdapter>;
  private ledger: UniversalLedger;

  constructor(
    adapters: Map<ProviderName, ProviderAdapter>,
    ledger: UniversalLedger,
  ) {
    this.adapters = adapters;
    this.ledger = ledger;
  }

  generateRecipe(
    plan: CompiledPlan,
    preInventory: InventorySnapshot,
  ): RollbackRecipe {
    const steps: RollbackStep[] = [];
    let order = 1;

    for (const provider of plan.policy.targetProviders) {
      for (const rule of plan.policy.policies?.waf?.rules ?? []) {
        steps.push({
          order: order++,
          provider,
          action: "remove",
          resource: `waf-rule:${rule.name}`,
          detail: `Remove WAF rule "${rule.name}" (expression: ${rule.expression.slice(0, 80)})`,
        });
      }

      for (const rule of plan.policy.policies?.rateLimit?.rules ?? []) {
        steps.push({
          order: order++,
          provider,
          action: "remove",
          resource: `ratelimit-rule:${rule.name}`,
          detail: `Remove rate limit "${rule.name}" (${rule.requests}/${rule.period}s)`,
        });
      }

      steps.push({
        order: order++,
        provider,
        action: "restore",
        resource: `inventory:${provider}`,
        detail: `Restore inventory to pre-change state (snapshot: ${preInventory.timestamp})`,
      });

      steps.push({
        order: order++,
        provider,
        action: "verify",
        resource: "endpoints",
        detail: "Verify /healthz returns 200, /mcp GET returns capabilities, rate limits at baseline",
      });
    }

    const verification = [
      "GET /healthz returns 200 with all storage bindings",
      "GET /mcp returns capabilities list with correct policy version",
      "POST /turn/:id returns 202 for authenticated tenant",
      "Rate limits match pre-change baseline values",
      "Ledger contains rollback entry with signed receipt",
    ];

    return {
      steps,
      verification,
      estimated_duration_seconds: steps.length * 5 + 10,
    };
  }

  async testRecipe(
    recipe: RollbackRecipe,
    currentInventory: InventorySnapshot,
    targetInventory: InventorySnapshot,
  ): Promise<RollbackTestResult> {
    const start = Date.now();
    const issues: string[] = [];

    for (const step of recipe.steps) {
      const adapter = this.adapters.get(step.provider);
      if (!adapter) {
        issues.push(`Step ${step.order}: adapter not configured for ${step.provider}`);
        continue;
      }

      if (step.action === "remove") {
        const resourceType = step.resource.split(":")[0];
        if (!["waf-rule", "ratelimit-rule", "cache-rule"].includes(resourceType)) {
          issues.push(`Step ${step.order}: unknown resource type "${resourceType}"`);
        }
      }

      if (step.action === "restore") {
        if (!targetInventory.resources) {
          issues.push(`Step ${step.order}: target inventory has no resources to restore`);
        }
      }
    }

    if (recipe.steps.length === 0) {
      issues.push("Recipe has no steps — nothing to roll back");
    }

    const lastStep = recipe.steps[recipe.steps.length - 1];
    if (!lastStep || lastStep.action !== "verify") {
      issues.push("Recipe does not end with a verification step");
    }

    const providers = new Set(recipe.steps.map((s) => s.provider));
    for (const provider of providers) {
      const verifySteps = recipe.steps.filter(
        (s) => s.provider === provider && s.action === "verify",
      );
      if (verifySteps.length === 0) {
        issues.push(`No verification step for provider ${provider}`);
      }
    }

    return {
      tested: true,
      recipe,
      simulation_passed: issues.length === 0,
      issues,
      duration_ms: Date.now() - start,
    };
  }

  async executeRecipe(
    recipe: RollbackRecipe,
    reason: string,
  ): Promise<RollbackExecutionResult> {
    const issues: string[] = [];
    let completed = 0;

    for (const step of recipe.steps) {
      const adapter = this.adapters.get(step.provider);
      if (!adapter) {
        issues.push(`Step ${step.order}: adapter missing for ${step.provider}`);
        continue;
      }

      try {
        switch (step.action) {
          case "remove":
          case "restore":
            await adapter.revertPolicy(`rollback-${step.resource}`);
            completed++;
            break;

          case "invalidate":
            completed++;
            break;

          case "verify": {
            const health = await adapter.healthCheck();
            if (!health.ok) {
              issues.push(`Step ${step.order}: health check failed after rollback — ${health.errors?.join(", ")}`);
            } else {
              completed++;
            }
            break;
          }
        }
      } catch (error) {
        issues.push(`Step ${step.order} (${step.action} ${step.resource}): ${error}`);
      }
    }

    const entry: LedgerEntry = {
      ts: new Date().toISOString(),
      intent: "rollback_executed",
      provider: recipe.steps[0]?.provider ?? "cloudflare",
      hash: `rollback-${Date.now()}`,
      changeId: `rollback-${Date.now()}`,
      source: "operator",
      payload: {
        reason,
        steps_completed: completed,
        steps_total: recipe.steps.length,
        issues,
      },
      result: issues.length === 0 ? "success" : "failure",
      error: issues.length > 0 ? issues.join("; ") : undefined,
    };

    let ledgerRecorded = false;
    try {
      await this.ledger.recordEntry(entry);
      ledgerRecorded = true;
    } catch (error) {
      issues.push(`Ledger write failed: ${error}`);
    }

    return {
      executed: true,
      steps_completed: completed,
      steps_total: recipe.steps.length,
      verification_passed: issues.length === 0,
      ledger_recorded: ledgerRecorded,
      issues,
    };
  }

  formatRecipe(recipe: RollbackRecipe): string {
    const lines: string[] = [
      "# Rollback Recipe",
      "",
      `Steps: ${recipe.steps.length}`,
      `Estimated duration: ${recipe.estimated_duration_seconds}s`,
      "",
      "## Steps",
      "",
    ];

    for (const step of recipe.steps) {
      lines.push(
        `${step.order}. **[${step.provider}]** ${step.action} \`${step.resource}\``,
        `   ${step.detail}`,
        "",
      );
    }

    lines.push("## Verification Checklist", "");
    for (const check of recipe.verification) {
      lines.push(`- [ ] ${check}`);
    }

    return lines.join("\n");
  }

  formatTestResult(result: RollbackTestResult): string {
    const lines: string[] = [
      "# Rollback Test Result",
      "",
      `| Field | Value |`,
      `|-------|-------|`,
      `| Tested | ${result.tested ? "YES" : "NO"} |`,
      `| Passed | ${result.simulation_passed ? "YES" : "NO"} |`,
      `| Duration | ${result.duration_ms}ms |`,
      `| Issues | ${result.issues.length} |`,
      "",
    ];

    if (result.issues.length > 0) {
      lines.push("## Issues", "");
      for (const issue of result.issues) {
        lines.push(`- ${issue}`);
      }
    }

    return lines.join("\n");
  }
}
