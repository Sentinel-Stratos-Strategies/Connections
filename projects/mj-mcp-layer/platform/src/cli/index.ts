#!/usr/bin/env node

import { parseArgs } from "node:util";
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYAML } from "yaml";
import type { ProviderName, SecurityPolicy } from "../core/types.js";
import type { ProviderAdapter } from "../adapters/provider.interface.js";
import { CloudflareAdapter } from "../adapters/cloudflare.adapter.js";
import { AWSAdapter } from "../adapters/aws.adapter.js";
import { KubernetesAdapter } from "../adapters/kubernetes.adapter.js";
import { TerraformAdapter } from "../adapters/terraform.adapter.js";
import { UniversalLedger, FileLedgerBackend } from "../core/ledger.js";
import { CrossProviderOrchestrator } from "../core/orchestrator.js";
import { DriftScanner } from "../automation/drift-scanner.js";
import { ComplianceChecker } from "../automation/compliance-checker.js";
import { HealthCheckAggregator } from "../automation/health-aggregator.js";
import { ChangeRequestWorkflow } from "../automation/change-request-workflow.js";
import { AutoRemediation } from "../automation/auto-remediation.js";
import { PolicyTranslator } from "../automation/policy-translator.js";
import { PolicyCompiler, type IntentRequest } from "../core/policy-compiler.js";
import { EvidenceEngine } from "../core/evidence-engine.js";
import { MutationTester } from "../core/mutation-tester.js";
import { RollbackEngine } from "../core/rollback-engine.js";
import { RuntimeVerifier } from "../core/runtime-verifier.js";
import { DigitalTwin } from "../core/digital-twin.js";
import { DriftClassifier } from "../automation/drift-classifier.js";
import { ComplianceAutopilot, type ComplianceFramework } from "../automation/compliance-autopilot.js";
import { MutationBudgetEngine } from "../core/mutation-budget.js";
import { VisaEngine } from "../core/capability-visa.js";
import { ReputationEngine } from "../core/reputation-engine.js";
import { AgentCourt } from "../core/agent-court.js";

const COMMANDS = [
  "init",
  "health-check",
  "drift-scan",
  "drift-classify",
  "compliance-check",
  "compliance-report",
  "policy-apply",
  "policy-validate",
  "policy-translate",
  "intent",
  "prove",
  "plan",
  "verify",
  "simulate",
  "budget",
  "visa",
  "reputation",
  "court",
  "change-request",
  "auto-remediate",
  "ledger-view",
  "ledger-verify",
  "help",
] as const;

type Command = (typeof COMMANDS)[number];
type SigningContext = "court" | "visa";

