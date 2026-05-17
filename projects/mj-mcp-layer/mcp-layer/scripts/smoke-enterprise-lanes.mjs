import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "../../..");
const connectionMapPath = resolve(repoRoot, "mj-mcp/connections/infrastructure-connections.json");
const consoleLanesPath = resolve(repoRoot, "mj-mcp-layer/mcp-layer/src/console-lanes.ts");

function resolveRepoPath(path) {
  return isAbsolute(path) ? path : resolve(repoRoot, "mj-mcp-layer/mcp-layer", path);
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

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function extractBlock(source, exportName) {
  const start = source.indexOf(`export const ${exportName}`);
  if (start < 0) throw new Error(`missing export block: ${exportName}`);
  const nextExport = source.indexOf("\nexport const ", start + 1);
  return source.slice(start, nextExport >= 0 ? nextExport : source.length);
}

function extractLaneIds(block) {
  return [...block.matchAll(/lane:\s*"([^"]+)"/g)].map((match) => match[1]);
}

async function requestJson(baseUrl, path, options = {}) {
  const response = await fetch(new URL(path, baseUrl), options);
  const contentType = response.headers.get("content-type") || "";
  const body = contentType.includes("application/json")
    ? await response.json()
    : await response.text();
  return { body, status: response.status };
}

const args = parseArgs(process.argv.slice(2));
const baseUrl = args["base-url"] || process.env.MCP_SMOKE_BASE_URL || process.env.PUBLIC_BASE_URL || "https://mcp.ellis-aegis.us";
const token = args.token || process.env.OPERATOR_TOKEN || process.env.MCP_OPERATOR_TOKEN;
const operatorHeader = args["operator-header"] || process.env.OPERATOR_HEADER || "x-ellis-aegis-token";
const resultsPath = resolveRepoPath(process.env.MCP_ENTERPRISE_LANE_SMOKE_RESULTS_PATH || "artifacts/mj-mcp-layer/enterprise-lane-smoke-results.json");

if (!token) {
  throw new Error("set OPERATOR_TOKEN or MCP_OPERATOR_TOKEN before running enterprise lane smoke");
}

const connectionMap = readJson(connectionMapPath);
const source = readFileSync(consoleLanesPath, "utf8");
const skippedLanes = extractLaneIds(extractBlock(source, "SKIPPED_CONSOLE_LANES"));
const expectedRuntimeLanes = connectionMap.lanes
  .map((lane) => lane.lane)
  .filter((lane) => !skippedLanes.includes(lane))
  .sort();

const headers = {
  authorization: `Bearer ${token}`,
  [operatorHeader]: token,
  "x-operator-capability": "forensic.read",
  "x-policy-version": "mj-edge-unified-v2",
  "x-request-id": `enterprise-lanes-${Date.now()}`,
  "x-tenant-id": "operator",
};

const response = await requestJson(baseUrl, "/api/console/lanes", { headers });
const actualLanes = Array.isArray(response.body?.lanes)
  ? response.body.lanes.map((lane) => lane.lane).sort()
  : [];

const actualSet = new Set(actualLanes);
const expectedSet = new Set(expectedRuntimeLanes);
const missing = expectedRuntimeLanes.filter((lane) => !actualSet.has(lane));
const unexpected = actualLanes.filter((lane) => !expectedSet.has(lane));
const ok = response.status === 200 && missing.length === 0 && unexpected.length === 0;

const report = {
  actualCount: actualLanes.length,
  actualLanes,
  baseUrl,
  expectedCount: expectedRuntimeLanes.length,
  expectedRuntimeLanes,
  generatedAt: new Date().toISOString(),
  missing,
  ok,
  skippedLanes,
  status: response.status,
  unexpected,
};

mkdirSync(dirname(resultsPath), { recursive: true });
writeFileSync(resultsPath, `${JSON.stringify(report, null, 2)}\n`);

console.log(`[smoke-enterprise-lanes] ${ok ? "ok" : "fail"} expected=${expectedRuntimeLanes.length} actual=${actualLanes.length}`);
if (missing.length) console.error(`[smoke-enterprise-lanes] missing: ${missing.join(", ")}`);
if (unexpected.length) console.error(`[smoke-enterprise-lanes] unexpected: ${unexpected.join(", ")}`);
console.log(`[smoke-enterprise-lanes] wrote ${resultsPath}`);

if (!ok) process.exit(1);
