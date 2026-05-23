export type CommandDecision = 'allow' | 'confirm' | 'block';

export interface Classification {
  decision: CommandDecision;
  confirmPhrase?: string;
  reason?: string;
}

const ALLOW_PREFIXES = [
  'pwd', 'ls', 'll', 'la', 'echo', 'date', 'uptime', 'whoami', 'hostname',
  'which', 'type', 'command -v', 'head', 'tail', 'wc', 'cat', 'grep', 'rg',
  'find', 'sed -n', 'jq', 'du -sh', 'df -h',
  'git status', 'git log', 'git diff', 'git branch', 'git show',
  'npm test', 'npm run typecheck', 'npx wrangler dev', 'npx wrangler whoami',
];

const CONFIRM_COMMANDS = [
  { pattern: /wrangler\s+deploy/i, phrase: 'deploy mj-edge' },
  { pattern: /flyctl\s+deploy/i, phrase: 'deploy brady shell' },
  { pattern: /gh\s+pr\s+merge/i, phrase: 'merge pull request' },
  { pattern: /git\s+push/i, phrase: 'push to remote' },
  { pattern: /rm\s+-rf/i, phrase: 'destructive delete' },
  { pattern: /npm\s+install/i, phrase: 'install dependencies' },
  { pattern: /npx\s+wrangler\s+d1\s+migrations\s+apply/i, phrase: 'apply d1 migrations' },
];

const BLOCK_PATTERNS = [
  /sudo\b/i,
  /su\b/i,
  /chmod\s+777/i,
  /kill\s+-9\s+1/i,
  /cat\s+\.env/i,
  /printenv\b/i,
];

export function classifyCommand(command: string, role: string = 'operator'): Classification {
  const trimmed = command.trim();

  // Block list first
  for (const pattern of BLOCK_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { decision: 'block', reason: 'Command is explicitly blocked by policy.' };
    }
  }

  // Allow list (only for non-admin roles, admin might need more, but here we define for 'operator')
  for (const prefix of ALLOW_PREFIXES) {
    if (trimmed.startsWith(prefix)) {
      // Basic safety check: no pipes to shell in allowed commands
      if (trimmed.includes('|') && (trimmed.includes('bash') || trimmed.includes('sh'))) {
        return { decision: 'block', reason: 'Piping to shell is not allowed in simple commands.' };
      }
      return { decision: 'allow' };
    }
  }

  // Confirm list
  for (const entry of CONFIRM_COMMANDS) {
    if (entry.pattern.test(trimmed)) {
      return { decision: 'confirm', confirmPhrase: entry.phrase };
    }
  }

  // Default for operator role is block for unknown commands
  if (role !== 'admin') {
    return { decision: 'block', reason: 'Command not in allowlist and requires admin role.' };
  }

  // Default for admin if not explicitly allowed or confirmed
  return { decision: 'confirm', confirmPhrase: 'execute unknown admin command' };
}