const HELP = `
mcp-cli — MJ MCP Platform CLI

USAGE:
  mcp-cli <command> [options]

COMMANDS:
  init                Initialize configuration
  health-check        Run health checks across providers
  drift-scan          Scan for unauthorized configuration drift
  drift-classify      Classify drift by severity with immune response
  compliance-check    Validate compliance posture
  policy-apply        Apply a security policy
  policy-validate     Validate a policy file without applying
  policy-translate    Translate policy between providers
  intent              Compile an intent into a full execution plan
  prove               Run mutation tests against a policy
  plan                Generate and test a rollback recipe
  verify              Run runtime verification against live audit events
  simulate            Run digital twin simulation for a policy change
  budget              Show mutation budget for an actor
  visa                Mint or list capability visas
  reputation          Show agent reputation scores
  court               Run full agent court review on an intent
  compliance-report   Generate compliance report (soc2, pci, hipaa, iso27001)
  change-request      Submit a change request for approval
  auto-remediate      Detect drift and remediate with approval
  ledger-view         View recent ledger entries
  ledger-verify       Verify ledger signature integrity
  help                Show this help

OPTIONS:
  --provider <name>   Target specific provider (cloudflare, aws, kubernetes, terraform)
  --all-providers     Target all configured providers
  --file <path>       Path to policy YAML file
  --format <fmt>      Output format (text, json) [default: text]
  --since <date>      Filter since date (ISO8601)
  --output <path>     Write output to file
  --dry-run           Preview changes without applying
  --config <path>     Path to config file [default: mcp-config.yaml]
  --from <provider>   Source provider for translation
  --to <provider>     Target provider for translation
  --auto-approve      Skip approval gate (auto-remediate only)
  --name <name>       Change request name
  --tenant <name>     Tenant ID for intent compilation
  --endpoint <url>    Target endpoint for mutation tests
  --risk <level>      Risk tolerance: low, medium, high
  --framework <name>  Compliance framework (soc2, pci, hipaa, iso27001) [default: soc2]

EXAMPLES:
  mcp-cli health-check --all-providers
  mcp-cli drift-scan --provider cloudflare
  mcp-cli compliance-check --format json
  mcp-cli policy-apply --file policy.yaml --dry-run
  mcp-cli policy-translate --file policy.yaml --from cloudflare --to aws
  mcp-cli change-request --file policy.yaml --name "enable-mfa" --provider cloudflare
  mcp-cli intent --intent "protect /mcp from unauthenticated bursts" --tenant kevis
  mcp-cli prove --file policy.yaml --endpoint https://worker.dev
  mcp-cli plan --file policy.yaml --provider cloudflare
  mcp-cli verify --file policy.yaml --endpoint https://worker.dev --since "1 hour ago"
  mcp-cli simulate --file policy.yaml --provider cloudflare
  mcp-cli drift-classify --provider cloudflare
  mcp-cli budget --name codex
  mcp-cli visa --name cursor --intent "add_dns_record" --tenant kevis.online
  mcp-cli reputation
  mcp-cli court --intent "protect /mcp from unauthenticated bursts" --tenant kevis
  mcp-cli compliance-report --framework pci --format json --from 2026-01-01 --to 2026-06-01
  mcp-cli auto-remediate --provider cloudflare
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
      from: { type: "string" },
      to: { type: "string" },
      "auto-approve": { type: "boolean", default: false },
      name: { type: "string" },
      intent: { type: "string" },
      tenant: { type: "string" },
      endpoint: { type: "string" },
      risk: { type: "string" },
      framework: { type: "string", default: "soc2" },
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

  const adapterRequiredCommands = new Set<Command>(["health-check", "drift-scan", "drift-classify", "compliance-check", "policy-apply", "change-request", "auto-remediate", "intent", "plan", "simulate"]);
  const commandRequiresAdapters = adapterRequiredCommands.has(command)
    && !(command === "policy-apply" && values["dry-run"]);
  const adapters = buildAdapters(values.provider, values["all-providers"], !commandRequiresAdapters);
  if (adapters.size === 0 && commandRequiresAdapters) {
    console.error("No provider adapters are configured. Set provider credentials or choose an enabled provider.");
    process.exit(1);
  }
  const artifactDir = resolve("artifacts");
  if (!existsSync(artifactDir)) mkdirSync(artifactDir, { recursive: true });

  const signedLedgerCommands = new Set<Command>(["drift-scan", "policy-apply", "ledger-view", "ledger-verify"]);
  const commandRequiresLedgerKey = signedLedgerCommands.has(command)
    && !(command === "policy-apply" && values["dry-run"]);
  const ledgerKey = process.env.MCP_LEDGER_KEY;
  if (!ledgerKey && commandRequiresLedgerKey) {
    console.error("MCP_LEDGER_KEY is required for signed ledger operations.");
    process.exit(1);
  }
  const backend = new FileLedgerBackend(artifactDir);
  const ledger = new UniversalLedger(backend, ledgerKey ?? "unused-for-readiness-checks", adapters);
  const evidenceEngine = ledgerKey ? new EvidenceEngine(ledgerKey, artifactDir) : undefined;
  const orchestrator = new CrossProviderOrchestrator(adapters, ledger, {
    evidenceEngine,
    requireRollbackTest: true,
  });

  switch (command) {
    case "health-check":
      await handleHealthCheck(adapters, values.format ?? "text");
      break;
    case "drift-scan":
      await handleDriftScan(orchestrator, values.format ?? "text");
      break;
    case "drift-classify":
      await handleDriftClassify(orchestrator, adapters, values.format ?? "text");
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
    case "policy-translate":
      await handlePolicyTranslate(values.file, values.from, values.to);
      break;
    case "intent":
      await handleIntent(adapters, values.intent, values.tenant, values.risk, values.format ?? "text");
      break;
    case "prove":
      await handleProve(values.file, values.endpoint, values.format ?? "text");
      break;
    case "plan":
      await handlePlan(adapters, ledger, values.file, values.format ?? "text");
      break;
    case "verify":
      await handleVerify(values.file, values.endpoint, values.since, values.format ?? "text");
      break;
    case "simulate":
      await handleSimulate(adapters, values.file, values.format ?? "text");
      break;
    case "budget":
      handleBudget(values.name, values.format ?? "text");
      break;
    case "visa":
      handleVisaCommand(values.name, values.intent, values.tenant, values.format ?? "text");
      break;
    case "reputation":
      handleReputationCommand(values.name, values.format ?? "text");
      break;
    case "court":
      await handleCourt(adapters, ledger, values.intent, values.tenant, values.risk, values.format ?? "text");
      break;
    case "compliance-report":
      handleComplianceReport(values.from, values.to, values.format ?? "text", values.framework);
      break;
    case "change-request":
      await handleChangeRequestSubmit(orchestrator, ledger, adapters, values.file, values.name);
      break;
    case "auto-remediate":
      await handleAutoRemediate(orchestrator, ledger, adapters, values["auto-approve"]);
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
  quiet = false,
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
      if (!quiet) console.warn("[config] Cloudflare: missing CF_API_TOKEN or CF_ZONE_ID");
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

  if (shouldInclude("terraform")) {
    adapters.set("terraform", new TerraformAdapter({
      workingDir: process.env.TF_WORKING_DIR,
      stateBackend: process.env.TF_STATE_BACKEND,
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

async function handleIntent(
  adapters: Map<ProviderName, ProviderAdapter>,
  intentText?: string,
  tenant?: string,
  risk?: string,
  format?: string,
): Promise<void> {
  if (!intentText) {
    console.error("--intent is required. Example: --intent 'protect /mcp from unauthenticated bursts'");
    process.exit(1);
  }

  const translator = new PolicyTranslator();
  const compiler = new PolicyCompiler(translator);

  const intentRequest = {
    intent: intentText,
    tenant: tenant ?? "default",
    risk_tolerance: (risk as "low" | "medium" | "high") ?? "low",
    rollback_required: true,
    target_providers: Array.from(adapters.keys()) as ProviderName[],
  };

  const firstAdapter = adapters.values().next().value;
  const inventory = firstAdapter
    ? await firstAdapter.getInventory()
    : { provider: "cloudflare" as const, timestamp: new Date().toISOString(), resources: {} };

  const plan = compiler.compile(intentRequest, inventory, adapters);

  if (format === "json") {
    console.log(JSON.stringify(plan, null, 2));
  } else {
    console.log(`# Compiled Plan: ${plan.id}\n`);
    console.log(`Intent: "${plan.intent.intent}"`);
    console.log(`Tenant: ${plan.intent.tenant}`);
    console.log(`Risk tolerance: ${plan.intent.risk_tolerance}`);
    console.log(`Approval path: ${plan.approval_path}`);
    console.log(`\n## Blast Radius\n`);
    console.log(`  Risk: ${plan.blast_radius.estimated_risk}`);
    console.log(`  Tenants: ${plan.blast_radius.tenants_affected.join(", ")}`);
    console.log(`  Endpoints: ${plan.blast_radius.endpoints_affected.join(", ")}`);
    console.log(`  Providers: ${plan.blast_radius.providers_affected.join(", ")}`);
    console.log(`  Reversible: ${plan.blast_radius.reversible}`);
    console.log(`\n${plan.policy_diff}`);
    console.log(`## Test Cases: ${plan.test_cases.length}`);
    for (const tc of plan.test_cases) {
      console.log(`  - ${tc.name}: ${tc.expected_outcome}`);
    }
    console.log(`\n## Rollback: ${plan.rollback_recipe.steps.length} steps (${plan.rollback_recipe.estimated_duration_seconds}s)`);
    console.log(`\n## Evidence Required: ${plan.evidence_requirements.join(", ")}`);
  }
}

