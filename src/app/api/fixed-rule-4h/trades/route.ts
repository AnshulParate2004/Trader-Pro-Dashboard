import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const format = searchParams.get("format") || "json";

  const candidatePaths = [
    path.resolve(process.cwd(), "experiments/fixed_rule_4h_v2/trades_fixed_rule_4h.csv"),
    path.resolve(process.cwd(), "Trader-Pro-Dashboard/experiments/fixed_rule_4h_v2/trades_fixed_rule_4h.csv"),
    path.resolve(process.cwd(), "data/trades_fixed_rule_4h.csv"),
  ];

  let csvContent = "";
  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      csvContent = fs.readFileSync(p, "utf-8");
      break;
    }
  }

  if (!csvContent) {
    return NextResponse.json(
      { success: false, error: "Historical reference CSV trade log not found on server." },
      { status: 404 }
    );
  }

  // If CSV download requested
  if (format === "csv") {
    return new Response(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="trades_fixed_rule_4h.csv"',
      },
    });
  }

  // Parse CSV into structured JSON for frontend components
  const lines = csvContent.trim().split("\n");
  if (lines.length < 2) {
    return NextResponse.json({ success: true, trades: [], summary: null });
  }

  const headers = lines[0].split(",").map((h) => h.trim());
  const trades = [];

  let cumulativePnL = 0;
  let capital = 7000.0;
  let peak = capital;
  let maxDDInr = 0;
  let maxDDPct = 0;
  const equityPoints = [{ index: 0, date: "2020-01-01", equity: 7000.0, pnl: 0, drawdown: 0 }];

  let grossGains = 0;
  let grossLosses = 0;
  let tpCount = 0;
  let slCount = 0;
  let timeCount = 0;

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim());
    if (cols.length < headers.length) continue;

    const row: Record<string, any> = {};
    headers.forEach((h, idx) => {
      row[h] = cols[idx];
    });

    const netR = parseFloat(row["net_r"] || "0");
    const grossR = parseFloat(row["gross_r"] || "0");
    const riskInr = parseFloat(row["risk_inr"] || "70");
    const pnl = netR * riskInr;
    cumulativePnL += pnl;
    capital += pnl;

    if (capital > peak) peak = capital;
    const currentDD = peak - capital;
    const currentDDPct = (currentDD / peak) * 100;
    if (currentDD > maxDDInr) maxDDInr = currentDD;
    if (currentDDPct > maxDDPct) maxDDPct = currentDDPct;

    if (pnl > 0) grossGains += pnl;
    else grossLosses += Math.abs(pnl);

    const exitType = row["exit_type"];
    if (exitType === "STOP") slCount++;
    else if (exitType === "TRAIL") tpCount++;
    else if (exitType === "TIME") timeCount++;

    equityPoints.push({
      index: i,
      date: row["exit_time"] || row["entry_time"],
      equity: Number(capital.toFixed(2)),
      pnl: Number(pnl.toFixed(2)),
      drawdown: Number(currentDD.toFixed(2)),
    });

    trades.push({
      ...row,
      entry_price: parseFloat(row["entry_price"]),
      stop_pct: parseFloat(row["stop_pct"]),
      risk_inr: riskInr,
      gross_r: grossR,
      fee_r: parseFloat(row["fee_r"] || "0"),
      funding_r: parseFloat(row["funding_r"] || "0"),
      net_r: netR,
      net_pnl_inr: Number(pnl.toFixed(2)),
      clamped_flag: row["clamped_flag"] === "True" || row["clamped_flag"] === "true",
    });
  }

  // Indian Section 115BBH 30% Flat Tax calculation (No loss set-off)
  const tax30 = grossGains * 0.30;
  const afterTaxPnL = cumulativePnL - tax30;

  // Section 194S 1% TDS Turnover impact
  const totalTdsTurnover = trades.reduce((acc, t) => acc + (t.risk_inr / t.stop_pct) * 0.01, 0);

  const wins = trades.filter((t) => t.net_r > 0).length;
  const winRate = trades.length > 0 ? (wins / trades.length) * 100 : 0;
  const pf = grossLosses > 0 ? grossGains / grossLosses : 99.0;
  const meanNetR = trades.length > 0 ? trades.reduce((acc, t) => acc + t.net_r, 0) / trades.length : 0;

  const summary = {
    totalTrades: trades.length,
    wins,
    losses: trades.length - wins,
    winRate: Number(winRate.toFixed(1)),
    profitFactor: Number(pf.toFixed(2)),
    meanNetR: Number(meanNetR.toFixed(4)),
    bootstrapCI95: [-0.0283, 0.4052],
    preTaxPnLINR: Number(cumulativePnL.toFixed(2)),
    grossGainsINR: Number(grossGains.toFixed(2)),
    tax30INR: Number(tax30.toFixed(2)),
    afterTaxPnLINR: Number(afterTaxPnL.toFixed(2)),
    tdsTurnoverINR: Number(totalTdsTurnover.toFixed(2)),
    maxDrawdownINR: Number(maxDDInr.toFixed(2)),
    maxDrawdownPct: Number(maxDDPct.toFixed(2)),
    exitDistribution: {
      stop: { count: slCount, pct: Number(((slCount / trades.length) * 100).toFixed(1)) },
      trail: { count: tpCount, pct: Number(((tpCount / trades.length) * 100).toFixed(1)) },
      time: { count: timeCount, pct: Number(((timeCount / trades.length) * 100).toFixed(1)) },
    },
    forwardTestStartDate: "2026-10-31",
    startingCapitalINR: 7000.0,
    riskPerTradeINR: 70.0,
    openRiskCapINR: 140.0,
    openRiskCapPct: 2.0,
  };

  return NextResponse.json({
    success: true,
    summary,
    equityPoints,
    trades,
  });
}
