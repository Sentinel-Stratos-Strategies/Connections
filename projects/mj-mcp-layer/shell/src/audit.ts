import logger from './logger.js';

const MCP_BASE_URL = process.env.MCP_BASE_URL || 'https://mcp.ellis-aegis.us';
const SHELL_AUDIT_TOKEN = process.env.SHELL_AUDIT_TOKEN || '';

export interface AuditEvent {
  type: string;
  actor: string;
  tenantId: string;
  command?: string;
  redacted?: boolean;
  timestamp: string;
  metadata?: any;
}

export function auditLog(event: AuditEvent, token?: string) {
  const url = `${MCP_BASE_URL}/api/ledger`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const authToken = token || SHELL_AUDIT_TOKEN;
  if (authToken) {
    headers['x-ellis-aegis-token'] = authToken;
  }

  const body = JSON.stringify(event);

  // Fire and forget with retry
  sendWithRetry(url, headers, body, 2).catch((err) => {
    logger.error({ err, event }, 'Audit logging failed after retries');
  });
}

async function sendWithRetry(url: string, headers: any, body: string, retries: number) {
  for (let i = 0; i <= retries; i++) {
    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers,
        body,
      });
      if (resp.ok) return;
      logger.warn({ status: resp.status, attempt: i + 1 }, 'Audit log response not OK');
    } catch (err) {
      logger.warn({ err, attempt: i + 1 }, 'Audit log fetch error');
    }
    if (i < retries) {
      await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
}