async function handleProve(
  filePath?: string,
  endpoint?: string,
  format?: string,
): Promise<void> {
  if (!filePath) {
    console.error("--file is required for prove. Provide a policy YAML file.");
    process.exit(1);
  }

  const policy = loadPolicyFile(filePath);
  const tester = new MutationTester();
  const mutants = tester.generateMutants(policy);

  console.log(`Generated ${mutants.length} mutants from policy\n`);

  if (endpoint) {
    console.log(`Running mutants against ${endpoint}...\n`);
    const report = await tester.runMutants(mutants, { endpoint });

    if (format === "json") {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log(tester.formatReport(report));
    }

    if (!report.passed) process.exit(1);
  } else {
    console.log("No --endpoint provided. Listing generated mutants (dry run):\n");
    for (const mutant of mutants) {
      console.log(`  [${mutant.category}] ${mutant.name}`);
      console.log(`    ${mutant.description}`);
      console.log(`    ${mutant.request.method} ${mutant.request.path} -> expect ${mutant.expected_outcome}`);
      if (mutant.request.repeat) console.log(`    repeat: ${mutant.request.repeat}x`);
      console.log("");
    }
    console.log(`Total: ${mutants.length} mutants. Use --endpoint <url> to run them.`);
  }
}

async function handlePlan(
  adapters: Map<ProviderName, ProviderAdapter>,
  ledger: UniversalLedger,
  filePath?: string,
  format?: string,
): Promise<void> {
  if (!filePath) {
    console.error("--file is required for plan. Provide a policy YAML file.");
    process.exit(1);
  }

  const policy = loadPolicyFile(filePath);
  const translator = new PolicyTranslator();
  const compiler = new PolicyCompiler(translator);
  const rollbackEngine = new RollbackEngine(adapters, ledger);

  const firstAdapter = adapters.values().next().value;
  const inventory = firstAdapter
    ? await firstAdapter.getInventory()
    : { provider: "cloudflare" as const, timestamp: new Date().toISOString(), resources: {} };

  const intentRequest = {
    intent: `apply policy ${policy.name}`,
    tenant: "operator",
    risk_tolerance: "low" as const,
    rollback_required: true,
    target_providers: policy.targetProviders,
  };

  const plan = compiler.compilePolicy(intentRequest, policy, inventory);
  const recipe = rollbackEngine.generateRecipe(plan, inventory);
  const testResult = await rollbackEngine.testRecipe(recipe, inventory, inventory);

  if (format === "json") {
    console.log(JSON.stringify({ plan: plan.id, recipe, test: testResult }, null, 2));
  } else {
    console.log(rollbackEngine.formatRecipe(recipe));
    console.log("\n" + rollbackEngine.formatTestResult(testResult));
  }

  if (!testResult.simulation_passed) {
    console.error("\nRollback test FAILED — this plan should not be deployed without fixing the recipe.");
    process.exit(1);
  }
}

