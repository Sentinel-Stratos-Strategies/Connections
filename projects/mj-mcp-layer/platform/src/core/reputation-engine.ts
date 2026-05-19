import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { LedgerEntry, ProviderName } from "./types.js";
import type { UniversalLedger } from "./ledger.js";

export interface AgentReputation {
  actor: string;
  successful_changes: number;
  reverted_changes: number;
  denied_requests: number;
  malformed_requests: number;
  average_risk: "low" | "medium" | "high";
  trust_score: number;
  effective_policy: "auto" | "approval" | "read-only";
  last_activity: string;
  history: ReputationEvent[];
}

export interface ReputationEvent {
  timestamp: string;
  type: "success" | "revert" | "denied" | "malformed";
  intent: string;
  provider: ProviderName;
  score_delta: number;
}

export type ChangeOutcome = {
  type: "success" | "revert" | "denied" | "malformed";
  intent: string;
  provider: ProviderName;
};

interface ReputationStore {
  actors: Record<string, AgentReputation>;
}

const TRUST_THRESHOLDS = {
  auto: 90,
  approval: 60,
} as const;

const SCORE_WEIGHTS = {
  success: +2,
  revert: -15,
  denied: -5,
  malformed: -8,
} as const;

export class ReputationEngine {
  private storeFile: string;
  private store: ReputationStore;
  private ledger?: UniversalLedger;

  constructor(storeFile: string, ledger?: UniversalLedger) {
    this.storeFile = storeFile;
    this.ledger = ledger;
    this.store = this.loadStore();
  }

  getReputation(actor: string): AgentReputation {
    return this.store.actors[actor] ?? this.createDefault(actor);
  }

  recordOutcome(actor: string, outcome: ChangeOutcome): AgentReputation {
    const rep = this.getOrCreate(actor);
    const delta = SCORE_WEIGHTS[outcome.type];

    switch (outcome.type) {
      case "success":
        rep.successful_changes++;
        break;
      case "revert":
        rep.reverted_changes++;
        break;
      case "denied":
        rep.denied_requests++;
        break;
      case "malformed":
        rep.malformed_requests++;
        break;
    }

    rep.history.push({
      timestamp: new Date().toISOString(),
      type: outcome.type,
      intent: outcome.intent,
      provider: outcome.provider,
      score_delta: delta,
    });

    if (rep.history.length > 500) {
      rep.history = rep.history.slice(-250);
    }

    rep.trust_score = this.computeTrustScore(rep);
    rep.effective_policy = this.getEffectivePolicy(rep.trust_score);
    rep.average_risk = this.computeAverageRisk(rep);
    rep.last_activity = new Date().toISOString();

    this.store.actors[actor] = rep;
    this.saveStore();

    return rep;
  }

  computeTrustScore(rep: AgentReputation): number {
    const total =
      rep.successful_changes +
      rep.reverted_changes +
      rep.denied_requests +
      rep.malformed_requests;

    if (total === 0) return 50;

    const rawScore =
      (rep.successful_changes * SCORE_WEIGHTS.success +
        rep.reverted_changes * SCORE_WEIGHTS.revert +
        rep.denied_requests * SCORE_WEIGHTS.denied +
        rep.malformed_requests * SCORE_WEIGHTS.malformed);

    const maxPossible = total * SCORE_WEIGHTS.success;
    const normalized = maxPossible > 0
      ? Math.round(50 + (rawScore / maxPossible) * 50)
      : 50;

    return Math.max(0, Math.min(100, normalized));
  }

  getEffectivePolicy(score: number): "auto" | "approval" | "read-only" {
    if (score >= TRUST_THRESHOLDS.auto) return "auto";
    if (score >= TRUST_THRESHOLDS.approval) return "approval";
    return "read-only";
  }

  getAllReputations(): AgentReputation[] {
    return Object.values(this.store.actors).sort(
      (a, b) => b.trust_score - a.trust_score,
    );
  }

  async rebuildFromLedger(): Promise<void> {
    if (!this.ledger) return;

    this.store = { actors: {} };

    const providers: ProviderName[] = ["cloudflare", "aws", "kubernetes", "terraform"];
    for (const provider of providers) {
      const entries = await this.getLedgerEntries(provider);
      for (const entry of entries) {
        const actor = (entry.payload.requester as string)
          ?? (entry.payload.actor as string)
          ?? entry.source;

        this.recordOutcome(actor, {
          type: entry.result === "success" ? "success" : "revert",
          intent: entry.intent,
          provider: entry.provider,
        });
      }
    }
  }

