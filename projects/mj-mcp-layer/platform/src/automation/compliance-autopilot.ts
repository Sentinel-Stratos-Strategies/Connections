import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { parse as parseYAML } from "yaml";
import type { EvidenceBundle, AuditExport } from "../core/evidence-engine.js";

export interface ControlMapping {
  framework: ComplianceFramework;
  version: string;
  controls: ControlDefinition[];
}

export type ComplianceFramework = "soc2" | "pci" | "hipaa" | "iso27001";

export interface ControlDefinition {
  control_id: string;
  control_name: string;
  description: string;
  evidence_sources: EvidenceSource[];
  required: boolean;
}

export interface EvidenceSource {
  type: EvidenceSourceType;
  description: string;
  query: string;
}

type EvidenceSourceType =
  | "change_request"
  | "drift_scan"
  | "capability_visa"
  | "mutation_budget"
  | "runtime_verification"
  | "evidence_bundle"
  | "ledger_entry"
  | "agent_reputation"
  | "antibody";

export interface ControlEvidence {
  control_id: string;
  control_name: string;
  status: "covered" | "partial" | "missing";
  evidence_count: number;
  sources: GatheredEvidence[];
}

interface GatheredEvidence {
  source_type: EvidenceSourceType;
  description: string;
  artifact_count: number;
  sample_ids: string[];
}

export interface ComplianceReport {
  framework: ComplianceFramework;
  generated_at: string;
  period_start: string;
  period_end: string;
  overall_score: number;
  controls: ControlEvidence[];
  summary: ComplianceSummary;
}

interface ComplianceSummary {
  total_controls: number;
  covered: number;
  partial: number;
  missing: number;
  score_percent: number;
  recommendation: string;
}

export class ComplianceAutopilot {
  private mappingsDir: string;
  private mappings: Map<ComplianceFramework, ControlMapping>;

  constructor(mappingsDir: string) {
    this.mappingsDir = mappingsDir;
    this.mappings = this.loadMappings();
  }

  generateReport(
    framework: ComplianceFramework,
    bundles: EvidenceBundle[],
    periodStart: string,
    periodEnd: string,
    context?: ComplianceContext,
  ): ComplianceReport {
    const mapping = this.mappings.get(framework) ?? this.getDefaultMapping(framework);
    const controls: ControlEvidence[] = [];

    for (const control of mapping.controls) {
      const evidence = this.gatherEvidence(control, bundles, context);
      controls.push(evidence);
    }

    const covered = controls.filter((c) => c.status === "covered").length;
    const partial = controls.filter((c) => c.status === "partial").length;
    const missing = controls.filter((c) => c.status === "missing").length;
    const total = controls.length;
    const score = total > 0 ? ((covered + partial * 0.5) / total) * 100 : 0;

    let recommendation = "Fully compliant.";
    if (missing > 0) recommendation = `${missing} controls need evidence. Prioritize required controls.`;
    if (score < 80) recommendation = `Significant gaps. Focus on ${missing} missing controls before audit.`;

    return {
      framework,
      generated_at: new Date().toISOString(),
      period_start: periodStart,
      period_end: periodEnd,
      overall_score: Math.round(score * 10) / 10,
      controls,
      summary: { total_controls: total, covered, partial, missing, score_percent: Math.round(score * 10) / 10, recommendation },
    };
  }

  exportReport(report: ComplianceReport, outputDir: string): string {
    mkdirSync(outputDir, { recursive: true });

    const jsonPath = join(outputDir, `compliance-${report.framework}-${Date.now()}.json`);
    writeFileSync(jsonPath, JSON.stringify(report, null, 2));

    const mdPath = join(outputDir, `compliance-${report.framework}-${Date.now()}.md`);
    writeFileSync(mdPath, this.formatReport(report));

    return mdPath;
  }

