import { CONSOLE_LANE_AUTHORITY, CONSOLE_LANES, SKIPPED_CONSOLE_LANES } from "./console-lanes";
import * as memory from "./memory-contract";
import * as voice from "./voice-contract";
import { syncGenesisMemory } from "./genesis-sync";
import * as notifications from "./notifications";
import * as drift from "./drift-alerts";

interface WatcherJob {
  actor: string;
  createdAt: string;
  kind: WatcherKind;
  source: "api" | "schedule";
}

type WatcherKind = "digest" | "drift" | "edge-abuse" | "origin-health";

interface Env {
  APP_NAME?: string;
  APP_ENV?: string;
  ZONE_NAME?: string;
  PUBLIC_BASE_URL?: string;
  ALLOWED_ORIGINS?: string;
  OPERATOR_HEADER?: string;
  OPERATOR_TOKEN?: string;
  AEGIS_TOKEN?: string;
  GENESIS_TUNNEL_URL?: string;
  OPENAI_API_KEY?: string;
  BRADY_MODEL?: string;
  DB?: D1Database;
  FLAGS?: KVNamespace;
  EVIDENCE_BUCKET?: R2Bucket;
  WATCHER_QUEUE?: Queue<WatcherJob>;
  /** Static dashboard + assets (Wrangler `assets.binding`) */
  ASSETS?: Fetcher;
}

type JsonRecord = Record<string, unknown>;

interface ChangeRequestInput {
  intent: string;
  requester: string;
  payload: JsonRecord;
  policy_version?: string;
}

interface PolicyConfig {
  deny_by_default: boolean;
  allowed_paths: string[];
  required_headers: string[];
  method_matrix: Record<string, string[]>;
  capability_matrix: Record<string, Record<string, string[]>>;
}

const WATCHER_KINDS: WatcherKind[] = ["edge-abuse", "drift", "origin-health", "digest"];

/** Mirrors `<meta http-equiv="Content-Security-Policy">` on dashboard HTML (CP-3). */
const DASHBOARD_CSP =
  "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self' https://mcp.ellis-aegis.us https://mj.ellis-aegis.us wss://mcp.ellis-aegis.us wss://mj.ellis-aegis.us; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests";

export const POLICY: PolicyConfig = {
  deny_by_default: true,
  allowed_paths: [
    "/mcp",
    "/turn/*",
    "/audit/*",
    "/api/assets",
    "/api/events",
    "/api/incidents",
    "/api/checks/run",
    "/api/change-request",
    "/api/console/lanes",
    "/api/mj-brady",
    "/api/ledger",
    "/api/genesis/mcp",
    "/api/memory",
    "/api/memory/*",
    "/api/voice",
    "/api/voice/*",
    "/api/notifications/subscribe",
    "/api/notifications/drift-alert",
  ],
  required_headers: ["x-tenant-id", "x-request-id", "x-policy-version", "x-operator-capability"],
  method_matrix: {
    "/mcp": ["GET", "POST", "OPTIONS"],
    "/turn/*": ["POST", "OPTIONS"],
    "/audit/*": ["GET", "OPTIONS"],
    "/api/assets": ["GET", "OPTIONS"],
    "/api/events": ["GET", "OPTIONS"],
    "/api/incidents": ["GET", "OPTIONS"],
    "/api/checks/run": ["POST", "OPTIONS"],
    "/api/change-request": ["GET", "POST", "OPTIONS"],
    "/api/console/lanes": ["GET", "OPTIONS"],
    "/api/mj-brady": ["POST", "OPTIONS"],
    "/api/ledger": ["GET", "OPTIONS"],
    "/api/genesis/mcp": ["POST", "OPTIONS"],
    "/api/memory": ["GET", "POST", "OPTIONS"],
    "/api/memory/*": ["GET", "DELETE", "OPTIONS"],
    "/api/voice": ["GET", "POST", "OPTIONS"],
    "/api/voice/*": ["GET", "DELETE", "OPTIONS"],
    "/api/notifications/subscribe": ["POST", "OPTIONS"],
    "/api/notifications/drift-alert": ["POST", "OPTIONS"],
  },
  capability_matrix: {
    "/mcp": {
      GET: ["mcp.admin", "forensic.read", "cloud.ops", "security.status"],
      POST: ["mcp.admin"],
    },
    "/turn/*": {
      POST: ["script.run", "mcp.admin"],
    },
    "/audit/*": {
      GET: ["forensic.read", "mcp.admin"],
    },
    "/api/assets": {
      GET: ["forensic.read", "mcp.admin"],
    },
    "/api/events": {
      GET: ["forensic.read", "mcp.admin"],
    },
    "/api/incidents": {
      GET: ["forensic.read", "mcp.admin"],
    },
    "/api/checks/run": {
      POST: ["cloud.ops", "mcp.admin", "security.status"],
    },
    "/api/change-request": {
      GET: ["forensic.read", "mcp.admin"],
      POST: ["cloud.ops", "mcp.admin"],
    },
    "/api/console/lanes": {
      GET: ["forensic.read", "mcp.admin", "cloud.ops", "security.status"],
    },
    "/api/mj-brady": {
      POST: ["mcp.admin", "cloud.ops", "security.status"],
    },
    "/api/ledger": {
      GET: ["forensic.read", "mcp.admin"],
    },
    "/api/genesis/mcp": {
      POST: ["mcp.admin", "cloud.ops"],
    },
    "/api/memory": {
      GET: ["mcp.admin", "forensic.read"],
      POST: ["mcp.admin", "cloud.ops"],
    },
    "/api/memory/*": {
      GET: ["mcp.admin", "forensic.read"],
      DELETE: ["mcp.admin", "cloud.ops"],
    },
    "/api/voice": {
      GET: ["mcp.admin", "forensic.read"],
      POST: ["mcp.admin", "cloud.ops"],
    },
    "/api/voice/*": {
      GET: ["mcp.admin", "forensic.read"],
      DELETE: ["mcp.admin", "cloud.ops"],
    },
    "/api/notifications/subscribe": {
      POST: ["mcp.admin", "cloud.ops"],
    },
    "/api/notifications/drift-alert": {
      POST: ["mcp.admin", "cloud.ops"],
    },
  },
};

