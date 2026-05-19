#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "../../..");
const layerRoot = resolve(import.meta.dirname, "..");
const evidenceRoot = resolve(layerRoot, "artifacts/evidence");

function git(args) {
  try {
    return execFileSync("git", args, { cwd: repoRoot, encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function walk(dir, files = []) {
  if (!existsSync(dir)) return files;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full, files);
    } else if (stat.isFile()) {
      files.push(full);
    }
  }
  return files;
}

function collectChecksums() {
  const roots = [
    ".github/workflows",
    "projects/mj-mcp-layer/mcp-layer/src",
    "projects/mj-mcp-layer/mcp-layer/tests",
    "projects/mj-mcp-layer/platform/src",
    "projects/mj-mcp-layer/platform/tests",
    "projects/mj-mcp-layer/frontend/src",
    "projects/mj-mcp-layer/manifests",
    "projects/mj-mcp/lanes",
    "projects/mj-mcp/connections",
  ];
  const explicit = [
    "projects/mj-mcp-layer/package.json",
    "projects/mj-mcp-layer/package-lock.json",
    "projects/mj-mcp-layer/mcp-layer/package.json",
    "projects/mj-mcp-layer/mcp-layer/package-lock.json",
    "projects/mj-mcp-layer/platform/package.json",
    "projects/mj-mcp-layer/platform/package-lock.json",
    "projects/mj-mcp-layer/frontend/package.json",
    "projects/mj-mcp-layer/frontend/package-lock.json",
  ];
  const files = new Set();
  for (const root of roots) {
    for (const file of walk(resolve(repoRoot, root))) files.add(file);
  }
  for (const file of explicit.map((path) => resolve(repoRoot, path))) {
    if (existsSync(file)) files.add(file);
  }
  return [...files]
    .sort()
    .map((file) => ({
      path: relative(repoRoot, file),
      sha256: sha256File(file),
    }));
}

function validateJsonFiles() {
  const files = [
    ...walk(resolve(repoRoot, "projects/mj-mcp/lanes")).filter((file) => file.endsWith(".json")),
    resolve(repoRoot, "projects/mj-mcp/connections/infrastructure-connections.json"),
    resolve(repoRoot, "projects/mj-mcp-layer/manifests/deployment/deployment-manifest.schema.json"),
    resolve(repoRoot, "projects/mj-mcp-layer/manifests/deployment/deployment-manifest.example.json"),
  ].filter((file) => existsSync(file));

  return files.map((file) => {
    JSON.parse(readFileSync(file, "utf8"));
    return { ok: true, path: relative(repoRoot, file) };
  });
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

mkdirSync(evidenceRoot, { recursive: true });

const checksums = collectChecksums();
const laneValidation = validateJsonFiles();
const now = new Date().toISOString();
const gitSha = git(["rev-parse", "HEAD"]);
const gitBranch = git(["branch", "--show-current"]);
const dirty = Boolean(git(["status", "--short"]));

const buildSummary = {
  generated_at: now,
  git: { branch: gitBranch, dirty, sha: gitSha },
  commands: {
    golden: "npm run no-stray && npm run check && npm test && npm run build && npm run evidence",
    check: "npm --prefix mcp-layer run typecheck && npm --prefix platform run typecheck && npm --prefix frontend run typecheck",
    test: "npm --prefix mcp-layer test && npm --prefix platform test",
    build: "npm --prefix platform run build && npm --prefix frontend run build",
  },
  status: "evidence_generated_after_prior_steps_passed",
};

const testSummary = {
  generated_at: now,
  note: "This evidence file is emitted at the end of mj:golden after check, test, and build scripts succeed.",
  expected_suites: ["mcp-layer", "platform"],
  status: "passed_before_evidence_step",
};

const evidenceIndex = {
  generated_at: now,
  git: { branch: gitBranch, dirty, sha: gitSha },
  artifacts: [
    "build-summary.json",
    "test-summary.json",
    "lane-manifest-validation.json",
    "cloudflare-dry-run.json",
    "checksums.sha256",
  ],
  status: "go",
};

writeJson(resolve(evidenceRoot, "build-summary.json"), buildSummary);
writeJson(resolve(evidenceRoot, "test-summary.json"), testSummary);
writeJson(resolve(evidenceRoot, "lane-manifest-validation.json"), {
  generated_at: now,
  count: laneValidation.length,
  results: laneValidation,
});
writeJson(resolve(evidenceRoot, "cloudflare-dry-run.json"), {
  generated_at: now,
  command: "npx wrangler deploy --dry-run",
  status: "not_run_by_evidence_script",
  note: "CI runs the Worker dry-run after the golden path and uploads this evidence directory.",
});
writeFileSync(
  resolve(evidenceRoot, "checksums.sha256"),
  checksums.map((entry) => `${entry.sha256}  ${entry.path}`).join("\n") + "\n",
);
writeJson(resolve(evidenceRoot, "evidence-index.json"), evidenceIndex);

console.log(`[evidence] wrote ${relative(repoRoot, evidenceRoot)}`);
