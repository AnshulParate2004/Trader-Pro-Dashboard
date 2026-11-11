import { NextResponse } from "next/server";
import { getRouterLiveEvaluations } from "@/lib/routerLiveEvaluator";
import { getNyseSessionStatus } from "@/lib/nyseCalendar";

export const dynamic = "force-dynamic";

let last4HExecutionBar = "";
let last1HExecutionBar = "";
let lastEquitiesCloseDate = "";
let lastEquitiesOpenDate = "";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const force = searchParams.get("force") === "true";

    // 1. Live Router Predictions Evaluation (Runs every 2 minutes)
    const logs = await getRouterLiveEvaluations(force);

    const now = new Date();
    const utcHours = now.getUTCHours();
    const utcMinutes = now.getUTCMinutes();

    // 2. 4H Multi-Ledger Forward Trigger Guard (v1 primary, v6 shadow, v8 shadow)
    // Synchronously evaluates fixed-rule 4H ledgers at 4H candle boundaries (00, 04, 08, 12, 16, 20 UTC)
    let multiLedgerResult = null;
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

    // 3. 1H Paper A Forward Trigger Guard
    // Evaluates 1H Paper A ledger at 1H candle boundaries (e.g. minute 0-6 of every hour)
    let paper1HResult = null;
    const is1HBoundary = utcMinutes <= 6;
    const current1HBarKey = `${now.toISOString().slice(0, 10)}_H${utcHours}`;

    if ((is1HBoundary && last1HExecutionBar !== current1HBarKey) || searchParams.get("sync_1h") === "true") {
      try {
        last1HExecutionBar = current1HBarKey;
        const { runPaper1HAExecutor } = await import("@/lib/paperExecutor1HA");
        paper1HResult = await runPaper1HAExecutor();
      } catch (paper1HErr) {
        console.warn("Auto 1H paper-1h-a execution warning:", paper1HErr);
      }
    }

    // 4. US Equities Forward Scheduler Trigger Guard (S2 Momentum Shadow)
    // Runs twice per trading day:
    // (i)  POST-CLOSE: after NYSE close (16:05–17:00 ET, or 13:05–14:00 ET on half days) -> compute signals
    // (ii) POST-OPEN:  after NYSE open (09:35–10:30 ET) -> execute fills at market open price
    let equitiesResult = null;
    try {
      const nyseSession = getNyseSessionStatus(now);
      const syncEquitiesParam = searchParams.get("sync_equities");

      if (syncEquitiesParam === "close" || syncEquitiesParam === "open") {
        const { runEquitiesEvaluation } = await import("@/lib/equitiesExecutor");
        equitiesResult = await runEquitiesEvaluation(syncEquitiesParam);
      } else if (nyseSession.isTradingDay) {
        const [etHour, etMinute] = nyseSession.currentTimeET.split(":").map(Number);
        const etMinutesTotal = etHour * 60 + etMinute;
        const scheduledCloseMinutes = nyseSession.isEarlyClose ? 13 * 60 : 16 * 60;

        // Post-close window: between scheduled close and +60 minutes
        if (
          nyseSession.marketPhase === "POST_CLOSE" &&
          etMinutesTotal >= scheduledCloseMinutes &&
          etMinutesTotal <= scheduledCloseMinutes + 60 &&
          lastEquitiesCloseDate !== nyseSession.sessionDate
        ) {
          lastEquitiesCloseDate = nyseSession.sessionDate;
          const { runEquitiesEvaluation } = await import("@/lib/equitiesExecutor");
          equitiesResult = await runEquitiesEvaluation("close");
        }
        // Post-open window: between 09:35 and 10:30 ET
        else if (
          nyseSession.marketPhase === "REGULAR_HOURS" &&
          etMinutesTotal >= 9 * 60 + 35 &&
          etMinutesTotal <= 10 * 60 + 30 &&
          lastEquitiesOpenDate !== nyseSession.sessionDate
        ) {
          lastEquitiesOpenDate = nyseSession.sessionDate;
          const { runEquitiesEvaluation } = await import("@/lib/equitiesExecutor");
          equitiesResult = await runEquitiesEvaluation("open");
        }
      }
    } catch (eqErr) {
      console.warn("Auto US equities execution warning:", eqErr);
    }

    return NextResponse.json({
      success: true,
      trigger: "programmatic_2min_loop",
      evaluated_at: new Date().toISOString(),
      count: logs.length,
      logs,
      multiLedgerExecuted: multiLedgerResult !== null,
      paper1HExecuted: paper1HResult !== null,
      equitiesExecuted: equitiesResult !== null,
      paper1HResult,
      multiLedgerResult,
      equitiesResult,
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
