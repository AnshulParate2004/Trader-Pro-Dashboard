import { NextResponse } from "next/server";
import { getMultiLedgerStatus, runMultiLedgerExecutor, LEDGER_DEFINITIONS } from "@/lib/paperExecutor4HMultiLedger";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const status = await getMultiLedgerStatus();
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      forward_cutoff: "2026-10-31T00:00:00.000Z",
      ledgers: status,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to fetch ledger status" },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    const results = await runMultiLedgerExecutor();
    const status = await getMultiLedgerStatus();
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      execution: results,
      ledgers: status,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to trigger multi-ledger execution" },
      { status: 500 }
    );
  }
}
