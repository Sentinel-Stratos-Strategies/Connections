import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, test } from "node:test";
import { VisaEngine } from "../src/core/capability-visa.js";

function createVisaStorePath(): string {
  const dir = mkdtempSync(join(tmpdir(), "visa-engine-"));
  return join(dir, "visas.json");
}

describe("capability visa", () => {
  test("tampering with integrity-bound fields invalidates signature", () => {
    const storePath = createVisaStorePath();

    try {
      const issuer = new VisaEngine(storePath, "test-signing-key");
      const visa = issuer.mint({
        agent: "agent-1",
        scope: "cloud.ops",
        zone: "prod",
        reason: "approved change",
      });

      const store = JSON.parse(readFileSync(storePath, "utf-8")) as { visas: Array<Record<string, unknown>> };
      store.visas[0].reason = "tampered reason";
      writeFileSync(storePath, JSON.stringify(store, null, 2));

      const validator = new VisaEngine(storePath, "test-signing-key");
      const validation = validator.validate(visa.id);

      assert.equal(validation.valid, false);
      assert.match(String(validation.reason ?? ""), /signature invalid/);
    } finally {
      rmSync(storePath, { force: true });
      rmSync(dirname(storePath), { force: true, recursive: true });
    }
  });

  test("revoked visas cannot be reactivated by store tampering", () => {
    const storePath = createVisaStorePath();

    try {
      const issuer = new VisaEngine(storePath, "test-signing-key");
      const visa = issuer.mint({
        agent: "agent-1",
        scope: "cloud.ops",
        zone: "prod",
        reason: "approved change",
      });

      assert.equal(issuer.revoke(visa.id), true);

      const store = JSON.parse(readFileSync(storePath, "utf-8")) as { visas: Array<Record<string, unknown>> };
      store.visas[0].status = "active";
      writeFileSync(storePath, JSON.stringify(store, null, 2));

      const validator = new VisaEngine(storePath, "test-signing-key");
      const validation = validator.validate(visa.id);

      assert.equal(validation.valid, false);
      assert.match(String(validation.reason ?? ""), /signature invalid/);
    } finally {
      rmSync(storePath, { force: true });
      rmSync(dirname(storePath), { force: true, recursive: true });
    }
  });
});
