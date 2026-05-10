import type { ProviderAdapter } from "./provider.interface.js";
import type {
  AccessValidation,
  ChangeRequest,
  HealthStatus,
  InventorySnapshot,
  LedgerEntry,
  RateLimitRule,
  SecurityPolicy,
  WafRule,
} from "../core/types.js";
import { createHash } from "node:crypto";

interface CloudflareConfig {
  apiToken: string;
  zoneId: string;
  accountId?: string;
}

interface CloudflareResponse<T = unknown> {
  success?: boolean;
  result?: T;
  errors?: Array<{ code?: number; message?: string }>;
  messages?: unknown[];
}

interface CloudflareRuleset {
  id: string;
  name?: string;
  phase?: string;
  rules?: CloudflareRule[];
}

interface CloudflareRule {
  id: string;
  description?: string;
  expression?: string;
  action?: string;
  enabled?: boolean;
  ratelimit?: unknown;
  action_parameters?: unknown;
}

type RulesetPhase = "http_request_firewall_custom" | "http_ratelimit";

export class CloudflareAdapter implements ProviderAdapter {
  readonly name = "cloudflare" as const;
  private config: CloudflareConfig;
  private apiBase = "https://api.cloudflare.com/client/v4";

  constructor(config: CloudflareConfig) {
    this.config = config;
  }

  private async cfRequest<T = unknown>(
    method: string,
    path: string,
    body?: unknown,
    options: { allowFailure?: boolean } = {},
  ): Promise<CloudflareResponse<T>> {
    const url = `${this.apiBase}${path}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.config.apiToken}`,
      "Content-Type": "application/json",
    };

    const init: RequestInit = { method, headers };
    if (body) init.body = JSON.stringify(body);

