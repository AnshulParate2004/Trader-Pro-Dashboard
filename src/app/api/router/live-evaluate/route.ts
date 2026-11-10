import { NextResponse } from "next/server";
import { getRouterLiveEvaluations } from "@/lib/routerLiveEvaluator";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const force = searchParams.get("force") === "true";
    const logs = await getRouterLiveEvaluations(force);

    return NextResponse.json({
      success: true,
      trigger: "programmatic_2min_loop",
      evaluated_at: new Date().toISOString(),
      count: logs.length,
      logs,
    });
  } catch (err: any) {
    console.error("Live router evaluation API error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to evaluate live router predictions" },
      { status: 500 }
    );
  }
}
