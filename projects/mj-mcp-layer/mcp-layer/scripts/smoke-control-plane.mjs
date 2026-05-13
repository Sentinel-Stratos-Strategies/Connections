import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "../..");

function resolveRepoPath(path) {
  return isAbsolute(path) ? path : resolve(repoRoot, path);
}

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg.startsWith("--")) {
      result[arg.slice(2)] = argv[index + 1];
      index += 1;
    }
  }
  return result;
}

async function requestJson(baseUrl, path, options = {}) {
  const response = await fetch(new URL(path, baseUrl), options);
  const contentType = response.headers.get("content-type") || "";
  const body = contentType.includes("application/json")
    ? await response.json()
    : await response.text();
  return { body, status: response.status };
}

function record(results, name, ok, details = {}) {
  const result = { name, ok, ...details };
  results.push(result);
  console.log(`[smoke-control-plane] ${ok ? "ok" : "fail"} ${name}`);
}

const args = parseArgs(process.argv.slice(2));
const baseUrl = args["base-url"] || process.env.MCP_SMOKE_BASE_URL || process.env.PUBLIC_BASE_URL || "https://mcp.ellis-aegis.us";
const token = args.token || process.env.OPERATOR_TOKEN || process.env.MCP_OPERATOR_TOKEN;
const operatorHeader = args["operator-header"] || process.env.OPERATOR_HEADER || "x-ellis-aegis-token";
const resultsPath = resolveRepoPath(process.env.MCP_SMOKE_RESULTS_PATH || "artifacts/mj-mcp-layer/smoke-results.json");
const requestId = `smoke-${Date.now()}`;

const policyHeaders = {
  "x-operator-capability": "mcp.admin",
  "x-policy-version": "mj-edge-unified-v2",
  "x-request-id": requestId,
  "x-tenant-id": "operator",
};

const results = [];

const health = await requestJson(baseUrl, "/healthz");
record(results, "healthz_public", health.status === 200 && health.body?.status === "ok", {
  status: health.status,
});

const mcpWithoutPolicy = await requestJson(baseUrl, "/mcp");
record(results, "mcp_requires_policy_headers", mcpWithoutPolicy.status === 403, {
  status: mcpWithoutPolicy.status,
});

if (!token) {
  record(results, "protected_smokes_skipped_without_token", false, {
    error: "set OPERATOR_TOKEN or MCP_OPERATOR_TOKEN",
  });
} else {
  const authHeaders = {
    ...policyHeaders,
    authorization: `Bearer ${token}`,
    [operatorHeader]: token,
  };

  const mcp = await requestJson(baseUrl, "/mcp", { headers: authHeaders });
  record(results, "mcp_with_auth", mcp.status === 200 && mcp.body?.protocol === "mcp", {
    status: mcp.status,
  });

  const changeRequestWithoutPolicy = await requestJson(baseUrl, "/api/change-request", {
    body: JSON.stringify({ intent: "smoke test change request", payload: { source: "smoke-control-plane" } }),
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      [operatorHeader]: token,
    },
    method: "POST",
  });
  record(results, "change_request_requires_policy", changeRequestWithoutPolicy.status === 403, {
    status: changeRequestWithoutPolicy.status,
  });

  const ledger = await requestJson(baseUrl, "/api/ledger?limit=abc", { headers: authHeaders });
  record(results, "ledger_query_with_auth", ledger.status === 200, {
    status: ledger.status,
  });

  const audit = await requestJson(baseUrl, "/audit/events?limit=abc", {
    headers: {
      ...authHeaders,
      "x-operator-capability": "forensic.read",
    },
  });
  record(results, "audit_query_with_auth", audit.status === 200, {
    status: audit.status,
  });

  const consoleLanes = await requestJson(baseUrl, "/api/console/lanes", {
    headers: {
      ...authHeaders,
      "x-operator-capability": "forensic.read",
    },
  });
  record(
    results,
    "console_lanes_with_auth",
    consoleLanes.status === 200 && Array.isArray(consoleLanes.body?.lanes) && consoleLanes.body.lanes.length >= 30,
    {
      laneCount: Array.isArray(consoleLanes.body?.lanes) ? consoleLanes.body.lanes.length : 0,
      status: consoleLanes.status,
    },
  );
}

const report = {
  baseUrl,
  generatedAt: new Date().toISOString(),
  results,
};

mkdirSync(dirname(resultsPath), { recursive: true });
writeFileSync(resultsPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`[smoke-control-plane] wrote ${resultsPath}`);

if (results.some((result) => !result.ok)) {
  process.exit(1);
}
