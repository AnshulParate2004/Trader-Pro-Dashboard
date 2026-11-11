import { NextResponse } from "next/server";
import { getRouterLiveEvaluations } from "@/lib/routerLiveEvaluator";

export const dynamic = "force-dynamic";

let last4HExecutionBar = "";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const force = searchParams.get("force") === "true";
    const logs = await getRouterLiveEvaluations(force);

    // 4H Multi-Ledger forward trigger guard (v1 primary, v6 shadow, v8 shadow)
    // Synchronously evaluates fixed-rule 4H ledgers at 4H candle boundaries (00, 04, 08, 12, 16, 20 UTC)
    let multiLedgerResult = null;
    const now = new Date();
    const utcHours = now.getUTCHours();
    const utcMinutes = now.getUTCMinutes();
    const is4HBoundary = utcHours % 4 === 0 && utcMinutes <= 6;
    const current4HBarKey = `${now.toISOString().slice(0, 10)}_H${Math.floor(utcHours / 4) * 4}`;

    if ((is4HBoundary && last4HExecutionBar !== current4HBarKey) || searchParams.get("sync_4h") === "true") {
      try {
        last4HExecutionBar = current4HBarKey;
        const { runMultiLedgerExecutor } = await import("@/lib/paperExecutor4HMultiLedger");
        multiLedgerResult = await runMultiLedgerExecutor();
      } catch (multiErr) {
        console.warn("Auto 4H multi-ledger execution warning:", multiErr);
      }
    }

    return NextResponse.json({
      success: true,
      trigger: "programmatic_2min_loop",
      evaluated_at: new Date().toISOString(),
      count: logs.length,
      logs,
      multiLedgerExecuted: multiLedgerResult !== null,
    });
  } catch (err: any) {
    console.error("Live router evaluation API error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to evaluate live router predictions" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  return GET(req);
}
