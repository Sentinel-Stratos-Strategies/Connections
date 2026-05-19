import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { AWSAdapter } from "../src/adapters/aws.adapter.js";
import { GoogleAdapter } from "../src/adapters/google.adapter.js";
import { KubernetesAdapter } from "../src/adapters/kubernetes.adapter.js";
import { TerraformAdapter } from "../src/adapters/terraform.adapter.js";
import type { SecurityPolicy } from "../src/core/types.js";

const samplePolicy: SecurityPolicy = {
  audit: { enabled: true, immutable: true, retention: "90 days" },
  name: "test-policy",
  policies: {
    rateLimit: { rules: [] },
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
  targetProviders: ["aws", "kubernetes", "terraform"],
  version: 1,
  zones: [],
};

describe("preview provider adapters", () => {
  test("non-Cloudflare provider scaffolds do not report executed policy changes", async () => {
    const adapters = [
      new AWSAdapter({ region: "us-east-1" }),
      new GoogleAdapter({}),
      new KubernetesAdapter({ cluster: "dev" }),
      new TerraformAdapter({ workingDir: "." }),
    ];

    for (const adapter of adapters) {
      await assert.rejects(
        () => adapter.applyPolicy(samplePolicy),
        /not_implemented/,
        `${adapter.name} must not claim a real provider mutation`,
      );
    }
  });

  test("non-Cloudflare provider scaffolds report access as not configured", async () => {
    const adapters = [
      new AWSAdapter({ region: "us-east-1" }),
      new KubernetesAdapter({ cluster: "dev" }),
      new TerraformAdapter({ workingDir: "." }),
    ];

    for (const adapter of adapters) {
      const access = await adapter.validateAccess();
      assert.equal(access.ok, false, `${adapter.name} access should not be reported as live`);
      assert.match(access.errors?.join("\n") ?? "", /not_configured|not_implemented/);
    }
  });
});
