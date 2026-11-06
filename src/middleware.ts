import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose/jwt/verify";

const AUTH_COOKIE_NAME = "trader_pro_session";

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

async function verifyToken(token: string): Promise<boolean> {
  try {
    await jwtVerify(token, getAuthSecret());
    return true;
  } catch {
    return false;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. Allow completely public static routes and landing page
  if (
    pathname === "/" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/auth/")
  ) {
    return NextResponse.next();
  }

  // Check signed session cookie
  const sessionCookie = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  const isAuthenticated = sessionCookie ? await verifyToken(sessionCookie) : false;

  // 2. Cron endpoints (/api/cron/*): Require CRON_SECRET or valid admin session
  if (pathname.startsWith("/api/cron/")) {
    const authHeader = req.headers.get("authorization");
    const cronSecretHeader = req.headers.get("x-cron-secret");
    const configuredSecret = process.env.CRON_SECRET;

    if (!configuredSecret && process.env.NODE_ENV === "production") {
      throw new Error(
        "CRITICAL SECURITY CONFIGURATION ERROR: CRON_SECRET environment variable is missing in production."
      );
    }

    // Check if matching secret provided in Authorization or x-cron-secret header
    const hasValidCronSecret =
      configuredSecret &&
      (authHeader === `Bearer ${configuredSecret}` || cronSecretHeader === configuredSecret);

    if (hasValidCronSecret || isAuthenticated) {
      return NextResponse.next();
    }

    return NextResponse.json(
      {
        success: false,
        error: "Unauthorized: Invalid or missing CRON_SECRET authorization header.",
      },
      { status: 401 }
    );
  }

  // 3. Protected API Routes: Require valid signed session
  if (pathname.startsWith("/api/")) {
    if (!isAuthenticated) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized: Access restricted to authenticated quantitative accounts.",
        },
        { status: 401 }
      );
    }
    return NextResponse.next();
  }

  // 4. Protected UI Pages (/terminal, /ai-engine): Redirect unauthenticated users to /login
  if (pathname.startsWith("/terminal") || pathname.startsWith("/ai-engine")) {
    if (!isAuthenticated) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("from", pathname);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - fonts (font files)
     * - public assets with extensions
     */
    "/((?!_next/static|_next/image|favicon.ico|fonts|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2|woff|ttf|otf)$).*)",
  ],
};
