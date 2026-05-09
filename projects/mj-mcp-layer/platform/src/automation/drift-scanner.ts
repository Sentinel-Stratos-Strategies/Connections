import type { CrossProviderOrchestrator } from "../core/orchestrator.js";
import type { Alert, DriftReport } from "../core/types.js";

export class DriftScanner {
  private orchestrator: CrossProviderOrchestrator;

  constructor(orchestrator: CrossProviderOrchestrator) {
    this.orchestrator = orchestrator;
  }

  async scanAllProviders(): Promise<DriftReport[]> {
    const driftReports = await this.orchestrator.detectDriftAcrossProviders();
    const alertable: DriftReport[] = [];

    for (const report of driftReports) {
      if (report.unauthorizedChanges.length === 0) {
        console.log(`[drift-scanner] ${report.provider}: no drift detected`);
        continue;
      }

      console.log(`[drift-scanner] ${report.provider}: DRIFT DETECTED (${report.unauthorizedChanges.length} changes)`);
      alertable.push(report);

      await this.notifyOperator({
        severity: "high",
        provider: report.provider,
        changes: report.unauthorizedChanges,
        suggestedAction: "review and remediate",
      });
    }

    return alertable;
  }

  private async notifyOperator(alert: Alert): Promise<void> {
    console.log(`[drift-scanner] ALERT: severity=${alert.severity} provider=${alert.provider}`);
    if (alert.changes) {
      for (const change of alert.changes) {
        console.log(`  - ${change.type}: ${change.resource}`);
      }
    }
  }

  formatDriftReport(report: DriftReport): string {
    const lines: string[] = [
      `# Drift Report — ${report.provider}`,
      "",
      `Timestamp: ${report.timestamp}`,
      `Severity: ${report.severity}`,
      `Unauthorized Changes: ${report.unauthorizedChanges.length}`,
      "",
    ];

    for (const change of report.unauthorizedChanges) {
      lines.push(`- **${change.type}** ${change.resource}`);
    }

    return lines.join("\n");
  }
}
