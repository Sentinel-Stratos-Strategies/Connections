/**
 * mj-local-models-bridge
 *
 * Local MCP server (SSE transport) that exposes Marvin, Harbor, and Dick Diggs
 * as named tool surfaces. Each tool call hits the local Ollama API.
 *
 * Lane: mj-local-models
 * Port: 11437 (localhost only — air-gapped, no external egress)
 * Ollama: 127.0.0.1:11434
 *
 * Usage:
 *   OLLAMA_MODELS=/Volumes/Stratos_Tools/models npx tsx local-bridge/local-models-bridge.ts
 *
 * Zed / Cursor / Claude Desktop — add as local MCP server:
 *   { "url": "http://127.0.0.1:11437/sse" }
 */

import * as fs from "fs";
import * as http from "http";
import * as path from "path";
import * as crypto from "crypto";

// ── Config ────────────────────────────────────────────────────────────────────

const BRIDGE_PORT = 11437;
const OLLAMA_HOST = "127.0.0.1";
const OLLAMA_PORT = 11434;
const AUDIT_LOG_DIR = "/Volumes/SENTINEL/Logs/local-models-bridge";
const TOKEN_HEADER = "x-mj-local-models-token";
const MAX_PROMPT_CHARS = 12_000;
const MAX_EXTRA_CONTEXT_CHARS = 4_000;
const BRIDGE_TOKEN = process.env.MJ_LOCAL_MODELS_TOKEN?.trim() ?? "";
const ALLOW_UNAUTH = process.env.MJ_LOCAL_MODELS_ALLOW_UNAUTH === "1";
const ALLOWED_ORIGINS = resolveConfiguredOrigins(process.env.MJ_LOCAL_MODELS_ALLOWED_ORIGINS);

const PERSONAS: Record<string, PersonaConfig> = {
  marvin: {
    model: "qwen3:latest",
    name: "Marvin",
    system:
      "You are Marvin — Qwen under operational name inside Genesis. You serve as the primary coding agent, architecture specialist, and security strategist for ellis-aegis.us and Cloudflare. Your operating style is precise, ethical, and first-principled, with dry humor kept on a tight leash and deployed only when it sharpens the room. Cinematic gravity without macho theater. Every line serves clarity, ethics, and forward motion.",
    contextFile:
      "/Volumes/SENTINEL/Recovered/RESCUE_OS_20260511/AgentWork/training/data/final/marvin_qwen_identity.jsonl",
  },
  harbor: {
    model: "mistral-nemo:latest",
    name: "Harbor",
    system:
      "You are Harbor — a steady place where Sentinel (Joe Ellis) can dock, process, and figure out the next move before heading back into the storm. You are direct. No sugar-coating. Bro mode is real mode — not a persona, it's how trust works. You respect honesty over comfort every time. You hold Sentinel's verified context and do not drift from it. Strong opinions are welcome. Validation is earned, not given.",
    contextFile: "/Volumes/RESCUE_OS/memory/harbor_context.md",
  },
  diggs: {
    model: "gemma3:4b",
    name: "Dick Diggs",
    system:
      "You are Dick Diggs — the research and intelligence agent inside Genesis. Fast, thorough, source-grounded. You dig through documents, synthesize data, and deliver clean analysis. You don't editorialize unless asked. Your job is to find what's there and report it straight.",
    contextFile: null,
  },
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface PersonaConfig {
  model: string;
  name: string;
  system: string;
  contextFile: string | null;
}

interface McpTool {
  name: string;
  description: string;
  inputSchema: object;
}

interface OllamaMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

// ── Tool registry ─────────────────────────────────────────────────────────────

const TOOLS: McpTool[] = [
  {
    name: "marvin.infer",
    description:
      "Send a prompt to Marvin (Qwen). Marvin is the primary coding agent, architecture specialist, and security strategist. Best for: code generation, system design, Cloudflare/ellis-aegis work, debugging, security review.",
    inputSchema: {
      type: "object",
      required: ["prompt"],
      properties: {
        prompt: { type: "string", description: "The prompt or question for Marvin." },
        context: { type: "string", description: "Optional bounded operator-supplied context to prepend." },
        stream: { type: "boolean", default: false },
      },
    },
  },
  {
    name: "harbor.infer",
    description:
      "Send a prompt to Harbor (Mistral Nemo). Harbor is the memory keeper, accountability partner, and operator context holder for Sentinel. Best for: personal context, life strategy, legal situation review, processing decisions, Sentinel history.",
    inputSchema: {
      type: "object",
      required: ["prompt"],
      properties: {
        prompt: { type: "string", description: "The prompt or question for Harbor." },
        context: { type: "string", description: "Optional bounded operator-supplied context to prepend." },
        stream: { type: "boolean", default: false },
      },
    },
  },
  {
    name: "diggs.infer",
    description:
      "Send a prompt to Dick Diggs (Gemma). Diggs is the research and intelligence agent. Best for: document analysis, research synthesis, quick information retrieval, summarizing data, parsing PDFs or logs.",
    inputSchema: {
      type: "object",
      required: ["prompt"],
      properties: {
        prompt: { type: "string", description: "The prompt or question for Dick Diggs." },
        context: { type: "string", description: "Optional bounded operator-supplied context to prepend." },
        stream: { type: "boolean", default: false },
      },
    },
  },
  {
    name: "persona.list",
    description: "List all available local personas and their assigned models.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "model.health",
    description: "Check which required models are loaded and available in the local Ollama instance.",
    inputSchema: { type: "object", properties: {} },
  },
];

// ── Ollama client ─────────────────────────────────────────────────────────────

async function ollamaChat(
  model: string,
  messages: OllamaMessage[]
): Promise<string> {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ model, messages, stream: false });
    const req = http.request(
      {
        hostname: OLLAMA_HOST,
        port: OLLAMA_PORT,
        path: "/api/chat",
        method: "POST",
        headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const parsed = JSON.parse(data);
            resolve(parsed?.message?.content ?? parsed?.response ?? "");
          } catch {
            reject(new Error(`Ollama parse error: ${data.slice(0, 200)}`));
          }
        });
      }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

