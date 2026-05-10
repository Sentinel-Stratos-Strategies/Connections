#!/usr/bin/env node

import { parseArgs } from "node:util";
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { parse as parseYAML } from "yaml";
import type { ProviderName, SecurityPolicy } from "../core/types.js";
import type { ProviderAdapter } from "../adapters/provider.interface.js";
import { CloudflareAdapter } from "../adapters/cloudflare.adapter.js";
import { AWSAdapter } from "../adapters/aws.adapter.js";
import { KubernetesAdapter } from "../adapters/kubernetes.adapter.js";
import { UniversalLedger, FileLedgerBackend } from "../core/ledger.js";
import { CrossProviderOrchestrator } from "../core/orchestrator.js";
import { DriftScanner } from "../automation/drift-scanner.js";
import { ComplianceChecker } from "../automation/compliance-checker.js";
import { HealthCheckAggregator } from "../automation/health-aggregator.js";

const COMMANDS = [
  "init",
  "health-check",
  "drift-scan",
  "compliance-check",
  "policy-apply",
  "policy-validate",
  "ledger-view",
  "ledger-verify",
  "help",
] as const;

type Command = (typeof COMMANDS)[number];

const HELP = `
mcp-cli — MJ MCP Platform CLI

USAGE:
  mcp-cli <command> [options]

COMMANDS:
  init                Initialize configuration
  health-check        Run health checks across providers
  drift-scan          Scan for unauthorized configuration drift
  compliance-check    Validate compliance posture
  policy-apply        Apply a security policy
  policy-validate     Validate a policy file without applying
  ledger-view         View recent ledger entries
  ledger-verify       Verify ledger signature integrity
  help                Show this help

OPTIONS:
  --provider <name>   Target specific provider (cloudflare, aws, kubernetes)
  --all-providers     Target all configured providers
  --file <path>       Path to policy YAML file
  --format <fmt>      Output format (text, json) [default: text]
  --since <date>      Filter since date (ISO8601)
  --output <path>     Write output to file
  --dry-run           Preview changes without applying
  --config <path>     Path to config file [default: mcp-config.yaml]

EXAMPLES:
  mcp-cli health-check --all-providers
  mcp-cli drift-scan --provider cloudflare
  mcp-cli compliance-check --format json
  mcp-cli policy-apply --file policy.yaml --dry-run
  mcp-cli ledger-view --since "2026-05-01"
`;

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      provider: { type: "string" },
      "all-providers": { type: "boolean", default: false },
      file: { type: "string" },
      format: { type: "string", default: "text" },
      since: { type: "string" },
      output: { type: "string" },
      "dry-run": { type: "boolean", default: false },
      config: { type: "string", default: "mcp-config.yaml" },
      help: { type: "boolean", default: false },
    },
  });

  if (values.help || positionals.length === 0) {
    console.log(HELP);
    process.exit(0);
  }

  const command = positionals[0] as Command;
  if (!COMMANDS.includes(command)) {
    console.error(`Unknown command: ${command}\nRun 'mcp-cli help' for usage.`);
    process.exit(1);
  }

  if (command === "help") {
    console.log(HELP);
    return;
  }

  if (command === "init") {
    await handleInit();
    return;
  }

  const adapters = buildAdapters(values.provider, values["all-providers"]);
  if (adapters.size === 0) {
    console.error("No provider adapters are configured. Set provider credentials or choose an enabled provider.");
    process.exit(1);
  }
  const artifactDir = resolve("artifacts");
  if (!existsSync(artifactDir)) mkdirSync(artifactDir, { recursive: true });

  const signedLedgerCommands = new Set<Command>(["drift-scan", "policy-apply", "ledger-view", "ledger-verify"]);
  const ledgerKey = process.env.MCP_LEDGER_KEY;
  if (!ledgerKey && signedLedgerCommands.has(command)) {
    console.error("MCP_LEDGER_KEY is required for signed ledger operations.");
    process.exit(1);
  }
  const backend = new FileLedgerBackend(artifactDir);
  const ledger = new UniversalLedger(backend, ledgerKey ?? "unused-for-readiness-checks", adapters);
  const orchestrator = new CrossProviderOrchestrator(adapters, ledger);

  switch (command) {
    case "health-check":
      await handleHealthCheck(adapters, values.format ?? "text");
      break;
    case "drift-scan":
      await handleDriftScan(orchestrator, values.format ?? "text");
      break;
    case "compliance-check":
      await handleComplianceCheck(adapters, values.format ?? "text");
      break;
    case "policy-apply":
      await handlePolicyApply(orchestrator, values.file, values["dry-run"]);
      break;
    case "policy-validate":
      await handlePolicyValidate(adapters, values.file);
      break;
    case "ledger-view":
      console.log("[ledger] View ledger entries (storage backend query)");
      break;
    case "ledger-verify":
      console.log("[ledger] Verify ledger signatures");
      break;
  }
}

