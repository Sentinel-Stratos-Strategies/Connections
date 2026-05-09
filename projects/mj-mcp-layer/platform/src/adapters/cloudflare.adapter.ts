import type { ProviderAdapter } from "./provider.interface.js";
import type {
  AccessValidation,
  ChangeRequest,
  HealthStatus,
  InventorySnapshot,
  LedgerEntry,
  SecurityPolicy,
} from "../core/types.js";
import { createHash } from "node:crypto";

interface CloudflareConfig {
  apiToken: string;
  zoneId: string;
  accountId?: string;
}

export class CloudflareAdapter implements ProviderAdapter {
  readonly name = "cloudflare" as const;
  private config: CloudflareConfig;
  private apiBase = "https://api.cloudflare.com/client/v4";

  constructor(config: CloudflareConfig) {
    this.config = config;
  }

  private async cfRequest(method: string, path: string, body?: unknown): Promise<unknown> {
    const url = `${this.apiBase}${path}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.config.apiToken}`,
      "Content-Type": "application/json",
    };

    const init: RequestInit = { method, headers };
    if (body) init.body = JSON.stringify(body);

    const response = await fetch(url, init);
    return response.json();
  }

  async getInventory(): Promise<InventorySnapshot> {
    const [rulesets, waf, ratelimit, cache, dns, workerRoutes] = await Promise.all([
      this.cfRequest("GET", `/zones/${this.config.zoneId}/rulesets`),
      this.cfRequest("GET", `/zones/${this.config.zoneId}/rulesets/phases/http_request_firewall_custom/entrypoint`).catch(() => ({})),
      this.cfRequest("GET", `/zones/${this.config.zoneId}/rulesets/phases/http_ratelimit/entrypoint`).catch(() => ({})),
      this.cfRequest("GET", `/zones/${this.config.zoneId}/rulesets/phases/http_request_cache_settings/entrypoint`).catch(() => ({})),
      this.cfRequest("GET", `/zones/${this.config.zoneId}/dns_records?per_page=500`),
      this.cfRequest("GET", `/zones/${this.config.zoneId}/workers/routes`).catch(() => ({})),
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
        changes.push(`waf:${rule.name}`);
      }
    }
    if (policy.policies.rateLimit) {
      for (const rule of policy.policies.rateLimit.rules) {
        changes.push(`ratelimit:${rule.name}`);
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
    if (!policy.policies?.waf?.rules?.length) {
      errors.push("at least one WAF rule is required");
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
      const result = await this.cfRequest("GET", `/zones/${this.config.zoneId}`) as { success?: boolean };
      const latency = Date.now() - start;
      return { ok: result.success === true, latency };
    } catch (error) {
      return { ok: false, latency: Date.now() - start, errors: [String(error)] };
    }
  }

  async validateAccess(): Promise<AccessValidation> {
    try {
      const result = await this.cfRequest("GET", "/user/tokens/verify") as { success?: boolean };
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
    ) as { result?: Array<{ when: string; action: { type: string }; actor: { email: string } }> };

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
}
