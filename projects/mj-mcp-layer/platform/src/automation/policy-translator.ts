import type { SecurityPolicy, ProviderName, WafRule } from "../core/types.js";

interface AbstractPolicy {
  name: string;
  denyByDefault: boolean;
  rules: AbstractRule[];
  rateLimits: AbstractRateLimit[];
}

interface AbstractRule {
  name: string;
  expression: string;
  pattern?: string;
  action: string;
}

interface AbstractRateLimit {
  name: string;
  requests: number;
  period: number;
  action: string;
}

export class PolicyTranslator {
  translate(
    policy: SecurityPolicy,
    _fromProvider: ProviderName,
    toProvider: ProviderName,
  ): string {
    const abstract = this.toAbstract(policy);

    const translators: Record<ProviderName, (p: AbstractPolicy) => string> = {
      cloudflare: (p) => this.toCloudflare(p),
      aws: (p) => this.toAWS(p),
      kubernetes: (p) => this.toKubernetes(p),
      terraform: (p) => this.toTerraform(p, policy),
    };

    const translator = translators[toProvider];
    if (!translator) {
      throw new Error(`No translator for provider: ${toProvider}`);
    }

    return translator(abstract);
  }

  private toAbstract(policy: SecurityPolicy): AbstractPolicy {
    return {
      name: policy.name,
      denyByDefault: policy.securityDefaults?.denyByDefault ?? true,
      rules: (policy.policies?.waf?.rules ?? []).map((r) => ({
        name: r.name,
        expression: r.expression,
        pattern: extractPattern(r),
        action: r.action,
      })),
      rateLimits: (policy.policies?.rateLimit?.rules ?? []).map((r) => ({
        name: r.name,
        requests: r.requests,
        period: r.period,
        action: r.action,
      })),
    };
  }

  private toCloudflare(policy: AbstractPolicy): string {
    const lines = [
      `# Cloudflare configuration for: ${policy.name}`,
      `# Generated: ${new Date().toISOString()}`,
      "",
    ];

    for (const rule of policy.rules) {
      lines.push(
        `resource "cloudflare_ruleset" "${sanitizeName(rule.name)}" {`,
        `  zone_id     = var.zone_id`,
        `  name        = "${rule.name}"`,
        `  description = "${rule.name}"`,
        `  kind        = "zone"`,
        `  phase       = "http_request_firewall_custom"`,
        "",
        `  rules {`,
        `    action      = "${rule.action}"`,
        `    expression  = "${escapeHCL(rule.expression)}"`,
        `    description = "${rule.name}"`,
        `    enabled     = true`,
        `  }`,
        `}`,
        "",
      );
    }

    for (const rl of policy.rateLimits) {
      lines.push(
        `resource "cloudflare_ruleset" "${sanitizeName(rl.name)}" {`,
        `  zone_id = var.zone_id`,
        `  name    = "${rl.name}"`,
        `  kind    = "zone"`,
        `  phase   = "http_ratelimit"`,
        "",
        `  rules {`,
        `    action     = "${rl.action}"`,
        `    expression = "true"`,
        `    ratelimit {`,
        `      characteristics     = ["ip.src", "cf.colo.id"]`,
        `      period              = ${rl.period}`,
        `      requests_per_period = ${rl.requests}`,
        `      mitigation_timeout  = ${rl.period}`,
        `    }`,
        `  }`,
        `}`,
        "",
      );
    }

    return lines.join("\n");
  }

