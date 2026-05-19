import { createHash } from "node:crypto";
import type { ProviderAdapter } from "../adapters/provider.interface.js";
import type { PolicyTranslator } from "../automation/policy-translator.js";
import type {
  InventorySnapshot,
  ProviderName,
  SecurityPolicy,
  WafRule,
  RateLimitRule,
} from "./types.js";

export interface IntentRequest {
  intent: string;
  tenant: string;
  risk_tolerance: "low" | "medium" | "high";
  rollback_required: boolean;
  target_providers?: ProviderName[];
  metadata?: Record<string, unknown>;
}

export interface BlastRadius {
  tenants_affected: string[];
  endpoints_affected: string[];
  providers_affected: ProviderName[];
  estimated_risk: "low" | "medium" | "high" | "critical";
  max_users_impacted: string;
  reversible: boolean;
}

export interface TestCase {
  name: string;
  description: string;
  request: MockRequest;
  expected_outcome: "block" | "allow" | "challenge" | "skip";
}

export interface MockRequest {
  method: string;
  path: string;
  headers: Record<string, string>;
  repeat?: number;
}

export interface RollbackStep {
  order: number;
  provider: ProviderName;
  action: "remove" | "restore" | "invalidate" | "verify";
  resource: string;
  detail: string;
}

export interface RollbackRecipe {
  steps: RollbackStep[];
  verification: string[];
  estimated_duration_seconds: number;
}

export interface CompiledPlan {
  id: string;
  intent: IntentRequest;
  timestamp: string;
  policy: SecurityPolicy;
  policy_diff: string;
  provider_plans: Record<ProviderName, string>;
  blast_radius: BlastRadius;
  test_cases: TestCase[];
  rollback_recipe: RollbackRecipe;
  evidence_requirements: string[];
  approval_path: "auto" | "operator" | "court";
}

interface IntentTemplate {
  pattern: RegExp;
  generate: (intent: IntentRequest, match: RegExpMatchArray) => Partial<SecurityPolicy>;
}

const INTENT_TEMPLATES: IntentTemplate[] = [
  {
    pattern: /protect\s+(\S+)\s+from\s+unauthenticated/i,
    generate: (_intent, match) => ({
      policies: {
        waf: {
          rules: [{
            name: `block-unauth-${sanitize(match[1])}`,
            expression: `(http.request.uri.path eq "${match[1]}" and not any(http.request.headers["authorization"][*] ne ""))`,
            action: "block",
          }],
        },
        rateLimit: { rules: [] },
      },
    }),
  },
  {
    pattern: /rate[- ]?limit\s+(\S+)\s+to\s+(\d+)\s+per\s+(minute|hour|second)/i,
    generate: (_intent, match) => {
      const periodMap: Record<string, number> = { second: 1, minute: 60, hour: 3600 };
      return {
        policies: {
          waf: { rules: [] },
          rateLimit: {
            rules: [{
              name: `ratelimit-${sanitize(match[1])}`,
              requests: parseInt(match[2]),
              period: periodMap[match[3]] ?? 60,
              action: "challenge",
            }],
          },
        },
      };
    },
  },
  {
    pattern: /block\s+(GET|POST|PUT|DELETE|PATCH)\s+on\s+(\S+)/i,
    generate: (_intent, match) => ({
      policies: {
        waf: {
          rules: [{
            name: `block-${match[1].toLowerCase()}-${sanitize(match[2])}`,
            expression: `(http.request.uri.path eq "${match[2]}" and http.request.method eq "${match[1].toUpperCase()}")`,
            action: "block",
          }],
        },
        rateLimit: { rules: [] },
      },
    }),
  },
  {
    pattern: /deny\s+all\s+except\s+tenant\s+(\S+)/i,
    generate: (_intent, match) => ({
      policies: {
        waf: {
          rules: [{
            name: `deny-except-${sanitize(match[1])}`,
            expression: `(not any(http.request.headers["x-tenant-id"][*] eq "${match[1]}"))`,
            action: "block",
          }],
        },
        rateLimit: { rules: [] },
      },
    }),
  },
  {
    pattern: /add\s+waf\s+rule\s+(.+)/i,
    generate: (_intent, match) => ({
      policies: {
        waf: {
          rules: [{
            name: `custom-waf-${sanitize(match[1]).slice(0, 40)}`,
            expression: match[1],
            action: "block",
          }],
        },
        rateLimit: { rules: [] },
      },
    }),
  },
];

