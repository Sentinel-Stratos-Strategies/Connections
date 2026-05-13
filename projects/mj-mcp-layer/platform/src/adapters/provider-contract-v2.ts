import type { ProviderAdapter } from "./provider.interface.js";
import type { ProviderName, SecurityPolicy } from "../core/types.js";

export interface ProviderCapabilities {
  inventory: boolean;
  plan: boolean;
  apply: boolean;
  revert: boolean;
  auditLog: boolean;
  rateLimit: boolean;
  waf: boolean;
  dns: boolean;
  workerRoutes: boolean;
  dryRun: boolean;
  liveMutation: boolean;
}

export interface ProviderPlan {
  id: string;
  provider: ProviderName;
  policyName: string;
  changes: ProviderPlannedChange[];
  warnings: string[];
  mutationCount: number;
  dryRunOnly: boolean;
}

export interface ProviderPlannedChange {
  resource: string;
  action: "create" | "update" | "delete" | "noop" | "unsupported";
  summary: string;
  requiresApproval: boolean;
  budgetCategory?: string;
}

export interface ProviderApprovalReceipt {
  approval_id: string;
  approved_by: string;
  approved_at: string;
  scope: string;
}

export interface ProviderContractV2 {
  name: ProviderName;
  capabilities(): ProviderCapabilities;
  compile(policy: SecurityPolicy): Promise<SecurityPolicy>;
  plan(policy: SecurityPolicy): Promise<ProviderPlan>;
  diff(plan: ProviderPlan): Promise<string>;
  apply(plan: ProviderPlan, approval: ProviderApprovalReceipt): Promise<unknown>;
  verify(receipt: unknown): Promise<{ ok: boolean; errors: string[] }>;
  rollback(receipt: unknown, approval: ProviderApprovalReceipt): Promise<unknown>;
}

export function capabilitiesForProvider(name: ProviderName): ProviderCapabilities {
  const preview: ProviderCapabilities = {
    inventory: true,
    plan: true,
    apply: false,
    revert: false,
    auditLog: false,
    rateLimit: false,
    waf: false,
    dns: false,
    workerRoutes: false,
    dryRun: true,
    liveMutation: false,
  };

  if (name === "cloudflare") {
    return {
      inventory: true,
      plan: true,
      apply: true,
      revert: true,
      auditLog: true,
      rateLimit: true,
      waf: true,
      dns: true,
      workerRoutes: true,
      dryRun: true,
      liveMutation: true,
    };
  }

  return preview;
}

export class ProviderV2Facade implements ProviderContractV2 {
  readonly name: ProviderName;
  private adapter: ProviderAdapter;

  constructor(adapter: ProviderAdapter) {
    this.adapter = adapter;
    this.name = adapter.name as ProviderName;
  }

  capabilities(): ProviderCapabilities {
    return capabilitiesForProvider(this.name);
  }

  async compile(policy: SecurityPolicy): Promise<SecurityPolicy> {
    const validation = await this.adapter.validatePolicy(policy);
    if (!validation.ok) {
      throw new Error(`provider_policy_invalid:${this.name}:${validation.errors.join(";")}`);
    }
    return policy;
  }

  async plan(policy: SecurityPolicy): Promise<ProviderPlan> {
    const compiled = await this.compile(policy);
    const caps = this.capabilities();
    const changes: ProviderPlannedChange[] = [];

    for (const rule of compiled.policies.waf.rules) {
      changes.push({
        resource: `waf-rule:${rule.name}`,
        action: caps.waf ? "update" : "unsupported",
        summary: caps.waf ? `Ensure WAF rule ${rule.name}` : `${this.name} does not support WAF yet`,
        requiresApproval: caps.liveMutation,
        budgetCategory: caps.waf ? "waf_modify" : undefined,
      });
    }

    for (const rule of compiled.policies.rateLimit.rules) {
      changes.push({
        resource: `ratelimit-rule:${rule.name}`,
        action: caps.rateLimit ? "update" : "unsupported",
        summary: caps.rateLimit ? `Ensure rate limit ${rule.name}` : `${this.name} does not support rate limits yet`,
        requiresApproval: caps.liveMutation,
        budgetCategory: caps.rateLimit ? "ratelimit_modify" : undefined,
      });
    }

    return {
      id: `plan-${this.name}-${Date.now()}`,
      provider: this.name,
      policyName: compiled.name,
      changes,
      warnings: changes.filter((change) => change.action === "unsupported").map((change) => change.summary),
      mutationCount: changes.filter((change) => change.action !== "noop" && change.action !== "unsupported").length,
      dryRunOnly: !caps.liveMutation,
    };
  }

  async diff(plan: ProviderPlan): Promise<string> {
    const lines = [`# ${plan.provider} provider plan`, "", `Policy: ${plan.policyName}`, ""];
    for (const change of plan.changes) {
      const icon = change.action === "unsupported" ? "!" : change.action === "noop" ? "=" : "~";
      lines.push(`${icon} ${change.resource}: ${change.summary}`);
    }
    if (plan.warnings.length) {
      lines.push("", "## Warnings", ...plan.warnings.map((warning) => `- ${warning}`));
    }
    return lines.join("\n");
  }

  async apply(plan: ProviderPlan, approval: ProviderApprovalReceipt): Promise<unknown> {
    const caps = this.capabilities();
    if (!caps.liveMutation || plan.dryRunOnly) {
      throw new Error(`provider_apply_not_enabled:${this.name}`);
    }
    if (!approval.approval_id) {
      throw new Error("approval_required");
    }
    throw new Error(`provider_apply_v2_not_wired:${this.name}`);
  }

  async verify(receipt: unknown): Promise<{ ok: boolean; errors: string[] }> {
    return receipt ? { ok: true, errors: [] } : { ok: false, errors: ["missing_receipt"] };
  }

  async rollback(receipt: unknown, approval: ProviderApprovalReceipt): Promise<unknown> {
    if (!approval.approval_id) throw new Error("approval_required");
    if (!receipt) throw new Error("missing_receipt");
    throw new Error(`provider_rollback_v2_not_wired:${this.name}`);
  }
}
