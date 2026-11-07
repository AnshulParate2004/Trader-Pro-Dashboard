import { NextResponse } from "next/server";
import { runPaper1HCostExecutor } from "@/lib/paperExecutor1HCost";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await runPaper1HCostExecutor();
    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