export class PolicyCompiler {
  private translator?: PolicyTranslator;

  constructor(translator?: PolicyTranslator) {
    this.translator = translator;
  }

  compile(
    intent: IntentRequest,
    currentInventory: InventorySnapshot,
    adapters: Map<ProviderName, ProviderAdapter>,
  ): CompiledPlan {
    const id = createHash("sha256")
      .update(JSON.stringify(intent) + Date.now())
      .digest("hex")
      .slice(0, 16);

    const policy = this.intentToPolicy(intent);
    const providerPlans = this.generateProviderPlans(policy);
    const blastRadius = this.estimateBlastRadius(intent, policy, currentInventory);
    const testCases = this.generateTestCases(policy);
    const rollbackRecipe = this.generateRollbackRecipe(policy, currentInventory);
    const evidenceRequirements = this.determineEvidenceRequirements(blastRadius);
    const approvalPath = this.determineApprovalPath(intent, blastRadius);

    const diffLines = this.generatePolicyDiff(policy, currentInventory);

    return {
      id,
      intent,
      timestamp: new Date().toISOString(),
      policy,
      policy_diff: diffLines,
      provider_plans: providerPlans,
      blast_radius: blastRadius,
      test_cases: testCases,
      rollback_recipe: rollbackRecipe,
      evidence_requirements: evidenceRequirements,
      approval_path: approvalPath,
    };
  }

  compilePolicy(
    intent: IntentRequest,
    policy: SecurityPolicy,
    currentInventory: InventorySnapshot,
  ): CompiledPlan {
    const id = createHash("sha256")
      .update(JSON.stringify({ intent, policy }) + Date.now())
      .digest("hex")
      .slice(0, 16);

    const blastRadius = this.estimateBlastRadius(intent, policy, currentInventory);
    const testCases = this.generateTestCases(policy);
    const rollbackRecipe = this.generateRollbackRecipe(policy, currentInventory);
    const evidenceRequirements = this.determineEvidenceRequirements(blastRadius);
    const approvalPath = this.determineApprovalPath(intent, blastRadius);

    return {
      id,
      intent,
      timestamp: new Date().toISOString(),
      policy,
      policy_diff: this.generatePolicyDiff(policy, currentInventory),
      provider_plans: this.generateProviderPlans(policy),
      blast_radius: blastRadius,
      test_cases: testCases,
      rollback_recipe: rollbackRecipe,
      evidence_requirements: evidenceRequirements,
      approval_path: approvalPath,
    };
  }

  intentToPolicy(intent: IntentRequest): SecurityPolicy {
    for (const template of INTENT_TEMPLATES) {
      const match = intent.intent.match(template.pattern);
      if (match) {
        const partial = template.generate(intent, match);
        return this.buildFullPolicy(intent, partial);
      }
    }

    return this.buildFullPolicy(intent, {
      policies: {
        waf: { rules: [] },
        rateLimit: { rules: [] },
      },
    });
  }

  estimateBlastRadius(
    intent: IntentRequest,
    policy: SecurityPolicy,
    _currentInventory: InventorySnapshot,
  ): BlastRadius {
    const allRules = [
      ...(policy.policies?.waf?.rules ?? []),
    ];
    const allRateLimits = [
      ...(policy.policies?.rateLimit?.rules ?? []),
    ];

    const endpointsFromRules = allRules
      .map((r) => extractPathFromExpression(r.expression))
      .filter(Boolean) as string[];

    const endpointsFromRateLimits = allRateLimits
      .map((r) => r.name)
      .filter(Boolean);

    const endpoints = [...new Set([...endpointsFromRules, ...endpointsFromRateLimits])];

    const hasDestructiveRules = allRules.some((r) => r.action === "block");
    const hasWideExpressions = allRules.some(
      (r) => !r.expression.includes("http.request.uri.path"),
    );

    let risk: BlastRadius["estimated_risk"] = "low";
    if (hasDestructiveRules && hasWideExpressions) risk = "critical";
    else if (hasDestructiveRules) risk = "medium";
    else if (allRules.length > 5) risk = "medium";

    if (intent.risk_tolerance === "low" && risk !== "low") {
      risk = risk === "medium" ? "high" : risk;
    }

    return {
      tenants_affected: intent.tenant ? [intent.tenant] : ["all"],
      endpoints_affected: endpoints.length > 0 ? endpoints : ["unknown"],
      providers_affected: policy.targetProviders,
      estimated_risk: risk,
      max_users_impacted: hasWideExpressions ? "all" : "scoped",
      reversible: true,
    };
  }