const BASE_HEADERS: Record<string, string> = {
  "cache-control": "no-store",
  "content-security-policy": "default-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
  "cross-origin-resource-policy": "same-origin",
  "permissions-policy": "camera=(), geolocation=(), microphone=()",
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
};

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === "OPTIONS" && (path.startsWith("/api/") || path === "/mcp" || path.startsWith("/turn/") || path.startsWith("/audit/"))) {
      return buildPreflightResponse(request, env);
    }

    if (request.method === "GET" && path === "/") {
      return html(renderHomePage(), { env, request });
    }

    if (request.method === "GET" && path === "/robots.txt") {
      return text("User-agent: *\nDisallow: /\n", {
        env,
        headers: { "content-type": "text/plain; charset=utf-8" },
        request,
      });
    }

    if (request.method === "GET" && (path === "/dashboard" || path === "/dashboard/" || path.startsWith("/dashboard/"))) {
      return serveDashboard(request, env);
    }

    const policyBasePath = resolvePolicyBasePath(path);
    if (policyBasePath) {
      const policyCheck = enforceMcpPolicy(request, request.method, policyBasePath);
      if (policyCheck) return json(policyCheck, { env, request, status: 403 });
    }

    // ---------- MCP Protocol Endpoints ----------

    if (path === "/healthz" && request.method === "GET") {
      return json({
        status: "ok",
      }, { env, request });
    }

    if (path === "/mcp" && request.method === "GET") {
      return handleMcpList(request, env);
    }

    if (path === "/mcp" && request.method === "POST") {
      return handleMcpExecute(request, env, ctx);
    }

    if (path.startsWith("/turn/") && request.method === "POST") {
      return handleTurn(request, env, ctx, path);
    }

    if (path.startsWith("/audit/") && request.method === "GET") {
      return handleAudit(request, env, ctx, path);
    }

    // ---------- API Endpoints ----------

    if (request.method === "GET" && path === "/api/health") {
      return json({
        status: "ok",
      }, { env, request });
    }

    if (path === "/api/assets" && request.method === "GET") {
      return handleProtectedList(request, env, "assets");
    }
    if (path === "/api/events" && request.method === "GET") {
      return handleProtectedList(request, env, "events");
    }
    if (path === "/api/incidents" && request.method === "GET") {
      return handleProtectedList(request, env, "incidents");
    }
    if (path === "/api/checks/run" && request.method === "POST") {
      return handleProtectedCheckRun(request, env, ctx);
    }

    if (path === "/api/change-request" && request.method === "POST") {
      return handleChangeRequest(request, env, ctx);
    }
    if (path === "/api/change-request" && request.method === "GET") {
      return handleChangeRequestList(request, env);
    }

    if (path === "/api/console/lanes" && request.method === "GET") {
      return handleConsoleLanes(request, env, ctx);
    }

    if (path === "/api/mj-brady" && request.method === "POST") {
      return handleMjBrady(request, env, ctx);
    }

    if (path === "/api/ledger" && request.method === "GET") {
      return handleLedgerList(request, env);
    }
    if (path === "/api/genesis/mcp" && request.method === "POST") {
      return handleGenesisMcpProxy(request, env, ctx);
    }

    // ---------- Memory Contract ----------

    if (path === "/api/memory" && request.method === "GET") {
      return memory.handleMemoryList(request, env);
    }
    if (path === "/api/memory" && request.method === "POST") {
      return memory.handleMemoryUpsert(request, env);
    }
    if (path === "/api/memory" && request.method === "DELETE") {
      return memory.handleMemoryPurge(request, env);
    }
    if (path.startsWith("/api/memory/") && request.method === "GET") {
      const id = path.split("/").pop() || "";
      return memory.handleMemoryShow(request, env, id);
    }
    if (path.startsWith("/api/memory/") && request.method === "DELETE") {
      const id = path.split("/").pop() || "";
      return memory.handleMemoryDelete(request, env, id);
    }

    // ---------- Voice Contract ----------

    if (path === "/api/voice" && request.method === "GET") {
      return voice.handleVoiceList(request, env);
    }
    if (path === "/api/voice" && request.method === "POST") {
      return voice.handleVoiceUpsert(request, env);
    }
    if (path.startsWith("/api/voice/") && request.method === "GET") {
      const id = path.split("/").pop() || "";
      return voice.handleVoiceShow(request, env, id);
    }
    if (path.startsWith("/api/voice/") && request.method === "DELETE") {
      const id = path.split("/").pop() || "";
      return voice.handleVoiceDelete(request, env, id);
    }

    // ---------- Notifications & Drift Alerts ----------

    if (path === "/api/notifications/subscribe" && request.method === "POST") {
      return notifications.handleSubscribe(request, env);
    }
    if (path === "/api/notifications/drift-alert" && request.method === "POST") {
      return drift.handleDriftWebhook(request, env);
    }

    return json({ error: "not_found" }, { env, request, status: 404 });
  },

  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    const jobs: WatcherJob[] = WATCHER_KINDS.map((kind) => ({
      actor: "scheduler",
      createdAt: new Date().toISOString(),
      kind,
      source: "schedule",
    }));

    ctx.waitUntil(dispatchJobs(env, jobs));
    ctx.waitUntil(syncGenesisMemory(env, ctx));
    ctx.waitUntil(drift.runDriftScanner(env));
    ctx.waitUntil(
      logEvent(env, {
        actor: "scheduler",
        category: "check.schedule",
        message: `Scheduled watcher sweep fired for cron ${controller.cron}`,
        metadata: JSON.stringify({ cron: controller.cron, watcherCount: jobs.length }),
        severity: "info",
        source: "worker",
      }),
    );
  },

  async queue(batch: MessageBatch<WatcherJob>, env: Env): Promise<void> {
    for (const message of batch.messages) {
      try {
        await logEvent(env, {
          actor: message.body.actor,
          category: "watcher.job",
          message: `Watcher job received: ${message.body.kind}`,
          metadata: JSON.stringify(message.body),
          severity: "info",
          source: "queue",
        });
        message.ack();
      } catch (error) {
        console.error("queue-consumer-error", error);
        message.retry();
      }
    }
  },
};

