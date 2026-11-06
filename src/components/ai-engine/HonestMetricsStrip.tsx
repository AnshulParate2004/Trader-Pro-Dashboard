"use client";

import React from "react";
import { EnginePerformanceMetrics } from "@/lib/engineTypes";
import { Activity, Percent, ArrowUpRight, ArrowDownRight, Coins } from "lucide-react";

interface HonestMetricsStripProps {
  metrics: EnginePerformanceMetrics | null;
  isTaker: boolean;
  feePercent: number;
}

export const HonestMetricsStrip: React.FC<HonestMetricsStripProps> = ({
  metrics,
  isTaker,
  feePercent,
}) => {
  const feeBadge = (
    <span
      className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded border font-semibold ${
        isTaker
          ? "bg-accent-tint text-accent border-accent/30"
          : "bg-blue-50 text-chrome-dim border-blue-200"
      }`}
    >
      {isTaker ? "Taker" : "Maker"}
    </span>
  );

  const totalCostINR = (metrics?.totalFeesPaidINR ?? 0) + (metrics?.slippagePaidINR ?? 0);
  const displayBalance = metrics?.currentBalanceINR ?? 1000;

  return (
    <section
      aria-label="Honest Performance Metrics Strip"
      className="w-full flex flex-col gap-3"
    >
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-chrome-line pb-2">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-accent" />
          <h2 className="font-brand text-sm font-medium tracking-tight text-chrome-ink uppercase">
            Honest Performance Metrics Strip
          </h2>
          <span
            className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
              isTaker
                ? "bg-accent-tint text-accent border-accent/30"
                : "bg-blue-50 text-chrome-dim border-blue-200"
            }`}
          >
            Mode: {isTaker ? `Taker (${feePercent.toFixed(3)}% + GST + Slippage)` : "Maker (0.016% Optimistic)"}
          </span>
        </div>
        <span className="font-mono text-xs text-chrome-dim">
          {metrics?.closedTradesCount ?? 0} Closed Scalps Evaluated
        </span>
      </div>

      {/* Grid of 6 Cards: Consistent, Clean, Monospace Numbers */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        
        {/* 1. True Win Rate */}
        <div className="bg-white border border-chrome-line rounded-lg p-3.5 flex flex-col justify-between shadow-xs transition-shadow hover:shadow-sm">
          <div className="flex items-center justify-between gap-1">
            <span className="font-mono text-[10px] text-chrome-dim uppercase font-bold tracking-wider">
              True Win Rate
            </span>
            {feeBadge}
          </div>
          <div className="font-mono text-2xl font-bold text-chrome-ink mt-2">
            {metrics?.trueWinRate !== undefined ? metrics.trueWinRate : 0.0}%
          </div>
          <div className="font-mono text-[10px] text-chrome-dim mt-1 truncate" title={`TP / (TP + SL) = ${metrics?.tpCount ?? 0} / ${(metrics?.tpCount ?? 0) + (metrics?.slCount ?? 0)}`}>
            TP/(TP+SL) = {metrics?.tpCount ?? 0}/{(metrics?.tpCount ?? 0) + (metrics?.slCount ?? 0)}
          </div>
        </div>

        {/* 2. Net Win Rate */}
        <div className="bg-white border border-chrome-line rounded-lg p-3.5 flex flex-col justify-between shadow-xs transition-shadow hover:shadow-sm">
          <div className="flex items-center justify-between gap-1">
            <span className="font-mono text-[10px] text-chrome-dim uppercase font-bold tracking-wider">
              Net Win Rate
            </span>
            {feeBadge}
          </div>
          <div
            className={`font-mono text-2xl font-bold mt-2 ${
              (metrics?.netWinRate ?? 0) >= 40 ? "text-win" : "text-loss"
            }`}
          >
            {metrics?.netWinRate !== undefined ? metrics.netWinRate : 0.0}%
          </div>
          <div className="font-mono text-[10px] text-chrome-dim mt-1 truncate" title={`Net PnL > 0 (${metrics?.winningTrades ?? 0} / ${metrics?.closedTradesCount ?? 0} trades)`}>
            Net &gt; 0 ({metrics?.winningTrades ?? 0}/{metrics?.closedTradesCount ?? 0})
          </div>
        </div>

        {/* 3. TP / BE / SL Split */}
        <div className="bg-white border border-chrome-line rounded-lg p-3.5 flex flex-col justify-between shadow-xs transition-shadow hover:shadow-sm">
          <div className="flex items-center justify-between gap-1">
            <span className="font-mono text-[10px] text-chrome-dim uppercase font-bold tracking-wider">
              TP/BE/SL Split
            </span>
            {feeBadge}
          </div>
          <div className="font-mono text-base sm:text-lg font-bold text-chrome-ink mt-2 whitespace-nowrap">
            {metrics?.tpPercent ?? 0}% / {metrics?.bePercent ?? 0}% / {metrics?.slPercent ?? 0}%
          </div>
          <div className="font-mono text-[10px] text-chrome-dim mt-1 truncate" title={`${metrics?.tpCount ?? 0} TP · ${metrics?.beCount ?? 0} BE · ${metrics?.slCount ?? 0} SL`}>
            {metrics?.tpCount ?? 0} TP · {metrics?.beCount ?? 0} BE · {metrics?.slCount ?? 0} SL
          </div>
        </div>

        {/* 4. Net Profit Factor */}
        <div className="bg-white border border-chrome-line rounded-lg p-3.5 flex flex-col justify-between shadow-xs transition-shadow hover:shadow-sm">
          <div className="flex items-center justify-between gap-1">
            <span className="font-mono text-[10px] text-chrome-dim uppercase font-bold tracking-wider">
              Net Profit Factor
            </span>
            {feeBadge}
          </div>
          <div
            className={`font-mono text-2xl font-bold mt-2 ${
              (metrics?.netProfitFactor ?? 0) >= 1 ? "text-win" : "text-chrome-ink"
            }`}
          >
            {metrics?.netProfitFactor !== undefined ? metrics.netProfitFactor : 0.0}
          </div>
          <div className="font-mono text-[10px] text-chrome-dim mt-1 truncate">
            Gross PF: {metrics?.profitFactor !== undefined ? metrics.profitFactor : 0.0}
          </div>
        </div>

        {/* 5. Fees Paid & Slippage */}
        <div className="bg-white border border-chrome-line rounded-lg p-3.5 flex flex-col justify-between shadow-xs transition-shadow hover:shadow-sm">
          <div className="flex items-center justify-between gap-1">
            <span className="font-mono text-[10px] text-chrome-dim uppercase font-bold tracking-wider">
              Total Fees Paid
            </span>
            {feeBadge}
          </div>
          <div className="font-mono text-2xl font-bold text-accent mt-2">
            ₹{totalCostINR.toFixed(2)}
          </div>
          <div className="font-mono text-[10px] text-chrome-dim mt-1 truncate" title={`Exch: ₹${metrics?.totalFeesPaidINR?.toFixed(2) ?? "0.00"} · Slip: ₹${metrics?.slippagePaidINR?.toFixed(2) ?? "0.00"}`}>
            Fee: ₹{metrics?.totalFeesPaidINR?.toFixed(1) ?? "0"} · Slip: ₹{metrics?.slippagePaidINR?.toFixed(1) ?? "0"}
          </div>
        </div>

        {/* 6. Virtual Balance */}
        <div className="bg-white border border-chrome-line rounded-lg p-3.5 flex flex-col justify-between shadow-xs transition-shadow hover:shadow-sm">
          <div className="flex items-center justify-between gap-1">
            <span className="font-mono text-[10px] text-chrome-dim uppercase font-bold tracking-wider">
              Account Balance
            </span>
            {feeBadge}
          </div>
          <div className="font-mono text-2xl font-bold text-chrome-ink mt-2">
            ₹{displayBalance.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="font-mono text-[10px] text-chrome-dim mt-1 truncate">
            Start Capital: ₹1,000.00
          </div>
        </div>

      </div>
    </section>
  );
};

export default HonestMetricsStrip;
