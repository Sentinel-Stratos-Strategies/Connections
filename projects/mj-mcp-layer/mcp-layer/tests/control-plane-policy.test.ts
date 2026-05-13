import assert from "node:assert/strict";
import { describe, test } from "node:test";
import worker from "../src/index";

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
});
