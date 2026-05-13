import { createHash, randomUUID } from "node:crypto";

export type ShellCapability = "shell.readonly" | "shell.diagnostics" | "shell.deploy" | "shell.breakglass";
export type ShellEventType = "stdout" | "stderr" | "exit" | "timeout" | "policy_denial";
export type ShellCommandClass =
  | "readonly"
  | "diagnostic"
  | "waf_modify"
  | "ratelimit_modify"
  | "cache_modify"
  | "worker_route_modify"
  | "database_mutation"
  | "code_merge"
  | "infrastructure_apply"
  | "secret_read"
  | "destructive"
  | "unknown_mutation";

export interface ShellSessionRequest {
  actor: string;
  tenant: string;
  purpose: string;
  capability: ShellCapability;
  ttl_minutes?: number;
  cwd?: string;
  env_profile?: "readonly" | "staging" | "production-approved";
}

export interface ShellSession {
  id: string;
  actor: string;
  tenant: string;
  purpose: string;
  capability: ShellCapability;
  ttl_minutes: number;
  cwd: string;
  env_profile: "readonly" | "staging" | "production-approved";
  created_at: string;
  expires_at: string;
  status: "active" | "cancelled" | "closed" | "expired";
}

export interface ShellCommandRequest {
  session_id: string;
  request_id: string;
  command: string;
  mode?: "exec" | "stream";
  timeout_seconds?: number;
  expect_mutation?: boolean;
  approval_ref?: string;
}

export interface ShellPolicyDecision {
  allowed: boolean;
  reason: string;
  command_class: ShellCommandClass;
  requires_approval: boolean;
  requires_budget: boolean;
  budget_category?: string;
  redaction_required: boolean;
}

export interface ShellTranscriptCommand {
  request_id: string;
  command_hash: string;
  command_redacted: string;
  cwd: string;
  exit_code?: number;
  started_at: string;
  ended_at?: string;
  stdout_ref?: string;
  stderr_ref?: string;
  budget_spend_ref?: string;
  receipt_ref?: string;
  decision: ShellPolicyDecision;
}

export interface ShellTranscriptManifest {
  session_id: string;
  actor: string;
  tenant: string;
  capability: ShellCapability;
  created_at: string;
  closed_at?: string;
  commands: ShellTranscriptCommand[];
}

const DEFAULT_TTL_MINUTES = 15;
const DEFAULT_CWD = "/workspace";
const MAX_TTL_MINUTES = 60;

const DENIED_PATTERNS: Array<{ pattern: RegExp; reason: string; commandClass: ShellCommandClass }> = [
  { pattern: /(^|\s)printenv(\s|$)/i, reason: "environment dumping is denied", commandClass: "secret_read" },
  { pattern: /cat\s+.*(\.env|secret|token|credential)/i, reason: "secret file reads are denied", commandClass: "secret_read" },
  { pattern: /rm\s+-rf\s+(\/|\*)/i, reason: "destructive recursive delete is denied", commandClass: "destructive" },
  { pattern: /disable.*(scan|ledger|audit)/i, reason: "security control disablement is denied", commandClass: "destructive" },
  { pattern: /curl\s+.*169\.254\.169\.254/i, reason: "metadata service access is denied", commandClass: "secret_read" },
  { pattern: /(ledger|evidence).*(delete|rm|destroy)/i, reason: "ledger/evidence deletion is denied", commandClass: "destructive" },
];

const SECRET_OUTPUT_PATTERNS = [
  /sk-[A-Za-z0-9_-]{12,}/g,
  /(api[_-]?key|token|secret|password)\s*[:=]\s*[^\s]+/gi,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
];

export class CloudShellPolicyEngine {
  createSession(request: ShellSessionRequest, now = new Date()): ShellSession {
    const ttl = Math.min(Math.max(request.ttl_minutes ?? DEFAULT_TTL_MINUTES, 1), MAX_TTL_MINUTES);
    const expires = new Date(now.getTime() + ttl * 60_000);

    return {
      id: `shellsess_${randomUUID().slice(0, 12)}`,
      actor: request.actor,
      tenant: request.tenant,
      purpose: request.purpose,
      capability: request.capability,
      ttl_minutes: ttl,
      cwd: request.cwd ?? DEFAULT_CWD,
      env_profile: request.env_profile ?? "readonly",
      created_at: now.toISOString(),
      expires_at: expires.toISOString(),
      status: "active",
    };
  }

  evaluate(session: ShellSession, request: ShellCommandRequest, now = new Date()): ShellPolicyDecision {
    if (session.id !== request.session_id) {
      return this.deny("session id mismatch", "readonly", false, false);
    }

    if (session.status !== "active") {
      return this.deny(`session is ${session.status}`, "readonly", false, false);
    }

    if (new Date(session.expires_at) <= now) {
      return this.deny(`session expired at ${session.expires_at}`, "readonly", false, false);
    }

    const denied = DENIED_PATTERNS.find((entry) => entry.pattern.test(request.command));
    if (denied) {
      return this.deny(denied.reason, denied.commandClass, true, denied.commandClass !== "readonly");
    }

    const commandClass = classifyCommand(request.command);
    const budgetRequired = requiresBudget(commandClass);
    const approvalRequired = requiresApproval(session.capability, commandClass, request);
    const budgetCategory = budgetCategoryFor(commandClass);

    if (!capabilityAllows(session.capability, commandClass)) {
      return this.deny(
        `${session.capability} cannot execute ${commandClass}`,
        commandClass,
        approvalRequired,
        budgetRequired,
        budgetCategory,
      );
    }

    if (approvalRequired && !request.approval_ref) {
      return this.deny(
        `${commandClass} requires approval metadata`,
        commandClass,
        true,
        budgetRequired,
        budgetCategory,
      );
    }

    if (request.expect_mutation === false && commandClass !== "readonly" && commandClass !== "diagnostic") {
      return this.deny(
        `command class ${commandClass} conflicts with expect_mutation=false`,
        commandClass,
        approvalRequired,
        budgetRequired,
        budgetCategory,
      );
    }

    return {
      allowed: true,
      reason: "allowed",
      command_class: commandClass,
      requires_approval: approvalRequired,
      requires_budget: budgetRequired,
      budget_category: budgetCategory,
      redaction_required: true,
    };
  }