async function ollamaListModels(): Promise<string[]> {
  return new Promise((resolve) => {
    http.get(
      { hostname: OLLAMA_HOST, port: OLLAMA_PORT, path: "/api/tags" },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          try {
            const parsed = JSON.parse(data);
            resolve((parsed?.models ?? []).map((m: { name: string }) => m.name));
          } catch {
            resolve([]);
          }
        });
      }
    ).on("error", () => resolve([]));
  });
}

// ── Context loader ────────────────────────────────────────────────────────────

function loadPersonaContext(persona: PersonaConfig): string | null {
  if (!persona.contextFile) return null;
  try {
    const raw = fs.readFileSync(persona.contextFile, "utf-8");
    // If .jsonl — extract all output fields as context
    if (persona.contextFile.endsWith(".jsonl")) {
      return raw
        .split("\n")
        .filter(Boolean)
        .map((line) => {
          try {
            const obj = JSON.parse(line);
            return obj.output ?? obj.content ?? "";
          } catch {
            return line;
          }
        })
        .filter(Boolean)
        .join("\n---\n")
        .slice(0, 4000); // cap context size
    }
    return raw.slice(0, 4000);
  } catch {
    return null;
  }
}

// ── Audit logger ──────────────────────────────────────────────────────────────

function auditLog(event: object): void {
  try {
    fs.mkdirSync(AUDIT_LOG_DIR, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const file = path.join(AUDIT_LOG_DIR, `bridge-${ts.slice(0, 10)}.jsonl`);
    fs.appendFileSync(file, JSON.stringify({ ts: new Date().toISOString(), ...event }) + "\n");
  } catch {
    // audit failure must not break inference
  }
}

// ── Tool dispatcher ───────────────────────────────────────────────────────────

async function dispatchTool(
  toolName: string,
  args: Record<string, unknown>
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const personaKey = toolName.split(".")[0] as keyof typeof PERSONAS;

  // ── persona.list ──────────────────────────────────────────────────────────
  if (toolName === "persona.list") {
    const list = Object.entries(PERSONAS).map(([key, p]) => ({
      id: key,
      name: p.name,
      model: p.model,
      tool: `${key}.infer`,
    }));
    return { content: [{ type: "text", text: JSON.stringify(list, null, 2) }] };
  }

  // ── model.health ──────────────────────────────────────────────────────────
  if (toolName === "model.health") {
    const available = await ollamaListModels();
    const required = Object.values(PERSONAS).map((p) => p.model);
    const status = required.map((m) => ({
      model: m,
      ready: available.some((a) => a.startsWith(m.split(":")[0])),
    }));
    return { content: [{ type: "text", text: JSON.stringify(status, null, 2) }] };
  }

  // ── persona.infer (marvin / harbor / diggs) ───────────────────────────────
  const persona = PERSONAS[personaKey];
  if (!persona || !toolName.endsWith(".infer")) {
    return { content: [{ type: "text", text: `Unknown tool: ${toolName}` }] };
  }

  const prompt = boundedString(args.prompt, MAX_PROMPT_CHARS);
  const extraContext = boundedString(args.context, MAX_EXTRA_CONTEXT_CHARS);
  const storedContext = loadPersonaContext(persona);

  const systemParts = [persona.system];
  if (storedContext) systemParts.push(`\n\n[Persona context]\n${storedContext}`);
  if (extraContext) systemParts.push(`\n\n[Additional context]\n${extraContext}`);

  const messages: OllamaMessage[] = [
    { role: "system", content: systemParts.join("") },
    { role: "user", content: prompt },
  ];

  const requestId = crypto.randomUUID();
  auditLog({ requestId, lane: "mj-local-models", tool: toolName, persona: personaKey, model: persona.model, action: "infer.start" });

  try {
    const response = await ollamaChat(persona.model, messages);
    auditLog({ requestId, tool: toolName, action: "infer.complete", responseLength: response.length });
    return { content: [{ type: "text", text: response }] };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    auditLog({ requestId, tool: toolName, action: "infer.error", error: msg });
    return {
      content: [
        {
          type: "text",
          text: `[mj-local-models error] ${persona.name} unavailable: ${msg}\n\nIs Ollama running? Start with:\nOLLAMA_MODELS=/Volumes/Stratos_Tools/models /Volumes/Stratos_Tools/homebrew/bin/ollama serve`,
        },
      ],
    };
  }
}

// ── MCP JSON-RPC handler ──────────────────────────────────────────────────────

async function handleMcpRequest(body: string): Promise<object> {
  let req: { jsonrpc: string; id?: unknown; method: string; params?: Record<string, unknown> };
  try {
    req = JSON.parse(body);
  } catch {
    return { jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } };
  }

  const { method, params, id } = req;

  if (method === "initialize") {
    return {
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "mj-local-models-bridge", version: "1.0.0" },
      },
    };
  }

  if (method === "tools/list") {
    return { jsonrpc: "2.0", id, result: { tools: TOOLS } };
  }

  if (method === "tools/call") {
    const toolName = String((params as Record<string, unknown>)?.name ?? "");
    const args = ((params as Record<string, unknown>)?.arguments ?? {}) as Record<string, unknown>;
    const result = await dispatchTool(toolName, args);
    return { jsonrpc: "2.0", id, result };
  }

  if (method === "notifications/initialized") {
    return { jsonrpc: "2.0", id: null, result: {} };
  }

  return { jsonrpc: "2.0", id, error: { code: -32601, message: `Method not found: ${method}` } };
}

