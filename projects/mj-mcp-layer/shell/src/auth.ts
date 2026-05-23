import bcrypt from 'bcryptjs';
import logger from './logger.js';

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'https://mcp.ellis-aegis.us,https://mj.ellis-aegis.us,https://codex.ellis-aegis.us,http://localhost:3000,http://localhost:5173').split(',');

export interface User {
  userId: string;
  tenantId: string;
  role: string;
}

export function validateOrigin(origin: string | undefined): boolean {
  if (!origin) return false;
  return ALLOWED_ORIGINS.includes(origin);
}

export async function validateToken(token: string): Promise<User | null> {
  const hash = process.env.OPERATOR_TOKEN_HASH;
  if (!hash) {
    logger.error('OPERATOR_TOKEN_HASH not configured');
    return null;
  }

  try {
    const match = await bcrypt.compare(token, hash);
    if (match) {
      return { userId: 'operator', tenantId: 'operator', role: 'admin' };
    }
  } catch (err) {
    logger.error({ err }, 'Token validation error');
  }

  return null;
}
