import { describe, it, expect } from 'vitest';
import { classifyCommand } from '../src/allowlist.js';

describe('allowlist', () => {
  it('should allow simple safe commands', () => {
    expect(classifyCommand('ls -la').decision).toBe('allow');
    expect(classifyCommand('pwd').decision).toBe('allow');
    expect(classifyCommand('whoami').decision).toBe('allow');
  });

  it('should require confirmation for dangerous commands', () => {
    const result = classifyCommand('rm -rf node_modules');
    expect(result.decision).toBe('confirm');
    expect(result.confirmPhrase).toBe('destructive delete');
  });

  it('should block explicitly prohibited commands', () => {
    expect(classifyCommand('sudo rm -rf /').decision).toBe('block');
    expect(classifyCommand('cat .env').decision).toBe('block');
  });

  it('should block pipes to shell even in allowed commands', () => {
    expect(classifyCommand('ls | bash').decision).toBe('block');
  });

  it('should block unknown commands for operator', () => {
    expect(classifyCommand('some_unknown_command', 'operator').decision).toBe('block');
  });

  it('should confirm unknown commands for admin', () => {
    const result = classifyCommand('some_unknown_command', 'admin');
    expect(result.decision).toBe('confirm');
    expect(result.confirmPhrase).toBe('execute unknown admin command');
  });
});
