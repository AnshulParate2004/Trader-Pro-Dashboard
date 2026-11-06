import { SignJWT } from "jose/jwt/sign";
import { jwtVerify } from "jose/jwt/verify";
import bcrypt from "bcryptjs";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
  avatarUrl?: string;
  authenticatedAt: number;
}

export const AUTH_COOKIE_NAME = "trader_pro_session";

function getAuthSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET || process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "CRITICAL SECURITY CONFIGURATION ERROR: AUTH_SECRET environment variable is missing in production."
      );
    }
    throw new Error(
      "AUTH_SECRET is required. Please define AUTH_SECRET in your .env.local file for local development."
    );
  }
  return new TextEncoder().encode(secret);
}

// Generate signed JWT session token (HS256, 30 days)
export async function createSessionToken(user: AuthUser): Promise<string> {
  return await new SignJWT({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    avatarUrl: user.avatarUrl,
    authenticatedAt: user.authenticatedAt,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(getAuthSecret());
}

// Verify signed JWT session token
export async function verifySessionToken(token: string): Promise<AuthUser | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getAuthSecret());
    return {
      id: String(payload.id || payload.sub || "usr_anshul_01"),
      name: String(payload.name || "Anshul Parate"),
      email: String(payload.email || "anshulnparate@gmail.com"),
      role: String(payload.role || "Lead Quantitative Trader"),
      avatarUrl: payload.avatarUrl ? String(payload.avatarUrl) : undefined,
      authenticatedAt: Number(payload.authenticatedAt || Date.now()),
    };
  } catch {
    return null;
  }
}

// Verified master credentials validation (No plaintext passwords hardcoded in repository)
export async function verifyCredentials(email?: string, password?: string): Promise<boolean> {
  if (!email || !password) return false;

  const targetEmail = (process.env.AUTH_EMAIL || "anshulnparate@gmail.com").trim().toLowerCase();
  const inputEmail = email.trim().toLowerCase();
  if (inputEmail !== targetEmail) return false;

  const inputPass = password.trim();

  // 1. If explicit bcrypt hash is configured in environment (Highest security)
  const hashFromEnv = process.env.AUTH_PASSWORD_HASH;
  if (hashFromEnv) {
    try {
      return bcrypt.compareSync(inputPass, hashFromEnv);
    } catch (e) {
      console.error("Error comparing AUTH_PASSWORD_HASH:", e);
      return false;
    }
  }

  // 2. If raw password is configured in environment
  const plainFromEnv = process.env.AUTH_PASSWORD;
  if (plainFromEnv) {
    return inputPass === plainFromEnv;
  }

  // In production, require either AUTH_PASSWORD_HASH or AUTH_PASSWORD to be defined
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "CRITICAL SECURITY CONFIGURATION ERROR: AUTH_PASSWORD_HASH (or AUTH_PASSWORD) environment variable is missing in production."
    );
  }

  throw new Error(
    "AUTH_PASSWORD_HASH or AUTH_PASSWORD is required. Please define AUTH_PASSWORD_HASH in .env.local for local development."
  );
}
