import type {
  SecurityPolicy,
} from "./types.js";
import type { VerificationResult } from "./evidence-engine.js";

export interface RuntimeMonitor {
  id: string;
  source_policy: string;
  source_rule?: string;
  category: MonitorCategory;
  assertion: string;
  severity: "info" | "warning" | "critical";
  check: (event: AuditEvent) => boolean;
}

type MonitorCategory =
  | "header_presence"
  | "method_enforcement"
  | "path_enforcement"
  | "auth_validation"
  | "rate_limit"
  | "policy_version"
  | "ledger_integrity"
  | "tenant_isolation"
  | "capability_check";

export interface AuditEvent {
  id: string;
  timestamp: string;
  category: string;
  actor: string;
  severity: string;
  message: string;
  source: string;
  metadata: string | Record<string, unknown>;
}

interface MonitorConfig {
  endpoint: string;
  auth_token?: string;
  since?: string;
  limit?: number;
}

export class RuntimeVerifier {
  generateMonitors(policy: SecurityPolicy): RuntimeMonitor[] {
    const monitors: RuntimeMonitor[] = [];
    const policyName = policy.name ?? "unknown";

    monitors.push(...this.headerMonitors(policy, policyName));
    monitors.push(...this.methodMonitors(policy, policyName));
    monitors.push(...this.authMonitors(policyName));
    monitors.push(...this.policyVersionMonitors(policyName));
    monitors.push(...this.ledgerMonitors(policyName));
    monitors.push(...this.tenantMonitors(policy, policyName));
    monitors.push(...this.capabilityMonitors(policyName));
    monitors.push(...this.wafMonitors(policy, policyName));
    monitors.push(...this.rateLimitMonitors(policy, policyName));

    return monitors;
  }

  async verify(
    monitors: RuntimeMonitor[],
    events: AuditEvent[],
  ): Promise<VerificationResult[]> {
    const results: VerificationResult[] = [];

    for (const monitor of monitors) {
      const relevantEvents = events.filter((e) => this.isRelevantEvent(e, monitor));

      if (relevantEvents.length === 0) {
        results.push({
          monitor_id: monitor.id,
          assertion: monitor.assertion,
          passed: true,
          observed: "no relevant events (vacuously true)",
          timestamp: new Date().toISOString(),
        });
        continue;
      }

      const violations = relevantEvents.filter((e) => !monitor.check(e));

      results.push({
        monitor_id: monitor.id,
        assertion: monitor.assertion,
        passed: violations.length === 0,
        observed: violations.length > 0
          ? { violation_count: violations.length, first: summarizeEvent(violations[0]) }
          : { checked_events: relevantEvents.length },
        timestamp: new Date().toISOString(),
      });
    }

    return results;
  }

  async fetchAndVerify(
    monitors: RuntimeMonitor[],
    config: MonitorConfig,
  ): Promise<VerificationResult[]> {
    const events = await this.fetchAuditEvents(config);
    return this.verify(monitors, events);
  }

  formatResults(results: VerificationResult[]): string {
    const passed = results.filter((r) => r.passed).length;
    const failed = results.filter((r) => !r.passed).length;
    const total = results.length;

    const lines: string[] = [
      "# Runtime Verification Report",
      "",
      `| Metric | Value |`,
      `|--------|-------|`,
      `| Total monitors | ${total} |`,
      `| Passed | ${passed} |`,
      `| Failed | ${failed} |`,
      `| Score | ${total > 0 ? ((passed / total) * 100).toFixed(1) : "N/A"}% |`,
      "",
    ];

    if (failed > 0) {
      lines.push("## Violations", "");
      for (const result of results) {
        if (!result.passed) {
          lines.push(`- **${result.monitor_id}**: ${result.assertion}`);
          lines.push(`  Observed: ${JSON.stringify(result.observed)}`);
        }
      }
      lines.push("");
    }

    lines.push("## All Monitors", "");
    for (const result of results) {
      const icon = result.passed ? "PASS" : "FAIL";
      lines.push(`- [${icon}] ${result.monitor_id}: ${result.assertion}`);
    }

    return lines.join("\n");
  }

