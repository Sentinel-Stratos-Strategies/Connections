import type {
  InventorySnapshot,
  SecurityPolicy,
  WafRule,
  RateLimitRule,
} from "./types.js";
import type { CompiledPlan } from "./policy-compiler.js";
import type { MutationTester, PolicyMutant } from "./mutation-tester.js";

export interface TrafficPattern {
  name: string;
  method: string;
  path: string;
  headers: Record<string, string>;
  requests_per_minute: number;
  description: string;
}

interface TwinState {
  inventory: InventorySnapshot;
  current_policy: SecurityPolicy;
  proposed_policy: SecurityPolicy;
  traffic: TrafficPattern[];
}

interface ScenarioResult {
  scenario: string;
  passed: boolean;
  severity: "ok" | "warning" | "error";
  detail: string;
}

export interface SimulationResult {
  twin_id: string;
  timestamp: string;
  passed: boolean;
  overall_risk: "safe" | "risky" | "breaking";
  scenarios: ScenarioResult[];
  traffic_analysis: TrafficAnalysis[];
  tenant_impact: TenantImpact[];
  summary: string;
}

interface TrafficAnalysis {
  pattern: string;
  before: "pass" | "block" | "challenge";
  after: "pass" | "block" | "challenge";
  impact: "none" | "improved" | "degraded" | "broken";
}

interface TenantImpact {
  tenant: string;
  affected_endpoints: string[];
  capabilities_changed: string[];
  risk: "none" | "low" | "medium" | "high";
}

const DEFAULT_TRAFFIC_PATTERNS: TrafficPattern[] = [
  {
    name: "legitimate-mcp-list",
    method: "GET",
    path: "/mcp",
    headers: {
      "x-tenant-id": "test-tenant",
      "x-request-id": "sim-001",
      "x-policy-version": "v2",
      "x-operator-capability": "mcp.admin",
      "authorization": "Bearer valid-token",
    },
    requests_per_minute: 30,
    description: "Authenticated MCP capability listing",
  },
  {
    name: "legitimate-mcp-call",
    method: "POST",
    path: "/mcp",
    headers: {
      "x-tenant-id": "test-tenant",
      "x-request-id": "sim-002",
      "x-policy-version": "v2",
      "x-operator-capability": "mcp.admin",
      "authorization": "Bearer valid-token",
    },
    requests_per_minute: 60,
    description: "Authenticated MCP tool execution",
  },
  {
    name: "legitimate-turn",
    method: "POST",
    path: "/turn/sim-turn-001",
    headers: {
      "x-tenant-id": "test-tenant",
      "x-request-id": "sim-003",
      "x-policy-version": "v2",
      "x-operator-capability": "script.run",
      "authorization": "Bearer valid-token",
    },
    requests_per_minute: 20,
    description: "Authenticated turn execution",
  },
  {
    name: "legitimate-audit-read",
    method: "GET",
    path: "/audit/events",
    headers: {
      "x-tenant-id": "test-tenant",
      "x-request-id": "sim-004",
      "x-policy-version": "v2",
      "x-operator-capability": "forensic.read",
      "authorization": "Bearer valid-token",
    },
    requests_per_minute: 10,
    description: "Authenticated audit log query",
  },
  {
    name: "health-probe",
    method: "GET",
    path: "/healthz",
    headers: {},
    requests_per_minute: 6,
    description: "Health check (no auth required)",
  },
  {
    name: "attacker-no-headers",
    method: "GET",
    path: "/mcp",
    headers: {},
    requests_per_minute: 100,
    description: "Unauthenticated scan attempt",
  },
  {
    name: "attacker-path-probe",
    method: "GET",
    path: "/admin/config",
    headers: {},
    requests_per_minute: 50,
    description: "Admin path discovery attempt",
  },
  {
    name: "attacker-burst",
    method: "POST",
    path: "/mcp",
    headers: { "x-tenant-id": "attacker" },
    requests_per_minute: 500,
    description: "High-rate burst attempt",
  },
];

