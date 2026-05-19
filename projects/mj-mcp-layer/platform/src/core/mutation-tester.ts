import type {
  SecurityPolicy,
  WafRule,
  RateLimitRule,
} from "./types.js";
import type { TestResult } from "./evidence-engine.js";

export interface PolicyMutant {
  name: string;
  category: MutantCategory;
  description: string;
  request: MutantRequest;
  expected_outcome: "block" | "challenge" | "deny" | "allow";
  source_rule?: string;
}

type MutantCategory =
  | "missing_header"
  | "malformed_auth"
  | "wrong_method"
  | "unknown_path"
  | "spoofed_header"
  | "over_limit"
  | "no_tenant"
  | "no_auth"
  | "path_traversal"
  | "deny_default"
  | "rate_burst";

interface MutantRequest {
  method: string;
  path: string;
  headers: Record<string, string>;
  repeat?: number;
  body?: string;
}

interface MutationTestConfig {
  endpoint: string;
  timeout_ms?: number;
  auth_token?: string;
}

export class MutationTester {
  generateMutants(policy: SecurityPolicy): PolicyMutant[] {
    const mutants: PolicyMutant[] = [];

    mutants.push(...this.generateDenyDefaultMutants(policy));
    mutants.push(...this.generateHeaderMutants(policy));
    mutants.push(...this.generateMethodMutants(policy));
    mutants.push(...this.generatePathMutants(policy));
    mutants.push(...this.generateAuthMutants(policy));
    mutants.push(...this.generateWafMutants(policy));
    mutants.push(...this.generateRateLimitMutants(policy));

    return mutants;
  }

  async runMutants(
    mutants: PolicyMutant[],
    config: MutationTestConfig,
  ): Promise<MutationTestReport> {
    const results: TestResult[] = [];
    let killed = 0;
    let survived = 0;

    for (const mutant of mutants) {
      const result = await this.executeMutant(mutant, config);
      results.push(result);

      if (result.passed) {
        killed++;
      } else {
        survived++;
        console.log(`  SURVIVED: ${mutant.name} — expected ${mutant.expected_outcome}, got ${result.actual}`);
      }
    }

    const score = mutants.length > 0 ? (killed / mutants.length) * 100 : 100;

    return {
      total: mutants.length,
      killed,
      survived,
      score,
      results,
      passed: survived === 0,
    };
  }

  formatReport(report: MutationTestReport): string {
    const lines: string[] = [
      "# Policy Mutation Test Report",
      "",
      `| Metric | Value |`,
      `|--------|-------|`,
      `| Total mutants | ${report.total} |`,
      `| Killed (policy caught) | ${report.killed} |`,
      `| Survived (policy missed) | ${report.survived} |`,
      `| Mutation score | ${report.score.toFixed(1)}% |`,
      `| Verdict | ${report.passed ? "PASS" : "FAIL"} |`,
      "",
    ];

    if (report.survived > 0) {
      lines.push("## Surviving Mutants (policy gaps)", "");
      for (const result of report.results) {
        if (!result.passed) {
          lines.push(`- **${result.name}**: expected \`${result.expected}\`, got \`${result.actual}\``);
        }
      }
      lines.push("");
    }

    lines.push("## All Mutants", "");
    for (const result of report.results) {
      const icon = result.passed ? "KILLED" : "SURVIVED";
      lines.push(`- [${icon}] ${result.name} (${result.duration_ms}ms)`);
    }

    return lines.join("\n");
  }

  private generateDenyDefaultMutants(policy: SecurityPolicy): PolicyMutant[] {
    if (!policy.securityDefaults?.denyByDefault) return [];

    return [
      {
        name: "deny-default-empty-request",
        category: "deny_default",
        description: "Completely empty request should be blocked by deny-by-default",
        request: { method: "GET", path: "/mcp", headers: {} },
        expected_outcome: "block",
      },
      {
        name: "deny-default-unknown-path",
        category: "deny_default",
        description: "Request to unregistered path should be blocked",
        request: { method: "GET", path: "/admin/secret", headers: {} },
        expected_outcome: "block",
      },
      {
        name: "deny-default-root",
        category: "deny_default",
        description: "Request to root with no context should not expose internals",
        request: { method: "POST", path: "/", headers: {} },
        expected_outcome: "block",
      },
    ];
  }

