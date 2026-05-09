import type { ProviderAdapter } from "./provider.interface.js";
import type {
  AccessValidation,
  ChangeRequest,
  HealthStatus,
  InventorySnapshot,
  LedgerEntry,
  SecurityPolicy,
} from "../core/types.js";

interface AWSConfig {
  region: string;
  accessKeyId?: string;
  secretAccessKey?: string;
}

export class AWSAdapter implements ProviderAdapter {
  readonly name = "aws" as const;
  private config: AWSConfig;

  constructor(config: AWSConfig) {
    this.config = config;
  }

  async getInventory(): Promise<InventorySnapshot> {
    return {
      provider: "aws",
      timestamp: new Date().toISOString(),
      resources: {
        region: this.config.region,
        note: "AWS adapter: implement via AWS SDK — WAFv2, SecurityGroups, NACLs, VPCFlowLogs",
      },
      denyByDefault: false,
      rateLimit: { enabled: false },
    };
  }

  async applyPolicy(policy: SecurityPolicy): Promise<ChangeRequest> {
    return {
      id: crypto.randomUUID(),
      name: policy.name,
      targetProviders: ["aws"],
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
      targetProviders: ["aws"],
      policy: {} as SecurityPolicy,
      requester: "automation",
      status: "executed",
      createdAt: new Date().toISOString(),
    };
  }

  async validatePolicy(policy: SecurityPolicy): Promise<{ ok: boolean; errors: string[] }> {
    const errors: string[] = [];
    if (!policy.securityDefaults?.denyByDefault) {
      errors.push("deny_by_default should be enabled for AWS");
    }
    return { ok: errors.length === 0, errors };
  }

  async generateDiff(policy: SecurityPolicy): Promise<string> {
    return `# AWS Policy Diff\nDesired WAF rules: ${policy.policies.waf.rules.length}\nRegion: ${this.config.region}`;
  }

  async healthCheck(): Promise<HealthStatus> {
    const start = Date.now();
    return {
      ok: true,
      latency: Date.now() - start,
      details: { region: this.config.region, note: "Stub — implement STS GetCallerIdentity check" },
    };
  }

  async validateAccess(): Promise<AccessValidation> {
    return { ok: true, permissions: ["stub"] };
  }

  async getAuditLog(_since: Date): Promise<LedgerEntry[]> {
    return [];
  }

  async recordChange(entry: LedgerEntry): Promise<void> {
    console.log(`[aws] ledger entry: ${entry.intent} ${entry.hash}`);
  }
}
