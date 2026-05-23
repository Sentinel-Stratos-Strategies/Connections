import { describe, it, expect } from 'vitest';
import { parseInboundMessage, formatOutboundMessage } from '../src/protocol.js';

describe('protocol', () => {
  it('should parse valid inbound auth message', () => {
    const data = JSON.stringify({ type: 'auth', token: 'test-token' });
    const msg = parseInboundMessage(data);
    expect(msg.type).toBe('auth');
    if (msg.type === 'auth') {
      expect(msg.token).toBe('test-token');
    }
  });

  it('should parse valid inbound command message', () => {
    const data = JSON.stringify({ type: 'command', payload: 'ls -la' });
    const msg = parseInboundMessage(data);
    expect(msg.type).toBe('command');
    if (msg.type === 'command') {
      expect(msg.payload).toBe('ls -la');
    }
  });

  it('should format valid outbound auth_ok message', () => {
    const msg = {
      type: 'auth_ok' as const,
      user: { userId: 'op1', tenantId: 't1', role: 'admin' },
    };
    const data = formatOutboundMessage(msg);
    const parsed = JSON.parse(data);
    expect(parsed.type).toBe('auth_ok');
    expect(parsed.user.userId).toBe('op1');
  });

  it('should throw on invalid JSON', () => {
    expect(() => parseInboundMessage('invalid')).toThrow();
  });

  it('should throw on invalid message type', () => {
    const data = JSON.stringify({ type: 'invalid' });
    expect(() => parseInboundMessage(data)).toThrow();
  });
});
