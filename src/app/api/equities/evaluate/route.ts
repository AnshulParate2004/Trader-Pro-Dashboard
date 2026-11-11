import { NextResponse } from "next/server";
import { runEquitiesEvaluation } from "@/lib/equitiesExecutor";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return handleEvaluation(req);
}

export async function GET(req: Request) {
  return handleEvaluation(req);
}

async function handleEvaluation(req: Request) {
  try {
    const url = new URL(req.url);

    // 1. Strict Security Guard: Secrets via HEADERS ONLY. Reject query string secrets.
    if (url.searchParams.has("secret") || url.searchParams.has("token")) {
      return NextResponse.json(
        {
          success: false,
          error: "SECURITY VIOLATION: Query string secrets are strictly forbidden. Pass secret via Authorization: Bearer <secret> or x-cron-secret header.",
        },
        { status: 403 }
      );
    }

    const authHeader = req.headers.get("authorization");
    const cronSecretHeader = req.headers.get("x-cron-secret");
    const configuredSecret = process.env.CRON_SECRET;

    const hasValidHeader =
      configuredSecret &&
      (authHeader === `Bearer ${configuredSecret}` || cronSecretHeader === configuredSecret);

    // If no cron secret in header, check if running in non-production local development
    if (!hasValidHeader && process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { success: false, error: "Unauthorized: Missing or invalid CRON_SECRET header." },
        { status: 401 }
      );
    }

    // 2. Determine Step ("close" or "open")
    let requestedStep = (req.headers.get("x-step") || url.searchParams.get("step")) as "close" | "open" | null;
    if (!requestedStep && req.method === "POST") {
      try {
        const body = await req.json();
        requestedStep = body?.step;
      } catch (_) {
        // body optional
      }
    }

    const result = await runEquitiesEvaluation(requestedStep || undefined);
    const status = result.success ? 200 : 400;
    return NextResponse.json(result, { status });
  } catch (err: any) {
    console.error("US Equities evaluate route error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to execute equities evaluation" },
      { status: 500 }
    );
  }
}
