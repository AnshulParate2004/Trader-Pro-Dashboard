import { NextResponse } from "next/server";
import { runMultiLedgerExecutor, getMultiLedgerStatus } from "@/lib/paperExecutor4HMultiLedger";
import { runPaper4HFixedExecutor } from "@/lib/paperExecutor4HFixed";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  // 1. Verify Bearer authorization token if CRON_SECRET is configured
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { success: false, error: "Unauthorized: Invalid or missing CRON_SECRET bearer token." },
      { status: 401 }
    );
  }

  try {
    // Run the legacy primary runner
    const legacyResult = await runPaper4HFixedExecutor();

    // Run the 3-Ledger forward test suite (v1 primary, v6 shadow, v8 shadow)
    const multiResults = await runMultiLedgerExecutor();
    const status = await getMultiLedgerStatus();

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      legacy_v1_primary: legacyResult,
      forward_ledgers: multiResults,
      forward_status: status,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        timestamp: new Date().toISOString(),
        error: error.message || "Failed to execute 4H fixed-rule multi-ledger trading loop",
      },
      { status: 500 }
    );
  }
}