export class DigitalTwin {
  private mutationTester?: MutationTester;

  constructor(mutationTester?: MutationTester) {
    this.mutationTester = mutationTester;
  }

  simulate(
    inventory: InventorySnapshot,
    currentPolicy: SecurityPolicy,
    proposedChange: CompiledPlan,
    customTraffic?: TrafficPattern[],
  ): SimulationResult {
    const traffic = customTraffic ?? DEFAULT_TRAFFIC_PATTERNS;
    const proposedPolicy = proposedChange.policy;

    const state: TwinState = {
      inventory,
      current_policy: currentPolicy,
      proposed_policy: proposedPolicy,
      traffic,
    };

    const scenarios = [
      ...this.evaluateTrafficScenarios(state),
      ...this.evaluateRateLimitScenarios(state),
      ...this.evaluateTenantIsolationScenarios(state),
      ...this.evaluateDenyDefaultScenarios(state),
      ...this.evaluateCapabilityScenarios(state),
    ];

    const trafficAnalysis = this.analyzeTrafficPatterns(state);
    const tenantImpact = this.assessTenantImpact(state);

    const errorCount = scenarios.filter((s) => s.severity === "error").length;
    const warningCount = scenarios.filter((s) => s.severity === "warning").length;

    let overallRisk: SimulationResult["overall_risk"] = "safe";
    if (errorCount > 0) overallRisk = "breaking";
    else if (warningCount > 0) overallRisk = "risky";

    return {
      twin_id: `twin-${Date.now()}`,
      timestamp: new Date().toISOString(),
      passed: errorCount === 0,
      overall_risk: overallRisk,
      scenarios,
      traffic_analysis: trafficAnalysis,
      tenant_impact: tenantImpact,
      summary: this.buildSummary(overallRisk, scenarios, trafficAnalysis),
    };
  }

  formatAsPRComment(result: SimulationResult): string {
    const icon = { safe: "🟢", risky: "🟡", breaking: "🔴" }[result.overall_risk];

    const lines: string[] = [
      `## ${icon} Digital Twin Simulation`,
      "",
      `**Overall risk:** ${result.overall_risk}`,
      `**Scenarios evaluated:** ${result.scenarios.length}`,
      `**Passed:** ${result.passed}`,
      "",
    ];

    const errors = result.scenarios.filter((s) => s.severity === "error");
    const warnings = result.scenarios.filter((s) => s.severity === "warning");

    if (errors.length > 0) {
      lines.push("### 🔴 Breaking Changes", "");
      for (const e of errors) {
        lines.push(`- **${e.scenario}**: ${e.detail}`);
      }
      lines.push("");
    }

    if (warnings.length > 0) {
      lines.push("### 🟡 Warnings", "");
      for (const w of warnings) {
        lines.push(`- **${w.scenario}**: ${w.detail}`);
      }
      lines.push("");
    }

    lines.push("### Traffic Analysis", "");
    lines.push("| Pattern | Before | After | Impact |");
    lines.push("|---------|--------|-------|--------|");
    for (const ta of result.traffic_analysis) {
      const impactIcon = {
        none: "➖",
        improved: "✅",
        degraded: "⚠️",
        broken: "❌",
      }[ta.impact];
      lines.push(`| ${ta.pattern} | ${ta.before} | ${ta.after} | ${impactIcon} ${ta.impact} |`);
    }

    if (result.tenant_impact.length > 0) {
      lines.push("", "### Tenant Impact", "");
      for (const ti of result.tenant_impact) {
        if (ti.risk !== "none") {
          lines.push(`- **${ti.tenant}**: ${ti.risk} risk — ${ti.affected_endpoints.join(", ")}`);
        }
      }
    }

    lines.push("", `---`, `*Simulation ID: ${result.twin_id}*`);

    return lines.join("\n");
  }