// ---------- MCP Handlers ----------

async function handleMcpList(request: Request, env: Env): Promise<Response> {
  const auth = await authenticate(request, env);
  if (!auth.ok) return json({ error: auth.error }, { env, request, status: 401 });

  const tenantId = request.headers.get("x-tenant-id") ?? "unknown";

  return json({
    protocol: "mcp",
    version: "1.0",
    tenant: tenantId,
    capabilities: {
      tools: ["tools/list", "tools/call"],
      resources: ["resources/list", "resources/read"],
    },
    endpoints: {
      consoleLanes: "/api/console/lanes",
      mcp: "/mcp",
      turn: "/turn/{turnId}",
      audit: "/audit/events",
      healthz: "/healthz",
    },
    policy: {
      deny_by_default: POLICY.deny_by_default,
      required_headers: POLICY.required_headers,
    },
  }, { env, request });
}

async function handleGenesisMcpProxy(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const auth = await authenticate(request, env);
  if (!auth.ok) return json({ error: auth.error }, { env, request, status: 401 });

  const body = await readRequestJson(request);
  const tunnelURL = env.GENESIS_TUNNEL_URL;
  if (!tunnelURL) {
    return json({ error: "genesis_tunnel_not_configured" }, { env, request, status: 503 });
  }

  const token = env.AEGIS_TOKEN ?? env.OPERATOR_TOKEN;
  if (!token) {
    return json({ error: "aegis_token_not_configured" }, { env, request, status: 503 });
  }

  ctx.waitUntil(logEvent(env, {
    actor: auth.actor,
    category: "genesis.proxy",
    message: "Forwarding MCP request to Genesis tunnel",
    metadata: JSON.stringify(buildAuditMetadata(request, { tunnelURL })),
    severity: "info",
    source: "api",
  }));

  try {
    const upstream = await fetch(`${tunnelURL.replace(/\/$/, "")}/mcp`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": `Bearer ${token}`,
        "x-genesis-token": token,
      },
      body: JSON.stringify(body),
    });
    const payload = await upstream.text();
    return new Response(payload, {
      status: upstream.status,
      headers: {
        ...BASE_HEADERS,
        "content-type": upstream.headers.get("content-type") ?? "application/json; charset=utf-8",
      },
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "tunnel_unreachable";
    return json({ error: detail }, { env, request, status: 502 });
  }
}

async function handleMcpExecute(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const auth = await authenticate(request, env);
  if (!auth.ok) return json({ error: auth.error }, { env, request, status: 401 });

  const body = await readRequestJson(request);
  const method = typeof body.method === "string" ? body.method : "";
  const tenantId = request.headers.get("x-tenant-id") ?? "unknown";
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  const hasJsonRpcId = Object.prototype.hasOwnProperty.call(body, "id");
  const responseId = hasJsonRpcId ? body.id : requestId;

  ctx.waitUntil(logEvent(env, {
    actor: auth.actor,
    category: "mcp.execute",
    message: `MCP method=${method} tenant=${tenantId}`,
    metadata: JSON.stringify(buildAuditMetadata(request, {
      mcpMethod: method,
      requestId,
      responseId,
      tenantId,
    })),
    severity: "info",
    source: "worker",
  }));

  if (method === "tools/list") {
    return json({
      jsonrpc: "2.0",
      id: responseId,
      result: {
        tools: [
          { name: "health_check", description: "Run infrastructure health check", inputSchema: { type: "object", properties: {} } },
          { name: "console_lanes", description: "List active MJ console connector lanes and activation state", inputSchema: { type: "object", properties: {} } },
          { name: "drift_scan", description: "Detect unauthorized configuration drift", inputSchema: { type: "object", properties: { provider: { type: "string" } } } },
          { name: "compliance_check", description: "Validate compliance across providers", inputSchema: { type: "object", properties: {} } },
          { name: "ledger_query", description: "Query the immutable audit ledger", inputSchema: { type: "object", properties: { since: { type: "string" }, intent: { type: "string" } } } },
        ],
      },
    }, { env, request });
  }

  if (method === "tools/call") {
    const params = isJsonRecord(body.params) ? body.params : {};
    const toolName = typeof params.name === "string" ? params.name : "";
    if (toolName === "console_lanes") {
      return json({
        jsonrpc: "2.0",
        id: responseId,
        result: {
          content: [{
            type: "text",
            text: JSON.stringify({
              authority: CONSOLE_LANE_AUTHORITY,
              count: CONSOLE_LANES.length,
              lanes: CONSOLE_LANES.map((lane) => ({
                activation: lane.activation,
                consoleConnector: lane.consoleConnector,
                entrypoint: lane.entrypoint,
                lane: lane.lane,
                status: lane.status,
              })),
            }, null, 2),
          }],
        },
      }, { env, request });
    }
    return json({
      jsonrpc: "2.0",
      id: responseId,
      result: {
        content: [{ type: "text", text: `Tool '${toolName}' acknowledged. Dispatch queued for tenant '${tenantId}'.` }],
      },
    }, { env, request });
  }

  return json({
    jsonrpc: "2.0",
    id: responseId,
    error: { code: -32601, message: `Method not found: ${method}` },
  }, { env, request, status: 400 });
}

