import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  CloudShellPolicyEngine,
  budgetCategoryFor,
  classifyCommand,
} from "../src/core/cloud-shell.js";

const engine = new CloudShellPolicyEngine();

describe("cloud shell contract", () => {
  test("readonly sessions allow readonly commands", () => {
    const session = engine.createSession({
      actor: "codex",
      tenant: "ellis",
      purpose: "inspect repo",
      capability: "shell.readonly",
    });

    const decision = engine.evaluate(session, {
      session_id: session.id,
      request_id: "req-1",
      command: "git status",
      expect_mutation: false,
    });

    assert.equal(decision.allowed, true);
    assert.equal(decision.command_class, "readonly");
    assert.equal(decision.requires_budget, false);
  });

  test("readonly sessions deny mutation commands", () => {
    const session = engine.createSession({
      actor: "codex",
      tenant: "ellis",
      purpose: "inspect repo",
      capability: "shell.readonly",
    });

    const decision = engine.evaluate(session, {
      session_id: session.id,
      request_id: "req-2",
      command: "wrangler deploy",
      expect_mutation: true,
    });

    assert.equal(decision.allowed, false);
    assert.equal(decision.command_class, "worker_route_modify");
    assert.equal(decision.requires_budget, true);
  });

  test("deploy sessions require approval metadata for mutation commands", () => {
    const session = engine.createSession({
      actor: "operator",
      tenant: "ellis",
      purpose: "deploy worker",
      capability: "shell.deploy",
      env_profile: "production-approved",
    });

    const denied = engine.evaluate(session, {
      session_id: session.id,
      request_id: "req-3",
      command: "wrangler deploy",
      expect_mutation: true,
    });
    assert.equal(denied.allowed, false);
    assert.match(denied.reason, /approval/i);

    const allowed = engine.evaluate(session, {
      session_id: session.id,
      request_id: "req-4",
      command: "wrangler deploy",
      expect_mutation: true,
      approval_ref: "approval:pr-5",
    });
    assert.equal(allowed.allowed, true);
    assert.equal(allowed.budget_category, "worker_route_modify");
  });

  test("expired sessions reject commands", () => {
    const now = new Date("2026-05-13T00:00:00Z");
    const session = engine.createSession({
      actor: "codex",
      tenant: "ellis",
      purpose: "inspect repo",
      capability: "shell.readonly",
      ttl_minutes: 1,
    }, now);

    const decision = engine.evaluate(session, {
      session_id: session.id,
      request_id: "req-5",
      command: "ls",
    }, new Date("2026-05-13T00:02:00Z"));

    assert.equal(decision.allowed, false);
    assert.match(decision.reason, /expired/i);
  });

  test("secret-looking commands are denied and output redaction works", () => {
    const session = engine.createSession({
      actor: "codex",
      tenant: "ellis",
      purpose: "inspect repo",
      capability: "shell.breakglass",
    });

    const decision = engine.evaluate(session, {
      session_id: session.id,
      request_id: "req-6",
      command: "cat .env",
    });

    assert.equal(decision.allowed, false);
    assert.equal(decision.command_class, "secret_read");

    const redacted = engine.redactOutput("OPENAI_API_KEY=sk-testsecret123456");
    assert.equal(redacted.redaction_applied, true);
    assert.doesNotMatch(redacted.redacted, /sk-testsecret/);
  });

  test("transcript manifests include command hashes and decisions", () => {
    const session = engine.createSession({
      actor: "operator",
      tenant: "ellis",
      purpose: "test platform",
      capability: "shell.diagnostics",
    });
    const transcript = engine.createTranscript(session);
    const request = {
      session_id: session.id,
      request_id: "req-7",
      command: "npm --prefix projects/mj-mcp-layer/platform test",
      expect_mutation: false,
    };
    const decision = engine.evaluate(session, request);
    const entry = engine.appendPlannedCommand(transcript, session, request, decision);

    assert.equal(transcript.commands.length, 1);
    assert.equal(entry.request_id, "req-7");
    assert.match(entry.command_hash, /^[a-f0-9]{64}$/);
    assert.equal(entry.decision.allowed, true);
  });

  test("command classification maps budget categories", () => {
    assert.equal(classifyCommand("bash cloudflare/30-apply-waf.sh"), "waf_modify");
    assert.equal(budgetCategoryFor("waf_modify"), "waf_modify");
    assert.equal(classifyCommand("terraform apply"), "infrastructure_apply");
    assert.equal(budgetCategoryFor("infrastructure_apply"), "infrastructure_apply");
  });
});
