import { NextResponse } from "next/server";
import { verifyCredentials, AUTHORIZED_USER, AUTH_COOKIE_NAME } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password } = body;

    if (!verifyCredentials(email, password)) {
      return NextResponse.json(
        { success: false, error: "Invalid email or password. Access restricted to authorized quantitative accounts." },
        { status: 401 }
      );
    }

    const sessionPayload = {
      ...AUTHORIZED_USER,
      authenticatedAt: Date.now(),
    };

    const response = NextResponse.json({
      success: true,
      user: sessionPayload,
      message: "Authentication successful. Welcome, Anshul Parate.",
    });

    // Set secure session cookie
    response.cookies.set({
      name: AUTH_COOKIE_NAME,
      value: JSON.stringify(sessionPayload),
      httpOnly: false, // Accessible to client context
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 days session
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
