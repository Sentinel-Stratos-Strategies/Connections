const PATTERNS = [
  /gho_[a-zA-Z0-9]{36}/g,
  /ghp_[a-zA-Z0-9]{36}/g,
  /github_pat_[a-zA-Z0-9]{22}_[a-zA-Z0-9]{59}/g,
  /sk-[a-zA-Z0-9]{20,}/g,
  /org-[a-zA-Z0-9]{20,}/g,
  /eyJ[a-zA-Z0-9-_]+\.eyJ[a-zA-Z0-9-_]+\.[a-zA-Z0-9-_]+/g, // JWT
  /(?:OPERATOR_TOKEN|CF_API_TOKEN|AWS_SECRET_ACCESS_KEY|SECRET|KEY|PASSWORD|TOKEN)=["']?([a-zA-Z0-9-_]{12,})["']?/gi,
];

export function redactSecrets(text: string): { text: string; redacted: boolean } {
  let redacted = false;
  let result = text;

  for (const pattern of PATTERNS) {
    if (pattern.test(result)) {
      redacted = true;
      // For the env-style patterns, we want to keep the key and only redact the value
      if (pattern.source.includes('?:OPERATOR_TOKEN')) {
        result = result.replace(pattern, (match, p1) => match.replace(p1, '[REDACTED]'));
      } else {
        result = result.replace(pattern, '[REDACTED]');
      }
    }
  }

  return { text: result, redacted };
}