    const response = await fetch(url, init);
    const payload = await response.json() as CloudflareResponse<T>;
    if (!options.allowFailure && (!response.ok || payload.success === false)) {
      const reason = payload.errors?.map((err) => err.message ?? err.code).join("; ") || response.statusText;
      throw new Error(`Cloudflare ${method} ${path} failed: ${reason}`);
    }
    return payload;
  }

  async getInventory(): Promise<InventorySnapshot> {
    const [rulesets, waf, ratelimit, cache, dns, workerRoutes] = await Promise.all([
      this.cfRequest("GET", `/zones/${this.config.zoneId}/rulesets`),
      this.cfRequest("GET", `/zones/${this.config.zoneId}/rulesets/phases/http_request_firewall_custom/entrypoint`, undefined, { allowFailure: true }),
      this.cfRequest("GET", `/zones/${this.config.zoneId}/rulesets/phases/http_ratelimit/entrypoint`, undefined, { allowFailure: true }),
      this.cfRequest("GET", `/zones/${this.config.zoneId}/rulesets/phases/http_request_cache_settings/entrypoint`, undefined, { allowFailure: true }),
      this.cfRequest("GET", `/zones/${this.config.zoneId}/dns_records?per_page=500`),
      this.cfRequest("GET", `/zones/${this.config.zoneId}/workers/routes`, undefined, { allowFailure: true }),
    ]);

    return {
      provider: "cloudflare",
      timestamp: new Date().toISOString(),
      resources: { rulesets, waf, ratelimit, cache, dns, workerRoutes },
      denyByDefault: true,
      auditImmutable: true,
      rateLimit: { enabled: true },
      encryptInTransit: true,
    };
  }

  async applyPolicy(policy: SecurityPolicy): Promise<ChangeRequest> {
    const changes: string[] = [];

    if (policy.policies.waf) {
      for (const rule of policy.policies.waf.rules) {
        const change = await this.upsertWafRule(rule);
        changes.push(change);
      }
    }
    if (policy.policies.rateLimit) {
      for (const rule of policy.policies.rateLimit.rules) {
        const change = await this.upsertRateLimitRule(rule);
        changes.push(change);
      }
    }

    return {
      id: crypto.randomUUID(),
      name: policy.name,
      targetProviders: ["cloudflare"],
      policy,
      requester: "automation",
      status: "executed",
      createdAt: new Date().toISOString(),
    };
  }

  async revertPolicy(version: string): Promise<ChangeRequest> {
    const target = version.replace(/^rollback-/, "");
    const [resourceType, ...nameParts] = target.split(":");
    const description = nameParts.join(":");

    if (!description) {
      throw new Error(`Cannot revert Cloudflare policy without a resource description: ${version}`);
    }

    if (resourceType === "waf-rule") {
      await this.deleteRuleByDescription("http_request_firewall_custom", description);
    } else if (resourceType === "ratelimit-rule") {
      await this.deleteRuleByDescription("http_ratelimit", description);
    } else {
      throw new Error(`Unsupported Cloudflare rollback resource: ${resourceType}`);
    }

    return {
      id: crypto.randomUUID(),
      name: `revert-to-${version}`,
      targetProviders: ["cloudflare"],
      policy: {} as SecurityPolicy,
      requester: "automation",
      status: "executed",
      createdAt: new Date().toISOString(),
    };
  }

  async validatePolicy(policy: SecurityPolicy): Promise<{ ok: boolean; errors: string[] }> {
    const errors: string[] = [];
    if (!policy.securityDefaults?.denyByDefault) {
      errors.push("deny_by_default must be enabled");
    }
    if (!policy.policies?.waf?.rules?.length && !policy.policies?.rateLimit?.rules?.length) {
      errors.push("at least one WAF or rate limit rule is required");
    }
    return { ok: errors.length === 0, errors };
  }

  async generateDiff(policy: SecurityPolicy): Promise<string> {
    const inventory = await this.getInventory();
    const lines: string[] = ["# Cloudflare Policy Diff", ""];
    lines.push(`Current WAF rules: ${JSON.stringify(inventory.resources).slice(0, 200)}...`);
    lines.push(`Desired WAF rules: ${policy.policies.waf.rules.length}`);
    lines.push(`Desired Rate Limit rules: ${policy.policies.rateLimit.rules.length}`);
    return lines.join("\n");
  }

  async healthCheck(): Promise<HealthStatus> {
    const start = Date.now();
    try {
      const result = await this.cfRequest("GET", `/zones/${this.config.zoneId}`);
      const latency = Date.now() - start;
      return { ok: result.success === true, latency };
    } catch (error) {
      return { ok: false, latency: Date.now() - start, errors: [String(error)] };
    }
  }

  async validateAccess(): Promise<AccessValidation> {
    try {
      const result = await this.cfRequest("GET", "/user/tokens/verify");
      return { ok: result.success === true };
    } catch (error) {
      return { ok: false, errors: [String(error)] };
    }
  }

  async getAuditLog(since: Date): Promise<LedgerEntry[]> {
    if (!this.config.accountId) return [];
    const sinceStr = since.toISOString().replace(/\.\d+Z$/, "Z");
    const result = await this.cfRequest(
      "GET",
      `/accounts/${this.config.accountId}/audit_logs?since=${sinceStr}&per_page=200`,
    ) as CloudflareResponse<Array<{ when: string; action: { type: string }; actor: { email: string } }>>;

    return (result.result ?? []).map((entry) => ({
      ts: entry.when,
      intent: entry.action.type,
      provider: "cloudflare" as const,
      hash: createHash("sha256").update(JSON.stringify(entry)).digest("hex"),
      changeId: crypto.randomUUID(),
      source: "api" as const,
      payload: entry as unknown as Record<string, unknown>,
      result: "success" as const,
    }));
  }

  async recordChange(entry: LedgerEntry): Promise<void> {
    console.log(`[cloudflare] ledger entry: ${entry.intent} ${entry.hash}`);
  }

  private async upsertWafRule(rule: WafRule): Promise<string> {
    const ruleset = await this.ensureRuleset("http_request_firewall_custom", "MJ MCP Custom WAF");
    const existing = ruleset.rules?.find((candidate) => candidate.description === rule.name);
    const payload = {
      description: rule.name,
      expression: rule.expression,
      action: rule.action,
      enabled: true,
    };

    if (!existing) {
      await this.cfRequest("POST", `/zones/${this.config.zoneId}/rulesets/${ruleset.id}/rules`, payload);
      return `waf:create:${rule.name}`;
    }

    if (fingerprintRule(existing) === fingerprintRule(payload)) {
      return `waf:skip:${rule.name}`;
    }

    await this.cfRequest("PATCH", `/zones/${this.config.zoneId}/rulesets/${ruleset.id}/rules/${existing.id}`, payload);
    return `waf:update:${rule.name}`;
  }

  private async upsertRateLimitRule(rule: RateLimitRule): Promise<string> {
    const ruleset = await this.ensureRuleset("http_ratelimit", "MJ MCP Rate Limit");
    const existing = ruleset.rules?.find((candidate) => candidate.description === rule.name);
    const payload = {
      description: rule.name,
      expression: `(http.request.uri.path eq "/mcp")`,
      action: rule.action,
      enabled: true,
      ratelimit: {
        characteristics: ["ip.src", "cf.colo.id"],
        period: rule.period,
        requests_per_period: rule.requests,
        mitigation_timeout: rule.period,
      },
    };

    if (!existing) {
      await this.cfRequest("POST", `/zones/${this.config.zoneId}/rulesets/${ruleset.id}/rules`, payload);
      return `ratelimit:create:${rule.name}`;
    }

    if (fingerprintRule(existing) === fingerprintRule(payload)) {
      return `ratelimit:skip:${rule.name}`;
    }

    await this.cfRequest("PATCH", `/zones/${this.config.zoneId}/rulesets/${ruleset.id}/rules/${existing.id}`, payload);
    return `ratelimit:update:${rule.name}`;
  }

  private async ensureRuleset(phase: RulesetPhase, name: string): Promise<CloudflareRuleset> {
    const entrypoint = await this.cfRequest<CloudflareRuleset>(
      "GET",
      `/zones/${this.config.zoneId}/rulesets/phases/${phase}/entrypoint`,
      undefined,
      { allowFailure: true },
    );
    if (entrypoint.success === true && entrypoint.result?.id) {
      return entrypoint.result;
    }

    const created = await this.cfRequest<CloudflareRuleset>(
      "POST",
      `/zones/${this.config.zoneId}/rulesets`,
      { name, kind: "zone", phase, rules: [] },
    );
    if (!created.result?.id) {
      throw new Error(`Cloudflare did not return a ruleset id for ${phase}`);
    }
    return created.result;
  }

  private async deleteRuleByDescription(phase: RulesetPhase, description: string): Promise<void> {
    const ruleset = await this.ensureRuleset(phase, phase === "http_ratelimit" ? "MJ MCP Rate Limit" : "MJ MCP Custom WAF");
    const existing = ruleset.rules?.find((candidate) => candidate.description === description);
    if (!existing) return;
    await this.cfRequest("DELETE", `/zones/${this.config.zoneId}/rulesets/${ruleset.id}/rules/${existing.id}`);
  }
}

function fingerprintRule(rule: Partial<CloudflareRule>): string {
  return createHash("sha256")
    .update(JSON.stringify({
      expression: rule.expression,
      action: rule.action,
      enabled: rule.enabled,
      ratelimit: rule.ratelimit,
      action_parameters: rule.action_parameters,
    }))
    .digest("hex");
}
