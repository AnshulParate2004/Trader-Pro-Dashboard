import { NextResponse } from "next/server";
import { verifyCredentials, createSessionToken, AUTH_COOKIE_NAME, AuthUser } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password } = body;

    const isValid = await verifyCredentials(email, password);
    if (!isValid) {
      return NextResponse.json(
        { success: false, error: "Invalid email or password. Access restricted to authorized quantitative accounts." },
        { status: 401 }
      );
    }

    const cleanEmail = (email || "anshulnparate@gmail.com").trim().toLowerCase();
    const authorizedUser: AuthUser = {
      id: "usr_anshul_01",
      name: "Anshul Parate",
      email: cleanEmail,
      role: "Lead Quantitative Trader",
      avatarUrl: "https://api.dicebear.com/7.x/bottts/svg?seed=Anshul",
      authenticatedAt: Date.now(),
    };

    const sessionJwt = await createSessionToken(authorizedUser);

    const response = NextResponse.json({
      success: true,
      user: authorizedUser,
      message: "Authentication successful. Welcome, Anshul Parate.",
    });

    // Set secure HTTP-only signed session cookie (cannot be forged or read by malicious JS)
    response.cookies.set({
      name: AUTH_COOKIE_NAME,
      value: sessionJwt,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 days
      sameSite: "lax",
    });

    return response;
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