function handleBudget(actorName?: string, format?: string): void {
  const budgetEngine = new MutationBudgetEngine(
    resolve("manifests/budgets"),
    resolve("artifacts/budget-state.json"),
  );

  if (actorName) {
    const summary = budgetEngine.getBudgetSummary(actorName);
    if (format === "json") {
      console.log(JSON.stringify(summary, null, 2));
    } else {
      console.log(budgetEngine.formatSummary(summary));
    }
  } else {
    const all = budgetEngine.getAllSummaries();
    if (format === "json") {
      console.log(JSON.stringify(all, null, 2));
    } else {
      for (const summary of all) {
        console.log(budgetEngine.formatSummary(summary));
        console.log("");
      }
      if (all.length === 0) console.log("No budgets configured. Add YAML files to manifests/budgets/");
    }
  }
}

function handleVisaCommand(
  agent?: string,
  scope?: string,
  zone?: string,
  format?: string,
): void {
  const signingKey = resolveSigningKey("visa");
  const visaEngine = new VisaEngine(resolve("artifacts/visa-store.json"), signingKey);

  if (agent && scope) {
    const visa = visaEngine.mint({
      agent,
      scope,
      zone: zone ?? "default",
      reason: `CLI mint: ${scope} for ${agent}`,
    });

    if (format === "json") {
      console.log(JSON.stringify(visa, null, 2));
    } else {
      console.log(visaEngine.formatVisa(visa));
    }
  } else {
    if (format === "json") {
      console.log(JSON.stringify(visaEngine.listAll(), null, 2));
    } else {
      console.log(visaEngine.formatActiveList());
    }
  }
}

