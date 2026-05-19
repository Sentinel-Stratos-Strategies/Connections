import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { parse as parseYAML, stringify as stringifyYAML } from "yaml";
import type {
  DriftChange,
  DriftReport,
  ProviderName,
} from "../core/types.js";

export type DriftSeverity =
  | "harmless"
  | "suspicious"
  | "policy_violation"
  | "active_threat"
  | "emergency_drift";

export type DriftResponse =
  | "observe"
  | "open_issue"
  | "revert_with_approval"
  | "lockdown"
  | "retroactive_change_request";

export interface ClassifiedDrift {
  change: DriftChange;
  severity: DriftSeverity;
  response: DriftResponse;
  reasoning: string;
  antibody: Antibody | null;
  matched_antibody: string | null;
}

export interface Antibody {
  id: string;
  trigger: string;
  pattern: AntibodyPattern;
  action: "observe" | "quarantine" | "revert" | "lockdown" | "alert";
  requires_approval: boolean;
  evidence_required: boolean;
  created_from?: string;
  created_at: string;
  hit_count: number;
}

interface AntibodyPattern {
  resource_type?: string;
  change_type?: DriftChange["type"];
  provider?: ProviderName;
  resource_match?: string;
}

interface ClassificationRule {
  name: string;
  match: (change: DriftChange, context: DriftContext) => boolean;
  severity: DriftSeverity;
  response: DriftResponse;
  reasoning: string;
}

export interface DriftContext {
  provider: ProviderName;
  recent_incidents: number;
  recent_changes: number;
  has_active_incident: boolean;
  operator_online: boolean;
}

export interface ClassifiedDriftReport {
  provider: ProviderName;
  timestamp: string;
  total_changes: number;
  classified: ClassifiedDrift[];
  severity_counts: Record<DriftSeverity, number>;
  recommended_actions: RecommendedAction[];
  new_antibodies: Antibody[];
}

interface RecommendedAction {
  priority: number;
  action: string;
  targets: string[];
  requires_approval: boolean;
}

const CLASSIFICATION_RULES: ClassificationRule[] = [
  {
    name: "cloudflare-generated-id",
    match: (change) =>
      change.resource.includes(":id") ||
      change.resource.includes("generated") ||
      (change.type === "modified" && typeof change.current === "string" && /^[a-f0-9]{32}$/.test(change.current as string)),
    severity: "harmless",
    response: "observe",
    reasoning: "Cloudflare-generated identifier rotation — no security impact",
  },
  {
    name: "certificate-renewal",
    match: (change) =>
      change.resource.includes("ssl") ||
      change.resource.includes("certificate") ||
      change.resource.includes("tls"),
    severity: "harmless",
    response: "observe",
    reasoning: "SSL/TLS certificate renewal — expected automated behavior",
  },
  {
    name: "unauthorized-dns-record",
    match: (change) =>
      change.resource.includes("dns") && change.type === "added",
    severity: "suspicious",
    response: "open_issue",
    reasoning: "New DNS record not in ledger — may be unauthorized",
  },
  {
    name: "waf-rule-disabled",
    match: (change) =>
      change.resource.includes("waf") &&
      (change.type === "removed" || change.type === "modified"),
    severity: "policy_violation",
    response: "revert_with_approval",
    reasoning: "WAF rule modified or removed outside change control",
  },
  {
    name: "rate-limit-removed",
    match: (change) =>
      change.resource.includes("ratelimit") && change.type === "removed",
    severity: "policy_violation",
    response: "revert_with_approval",
    reasoning: "Rate limit rule removed — blast radius protection weakened",
  },
  {
    name: "rate-limit-modified",
    match: (change) =>
      change.resource.includes("ratelimit") && change.type === "modified",
    severity: "suspicious",
    response: "open_issue",
    reasoning: "Rate limit rule modified — review for loosening",
  },
  {
    name: "worker-route-changed",
    match: (change) =>
      change.resource.includes("worker") && change.resource.includes("route"),
    severity: "suspicious",
    response: "open_issue",
    reasoning: "Worker route changed — traffic routing may be affected",
  },
  {
    name: "scanner-disabled-with-token-change",
    match: (change, context) =>
      (change.resource.includes("scan") || change.resource.includes("monitor")) &&
      context.recent_changes > 3,
    severity: "active_threat",
    response: "lockdown",
    reasoning: "Monitoring capability disabled alongside multiple changes — potential compromise",
  },
  {
    name: "multiple-simultaneous-changes",
    match: (_change, context) =>
      context.recent_changes > 10 && !context.operator_online,
    severity: "active_threat",
    response: "lockdown",
    reasoning: "High-velocity changes with no operator present — potential automated attack",
  },
  {
    name: "incident-hotfix",
    match: (_change, context) =>
      context.has_active_incident && context.operator_online,
    severity: "emergency_drift",
    response: "retroactive_change_request",
    reasoning: "Change during active incident with operator present — likely authorized hotfix",
  },
];

