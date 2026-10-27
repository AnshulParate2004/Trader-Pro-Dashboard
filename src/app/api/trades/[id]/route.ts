import { NextResponse } from "next/server";
import { closeTrade } from "@/lib/tradingEngine";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const tradeId = params.id;
    const body = await req.json();
    const { exitPrice, reason } = body;

    if (!exitPrice) {
      return NextResponse.json(
        { success: false, error: "Missing exitPrice" },
        { status: 400 }
      );
    }

    const updatedTrade = await closeTrade(
      tradeId,
      Number(exitPrice),
      reason || "Manual Close"
    );

    if (!updatedTrade) {
      return NextResponse.json(
        { success: false, error: "Trade not found or already closed" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      trade: updatedTrade,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