  private evaluateTrafficScenarios(state: TwinState): ScenarioResult[] {
    const results: ScenarioResult[] = [];

    for (const pattern of state.traffic) {
      if (pattern.name.startsWith("legitimate-")) {
        const blocked = this.wouldPolicyBlock(state.proposed_policy, pattern);
        if (blocked) {
          results.push({
            scenario: `legitimate-traffic-${pattern.name}`,
            passed: false,
            severity: "error",
            detail: `${pattern.description} would be BLOCKED by proposed policy`,
          });
        } else {
          results.push({
            scenario: `legitimate-traffic-${pattern.name}`,
            passed: true,
            severity: "ok",
            detail: `${pattern.description} passes proposed policy`,
          });
        }
      }

      if (pattern.name.startsWith("attacker-")) {
        const blocked = this.wouldPolicyBlock(state.proposed_policy, pattern);
        if (!blocked) {
          results.push({
            scenario: `attacker-blocked-${pattern.name}`,
            passed: false,
            severity: "warning",
            detail: `${pattern.description} is NOT blocked by proposed policy`,
          });
        } else {
          results.push({
            scenario: `attacker-blocked-${pattern.name}`,
            passed: true,
            severity: "ok",
            detail: `${pattern.description} correctly blocked`,
          });
        }
      }
    }

    return results;
  }

  private evaluateRateLimitScenarios(state: TwinState): ScenarioResult[] {
    const results: ScenarioResult[] = [];
    const rateLimits = state.proposed_policy.policies?.rateLimit?.rules ?? [];

    for (const pattern of state.traffic) {
      if (pattern.name.startsWith("legitimate-")) {
        for (const rl of rateLimits) {
          const limitPerMinute = (rl.requests / rl.period) * 60;
          if (pattern.requests_per_minute > limitPerMinute * 0.8) {
            results.push({
              scenario: `ratelimit-risk-${pattern.name}-${rl.name}`,
              passed: true,
              severity: "warning",
              detail: `"${pattern.description}" at ${pattern.requests_per_minute} rpm is within 80% of rate limit "${rl.name}" (${limitPerMinute.toFixed(0)} rpm). May trigger under load.`,
            });
          }
        }
      }
    }

    return results;
  }

  private evaluateTenantIsolationScenarios(state: TwinState): ScenarioResult[] {
    const results: ScenarioResult[] = [];
    const tenants = state.proposed_policy.rbac?.tenants ?? [];

    for (const tenant of tenants) {
      const capabilities = tenant.capabilities ?? [];
      if (!capabilities.includes("mcp.admin") && capabilities.length > 0) {
        results.push({
          scenario: `tenant-isolation-${tenant.id}`,
          passed: true,
          severity: "ok",
          detail: `Tenant "${tenant.id}" has scoped capabilities: ${capabilities.join(", ")}`,
        });
      }
    }

    return results;
  }

  private evaluateDenyDefaultScenarios(state: TwinState): ScenarioResult[] {
    if (!state.proposed_policy.securityDefaults?.denyByDefault) {
      return [{
        scenario: "deny-default-disabled",
        passed: false,
        severity: "error",
        detail: "Proposed policy does NOT have deny-by-default enabled. All unmatched requests will pass.",
      }];
    }
    return [{
      scenario: "deny-default-enabled",
      passed: true,
      severity: "ok",
      detail: "Deny-by-default is active. Unmatched requests are blocked.",
    }];
  }

  private evaluateCapabilityScenarios(state: TwinState): ScenarioResult[] {
    const results: ScenarioResult[] = [];
    const tenants = state.proposed_policy.rbac?.tenants ?? [];

    for (const tenant of tenants) {
      if (tenant.capabilities?.includes("mcp.admin")) {
        results.push({
          scenario: `capability-admin-${tenant.id}`,
          passed: true,
          severity: "warning",
          detail: `Tenant "${tenant.id}" has mcp.admin — full access to all MCP endpoints`,
        });
      }
    }

    return results;
  }

