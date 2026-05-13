import type { ProviderAdapter } from "./provider.interface.js";
import type {
  AccessValidation,
  ChangeRequest,
  HealthStatus,
  InventorySnapshot,
  LedgerEntry,
  SecurityPolicy,
} from "../core/types.js";
import { PolicyTranslator } from "../automation/policy-translator.js";

interface TerraformConfig {
  workingDir?: string;
  stateBackend?: string;
}

export class TerraformAdapter implements ProviderAdapter {
  readonly name = "terraform" as const;
  private config: TerraformConfig;
  private translator: PolicyTranslator;

  constructor(config: TerraformConfig) {
    this.config = config;
    this.translator = new PolicyTranslator();
  }

  async getInventory(): Promise<InventorySnapshot> {
    return {
      provider: "terraform",
      timestamp: new Date().toISOString(),
      resources: {
        workingDir: this.config.workingDir ?? ".",
        stateBackend: this.config.stateBackend ?? "local",
        note: "Terraform adapter: implement via terraform show -json for state inventory",
      },
      denyByDefault: false,
      rateLimit: { enabled: false },
    };
  }

  async applyPolicy(policy: SecurityPolicy): Promise<ChangeRequest> {
    const _tfCode = this.translator.translate(policy, "cloudflare", "terraform");
    throw new Error("terraform_apply_not_implemented");
  }

  async revertPolicy(version: string): Promise<ChangeRequest> {
    throw new Error(`terraform_revert_not_implemented:${version}`);
  }

  async validatePolicy(policy: SecurityPolicy): Promise<{ ok: boolean; errors: string[] }> {
    const errors: string[] = [];
    if (!policy.securityDefaults?.denyByDefault) {
      errors.push("deny_by_default recommended for Terraform-managed resources");
    }
    return { ok: errors.length === 0, errors };
  }

  async generateDiff(policy: SecurityPolicy): Promise<string> {
    return this.translator.translate(policy, "cloudflare", "terraform");
  }

  async healthCheck(): Promise<HealthStatus> {
    const start = Date.now();
    return {
      ok: false,
      latency: Date.now() - start,
      details: {
        workingDir: this.config.workingDir,
        error: "terraform_not_configured",
        note: "Implement terraform validate/plan checks before enabling Terraform mutations",
      },
    };
  }

  async validateAccess(): Promise<AccessValidation> {
    return {
      ok: false,
      permissions: [],
      errors: ["terraform_not_configured"],
    };
  }

  async getAuditLog(_since: Date): Promise<LedgerEntry[]> {
    return [];
  }

  async recordChange(entry: LedgerEntry): Promise<void> {
    console.log(`[terraform] ledger entry: ${entry.intent} ${entry.hash}`);
  }
}