  generateTestCases(policy: SecurityPolicy): TestCase[] {
    const cases: TestCase[] = [];

    for (const rule of policy.policies?.waf?.rules ?? []) {
      cases.push(...this.wafRuleToTestCases(rule));
    }

    for (const rule of policy.policies?.rateLimit?.rules ?? []) {
      cases.push(...this.rateLimitToTestCases(rule));
    }

    if (policy.securityDefaults?.denyByDefault) {
      cases.push({
        name: "deny-by-default-no-headers",
        description: "Request with no required headers should be blocked",
        request: {
          method: "GET",
          path: "/mcp",
          headers: {},
        },
        expected_outcome: "block",
      });
    }

    for (const header of policy.securityDefaults?.requiredHeaders ?? []) {
      cases.push({
        name: `missing-header-${sanitize(header)}`,
        description: `Request missing ${header} should be blocked`,
        request: {
          method: "GET",
          path: "/mcp",
          headers: Object.fromEntries(
            (policy.securityDefaults?.requiredHeaders ?? [])
              .filter((h) => h !== header)
              .map((h) => [h, "test-value"]),
          ),
        },
        expected_outcome: "block",
      });
    }

    return cases;
  }

  generateRollbackRecipe(
    policy: SecurityPolicy,
    _currentInventory: InventorySnapshot,
  ): RollbackRecipe {
    const steps: RollbackStep[] = [];
    let order = 1;

    for (const provider of policy.targetProviders) {
      for (const rule of policy.policies?.waf?.rules ?? []) {
        steps.push({
          order: order++,
          provider,
          action: "remove",
          resource: `waf-rule:${rule.name}`,
          detail: `Remove WAF rule "${rule.name}"`,
        });
      }

      for (const rule of policy.policies?.rateLimit?.rules ?? []) {
        steps.push({
          order: order++,
          provider,
          action: "remove",
          resource: `ratelimit-rule:${rule.name}`,
          detail: `Remove rate limit rule "${rule.name}"`,
        });
      }

      steps.push({
        order: order++,
        provider,
        action: "verify",
        resource: "endpoints",
        detail: "Verify /mcp and /turn/* respond correctly after rollback",
      });
    }

    return {
      steps,
      verification: [
        "Verify /healthz returns 200",
        "Verify /mcp GET returns capabilities",
        "Verify rate limits are back to baseline",
        "Verify ledger entry records the rollback",
      ],
      estimated_duration_seconds: steps.length * 5,
    };
  }

  private wafRuleToTestCases(rule: WafRule): TestCase[] {
    const cases: TestCase[] = [];
    const path = extractPathFromExpression(rule.expression) ?? "/mcp";

    cases.push({
      name: `waf-${sanitize(rule.name)}-triggers`,
      description: `WAF rule "${rule.name}" should ${rule.action} matching requests`,
      request: {
        method: "GET",
        path,
        headers: {},
      },
      expected_outcome: rule.action === "block" ? "block" : "challenge",
    });

    if (rule.expression.includes("authorization")) {
      cases.push({
        name: `waf-${sanitize(rule.name)}-passes-with-auth`,
        description: `WAF rule "${rule.name}" should allow authenticated requests`,
        request: {
          method: "GET",
          path,
          headers: { authorization: "Bearer valid-token" },
        },
        expected_outcome: "allow",
      });
    }

    return cases;
  }

