import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { resolveSigningKey } from "../src/cli/index.js";

describe("cli signing policy", () => {
  test("production signing contexts fail closed without MCP_LEDGER_KEY", () => {
    assert.throws(
      () => resolveSigningKey("visa", {}),
      /MCP_LEDGER_KEY is required/,
    );
    assert.throws(
      () => resolveSigningKey("court", {}),
      /MCP_LEDGER_KEY is required/,
    );
  });

  test("explicit test mode may use deterministic non-production signing keys", () => {
    assert.equal(resolveSigningKey("visa", { MJ_ALLOW_TEST_SIGNING_KEY: "1" }), "test-only-visa-key");
    assert.equal(resolveSigningKey("court", { MJ_ALLOW_TEST_SIGNING_KEY: "1" }), "test-only-court-key");
    assert.equal(resolveSigningKey("visa", { MCP_LEDGER_KEY: "real-key" }), "real-key");
  });
});
