import type { ProviderAdapter } from "../adapters/provider.interface.js";
import type { HealthReport, ProviderName } from "../core/types.js";

export class HealthCheckAggregator {
  private adapters: Map<ProviderName, ProviderAdapter>;

  constructor(adapters: Map<ProviderName, ProviderAdapter>) {
    this.adapters = adapters;
  }

  async runHealthCheckAcrossProviders(): Promise<HealthReport> {
    const report: HealthReport = {
      timestamp: new Date().toISOString(),
      providers: {},
      overallStatus: "healthy",
    };

    for (const [provider, adapter] of this.adapters) {
      try {
        const health = await adapter.healthCheck();
        report.providers[provider] = {
          status: health.ok ? "healthy" : "degraded",
          latency: health.latency,
          lastChecked: new Date().toISOString(),
          errors: health.errors ?? [],
        };

        if (!health.ok) {
          report.overallStatus = "degraded";
        }
      } catch (error) {
        report.providers[provider] = {
          status: "unhealthy",
          lastChecked: new Date().toISOString(),
          errors: [String(error)],
        };
        report.overallStatus = "unhealthy";
      }
    }

    if (report.overallStatus !== "healthy") {
      console.log(`[health] Overall status: ${report.overallStatus}`);
      for (const [p, h] of Object.entries(report.providers)) {
        if (h.status !== "healthy") {
          console.log(`  - ${p}: ${h.status} (${h.errors.join(", ")})`);
        }
      }
    }

    return report;
  }

  formatReport(report: HealthReport): string {
    const lines: string[] = [
      "# Health Report",
      "",
      `Timestamp: ${report.timestamp}`,
      `Overall: ${report.overallStatus}`,
      "",
    ];

    for (const [provider, health] of Object.entries(report.providers)) {
      const latencyStr = health.latency ? ` (${health.latency}ms)` : "";
      lines.push(`- **${provider}**: ${health.status}${latencyStr}`);
      for (const err of health.errors) {
        lines.push(`  - ${err}`);
      }
    }

    return lines.join("\n");
  }
}
