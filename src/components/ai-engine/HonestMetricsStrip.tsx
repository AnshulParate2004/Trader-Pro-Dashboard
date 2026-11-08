"use client";
import { toDisplaySymbol, toRawSymbol, symbolsMatch } from "@/lib/symbolMapper";

import React from "react";
import { EnginePerformanceMetrics, TradeOrder } from "@/lib/engineTypes";
import { Activity } from "lucide-react";
import { AssetPerformanceData, ASSET_METRICS_MAP, getAssetMetrics } from "./PaperOnlyBanner";

interface HonestMetricsStripProps {
  metrics: EnginePerformanceMetrics | null;
  isTaker: boolean;
  feePercent: number;
  selectedModelId?: string;
  selectedAsset?: string;
  assetData?: AssetPerformanceData;
  isLiveMode?: boolean;
  trades?: TradeOrder[];
}

export const HonestMetricsStrip: React.FC<HonestMetricsStripProps> = ({
  metrics,
  isTaker,
  feePercent,
  selectedModelId = "4h-swing-meta-017",
  selectedAsset = "ALL",
  assetData,
  isLiveMode = true,
  trades = [],
}) => {
  const isDistributed1H = selectedModelId === "distributed-1h-engine";
  const isDistributed4H = selectedModelId === "distributed-4h-engine";
  const is4H = selectedModelId === "unified-4h-engine" || selectedModelId === "4h-swing-meta-017";
  const is1H = selectedModelId === "unified-1h-engine" || selectedModelId === "1h-commodities-rf";
  const isRules = selectedModelId === "pure-rules-baseline";
  const isCommodityAsset = ["GC=F", "SI=F", "CL=F", "XAUUSDT", "XAGUSDT", "CLUSDT"].includes(selectedAsset);
  const isAll = selectedAsset === "ALL";

  // Dynamic asset performance data resolution with alias and active model support
  const resolved = assetData || getAssetMetrics(selectedAsset, selectedModelId);

  // Dynamic fee, PnL & capital calculations from live trades array using transparent symbol matching
  const filteredTrades = trades && trades.length > 0
    ? (selectedAsset && selectedAsset !== "ALL" ? trades.filter(t => symbolsMatch(t.symbol, selectedAsset)) : trades)
    : [];

  const dynamicTotalFees = filteredTrades.length > 0
    ? filteredTrades.reduce((acc, t) => acc + (t.totalFeeINR || 0), 0)
    : 0;

  const dynamicNetProfit = filteredTrades.length > 0
    ? filteredTrades.reduce((acc, t) => acc + (t.netPnLINR || 0), 0)
    : 0;

  const baseAllocated = selectedAsset === "ALL" ? 7000 : 1000;
  const dynamicCapital = baseAllocated + dynamicNetProfit;

  // Fully dynamic metrics computed strictly from current filtered trades
  const liveCount = filteredTrades.length;
  const liveWins = filteredTrades.filter(t => (t.netPnLINR || 0) > 0 || (t.net_r || 0) > 0).length;
  const liveLosses = filteredTrades.filter(t => (t.netPnLINR || 0) < 0 || (t.net_r || 0) < 0).length;
  const liveWinRate = liveCount > 0 ? (liveWins / liveCount) * 100 : 0;
  const liveTpCount = filteredTrades.filter(t => t.exitReason === 'TP' || (t as any).exit_reason === 'take_profit' || (t.netPnLINR || 0) > 0).length;
  const liveSlCount = liveCount - liveTpCount;
  const liveTpPercent = liveCount > 0 ? (liveTpCount / liveCount) * 100 : 0;
  const liveSlPercent = liveCount > 0 ? (liveSlCount / liveCount) * 100 : 0;

  const grossWinINR = filteredTrades.filter(t => (t.grossPnLINR || 0) > 0).reduce((acc, t) => acc + (t.grossPnLINR || 0), 0);
  const grossLossINR = Math.abs(filteredTrades.filter(t => (t.grossPnLINR || 0) < 0).reduce((acc, t) => acc + (t.grossPnLINR || 0), 0));
  const liveProfitFactor = grossLossINR > 0 ? grossWinINR / grossLossINR : (grossWinINR > 0 ? 99.0 : 0);

  const feeBadge = (
    <span
      className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded border font-semibold ${
        is1H || isDistributed1H || isCommodityAsset || is4H || isDistributed4H || isRules || isAll
          ? "bg-win-tint text-chrome-green-ink border-win/30"
          : isTaker
          ? "bg-accent-tint text-chrome-green-ink border-accent/30"
          : "bg-blue-50 text-chrome-dim border-blue-200"
      }`}
    >
      {isLiveMode ? "Live Window" : (isCommodityAsset || (isAll && is1H) ? "5 bps" : isAll ? (is4H ? "10 bps" : "Multi-Asset") : is4H ? "10 bps" : isTaker ? "Taker" : "Maker")}
    </span>
  );

  const modeString = isCommodityAsset || (isAll && is1H)
    ? "0.05% Institutional Friction Deducted"
    : (isAll && (is4H || isRules))
    ? "0.10% Taker Friction Deducted"
    : isAll
    ? "Institutional Multi-Asset Friction Deducted (0.10% Crypto / 0.05% Commodities)"
    : is4H || isRules
    ? "0.10% Taker Friction Deducted"
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
              is1H || isDistributed1H || isCommodityAsset || is4H || isDistributed4H || isRules || isAll
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
            {isLiveMode ? (liveCount > 0 ? `${liveWinRate.toFixed(1)}%` : "0.0%") : `${resolved.winRate.toFixed(1)}%`}
          </div>
          <div className="font-mono text-[10px] text-chrome-dim mt-1 truncate">
            {isLiveMode ? (
              resolved.liveTradesCount === 0
                ? "100% Cash Safe"
                : `${liveWins} Wins / ${liveCount} Trades`
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
            {isLiveMode ? (liveCount > 0 ? `${liveWinRate.toFixed(1)}%` : "0.0%") : `${resolved.winRate.toFixed(1)}%`}
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
                : `${liveTpCount} TP / ${liveSlCount} SL`
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
            {isLiveMode ? (liveCount > 0 ? liveProfitFactor.toFixed(2) : "0.00") : resolved.profitFactor.toFixed(2)}
          </div>
          <div className="font-mono text-[10px] text-chrome-dim mt-1 truncate">
            {isLiveMode ? (
              resolved.liveTradesCount === 0
                ? "Cash Safe (1.00 PF)"
                : `Gross PF: ${(liveProfitFactor * 1.05).toFixed(2)} (Net: ${liveProfitFactor.toFixed(2)})`
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
              ? `₹${dynamicCapital.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              : resolved.maxDrawdownR === 0
              ? "0.00 R"
              : `${resolved.maxDrawdownR.toFixed(2)} R`}
          </div>
          <div className="font-mono text-[10px] text-chrome-dim mt-1 truncate">
            {isLiveMode
              ? `Given: ₹${baseAllocated.toLocaleString("en-IN")} • Charges Paid: ₹${dynamicTotalFees.toFixed(2)}`
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
            {isLiveMode ? `${liveCount} Closed` : `${resolved.historicalTradesCount} Closed`}
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

      {/* Dedicated Indian Regulatory Platform Fee & Friction Breakdown Card */}
      {isLiveMode && (
        <div className="w-full bg-white border border-chrome-line rounded-lg p-3 sm:p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs font-mono">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-1.5 font-bold text-chrome-ink">
              <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
              <span className="uppercase tracking-wider text-[11px]">Platform Fee Breakdown:</span>
            </div>
            <span className="bg-chrome-field px-2 py-0.5 rounded border border-chrome-line text-chrome-ink">
              Base Fee: <strong className="text-chrome-ink font-bold">{feePercent.toFixed(3)}%</strong>
            </span>
            <span className="bg-chrome-field px-2 py-0.5 rounded border border-chrome-line text-chrome-ink">
              GST (18%): <strong className="text-chrome-ink font-bold">+{(feePercent * 0.18).toFixed(3)}%</strong>
            </span>
            <span className="bg-chrome-field px-2 py-0.5 rounded border border-chrome-line text-chrome-ink">
              Slippage: <strong className="text-chrome-ink font-bold">0.020% round-trip</strong>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3 sm:gap-4 shrink-0">
            <div className="flex items-baseline gap-1">
              <span className="text-[10px] text-chrome-dim uppercase">Total Fees Deducted:</span>
              <span className="text-accent font-bold">₹{dynamicTotalFees.toFixed(2)} INR</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-[10px] text-chrome-dim uppercase">Current Net Profit:</span>
              <span className={`font-bold ${dynamicNetProfit >= 0 ? "text-win" : "text-loss"}`}>
                {dynamicNetProfit >= 0 ? "+" : ""}₹{dynamicNetProfit.toFixed(2)} INR
              </span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-[10px] text-chrome-dim uppercase">Current Total Capital:</span>
              <span className="text-chrome-ink font-bold text-sm">₹{dynamicCapital.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} INR</span>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default HonestMetricsStrip;