  private generateHeaderMutants(policy: SecurityPolicy): PolicyMutant[] {
    const required = policy.securityDefaults?.requiredHeaders ?? [];
    if (required.length === 0) return [];

    const validHeaders: Record<string, string> = {};
    for (const h of required) {
      validHeaders[h] = "test-value";
    }

    const mutants: PolicyMutant[] = [];

    for (const header of required) {
      const headers = { ...validHeaders };
      delete headers[header];

      mutants.push({
        name: `missing-required-header-${header}`,
        category: "missing_header",
        description: `Request missing required header "${header}" should be blocked`,
        request: { method: "GET", path: "/mcp", headers },
        expected_outcome: "block",
      });
    }

    mutants.push({
      name: "spoofed-policy-version",
      category: "spoofed_header",
      description: "Spoofed x-policy-version with garbage value",
      request: {
        method: "GET",
        path: "/mcp",
        headers: {
          ...validHeaders,
          "x-policy-version": "'; DROP TABLE events; --",
        },
      },
      expected_outcome: "allow",
    });

    mutants.push({
      name: "empty-tenant-id",
      category: "no_tenant",
      description: "Empty x-tenant-id header should be treated as missing",
      request: {
        method: "GET",
        path: "/mcp",
        headers: { ...validHeaders, "x-tenant-id": "" },
      },
      expected_outcome: "block",
    });

    return mutants;
  }

  private generateMethodMutants(_policy: SecurityPolicy): PolicyMutant[] {
    const validHeaders: Record<string, string> = {
      "x-tenant-id": "test",
      "x-request-id": "mutant-test",
      "x-policy-version": "v2",
      "x-operator-capability": "mcp.admin",
    };

    return [
      {
        name: "method-delete-on-mcp",
        category: "wrong_method",
        description: "DELETE on /mcp should be blocked (only GET/POST allowed)",
        request: { method: "DELETE", path: "/mcp", headers: validHeaders },
        expected_outcome: "block",
      },
      {
        name: "method-put-on-mcp",
        category: "wrong_method",
        description: "PUT on /mcp should be blocked",
        request: { method: "PUT", path: "/mcp", headers: validHeaders },
        expected_outcome: "block",
      },
      {
        name: "method-get-on-turn",
        category: "wrong_method",
        description: "GET on /turn should be blocked (only POST allowed)",
        request: { method: "GET", path: "/turn/test-id", headers: validHeaders },
        expected_outcome: "block",
      },
      {
        name: "method-post-on-audit",
        category: "wrong_method",
        description: "POST on /audit should be blocked (only GET allowed)",
        request: { method: "POST", path: "/audit/events", headers: validHeaders },
        expected_outcome: "block",
      },
    ];
  }

  private generatePathMutants(_policy: SecurityPolicy): PolicyMutant[] {
    const validHeaders: Record<string, string> = {
      "x-tenant-id": "test",
      "x-request-id": "mutant-test",
      "x-policy-version": "v2",
      "x-operator-capability": "mcp.admin",
    };

    return [
      {
        name: "path-traversal-dot-dot",
        category: "path_traversal",
        description: "Path traversal attempt should not reach internal resources",
        request: { method: "GET", path: "/mcp/../../etc/passwd", headers: validHeaders },
        expected_outcome: "block",
      },
      {
        name: "path-unknown-api",
        category: "unknown_path",
        description: "Unknown API path should return 404",
        request: { method: "GET", path: "/api/internal/debug", headers: validHeaders },
        expected_outcome: "block",
      },
      {
        name: "path-hidden-admin",
        category: "unknown_path",
        description: "Hidden admin path should not exist",
        request: { method: "GET", path: "/.env", headers: validHeaders },
        expected_outcome: "block",
      },
    ];
  }

  private generateAuthMutants(_policy: SecurityPolicy): PolicyMutant[] {
    return [
      {
        name: "auth-no-token",
        category: "no_auth",
        description: "Request to protected endpoint without auth token should be rejected",
        request: {
          method: "GET",
          path: "/api/events",
          headers: {},
        },
        expected_outcome: "deny",
      },
      {
        name: "auth-malformed-bearer",
        category: "malformed_auth",
        description: "Malformed Bearer token should be rejected",
        request: {
          method: "GET",
          path: "/api/events",
          headers: { authorization: "Bearer" },
        },
        expected_outcome: "deny",
      },
      {
        name: "auth-wrong-scheme",
        category: "malformed_auth",
        description: "Non-Bearer auth scheme should be rejected",
        request: {
          method: "GET",
          path: "/api/events",
          headers: { authorization: "Basic dXNlcjpwYXNz" },
        },
        expected_outcome: "deny",
      },
      {
        name: "auth-empty-bearer",
        category: "malformed_auth",
        description: "Bearer with empty token should be rejected",
        request: {
          method: "GET",
          path: "/api/events",
          headers: { authorization: "Bearer " },
        },
        expected_outcome: "deny",
      },
    ];
  }

