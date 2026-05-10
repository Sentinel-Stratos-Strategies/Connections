import type { ProviderAdapter } from "../adapters/provider.interface.js";
import type { CrossProviderOrchestrator } from "../core/orchestrator.js";
import type { UniversalLedger } from "../core/ledger.js";
import type {
  ChangeRequest,
  ExecutionReport,
  LedgerEntry,
  ProviderName,
  SecurityPolicy,
} from "../core/types.js";

interface GitHubIssue {
  number: number;
  title: string;
  body: string;
  labels: string[];
  url: string;
}

interface GitHubConfig {
  token: string;
  owner: string;
  repo: string;
}

export class ChangeRequestWorkflow {
  private orchestrator: CrossProviderOrchestrator;
  private ledger: UniversalLedger;
  private adapters: Map<ProviderName, ProviderAdapter>;
  private github?: GitHubConfig;

  constructor(
    orchestrator: CrossProviderOrchestrator,
    ledger: UniversalLedger,
    adapters: Map<ProviderName, ProviderAdapter>,
    github?: GitHubConfig,
  ) {
    this.orchestrator = orchestrator;
    this.ledger = ledger;
    this.adapters = adapters;
    this.github = github;
  }

  async submitChangeRequest(request: ChangeRequestInput): Promise<ChangeRequestResult> {
    const validationErrors = await this.validateAcrossProviders(request);
    if (validationErrors.length > 0) {
      return {
        id: crypto.randomUUID(),
        status: "rejected",
        errors: validationErrors,
      };
    }

    const previews = await this.generatePreviews(request);

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    let issue: GitHubIssue | undefined;
    if (this.github) {
      issue = await this.createGitHubIssue({
        title: `Change Request: ${request.name}`,
        body: this.formatChangeRequestBody(request, previews),
        labels: ["change-request", ...request.targetProviders],
      });
    }

    const changeRequest: ChangeRequest = {
      id,
      name: request.name,
      targetProviders: request.targetProviders,
      policy: request.policy,
      requester: request.requester,
      status: "pending",
      createdAt: now,
    };

    await this.ledger.recordEntry({
      ts: now,
      intent: "change_request_submitted",
      provider: request.targetProviders[0] ?? "cloudflare",
      hash: id,
      changeId: id,
      source: "api",
      payload: {
        name: request.name,
        targetProviders: request.targetProviders,
        issueNumber: issue?.number,
        issueUrl: issue?.url,
      },
      result: "success",
    });

    return {
      id,
      status: "pending",
      issueNumber: issue?.number,
      issueUrl: issue?.url,
      previews,
    };
  }

  async executeApprovedRequest(
    changeRequest: ChangeRequest,
  ): Promise<ExecutionReport> {
    const report = await this.orchestrator.applyPolicyToAllProviders(
      changeRequest.policy,
    );

    const now = new Date().toISOString();
    await this.ledger.recordEntry({
      ts: now,
      intent: "change_request_executed",
      provider: changeRequest.targetProviders[0] ?? "cloudflare",
      hash: changeRequest.id,
      changeId: changeRequest.id,
      source: "operator",
      payload: {
        name: changeRequest.name,
        results: report.results,
      },
      result: Object.values(report.results).every((r) => r.status === "success")
        ? "success"
        : "failure",
    });

    return report;
  }

  private async validateAcrossProviders(
    request: ChangeRequestInput,
  ): Promise<string[]> {
    const errors: string[] = [];

    for (const providerName of request.targetProviders) {
      const adapter = this.adapters.get(providerName);
      if (!adapter) {
        errors.push(`Provider '${providerName}' is not configured`);
        continue;
      }

      const validation = await adapter.validatePolicy(request.policy);
      if (!validation.ok) {
        for (const err of validation.errors) {
          errors.push(`[${providerName}] ${err}`);
        }
      }
    }

    return errors;
  }

  private async generatePreviews(
    request: ChangeRequestInput,
  ): Promise<Record<string, string>> {
    const previews: Record<string, string> = {};

    for (const providerName of request.targetProviders) {
      const adapter = this.adapters.get(providerName);
      if (!adapter) continue;

      try {
        previews[providerName] = await adapter.generateDiff(request.policy);
      } catch (error) {
        previews[providerName] = `Error generating preview: ${error}`;
      }
    }

    return previews;
  }

  private formatChangeRequestBody(
    request: ChangeRequestInput,
    previews: Record<string, string>,
  ): string {
    const lines: string[] = [
      `## Change Request: ${request.name}`,
      "",
      `**Requester:** ${request.requester}`,
      `**Target Providers:** ${request.targetProviders.join(", ")}`,
      `**Submitted:** ${new Date().toISOString()}`,
      "",
      "### Policy Summary",
      "",
      `- Deny by default: ${request.policy.securityDefaults?.denyByDefault ?? "unset"}`,
      `- WAF rules: ${request.policy.policies?.waf?.rules?.length ?? 0}`,
      `- Rate limit rules: ${request.policy.policies?.rateLimit?.rules?.length ?? 0}`,
      "",
      "### Payload",
      "",
      "```json",
      JSON.stringify(request.policy, null, 2),
      "```",
      "",
    ];

    for (const [provider, preview] of Object.entries(previews)) {
      lines.push(`### Preview: ${provider}`, "", preview, "");
    }

    lines.push(
      "---",
      "",
      "To approve: add the `approved` label to this issue.",
      "To reject: close this issue.",
    );

    return lines.join("\n");
  }

  private async createGitHubIssue(input: {
    title: string;
    body: string;
    labels: string[];
  }): Promise<GitHubIssue> {
    if (!this.github) {
      throw new Error("GitHub configuration required");
    }

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
          title: input.title,
          body: input.body,
          labels: input.labels,
        }),
      },
    );

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `GitHub issue creation failed: ${response.status} ${errorBody}`,
      );
    }

    const result = (await response.json()) as {
      number: number;
      title: string;
      body: string;
      labels: Array<{ name: string }>;
      html_url: string;
    };

    return {
      number: result.number,
      title: result.title,
      body: result.body,
      labels: result.labels.map((l) => l.name),
      url: result.html_url,
    };
  }
}

export interface ChangeRequestInput {
  name: string;
  requester: string;
  targetProviders: ProviderName[];
  policy: SecurityPolicy;
}

export interface ChangeRequestResult {
  id: string;
  status: "pending" | "rejected";
  errors?: string[];
  issueNumber?: number;
  issueUrl?: string;
  previews?: Record<string, string>;
}
