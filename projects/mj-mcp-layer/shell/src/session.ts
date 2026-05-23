import pty from 'node-pty';
import { User } from './auth.js';
import { classifyCommand, Classification } from './allowlist.js';
import { redactSecrets } from './redact.js';
import { auditLog } from './audit.js';
import logger from './logger.js';
import { formatOutboundMessage } from './protocol.js';

export class Session {
  private ptyProcess: pty.IPty;
  private pendingCommand: { command: string; phrase: string } | null = null;
  private token: string;

  constructor(
    private user: User,
    token: string,
    private onOutput: (data: string) => void,
    private onExit: (code: number) => void
  ) {
    this.token = token;
    const shell = process.platform === 'win32' ? 'powershell.exe' : '/bin/sh';
    
    this.ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd: process.env.HOME || '/home/operator',
      env: {
        HOME: process.env.HOME || '/home/operator',
        TERM: 'xterm-256color',
        PATH: '/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin',
      } as any,
    });

    this.ptyProcess.onData((data) => {
      const { text } = redactSecrets(data);
      this.onOutput(text);
    });

    this.ptyProcess.onExit(({ exitCode }) => {
      this.onExit(exitCode);
    });

    auditLog({
      type: 'session_start',
      actor: this.user.userId,
      tenantId: this.user.tenantId,
      timestamp: new Date().toISOString(),
    }, this.token);
  }

  handleCommand(payload: string) {
    const classification = classifyCommand(payload, this.user.role);

    if (classification.decision === 'block') {
      this.onOutput(`\r\n\x1b[31mPolicy Violation: ${classification.reason}\x1b[0m\r\n`);
      auditLog({
        type: 'policy_violation',
        actor: this.user.userId,
        tenantId: this.user.tenantId,
        command: payload,
        timestamp: new Date().toISOString(),
      }, this.token);
      return;
    }

    if (classification.decision === 'confirm') {
      this.pendingCommand = { command: payload, phrase: classification.confirmPhrase! };
      // Send confirm_required as a protocol message?
      // The Session class doesn't have direct access to the WS sender for protocol messages, 
      // it only has onOutput which sends raw strings.
      // I'll return a special value or call a callback.
      this.onConfirmRequired(payload, classification.confirmPhrase!);
      return;
    }

    this.execute(payload);
  }

  handleConfirm(phrase: string) {
    if (!this.pendingCommand) {
      this.onOutput('\r\nNo pending command to confirm.\r\n');
      return;
    }

    if (phrase === this.pendingCommand.phrase) {
      const cmd = this.pendingCommand.command;
      this.pendingCommand = null;
      this.execute(cmd);
    } else {
      this.onOutput('\r\nConfirmation phrase mismatch.\r\n');
    }
  }

  handleResize(cols: number, rows: number) {
    this.ptyProcess.resize(cols, rows);
  }

  private execute(command: string) {
    const { text, redacted } = redactSecrets(command);
    
    auditLog({
      type: 'command_execute',
      actor: this.user.userId,
      tenantId: this.user.tenantId,
      command: text,
      redacted,
      timestamp: new Date().toISOString(),
    }, this.token);

    this.ptyProcess.write(command + '\n');
  }

  destroy() {
    this.ptyProcess.kill();
    auditLog({
      type: 'session_end',
      actor: this.user.userId,
      tenantId: this.user.tenantId,
      timestamp: new Date().toISOString(),
    }, this.token);
  }

  // Hook for protocol-level confirmation messages
  public onConfirmRequired: (command: string, phrase: string) => void = () => {};
}
