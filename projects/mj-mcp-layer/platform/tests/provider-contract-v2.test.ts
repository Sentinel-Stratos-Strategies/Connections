import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { AWSAdapter } from "../src/adapters/aws.adapter.js";
import { CloudflareAdapter } from "../src/adapters/cloudflare.adapter.js";
import { ProviderV2Facade, capabilitiesForProvider } from "../src/adapters/provider-contract-v2.js";
import type { SecurityPolicy } from "../src/core/types.js";

const samplePolicy: SecurityPolicy = {
  audit: { enabled: true, immutable: true, retention: "90 days" },
  name: "test-policy",
  policies: {
    rateLimit: {
      rules: [
        { action: "block", name: "mcp-burst", period: 60, requests: 100 },
      ],
    },
    waf: {
      rules: [
        {
          action: "block",
          expression: '(http.request.uri.path eq "/mcp")',
          name: "block-mcp",
        },
      ],
    },
  },
  rbac: { tenants: [{ capabilities: ["mcp.admin"], id: "operator", rateLimit: "120/min" }] },
  securityDefaults: { denyByDefault: true, requiredHeaders: ["x-tenant-id"] },
  targetProviders: ["cloudflare", "aws"],
  version: 1,
  zones: [],
};

describe("provider contract v2", () => {
  test("Cloudflare declares live mutation capabilities", () => {
    const caps = capabilitiesForProvider("cloudflare");
    assert.equal(caps.liveMutation, true);
    assert.equal(caps.waf, true);
    assert.equal(caps.rateLimit, true);
    assert.equal(caps.dryRun, true);
  });

  test("preview providers cannot claim live mutation support", () => {
    const caps = capabilitiesForProvider("aws");
    assert.equal(caps.liveMutation, false);
    assert.equal(caps.apply, false);
    assert.equal(caps.dryRun, true);
  });

  test("Google remains dry-run only until real API mutation receipts exist", async () => {
    const caps = capabilitiesForProvider("google");
    assert.equal(caps.liveMutation, false);
    assert.equal(caps.apply, false);
    assert.equal(caps.revert, false);
    assert.equal(caps.dryRun, true);

    const facade = new ProviderV2Facade({
      name: "google",
      async getInventory() { throw new Error("not used"); },
      async applyPolicy() { throw new Error("google_apply_not_implemented"); },
      async revertPolicy() { throw new Error("google_revert_not_implemented"); },
      async validatePolicy() { return { ok: true, errors: [] }; },
      async generateDiff() { return "google dry-run"; },
      async healthCheck() { return { ok: true, latency: 0 }; },
      async validateAccess() { return { ok: true, permissions: [] }; },
      async getAuditLog() { return []; },
      async recordChange() {},
    });
    const plan = await facade.plan({ ...samplePolicy, targetProviders: ["google"] as const } as SecurityPolicy);
    assert.equal(plan.dryRunOnly, true);
    assert.equal(plan.mutationCount, 0);
    await assert.rejects(
      () => facade.apply(plan, {
        approval_id: "approval-1",
        approved_at: new Date().toISOString(),
        approved_by: "operator",
        scope: "test",
      }),
      /provider_apply_not_enabled:google/,
    );
  });

  test("Cloudflare facade produces approval-requiring provider plan", async () => {
    const adapter = new CloudflareAdapter({ apiToken: "test", zoneId: "zone" });
    const facade = new ProviderV2Facade(adapter);
    const plan = await facade.plan(samplePolicy);

    assert.equal(plan.provider, "cloudflare");
    assert.equal(plan.dryRunOnly, false);
    assert.equal(plan.mutationCount, 2);
    assert.equal(plan.changes.every((change) => change.requiresApproval), true);
    assert.deepEqual(plan.changes.map((change) => change.budgetCategory), ["waf_modify", "ratelimit_modify"]);

    const diff = await facade.diff(plan);
    assert.match(diff, /Cloudflare|cloudflare/i);
    assert.match(diff, /waf-rule:block-mcp/);
  });

  test("preview facade plans unsupported changes without enabling apply", async () => {
    const adapter = new AWSAdapter({ region: "us-east-1" });
    const facade = new ProviderV2Facade(adapter);
    const policy = { ...samplePolicy, targetProviders: ["aws"] as const } as SecurityPolicy;
    const plan = await facade.plan(policy);

    assert.equal(plan.provider, "aws");
    assert.equal(plan.dryRunOnly, true);
    assert.equal(plan.mutationCount, 0);
    assert.ok(plan.warnings.length >= 1);
    assert.equal(plan.changes.every((change) => change.action === "unsupported"), true);

    await assert.rejects(
      () => facade.apply(plan, {
        approval_id: "approval-1",
        approved_at: new Date().toISOString(),
        approved_by: "operator",
        scope: "test",
      }),
      /provider_apply_not_enabled:aws/,
    );
  });

  test("facade rejects invalid policy before planning", async () => {
    const adapter = new CloudflareAdapter({ apiToken: "test", zoneId: "zone" });
    const facade = new ProviderV2Facade(adapter);
    const invalid = {
      ...samplePolicy,
      securityDefaults: { denyByDefault: false, requiredHeaders: [] },
    } as SecurityPolicy;

    await assert.rejects(() => facade.plan(invalid), /provider_policy_invalid:cloudflare/);
  });
});
