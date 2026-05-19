import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { dirname } from "node:path";
import { parse as parseYAML, stringify as stringifyYAML } from "yaml";
import type { ProviderName } from "./types.js";

export interface MutationBudget {
  actor: string;
  limits: Record<string, BudgetLimit>;
  reset_schedule: "daily" | "hourly";
  last_global_reset: string;
}

export interface BudgetLimit {
  max_per_period: number;
  current: number;
  last_reset: string;
}

export interface BudgetCheckResult {
  allowed: boolean;
  actor: string;
  intent: string;
  remaining: number;
  limit: number;
  message: string;
}

export interface BudgetSpendRecord {
  actor: string;
  intent: string;
  timestamp: string;
  provider: ProviderName;
  budget_before: number;
  budget_after: number;
}

interface BudgetState {
  budgets: Record<string, ActorBudgetState>;
}

interface ActorBudgetState {
  spent: Record<string, number>;
  last_reset: string;
  history: BudgetSpendRecord[];
}

export class MutationBudgetEngine {
  private configDir: string;
  private stateFile: string;
  private budgets: Map<string, MutationBudget>;
  private state: BudgetState;

  constructor(configDir: string, stateFile: string) {
    this.configDir = configDir;
    this.stateFile = stateFile;
    this.budgets = this.loadBudgetConfigs();
    this.state = this.loadState();
  }

  checkBudget(actor: string, intent: string): BudgetCheckResult {
    const budget = this.budgets.get(actor);
    if (!budget) {
      return {
        allowed: false,
        actor,
        intent,
        remaining: 0,
        limit: 0,
        message: `No budget configured for actor "${actor}"`,
      };
    }

    this.maybeResetBudget(actor, budget);

    const intentCategory = this.categorizeIntent(intent);
    const limit = budget.limits[intentCategory];
    if (!limit) {
      return {
        allowed: false,
        actor,
        intent,
        remaining: 0,
        limit: 0,
        message: `No budget for intent category "${intentCategory}"`,
      };
    }

    const spent = this.getSpent(actor, intentCategory);
    const remaining = limit.max_per_period - spent;

    if (remaining <= 0) {
      return {
        allowed: false,
        actor,
        intent,
        remaining: 0,
        limit: limit.max_per_period,
        message: `Budget exhausted for "${intentCategory}" (${spent}/${limit.max_per_period})`,
      };
    }

    return {
      allowed: true,
      actor,
      intent,
      remaining: remaining - 1,
      limit: limit.max_per_period,
      message: `Allowed. ${remaining - 1} remaining after this operation.`,
    };
  }

  spendBudget(actor: string, intent: string, provider: ProviderName): BudgetSpendRecord {
    const intentCategory = this.categorizeIntent(intent);
    const actorState = this.getOrCreateActorState(actor);
    const before = actorState.spent[intentCategory] ?? 0;

    actorState.spent[intentCategory] = before + 1;

    const record: BudgetSpendRecord = {
      actor,
      intent: intentCategory,
      timestamp: new Date().toISOString(),
      provider,
      budget_before: before,
      budget_after: before + 1,
    };

    actorState.history.push(record);

    if (actorState.history.length > 1000) {
      actorState.history = actorState.history.slice(-500);
    }

    this.saveState();
    return record;
  }

  getBudgetSummary(actor: string): BudgetSummary {
    const budget = this.budgets.get(actor);
    if (!budget) {
      return {
        actor,
        configured: false,
        limits: {},
        total_spent: 0,
        total_remaining: 0,
      };
    }

    this.maybeResetBudget(actor, budget);

    const limits: Record<string, { limit: number; spent: number; remaining: number }> = {};
    let totalSpent = 0;
    let totalRemaining = 0;

    for (const [category, limit] of Object.entries(budget.limits)) {
      const spent = this.getSpent(actor, category);
      const remaining = Math.max(0, limit.max_per_period - spent);
      limits[category] = { limit: limit.max_per_period, spent, remaining };
      totalSpent += spent;
      totalRemaining += remaining;
    }

    return {
      actor,
      configured: true,
      limits,
      total_spent: totalSpent,
      total_remaining: totalRemaining,
    };
  }

