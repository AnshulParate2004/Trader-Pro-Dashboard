import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * 15M Scalper Deprecation Notice:
 * The high-frequency 5M/15M intraday scalping engines have been formally decommissioned
 * due to fatal fee drag (cost_R > 0.45R). Active autonomous trading has migrated to
 * the 4-Hour (4H) Swing Meta-Labeling Engine (/api/cron/paper-4h-swing).
 */
export async function GET() {
  return NextResponse.json({
    success: false,
    status: "DEPRECATED",
    message:
      "15M Scalper retired due to fee friction. Active engine: /api/cron/paper-4h-swing.",
  });
}
