import fs from "fs";
import path from "path";

export interface EnvAuditResult {
  key: string;
  present: boolean;
  validFormat: boolean;
  notes: string;
}

export function auditEnvKeys(env: Record<string, string | undefined>): EnvAuditResult[] {
  const BCRYPT_REGEX = /^\$2[ab]\$[0-9]{2}\$[A-Za-z0-9./]{53}$/;
  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const MONGO_REGEX = /^mongodb(\+srv)?:\/\//;

  const results: EnvAuditResult[] = [];

  // 1. AUTH_SECRET
  const authSecret = env.AUTH_SECRET;
  results.push({
    key: "AUTH_SECRET",
    present: !!authSecret,
    validFormat: !!authSecret && authSecret.length >= 32,
    notes: !authSecret
      ? "MISSING"
      : authSecret.length >= 32
      ? "Present (Length >= 32 chars)"
      : "Warning: Length < 32 chars (recommended 32+)",
  });

  // 2. AUTH_EMAIL
  const authEmail = env.AUTH_EMAIL;
  results.push({
    key: "AUTH_EMAIL",
    present: !!authEmail,
    validFormat: !!authEmail && EMAIL_REGEX.test(authEmail),
    notes: !authEmail
      ? "MISSING"
      : EMAIL_REGEX.test(authEmail)
      ? "Present (Valid email syntax)"
      : "Invalid email syntax",
  });

  // 3. AUTH_PASSWORD_HASH
  const rawHash = env.AUTH_PASSWORD_HASH;
  const isBcrypt = !!rawHash && BCRYPT_REGEX.test(rawHash);
  results.push({
    key: "AUTH_PASSWORD_HASH",
    present: !!rawHash && rawHash.length > 0,
    validFormat: isBcrypt,
    notes: !rawHash
      ? "MISSING"
      : isBcrypt
      ? "Present (Valid 60-char $2a/$2b bcrypt format)"
      : `Invalid format: length=${rawHash ? rawHash.length : 0}`,
  });

  // 4. CRON_SECRET
  const cronSecret = env.CRON_SECRET;
  results.push({
    key: "CRON_SECRET",
    present: !!cronSecret,
    validFormat: !!cronSecret && cronSecret.length >= 16,
    notes: !cronSecret
      ? "MISSING"
      : cronSecret.length >= 16
      ? "Present (Length >= 16 chars)"
      : "Warning: Length < 16 chars (recommended 16+)",
  });

  // 5. MONGODB_URI
  const mongoUri = env.MONGODB_URI;
  results.push({
    key: "MONGODB_URI",
    present: !!mongoUri,
    validFormat: !!mongoUri && MONGO_REGEX.test(mongoUri),
    notes: !mongoUri
      ? "MISSING"
      : MONGO_REGEX.test(mongoUri)
      ? "Present (Valid mongodb:// or mongodb+srv:// scheme)"
      : "Invalid connection scheme",
  });

  return results;
}