async function handleTurn(request: Request, env: Env, ctx: ExecutionContext, path: string): Promise<Response> {
  const auth = await authenticate(request, env);
  if (!auth.ok) return json({ error: auth.error }, { env, request, status: 401 });

  const body = await readRequestJson(request);
  const tenantId = request.headers.get("x-tenant-id") ?? "unknown";
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  const turnId = path.replace("/turn/", "").replace("/turn", "") || crypto.randomUUID();

  ctx.waitUntil(logEvent(env, {
    actor: auth.actor,
    category: "turn.execute",
    message: `Turn request tenant=${tenantId} turn=${turnId}`,
    metadata: JSON.stringify(buildAuditMetadata(request, { tenantId, turnId, requestId })),
    severity: "info",
    source: "worker",
  }));

  return json({
    accepted: true,
    turnId,
    requestId,
    tenant: tenantId,
    status: "processing",
    timestamp: new Date().toISOString(),
  }, { env, request, status: 202 });
}

async function handleAudit(request: Request, env: Env, ctx: ExecutionContext, path: string): Promise<Response> {
  const auth = await authenticate(request, env);
  if (!auth.ok) return json({ error: auth.error }, { env, request, status: 401 });

  const url = new URL(request.url);
  const since = url.searchParams.get("since");
  const category = url.searchParams.get("category");
  const limit = parseBoundedLimit(url.searchParams.get("limit"));

  ctx.waitUntil(logEvent(env, {
    actor: auth.actor,
    category: "audit.query",
    message: `Audit query path=${path}`,
    metadata: JSON.stringify(buildAuditMetadata(request, { since, category, limit })),
    severity: "info",
    source: "worker",
  }));

  if (!env.DB) {
    return json({ events: [], message: "D1 not configured" }, { env, request });
  }

  let query = "SELECT * FROM events";
  const conditions: string[] = [];
  const params: string[] = [];

  if (since) {
    conditions.push("created_at >= ?");
    params.push(since);
  }
  if (category) {
    conditions.push("category = ?");
    params.push(category);
  }

  if (conditions.length > 0) {
    query += " WHERE " + conditions.join(" AND ");
  }
  query += ` ORDER BY created_at DESC LIMIT ${limit}`;

  const stmt = env.DB.prepare(query);
  const bound = params.length > 0 ? stmt.bind(...params) : stmt;
  const result = await bound.all<JsonRecord>();

  return json({
    events: result.results ?? [],
    count: (result.results ?? []).length,
    query: { since, category, limit },
  }, { env, request });
}

async function handleConsoleLanes(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const auth = await authenticate(request, env);
  if (!auth.ok) return json({ error: auth.error }, { env, request, status: 401 });

  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const connector = url.searchParams.get("connector")?.toLowerCase();
  const lanes = CONSOLE_LANES.filter((lane) => {
    if (status && lane.status !== status) return false;
    if (connector && !lane.consoleConnector.toLowerCase().includes(connector)) return false;
    return true;
  });

  ctx.waitUntil(logEvent(env, {
    actor: auth.actor,
    category: "console.lanes.query",
    message: `Console lane registry queried count=${lanes.length}`,
    metadata: JSON.stringify(buildAuditMetadata(request, {
      connector,
      laneCount: lanes.length,
      status,
    })),
    severity: "info",
    source: "api",
  }));

  return json({
    authority: CONSOLE_LANE_AUTHORITY,
    count: lanes.length,
    lanes,
    policy: {
      authHeader: env.OPERATOR_HEADER ?? "x-ellis-aegis-token",
      denyByDefault: POLICY.deny_by_default,
      requiredHeaders: POLICY.required_headers,
    },
    skipped: SKIPPED_CONSOLE_LANES,
  }, { env, request });
}

// ---------- Brady AI Handler ----------

async function handleMjBrady(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const auth = await authenticate(request, env);
  if (!auth.ok) return json({ error: auth.error }, { env, request, status: 401 });

  const body = await readRequestJson(request);
  const tenantId =
    readString(body.tenantId)?.slice(0, 96) ||
    request.headers.get("x-tenant-id")?.slice(0, 96) ||
    "operator";
  const message = readString(body.message)?.trim() ?? "";
  const context = Array.isArray(body.context)
    ? body.context
      .filter((entry): entry is string => typeof entry === "string")
      .slice(-12)
      .map((entry) => entry.slice(0, 2000))
    : [];

  if (!message) {
    return json({ error: "message is required" }, { env, request, status: 400 });
  }
  if (message.length > 8000) {
    return json({ error: "message exceeds 8000 characters" }, { env, request, status: 413 });
  }

  const memoryContext = await fetchBradyMemoryContext(tenantId, env);
  const systemPrompt = buildBradySystemPrompt(memoryContext, context);
  const reply = await routeToBradyLlm(systemPrompt, message, env);
  const command = extractCommandIntent(reply);
  const auditId = crypto.randomUUID();

  ctx.waitUntil(logEvent(env, {
    actor: auth.actor,
    category: "brady.chat",
    message: `MJ Brady chat tenant=${tenantId}`,
    metadata: JSON.stringify(buildAuditMetadata(request, {
      auditId,
      command: command ?? null,
      contextCount: context.length,
      hasMemory: Object.keys(memoryContext).length > 0,
      tenantId,
    })),
    severity: "info",
    source: "api",
  }));

  return json({
    auditId,
    blocked: false,
    command: command ?? undefined,
    reply,
  }, { env, request });
}

