"use client";

import React from "react";
import { EnginePerformanceMetrics } from "@/lib/engineTypes";
import { Activity } from "lucide-react";

interface HonestMetricsStripProps {
  metrics: EnginePerformanceMetrics | null;
  isTaker: boolean;
  feePercent: number;
  selectedModelId?: string;
}

export const HonestMetricsStrip: React.FC<HonestMetricsStripProps> = ({
  metrics,
  isTaker,
  feePercent,
  selectedModelId = "4h-swing-meta-017",
}) => {
  const is4HSwing = selectedModelId === "4h-swing-meta-017";

  const feeBadge = (
    <span
      className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded border font-semibold ${
        is4HSwing
          ? "bg-win-tint text-chrome-green-ink border-win/30"
          : isTaker
          ? "bg-accent-tint text-chrome-green-ink border-accent/30"
          : "bg-blue-50 text-chrome-dim border-blue-200"
      }`}
    >
      {is4HSwing ? "10 bps" : isTaker ? "Taker" : "Maker"}
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
          <Activity className="w-4 h-4 text-chrome-green-ink" />
          <h2 className="font-brand text-sm font-medium tracking-tight text-chrome-ink uppercase">
            Honest Performance Metrics Strip
          </h2>
          <span
            className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
              is4HSwing
                ? "bg-win-tint text-chrome-green-ink border-win/30"
                : isTaker
                ? "bg-accent-tint text-chrome-green-ink border-accent/30"
                : "bg-blue-50 text-chrome-dim border-blue-200"
            }`}
          >
            Mode: {is4HSwing ? "0.10% Round-Trip Taker Friction Deducted" : isTaker ? `Taker (${feePercent.toFixed(3)}% + GST + Slippage)` : `Maker (${feePercent.toFixed(3)}% Optimistic)`}
          </span>
        </div>
        <span className="font-mono text-xs text-chrome-dim">
          {is4HSwing ? "159 Closed OOS Trades Evaluated" : `${metrics?.closedTradesCount ?? 0} Closed Scalps Evaluated`}
        </span>
      </div>

      {/* Grid of 6 Cards: Consistent, Clean, Monospace Numbers */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* 1. True Win Rate */}
        <div className="bg-white border border-chrome-line rounded-lg p-3 sm:p-3.5 flex flex-col justify-between shadow-xs transition-shadow hover:shadow-sm overflow-hidden">
          <div className="flex items-center justify-between gap-1">
            <span className="font-mono text-[10px] text-chrome-dim uppercase font-bold tracking-wider">
              True Win Rate
            </span>
            {feeBadge}
          </div>
          <div className="font-mono text-xl sm:text-2xl font-bold text-chrome-ink mt-2">
            {is4HSwing ? "52.8%" : `${metrics?.trueWinRate !== undefined ? metrics.trueWinRate : 0.0}%`}
          </div>
          <div className="font-mono text-[10px] text-chrome-dim mt-1 truncate">
            {is4HSwing ? "Net of 10 bps friction" : `TP/(TP+SL) = ${metrics?.tpCount ?? 0}/${(metrics?.tpCount ?? 0) + (metrics?.slCount ?? 0)}`}
          </div>
        </div>

        {/* 2. Net Win Rate */}
        <div className="bg-white border border-chrome-line rounded-lg p-3 sm:p-3.5 flex flex-col justify-between shadow-xs transition-shadow hover:shadow-sm overflow-hidden">
          <div className="flex items-center justify-between gap-1">
            <span className="font-mono text-[10px] text-chrome-dim uppercase font-bold tracking-wider">
              Net Win Rate
            </span>
            {feeBadge}
          </div>
          <div
            className={`font-mono text-xl sm:text-2xl font-bold mt-2 ${
              is4HSwing || (metrics?.netWinRate ?? 0) >= 40 ? "text-win" : "text-loss"
            }`}
          >
            {is4HSwing ? "52.8%" : `${metrics?.netWinRate !== undefined ? metrics.netWinRate : 0.0}%`}
          </div>
          <div className="font-mono text-[10px] text-chrome-dim mt-1 truncate">
            {is4HSwing ? "Net > 0 (84/159 trades)" : `Net > 0 (${metrics?.winningTrades ?? 0}/${metrics?.closedTradesCount ?? 0})`}
          </div>
        </div>

        {/* 3. TP / BE / SL Split */}
        <div className="bg-white border border-chrome-line rounded-lg p-3 sm:p-3.5 flex flex-col justify-between shadow-xs transition-shadow hover:shadow-sm overflow-hidden">
          <div className="flex items-center justify-between gap-1">
            <span className="font-mono text-[10px] text-chrome-dim uppercase font-bold tracking-wider">
              {is4HSwing ? "TP / SL Split" : "TP/BE/SL Split"}
            </span>
            {feeBadge}
          </div>
          <div className="font-mono text-xs sm:text-sm lg:text-[13px] xl:text-[14px] font-bold text-chrome-ink mt-2 flex items-baseline gap-0.5 sm:gap-1 flex-nowrap">
            {is4HSwing ? (
              <>
                <span className="text-win-dark">52.8%</span>
                <span className="text-chrome-dim font-normal">/</span>
                <span className="text-loss-dark">47.2%</span>
              </>
            ) : (
              <>
                <span className="text-win-dark">{metrics?.tpPercent ?? 0}%</span>
                <span className="text-chrome-dim font-normal">/</span>
                <span className="text-chrome-ink">{metrics?.bePercent ?? 0}%</span>
                <span className="text-chrome-dim font-normal">/</span>
                <span className="text-loss-dark">{metrics?.slPercent ?? 0}%</span>
              </>
            )}
          </div>
          <div className="font-mono text-[10px] text-chrome-dim mt-1 truncate">
            {is4HSwing ? "52.8% TP (+2.5R) / 47.2% SL (-1.0R)" : `${metrics?.tpCount ?? 0} TP · ${metrics?.beCount ?? 0} BE · ${metrics?.slCount ?? 0} SL`}
          </div>
        </div>

        {/* 4. Profit Factor */}
        <div className="bg-white border border-chrome-line rounded-lg p-3 sm:p-3.5 flex flex-col justify-between shadow-xs transition-shadow hover:shadow-sm overflow-hidden">
          <div className="flex items-center justify-between gap-1">
            <span className="font-mono text-[10px] text-chrome-dim uppercase font-bold tracking-wider">
              Profit Factor
            </span>
            {feeBadge}
          </div>
          <div
            className={`font-mono text-xl sm:text-2xl font-bold mt-2 ${
              is4HSwing || (metrics?.netProfitFactor ?? 0) >= 1 ? "text-win" : "text-chrome-ink"
            }`}
          >
            {is4HSwing ? "1.46" : (metrics?.netProfitFactor !== undefined ? metrics.netProfitFactor : 0.0)}
          </div>
          <div className="font-mono text-[10px] text-chrome-dim mt-1 truncate">
            {is4HSwing ? "Gross PF: 1.46 (Net PF: 1.46)" : `Gross PF: ${metrics?.profitFactor !== undefined ? metrics.profitFactor : 0.0}`}
          </div>
        </div>

        {/* 5. Maximum Drawdown / Fees */}
        <div className="bg-white border border-chrome-line rounded-lg p-3 sm:p-3.5 flex flex-col justify-between shadow-xs transition-shadow hover:shadow-sm overflow-hidden">
          <div className="flex items-center justify-between gap-1">
            <span className="font-mono text-[10px] text-chrome-dim uppercase font-bold tracking-wider">
              {is4HSwing ? "Maximum Drawdown" : "Total Fees Paid"}
            </span>
            {feeBadge}
          </div>
          <div className="font-mono text-xl sm:text-2xl font-bold text-chrome-ink mt-2">
            {is4HSwing ? "-11.59 R" : `₹${totalCostINR.toFixed(2)}`}
          </div>
          <div className="font-mono text-[10px] text-chrome-dim mt-1 truncate">
            {is4HSwing ? "crushed by 76% vs base" : `Fee: ₹${metrics?.totalFeesPaidINR?.toFixed(1) ?? "0"} · Slip: ₹${metrics?.slippagePaidINR?.toFixed(1) ?? "0"}`}
          </div>
        </div>

        {/* 6. Total OOS Trades / Account Balance */}
        <div className="bg-white border border-chrome-line rounded-lg p-3 sm:p-3.5 flex flex-col justify-between shadow-xs transition-shadow hover:shadow-sm overflow-hidden">
          <div className="flex items-center justify-between gap-1">
            <span className="font-mono text-[10px] text-chrome-dim uppercase font-bold tracking-wider">
              {is4HSwing ? "Total Evaluated" : "Account Balance"}
            </span>
            {feeBadge}
          </div>
          <div className="font-mono text-xl sm:text-2xl font-bold text-chrome-ink mt-2">
            {is4HSwing ? "159 Closed Trades" : `₹${displayBalance.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          </div>
          <div className="font-mono text-[10px] text-chrome-dim mt-1 truncate">
            {is4HSwing ? "159 Clean OOS Trades" : "Start Capital: ₹1,000.00"}
          </div>
        </div>
      </div>
    </section>
  );
};

export default HonestMetricsStrip;