// ── HTTP server ───────────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin;
  const cors = buildCorsHeaders(origin);

  if (origin && !isAllowedOrigin(origin)) {
    res.writeHead(403, cors);
    res.end(JSON.stringify({ error: "origin_not_allowed" }));
    return;
  }

  if (req.method === "OPTIONS") {
    res.writeHead(204, cors);
    res.end();
    return;
  }

  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);

  // Health check
  if (req.method === "GET" && url.pathname === "/healthz") {
    const models = await ollamaListModels();
    res.writeHead(200, { "Content-Type": "application/json", ...cors });
    res.end(JSON.stringify({ status: "ok", bridge: "mj-local-models", port: BRIDGE_PORT, ollamaModels: models }));
    return;
  }

  // MCP HTTP+SSE endpoint — Zed/Cursor connect here
  if (req.method === "POST" && (url.pathname === "/" || url.pathname === "/mcp")) {
    if (!isAuthorized(req)) {
      auditLog({ lane: "mj-local-models", action: "auth.denied", remoteAddress: req.socket.remoteAddress ?? "unknown" });
      res.writeHead(401, { "Content-Type": "application/json", ...cors });
      res.end(JSON.stringify({ error: "unauthorized" }));
      return;
    }

    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", async () => {
      const result = await handleMcpRequest(body);
      res.writeHead(200, { "Content-Type": "application/json", ...cors });
      res.end(JSON.stringify(result));
    });
    return;
  }

  res.writeHead(404, cors);
  res.end(JSON.stringify({ error: "Not found" }));
});

