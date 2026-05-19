import type { ProviderAdapter } from "./provider.interface.js";
import type {
  AccessValidation,
  ChangeRequest,
  HealthStatus,
  InventorySnapshot,
  LedgerEntry,
  SecurityPolicy,
} from "../core/types.js";

interface GoogleCredentials {
  client_email: string;
  private_key: string;
  project_id: string;
}

interface GoogleConfig {
  personalCredentials?: GoogleCredentials;
  adminCredentials?: GoogleCredentials;
}

export class GoogleAdapter implements ProviderAdapter {
  readonly name = "google" as const;
  private config: GoogleConfig;

  constructor(config: GoogleConfig) {
    this.config = config;
  }

  async getInventory(): Promise<InventorySnapshot> {
    // In a real implementation, this would fetch from GCP Resource Manager, IAM, and Workspace APIs
    return {
      provider: "google",
      timestamp: new Date().toISOString(),
      resources: {
        personalProject: this.config.personalCredentials?.project_id || "not_configured",
        adminProject: this.config.adminCredentials?.project_id || "not_configured",
        note: "Real-time inventory requires active service account tokens",
      },
      denyByDefault: true,
      auditImmutable: true,
      rateLimit: { enabled: false }, // Handled by GCP quotas
      encryptInTransit: true,
    };
  }

  async applyPolicy(policy: SecurityPolicy): Promise<ChangeRequest> {
    throw new Error(`google_apply_not_implemented:${policy.name}`);
  }

  async revertPolicy(version: string): Promise<ChangeRequest> {
    throw new Error(`google_revert_not_implemented:${version}`);
  }

  async validatePolicy(policy: SecurityPolicy): Promise<{ ok: boolean; errors: string[] }> {
    const errors: string[] = [];
    if (!policy.securityDefaults?.denyByDefault) {
      errors.push("deny_by_default must be enabled");
    }
    return { ok: errors.length === 0, errors };
  }

  async generateDiff(policy: SecurityPolicy): Promise<string> {
    return `# Google Policy Diff\nDesired: ${policy.name}\nCurrent: active_inventory_snapshot`;
  }

  async healthCheck(): Promise<HealthStatus> {
    const start = Date.now();
    const hasPersonal = Boolean(this.config.personalCredentials);
    const hasAdmin = Boolean(this.config.adminCredentials);
    
    return {
      ok: hasPersonal || hasAdmin,
      latency: Date.now() - start,
      errors: !hasPersonal && !hasAdmin ? ["No Google credentials configured"] : undefined,
    };
  }

  async validateAccess(): Promise<AccessValidation> {
    const errors: string[] = [];
    if (!this.config.personalCredentials) errors.push("Personal credentials missing");
    if (!this.config.adminCredentials) errors.push("Admin credentials missing");
    
    return {
      ok: errors.length < 2, // OK if at least one is configured
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  async getAuditLog(since: Date): Promise<LedgerEntry[]> {
    // Would fetch from Cloud Logging
    return [];
  }

  async recordChange(entry: LedgerEntry): Promise<void> {
    console.log(`[google] ledger entry: ${entry.intent} ${entry.hash}`);
  }
}