function readString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

async function fetchBradyMemoryContext(tenantId: string, env: Env): Promise<Record<string, string>> {
  if (!env.DB) return {};
  try {
    return await memory.fetchMemoryContext(tenantId, env) as Record<string, string>;
  } catch (error) {
    console.error("brady-memory-context-error", error);
    return {};
  }
}

function buildBradySystemPrompt(memoryContext: Record<string, string>, context: string[]): string {
  const memoryLines = Object.entries(memoryContext)
    .slice(0, 20)
    .map(([key, value]) => `- ${key}: ${value.slice(0, 500)}`)
    .join("\n");
  const contextLines = context.length > 0 ? context.join("\n") : "No recent dashboard context.";

  return [
    "You are MJ Brady, the Ellis-Aegis operator quarterback.",
    "You help Joe route cloud, shell, forensics, Genesis Method, and deployment work safely.",
    "Be direct, practical, and approval-aware. Do not claim a command ran unless the shell or ledger confirms it.",
    "If the operator asks for a risky mutation, recommend the safest next command and call out the approval gate.",
    "",
    "Recent dashboard context:",
    contextLines,
    "",
    "Memory context:",
    memoryLines || "No memory entries available.",
  ].join("\n");
}

async function routeToBradyLlm(systemPrompt: string, message: string, env: Env): Promise<string> {
  const apiKey = env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return [
      "Brady lane is online at the MCP edge, but the LLM provider secret is not configured yet.",
      "Local shell can still run, and I can validate policy/route health once OPENAI_API_KEY is set on the Worker.",
      "",
      `Operator ask: ${message}`,
    ].join("\n");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "authorization": `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        input: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message },
        ],
        max_output_tokens: 700,
        model: env.BRADY_MODEL || "gpt-4.1-mini",
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      return `Brady reached the LLM provider, but it returned ${response.status}. ${detail.slice(0, 300)}`;
    }

    const payload = await response.json() as JsonRecord;
    return extractResponseText(payload) || "Brady reached the LLM provider, but no text response came back.";
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown_error";
    return `Brady route is live, but the LLM request failed: ${detail}`;
  } finally {
    clearTimeout(timeout);
  }
}

function extractResponseText(payload: JsonRecord): string {
  if (typeof payload.output_text === "string") return payload.output_text;

  const output = Array.isArray(payload.output) ? payload.output : [];
  const chunks: string[] = [];
  for (const item of output) {
    if (!isJsonRecord(item)) continue;
    const content = Array.isArray(item.content) ? item.content : [];
    for (const contentItem of content) {
      if (!isJsonRecord(contentItem)) continue;
      const text = contentItem.text;
      if (typeof text === "string") chunks.push(text);
    }
  }
  return chunks.join("\n").trim();
}

function extractCommandIntent(reply: string): string | undefined {
  const commandLabel = reply.match(/(?:^|\n)\s*(?:command|next command)\s*:\s*`?([^\n`]+)`?/i);
  if (commandLabel?.[1]) return commandLabel[1].trim();

  const fencedBlock = reply.match(/```(?:bash|sh|zsh|shell)?\n([\s\S]*?)```/i);
  const command = fencedBlock?.[1]
    ?.split("\n")
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith("#"));

  return command;
}

// ---------- Change Request Handlers ----------

