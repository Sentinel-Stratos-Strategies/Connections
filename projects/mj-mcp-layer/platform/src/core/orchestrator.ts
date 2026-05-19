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
import type { EvidenceEngine } from "./evidence-engine.js";
import { PolicyCompiler } from "./policy-compiler.js";
import { RollbackEngine } from "./rollback-engine.js";

interface OrchestratorOptions {
  evidenceEngine?: EvidenceEngine;
  requireRollbackTest?: boolean;
}

export class CrossProviderOrchestrator {
  private adapters: Map<ProviderName, ProviderAdapter>;
  private ledger: UniversalLedger;
  private options: OrchestratorOptions;

  constructor(
    adapters: Map<ProviderName, ProviderAdapter>,
    ledger: UniversalLedger,
    options: OrchestratorOptions = {},
  ) {
    this.adapters = adapters;
    this.ledger = ledger;
    this.options = options;
  }

  async applyPolicyToAllProviders(policy: SecurityPolicy): Promise<ExecutionReport> {
    const report: ExecutionReport = {
      timestamp: new Date().toISOString(),
      results: {},
      ledgerEntries: [],
    };

    const compiler = new PolicyCompiler();
    const rollbackEngine = new RollbackEngine(this.adapters, this.ledger);
    const firstAdapter = Array.from(this.adapters.values())[0];
    const baselineInventory = firstAdapter
      ? await firstAdapter.getInventory()
      : {
          provider: (policy.targetProviders[0] ?? "cloudflare") as ProviderName,
          timestamp: new Date().toISOString(),
          resources: {},
        };
    const plan = compiler.compilePolicy(
      {
        intent: `apply policy ${policy.name}`,
        tenant: "operator",
        risk_tolerance: "low",
        rollback_required: true,
        target_providers: policy.targetProviders,
      },
      policy,
      baselineInventory,
    );
    const rollbackTest = await rollbackEngine.testRecipe(plan.rollback_recipe, baselineInventory, baselineInventory);
    if (this.options.requireRollbackTest !== false && !rollbackTest.simulation_passed) {
      throw new Error(`Rollback test failed: ${rollbackTest.issues.join("; ")}`);
    }

    let evidenceBefore: typeof baselineInventory | undefined = baselineInventory;
    let evidenceAfter: typeof baselineInventory | undefined;

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
        if (providerName === baselineInventory.provider) {
          evidenceBefore = preInventory;
          evidenceAfter = postInventory;
        }

        const ledgerEntry: LedgerEntry = {
          ts: new Date().toISOString(),
          intent: "policy_apply",
          provider: providerName,
          hash: this.hashInventory(postInventory),
          changeId: changeRequest.id,
          source: "operator",
          payload: {
            policy: { name: policy.name, version: policy.version },
            preInventory,
            postInventory,
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

    if (this.options.evidenceEngine) {
      const bundle = this.options.evidenceEngine.createBundle({
        plan,
        inventoryBefore: evidenceBefore,
        inventoryAfter: evidenceAfter,
        executionReport: report,
        rollbackTested: rollbackTest.simulation_passed,
        ledgerEntries: report.ledgerEntries.map((entry) => this.ledger.sign(entry)),
      });
      this.options.evidenceEngine.persistBundle(bundle);
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
