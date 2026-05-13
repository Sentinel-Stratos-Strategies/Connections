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

  test("health endpoints expose minimal public status payload", async () => {
    const healthzResponse = await fetchWorker("/healthz", { method: "GET" });
    const apiHealthResponse = await fetchWorker("/api/health", { method: "GET" });

    assert.equal(healthzResponse.status, 200);
    assert.deepEqual(await readJson(healthzResponse), { status: "ok" });

    assert.equal(apiHealthResponse.status, 200);
    assert.deepEqual(await readJson(apiHealthResponse), { status: "ok" });
  });

  test("dashboard without ASSETS binding returns 503", async () => {
    const response = await fetchWorker("/dashboard", { method: "GET" });
    assert.equal(response.status, 503);
    assert.match(await response.text(), /missing ASSETS binding/);
  });

  test("dashboard delegates to ASSETS fetcher", async () => {
    const assets: Fetcher = {
      async fetch(req: Request) {
        assert.match(new URL(req.url).pathname, /\/dashboard\/index\.html$/);
        return new Response("<!doctype html><title>ok</title>", {
          headers: { "content-type": "text/html; charset=utf-8" },
        });
      },
    };

    const response = await fetchWorker("/dashboard", { method: "GET" }, createEnv({ ASSETS: assets }));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type")?.includes("text/html"), true);
    assert.match(await response.text(), /<title>ok<\/title>/);
  });
});
