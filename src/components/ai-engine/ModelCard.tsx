"use client";

import React from "react";
import { TOP_MODELS, ARCHIVED_MODELS, ALL_MODELS, AIStrategyModel, EnginePerformanceMetrics, TradeOrder } from "@/lib/engineTypes";
import { Brain, Sparkles, ChevronDown } from "lucide-react";

interface ModelCardProps {
  selectedModelId: string;
  onModelChange: (modelId: string) => void;
  isTaker: boolean;
  tradingFeePercent?: number;
  metrics?: EnginePerformanceMetrics | null;
  trades?: TradeOrder[];
  isLiveMode?: boolean;
  tableTab?: "live" | "historical" | "all_historical";
  allHistoricalMetrics?: any;
}

export const ModelCard: React.FC<ModelCardProps> = ({
  selectedModelId,
  onModelChange,
  isTaker,
  tradingFeePercent,
  metrics,
  trades = [],
  isLiveMode = true,
  tableTab = "live",
  allHistoricalMetrics = null,
}) => {
  const currentModel = ALL_MODELS.find((m) => m.id === selectedModelId) || null;
  const isArchived = currentModel?.rank === 99 || selectedModelId === "unified-1h-engine";

  // Exact Indian regulatory platform friction in R per trade
  const feePct = tradingFeePercent !== undefined ? tradingFeePercent : (isTaker ? 0.040 : 0.016);
  const roundTripPct = (2 * (feePct * 1.18 + 0.010)) / 100;
  const frictionR = Number(((1000 * roundTripPct) / 100).toFixed(4));

  // Dynamic live execution metrics
  const liveCount = trades.length;
  const liveWins = trades.filter((t) => (t.netPnLINR ?? ((t.net_r ?? 0) * 100)) > 0).length;
  const liveWinRate = liveCount > 0 ? Number(((liveWins / liveCount) * 100).toFixed(1)) : 0;
  
  const sumNetR = trades.reduce((acc, t) => acc + (t.net_r ?? (t.netPnLINR ? t.netPnLINR / 100 : 0)), 0);
  const liveAvgNetR = liveCount > 0 ? Number((sumNetR / liveCount).toFixed(3)) : 0;

  const grossWin = trades.filter((t) => (t.grossPnLINR ?? 0) > 0).reduce((acc, t) => acc + (t.grossPnLINR ?? 0), 0);
  const grossLoss = Math.abs(trades.filter((t) => (t.grossPnLINR ?? 0) < 0).reduce((acc, t) => acc + (t.grossPnLINR ?? 0), 0));
  const livePF = grossLoss > 0 ? Number((grossWin / grossLoss).toFixed(2)) : (grossWin > 0 ? 99.0 : 1.0);

  const tpCount = trades.filter((t) => t.exitReason === "TP" || (t.netPnLINR ?? 0) > 0).length;
  const tpSplit = liveCount > 0 ? Number(((tpCount / liveCount) * 100).toFixed(1)) : 0;
  const slSplit = liveCount > 0 ? Number((((liveCount - tpCount) / liveCount) * 100).toFixed(1)) : 0;

  // Display values:
  // 1. If all_historical mode, show the full 6-year historical metrics computed on ₹7k starting capital
  // 2. If live mode and live trades exist, show actual live metrics
  // 3. Otherwise holdout benchmark
  const isAllHistorical = tableTab === "all_historical";
  
  const displayWinRate = isAllHistorical && allHistoricalMetrics
    ? allHistoricalMetrics.trueWinRate
    : (isLiveMode && liveCount > 0 ? liveWinRate : (currentModel?.trueWinRate ?? 0));

  const displayAvgNetR = isAllHistorical && allHistoricalMetrics
    ? allHistoricalMetrics.avgNetR
    : (isLiveMode && liveCount > 0 ? liveAvgNetR : (currentModel ? Number(((currentModel.avgGrossR ?? currentModel.avgNetR) - frictionR).toFixed(3)) : 0));

  const displayPF = isAllHistorical && allHistoricalMetrics
    ? allHistoricalMetrics.netProfitFactor
    : (isLiveMode && liveCount > 0 ? livePF : (currentModel?.netProfitFactor ?? 1.0));

  const displayTpSplit = isAllHistorical && allHistoricalMetrics
    ? allHistoricalMetrics.tpSplit
    : (isLiveMode && liveCount > 0 ? tpSplit : (currentModel?.tpSplit ?? 0));

  const displaySlSplit = isAllHistorical && allHistoricalMetrics
    ? allHistoricalMetrics.slSplit
    : (isLiveMode && liveCount > 0 ? slSplit : (currentModel?.slSplit ?? 0));

  return (
    <div className="bg-white border border-chrome-line rounded-lg p-4 sm:p-5 flex flex-col gap-4 shadow-xs">
      {/* Top Header & Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded bg-chrome-field border border-chrome-line flex items-center justify-center text-sm font-bold shrink-0">
            {currentModel ? (currentModel.rank === 1 ? "🥇" : currentModel.rank === 2 ? "🥈" : currentModel.rank === 3 ? "🥉" : currentModel.rank === 4 ? "🎯" : "📊") : "🌐"}
          </div>
          <div className="flex flex-col">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-brand text-sm font-medium text-chrome-ink">
                {currentModel ? currentModel.name : "All Top Models (Combined Portfolio)"}
              </span>
              {currentModel && (
                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                  isArchived
                    ? "bg-rose-50 text-rose-800 border-rose-300"
                    : "bg-chrome-field text-chrome-ink border-chrome-line"
                }`}>
                  {isArchived ? "RETIRED" : `RANK #${currentModel.rank}`}
                </span>
              )}
              <span className="text-[10px] font-mono font-bold bg-accent-tint text-chrome-green-ink px-2 py-0.5 rounded border border-accent/30">
                {currentModel ? currentModel.timeframe.toUpperCase() : "MULTI-TIMEFRAME"}
              </span>
              {currentModel && (
                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                  isArchived
                    ? "bg-rose-100 text-rose-900 border-rose-400 font-black"
                    : "bg-win-tint text-chrome-green-ink border-win/40"
                }`}>
                  {isArchived ? "ARCHIVED / RETIRED" : "ACTIVE LIVE"}
                </span>
              )}
            </div>
            <p className="font-body text-xs text-chrome-dim max-w-2xl leading-relaxed mt-0.5">
              {currentModel
                ? currentModel.description
                : "Aggregated performance and execution logs across all algorithmic models from the backtesting suite."}
            </p>
          </div>
        </div>

        {/* Model Dropdown Selector */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 shrink-0">
          <label className="text-xs font-mono font-bold text-chrome-dim whitespace-nowrap">
            Select Model:
          </label>
          <select
            value={selectedModelId}
            onChange={(e) => onModelChange(e.target.value)}
            className="font-mono text-xs font-bold bg-chrome-field border border-chrome-line rounded px-3 py-1.5 text-chrome-ink hover:border-chrome-ink focus:outline-none focus:border-accent shadow-inner cursor-pointer"
          >
            <optgroup label="Active Production Models (Ranked 1 to 19)">
              {TOP_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  #{m.rank}: {m.shortName}
                </option>
              ))}
            </optgroup>
            {ARCHIVED_MODELS.length > 0 && (
              <optgroup label="Archived / Retired Models">
                {ARCHIVED_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    [ARCHIVED] {m.shortName}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </div>
      </div>

      {/* Model Benchmarked Metrics Strip */}
      {currentModel && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 pt-3 border-t border-chrome-edge font-mono text-xs">
          <div className="bg-chrome-field/50 border border-chrome-line rounded p-2 flex flex-col overflow-hidden">
            <span className="text-[10px] text-chrome-dim uppercase font-bold">True Win Rate</span>
            <span className="text-base font-bold text-chrome-ink mt-0.5">{displayWinRate.toFixed(1)}%</span>
            <span className="text-[9px] text-chrome-dim font-sans">
              {isAllHistorical && allHistoricalMetrics
                ? `${Math.round((allHistoricalMetrics.totalTrades * allHistoricalMetrics.trueWinRate) / 100).toLocaleString()} Wins / ${allHistoricalMetrics.totalTrades.toLocaleString()} Trades`
                : isLiveMode && liveCount > 0
                ? `${liveWins} Wins / ${liveCount} Trades`
                : "TP / (TP + SL)"}
            </span>
          </div>

          <div className="bg-chrome-field/50 border border-chrome-line rounded p-2 flex flex-col overflow-hidden">
            <span className="text-[10px] text-chrome-dim uppercase font-bold">Net Win Rate</span>
            <span className={`text-base font-bold mt-0.5 ${displayWinRate >= 45 ? "text-win" : "text-loss"}`}>
              {displayWinRate.toFixed(1)}%
            </span>
            <span className="text-[9px] text-chrome-dim font-sans">Net &gt; 0 After Fees</span>
          </div>

          <div className="bg-chrome-field/50 border border-chrome-line rounded p-2 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[10px] text-chrome-dim uppercase font-bold">Avg Net R</span>
              <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-accent-tint text-chrome-green-ink border border-accent/30 font-bold truncate">
                {isAllHistorical ? "6-YR ARCHIVE" : isLiveMode && liveCount > 0 ? "LIVE" : `${feePct.toFixed(3)}%`}
              </span>
            </div>
            <span className={`text-base font-bold mt-0.5 ${displayAvgNetR >= 0 ? "text-win" : "text-loss"}`}>
              {displayAvgNetR >= 0 ? "+" : ""}{displayAvgNetR.toFixed(3)} R
            </span>
            <span className="text-[9px] text-chrome-dim font-sans truncate">
              {isAllHistorical
                ? "Friction: 0.100% + GST (Shark)"
                : isLiveMode && liveCount > 0
                ? "Live Executed Net"
                : `Friction: (${feePct.toFixed(3)}% + GST)`}
            </span>
          </div>

          <div className="bg-chrome-field/50 border border-chrome-line rounded p-2 flex flex-col overflow-hidden">
            <span className="text-[10px] text-chrome-dim uppercase font-bold">Net Profit Factor</span>
            <span className={`text-base font-bold mt-0.5 ${displayPF >= 1.0 ? "text-win" : "text-loss"}`}>
              {displayPF.toFixed(2)}
            </span>
            <span className="text-[9px] text-chrome-dim font-sans">
              {isAllHistorical ? "Net PF (6-Yr Complete)" : "Net Win / Net Loss"}
            </span>
          </div>

          <div className="bg-chrome-field/50 border border-chrome-line rounded p-2 flex flex-col overflow-hidden">
            <span className="text-[10px] text-chrome-dim uppercase font-bold">TP/BE/SL Split</span>
            <span className="text-xs font-bold text-chrome-ink mt-1 flex items-baseline gap-0.5 flex-nowrap">
              <span className="text-win-dark">{displayTpSplit.toFixed(1)}%</span>
              <span className="text-chrome-dim font-normal">/</span>
              <span>0%</span>
              <span className="text-chrome-dim font-normal">/</span>
              <span className="text-loss-dark">{displaySlSplit.toFixed(1)}%</span>
            </span>
            <span className="text-[9px] text-chrome-dim font-sans">
              {isAllHistorical ? "Exit Distribution (2020-2026)" : "Exit Distribution"}
            </span>
          </div>

          <div className="border rounded p-2 flex flex-col overflow-hidden bg-win-tint border-win/40">
            <span className="text-[10px] uppercase font-bold text-chrome-green-ink">
              {isAllHistorical ? "6-Year Archive" : "Live Status"}
            </span>
            <span className="text-xs font-bold mt-1 text-win-dark font-mono truncate">
              {isAllHistorical ? "₹7K BASE ARCHIVE" : "ACTIVE LIVE"}
            </span>
            <span className="text-[9px] text-chrome-dim font-sans truncate">
              {isAllHistorical && allHistoricalMetrics
                ? `${allHistoricalMetrics.totalTrades.toLocaleString()} Trades (2020-2026)`
                : isLiveMode && liveCount > 0
                ? `${liveCount} Live Executions`
                : "Watermark Delta Cached"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ModelCard;
