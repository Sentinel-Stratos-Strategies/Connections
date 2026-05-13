#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "../../..");
const mcpRoot = resolve(import.meta.dirname, "../mcp-layer");
const defaultEnvFile = "/Users/home/.stratos_secrets/ellis-aegis.env";

const githubSecrets = [
  { name: "CF_API_TOKEN", aliases: ["CF_API_TOKEN", "CLOUDFLARE_API_TOKEN"], required: true },
  { name: "CLOUDFLARE_API_TOKEN", aliases: ["CLOUDFLARE_API_TOKEN", "CF_API_TOKEN"] },
  { name: "CF_ACCOUNT_ID", aliases: ["CF_ACCOUNT_ID", "CLOUDFLARE_ACCOUNT_ID"], required: true },
  { name: "CLOUDFLARE_ACCOUNT_ID", aliases: ["CLOUDFLARE_ACCOUNT_ID", "CF_ACCOUNT_ID"] },
  { name: "CF_ZONE_ID_ELLIS", aliases: ["CF_ZONE_ID_ELLIS"], required: true },
  { name: "CF_ZONE_ID_HITCH", aliases: ["CF_ZONE_ID_HITCH"], required: true },
  { name: "CF_ZONE_ID_KEVIS", aliases: ["CF_ZONE_ID_KEVIS"], required: true },
  { name: "OPERATOR_TOKEN", aliases: ["OPERATOR_TOKEN", "MCP_OPERATOR_TOKEN", "MJ_EDGE_OPERATOR_TOKEN"], required: true },
  { name: "MJ_EDGE_OPERATOR_TOKEN", aliases: ["MJ_EDGE_OPERATOR_TOKEN"] },
  { name: "MUA_OPERATOR_TOKEN", aliases: ["MUA_OPERATOR_TOKEN"] },
  { name: "MCP_SMOKE_BASE_URL", aliases: ["MCP_SMOKE_BASE_URL"] },
];

const githubVariables = [
  { name: "MCP_SMOKE_BASE_URL", aliases: ["MCP_SMOKE_BASE_URL"] },
  { name: "MUA_SMOKE_BASE_URL", aliases: ["MUA_SMOKE_BASE_URL"] },
];

const cloudflareWorkerSecrets = [
  { name: "OPERATOR_TOKEN", aliases: ["OPERATOR_TOKEN", "MCP_OPERATOR_TOKEN", "MJ_EDGE_OPERATOR_TOKEN"], required: true },
];

const localOnly = [
  { name: "OPENAI_API_KEY", aliases: ["OPENAI_API_KEY"] },
  { name: "ANTHROPIC_API_KEY", aliases: ["ANTHROPIC_API_KEY"] },
  { name: "GOOGLE_SERVICE_ACCOUNT_JSON", aliases: ["GOOGLE_SERVICE_ACCOUNT_JSON", "GOOGLE_SERVICE_ACCOUNT_KEY"] },
  { name: "NOTION_TOKEN", aliases: ["NOTION_TOKEN"] },
  { name: "LINEAR_API_KEY", aliases: ["LINEAR_API_KEY"] },
  { name: "GITHUB_TOKEN", aliases: ["GITHUB_TOKEN", "GH_TOKEN"] },
];