  createTranscript(session: ShellSession): ShellTranscriptManifest {
    return {
      session_id: session.id,
      actor: session.actor,
      tenant: session.tenant,
      capability: session.capability,
      created_at: session.created_at,
      commands: [],
    };
  }

  appendPlannedCommand(
    transcript: ShellTranscriptManifest,
    session: ShellSession,
    request: ShellCommandRequest,
    decision: ShellPolicyDecision,
    now = new Date(),
  ): ShellTranscriptCommand {
    const command: ShellTranscriptCommand = {
      request_id: request.request_id,
      command_hash: sha256(request.command),
      command_redacted: redactCommand(request.command),
      cwd: session.cwd,
      started_at: now.toISOString(),
      decision,
    };
    transcript.commands.push(command);
    return command;
  }

  redactOutput(output: string): { redacted: string; redaction_applied: boolean; sha256: string } {
    let redacted = output;
    for (const pattern of SECRET_OUTPUT_PATTERNS) {
      redacted = redacted.replace(pattern, "[REDACTED]");
    }
    return {
      redacted,
      redaction_applied: redacted !== output,
      sha256: sha256(output),
    };
  }

  closeTranscript(transcript: ShellTranscriptManifest, now = new Date()): ShellTranscriptManifest {
    return { ...transcript, closed_at: now.toISOString() };
  }

  private deny(
    reason: string,
    commandClass: ShellCommandClass,
    requiresApproval: boolean,
    requiresBudgetValue: boolean,
    budgetCategory?: string,
  ): ShellPolicyDecision {
    return {
      allowed: false,
      reason,
      command_class: commandClass,
      requires_approval: requiresApproval,
      requires_budget: requiresBudgetValue,
      budget_category: budgetCategory,
      redaction_required: true,
    };
  }
}

export function classifyCommand(command: string): ShellCommandClass {
  const normalized = command.trim().toLowerCase();

  if (/^(pwd|ls|cat\s+[^;&|]*|git\s+status|git\s+diff|npm\s+.*\s+test|npm\s+.*\s+run\s+typecheck|bash\s+-n\s+)/.test(normalized)) {
    return "readonly";
  }
  if (/(health|scan|dry-run|plan|whoami|wrangler\s+deploy\s+--dry-run)/.test(normalized)) {
    return "diagnostic";
  }
  if (/cloudflare\/30-apply-waf\.sh|waf/.test(normalized)) return "waf_modify";
  if (/cloudflare\/40-apply-ratelimit\.sh|rate\s*limit|ratelimit/.test(normalized)) return "ratelimit_modify";
  if (/cloudflare\/50-apply-cache\.sh|cache/.test(normalized)) return "cache_modify";
  if (/wrangler\s+deploy|worker\s+route/.test(normalized)) return "worker_route_modify";
  if (/wrangler\s+d1\s+execute\s+--remote|migration/.test(normalized)) return "database_mutation";
  if (/gh\s+pr\s+merge|git\s+push/.test(normalized)) return "code_merge";
  if (/terraform\s+apply|pulumi\s+up|kubectl\s+apply/.test(normalized)) return "infrastructure_apply";
  if (/(delete|destroy|remove|rm\s+)/.test(normalized)) return "destructive";

  return "unknown_mutation";
}

export function budgetCategoryFor(commandClass: ShellCommandClass): string | undefined {
  const map: Partial<Record<ShellCommandClass, string>> = {
    waf_modify: "waf_modify",
    ratelimit_modify: "ratelimit_modify",
    cache_modify: "cache_modify",
    worker_route_modify: "worker_route_modify",
    database_mutation: "database_mutation",
    code_merge: "code_merge",
    infrastructure_apply: "infrastructure_apply",
    destructive: "destructive_changes",
    unknown_mutation: "general_modify",
  };
  return map[commandClass];
}

function requiresBudget(commandClass: ShellCommandClass): boolean {
  return Boolean(budgetCategoryFor(commandClass));
}

function requiresApproval(
  capability: ShellCapability,
  commandClass: ShellCommandClass,
  request: ShellCommandRequest,
): boolean {
  if (commandClass === "readonly" || commandClass === "diagnostic") return false;
  if (capability === "shell.breakglass") return true;
  if (capability === "shell.deploy") return true;
  return request.expect_mutation !== false;
}

function capabilityAllows(capability: ShellCapability, commandClass: ShellCommandClass): boolean {
  if (capability === "shell.readonly") return commandClass === "readonly";
  if (capability === "shell.diagnostics") return commandClass === "readonly" || commandClass === "diagnostic";
  if (capability === "shell.deploy") {
    return !["secret_read", "destructive"].includes(commandClass);
  }
  if (capability === "shell.breakglass") {
    return commandClass !== "secret_read";
  }
  return false;
}

function redactCommand(command: string): string {
  return command
    .replace(/(token|secret|password|api[_-]?key)=\S+/gi, "$1=[REDACTED]")
    .replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]");
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
