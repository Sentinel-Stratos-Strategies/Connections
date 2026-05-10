import type { ProviderAdapter } from "../adapters/provider.interface.js";
import type { UniversalLedger } from "../core/ledger.js";
import type {
  DriftReport,
  LedgerEntry,
  ProviderName,
} from "../core/types.js";

interface RemediationPlan {
  provider: ProviderName;
  baselineVersion: string;
  driftCount: number;
  actions: RemediationAction[];
}

interface RemediationAction {
  type: "revert" | "delete" | "update";
  resource: string;
  description: string;
}

interface ApprovalConfig {
  timeoutMs: number;
  autoApprove: boolean;
  notifyChannels: NotifyChannel[];
}

type NotifyChannel = "console" | "github";

interface GitHubConfig {
  token: string;
  owner: string;
  repo: string;
}

export class AutoRemediation {
  private adapters: Map<ProviderName, ProviderAdapter>;
  private ledger: UniversalLedger;
  private approvalConfig: ApprovalConfig;
  private github?: GitHubConfig;

  constructor(
    adapters: Map<ProviderName, ProviderAdapter>,
    ledger: UniversalLedger,
    approvalConfig?: Partial<ApprovalConfig>,
    github?: GitHubConfig,
  ) {
    this.adapters = adapters;
    this.ledger = ledger;
    this.approvalConfig = {
      timeoutMs: approvalConfig?.timeoutMs ?? 60000,
      autoApprove: approvalConfig?.autoApprove ?? false,
      notifyChannels: approvalConfig?.notifyChannels ?? ["console"],
      ...approvalConfig,
    };
    this.github = github;
  }

  async remediateWithApproval(drift: DriftReport): Promise<RemediationResult> {
    if (drift.unauthorizedChanges.length === 0) {
      return { status: "no_drift", provider: drift.provider };
    }

    const plan = this.generateRemediationPlan(drift);

    await this.notifyOperator(plan, drift);

    let issueNumber: number | undefined;
    if (this.github && this.approvalConfig.notifyChannels.includes("github")) {
      issueNumber = await this.createRemediationIssue(plan, drift);
    }

    let approved: boolean;
    if (this.approvalConfig.autoApprove) {
      console.log(`[auto-remediation] Auto-approve enabled for ${drift.provider}`);
      approved = true;
    } else {
      approved = await this.waitForApproval(issueNumber);
    }

    if (!approved) {
      await this.escalate(drift, plan);
      return {
        status: "timeout",
        provider: drift.provider,
        plan,
        message: "Approval timed out — escalated to operator",
      };
    }

    return this.executeRemediation(drift, plan, issueNumber);
  }

  private async executeRemediation(
    drift: DriftReport,
    plan: RemediationPlan,
    issueNumber?: number,
  ): Promise<RemediationResult> {
    const adapter = this.adapters.get(drift.provider);
    if (!adapter) {
      return {
        status: "failed",
        provider: drift.provider,
        message: `Adapter not found for ${drift.provider}`,
      };
    }

    try {
      const result = await adapter.revertPolicy(plan.baselineVersion);

      const entry: LedgerEntry = {
        ts: new Date().toISOString(),
        intent: "auto_remediation",
        provider: drift.provider,
        hash: result.id,
        changeId: result.id,
        source: "automation",
        payload: {
          drift: {
            count: drift.unauthorizedChanges.length,
            severity: drift.severity,
          },
          plan: {
            actions: plan.actions.length,
            baselineVersion: plan.baselineVersion,
          },
        },
        result: "success",
      };

      await this.ledger.recordEntry(entry);

      if (issueNumber && this.github) {
        await this.closeIssueWithComment(
          issueNumber,
          `Remediation executed successfully at ${new Date().toISOString()}.\n\nReverted to baseline: ${plan.baselineVersion}\nActions taken: ${plan.actions.length}`,
        );
      }

      return {
        status: "remediated",
        provider: drift.provider,
        plan,
        changeId: result.id,
      };
    } catch (error) {
      const entry: LedgerEntry = {
        ts: new Date().toISOString(),
        intent: "auto_remediation",
        provider: drift.provider,
        hash: "failed",
        changeId: "failed",
        source: "automation",
        payload: { drift, plan },
        result: "failure",
        error: String(error),
      };

      await this.ledger.recordEntry(entry);

      return {
        status: "failed",
        provider: drift.provider,
        plan,
        message: String(error),
      };
    }
  }

  private generateRemediationPlan(drift: DriftReport): RemediationPlan {
    const actions: RemediationAction[] = drift.unauthorizedChanges.map(
      (change) => ({
        type: change.type === "added" ? "delete" : "revert",
        resource: change.resource,
        description: `${change.type}: revert ${change.resource} to baseline`,
      }),
    );

    return {
      provider: drift.provider,
      baselineVersion: `baseline-${drift.timestamp}`,
      driftCount: drift.unauthorizedChanges.length,
      actions,
    };
  }

  private async notifyOperator(
    plan: RemediationPlan,
    drift: DriftReport,
  ): Promise<void> {
    if (this.approvalConfig.notifyChannels.includes("console")) {
      console.log(`\n[auto-remediation] Remediation plan for ${drift.provider}:`);
      console.log(`  Drift severity: ${drift.severity}`);
      console.log(`  Unauthorized changes: ${drift.unauthorizedChanges.length}`);
      console.log(`  Planned actions: ${plan.actions.length}`);
      for (const action of plan.actions) {
        console.log(`    - ${action.type}: ${action.resource}`);
      }
      console.log(
        `  Approval mode: ${this.approvalConfig.autoApprove ? "auto" : "manual"}`,
      );
      console.log(
        `  Timeout: ${this.approvalConfig.timeoutMs / 1000}s\n`,
      );
    }
  }