  private toAWS(policy: AbstractPolicy): string {
    const lines = [
      `# AWS WAFv2 configuration for: ${policy.name}`,
      `# Generated: ${new Date().toISOString()}`,
      "",
      `resource "aws_wafv2_web_acl" "${sanitizeName(policy.name)}" {`,
      `  name        = "${policy.name}"`,
      `  description = "Generated from MJ MCP policy"`,
      `  scope       = "REGIONAL"`,
      "",
      `  default_action {`,
      policy.denyByDefault ? `    block {}` : `    allow {}`,
      `  }`,
      "",
    ];

    for (let i = 0; i < policy.rules.length; i++) {
      const rule = policy.rules[i];
      lines.push(
        `  rule {`,
        `    name     = "${rule.name}"`,
        `    priority = ${i + 1}`,
        "",
        `    action {`,
        `      ${rule.action === "block" ? "block {}" : "allow {}"}`,
        `    }`,
        "",
        `    statement {`,
        `      byte_match_statement {`,
        `        search_string         = "${rule.pattern ?? rule.expression}"`,
        `        positional_constraint = "CONTAINS"`,
        `        field_to_match {`,
        `          uri_path {}`,
        `        }`,
        `        text_transformation {`,
        `          priority = 0`,
        `          type     = "NONE"`,
        `        }`,
        `      }`,
        `    }`,
        "",
        `    visibility_config {`,
        `      sampled_requests_enabled   = true`,
        `      cloudwatch_metrics_enabled = true`,
        `      metric_name                = "${sanitizeName(rule.name)}"`,
        `    }`,
        `  }`,
        "",
      );
    }

    lines.push(
      `  visibility_config {`,
      `    sampled_requests_enabled   = true`,
      `    cloudwatch_metrics_enabled = true`,
      `    metric_name                = "${sanitizeName(policy.name)}"`,
      `  }`,
      `}`,
    );

    return lines.join("\n");
  }

  private toKubernetes(policy: AbstractPolicy): string {
    const lines = [
      `# Kubernetes NetworkPolicy for: ${policy.name}`,
      `# Generated: ${new Date().toISOString()}`,
      `---`,
      `apiVersion: networking.k8s.io/v1`,
      `kind: NetworkPolicy`,
      `metadata:`,
      `  name: ${sanitizeName(policy.name)}`,
      `  labels:`,
      `    app.kubernetes.io/managed-by: mj-mcp-platform`,
      `spec:`,
      `  podSelector:`,
      `    matchLabels:`,
      `      app: mcp`,
      `  policyTypes:`,
      `    - Ingress`,
      `  ingress:`,
      `    - from:`,
      `        - namespaceSelector:`,
      `            matchLabels:`,
      `              name: mcp`,
      `      ports:`,
      `        - protocol: TCP`,
      `          port: 443`,
    ];

    if (policy.rules.length > 0) {
      lines.push(
        `---`,
        `# WAF-equivalent rules are enforced at the ingress controller level.`,
        `# Configure your ingress controller (nginx, istio, etc.) with:`,
      );
      for (const rule of policy.rules) {
        lines.push(`#   - ${rule.name}: ${rule.action} when ${rule.expression}`);
      }
    }

    return lines.join("\n");
  }

  private toTerraform(
    policy: AbstractPolicy,
    original: SecurityPolicy,
  ): string {
    const lines = [
      `# Multi-provider Terraform configuration for: ${policy.name}`,
      `# Generated: ${new Date().toISOString()}`,
      "",
      `variable "zone_id" {`,
      `  type        = string`,
      `  description = "Cloudflare zone ID"`,
      `}`,
      "",
      `variable "aws_region" {`,
      `  type    = string`,
      `  default = "us-east-1"`,
      `}`,
      "",
    ];

    if (original.targetProviders.includes("cloudflare")) {
      lines.push(
        "# --- Cloudflare Resources ---",
        "",
        this.toCloudflare(policy),
      );
    }

    if (original.targetProviders.includes("aws")) {
      lines.push(
        "# --- AWS Resources ---",
        "",
        this.toAWS(policy),
      );
    }

    return lines.join("\n");
  }
}

function sanitizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

function escapeHCL(value: string): string {
  return value.replace(/"/g, '\\"');
}

function extractPattern(rule: WafRule): string | undefined {
  const match = rule.expression.match(/["']([^"']+)["']/);
  return match?.[1];
}