async function handleChangeRequest(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const auth = await authenticate(request, env);
  if (!auth.ok) return json({ error: auth.error }, { env, request, status: 401 });

  const body = await readRequestJson(request) as Partial<ChangeRequestInput>;
  if (!body.intent || !body.payload) {
    return json({ error: "intent and payload are required" }, { env, request, status: 400 });
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  if (env.DB) {
    await env.DB.prepare(
      "INSERT INTO change_requests (id, intent, requester, status, policy_version, payload, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
    ).bind(
      id,
      body.intent,
      body.requester ?? auth.actor,
      "pending",
      body.policy_version ?? null,
      JSON.stringify(body.payload),
      now,
    ).run();
  }

  ctx.waitUntil(logEvent(env, {
    actor: auth.actor,
    category: "change_request.created",
    message: `Change request created: ${body.intent}`,
    metadata: JSON.stringify({ id, intent: body.intent }),
    severity: "info",
    source: "api",
  }));

  return json({
    id,
    intent: body.intent,
    status: "pending",
    created_at: now,
  }, { env, request, status: 201 });
}

async function handleChangeRequestList(request: Request, env: Env): Promise<Response> {
  const auth = await authenticate(request, env);
  if (!auth.ok) return json({ error: auth.error }, { env, request, status: 401 });

  if (!env.DB) return json({ requests: [] }, { env, request });

  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const limit = parseBoundedLimit(url.searchParams.get("limit"));

  let query = "SELECT * FROM change_requests";
  const params: string[] = [];
  if (status) {
    query += " WHERE status = ?";
    params.push(status);
  }
  query += ` ORDER BY created_at DESC LIMIT ${limit}`;

  const stmt = env.DB.prepare(query);
  const bound = params.length > 0 ? stmt.bind(...params) : stmt;
  const result = await bound.all<JsonRecord>();

  return json({ requests: result.results ?? [] }, { env, request });
}

// ---------- Ledger Handler ----------

async function handleLedgerList(request: Request, env: Env): Promise<Response> {
  const auth = await authenticate(request, env);
  if (!auth.ok) return json({ error: auth.error }, { env, request, status: 401 });

  if (!env.DB) return json({ entries: [], message: "D1 not configured" }, { env, request });

  const url = new URL(request.url);
  const since = url.searchParams.get("since");
  const intent = url.searchParams.get("intent");
  const provider = url.searchParams.get("provider");
  const limit = parseBoundedLimit(url.searchParams.get("limit"));

  let query = "SELECT * FROM ledger";
  const conditions: string[] = [];
  const params: string[] = [];

  if (since) { conditions.push("ts >= ?"); params.push(since); }
  if (intent) { conditions.push("intent = ?"); params.push(intent); }
  if (provider) { conditions.push("provider = ?"); params.push(provider); }

  if (conditions.length > 0) query += " WHERE " + conditions.join(" AND ");
  query += ` ORDER BY ts DESC LIMIT ${limit}`;

  const stmt = env.DB.prepare(query);
  const bound = params.length > 0 ? stmt.bind(...params) : stmt;
  const result = await bound.all<JsonRecord>();

  return json({ entries: result.results ?? [] }, { env, request });
}

// ---------- Existing API Handlers ----------

async function handleProtectedCheckRun(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const auth = await authenticate(request, env);
  if (!auth.ok) return json({ error: auth.error }, { env, request, status: 401 });

  const body = await readRequestJson(request);
  const requestedKind = typeof body.kind === "string" ? body.kind : "";
  const kind = WATCHER_KINDS.includes(requestedKind as WatcherKind)
    ? (requestedKind as WatcherKind)
    : "edge-abuse";

  const job: WatcherJob = {
    actor: auth.actor,
    createdAt: new Date().toISOString(),
    kind,
    source: "api",
  };

  const checkId = crypto.randomUUID();
  ctx.waitUntil(insertCheck(env, {
    actor: auth.actor,
    checkId,
    kind,
    status: env.WATCHER_QUEUE ? "queued" : "accepted",
  }));
  ctx.waitUntil(dispatchJobs(env, [job]));

  return json({
    accepted: true,
    checkId,
    kind,
    queued: Boolean(env.WATCHER_QUEUE),
  }, { env, request, status: 202 });
}

async function handleProtectedList(
  request: Request,
  env: Env,
  resource: "assets" | "events" | "incidents",
): Promise<Response> {
  const auth = await authenticate(request, env);
  if (!auth.ok) return json({ error: auth.error }, { env, request, status: 401 });

  const items = await listResource(env, resource);
  return json({
    actor: auth.actor,
    items,
    resource,
    storageConfigured: Boolean(env.DB),
  }, { env, request });
}

async function serveDashboard(request: Request, env: Env): Promise<Response> {
  if (!env.ASSETS) {
    return text("Dashboard static assets not configured (missing ASSETS binding)", {
      env,
      request,
      status: 503,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  const url = new URL(request.url);
  let pathname = url.pathname;
  if (pathname === "/dashboard" || pathname === "/dashboard/") {
    pathname = "/dashboard/index.html";
  } else if (!pathname.includes(".") && !pathname.endsWith("/")) {
    pathname = `${pathname}/index.html`;
  } else if (!pathname.includes(".") && pathname.endsWith("/")) {
    pathname = `${pathname}index.html`;
  }

  const assetUrl = new URL(pathname + url.search, url.origin);
  const assetRequest = new Request(assetUrl.toString(), {
    method: "GET",
    headers: request.headers,
  });

  const assetResponse = await env.ASSETS.fetch(assetRequest);
  const headers = new Headers(assetResponse.headers);
  if (pathname.endsWith(".html")) {
    headers.set("Content-Security-Policy", DASHBOARD_CSP);
  }
  if (!headers.has("cache-control")) {
    headers.set("cache-control", "public, max-age=120");
  }
  return new Response(assetResponse.body, {
    status: assetResponse.status,
    headers,
  });
}

// ---------- Policy Enforcement ----------

function enforceMcpPolicy(request: Request, method: string, basePath: string): JsonRecord | null {
  if (!POLICY.deny_by_default) return null;

  if (!POLICY.allowed_paths.includes(basePath)) {
    return {
      error: "policy_violation",
      message: `Route ${basePath} is not listed in allowed_paths`,
      policy: "deny_by_default",
    };
  }

  const missingHeaders = POLICY.required_headers.filter(
    (h) => !request.headers.get(h),
  );

  if (missingHeaders.length > 0) {
    return {
      error: "policy_violation",
      message: "Required headers missing",
      missing_headers: missingHeaders,
      policy: "deny_by_default",
    };
  }

  const allowedMethods = POLICY.method_matrix[basePath] ?? POLICY.method_matrix[basePath + "/*"];
  if (allowedMethods && !allowedMethods.includes(method)) {
    return {
      error: "method_not_allowed",
      message: `${method} not permitted on ${basePath}`,
      allowed: allowedMethods,
    };
  }

  const allowedCapabilities = POLICY.capability_matrix[basePath]?.[method] ?? [];
  if (allowedCapabilities.length > 0) {
    const providedCapabilities = parseCapabilityHeader(request.headers.get("x-operator-capability"));
    if (!hasAnyCapability(providedCapabilities, allowedCapabilities)) {
      return {
        error: "capability_not_allowed",
        message: `${method} ${basePath} requires an allowed operator capability`,
        allowed_capabilities: allowedCapabilities,
      };
    }
  }

  return null;
}

function resolvePolicyBasePath(path: string): string | null {
  if (path === "/mcp") return "/mcp";
  if (path.startsWith("/turn/")) return "/turn/*";
  if (path.startsWith("/audit/")) return "/audit/*";
  if (path === "/api/assets") return "/api/assets";
  if (path === "/api/events") return "/api/events";
  if (path === "/api/incidents") return "/api/incidents";
  if (path === "/api/checks/run") return "/api/checks/run";
  if (path === "/api/change-request") return "/api/change-request";
  if (path === "/api/console/lanes") return "/api/console/lanes";
  if (path === "/api/mj-brady") return "/api/mj-brady";
  if (path === "/api/ledger") return "/api/ledger";
  return null;
}

function parseCapabilityHeader(headerValue: string | null): string[] {
  if (!headerValue) return [];
  return headerValue
    .split(/[,\s]+/)
    .map((value) => value.trim())
    .filter(Boolean);
}

function hasAnyCapability(provided: string[], allowed: string[]): boolean {
  return provided.some((capability) => allowed.includes(capability));
}

function parseBoundedLimit(value: string | null, fallback = 50, max = 200): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

function buildAuditMetadata(request: Request, extra: JsonRecord): JsonRecord {
  const url = new URL(request.url);
  return {
    ...extra,
    method: request.method,
    path: url.pathname,
    headers: {
      "x-tenant-id": request.headers.get("x-tenant-id") ?? "",
      "x-request-id": request.headers.get("x-request-id") ?? "",
      "x-policy-version": request.headers.get("x-policy-version") ?? "",
      "x-operator-capability": request.headers.get("x-operator-capability") ?? "",
    },
  };
}

// ---------- Auth ----------

function buildPreflightResponse(request: Request, env: Env): Response {
  const origin = request.headers.get("Origin");
  const allowedOrigin = resolveAllowedOrigin(origin, env);
  const operatorHeader = env.OPERATOR_HEADER ?? "x-ellis-aegis-token";
  if (!allowedOrigin) {
    return withHeaders(new Response(null, { status: 403 }), request, env);
  }

  return withHeaders(
    new Response(null, {
      status: 204,
      headers: {
        "access-control-allow-headers": `authorization, content-type, ${operatorHeader}, x-tenant-id, x-request-id, x-policy-version, x-operator-capability`,
        "access-control-allow-methods": "GET, POST, OPTIONS",
        "access-control-max-age": "86400",
      },
    }),
    request,
    env,
  );
}

async function authenticate(
  request: Request,
  env: Env,
): Promise<{ actor: string; error?: string; ok: boolean }> {
  const operatorToken = env.OPERATOR_TOKEN?.trim();
  if (!operatorToken) {
    console.error("operator-token-not-configured");
    return { actor: "anonymous", error: "unauthorized", ok: false };
  }

  const headerName = (env.OPERATOR_HEADER ?? "x-ellis-aegis-token").toLowerCase();
  const providedToken =
    request.headers.get(headerName) ??
    readBearerToken(request.headers.get("Authorization"));

  if (!providedToken || !timingSafeEqual(operatorToken, providedToken)) {
    return { actor: "anonymous", error: "unauthorized", ok: false };
  }

  return { actor: "operator", ok: true };
}

async function readRequestJson(request: Request): Promise<JsonRecord> {
  try {
    const payload = (await request.json()) as unknown;
    if (isJsonRecord(payload)) {
      return payload;
    }
  } catch { /* empty body is fine */ }
  return {};
}

function isJsonRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readBearerToken(headerValue: string | null): string | null {
  if (!headerValue) return null;
  const [scheme, token] = headerValue.split(/\s+/, 2);
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token;
}

function timingSafeEqual(left: string, right: string): boolean {
  const encoder = new TextEncoder();
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  const maxLength = Math.max(leftBytes.length, rightBytes.length);
  let mismatch = leftBytes.length === rightBytes.length ? 0 : 1;
  for (let index = 0; index < maxLength; index += 1) {
    mismatch |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }
  return mismatch === 0;
}

// ---------- Response Helpers ----------

function resolveAllowedOrigin(origin: string | null, env: Env): string | null {
  if (!origin) return null;
  const allowedOrigins = (env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return allowedOrigins.includes(origin) ? origin : null;
}

function withHeaders(response: Response, request: Request, env: Env): Response {
  const headers = new Headers(response.headers);
  const origin = request.headers.get("Origin");
  const allowedOrigin = resolveAllowedOrigin(origin, env);
  for (const [key, value] of Object.entries(BASE_HEADERS)) {
    if (!headers.has(key)) headers.set(key, value);
  }
  if (allowedOrigin) {
    headers.set("access-control-allow-origin", allowedOrigin);
    headers.set("vary", "Origin");
  }
  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
}

function json(
  payload: unknown,
  options: { env: Env; request: Request; status?: number },
): Response {
  const response = new Response(JSON.stringify(payload, null, 2), {
    headers: { "content-type": "application/json; charset=utf-8" },
    status: options.status ?? 200,
  });
  return withHeaders(response, options.request, options.env);
}

function text(
  payload: string,
  options: { env: Env; headers?: HeadersInit; request: Request; status?: number },
): Response {
  const response = new Response(payload, {
    headers: options.headers,
    status: options.status ?? 200,
  });
  return withHeaders(response, options.request, options.env);
}

function html(payload: string, options: { env: Env; request: Request; status?: number }): Response {
  const response = new Response(payload, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "content-security-policy":
        "default-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; img-src 'self' data:; style-src 'unsafe-inline'; script-src 'none'; object-src 'none'; connect-src 'none'",
    },
    status: options.status ?? 200,
  });
  return withHeaders(response, options.request, options.env);
}

// ---------- Rendering ----------

function renderHomePage(): string {
  const today = new Date().toISOString().slice(0, 10);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>MJ MCP Layer | Control Plane</title>
  <style>
    :root { --grape:#7f30a4; --orange:#f68657; --dark-ink:#110629; --aqua:#1fc2d6; --plum:#41153b; --paper:#fffaf7; --mist:#f8f0fe; --ink-soft:#230f35; --card:rgba(255,255,255,.86); --border:rgba(65,21,59,.13); }
    * { box-sizing:border-box; } body { margin:0; min-height:100vh; font-family:"Avenir Next","Optima","Gill Sans",sans-serif; color:var(--ink-soft); background:linear-gradient(170deg,var(--paper),var(--mist) 46%,#fff1e9 100%); }
    .page { width:min(800px,calc(100% - 2rem)); margin:0 auto; padding:3rem 0; }
    .hero { text-align:center; margin-bottom:2rem; }
    h1 { font-size:2.4rem; margin:0 0 .5rem; background:linear-gradient(120deg,var(--grape),var(--orange) 55%,var(--aqua)); -webkit-background-clip:text; background-clip:text; color:transparent; }
    .subtitle { font-size:1.1rem; color:#5d3a67; margin-bottom:1.5rem; }
    .endpoints { display:grid; gap:.8rem; grid-template-columns:1fr 1fr; margin:2rem 0; }
    .ep { border:1px solid var(--border); border-radius:1rem; padding:1rem; background:var(--card); }
    .ep h3 { margin:0 0 .3rem; font-size:1rem; } .ep p { margin:0; font-size:.9rem; color:#4d3654; }
    .ep code { background:rgba(127,48,164,.08); padding:.15rem .4rem; border-radius:.3rem; font-size:.85rem; }
    .footer { text-align:center; color:#61496a; font-size:.85rem; margin-top:2rem; }
    @media(max-width:600px) { .endpoints { grid-template-columns:1fr; } }
  </style>
</head>
<body>
  <main class="page">
    <section class="hero">
      <h1>MJ MCP Layer</h1>
      <p class="subtitle">Enterprise MCP Edge Routing &amp; Multi-Tenant Policy Enforcement</p>
    </section>
    <section class="endpoints">
      <div class="ep"><h3>MCP Protocol</h3><p><code>GET /mcp</code> &mdash; List capabilities</p><p><code>POST /mcp</code> &mdash; Execute MCP method</p></div>
      <div class="ep"><h3>Turn Execution</h3><p><code>POST /turn/:id</code> &mdash; Submit or continue a turn</p></div>
      <div class="ep"><h3>Audit Trail</h3><p><code>GET /audit/events</code> &mdash; Query audit events</p><p><code>GET /api/ledger</code> &mdash; Immutable ledger</p></div>
      <div class="ep"><h3>Health &amp; Ops</h3><p><code>GET /healthz</code> &mdash; Health check</p><p><code>POST /api/checks/run</code> &mdash; Run checks</p></div>
      <div class="ep"><h3>MJ Edge cockpit</h3><p><a href="/dashboard"><code>GET /dashboard</code></a> &mdash; Genesis OS static UI (ASSETS binding)</p></div>
      <div class="ep"><h3>Change Requests</h3><p><code>POST /api/change-request</code> &mdash; Submit</p><p><code>GET /api/change-request</code> &mdash; List</p></div>
      <div class="ep"><h3>Resources</h3><p><code>GET /api/assets</code> <code>GET /api/events</code></p><p><code>GET /api/incidents</code></p></div>
    </section>
    <footer class="footer">MJ MCP Layer Control Plane &middot; Updated ${today} &middot; Deny-by-default policy active</footer>
  </main>
</body>
</html>`;
}

// ---------- Storage ----------

async function dispatchJobs(env: Env, jobs: WatcherJob[]): Promise<void> {
  if (env.WATCHER_QUEUE) {
    for (const job of jobs) {
      await env.WATCHER_QUEUE.send(job);
    }
  }
}

async function listResource(env: Env, resource: "assets" | "events" | "incidents"): Promise<JsonRecord[]> {
  if (!env.DB) return [];
  const sqlByResource: Record<typeof resource, string> = {
    assets: "SELECT * FROM assets ORDER BY created_at DESC LIMIT 25",
    events: "SELECT * FROM events ORDER BY created_at DESC LIMIT 25",
    incidents: "SELECT * FROM incidents ORDER BY created_at DESC LIMIT 25",
  };
  const result = await env.DB.prepare(sqlByResource[resource]).all<JsonRecord>();
  return result.results ?? [];
}

async function insertCheck(
  env: Env,
  input: { actor: string; checkId: string; kind: WatcherKind; status: "accepted" | "queued" },
): Promise<void> {
  if (!env.DB) return;
  await env.DB.prepare(
    "INSERT INTO checks (id, kind, actor, status, requested_at) VALUES (?1, ?2, ?3, ?4, ?5)",
  ).bind(input.checkId, input.kind, input.actor, input.status, new Date().toISOString()).run();
}

async function logEvent(
  env: Env,
  input: {
    actor: string;
    category: string;
    message: string;
    metadata: string;
    severity: "info" | "low" | "medium" | "high";
    source: "queue" | "worker" | "api" | "schedule";
  },
): Promise<void> {
  if (!env.DB) return;
  await env.DB.prepare(
    "INSERT INTO events (id, category, actor, severity, message, source, metadata, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
  ).bind(
    crypto.randomUUID(),
    input.category,
    input.actor,
    input.severity,
    input.message,
    input.source,
    input.metadata,
    new Date().toISOString(),
  ).run();
}
