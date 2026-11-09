import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getDb } from "@/lib/mongodb";
import { resetMemoryState } from "@/lib/tradingEngine";
import { AUTH_COOKIE_NAME, verifySessionToken } from "@/lib/auth";

export async function POST() {
  try {
    // Defense-in-depth: Require verified signed admin session
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(AUTH_COOKIE_NAME)?.value;
    const user = sessionCookie ? await verifySessionToken(sessionCookie) : null;

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized: Admin session required to reset trading engine state." },
        { status: 401 }
      );
    }

    resetMemoryState();
    const db = await getDb();
    if (db) {
      await db.collection("trade_logs").deleteMany({});
      await db.collection("engine_config").deleteMany({});
    }

    return NextResponse.json({
      success: true,
      message: "Capital reset to ₹1,000 and trade execution logs cleared successfully.",
      capitalINR: 1000,
      clearedBy: user.email,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