  formatReputation(rep: AgentReputation): string {
    const policyIcon = {
      auto: "🟢",
      approval: "🟡",
      "read-only": "🔴",
    }[rep.effective_policy];

    const lines = [
      `# Agent Reputation: ${rep.actor}`,
      "",
      `| Metric | Value |`,
      `|--------|-------|`,
      `| Trust Score | ${rep.trust_score}/100 ${policyIcon} |`,
      `| Effective Policy | ${rep.effective_policy} |`,
      `| Average Risk | ${rep.average_risk} |`,
      `| Successful Changes | ${rep.successful_changes} |`,
      `| Reverted Changes | ${rep.reverted_changes} |`,
      `| Denied Requests | ${rep.denied_requests} |`,
      `| Malformed Requests | ${rep.malformed_requests} |`,
      `| Last Activity | ${rep.last_activity} |`,
      "",
      "## Trust Policy",
      "",
      `- Score >= ${TRUST_THRESHOLDS.auto}: auto-execute low-risk changes`,
      `- Score ${TRUST_THRESHOLDS.approval}-${TRUST_THRESHOLDS.auto - 1}: approval required`,
      `- Score < ${TRUST_THRESHOLDS.approval}: read-only access`,
    ];

    if (rep.history.length > 0) {
      lines.push("", "## Recent History", "");
      const recent = rep.history.slice(-10);
      for (const event of recent) {
        const icon = event.type === "success" ? "+" : "-";
        lines.push(`- [${icon}${Math.abs(event.score_delta)}] ${event.type}: ${event.intent} (${event.provider})`);
      }
    }

    return lines.join("\n");
  }

  formatLeaderboard(): string {
    const all = this.getAllReputations();
    if (all.length === 0) return "No agents tracked yet.";

    const lines = [
      "# Agent Reputation Leaderboard",
      "",
      "| Rank | Agent | Score | Policy | Changes | Reverts |",
      "|------|-------|-------|--------|---------|---------|",
    ];

    for (let i = 0; i < all.length; i++) {
      const rep = all[i];
      const policyIcon = { auto: "🟢", approval: "🟡", "read-only": "🔴" }[rep.effective_policy];
      lines.push(
        `| ${i + 1} | ${rep.actor} | ${rep.trust_score} | ${policyIcon} ${rep.effective_policy} | ${rep.successful_changes} | ${rep.reverted_changes} |`,
      );
    }

    return lines.join("\n");
  }

  private computeAverageRisk(rep: AgentReputation): "low" | "medium" | "high" {
    const total = rep.successful_changes + rep.reverted_changes + rep.denied_requests + rep.malformed_requests;
    if (total === 0) return "low";

    const failureRate = (rep.reverted_changes + rep.malformed_requests) / total;
    if (failureRate > 0.3) return "high";
    if (failureRate > 0.1) return "medium";
    return "low";
  }

  private getOrCreate(actor: string): AgentReputation {
    if (!this.store.actors[actor]) {
      this.store.actors[actor] = this.createDefault(actor);
    }
    return this.store.actors[actor];
  }

  private createDefault(actor: string): AgentReputation {
    return {
      actor,
      successful_changes: 0,
      reverted_changes: 0,
      denied_requests: 0,
      malformed_requests: 0,
      average_risk: "low",
      trust_score: 50,
      effective_policy: "approval",
      last_activity: new Date().toISOString(),
      history: [],
    };
  }

  private async getLedgerEntries(provider: ProviderName): Promise<LedgerEntry[]> {
    try {
      const adapter = this.ledger?.getAdapter(provider);
      if (!adapter) return [];
      return adapter.getAuditLog(new Date(0));
    } catch {
      return [];
    }
  }

  private loadStore(): ReputationStore {
    if (!existsSync(this.storeFile)) return { actors: {} };
    try {
      return JSON.parse(readFileSync(this.storeFile, "utf-8")) as ReputationStore;
    } catch {
      return { actors: {} };
    }
  }

  private saveStore(): void {
    mkdirSync(dirname(this.storeFile), { recursive: true });
    writeFileSync(this.storeFile, JSON.stringify(this.store, null, 2));
  }
}