  private analyzeTrafficPatterns(state: TwinState): TrafficAnalysis[] {
    return state.traffic.map((pattern) => {
      const beforeBlocked = this.wouldPolicyBlock(state.current_policy, pattern);
      const afterBlocked = this.wouldPolicyBlock(state.proposed_policy, pattern);

      const before = beforeBlocked ? "block" : "pass";
      const after = afterBlocked ? "block" : "pass";

      let impact: TrafficAnalysis["impact"] = "none";
      if (before === "pass" && after === "block") {
        impact = pattern.name.startsWith("attacker-") ? "improved" : "broken";
      } else if (before === "block" && after === "pass") {
        impact = pattern.name.startsWith("attacker-") ? "degraded" : "improved";
      }

      return { pattern: pattern.name, before, after, impact };
    });
  }

  private assessTenantImpact(state: TwinState): TenantImpact[] {
    const tenants = state.proposed_policy.rbac?.tenants ?? [];
    return tenants.map((tenant) => {
      const currentTenant = (state.current_policy.rbac?.tenants ?? [])
        .find((t) => t.id === tenant.id);

      const newCaps = tenant.capabilities ?? [];
      const oldCaps = currentTenant?.capabilities ?? [];
      const added = newCaps.filter((c) => !oldCaps.includes(c));
      const removed = oldCaps.filter((c) => !newCaps.includes(c));
      const changed = [...added.map((c) => `+${c}`), ...removed.map((c) => `-${c}`)];

      let risk: TenantImpact["risk"] = "none";
      if (removed.length > 0) risk = "medium";
      if (added.includes("mcp.admin")) risk = "high";

      return {
        tenant: tenant.id,
        affected_endpoints: removed.length > 0 ? ["/mcp", "/turn/*", "/audit/*"] : [],
        capabilities_changed: changed,
        risk,
      };
    });
  }

  private wouldPolicyBlock(policy: SecurityPolicy, pattern: TrafficPattern): boolean {
    if (policy.securityDefaults?.denyByDefault) {
      const requiredHeaders = policy.securityDefaults.requiredHeaders ?? [];
      for (const h of requiredHeaders) {
        if (!pattern.headers[h]) return true;
      }
    }

    for (const rule of policy.policies?.waf?.rules ?? []) {
      if (rule.action === "block" && this.expressionMatches(rule, pattern)) {
        return true;
      }
    }

    return false;
  }

  private expressionMatches(rule: WafRule, pattern: TrafficPattern): boolean {
    const expr = rule.expression.toLowerCase();

    if (expr.includes("http.request.uri.path")) {
      const pathMatch = expr.match(/["']([/][^"']+)["']/);
      if (pathMatch && pattern.path === pathMatch[1]) return true;
    }

    if (expr.includes("authorization") && !pattern.headers.authorization) {
      return true;
    }

    if (expr.includes("x-tenant-id") && !pattern.headers["x-tenant-id"]) {
      return true;
    }

    if (expr.includes("http.request.method")) {
      const methodMatch = expr.match(/["']([A-Z]+)["']/);
      if (methodMatch && pattern.method === methodMatch[1]) return true;
    }

    return false;
  }

  private buildSummary(
    risk: SimulationResult["overall_risk"],
    scenarios: ScenarioResult[],
    traffic: TrafficAnalysis[],
  ): string {
    const broken = traffic.filter((t) => t.impact === "broken").length;
    const improved = traffic.filter((t) => t.impact === "improved").length;
    const errors = scenarios.filter((s) => s.severity === "error").length;
    const warnings = scenarios.filter((s) => s.severity === "warning").length;

    if (risk === "safe") {
      return `Safe to deploy. ${improved} traffic patterns improved, ${warnings} warnings.`;
    }
    if (risk === "risky") {
      return `Risky. ${warnings} warnings detected. Review before deploying.`;
    }
    return `BREAKING. ${errors} errors, ${broken} traffic patterns broken. Do not deploy without fixes.`;
  }
}