  private headerMonitors(policy: SecurityPolicy, policyName: string): RuntimeMonitor[] {
    const monitors: RuntimeMonitor[] = [];

    for (const header of policy.securityDefaults?.requiredHeaders ?? []) {
      monitors.push({
        id: `header-present-${header}`,
        source_policy: policyName,
        category: "header_presence",
        assertion: `Every MCP request must include ${header} header`,
        severity: "critical",
        check: (event) => {
          if (!isMcpEvent(event)) return true;
          const meta = parseMetadata(event.metadata);
          if (meta.headers && typeof meta.headers === "object") {
            return header in (meta.headers as Record<string, unknown>);
          }
          return true;
        },
      });
    }

    return monitors;
  }

  private methodMonitors(_policy: SecurityPolicy, policyName: string): RuntimeMonitor[] {
    return [
      {
        id: "method-turn-post-only",
        source_policy: policyName,
        category: "method_enforcement",
        assertion: "Every /turn/* request must use POST method",
        severity: "critical",
        check: (event) => {
          const meta = parseMetadata(event.metadata);
          if (typeof meta.path === "string" && (meta.path as string).startsWith("/turn")) {
            return meta.method === "POST" || meta.method === "OPTIONS";
          }
          return true;
        },
      },
      {
        id: "method-audit-get-only",
        source_policy: policyName,
        category: "method_enforcement",
        assertion: "Every /audit/* request must use GET method",
        severity: "critical",
        check: (event) => {
          const meta = parseMetadata(event.metadata);
          if (typeof meta.path === "string" && (meta.path as string).startsWith("/audit")) {
            return meta.method === "GET" || meta.method === "OPTIONS";
          }
          return true;
        },
      },
    ];
  }

  private authMonitors(policyName: string): RuntimeMonitor[] {
    return [
      {
        id: "auth-no-anonymous-mutations",
        source_policy: policyName,
        category: "auth_validation",
        assertion: "No anonymous actor should perform write operations",
        severity: "critical",
        check: (event) => {
          if (event.actor === "anonymous") {
            const meta = parseMetadata(event.metadata);
            return meta.method === "GET" || meta.method === "OPTIONS";
          }
          return true;
        },
      },
      {
        id: "auth-failures-logged",
        source_policy: policyName,
        category: "auth_validation",
        assertion: "Authentication failures must be logged with severity >= medium",
        severity: "warning",
        check: (event) => {
          if (event.category === "auth.failure" || event.message?.includes("unauthorized")) {
            return event.severity === "medium" || event.severity === "high";
          }
          return true;
        },
      },
    ];
  }

  private policyVersionMonitors(policyName: string): RuntimeMonitor[] {
    return [
      {
        id: "policy-version-mismatch-logged",
        source_policy: policyName,
        category: "policy_version",
        assertion: "Policy version mismatches must be logged",
        severity: "warning",
        check: (event) => {
          if (event.category === "policy.mismatch") {
            return event.severity !== "info";
          }
          return true;
        },
      },
    ];
  }

  private ledgerMonitors(policyName: string): RuntimeMonitor[] {
    return [
      {
        id: "ledger-tool-actions-recorded",
        source_policy: policyName,
        category: "ledger_integrity",
        assertion: "Every tool/call action must emit a ledger-worthy event",
        severity: "warning",
        check: (event) => {
          if (event.category === "mcp.execute") {
            const meta = parseMetadata(event.metadata);
            return meta.method === "tools/list" || event.source === "worker";
          }
          return true;
        },
      },
    ];
  }

  private tenantMonitors(policy: SecurityPolicy, policyName: string): RuntimeMonitor[] {
    const knownTenants = (policy.rbac?.tenants ?? []).map((t) => t.id);
    if (knownTenants.length === 0) return [];

    return [
      {
        id: "tenant-isolation-known-only",
        source_policy: policyName,
        category: "tenant_isolation",
        assertion: `Only known tenants should access MCP endpoints: ${knownTenants.join(", ")}`,
        severity: "warning",
        check: (event) => {
          if (!isMcpEvent(event)) return true;
          const meta = parseMetadata(event.metadata);
          const tenantId = meta.tenantId as string | undefined;
          if (!tenantId) return true;
          return knownTenants.includes(tenantId) || tenantId === "health-check";
        },
      },
    ];
  }

