import { describe, it, expect, vi } from 'vitest';

// Mock node-pty
vi.mock('node-pty', () => ({
  default: {
    spawn: vi.fn(() => ({
      onData: vi.fn(),
      onExit: vi.fn(),
      write: vi.fn(),
      kill: vi.fn(),
      resize: vi.fn(),
    })),
  },
}));

// Mock auditLog to avoid network calls
vi.mock('../src/audit.js', () => ({
  auditLog: vi.fn(),
}));

import { Session } from '../src/session.js';

describe('Session', () => {
  const mockUser = { userId: 'op1', tenantId: 't1', role: 'admin' };
  const mockToken = 'token-123';

  it('should classify and execute allowed command', () => {
    const onOutput = vi.fn();
    const onExit = vi.fn();
    const session = new Session(mockUser, mockToken, onOutput, onExit);
    
    const onConfirmRequired = vi.fn();
    session.onConfirmRequired = onConfirmRequired;

    session.handleCommand('ls');
    expect(onConfirmRequired).not.toHaveBeenCalled();
    
    session.destroy();
  });

  it('should require confirmation for restricted commands', () => {
    const onOutput = vi.fn();
    const onExit = vi.fn();
    const session = new Session(mockUser, mockToken, onOutput, onExit);
    const onConfirmRequired = vi.fn();
    session.onConfirmRequired = onConfirmRequired;

    session.handleCommand('rm -rf test');
    expect(onConfirmRequired).toHaveBeenCalledWith('rm -rf test', 'destructive delete');
    
    session.destroy();
  });

  it('should block prohibited commands', () => {
    const onOutput = vi.fn();
    const onExit = vi.fn();
    const session = new Session(mockUser, mockToken, onOutput, onExit);
    
    session.handleCommand('sudo su');
    expect(onOutput).toHaveBeenCalledWith(expect.stringContaining('Policy Violation'));
    
    session.destroy();
  });
});
