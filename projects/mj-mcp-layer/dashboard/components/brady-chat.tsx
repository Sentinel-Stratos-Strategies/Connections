"use client";

import { FormEvent, useMemo, useState } from "react";
import { Bot, Send, ShieldAlert, Sparkles, User } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { MCP_BASE_URL } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type BradyMessage = {
  id: string;
  role: "operator" | "brady";
  content: string;
  command?: string;
  result?: string;
  blocked?: boolean;
};

const STARTER_PROMPTS = [
  "Check system health",
  "What needs attention before deploy?",
  "Show me the safest next command",
  "Explain the current shell state",
];

function makeId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function makeRequestId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `brady-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function BradyChat() {
  const { token } = useAuth();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<BradyMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const context = useMemo(
    () =>
      messages.slice(-6).map((message) =>
        `${message.role === "operator" ? "Operator" : "Brady"}: ${message.content}`
      ),
    [messages]
  );

  async function sendMessage(nextInput = input) {
    const trimmed = nextInput.trim();
    if (!trimmed || isLoading) return;

    const operatorMessage: BradyMessage = {
      id: makeId(),
      role: "operator",
      content: trimmed,
    };

    setMessages((current) => [...current, operatorMessage]);
    setInput("");
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${MCP_BASE_URL}/api/mj-brady`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-ellis-aegis-token": token || "",
          "x-tenant-id": "operator",
          "x-request-id": makeRequestId(),
          "x-policy-version": "mj-dashboard-v1",
          "x-operator-capability": "mcp.admin",
        },
        body: JSON.stringify({
          message: trimmed,
          tenantId: "operator",
          context,
        }),
      });

      if (!response.ok) {
        throw new Error(`Brady endpoint returned ${response.status}`);
      }

      const data = (await response.json()) as {
        reply?: string;
        command?: string;
        result?: string;
        blocked?: boolean;
      };

      setMessages((current) => [
        ...current,
        {
          id: makeId(),
          role: "brady",
          content: data.reply || "I reached the MCP layer, but no reply came back.",
          command: data.command,
          result: data.result,
          blocked: data.blocked,
        },
      ]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown Brady connection error";
      setError(message);
      setMessages((current) => [
        ...current,
        {
          id: makeId(),
          role: "brady",
          content:
            "I cannot reach the MJ Brady endpoint yet. The shell can still run locally, but the AI lane needs the Cloudflare /api/mj-brady route and token wired.",
          blocked: true,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage();
  }

  return (
    <Card className="flex h-full min-h-[34rem] flex-col overflow-hidden border-accent/20 bg-surface/95">
      <CardHeader className="border-b border-border/70 pb-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-accent" />
              Brady Chat
            </CardTitle>
            <CardDescription>Ask Brady before you execute.</CardDescription>
          </div>
          <span className="rounded-full border border-accent/30 bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent">
            MJ AI Lane
          </span>
        </div>
      </CardHeader>

      <CardContent className="flex min-h-0 flex-1 flex-col p-0">
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {messages.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-background/60 p-4 text-sm text-muted">
              <div className="mb-3 flex items-center gap-2 text-foreground">
                <Bot className="h-4 w-4 text-accent" />
                Brady is standing by.
              </div>
              <p className="leading-6">
                Use this for judgement calls, route checks, deploy planning, and “what should I do next?” moments.
              </p>
              <div className="mt-4 grid gap-2">
                {STARTER_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => void sendMessage(prompt)}
                    className="rounded-lg border border-border bg-surface px-3 py-2 text-left text-xs text-foreground transition hover:border-accent/50 hover:bg-accent/10"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "rounded-xl border p-3 text-sm leading-6",
                  message.role === "operator"
                    ? "ml-8 border-primary/30 bg-primary/10"
                    : "mr-8 border-border bg-background/70",
                  message.blocked && "border-warning/40 bg-warning/10"
                )}
              >
                <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
                  {message.role === "operator" ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
                  {message.role === "operator" ? "You" : "Brady"}
                </div>
                <p className="whitespace-pre-wrap text-foreground">{message.content}</p>
                {message.command && (
                  <pre className="mt-3 overflow-x-auto rounded-lg border border-success/30 bg-black/40 p-2 text-xs text-success">
                    {message.command}
                  </pre>
                )}
                {message.result && (
                  <pre className="mt-3 max-h-40 overflow-auto rounded-lg border border-border bg-black/40 p-2 text-xs text-muted">
                    {message.result}
                  </pre>
                )}
              </div>
            ))
          )}

          {isLoading && (
            <div className="mr-8 rounded-xl border border-border bg-background/70 p-3 text-sm text-muted">
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-accent" />
                Brady is thinking...
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="mx-4 mb-3 flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs text-warning">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="border-t border-border bg-background/80 p-3">
          <div className="flex gap-2">
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask Brady anything..."
              className="min-h-11 flex-1 resize-none rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted focus:border-accent"
              rows={2}
              disabled={isLoading}
            />
            <Button type="submit" disabled={isLoading || !input.trim()} className="self-stretch px-3">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
