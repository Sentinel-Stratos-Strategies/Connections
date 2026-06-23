"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import "@xterm/xterm/css/xterm.css";

interface CloudShellProps {
  onReady?: () => void;
  initialCommand?: string;
}

const SHELL_URL = process.env.NEXT_PUBLIC_SHELL_URL || "wss://mcp.ellis-aegis.us/shell";
const SHELL_AUTH_MODE = process.env.NEXT_PUBLIC_SHELL_AUTH_MODE || "message";

type ShellMessage =
  | { type: "auth_ok"; user: { userId: string; tenantId: string; role: string } }
  | { type: "auth_fail"; reason: string }
  | { type: "output"; data: string }
  | { type: "exit"; code: number }
  | { type: "error"; message: string }
  | { type: "policy_violation"; message: string }
  | { type: "confirm_required"; command: string; phrase: string };

function sendShellCommand(ws: WebSocket, command: string) {
  ws.send(JSON.stringify({ type: "command", payload: command }));
}

function elementHasLayout(element: HTMLElement | null) {
  if (!element) return false;
  return element.clientWidth > 0 && element.clientHeight > 0;
}

function fitTerminal(fitAddon: FitAddon | null, terminal: XTerm | null, element: HTMLElement | null) {
  if (!fitAddon || !terminal || !elementHasLayout(element)) return false;

  try {
    fitAddon.fit();
    return true;
  } catch {
    return false;
  }
}