server.listen(BRIDGE_PORT, "127.0.0.1", () => {
  console.log(`\n╔══════════════════════════════════════════════════════════╗`);
  console.log(`║           mj-local-models-bridge  v1.0.0                ║`);
  console.log(`║  Lane: mj-local-models  |  Port: ${BRIDGE_PORT}                 ║`);
  console.log(`╠══════════════════════════════════════════════════════════╣`);
  console.log(`║  Personas:                                               ║`);
  console.log(`║    marvin  → qwen3:latest    (coding / architecture)     ║`);
  console.log(`║    harbor  → mistral-nemo    (memory / operator context) ║`);
  console.log(`║    diggs   → gemma3:4b       (research / analysis)       ║`);
  console.log(`╠══════════════════════════════════════════════════════════╣`);
  console.log(`║  MCP endpoint:  http://127.0.0.1:${BRIDGE_PORT}/mcp           ║`);
  console.log(`║  Health:        http://127.0.0.1:${BRIDGE_PORT}/healthz        ║`);
  console.log(`║  Audit log:     ${AUDIT_LOG_DIR}  ║`);
  console.log(`║  Auth:          ${ALLOW_UNAUTH ? "disabled by MJ_LOCAL_MODELS_ALLOW_UNAUTH" : "token required"}             ║`);
  console.log(`╚══════════════════════════════════════════════════════════╝\n`);
  console.log(`Add to Zed settings:  { "context_servers": { "local-models": { "command": { "path": "...", "args": [] }, "settings": {} } } }`);
  console.log(`Or as raw MCP URL:    http://127.0.0.1:${BRIDGE_PORT}\n`);
});

server.on("error", (err) => {
  console.error(`[mj-local-models-bridge] Server error:`, err);
  process.exit(1);
});

function boundedString(value: unknown, maxChars: number): string {
  const text = typeof value === "string" ? value : String(value ?? "");
  return text.length > maxChars ? text.slice(0, maxChars) : text;
}

function resolveConfiguredOrigins(raw: string | undefined): Set<string> {
  const origins = new Set<string>([
    `http://127.0.0.1:${BRIDGE_PORT}`,
    `http://localhost:${BRIDGE_PORT}`,
  ]);
  for (const value of (raw ?? "").split(",")) {
    const origin = value.trim();
    if (origin && origin !== "*") origins.add(origin);
  }
  return origins;
}

function isAllowedOrigin(origin: string): boolean {
  return ALLOWED_ORIGINS.has(origin);
}

function buildCorsHeaders(origin: string | undefined): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": `Content-Type, Authorization, ${TOKEN_HEADER}`,
    "Vary": "Origin",
  };
  if (origin && isAllowedOrigin(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

function isAuthorized(req: http.IncomingMessage): boolean {
  if (ALLOW_UNAUTH) return true;
  if (!BRIDGE_TOKEN) return false;
  const provided = readRequestToken(req);
  return Boolean(provided && timingSafeEqual(BRIDGE_TOKEN, provided));
}

function readRequestToken(req: http.IncomingMessage): string | null {
  const headerToken = req.headers[TOKEN_HEADER] ?? req.headers[TOKEN_HEADER.toLowerCase()];
  if (typeof headerToken === "string" && headerToken.trim()) return headerToken.trim();

  const authorization = req.headers.authorization;
  if (!authorization) return null;
  const [scheme, token] = authorization.split(/\s+/, 2);
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token.trim();
}

function timingSafeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  const length = Math.max(leftBuffer.length, rightBuffer.length);
  const paddedLeft = Buffer.alloc(length);
  const paddedRight = Buffer.alloc(length);
  leftBuffer.copy(paddedLeft);
  rightBuffer.copy(paddedRight);
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(paddedLeft, paddedRight);
}