export class DriftClassifier {
  private antibodyPath: string;
  private antibodies: Antibody[];

  constructor(antibodyPath: string) {
    this.antibodyPath = antibodyPath;
    this.antibodies = this.loadAntibodies();
  }

  classifyReport(
    report: DriftReport,
    context: DriftContext,
    options: { persistNewAntibodies?: boolean } = {},
  ): ClassifiedDriftReport {
    const classified: ClassifiedDrift[] = [];
    const newAntibodies: Antibody[] = [];

    for (const change of report.unauthorizedChanges) {
      const result = this.classify(change, context);
      classified.push(result);

      if (result.severity !== "harmless" && !result.matched_antibody) {
        const antibody = this.generateAntibody(result);
        newAntibodies.push(antibody);
        if (options.persistNewAntibodies) {
          this.antibodies.push(antibody);
        }
      }
    }

    const severityCounts: Record<DriftSeverity, number> = {
      harmless: 0,
      suspicious: 0,
      policy_violation: 0,
      active_threat: 0,
      emergency_drift: 0,
    };
    for (const c of classified) {
      severityCounts[c.severity]++;
    }

    const actions = this.generateRecommendedActions(classified);

    if (options.persistNewAntibodies && newAntibodies.length > 0) {
      this.saveAntibodies();
    }

    return {
      provider: report.provider,
      timestamp: new Date().toISOString(),
      total_changes: report.unauthorizedChanges.length,
      classified,
      severity_counts: severityCounts,
      recommended_actions: actions,
      new_antibodies: newAntibodies,
    };
  }

  classify(change: DriftChange, context: DriftContext): ClassifiedDrift {
    const existingAntibody = this.matchAntibody(change);
    if (existingAntibody) {
      existingAntibody.hit_count++;
      return {
        change,
        severity: antibodyActionToSeverity(existingAntibody.action),
        response: antibodyActionToResponse(existingAntibody.action),
        reasoning: `Matched antibody: ${existingAntibody.trigger}`,
        antibody: null,
        matched_antibody: existingAntibody.id,
      };
    }

    for (const rule of CLASSIFICATION_RULES) {
      if (rule.match(change, context)) {
        return {
          change,
          severity: rule.severity,
          response: rule.response,
          reasoning: rule.reasoning,
          antibody: null,
          matched_antibody: null,
        };
      }
    }

    return {
      change,
      severity: "suspicious",
      response: "open_issue",
      reasoning: "Unclassified drift — defaulting to suspicious",
      antibody: null,
      matched_antibody: null,
    };
  }

  generateAntibody(classified: ClassifiedDrift): Antibody {
    const resourceType = classified.change.resource.split(":")[0] ?? "unknown";

    return {
      id: `ab-${resourceType}-${Date.now()}`,
      trigger: `${classified.change.type}_${resourceType}`,
      pattern: {
        resource_type: resourceType,
        change_type: classified.change.type,
        resource_match: classified.change.resource,
      },
      action: severityToAntibodyAction(classified.severity),
      requires_approval: classified.severity === "policy_violation" || classified.severity === "active_threat",
      evidence_required: classified.severity !== "harmless",
      created_from: classified.reasoning,
      created_at: new Date().toISOString(),
      hit_count: 0,
    };
  }

  matchAntibody(change: DriftChange): Antibody | null {
    for (const ab of this.antibodies) {
      if (ab.pattern.change_type && ab.pattern.change_type !== change.type) continue;

      if (ab.pattern.resource_type) {
        const resourceType = change.resource.split(":")[0];
        if (resourceType !== ab.pattern.resource_type) continue;
      }

      if (ab.pattern.resource_match && change.resource !== ab.pattern.resource_match) continue;

      return ab;
    }
    return null;
  }

