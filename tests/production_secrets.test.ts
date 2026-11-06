import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { verifyCredentials, createSessionToken, verifySessionToken, validateCronSecret } from "../src/lib/auth";

describe("Production Secrets Mandatory Enforcement", () => {
  test("throws in production when AUTH_PASSWORD_HASH is missing", async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalHash = process.env.AUTH_PASSWORD_HASH;

    try {
      (process.env as any).NODE_ENV = "production";
      delete process.env.AUTH_PASSWORD_HASH;

      await assert.rejects(
        async () => {
          await verifyCredentials("anshulnparate@gmail.com", "any_test_pass");
        },
        {
          name: "Error",
          message: /CRITICAL SECURITY CONFIGURATION ERROR: AUTH_PASSWORD_HASH environment variable is missing in production/,
        }
      );
    } finally {
      (process.env as any).NODE_ENV = originalNodeEnv;
      if (originalHash) process.env.AUTH_PASSWORD_HASH = originalHash;
    }
  });

  test("throws in production when AUTH_SECRET is missing", async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalSecret = process.env.AUTH_SECRET;
    const originalJwtSecret = process.env.JWT_SECRET;

    try {
      (process.env as any).NODE_ENV = "production";
      delete process.env.AUTH_SECRET;
      delete process.env.JWT_SECRET;

      await assert.rejects(
        async () => {
          await createSessionToken({
            id: "1",
            name: "Test",
            email: "test@example.com",
            role: "Trader",
            authenticatedAt: Date.now(),
          });
        },
        {
          name: "Error",
          message: /CRITICAL SECURITY CONFIGURATION ERROR: AUTH_SECRET environment variable is missing in production/,
        }
      );
    } finally {
      (process.env as any).NODE_ENV = originalNodeEnv;
      if (originalSecret) process.env.AUTH_SECRET = originalSecret;
      if (originalJwtSecret) process.env.JWT_SECRET = originalJwtSecret;
    }
  });

  test("throws in production when CRON_SECRET is missing", async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalCronSecret = process.env.CRON_SECRET;

    try {
      (process.env as any).NODE_ENV = "production";
      delete process.env.CRON_SECRET;

      assert.throws(
        () => {
          validateCronSecret();
        },
        {
          name: "Error",
          message: /CRITICAL SECURITY CONFIGURATION ERROR: CRON_SECRET environment variable is missing in production/,
        }
      );
    } finally {
      (process.env as any).NODE_ENV = originalNodeEnv;
      if (originalCronSecret) process.env.CRON_SECRET = originalCronSecret;
    }
  });
});
