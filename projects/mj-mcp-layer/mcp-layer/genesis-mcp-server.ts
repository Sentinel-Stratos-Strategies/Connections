/**
 * genesis-mcp-server.ts
 * MJ-MCP Layer — Genesis OS MCP HTTP Endpoint
 *
 * Runs as a Cloudflare Worker on ellis-aegis.us/mcp
 * Receives intent from external AI tools (ChatGPT, Codex, Perplexity, Atlas)
 * Validates aegis_token, routes through lane policy, forwards to genesisd
 *
 * Architecture:
 *   External AI → [this worker] → genesisd (local, via tunnel) → lane executor
 *
 * Trust model:
 *   - No execution without local approval
 *   - All requests logged to Cloudflare KV
 *   - Policy decisions come FROM genesisd, not this worker
 *   - This worker is a relay, not an authority
 */

export interface Env {
  AEGIS_TOKEN: string
  GENESIS_TUNNEL_URL: string  // Cloudflare tunnel to local genesisd
  KV_AUDIT: KVNamespace
  GENESIS_VERSION: string
}

const SUPPORTED_METHODS = [
  'initialize',
  'tools/list',
  'tools/call',
  'daemon/health',
  'lane/list',
  'lane/describe',
  'policy/evaluate',
] as const

type MCPMethod = typeof SUPPORTED_METHODS[number]

interface MCPRequest {
  jsonrpc: '2.0'
  id: number | string | null
  method: string
  params?: Record<string, unknown>
}

interface MCPResponse {
  jsonrpc: '2.0'
  id: number | string | null
  result?: unknown
  error?: { code: number; message: string }
}

// ============================================================
// Main Worker Handler
// ============================================================

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    // Health probe (no auth required)
    if (url.pathname === '/health' && request.method === 'GET') {
      return json({ status: 'ok', version: env.GENESIS_VERSION, worker: 'genesis-mcp-server' })
    }

    // Only POST to /mcp
    if (url.pathname !== '/mcp' || request.method !== 'POST') {
      return json({ error: 'Not found' }, 404)
    }

    // Validate aegis token
    const authHeader = request.headers.get('Authorization') ?? ''
    const token = authHeader.replace('Bearer ', '').trim()
    if (!token || token !== env.AEGIS_TOKEN) {
      await logAudit(env, 'auth_failure', null, request)
      return json({ error: 'Unauthorized' }, 401)
    }

    // Parse body
    let body: MCPRequest
    try {
      body = await request.json() as MCPRequest
    } catch {
      return json({ error: 'Invalid JSON' }, 400)
    }

    // Validate method
    if (!SUPPORTED_METHODS.includes(body.method as MCPMethod)) {
      return json(mcpError(body.id, -32601, `Method not supported: ${body.method}`), 200)
    }

    // Log inbound intent to KV
    await logAudit(env, 'intent_received', body, request)

    // Route: initialize is handled locally, everything else proxies to genesisd
    if (body.method === 'initialize') {
      return json(mcpResult(body.id, {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {}, resources: {} },
        serverInfo: {
          name: 'genesis-mcp-server',
          version: env.GENESIS_VERSION,
          description: 'Genesis OS local authority — all execution gated by genesisd policy engine'
        }
      }))
    }

    if (body.method === 'tools/list') {
      return json(mcpResult(body.id, { tools: GENESIS_TOOLS }))
    }

    // All other methods proxy to genesisd via tunnel
    const tunnelURL = env.GENESIS_TUNNEL_URL
    if (!tunnelURL) {
      return json(mcpError(body.id, -32000, 'Genesis tunnel not configured'), 200)
    }

    try {
      const upstream = await fetch(`${tunnelURL}/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Genesis-Token': env.AEGIS_TOKEN,
          'X-Forwarded-For': request.headers.get('CF-Connecting-IP') ?? 'unknown',
        },
        body: JSON.stringify(body),
      })

      const result = await upstream.json()
      await logAudit(env, 'intent_forwarded', { request: body, status: upstream.status }, request)
      return json(result)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Tunnel unreachable'
      await logAudit(env, 'tunnel_error', { error: msg }, request)
      return json(mcpError(body.id, -32000, `genesisd unreachable: ${msg}`), 200)
    }
  }
}

// ============================================================
// Audit Logger → Cloudflare KV
// ============================================================

async function logAudit(
  env: Env,
  eventType: string,
  payload: unknown,
  request: Request
): Promise<void> {
  const entry = {
    timestamp: new Date().toISOString(),
    eventType,
    ip: request.headers.get('CF-Connecting-IP') ?? 'unknown',
    userAgent: request.headers.get('User-Agent') ?? 'unknown',
    payload,
  }
  const key = `audit:${Date.now()}:${crypto.randomUUID()}`
  try {
    await env.KV_AUDIT.put(key, JSON.stringify(entry), {
      expirationTtl: 60 * 60 * 24 * 90 // 90 days
    })
  } catch {
    // KV write failure must never crash the worker
  }
}

// ============================================================
// Helpers
// ============================================================

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}

function mcpResult(id: MCPRequest['id'], result: unknown): MCPResponse {
  return { jsonrpc: '2.0', id: id ?? null, result }
}

function mcpError(id: MCPRequest['id'], code: number, message: string): MCPResponse {
  return { jsonrpc: '2.0', id: id ?? null, error: { code, message } }
}

// ============================================================
// Genesis Tool Manifest
// Advertised to external AI tools via tools/list
// All tools gate through genesisd policy — none execute directly
// ============================================================

const GENESIS_TOOLS = [
  {
    name: 'daemon_health',
    description: 'Check genesisd health and loaded lane manifests',
    inputSchema: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'lane_list',
    description: 'List all active lane manifests and their policy summary',
    inputSchema: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'lane_describe',
    description: 'Get full policy detail for a specific lane',
    inputSchema: {
      type: 'object',
      properties: { laneId: { type: 'string', description: 'The lane identifier' } },
      required: ['laneId']
    }
  },
  {
    name: 'policy_evaluate',
    description: 'Evaluate whether an action is allowed in a lane before attempting it',
    inputSchema: {
      type: 'object',
      properties: {
        laneId: { type: 'string' },
        action: { type: 'string', description: 'The action to evaluate (e.g. fs.write, terminal.execute)' }
      },
      required: ['laneId', 'action']
    }
  },
  {
    name: 'tool_call_approved',
    description: 'Execute an approved tool action within a lane. Requires prior approval token.',
    inputSchema: {
      type: 'object',
      properties: {
        laneId: { type: 'string' },
        action: { type: 'string' },
        approvalToken: { type: 'string', description: 'Token from approval.request' },
        arguments: { type: 'object', description: 'Action-specific arguments' }
      },
      required: ['laneId', 'action', 'approvalToken']
    }
  },
  {
    name: 'sentinel_session_summary',
    description: 'Get the Sentinel forensic summary for the current session — denials, quarantines, IOC matches',
    inputSchema: { type: 'object', properties: {}, required: [] }
  }
]
