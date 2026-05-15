import assert from "node:assert/strict";
import { describe, test } from "node:test";
import worker, { POLICY } from "../src/index";

function createEnv(overrides = {}) {
  return {
    OPERATOR_HEADER: "x-ellis-aegis-token",
    OPERATOR_TOKEN: "test-token",
    ...overrides,
  };
}

function createExecutionContext() {
  const tasks: Promise<unknown>[] = [];
  return {
    ctx: {
      waitUntil(task: Promise<unknown>) {
        tasks.push(task);
      },
    } as ExecutionContext,
    tasks,
  };
}

async function fetchWorker(path: string, init: RequestInit = {}, env = createEnv()) {
  const { ctx, tasks } = createExecutionContext();
  const response = await worker.fetch(new Request(`https://mj.test${path}`, init), env, ctx);
  await Promise.all(tasks);
  return response;
}

async function readJson(response: Response) {
  return await response.json() as Record<string, unknown>;
}

function authHeaders(extra: Record<string, string> = {}) {
  return {
    "content-type": "application/json",
    "x-ellis-aegis-token": "test-token",
    ...extra,
  };
}

function policyHeaders() {
  return {
    "x-operator-capability": "mcp.admin",
    "x-policy-version": "test-policy",
    "x-request-id": "req-001",
    "x-tenant-id": "operator",
  };
}

describe("control-plane policy", () => {
  test("change request route requires policy headers before accepting body", async () => {
    const response = await fetchWorker("/api/change-request", {
      body: JSON.stringify({ intent: "deploy", payload: { ok: true } }),
      headers: authHeaders(),
      method: "POST",
    });

    assert.equal(response.status, 403);
    assert.equal((await readJson(response)).error, "policy_violation");
  });

  test("missing operator token does not expose runtime configuration", async () => {
    const response = await fetchWorker(
      "/mcp",
      {
        headers: authHeaders(policyHeaders()),
      },
      createEnv({ OPERATOR_TOKEN: "" }),
    );

    const body = await readJson(response);
    assert.equal(response.status, 401);
    assert.equal(body.error, "unauthorized");
  });

  test("ledger route defaults invalid limit values before querying D1", async () => {
    let capturedSql = "";
    const db = {
      prepare(sql: string) {
        capturedSql = sql;
        return {
          async all() {
            return { results: [] };
          },
          bind() {
            return this;
          },
        };
      },
    };

    const response = await fetchWorker(
      "/api/ledger?limit=abc",
      {
        headers: authHeaders(policyHeaders()),
      },
      createEnv({ DB: db }),
    );

    assert.equal(response.status, 200);
    assert.match(capturedSql, /LIMIT 50$/);
  });

  test("mcp execute echoes json-rpc id from request payload", async () => {
    const response = await fetchWorker("/mcp", {
      body: JSON.stringify({ id: "rpc-42", method: "tools/list" }),
      headers: authHeaders(policyHeaders()),
      method: "POST",
    });

    const body = await readJson(response);
    assert.equal(response.status, 200);
    assert.equal(body.id, "rpc-42");
    assert.equal(body.jsonrpc, "2.0");
  });

  test("protected routes must be listed in allowed_paths", async () => {
    const originalAllowedPaths = [...POLICY.allowed_paths];
    POLICY.allowed_paths = POLICY.allowed_paths.filter((path) => path !== "/api/ledger");

    try {
      const response = await fetchWorker("/api/ledger", {
        headers: authHeaders(policyHeaders()),
      });

      const body = await readJson(response);
      assert.equal(response.status, 403);
      assert.equal(body.error, "policy_violation");
      assert.match(String(body.message ?? ""), /allowed_paths/);
    } finally {
      POLICY.allowed_paths = originalAllowedPaths;
    }
  });

  test("console lane registry is protected and exposes configured mini lanes", async () => {
    const unauthenticated = await fetchWorker("/api/console/lanes", {
      headers: authHeaders(),
    });
    assert.equal(unauthenticated.status, 403);

    const response = await fetchWorker("/api/console/lanes", {
      headers: authHeaders({
        ...policyHeaders(),
        "x-operator-capability": "forensic.read",
      }),
    });

    const body = await readJson(response);
    const lanes = body.lanes as Array<Record<string, unknown>>;
    const skipped = body.skipped as Array<Record<string, unknown>>;
    assert.equal(response.status, 200);
    assert.equal(body.count, lanes.length);
    assert.equal(body.count, 31);
    assert.ok(lanes.some((lane) => lane.lane === "mj-cloudflare"));
    assert.ok(lanes.some((lane) => lane.lane === "mj-codex-security"));
    assert.ok(lanes.some((lane) => lane.lane === "mj-build-web"));
    assert.ok(lanes.some((lane) => lane.lane === "mj-cursor"));
    assert.ok(lanes.some((lane) => lane.lane === "mj-local-models"));
    assert.equal(lanes.some((lane) => lane.lane === "mj-railway"), false);
    assert.deepEqual(skipped.map((lane) => lane.lane), ["mj-computer", "mj-gadget", "mj-railway"]);
    assert.equal((body.authority as Record<string, unknown>).worker, "mj-edge");
  });

  test("console lanes are available as an MCP tool", async () => {
    const response = await fetchWorker("/mcp", {
      body: JSON.stringify({
        id: "rpc-lanes",
        method: "tools/call",
        params: { name: "console_lanes" },
      }),
      headers: authHeaders(policyHeaders()),
      method: "POST",
    });

    const body = await readJson(response);
    assert.equal(response.status, 200);
    assert.equal(body.id, "rpc-lanes");
    const result = body.result as Record<string, unknown>;
    const content = result.content as Array<Record<string, string>>;
    assert.match(content[0].text, /mj-cloudflare/);
    assert.match(content[0].text, /mj-build-web/);
  });

  test("health endpoints expose minimal public status payload", async () => {
    const healthzResponse = await fetchWorker("/healthz", { method: "GET" });
    const apiHealthResponse = await fetchWorker("/api/health", { method: "GET" });

    assert.equal(healthzResponse.status, 200);
    assert.deepEqual(await readJson(healthzResponse), { status: "ok" });

    assert.equal(apiHealthResponse.status, 200);
    assert.deepEqual(await readJson(apiHealthResponse), { status: "ok" });
  });
});
