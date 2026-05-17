import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { ProviderAdapter } from "../src/adapters/provider.interface.js";
import { RollbackEngine } from "../src/core/rollback-engine.js";
import type { RollbackRecipe } from "../src/core/policy-compiler.js";
import type { UniversalLedger } from "../src/core/ledger.js";
import type { ChangeRequest, InventorySnapshot, LedgerEntry, SecurityPolicy } from "../src/core/types.js";

function sampleInventory(): InventorySnapshot {
  return {
    provider: "cloudflare",
    resources: {},
    timestamp: new Date().toISOString(),
  };
}

function sampleChangeRequest(): ChangeRequest {
  return {
    id: "cr-rollback",
    name: "rollback",
    targetProviders: ["cloudflare"],
    policy: {
      audit: { enabled: true, immutable: true, retention: "90 days" },
      name: "rollback-policy",
      policies: { rateLimit: { rules: [] }, waf: { rules: [] } },
      rbac: { tenants: [{ capabilities: ["mcp.admin"], id: "operator", rateLimit: "120/min" }] },
      securityDefaults: { denyByDefault: true, requiredHeaders: ["x-tenant-id"] },
      targetProviders: ["cloudflare"],
      version: 1,
      zones: [],
    },
    requester: "operator",
    status: "executed",
    createdAt: new Date().toISOString(),
  };
}

describe("rollback engine", () => {
  test("restore steps do not route through revertPolicy", async () => {
    let getInventoryCalls = 0;
    let revertCalls = 0;
    const recorded: LedgerEntry[] = [];

    const adapter: ProviderAdapter = {
      name: "cloudflare",
      async applyPolicy(_policy: SecurityPolicy): Promise<ChangeRequest> {
        throw new Error("not_implemented");
      },
      async generateDiff(_policy: SecurityPolicy): Promise<string> {
        return "";
      },
      async getAuditLog(_since: Date): Promise<LedgerEntry[]> {
        return [];
      },
      async getInventory(): Promise<InventorySnapshot> {
        getInventoryCalls += 1;
        return sampleInventory();
      },
      async healthCheck() {
        return { latency: 1, ok: true };
      },
      async recordChange(_entry: LedgerEntry): Promise<void> {
        return;
      },
      async revertPolicy(_version: string): Promise<ChangeRequest> {
        revertCalls += 1;
        return sampleChangeRequest();
      },
      async validateAccess() {
        return { ok: true, permissions: [] };
      },
      async validatePolicy(_policy: SecurityPolicy) {
        return { errors: [], ok: true };
      },
    };

    const recipe: RollbackRecipe = {
      estimated_duration_seconds: 20,
      steps: [
        {
          action: "restore",
          detail: "Restore inventory snapshot",
          order: 1,
          provider: "cloudflare",
          resource: "inventory:cloudflare",
        },
        {
          action: "verify",
          detail: "Verify endpoint health",
          order: 2,
          provider: "cloudflare",
          resource: "endpoints",
        },
      ],
      verification: ["Health check returns ok"],
    };

    const ledger = {
      async recordEntry(entry: LedgerEntry) {
        recorded.push(entry);
      },
    } as unknown as UniversalLedger;

    const engine = new RollbackEngine(new Map([["cloudflare", adapter]]), ledger);
    const result = await engine.executeRecipe(recipe, "test restore execution path");

    assert.equal(result.verification_passed, true);
    assert.equal(result.issues.length, 0);
    assert.equal(result.steps_completed, 2);
    assert.equal(revertCalls, 0);
    assert.equal(getInventoryCalls, 1);
    assert.equal(recorded.length, 1);
  });
});