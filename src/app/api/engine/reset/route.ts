import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { resetMemoryState } from "@/lib/tradingEngine";

export async function POST() {
  try {
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
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