  private async createRemediationIssue(
    plan: RemediationPlan,
    drift: DriftReport,
  ): Promise<number> {
    if (!this.github) return 0;

    const body = [
      `## Auto-Remediation: ${drift.provider}`,
      "",
      `**Severity:** ${drift.severity}`,
      `**Detected:** ${drift.timestamp}`,
      `**Unauthorized Changes:** ${drift.unauthorizedChanges.length}`,
      "",
      "### Remediation Plan",
      "",
      ...plan.actions.map(
        (a) => `- **${a.type}** \`${a.resource}\`: ${a.description}`,
      ),
      "",
      `### Baseline: \`${plan.baselineVersion}\``,
      "",
      "---",
      "",
      "To approve remediation: add the `approved` label.",
      "To reject: close this issue.",
      `Auto-timeout: ${this.approvalConfig.timeoutMs / 1000}s`,
    ].join("\n");

    const response = await fetch(
      `https://api.github.com/repos/${this.github.owner}/${this.github.repo}/issues`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.github.token}`,
          "Content-Type": "application/json",
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        body: JSON.stringify({
          title: `Auto-Remediation: ${drift.provider} (${drift.severity})`,
          body,
          labels: ["auto-remediation", "drift", drift.provider],
        }),
      },
    );

    if (!response.ok) return 0;
    const result = (await response.json()) as { number: number };
    return result.number;
  }

  private async waitForApproval(issueNumber?: number): Promise<boolean> {
    if (!issueNumber || !this.github) {
      console.log(
        `[auto-remediation] No GitHub issue — approval defaults to ${this.approvalConfig.autoApprove ? "approved" : "denied"}`,
      );
      return this.approvalConfig.autoApprove;
    }

    const deadline = Date.now() + this.approvalConfig.timeoutMs;
    const pollInterval = Math.min(10000, this.approvalConfig.timeoutMs / 6);

    while (Date.now() < deadline) {
      const approved = await this.checkIssueApproved(issueNumber);
      if (approved) return true;

      const closed = await this.checkIssueClosed(issueNumber);
      if (closed) return false;

      await sleep(pollInterval);
    }

    return false;
  }

  private async checkIssueApproved(issueNumber: number): Promise<boolean> {
    if (!this.github) return false;

    const response = await fetch(
      `https://api.github.com/repos/${this.github.owner}/${this.github.repo}/issues/${issueNumber}/labels`,
      {
        headers: {
          Authorization: `Bearer ${this.github.token}`,
          Accept: "application/vnd.github+json",
        },
      },
    );

    if (!response.ok) return false;
    const labels = (await response.json()) as Array<{ name: string }>;
    return labels.some((l) => l.name === "approved");
  }

  private async checkIssueClosed(issueNumber: number): Promise<boolean> {
    if (!this.github) return false;

    const response = await fetch(
      `https://api.github.com/repos/${this.github.owner}/${this.github.repo}/issues/${issueNumber}`,
      {
        headers: {
          Authorization: `Bearer ${this.github.token}`,
          Accept: "application/vnd.github+json",
        },
      },
    );

    if (!response.ok) return false;
    const issue = (await response.json()) as { state: string };
    return issue.state === "closed";
  }

  private async closeIssueWithComment(
    issueNumber: number,
    comment: string,
  ): Promise<void> {
    if (!this.github) return;

    await fetch(
      `https://api.github.com/repos/${this.github.owner}/${this.github.repo}/issues/${issueNumber}/comments`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.github.token}`,
          "Content-Type": "application/json",
          Accept: "application/vnd.github+json",
        },
        body: JSON.stringify({ body: comment }),
      },
    );

    await fetch(
      `https://api.github.com/repos/${this.github.owner}/${this.github.repo}/issues/${issueNumber}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${this.github.token}`,
          "Content-Type": "application/json",
          Accept: "application/vnd.github+json",
        },
        body: JSON.stringify({ state: "closed" }),
      },
    );
  }

  private async escalate(
    drift: DriftReport,
    plan: RemediationPlan,
  ): Promise<void> {
    console.log(
      `[auto-remediation] ESCALATION: Approval timed out for ${drift.provider}`,
    );
    console.log(`  Severity: ${drift.severity}`);
    console.log(`  Planned actions: ${plan.actions.length}`);
    console.log("  Escalating to operator for manual review.");
  }

  formatPlan(plan: RemediationPlan): string {
    const lines = [
      `# Remediation Plan: ${plan.provider}`,
      "",
      `Baseline: ${plan.baselineVersion}`,
      `Drift count: ${plan.driftCount}`,
      `Actions: ${plan.actions.length}`,
      "",
    ];

    for (const action of plan.actions) {
      lines.push(`- **${action.type}** \`${action.resource}\`: ${action.description}`);
    }

    return lines.join("\n");
  }
}

export interface RemediationResult {
  status: "no_drift" | "remediated" | "timeout" | "failed";
  provider: ProviderName;
  plan?: RemediationPlan;
  changeId?: string;
  message?: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
