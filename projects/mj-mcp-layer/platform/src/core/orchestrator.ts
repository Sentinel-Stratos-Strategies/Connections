import { createHash } from "node:crypto";
import type { ProviderAdapter } from "../adapters/provider.interface.js";
import type {
  DriftReport,
  ExecutionReport,
  LedgerEntry,
  ProviderName,
  SecurityPolicy,
} from "./types.js";
import type { UniversalLedger } from "./ledger.js";

export class CrossProviderOrchestrator {
  private adapters: Map<ProviderName, ProviderAdapter>;
  private ledger: UniversalLedger;

  constructor(
    adapters: Map<ProviderName, ProviderAdapter>,
    ledger: UniversalLedger,
  ) {
    this.adapters = adapters;
    this.ledger = ledger;
  }

  async applyPolicyToAllProviders(policy: SecurityPolicy): Promise<ExecutionReport> {
    const report: ExecutionReport = {
      timestamp: new Date().toISOString(),
      results: {},
      ledgerEntries: [],
    };

    for (const [providerName, adapter] of this.adapters) {
      if (!policy.targetProviders.includes(providerName)) continue;

      try {
        const validation = await adapter.validatePolicy(policy);
        if (!validation.ok) {
          report.results[providerName] = {
            status: "failed",
            reason: validation.errors.join("; "),
          };
          continue;
        }

        const preInventory = await adapter.getInventory();
        const changeRequest = await adapter.applyPolicy(policy);
        const postInventory = await adapter.getInventory();

        const ledgerEntry: LedgerEntry = {
          ts: new Date().toISOString(),
          intent: "policy_apply",
          provider: providerName,
          hash: this.hashInventory(postInventory),
          changeId: changeRequest.id,
          source: "operator",
          payload: {
            policy: { name: policy.name, version: policy.version },
            preInventory: { timestamp: preInventory.timestamp },
            postInventory: { timestamp: postInventory.timestamp },
          },
          result: "success",
        };

        await this.ledger.recordEntry(ledgerEntry);
        report.ledgerEntries.push(ledgerEntry);

        report.results[providerName] = {
          status: "success",
          changeId: changeRequest.id,
        };
      } catch (error) {
        const ledgerEntry: LedgerEntry = {
          ts: new Date().toISOString(),
          intent: "policy_apply",
          provider: providerName,
          hash: "N/A",
          changeId: "N/A",
          source: "operator",
          payload: { policy: { name: policy.name } },
          result: "failure",
          error: String(error),
        };

        await this.ledger.recordEntry(ledgerEntry);
        report.results[providerName] = {
          status: "failed",
          reason: String(error),
        };
      }
    }

    return report;
  }

  async detectDriftAcrossProviders(): Promise<DriftReport[]> {
    const sixHoursAgo = new Date(Date.now() - 6 * 3600 * 1000);
    return Promise.all(
      Array.from(this.adapters.keys()).map((provider) =>
        this.ledger.getDrift(provider, sixHoursAgo),
      ),
    );
  }

  private hashInventory(inventory: unknown): string {
    return createHash("sha256")
      .update(JSON.stringify(inventory))
      .digest("hex");
  }
}