function handleReputationCommand(actorName?: string, format?: string): void {
  const repEngine = new ReputationEngine(resolve("artifacts/reputation-store.json"));

  if (actorName) {
    const rep = repEngine.getReputation(actorName);
    if (format === "json") {
      console.log(JSON.stringify(rep, null, 2));
    } else {
      console.log(repEngine.formatReputation(rep));
    }
  } else {
    if (format === "json") {
      console.log(JSON.stringify(repEngine.getAllReputations(), null, 2));
    } else {
      console.log(repEngine.formatLeaderboard());
    }
  }
}

async function handleCourt(
  adapters: Map<ProviderName, ProviderAdapter>,
  ledger: UniversalLedger,
  intentText?: string,
  tenant?: string,
  risk?: string,
  format?: string,
): Promise<void> {
  if (!intentText) {
    console.error("--intent is required for court. Example: --intent 'protect /mcp from unauthenticated bursts'");
    process.exit(1);
  }

  const translator = new PolicyTranslator();
  const compiler = new PolicyCompiler(translator);
  const tester = new MutationTester();
  const rollbackEngine = new RollbackEngine(adapters, ledger);
  const evidenceEngine = new EvidenceEngine(
    resolveSigningKey("court"),
    resolve("artifacts"),
  );
  const budgetEngine = new MutationBudgetEngine(
    resolve("manifests/budgets"),
    resolve("artifacts/budget-state.json"),
  );
  const repEngine = new ReputationEngine(resolve("artifacts/reputation-store.json"));

  const court = new AgentCourt({
    compiler,
    mutationTester: tester,
    rollbackEngine,
    evidenceEngine,
    budgetEngine,
    reputationEngine: repEngine,
    adapters,
  });

  const intent: IntentRequest = {
    intent: intentText,
    tenant: tenant ?? "default",
    risk_tolerance: (risk as "low" | "medium" | "high") ?? "low",
    rollback_required: true,
    target_providers: Array.from(adapters.keys()) as ProviderName[],
  };

  const review = await court.review(intent);

  if (format === "json") {
    console.log(JSON.stringify(review, null, 2));
  } else {
    console.log(court.formatReview(review));
  }

  if (review.final_verdict === "denied") process.exit(1);
  if (review.final_verdict === "escalated") process.exit(2);
}

function handleComplianceReport(
  periodStart?: string,
  periodEnd?: string,
  format?: string,
  frameworkValue?: string,
): void {
  const start = periodStart ?? new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
  const end = periodEnd ?? new Date().toISOString().slice(0, 10);
  const framework = parseComplianceFramework(frameworkValue);

  const autopilot = new ComplianceAutopilot(resolve("manifests/compliance"));
  const report = autopilot.generateReport(framework, [], start, end, {
    driftScanCount: 0,
    visaCount: 0,
    budgetCheckCount: 0,
    agentCount: 0,
    antibodyCount: 0,
  });

  if (format === "json") {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(autopilot.formatReport(report));
  }
}

function parseComplianceFramework(value?: string): ComplianceFramework {
  const framework = (value ?? "soc2").toLowerCase();
  if (framework === "soc2" || framework === "pci" || framework === "hipaa" || framework === "iso27001") {
    return framework;
  }
  console.error(`Unsupported compliance framework: ${value}. Expected soc2, pci, hipaa, or iso27001.`);
  process.exit(1);
}