async function handleInit(): Promise<void> {
  console.log("Initializing MJ MCP Platform...\n");

  const configTemplate = `# MJ MCP Platform Configuration
providers:
  cloudflare:
    enabled: true
    api_token: \${CF_API_TOKEN}
    zone_id: \${CF_ZONE_ID}
    account_id: \${CF_ACCOUNT_ID}

  aws:
    enabled: false
    region: us-east-1

  kubernetes:
    enabled: false
    cluster: prod-us-east

ledger:
  key: \${MCP_LEDGER_KEY}
  storage: file
  path: ./artifacts

automation:
  drift_scan_interval: "0 */6 * * *"
  compliance_check_interval: "0 0 * * *"
  auto_remediate: false
`;

  if (!existsSync("mcp-config.yaml")) {
    const { writeFileSync } = await import("node:fs");
    writeFileSync("mcp-config.yaml", configTemplate);
    console.log("Created mcp-config.yaml");
  } else {
    console.log("mcp-config.yaml already exists");
  }

  if (!existsSync("artifacts")) {
    mkdirSync("artifacts", { recursive: true });
    console.log("Created artifacts/");
  }

  console.log("\nNext steps:");
  console.log("  1. Edit mcp-config.yaml with your provider credentials");
  console.log("  2. Run: mcp-cli health-check --all-providers");
  console.log("  3. Run: mcp-cli compliance-check");
}

function buildAdapters(
  providerName?: string,
  allProviders?: boolean,
): Map<ProviderName, ProviderAdapter> {
  const adapters = new Map<ProviderName, ProviderAdapter>();

  const shouldInclude = (name: ProviderName): boolean => {
    if (allProviders) return true;
    if (providerName) return name === providerName;
    return name === "cloudflare";
  };

  if (shouldInclude("cloudflare")) {
    const token = process.env.CF_API_TOKEN;
    const zoneId = process.env.CF_ZONE_ID;
    if (token && zoneId) {
      adapters.set("cloudflare", new CloudflareAdapter({
        apiToken: token,
        zoneId,
        accountId: process.env.CF_ACCOUNT_ID,
      }));
    } else {
      console.warn("[config] Cloudflare: missing CF_API_TOKEN or CF_ZONE_ID");
    }
  }

  if (shouldInclude("aws")) {
    adapters.set("aws", new AWSAdapter({
      region: process.env.AWS_REGION ?? "us-east-1",
    }));
  }

  if (shouldInclude("kubernetes")) {
    adapters.set("kubernetes", new KubernetesAdapter({
      cluster: process.env.K8S_CLUSTER ?? "default",
    }));
  }

  return adapters;
}

async function handleHealthCheck(
  adapters: Map<ProviderName, ProviderAdapter>,
  format: string,
): Promise<void> {
  const aggregator = new HealthCheckAggregator(adapters);
  const report = await aggregator.runHealthCheckAcrossProviders();

  if (format === "json") {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(aggregator.formatReport(report));
  }

  if (report.overallStatus !== "healthy") {
    process.exit(1);
  }
}

async function handleDriftScan(
  orchestrator: CrossProviderOrchestrator,
  format: string,
): Promise<void> {
  const scanner = new DriftScanner(orchestrator);
  const reports = await scanner.scanAllProviders();

  if (format === "json") {
    console.log(JSON.stringify(reports, null, 2));
  } else {
    for (const report of reports) {
      console.log(scanner.formatDriftReport(report));
    }
    if (reports.length === 0) {
      console.log("No drift detected across all providers.");
    }
  }

  if (reports.length > 0) {
    process.exit(1);
  }
}

async function handleComplianceCheck(
  adapters: Map<ProviderName, ProviderAdapter>,
  format: string,
): Promise<void> {
  const checker = new ComplianceChecker(adapters);
  const report = await checker.validateComplianceAcrossProviders();

  if (format === "json") {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(checker.formatReport(report));
  }

  if (report.overallScore < 95) {
    process.exit(1);
  }
}

async function handlePolicyApply(
  orchestrator: CrossProviderOrchestrator,
  filePath?: string,
  dryRun?: boolean,
): Promise<void> {
  if (!filePath) {
    console.error("--file is required for policy-apply");
    process.exit(1);
  }

  const policy = loadPolicyFile(filePath);

  if (dryRun) {
    console.log("DRY RUN — policy would be applied to:", policy.targetProviders.join(", "));
    console.log(`  Name: ${policy.name}`);
    console.log(`  WAF rules: ${policy.policies.waf.rules.length}`);
    console.log(`  Rate limit rules: ${policy.policies.rateLimit.rules.length}`);
    return;
  }

  const report = await orchestrator.applyPolicyToAllProviders(policy);
  console.log(JSON.stringify(report, null, 2));

  const failed = Object.values(report.results).some((r) => r.status === "failed");
  if (failed) process.exit(1);
}

async function handlePolicyValidate(
  adapters: Map<ProviderName, ProviderAdapter>,
  filePath?: string,
): Promise<void> {
  if (!filePath) {
    console.error("--file is required for policy-validate");
    process.exit(1);
  }

  const policy = loadPolicyFile(filePath);
  let hasErrors = false;

  for (const providerName of policy.targetProviders) {
    const adapter = adapters.get(providerName);
    if (!adapter) {
      console.log(`[${providerName}] adapter not configured — skipping`);
      continue;
    }

    const result = await adapter.validatePolicy(policy);
    if (result.ok) {
      console.log(`[${providerName}] VALID`);
    } else {
      console.log(`[${providerName}] INVALID:`);
      for (const err of result.errors) {
        console.log(`  - ${err}`);
      }
      hasErrors = true;
    }
  }

  if (hasErrors) process.exit(1);
}

function loadPolicyFile(filePath: string): SecurityPolicy {
  const resolved = resolve(filePath);
  if (!existsSync(resolved)) {
    console.error(`Policy file not found: ${resolved}`);
    process.exit(1);
  }

  const content = readFileSync(resolved, "utf-8");
  if (resolved.endsWith(".yaml") || resolved.endsWith(".yml")) {
    return parseYAML(content) as SecurityPolicy;
  }
  return JSON.parse(content) as SecurityPolicy;
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
