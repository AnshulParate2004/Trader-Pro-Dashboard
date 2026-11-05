import { NextResponse } from "next/server";
import { runPaper1HAExecutor } from "@/lib/paperExecutor1HA";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await runPaper1HAExecutor();
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
