import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "../..");
const mcpRoot = resolve(import.meta.dirname, "..");
const wranglerConfig = JSON.parse(stripTrailingCommas(stripJsonComments(readFileSync(resolve(mcpRoot, "wrangler.jsonc"), "utf8"))));
const outputPath = resolveRepoPath(process.env.MCP_DEPLOYMENT_MANIFEST_PATH || "artifacts/mj-mcp-layer/deployment-manifest.json");
const smokeResultsPath = resolveRepoPath(process.env.MCP_SMOKE_RESULTS_PATH || "artifacts/mj-mcp-layer/smoke-results.json");

function stripJsonComments(input) {
  let output = "";
  let inString = false;
  let inBlockComment = false;
  let inLineComment = false;
  let escaped = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];

    if (inLineComment) {
      if (char === "\n" || char === "\r") {
        inLineComment = false;
        output += char;
      }
      continue;
    }

    if (inBlockComment) {
      if (char === "*" && next === "/") {
        inBlockComment = false;
        index += 1;
      }
      continue;
    }

    if (!inString && char === "/" && next === "/") {
      inLineComment = true;
      index += 1;
      continue;
    }

    if (!inString && char === "/" && next === "*") {
      inBlockComment = true;
      index += 1;
      continue;
    }

    output += char;

    if (char === "\\" && inString) {
      escaped = !escaped;
      continue;
    }

    if (char === "\"" && !escaped) {
      inString = !inString;
    }
    if (char !== "\\") {
      escaped = false;
    }
  }

  return output;
}

function stripTrailingCommas(input) {
  return input.replace(/,\s*([}\]])/g, "$1");
}

function resolveRepoPath(path) {
  return isAbsolute(path) ? path : resolve(repoRoot, path);
}

function git(args) {
  try {
    return execFileSync("git", args, { cwd: repoRoot, encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}

function bindingMap() {
  const bindings = {};
  for (const database of wranglerConfig.d1_databases || []) {
    bindings[database.binding] = `d1:${database.database_name}`;
  }
  for (const namespace of wranglerConfig.kv_namespaces || []) {
    bindings[namespace.binding] = `kv:${namespace.binding}`;
  }
  for (const bucket of wranglerConfig.r2_buckets || []) {
    bindings[bucket.binding] = `r2:${bucket.bucket_name}`;
  }
  for (const producer of wranglerConfig.queues?.producers || []) {
    bindings[producer.binding] = `queue:${producer.queue}`;
  }
  return bindings;
}

function readSmokeResults() {
  if (!existsSync(smokeResultsPath)) return [];
  try {
    const parsed = JSON.parse(readFileSync(smokeResultsPath, "utf8"));
    return Array.isArray(parsed.results) ? parsed.results : [];
  } catch {
    return [{ name: "smoke_results_parse_error", ok: false, error: `${smokeResultsPath} was not valid JSON` }];
  }
}

const smokeResults = readSmokeResults();
const dirtyStatus = git(["status", "--short"]);
const manifest = {
  version: 1,
  generated_at: new Date().toISOString(),
  git: {
    sha: git(["rev-parse", "HEAD"]) ?? "unknown",
    branch: git(["branch", "--show-current"]) || "detached",
    dirty: dirtyStatus !== null && dirtyStatus.length > 0,
  },
  runtime: {
    name: wranglerConfig.name,
    authority_zone: wranglerConfig.vars?.ZONE_NAME || "ellis-aegis.us",
    public_base_url: wranglerConfig.vars?.PUBLIC_BASE_URL || "https://mcp.ellis-aegis.us",
    workers_dev: Boolean(wranglerConfig.workers_dev),
    compatibility_date: wranglerConfig.compatibility_date,
  },
  routes: (wranglerConfig.routes || []).map((route) => ({
    pattern: route.pattern,
    zone_name: route.zone_name,
  })),
  storage_bindings: bindingMap(),
  protected_routes: {
    mcp: "/mcp",
    turn: "/turn/*",
    audit: "/audit/*",
    change_request: "/api/change-request",
    ledger: "/api/ledger",
    checks: "/api/checks/run",
  },
  smoke_results: smokeResults,
  status: smokeResults.length > 0 && smokeResults.every((result) => result.ok) ? "go" : "no-go",
};

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`[manifest] wrote ${outputPath}`);
console.log(JSON.stringify(manifest, null, 2));
