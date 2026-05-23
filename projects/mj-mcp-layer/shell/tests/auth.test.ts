import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import bcrypt from 'bcryptjs';
import { validateToken, validateOrigin } from '../src/auth.js';

describe('auth', () => {
  const originalHash = process.env.OPERATOR_TOKEN_HASH;
  const originalOrigins = process.env.ALLOWED_ORIGINS;
  const testToken = 'test-token-123';
  const testHash = bcrypt.hashSync(testToken, 10);

  beforeEach(() => {
    process.env.OPERATOR_TOKEN_HASH = testHash;
    process.env.ALLOWED_ORIGINS = 'https://mcp.ellis-aegis.us,http://localhost:3000';
  });

  afterEach(() => {
    process.env.OPERATOR_TOKEN_HASH = originalHash;
    process.env.ALLOWED_ORIGINS = originalOrigins;
  });

  it('should validate correct token', async () => {
    const user = await validateToken(testToken);
    expect(user).not.toBeNull();
    expect(user?.userId).toBe('operator');
  });

  it('should reject incorrect token', async () => {
    const user = await validateToken('wrong-token');
    expect(user).toBeNull();
  });

  it('should validate allowed origin', () => {
    expect(validateOrigin('https://mcp.ellis-aegis.us')).toBe(true);
    expect(validateOrigin('http://localhost:3000')).toBe(true);
  });

  it('should reject disallowed origin', () => {
    expect(validateOrigin('https://evil.com')).toBe(false);
  });

  it('should reject missing origin', () => {
    expect(validateOrigin(undefined)).toBe(false);
  });
});