async function handleVerify(
  filePath?: string,
  endpoint?: string,
  since?: string,
  format?: string,
): Promise<void> {
  if (!filePath) {
    console.error("--file is required for verify. Provide a policy YAML file.");
    process.exit(1);
  }
  if (!endpoint) {
    console.error("--endpoint is required for verify. Provide the Worker URL.");
    process.exit(1);
  }

  const policy = loadPolicyFile(filePath);
  const verifier = new RuntimeVerifier();
  const monitors = verifier.generateMonitors(policy);

  console.log(`Generated ${monitors.length} runtime monitors from policy\n`);

  const authToken = process.env.OPERATOR_TOKEN ?? process.env.MCP_HEALTH_TOKEN;
  const results = await verifier.fetchAndVerify(monitors, {
    endpoint,
    auth_token: authToken,
    since: since ?? new Date(Date.now() - 3600000).toISOString(),
    limit: 200,
  });

  if (format === "json") {
    console.log(JSON.stringify(results, null, 2));
  } else {
    console.log(verifier.formatResults(results));
  }

  const failed = results.filter((r) => !r.passed);
  if (failed.length > 0) process.exit(1);
}

async function handleSimulate(
  adapters: Map<ProviderName, ProviderAdapter>,
  filePath?: string,
  format?: string,
): Promise<void> {
  if (!filePath) {
    console.error("--file is required for simulate. Provide a policy YAML file.");
    process.exit(1);
  }

  const policy = loadPolicyFile(filePath);
  const translator = new PolicyTranslator();
  const compiler = new PolicyCompiler(translator);
  const tester = new MutationTester();
  const twin = new DigitalTwin(tester);

  const firstAdapter = adapters.values().next().value;
  const inventory = firstAdapter
    ? await firstAdapter.getInventory()
    : { provider: "cloudflare" as const, timestamp: new Date().toISOString(), resources: {} };

  const intentRequest = {
    intent: `apply policy ${policy.name}`,
    tenant: "operator",
    risk_tolerance: "low" as const,
    rollback_required: true,
    target_providers: policy.targetProviders,
  };

  const plan = compiler.compilePolicy(intentRequest, policy, inventory);

  const currentPolicy: SecurityPolicy = {
    version: 0,
    name: "current",
    targetProviders: policy.targetProviders,
    zones: [],
    securityDefaults: { denyByDefault: true, requiredHeaders: [] },
    policies: { waf: { rules: [] }, rateLimit: { rules: [] } },
    rbac: { tenants: [] },
    audit: { enabled: true, retention: "90 days", immutable: true },
  };

  const result = twin.simulate(inventory, currentPolicy, plan);

  if (format === "json") {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(twin.formatAsPRComment(result));
  }

  if (!result.passed) process.exit(1);
}

async function handleDriftClassify(
  orchestrator: CrossProviderOrchestrator,
  adapters: Map<ProviderName, ProviderAdapter>,
  format: string,
): Promise<void> {
  const antibodyPath = resolve("cloudflare/antibodies.yaml");
  const classifier = new DriftClassifier(antibodyPath);
  const scanner = new DriftScanner(orchestrator);
  const driftReports = await scanner.scanAllProviders();

  let hasIssues = false;

  for (const [providerName] of adapters) {
    const driftReport = driftReports.find((r) => r.provider === providerName)
      ?? { provider: providerName, timestamp: new Date().toISOString(), unauthorizedChanges: [], severity: "ok" as const };

    if (driftReport.unauthorizedChanges.length === 0) {
      console.log(`[${providerName}] No drift to classify.`);
      continue;
    }

    const context = {
      provider: providerName,
      recent_incidents: 0,
      recent_changes: driftReport.unauthorizedChanges.length,
      has_active_incident: false,
      operator_online: true,
    };

    const report = classifier.classifyReport(driftReport, context);

    if (format === "json") {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log(classifier.formatReport(report));
    }

    if (report.severity_counts.active_threat > 0 || report.severity_counts.policy_violation > 0) {
      hasIssues = true;
    }
  }

  if (hasIssues) process.exit(1);
}

async function handlePolicyTranslate(
  filePath?: string,
  fromProvider?: string,
  toProvider?: string,
): Promise<void> {
  if (!filePath) {
    console.error("--file is required for policy-translate");
    process.exit(1);
  }
  if (!fromProvider || !toProvider) {
    console.error("--from and --to are required for policy-translate");
    process.exit(1);
  }

  const policy = loadPolicyFile(filePath);
  const translator = new PolicyTranslator();
  const output = translator.translate(
    policy,
    fromProvider as ProviderName,
    toProvider as ProviderName,
  );
  console.log(output);
}