  formatReport(report: ClassifiedDriftReport): string {
    const lines: string[] = [
      `# Drift Classification Report — ${report.provider}`,
      "",
      `| Metric | Value |`,
      `|--------|-------|`,
      `| Total changes | ${report.total_changes} |`,
      `| Harmless | ${report.severity_counts.harmless} |`,
      `| Suspicious | ${report.severity_counts.suspicious} |`,
      `| Policy violations | ${report.severity_counts.policy_violation} |`,
      `| Active threats | ${report.severity_counts.active_threat} |`,
      `| Emergency drift | ${report.severity_counts.emergency_drift} |`,
      "",
    ];

    if (report.severity_counts.active_threat > 0) {
      lines.push("## 🔴 ACTIVE THREATS", "");
      for (const c of report.classified.filter((x) => x.severity === "active_threat")) {
        lines.push(`- **${c.change.resource}** (${c.change.type}): ${c.reasoning}`);
        lines.push(`  Response: **${c.response}**`);
      }
      lines.push("");
    }

    if (report.severity_counts.policy_violation > 0) {
      lines.push("## 🟠 POLICY VIOLATIONS", "");
      for (const c of report.classified.filter((x) => x.severity === "policy_violation")) {
        lines.push(`- **${c.change.resource}** (${c.change.type}): ${c.reasoning}`);
        lines.push(`  Response: **${c.response}**`);
      }
      lines.push("");
    }

    if (report.severity_counts.suspicious > 0) {
      lines.push("## 🟡 SUSPICIOUS", "");
      for (const c of report.classified.filter((x) => x.severity === "suspicious")) {
        lines.push(`- **${c.change.resource}** (${c.change.type}): ${c.reasoning}`);
      }
      lines.push("");
    }

    if (report.recommended_actions.length > 0) {
      lines.push("## Recommended Actions", "");
      for (const action of report.recommended_actions) {
        const approvalTag = action.requires_approval ? " [APPROVAL REQUIRED]" : "";
        lines.push(`${action.priority}. **${action.action}**${approvalTag}`);
        lines.push(`   Targets: ${action.targets.join(", ")}`);
      }
      lines.push("");
    }

    if (report.new_antibodies.length > 0) {
      lines.push("## New Antibodies Generated", "");
      for (const ab of report.new_antibodies) {
        lines.push(`- \`${ab.id}\`: trigger=${ab.trigger}, action=${ab.action}`);
      }
    }

    return lines.join("\n");
  }

  private generateRecommendedActions(classified: ClassifiedDrift[]): RecommendedAction[] {
    const actions: RecommendedAction[] = [];
    let priority = 1;

    const threats = classified.filter((c) => c.severity === "active_threat");
    if (threats.length > 0) {
      actions.push({
        priority: priority++,
        action: "LOCKDOWN: Freeze all mutations and alert operator immediately",
        targets: threats.map((t) => t.change.resource),
        requires_approval: false,
      });
    }

    const violations = classified.filter((c) => c.severity === "policy_violation");
    if (violations.length > 0) {
      actions.push({
        priority: priority++,
        action: "REVERT: Restore policy-violating changes to baseline",
        targets: violations.map((v) => v.change.resource),
        requires_approval: true,
      });
    }

    const suspicious = classified.filter((c) => c.severity === "suspicious");
    if (suspicious.length > 0) {
      actions.push({
        priority: priority++,
        action: "INVESTIGATE: Open GitHub issues for suspicious changes",
        targets: suspicious.map((s) => s.change.resource),
        requires_approval: false,
      });
    }

    const emergency = classified.filter((c) => c.severity === "emergency_drift");
    if (emergency.length > 0) {
      actions.push({
        priority: priority++,
        action: "RETROACTIVE CR: Create change requests for emergency hotfixes",
        targets: emergency.map((e) => e.change.resource),
        requires_approval: false,
      });
    }

    return actions;
  }

  private loadAntibodies(): Antibody[] {
    if (!existsSync(this.antibodyPath)) return [];
    try {
      const content = readFileSync(this.antibodyPath, "utf-8");
      const data = parseYAML(content) as { antibodies?: Antibody[] };
      return data.antibodies ?? [];
    } catch {
      return [];
    }
  }

  private saveAntibodies(): void {
    const data = { antibodies: this.antibodies };
    writeFileSync(this.antibodyPath, stringifyYAML(data));
  }
}

function antibodyActionToSeverity(action: Antibody["action"]): DriftSeverity {
  switch (action) {
    case "observe": return "harmless";
    case "alert": return "suspicious";
    case "quarantine": return "suspicious";
    case "revert": return "policy_violation";
    case "lockdown": return "active_threat";
  }
}

function antibodyActionToResponse(action: Antibody["action"]): DriftResponse {
  switch (action) {
    case "observe": return "observe";
    case "alert": return "open_issue";
    case "quarantine": return "open_issue";
    case "revert": return "revert_with_approval";
    case "lockdown": return "lockdown";
  }
}

function severityToAntibodyAction(severity: DriftSeverity): Antibody["action"] {
  switch (severity) {
    case "harmless": return "observe";
    case "suspicious": return "alert";
    case "policy_violation": return "revert";
    case "active_threat": return "lockdown";
    case "emergency_drift": return "alert";
  }
}