function parseArgs(argv) {
  const args = {
    apply: false,
    cloudflare: true,
    envFile: defaultEnvFile,
    github: true,
    repo: "Sentinel-Stratos-Strategies/Connections",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--apply") args.apply = true;
    else if (arg === "--dry-run") args.apply = false;
    else if (arg === "--skip-github") args.github = false;
    else if (arg === "--skip-cloudflare") args.cloudflare = false;
    else if (arg === "--repo") args.repo = argv[++index];
    else if (arg === "--env-file") args.envFile = argv[++index];
    else if (arg === "--help") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/sync-secret-stores.mjs [--dry-run|--apply]

Options:
  --env-file PATH       Read additional KEY=VALUE entries from PATH.
                        Default: ${defaultEnvFile}
  --repo OWNER/REPO     GitHub repository to update.
                        Default: Sentinel-Stratos-Strategies/Connections
  --skip-github         Do not update GitHub Actions secrets/variables.
  --skip-cloudflare     Do not update Cloudflare Worker secrets.

The script never prints secret values. It can only sync values already exported
in the shell or present in the local env file.`);
}

function parseEnvFile(path) {
  if (!existsSync(path)) return {};
  const content = readFileSync(path, "utf8");
  const parsed = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line);
    if (!match) continue;

    const [, key, rawValue] = match;
    parsed[key] = unquote(rawValue.trim(), parsed);
  }

  return parsed;
}

function unquote(value, parsed) {
  let output = value;
  if ((output.startsWith("\"") && output.endsWith("\"")) || (output.startsWith("'") && output.endsWith("'"))) {
    output = output.slice(1, -1);
  }
  return output.replace(/\$([A-Za-z_][A-Za-z0-9_]*)/g, (_, key) => parsed[key] ?? process.env[key] ?? "");
}

function valueFor(env, aliases) {
  for (const alias of aliases) {
    const value = env[alias];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return "";
}

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: options.cwd ?? repoRoot,
    encoding: "utf8",
    env: options.env ?? process.env,
    input: options.input,
    stdio: options.input ? ["pipe", "pipe", "pipe"] : ["ignore", "pipe", "pipe"],
  });
}

function syncGithubSecret({ apply, env, repo }, item) {
  const value = valueFor(env, item.aliases);
  report("github secret", item.name, Boolean(value), apply);
  if (!value || !apply) return;
  run("gh", ["secret", "set", item.name, "--repo", repo, "--body", value]);
}

function syncGithubVariable({ apply, env, repo }, item) {
  const value = valueFor(env, item.aliases);
  report("github variable", item.name, Boolean(value), apply);
  if (!value || !apply) return;
  run("gh", ["variable", "set", item.name, "--repo", repo, "--body", value]);
}

function syncCloudflareWorkerSecret({ apply, env }, item) {
  const value = valueFor(env, item.aliases);
  report("cloudflare worker secret", item.name, Boolean(value), apply);
  if (!value || !apply) return;

  const apiToken = valueFor(env, ["CLOUDFLARE_API_TOKEN", "CF_API_TOKEN"]);
  const accountId = valueFor(env, ["CLOUDFLARE_ACCOUNT_ID", "CF_ACCOUNT_ID"]);
  const childEnv = {
    ...process.env,
    ...env,
    CLOUDFLARE_API_TOKEN: apiToken,
    CLOUDFLARE_ACCOUNT_ID: accountId,
  };

  run("npx", ["wrangler", "secret", "put", item.name], {
    cwd: mcpRoot,
    env: childEnv,
    input: `${value}\n`,
  });
}

function report(kind, name, present, apply) {
  const action = apply ? "sync" : "check";
  console.log(`[${action}] ${kind} ${name}: ${present ? "present" : "missing"}`);
}

function requireValues(env, items) {
  return items
    .filter((item) => item.required)
    .filter((item) => !valueFor(env, item.aliases))
    .map((item) => item.name);
}

const args = parseArgs(process.argv.slice(2));
const fileEnv = parseEnvFile(args.envFile);
const env = { ...process.env, ...fileEnv };

console.log(`[secret-sync] mode=${args.apply ? "apply" : "dry-run"} repo=${args.repo}`);
console.log(`[secret-sync] env-file=${args.envFile}${existsSync(args.envFile) ? "" : " (not found)"}`);

for (const item of localOnly) {
  report("local app env", item.name, Boolean(valueFor(env, item.aliases)), false);
}

if (args.github) {
  for (const item of githubSecrets) syncGithubSecret({ ...args, env }, item);
  for (const item of githubVariables) syncGithubVariable({ ...args, env }, item);
}

if (args.cloudflare) {
  for (const item of cloudflareWorkerSecrets) syncCloudflareWorkerSecret({ ...args, env }, item);
}

const missing = requireValues(env, [
  ...(args.github ? githubSecrets : []),
  ...(args.cloudflare ? cloudflareWorkerSecrets : []),
]);

if (missing.length > 0) {
  console.log(`[secret-sync] required values missing: ${[...new Set(missing)].join(", ")}`);
  process.exitCode = args.apply ? 1 : 0;
} else {
  console.log("[secret-sync] required values are available by name");
}