async function handleChangeRequestSubmit(
  orchestrator: CrossProviderOrchestrator,
  ledger: UniversalLedger,
  adapters: Map<ProviderName, ProviderAdapter>,
  filePath?: string,
  name?: string,
): Promise<void> {
  if (!filePath) {
    console.error("--file is required for change-request");
    process.exit(1);
  }

  const policy = loadPolicyFile(filePath);
  const requestName = name ?? policy.name ?? "unnamed-change-request";

  const githubConfig = process.env.GITHUB_TOKEN && process.env.GITHUB_REPO
    ? {
        token: process.env.GITHUB_TOKEN,
        owner: process.env.GITHUB_REPO.split("/")[0],
        repo: process.env.GITHUB_REPO.split("/")[1],
      }
    : undefined;

  const workflow = new ChangeRequestWorkflow(
    orchestrator,
    ledger,
    adapters,
    githubConfig,
  );

  const result = await workflow.submitChangeRequest({
    name: requestName,
    requester: process.env.USER ?? "cli-operator",
    targetProviders: policy.targetProviders,
    policy,
  });

  if (result.status === "rejected") {
    console.error("Change request rejected:");
    for (const err of result.errors ?? []) {
      console.error(`  - ${err}`);
    }
    process.exit(1);
  }

  console.log(`Change request submitted: ${result.id}`);
  console.log(`  Status: ${result.status}`);
  if (result.issueUrl) {
    console.log(`  GitHub Issue: ${result.issueUrl}`);
  }
  if (result.previews) {
    for (const [provider, preview] of Object.entries(result.previews)) {
      console.log(`\n--- Preview: ${provider} ---`);
      console.log(preview);
    }
  }
}

async function handleAutoRemediate(
  _orchestrator: CrossProviderOrchestrator,
  ledger: UniversalLedger,
  adapters: Map<ProviderName, ProviderAdapter>,
  autoApprove?: boolean,
): Promise<void> {
  const githubConfig = process.env.GITHUB_TOKEN && process.env.GITHUB_REPO
    ? {
        token: process.env.GITHUB_TOKEN,
        owner: process.env.GITHUB_REPO.split("/")[0],
        repo: process.env.GITHUB_REPO.split("/")[1],
      }
    : undefined;

  const remediation = new AutoRemediation(
    adapters,
    ledger,
    {
      autoApprove: autoApprove ?? false,
      timeoutMs: 60000,
      notifyChannels: githubConfig ? ["console", "github"] : ["console"],
    },
    githubConfig,
  );

  const sixHoursAgo = new Date(Date.now() - 6 * 3600 * 1000);
  let hasIssues = false;

  for (const [providerName, _adapter] of adapters) {
    const driftReport = await ledger.getDrift(providerName, sixHoursAgo);
    if (driftReport.unauthorizedChanges.length === 0) {
      console.log(`[${providerName}] No drift detected.`);
      continue;
    }

    console.log(`[${providerName}] Drift detected — initiating remediation...`);
    const result = await remediation.remediateWithApproval(driftReport);

    if (result.status === "remediated") {
      console.log(`[${providerName}] Remediation complete (change: ${result.changeId})`);
    } else if (result.status === "timeout") {
      console.log(`[${providerName}] Remediation timed out — escalated`);
      hasIssues = true;
    } else if (result.status === "failed") {
      console.error(`[${providerName}] Remediation failed: ${result.message}`);
      hasIssues = true;
    }
  }

  if (hasIssues) process.exit(1);
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

export function resolveSigningKey(
  context: SigningContext,
  env: Record<string, string | undefined> = process.env,
): string {
  const key = env.MCP_LEDGER_KEY?.trim();
  if (key) return key;

  if (env.MJ_ALLOW_TEST_SIGNING_KEY === "1") {
    return `test-only-${context}-key`;
  }

  throw new Error(`MCP_LEDGER_KEY is required for ${context} signing`);
}

function isCliEntrypoint(): boolean {
  return Boolean(process.argv[1]) && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

if (isCliEntrypoint()) {
  main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
}