  formatReport(report: ComplianceReport): string {
    const lines: string[] = [
      `# Compliance Report: ${report.framework.toUpperCase()}`,
      "",
      `| Field | Value |`,
      `|-------|-------|`,
      `| Framework | ${report.framework.toUpperCase()} |`,
      `| Generated | ${report.generated_at} |`,
      `| Period | ${report.period_start} to ${report.period_end} |`,
      `| Score | ${report.summary.score_percent}% |`,
      `| Controls | ${report.summary.total_controls} |`,
      `| Covered | ${report.summary.covered} |`,
      `| Partial | ${report.summary.partial} |`,
      `| Missing | ${report.summary.missing} |`,
      "",
      `**Recommendation:** ${report.summary.recommendation}`,
      "",
      "## Control Evidence Matrix",
      "",
      "| Control | Name | Status | Evidence |",
      "|---------|------|--------|----------|",
    ];

    for (const control of report.controls) {
      const statusIcon = { covered: "✅", partial: "🟡", missing: "❌" }[control.status];
      lines.push(
        `| ${control.control_id} | ${control.control_name} | ${statusIcon} ${control.status} | ${control.evidence_count} artifacts |`,
      );
    }

    const missing = report.controls.filter((c) => c.status === "missing");
    if (missing.length > 0) {
      lines.push("", "## Missing Controls", "");
      for (const control of missing) {
        lines.push(`### ${control.control_id}: ${control.control_name}`);
        lines.push("");
        for (const source of control.sources) {
          lines.push(`- ${source.source_type}: ${source.description} — **${source.artifact_count} artifacts found**`);
        }
        lines.push("");
      }
    }

    return lines.join("\n");
  }

  private gatherEvidence(
    control: ControlDefinition,
    bundles: EvidenceBundle[],
    context?: ComplianceContext,
  ): ControlEvidence {
    const sources: GatheredEvidence[] = [];
    let totalArtifacts = 0;

    for (const esrc of control.evidence_sources) {
      const gathered = this.queryEvidenceSource(esrc, bundles, context);
      sources.push(gathered);
      totalArtifacts += gathered.artifact_count;
    }

    let status: ControlEvidence["status"] = "missing";
    if (totalArtifacts > 0 && sources.every((s) => s.artifact_count > 0)) {
      status = "covered";
    } else if (totalArtifacts > 0) {
      status = "partial";
    }

    return {
      control_id: control.control_id,
      control_name: control.control_name,
      status,
      evidence_count: totalArtifacts,
      sources,
    };
  }

  private queryEvidenceSource(
    source: EvidenceSource,
    bundles: EvidenceBundle[],
    context?: ComplianceContext,
  ): GatheredEvidence {
    let count = 0;
    const sampleIds: string[] = [];

    switch (source.type) {
      case "evidence_bundle":
        count = bundles.length;
        sampleIds.push(...bundles.slice(0, 3).map((b) => b.id));
        break;

      case "change_request":
        count = bundles.filter((b) => b.intent.intent.includes("change")).length;
        break;

      case "drift_scan":
        count = context?.driftScanCount ?? 0;
        break;

      case "runtime_verification":
        count = bundles.reduce((n, b) => n + b.runtime_verification.length, 0);
        break;

      case "capability_visa":
        count = context?.visaCount ?? 0;
        break;

      case "mutation_budget":
        count = context?.budgetCheckCount ?? 0;
        break;

      case "ledger_entry":
        count = bundles.reduce((n, b) => n + b.ledger_entries.length, 0);
        break;

      case "agent_reputation":
        count = context?.agentCount ?? 0;
        break;

      case "antibody":
        count = context?.antibodyCount ?? 0;
        break;
    }

    return {
      source_type: source.type,
      description: source.description,
      artifact_count: count,
      sample_ids: sampleIds,
    };
  }

  private loadMappings(): Map<ComplianceFramework, ControlMapping> {
    const mappings = new Map<ComplianceFramework, ControlMapping>();
    if (!existsSync(this.mappingsDir)) return mappings;

    for (const file of readdirSync(this.mappingsDir)) {
      if (!file.endsWith(".yaml") && !file.endsWith(".yml")) continue;
      try {
        const content = readFileSync(join(this.mappingsDir, file), "utf-8");
        const data = parseYAML(content) as ControlMapping;
        if (data.framework) mappings.set(data.framework, data);
      } catch { /* skip */ }
    }

    return mappings;
  }