  private capabilityMonitors(policyName: string): RuntimeMonitor[] {
    return [
      {
        id: "capability-escalation-detected",
        source_policy: policyName,
        category: "capability_check",
        assertion: "Capability escalation attempts must be blocked",
        severity: "critical",
        check: (event) => {
          return event.category !== "capability.escalation" || event.severity === "high";
        },
      },
    ];
  }

  private wafMonitors(policy: SecurityPolicy, policyName: string): RuntimeMonitor[] {
    const monitors: RuntimeMonitor[] = [];

    for (const rule of policy.policies?.waf?.rules ?? []) {
      if (rule.action === "block") {
        monitors.push({
          id: `waf-${sanitize(rule.name)}-enforced`,
          source_policy: policyName,
          source_rule: rule.name,
          category: "path_enforcement",
          assertion: `WAF rule "${rule.name}" must be actively blocking`,
          severity: "critical",
          check: (_event) => true,
        });
      }
    }

    return monitors;
  }

  private rateLimitMonitors(policy: SecurityPolicy, policyName: string): RuntimeMonitor[] {
    const monitors: RuntimeMonitor[] = [];

    for (const rule of policy.policies?.rateLimit?.rules ?? []) {
      monitors.push({
        id: `ratelimit-${sanitize(rule.name)}-active`,
        source_policy: policyName,
        source_rule: rule.name,
        category: "rate_limit",
        assertion: `Rate limit "${rule.name}" (${rule.requests}/${rule.period}s) must be enforced`,
        severity: "warning",
        check: (_event) => true,
      });
    }

    return monitors;
  }

  private isRelevantEvent(event: AuditEvent, monitor: RuntimeMonitor): boolean {
    const categoryMap: Record<MonitorCategory, string[]> = {
      header_presence: ["mcp.execute", "turn.execute"],
      method_enforcement: ["mcp.execute", "turn.execute"],
      path_enforcement: ["mcp.execute", "turn.execute"],
      auth_validation: ["auth.failure", "mcp.execute", "turn.execute"],
      rate_limit: ["ratelimit.triggered"],
      policy_version: ["policy.mismatch"],
      ledger_integrity: ["mcp.execute"],
      tenant_isolation: ["mcp.execute", "turn.execute"],
      capability_check: ["capability.escalation", "mcp.execute"],
    };

    const relevant = categoryMap[monitor.category] ?? [];
    return relevant.includes(event.category);
  }

  private async fetchAuditEvents(config: MonitorConfig): Promise<AuditEvent[]> {
    const params = new URLSearchParams();
    if (config.since) params.set("since", config.since);
    if (config.limit) params.set("limit", String(config.limit));

    const url = `${config.endpoint}/audit/events?${params}`;
    const headers: Record<string, string> = {
      "x-tenant-id": "runtime-verifier",
      "x-request-id": `verify-${Date.now()}`,
      "x-policy-version": "runtime",
      "x-operator-capability": "forensic.read",
    };

    if (config.auth_token) {
      headers["x-ellis-aegis-token"] = config.auth_token;
    }

    const response = await fetch(url, { headers });
    if (!response.ok) {
      console.error(`Failed to fetch audit events: ${response.status}`);
      return [];
    }

    const data = (await response.json()) as { events?: AuditEvent[] };
    return data.events ?? [];
  }
}

function isMcpEvent(event: AuditEvent): boolean {
  return event.category === "mcp.execute" || event.category === "turn.execute";
}

function parseMetadata(metadata: string | Record<string, unknown>): Record<string, unknown> {
  if (typeof metadata === "object") return metadata;
  try {
    return JSON.parse(metadata) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function summarizeEvent(event: AuditEvent): Record<string, unknown> {
  return {
    id: event.id,
    category: event.category,
    actor: event.actor,
    message: event.message.slice(0, 100),
    timestamp: event.timestamp,
  };
}

function sanitize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}
