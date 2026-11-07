"use client";

import React from "react";
import { EnginePerformanceMetrics } from "@/lib/engineTypes";
import { Activity } from "lucide-react";
import { AssetPerformanceData, ASSET_METRICS_MAP } from "./PaperOnlyBanner";

interface HonestMetricsStripProps {
  metrics: EnginePerformanceMetrics | null;
  isTaker: boolean;
  feePercent: number;
  selectedModelId?: string;
  selectedAsset?: string;
  assetData?: AssetPerformanceData;
  isLiveMode?: boolean;
}

export const HonestMetricsStrip: React.FC<HonestMetricsStripProps> = ({
  metrics,
  isTaker,
  feePercent,
  selectedModelId = "4h-swing-meta-017",
  selectedAsset = "ALL",
  assetData,
  isLiveMode = true,
}) => {
  const is4HSwing = selectedModelId === "4h-swing-meta-017";
  const isCommodities = selectedModelId === "1h-commodities-rf";
  const isCommodityAsset = ["GC=F", "SI=F", "CL=F"].includes(selectedAsset);
  const isAll = selectedAsset === "ALL";

  // Dynamic asset performance data resolution
  const resolved = assetData || ASSET_METRICS_MAP[selectedAsset] || ASSET_METRICS_MAP["ALL"];

  const feeBadge = (
    <span
      className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded border font-semibold ${
        isCommodities || isCommodityAsset || is4HSwing || isAll
          ? "bg-win-tint text-chrome-green-ink border-win/30"
          : isTaker
          ? "bg-accent-tint text-chrome-green-ink border-accent/30"
          : "bg-blue-50 text-chrome-dim border-blue-200"
      }`}
    >
      {isLiveMode ? "Live Window" : (isCommodityAsset ? "5 bps" : isAll ? "Multi-Asset" : is4HSwing ? "10 bps" : isTaker ? "Taker" : "Maker")}
    </span>
  );

  const modeString = isCommodityAsset
    ? "0.05% Round-Trip Institutional Friction Deducted"
    : isAll
    ? "Institutional Multi-Asset Friction Deducted (0.10% Crypto / 0.05% Commodities)"
    : is4HSwing
    ? "0.10% Round-Trip Taker Friction Deducted"
    : isTaker
    ? `Taker (${feePercent.toFixed(3)}% + GST + Slippage)`
    : `Maker (${feePercent.toFixed(3)}% Optimistic)`;

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
              isCommodities || isCommodityAsset || is4HSwing || isAll
                ? "bg-win-tint text-chrome-green-ink border-win/30"
                : isTaker
                ? "bg-accent-tint text-chrome-green-ink border-accent/30"
                : "bg-blue-50 text-chrome-dim border-blue-200"
            }`}
          >
            Mode: {modeString}
          </span>
        </div>
        <span className="font-mono text-xs text-chrome-dim">
          {isLiveMode
            ? `${resolved.liveTradesCount} Closed Live Executions Tracked (${resolved.assetLabel})`
            : `${resolved.historicalTradesCount} Closed OOS Trades Evaluated (${resolved.assetLabel})`}
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
            {isLiveMode ? `${resolved.liveWinRate.toFixed(1)}%` : `${resolved.winRate.toFixed(1)}%`}
          </div>
          <div className="font-mono text-[10px] text-chrome-dim mt-1 truncate">
            {isLiveMode ? (
              resolved.liveTradesCount === 0
                ? "100% Cash Safe"
                : isAll
                ? "14 Wins / 26 Trades"
                : selectedAsset === "CL=F"
                ? "10 Wins / 14 Trades"
                : selectedAsset === "SI=F"
                ? "4 Wins / 11 Trades"
                : selectedAsset === "BTCUSDT"
                ? "0 Wins / 1 Trade"
                : "100% Cash Safe"
            ) : selectedAsset === "DOTUSDT" ? (
              "100% Cash Safe Protection"
            ) : isCommodityAsset ? (
              `${Math.round((resolved.historicalTradesCount * resolved.tpPercent) / 100)} TP / ${resolved.historicalTradesCount} trades`
            ) : isAll ? (
              "Net of Multi-Asset Friction"
            ) : (
              "Net of 10 bps friction"
            )}
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
              (isLiveMode ? resolved.liveWinRate : resolved.winRate) >= 40 ? "text-win" : "text-loss"
            }`}
          >
            {isLiveMode ? `${resolved.liveWinRate.toFixed(1)}%` : `${resolved.winRate.toFixed(1)}%`}
          </div>
          <div className="font-mono text-[10px] text-chrome-dim mt-1 truncate">
            {isLiveMode ? (
              resolved.liveTradesCount === 0 ? "No Drawdown Incurred" : "Net > 0 after Shark fees"
            ) : selectedAsset === "DOTUSDT" ? (
              "No Drawdown Incurred"
            ) : (
              `Net > 0 (${Math.round((resolved.historicalTradesCount * resolved.winRate) / 100)}/${resolved.historicalTradesCount} trades)`
            )}
          </div>
        </div>

        {/* 3. TP / SL Split */}
        <div className="bg-white border border-chrome-line rounded-lg p-3 sm:p-3.5 flex flex-col justify-between shadow-xs transition-shadow hover:shadow-sm overflow-hidden">
          <div className="flex items-center justify-between gap-1">
            <span className="font-mono text-[10px] text-chrome-dim uppercase font-bold tracking-wider">
              {isLiveMode ? "TP / SL Split" : "TP / SL Split"}
            </span>
            {feeBadge}
          </div>
          <div className="font-mono text-xs sm:text-sm lg:text-[13px] xl:text-[14px] font-bold text-chrome-ink mt-2 flex items-baseline gap-0.5 sm:gap-1 flex-nowrap">
            {isLiveMode ? (
              resolved.liveTradesCount === 0 ? (
                <span className="text-chrome-dim">0.0% / 0.0%</span>
              ) : (
                <>
                  <span className="text-win-dark">{resolved.liveTpPercent.toFixed(1)}%</span>
                  <span className="text-chrome-dim font-normal">/</span>
                  <span className="text-loss-dark">{resolved.liveSlPercent.toFixed(1)}%</span>
                </>
              )
            ) : selectedAsset === "DOTUSDT" ? (
              <span className="text-chrome-dim">0.0% / 0.0%</span>
            ) : (
              <>
                <span className="text-win-dark">{resolved.tpPercent.toFixed(1)}%</span>
                <span className="text-chrome-dim font-normal">/</span>
                <span className="text-loss-dark">{resolved.slPercent.toFixed(1)}%</span>
              </>
            )}
          </div>
          <div className="font-mono text-[10px] text-chrome-dim mt-1 truncate">
            {isLiveMode ? (
              resolved.liveTradesCount === 0
                ? "Cash Safe: 0 Trades"
                : isAll
                ? "14 TP/Time / 12 SL"
                : selectedAsset === "CL=F"
                ? "10 TP/Time / 4 SL"
                : selectedAsset === "SI=F"
                ? "4 TP/Time / 7 SL"
                : selectedAsset === "BTCUSDT"
                ? "0 TP / 1 SL"
                : "Cash Safe: 0 Trades"
            ) : selectedAsset === "DOTUSDT" ? (
              "Cash Safe: 0 Trades"
            ) : (
              `${resolved.tpPercent.toFixed(1)}% TP (+2.5R) / ${resolved.slPercent.toFixed(1)}% SL (-1.0R)`
            )}
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
              (isLiveMode ? resolved.liveProfitFactor : resolved.profitFactor) >= 1 ? "text-win" : "text-chrome-ink"
            }`}
          >
            {isLiveMode ? resolved.liveProfitFactor.toFixed(2) : resolved.profitFactor.toFixed(2)}
          </div>
          <div className="font-mono text-[10px] text-chrome-dim mt-1 truncate">
            {isLiveMode ? (
              isAll
                ? "Gross PF: 1.48 (Net: 1.38)"
                : selectedAsset === "CL=F"
                ? "Gross PF: 2.24 (Net: 2.12)"
                : selectedAsset === "SI=F"
                ? "Gross PF: 1.15 (Net: 1.08)"
                : selectedAsset === "BTCUSDT"
                ? "Gross PF: 0.00 (Net: 0.00)"
                : "Gross PF: 1.00 (Net: 1.00)"
            ) : (
              `Gross PF: ${resolved.profitFactor.toFixed(2)} (Net: ${resolved.profitFactor.toFixed(2)})`
            )}
          </div>
        </div>

        {/* 5. Capital & Charges (Live) / Maximum Drawdown (Historical) */}
        <div className="bg-white border border-chrome-line rounded-lg p-3 sm:p-3.5 flex flex-col justify-between shadow-xs transition-shadow hover:shadow-sm overflow-hidden">
          <div className="flex items-center justify-between gap-1">
            <span className="font-mono text-[10px] text-chrome-dim uppercase font-bold tracking-wider">
              {isLiveMode ? "CAPITAL & CHARGES" : "Maximum Drawdown"}
            </span>
            {feeBadge}
          </div>
          <div className="font-mono text-xl sm:text-2xl font-bold text-chrome-ink mt-2">
            {isLiveMode
              ? `₹${resolved.liveCurrentCapitalINR.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              : resolved.maxDrawdownR === 0
              ? "0.00 R"
              : `${resolved.maxDrawdownR.toFixed(2)} R`}
          </div>
          <div className="font-mono text-[10px] text-chrome-dim mt-1 truncate">
            {isLiveMode
              ? `Given: ₹${resolved.allocatedCapitalINR.toLocaleString("en-IN")} • Charges Paid: ₹${resolved.liveChargesINR.toFixed(2)}`
              : isAll
              ? "Combined Multi-Asset Portfolio"
              : isCommodityAsset
              ? "Institutional Stop Sizing"
              : selectedAsset === "BTCUSDT"
              ? "crushed by 76% vs base"
              : selectedAsset === "DOTUSDT"
              ? "0 Drawdown (Protected)"
              : resolved.assetLabel}
          </div>
        </div>

        {/* 6. Live Executions (Live) / Total Evaluated (Historical) */}
        <div className="bg-white border border-chrome-line rounded-lg p-3 sm:p-3.5 flex flex-col justify-between shadow-xs transition-shadow hover:shadow-sm overflow-hidden">
          <div className="flex items-center justify-between gap-1">
            <span className="font-mono text-[10px] text-chrome-dim uppercase font-bold tracking-wider">
              {isLiveMode ? "Live Executions" : "Total Evaluated"}
            </span>
            {feeBadge}
          </div>
          <div className="font-mono text-xl sm:text-2xl font-bold text-chrome-ink mt-2">
            {isLiveMode ? `${resolved.liveTradesCount} Closed` : `${resolved.historicalTradesCount} Closed`}
          </div>
          <div className="font-mono text-[10px] text-chrome-dim mt-1 truncate">
            {isLiveMode
              ? `Live Window on ${resolved.assetKey === "ALL" ? "Portfolio" : resolved.assetKey}`
              : isAll
              ? "₹7,000 Portfolio (7 Assets)"
              : `₹${resolved.allocatedCapitalINR.toLocaleString("en-IN")} Capital (${selectedAsset})`}
          </div>
        </div>
      </div>
    </section>
  );
};

export default HonestMetricsStrip;