  private getDefaultMapping(framework: ComplianceFramework): ControlMapping {
    const defaults: Record<ComplianceFramework, ControlMapping> = {
      soc2: {
        framework: "soc2",
        version: "2017",
        controls: [
          { control_id: "CC6.1", control_name: "Logical and Physical Access Controls", description: "Access to protected information is restricted", required: true, evidence_sources: [
            { type: "capability_visa", description: "Short-lived scoped access tokens", query: "all visas in period" },
            { type: "mutation_budget", description: "Per-actor mutation spending limits", query: "all budget checks" },
            { type: "agent_reputation", description: "Agent trust scores and policies", query: "all agent reputations" },
          ] },
          { control_id: "CC6.3", control_name: "Access Removal", description: "Access is removed when no longer needed", required: true, evidence_sources: [
            { type: "capability_visa", description: "Visa expiration and revocation records", query: "expired and revoked visas" },
          ] },
          { control_id: "CC7.2", control_name: "System Monitoring", description: "System anomalies are detected and monitored", required: true, evidence_sources: [
            { type: "drift_scan", description: "Scheduled drift detection scans", query: "all drift scan reports" },
            { type: "runtime_verification", description: "Live policy verification results", query: "all verification results" },
            { type: "antibody", description: "Drift immune system antibody matches", query: "all antibody hits" },
          ] },
          { control_id: "CC8.1", control_name: "Change Management", description: "Changes are authorized, tested, and approved", required: true, evidence_sources: [
            { type: "change_request", description: "Change requests with approval records", query: "all change requests" },
            { type: "evidence_bundle", description: "Signed deployment evidence bundles", query: "all evidence bundles" },
            { type: "ledger_entry", description: "Immutable ledger entries", query: "all ledger entries" },
          ] },
        ],
      },
      pci: {
        framework: "pci",
        version: "4.0",
        controls: [
          { control_id: "6.5", control_name: "Secure Development", description: "Applications developed securely", required: true, evidence_sources: [
            { type: "evidence_bundle", description: "Mutation test results in evidence bundles", query: "bundles with mutation tests" },
            { type: "runtime_verification", description: "Runtime policy verification", query: "verification results" },
          ] },
          { control_id: "10.1", control_name: "Audit Trails", description: "Audit trails link access to individual users", required: true, evidence_sources: [
            { type: "ledger_entry", description: "Signed immutable ledger entries", query: "all ledger entries" },
            { type: "evidence_bundle", description: "Evidence bundles with actor attribution", query: "all bundles" },
          ] },
          { control_id: "10.2", control_name: "Automated Audit Trails", description: "Automated audit trails for events", required: true, evidence_sources: [
            { type: "drift_scan", description: "Automated drift detection", query: "all scans" },
            { type: "change_request", description: "Automated change tracking", query: "all requests" },
          ] },
        ],
      },
      hipaa: {
        framework: "hipaa",
        version: "2013",
        controls: [
          { control_id: "164.312(a)", control_name: "Access Control", description: "Technical policies for electronic information systems", required: true, evidence_sources: [
            { type: "capability_visa", description: "Scoped access tokens", query: "all visas" },
            { type: "mutation_budget", description: "Access spending limits", query: "all budgets" },
          ] },
          { control_id: "164.312(b)", control_name: "Audit Controls", description: "Hardware, software, and procedural mechanisms for audit", required: true, evidence_sources: [
            { type: "ledger_entry", description: "Immutable audit ledger", query: "all entries" },
            { type: "drift_scan", description: "Configuration audit scans", query: "all scans" },
          ] },
          { control_id: "164.312(c)", control_name: "Integrity", description: "Policies to protect ePHI from improper alteration", required: true, evidence_sources: [
            { type: "evidence_bundle", description: "Signed evidence with integrity hashes", query: "all bundles" },
            { type: "runtime_verification", description: "Runtime integrity checks", query: "all verifications" },
          ] },
        ],
      },
      iso27001: {
        framework: "iso27001",
        version: "2022",
        controls: [
          { control_id: "A.8.1", control_name: "User Endpoint Devices", description: "Information stored, processed, or accessible via endpoint devices shall be protected", required: true, evidence_sources: [
            { type: "capability_visa", description: "Agent access controls", query: "all visas" },
          ] },
          { control_id: "A.8.9", control_name: "Configuration Management", description: "Configurations shall be established, documented, implemented, monitored, and reviewed", required: true, evidence_sources: [
            { type: "drift_scan", description: "Configuration drift detection", query: "all scans" },
            { type: "change_request", description: "Configuration change records", query: "all requests" },
            { type: "evidence_bundle", description: "Configuration evidence bundles", query: "all bundles" },
          ] },
        ],
      },
    };

    return defaults[framework];
  }
}

export interface ComplianceContext {
  driftScanCount: number;
  visaCount: number;
  budgetCheckCount: number;
  agentCount: number;
  antibodyCount: number;
}