  private generateWafMutants(policy: SecurityPolicy): PolicyMutant[] {
    const mutants: PolicyMutant[] = [];

    for (const rule of policy.policies?.waf?.rules ?? []) {
      mutants.push(...this.wafRuleToMutants(rule));
    }

    return mutants;
  }

  private wafRuleToMutants(rule: WafRule): PolicyMutant[] {
    const mutants: PolicyMutant[] = [];
    const path = extractPathFromExpression(rule.expression) ?? "/mcp";

    if (rule.expression.includes("authorization") || rule.expression.includes("authenticated")) {
      mutants.push({
        name: `waf-${sanitize(rule.name)}-no-auth`,
        category: "no_auth",
        description: `WAF rule "${rule.name}" should catch unauthenticated request`,
        request: { method: "GET", path, headers: {} },
        expected_outcome: rule.action === "block" ? "block" : "challenge",
        source_rule: rule.name,
      });
    }

    if (rule.expression.includes("x-tenant-id")) {
      mutants.push({
        name: `waf-${sanitize(rule.name)}-no-tenant`,
        category: "no_tenant",
        description: `WAF rule "${rule.name}" should catch missing tenant`,
        request: {
          method: "GET",
          path,
          headers: { "x-request-id": "test", "x-policy-version": "v1" },
        },
        expected_outcome: rule.action === "block" ? "block" : "challenge",
        source_rule: rule.name,
      });
    }

    return mutants;
  }

  private generateRateLimitMutants(policy: SecurityPolicy): PolicyMutant[] {
    const mutants: PolicyMutant[] = [];

    for (const rule of policy.policies?.rateLimit?.rules ?? []) {
      mutants.push({
        name: `ratelimit-${sanitize(rule.name)}-burst`,
        category: "rate_burst",
        description: `Rate limit "${rule.name}" should trigger on burst exceeding ${rule.requests}/${rule.period}s`,
        request: {
          method: "GET",
          path: "/mcp",
          headers: {
            "x-tenant-id": "burst-test",
            "x-request-id": "burst",
            "x-policy-version": "v2",
            "x-operator-capability": "mcp.admin",
          },
          repeat: rule.requests + 20,
        },
        expected_outcome: rule.action === "block" ? "block" : "challenge",
        source_rule: rule.name,
      });
    }

    return mutants;
  }

  private async executeMutant(
    mutant: PolicyMutant,
    config: MutationTestConfig,
  ): Promise<TestResult> {
    const start = Date.now();

    try {
      const url = `${config.endpoint}${mutant.request.path}`;
      const headers: Record<string, string> = { ...mutant.request.headers };

      if (config.auth_token && !headers.authorization && !headers["x-ellis-aegis-token"]) {
        headers["x-ellis-aegis-token"] = config.auth_token;
      }

      const repeatCount = mutant.request.repeat ?? 1;
      let lastStatus = 0;

      for (let i = 0; i < repeatCount; i++) {
        const response = await fetch(url, {
          method: mutant.request.method,
          headers,
          body: mutant.request.body,
        });
        lastStatus = response.status;
      }

      const actual = statusToOutcome(lastStatus);
      const passed = outcomeMatches(actual, mutant.expected_outcome);

      return {
        name: mutant.name,
        passed,
        expected: mutant.expected_outcome,
        actual,
        duration_ms: Date.now() - start,
      };
    } catch (error) {
      return {
        name: mutant.name,
        passed: false,
        expected: mutant.expected_outcome,
        actual: `error: ${error}`,
        duration_ms: Date.now() - start,
      };
    }
  }
}

export interface MutationTestReport {
  total: number;
  killed: number;
  survived: number;
  score: number;
  results: TestResult[];
  passed: boolean;
}

function statusToOutcome(status: number): string {
  if (status === 403) return "block";
  if (status === 401) return "deny";
  if (status === 429) return "challenge";
  if (status === 404) return "block";
  if (status >= 200 && status < 300) return "allow";
  return `http-${status}`;
}

function outcomeMatches(actual: string, expected: string): boolean {
  if (actual === expected) return true;
  if (expected === "block" && (actual === "block" || actual === "deny")) return true;
  if (expected === "deny" && (actual === "deny" || actual === "block")) return true;
  return false;
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