  private rateLimitToTestCases(rule: RateLimitRule): TestCase[] {
    return [
      {
        name: `ratelimit-${sanitize(rule.name)}-under`,
        description: `Rate limit "${rule.name}" should allow requests under threshold`,
        request: {
          method: "GET",
          path: "/mcp",
          headers: { "x-tenant-id": "test" },
          repeat: Math.floor(rule.requests * 0.5),
        },
        expected_outcome: "allow",
      },
      {
        name: `ratelimit-${sanitize(rule.name)}-over`,
        description: `Rate limit "${rule.name}" should ${rule.action} requests over threshold`,
        request: {
          method: "GET",
          path: "/mcp",
          headers: { "x-tenant-id": "test" },
          repeat: rule.requests + 10,
        },
        expected_outcome: rule.action === "block" ? "block" : "challenge",
      },
    ];
  }

  private buildFullPolicy(
    intent: IntentRequest,
    partial: Partial<SecurityPolicy>,
  ): SecurityPolicy {
    return {
      version: 1,
      name: `intent-${sanitize(intent.intent).slice(0, 50)}`,
      targetProviders: intent.target_providers ?? ["cloudflare"],
      zones: [],
      securityDefaults: {
        denyByDefault: true,
        requiredHeaders: [
          "x-tenant-id",
          "x-request-id",
          "x-policy-version",
          "x-operator-capability",
        ],
      },
      policies: partial.policies ?? { waf: { rules: [] }, rateLimit: { rules: [] } },
      rbac: { tenants: [{ id: intent.tenant, capabilities: ["mcp.admin"], rateLimit: "120/min" }] },
      audit: { enabled: true, retention: "90 days", immutable: true },
    };
  }

  private generateProviderPlans(policy: SecurityPolicy): Record<ProviderName, string> {
    const plans: Record<string, string> = {};

    for (const provider of policy.targetProviders) {
      if (this.translator) {
        try {
          plans[provider] = this.translator.translate(policy, "cloudflare", provider);
        } catch {
          plans[provider] = `# ${provider}: policy translation not available`;
        }
      } else {
        plans[provider] = `# ${provider}: ${policy.policies.waf.rules.length} WAF rules, ${policy.policies.rateLimit.rules.length} rate limit rules`;
      }
    }

    return plans;
  }

  private generatePolicyDiff(
    policy: SecurityPolicy,
    _currentInventory: InventorySnapshot,
  ): string {
    const lines: string[] = ["# Policy Diff", ""];

    if (policy.policies.waf.rules.length > 0) {
      lines.push("## WAF Rules (additions)");
      for (const rule of policy.policies.waf.rules) {
        lines.push(`+ ${rule.name}: ${rule.action} — ${rule.expression}`);
      }
      lines.push("");
    }

    if (policy.policies.rateLimit.rules.length > 0) {
      lines.push("## Rate Limit Rules (additions)");
      for (const rule of policy.policies.rateLimit.rules) {
        lines.push(`+ ${rule.name}: ${rule.action} — ${rule.requests}/${rule.period}s`);
      }
      lines.push("");
    }

    return lines.join("\n");
  }

  private determineEvidenceRequirements(blastRadius: BlastRadius): string[] {
    const reqs = [
      "inventory_before",
      "inventory_after",
      "policy_diff",
      "ledger_entry",
    ];

    if (blastRadius.estimated_risk !== "low") {
      reqs.push("rollback_recipe_tested", "mutation_test_results");
    }

    if (blastRadius.estimated_risk === "critical") {
      reqs.push("operator_sign_off", "blast_radius_review");
    }

    return reqs;
  }

  private determineApprovalPath(
    intent: IntentRequest,
    blastRadius: BlastRadius,
  ): "auto" | "operator" | "court" {
    if (blastRadius.estimated_risk === "critical") return "court";
    if (blastRadius.estimated_risk === "high") return "operator";
    if (intent.risk_tolerance === "low" && blastRadius.estimated_risk === "medium") return "operator";
    if (blastRadius.estimated_risk === "medium") return "operator";
    return "auto";
  }
}

function sanitize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

function extractPathFromExpression(expression: string): string | null {
  const match = expression.match(/["']([/][^"']+)["']/);
  return match?.[1] ?? null;
}