  getAllSummaries(): BudgetSummary[] {
    return Array.from(this.budgets.keys()).map((actor) => this.getBudgetSummary(actor));
  }

  formatSummary(summary: BudgetSummary): string {
    const lines: string[] = [
      `# Mutation Budget: ${summary.actor}`,
      "",
      `Configured: ${summary.configured}`,
      "",
    ];

    if (!summary.configured) {
      lines.push("No budget configured for this actor.");
      return lines.join("\n");
    }

    lines.push("| Category | Limit | Spent | Remaining |");
    lines.push("|----------|-------|-------|-----------|");

    for (const [category, data] of Object.entries(summary.limits)) {
      const bar = data.remaining === 0 ? " EXHAUSTED" : "";
      lines.push(`| ${category} | ${data.limit} | ${data.spent} | ${data.remaining}${bar} |`);
    }

    lines.push("", `Total spent: ${summary.total_spent}`, `Total remaining: ${summary.total_remaining}`);
    return lines.join("\n");
  }

  private categorizeIntent(intent: string): string {
    const lower = intent.toLowerCase();
    if (lower.includes("dns")) return "dns_create";
    if (lower.includes("waf")) return "waf_modify";
    if (lower.includes("rate") && lower.includes("limit")) return "ratelimit_modify";
    if (lower.includes("worker") && lower.includes("route")) return "worker_route_modify";
    if (lower.includes("delete") || lower.includes("remove") || lower.includes("destroy")) return "destructive_changes";
    if (lower.includes("cache")) return "cache_modify";
    return "general_modify";
  }

  private getSpent(actor: string, category: string): number {
    return this.state.budgets[actor]?.spent[category] ?? 0;
  }

  private getOrCreateActorState(actor: string): ActorBudgetState {
    if (!this.state.budgets[actor]) {
      this.state.budgets[actor] = {
        spent: {},
        last_reset: new Date().toISOString(),
        history: [],
      };
    }
    return this.state.budgets[actor];
  }

  private maybeResetBudget(actor: string, budget: MutationBudget): void {
    const actorState = this.state.budgets[actor];
    if (!actorState) return;

    const lastReset = new Date(actorState.last_reset);
    const now = new Date();
    const hoursSinceReset = (now.getTime() - lastReset.getTime()) / 3600000;

    const shouldReset =
      (budget.reset_schedule === "daily" && hoursSinceReset >= 24) ||
      (budget.reset_schedule === "hourly" && hoursSinceReset >= 1);

    if (shouldReset) {
      actorState.spent = {};
      actorState.last_reset = now.toISOString();
      this.saveState();
    }
  }

  private loadBudgetConfigs(): Map<string, MutationBudget> {
    const budgets = new Map<string, MutationBudget>();
    if (!existsSync(this.configDir)) return budgets;

    for (const file of readdirSync(this.configDir)) {
      if (!file.endsWith(".yaml") && !file.endsWith(".yml")) continue;
      try {
        const content = readFileSync(`${this.configDir}/${file}`, "utf-8");
        const data = parseYAML(content) as MutationBudget;
        if (data.actor) budgets.set(data.actor, data);
      } catch { /* skip malformed files */ }
    }

    return budgets;
  }

  private loadState(): BudgetState {
    if (!existsSync(this.stateFile)) return { budgets: {} };
    try {
      const content = readFileSync(this.stateFile, "utf-8");
      return JSON.parse(content) as BudgetState;
    } catch {
      return { budgets: {} };
    }
  }

  private saveState(): void {
    mkdirSync(dirname(this.stateFile), { recursive: true });
    writeFileSync(this.stateFile, JSON.stringify(this.state, null, 2));
  }
}

export interface BudgetSummary {
  actor: string;
  configured: boolean;
  limits: Record<string, { limit: number; spent: number; remaining: number }>;
  total_spent: number;
  total_remaining: number;
}