export function CloudShell({ onReady, initialCommand }: CloudShellProps) {
  const { token } = useAuth();
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<"connecting" | "connected" | "disconnected">("connecting");
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialCommandSentRef = useRef(false);
  const isCleaningUpRef = useRef(false);
  const pendingConfirmPhraseRef = useRef<string | null>(null);

  const connect = useCallback(() => {
    if (!token || !xtermRef.current) return;

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    setConnectionStatus("connecting");

    const useQueryToken = SHELL_AUTH_MODE.toLowerCase() === "query";
    const shellUrl = useQueryToken
      ? `${SHELL_URL}?token=${encodeURIComponent(token)}`
      : SHELL_URL;
    const ws = new WebSocket(shellUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!useQueryToken) {
        ws.send(JSON.stringify({ type: "auth", token }));
      }

      setConnectionStatus("connected");
      xtermRef.current?.writeln("\r\n\x1b[32mConnected to MCP Cloud Shell\x1b[0m\r\n");
      xtermRef.current?.write("$ ");
      onReady?.();

      if (initialCommand && !initialCommandSentRef.current) {
        initialCommandSentRef.current = true;
        setTimeout(() => {
          if (ws.readyState === WebSocket.OPEN) {
            xtermRef.current?.write(initialCommand);
            sendShellCommand(ws, initialCommand);
          }
        }, 100);
      }
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as ShellMessage;
        if (message.type === "auth_ok") {
          xtermRef.current?.writeln(
            `\r\n\x1b[32mAuthenticated as ${message.user.userId} (${message.user.role})\x1b[0m`
          );
          xtermRef.current?.write("$ ");
        } else if (message.type === "auth_fail") {
          xtermRef.current?.writeln(`\r\n\x1b[31mAuthentication failed: ${message.reason}\x1b[0m`);
        } else if (message.type === "output") {
          xtermRef.current?.write(message.data);
        } else if (message.type === "confirm_required") {
          pendingConfirmPhraseRef.current = message.phrase;
          xtermRef.current?.writeln(
            `\r\n\x1b[33mConfirmation required for: ${message.command}\x1b[0m`
          );
          xtermRef.current?.writeln(`Type exactly: \x1b[36m${message.phrase}\x1b[0m`);
          xtermRef.current?.write("$ ");
        } else if (message.type === "policy_violation") {
          xtermRef.current?.writeln(`\r\n\x1b[31mPolicy violation: ${message.message}\x1b[0m`);
          xtermRef.current?.write("$ ");
        } else if (message.type === "error") {
          xtermRef.current?.writeln(`\r\n\x1b[31mShell error: ${message.message}\x1b[0m`);
          xtermRef.current?.write("$ ");
        } else if (message.type === "exit") {
          xtermRef.current?.writeln(`\r\n\x1b[33mShell exited with code ${message.code}\x1b[0m`);
        }
      } catch {
        xtermRef.current?.write(event.data);
      }
    };

    ws.onerror = () => {
      xtermRef.current?.writeln("\r\n\x1b[31mConnection error\x1b[0m");
    };

    ws.onclose = () => {
      if (isCleaningUpRef.current) return;

      setConnectionStatus("disconnected");
      xtermRef.current?.writeln("\r\n\x1b[33mDisconnected from shell\x1b[0m");

      reconnectTimeoutRef.current = setTimeout(() => {
        xtermRef.current?.writeln("\x1b[36mReconnecting...\x1b[0m");
        connect();
      }, 3000);
    };
  }, [token, initialCommand, onReady]);

  useEffect(() => {
    if (!terminalRef.current || !token) return;

    isCleaningUpRef.current = false;

    const xterm = new XTerm({
      theme: {
        background: "#050508",
        foreground: "#00FF94",
        cursor: "#00FF94",
        cursorAccent: "#050508",
        selectionBackground: "#6C63FF44",
        black: "#0A0A0F",
        red: "#FF4757",
        green: "#00FF94",
        yellow: "#FFB800",
        blue: "#6C63FF",
        magenta: "#FF6B9D",
        cyan: "#00D4FF",
        white: "#E8E8F0",
        brightBlack: "#6B6B8A",
        brightRed: "#FF6B7A",
        brightGreen: "#3DFFB0",
        brightYellow: "#FFCC33",
        brightBlue: "#8B83FF",
        brightMagenta: "#FF8CB5",
        brightCyan: "#33E0FF",
        brightWhite: "#FFFFFF",
      },
      fontFamily: '"JetBrains Mono", "Fira Code", monospace',
      fontSize: 14,
      lineHeight: 1.4,
      cursorBlink: true,
      cursorStyle: "block",
      scrollback: 5000,
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    xterm.loadAddon(fitAddon);
    xterm.loadAddon(webLinksAddon);

    const terminalElement = terminalRef.current;
    xterm.open(terminalElement);

    xtermRef.current = xterm;
    fitAddonRef.current = fitAddon;

    let inputBuffer = "";
    xterm.onData((data) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        return;
      }

      if (data === "\r") {
        xterm.write("\r\n");
        if (pendingConfirmPhraseRef.current && inputBuffer === pendingConfirmPhraseRef.current) {
          wsRef.current.send(JSON.stringify({ type: "confirm", phrase: inputBuffer }));
          pendingConfirmPhraseRef.current = null;
        } else {
          sendShellCommand(wsRef.current, inputBuffer);
        }
        inputBuffer = "";
      } else if (data === "\x7f") {
        if (inputBuffer.length > 0) {
          inputBuffer = inputBuffer.slice(0, -1);
          xterm.write("\b \b");
        }
      } else if (data === "\x03") {
        wsRef.current.send(JSON.stringify({ type: "signal", signal: "SIGINT" }));
        xterm.write("^C\r\n$ ");
        inputBuffer = "";
      } else if (data >= " " || data === "\t") {
        inputBuffer += data;
        xterm.write(data);
      }
    });

    xterm.writeln("\x1b[36m╔══════════════════════════════════════════════════════════╗\x1b[0m");
    xterm.writeln("\x1b[36m║\x1b[0m  \x1b[1;32mMJ Brady Cloud Shell\x1b[0m                                    \x1b[36m║\x1b[0m");
    xterm.writeln("\x1b[36m║\x1b[0m  MCP Operations Command Center                            \x1b[36m║\x1b[0m");
    xterm.writeln("\x1b[36m╚══════════════════════════════════════════════════════════╝\x1b[0m");
    xterm.writeln("");
    xterm.writeln("\x1b[33mAvailable commands:\x1b[0m");
    xterm.writeln("  \x1b[32mhealth-check --all-providers\x1b[0m    Check all provider health");
    xterm.writeln("  \x1b[32mdrift-scan --provider <name>\x1b[0m    Run drift scan");
    xterm.writeln("  \x1b[32mcompliance-check --format json\x1b[0m  Check compliance status");
    xterm.writeln("  \x1b[32mpolicy-apply --file <path>\x1b[0m      Apply policy manifest");
    xterm.writeln("  \x1b[32mledger query\x1b[0m                     Query the ledger");
    xterm.writeln("");
    const connectWhenReady = () => {
      if (!fitTerminal(fitAddon, xterm, terminalElement)) {
        window.setTimeout(connectWhenReady, 50);
        return;
      }

      xterm.writeln("\x1b[36mConnecting to shell...\x1b[0m");
      connect();
    };

    const connectTimer = window.setTimeout(connectWhenReady, 0);

    const handleResize = () => {
      fitTerminal(fitAddon, xterm, terminalElement);
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: "resize",
            cols: xterm.cols,
            rows: xterm.rows,
          })
        );
      }
    };

    window.addEventListener("resize", handleResize);

    return () => {
      isCleaningUpRef.current = true;
      window.clearTimeout(connectTimer);
      window.removeEventListener("resize", handleResize);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      wsRef.current?.close();
      xterm.dispose();
    };
  }, [token, connect]);

  useEffect(() => {
    if (
      initialCommand &&
      !initialCommandSentRef.current &&
      connectionStatus === "connected" &&
      wsRef.current?.readyState === WebSocket.OPEN
    ) {
      initialCommandSentRef.current = true;
      xtermRef.current?.write(initialCommand);
      sendShellCommand(wsRef.current, initialCommand);
    }
  }, [initialCommand, connectionStatus]);

  return (
    <div className="relative h-full w-full bg-terminal-bg rounded-lg overflow-hidden">
      <div className="absolute top-2 right-2 z-10">
        <span
          className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium ${
            connectionStatus === "connected"
              ? "bg-success/20 text-success"
              : connectionStatus === "connecting"
              ? "bg-warning/20 text-warning"
              : "bg-danger/20 text-danger"
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              connectionStatus === "connected"
                ? "bg-success"
                : connectionStatus === "connecting"
                ? "bg-warning animate-pulse"
                : "bg-danger"
            }`}
          />
          {connectionStatus === "connected"
            ? "Connected"
            : connectionStatus === "connecting"
            ? "Connecting..."
            : "Disconnected"}
        </span>
      </div>
      <div ref={terminalRef} className="h-full w-full p-2" />
    </div>
  );
}
