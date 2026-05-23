import { describe, it, expect } from 'vitest';
import { redactSecrets } from '../src/redact.js';

describe('redact', () => {
  it('should redact GitHub tokens', () => {
    const input = 'My token is gho_abcdefghijklmnopqrstuvwxyz0123456789';
    const { text, redacted } = redactSecrets(input);
    expect(redacted).toBe(true);
    expect(text).toBe('My token is [REDACTED]');
  });

  it('should redact OpenAI keys', () => {
    const input = 'key: sk-abcdefghijklmnopqrstuvwxyz0123456789abcdefghij';
    const { text, redacted } = redactSecrets(input);
    expect(redacted).toBe(true);
    expect(text).toBe('key: [REDACTED]');
  });

  it('should redact environment variable secrets', () => {
    const input = 'OPERATOR_TOKEN="mysecrettoken123"';
    const { text, redacted } = redactSecrets(input);
    expect(redacted).toBe(true);
    expect(text).toBe('OPERATOR_TOKEN="[REDACTED]"');
  });

  it('should not redact harmless text', () => {
    const input = 'ls -la projects';
    const { text, redacted } = redactSecrets(input);
    expect(redacted).toBe(false);
    expect(text).toBe(input);
  });

  it('should handle large input without hanging', () => {
    const largeInput = 'a'.repeat(5000);
    const start = Date.now();
    redactSecrets(largeInput);
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(100);
  });
});
