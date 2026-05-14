import type { ProviderAdapter } from "../adapters/provider.interface.js";
import type {
  ComplianceCheck,
  ComplianceReport,
  InventorySnapshot,
  ProviderName,
} from "../core/types.js";

export class ComplianceChecker {
  private adapters: Map<ProviderName, ProviderAdapter>;

  constructor(adapters: Map<ProviderName, ProviderAdapter>) {
    this.adapters = adapters;
  }

  async validateComplianceAcrossProviders(): Promise<ComplianceReport> {
    const report: ComplianceReport = {
      timestamp: new Date().toISOString(),
      providers: {},
      overallScore: 0,
    };

    const checks: Array<{ name: string; validate: (inv: InventorySnapshot) => boolean }> = [
      { name: "failClosedDefault", validate: (inv) => inv.denyByDefault === true },
      { name: "immutableAudit", validate: (inv) => inv.auditImmutable === true },
      { name: "ratelimitEnabled", validate: (inv) => inv.rateLimit?.enabled === true },
      { name: "encryptionInTransit", validate: (inv) => inv.encryptInTransit === true },
    ];

    let totalScore = 0;
    let providerCount = 0;

    for (const [provider, adapter] of this.adapters) {
      const inventory = await adapter.getInventory();
      const results: ComplianceCheck[] = checks.map((check) => ({
        name: check.name,
        passed: check.validate(inventory),
      }));

      const score = (results.filter((r) => r.passed).length / checks.length) * 100;

      report.providers[provider] = {
        score,
        results,
        status: score === 100 ? "compliant" : "non-compliant",
      };

      totalScore += score;
      providerCount++;
    }

    report.overallScore = providerCount > 0 ? totalScore / providerCount : 0;

    if (report.overallScore < 95) {
      console.log(`[compliance] WARNING: score dropped to ${report.overallScore.toFixed(1)}%`);
    }

    return report;
  }

  formatReport(report: ComplianceReport): string {
    const lines: string[] = [
      "# Compliance Report",
      "",
      `Timestamp: ${report.timestamp}`,
      `Overall Score: ${report.overallScore.toFixed(1)}%`,
      "",
    ];

    for (const [provider, result] of Object.entries(report.providers)) {
      lines.push(`## ${provider}`);
      lines.push(`Score: ${result.score.toFixed(1)}% (${result.status})`);
      for (const check of result.results) {
        lines.push(`  - ${check.passed ? "PASS" : "FAIL"}: ${check.name}`);
      }
      lines.push("");
    }

    return lines.join("\n");
  }
}
