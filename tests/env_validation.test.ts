import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { auditEnvKeys } from "../src/lib/envCheck";

describe("Environment Secrets Format & Presence Audit (Zero Value Leakage)", () => {
  test("identifies valid 60-character $2a/$2b bcrypt hash formats without printing values", () => {
    // Synthetic test hash that matches format exactly (53 chars of base64 + 7 prefix)
    const validHash2b = "$2b$10$" + "A".repeat(53);
    const validHash2a = "$2a$12$" + "B".repeat(53);
    const invalidShort = "$2b$10$" + "A".repeat(40);
    const invalidPrefix = "$1$" + "A".repeat(53);

    const testEnv1 = { AUTH_PASSWORD_HASH: validHash2b };
    const audit1 = auditEnvKeys(testEnv1).find((k) => k.key === "AUTH_PASSWORD_HASH");
    assert.equal(audit1?.present, true);
    assert.equal(audit1?.validFormat, true);

    const testEnv2 = { AUTH_PASSWORD_HASH: validHash2a };
    const audit2 = auditEnvKeys(testEnv2).find((k) => k.key === "AUTH_PASSWORD_HASH");
    assert.equal(audit2?.present, true);
    assert.equal(audit2?.validFormat, true);

    const testEnv3 = { AUTH_PASSWORD_HASH: invalidShort };
    const audit3 = auditEnvKeys(testEnv3).find((k) => k.key === "AUTH_PASSWORD_HASH");
    assert.equal(audit3?.present, true);
    assert.equal(audit3?.validFormat, false);

    const testEnv4 = { AUTH_PASSWORD_HASH: invalidPrefix };
    const audit4 = auditEnvKeys(testEnv4).find((k) => k.key === "AUTH_PASSWORD_HASH");
    assert.equal(audit4?.present, true);
    assert.equal(audit4?.validFormat, false);

    const testEnv5 = {};
    const audit5 = auditEnvKeys(testEnv5).find((k) => k.key === "AUTH_PASSWORD_HASH");
    assert.equal(audit5?.present, false);
    assert.equal(audit5?.validFormat, false);
  });

  test("verifies all critical security keys are auditable", () => {
    const mockEnv = {
      AUTH_SECRET: "mock_secret_string_32_characters_long",
      AUTH_EMAIL: "trader@example.com",
      AUTH_PASSWORD_HASH: "$2b$10$" + "X".repeat(53),
      CRON_SECRET: "mock_cron_secret_16_chars",
      MONGODB_URI: "mongodb+srv://cluster.example.com",
    };

    const results = auditEnvKeys(mockEnv);
    assert.equal(results.length, 5);
    for (const r of results) {
      assert.equal(r.present, true, `Key ${r.key} should be present`);
      assert.equal(r.validFormat, true, `Key ${r.key} should have valid format`);
    }
  });
});
