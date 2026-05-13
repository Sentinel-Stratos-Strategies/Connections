import type { ProviderAdapter } from "./provider.interface.js";
import type {
  AccessValidation,
  ChangeRequest,
  HealthStatus,
  InventorySnapshot,
  LedgerEntry,
  SecurityPolicy,
} from "../core/types.js";

interface KubernetesConfig {
  cluster: string;
  kubeconfig?: string;
  namespace?: string;
}

export class KubernetesAdapter implements ProviderAdapter {
  readonly name = "kubernetes" as const;
  private config: KubernetesConfig;

  constructor(config: KubernetesConfig) {
    this.config = config;
  }

  async getInventory(): Promise<InventorySnapshot> {
    return {
      provider: "kubernetes",
      timestamp: new Date().toISOString(),
      resources: {
        cluster: this.config.cluster,
        namespace: this.config.namespace ?? "default",
        note: "Kubernetes adapter: implement via kubectl/API — NetworkPolicies, RBAC, PodSecurityPolicies, Ingress",
      },
      denyByDefault: false,
      rateLimit: { enabled: false },
    };
  }

  async applyPolicy(policy: SecurityPolicy): Promise<ChangeRequest> {
    throw new Error("kubernetes_apply_not_implemented");
  }

  async revertPolicy(version: string): Promise<ChangeRequest> {
    throw new Error(`kubernetes_revert_not_implemented:${version}`);
  }

  async validatePolicy(policy: SecurityPolicy): Promise<{ ok: boolean; errors: string[] }> {
    const errors: string[] = [];
    if (!policy.securityDefaults?.denyByDefault) {
      errors.push("deny_by_default recommended for Kubernetes NetworkPolicies");
    }
    return { ok: errors.length === 0, errors };
  }

  async generateDiff(policy: SecurityPolicy): Promise<string> {
    return `# Kubernetes Policy Diff\nCluster: ${this.config.cluster}\nDesired rules: ${policy.policies.waf.rules.length}`;
  }

  async healthCheck(): Promise<HealthStatus> {
    const start = Date.now();
    return {
      ok: false,
      latency: Date.now() - start,
      details: { cluster: this.config.cluster, error: "kubernetes_not_configured", note: "Implement cluster API validation before enabling Kubernetes mutations" },
    };
  }

  async validateAccess(): Promise<AccessValidation> {
    return {
      ok: false,
      permissions: [],
      errors: ["kubernetes_not_configured"],
    };
  }

  async getAuditLog(_since: Date): Promise<LedgerEntry[]> {
    return [];
  }

  async recordChange(entry: LedgerEntry): Promise<void> {
    console.log(`[kubernetes] ledger entry: ${entry.intent} ${entry.hash}`);
  }
}
