"use client";

import React from "react";
import { TOP_MODELS, AIStrategyModel } from "@/lib/engineTypes";
import { Brain, Sparkles, ChevronDown } from "lucide-react";

interface ModelCardProps {
  selectedModelId: string;
  onModelChange: (modelId: string) => void;
  isTaker: boolean;
  tradingFeePercent?: number;
}

export const ModelCard: React.FC<ModelCardProps> = ({
  selectedModelId,
  onModelChange,
  isTaker,
  tradingFeePercent,
}) => {
  const currentModel = TOP_MODELS.find((m) => m.id === selectedModelId) || null;

  // Exact Indian regulatory platform friction in R per trade
  const feePct = tradingFeePercent !== undefined ? tradingFeePercent : (isTaker ? 0.040 : 0.016);
  const roundTripPct = (2 * (feePct * 1.18 + 0.010)) / 100;
  const frictionR = Number(((1000 * roundTripPct) / 100).toFixed(4));
  const avgGrossR = currentModel
    ? (currentModel.avgGrossR ?? (currentModel.avgNetR + 0.025))
    : 0.20;
  const dynamicAvgNetR = currentModel ? Number((avgGrossR - frictionR).toFixed(3)) : 0;

  return (
    <div className="bg-white border border-chrome-line rounded-lg p-4 sm:p-5 flex flex-col gap-4 shadow-xs">
      {/* Top Header & Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded bg-chrome-field border border-chrome-line flex items-center justify-center text-sm font-bold shrink-0">
            {currentModel ? (currentModel.rank === 1 ? "🥇" : currentModel.rank === 2 ? "🥈" : currentModel.rank === 3 ? "🥉" : "🎯") : "🌐"}
          </div>
          <div className="flex flex-col">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-brand text-sm font-medium text-chrome-ink">
                {currentModel ? currentModel.name : "All Top 4 Models (Combined Portfolio)"}
              </span>
              {currentModel && (
                <span className="text-[10px] font-mono font-bold bg-chrome-field text-chrome-ink px-2 py-0.5 rounded border border-chrome-line">
                  RANK #{currentModel.rank}
                </span>
              )}
              <span className="text-[10px] font-mono font-bold bg-accent-tint text-chrome-green-ink px-2 py-0.5 rounded border border-accent/30">
                {currentModel ? currentModel.timeframe.toUpperCase() : "MULTI-TIMEFRAME"}
              </span>
              {currentModel && currentModel.statusBadge.includes("ACTIVE LIVE") ? (
                <span className="text-[10px] font-mono font-bold bg-win-tint text-chrome-green-ink px-2 py-0.5 rounded border border-win/40">
                  ACTIVE LIVE
                </span>
              ) : currentModel && currentModel.id === "pure-rules-baseline" ? (
                <span className="text-[10px] font-mono font-bold bg-amber-50 text-amber-700 px-2 py-0.5 rounded border border-amber-300">
                  BENCHMARK
                </span>
              ) : currentModel ? (
                <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-300">
                  SYNCED DB
                </span>
              ) : null}
            </div>
            <p className="font-body text-xs text-chrome-dim max-w-2xl leading-relaxed mt-0.5">
              {currentModel
                ? currentModel.description
                : "Aggregated performance and execution logs across all top-ranked algorithmic models from the backtesting suite."}
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
            {TOP_MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                #{m.rank}: {m.shortName}
              </option>
            ))}
            <option value="all">🌐 All Models Combined (Aggregate Portfolio)</option>
          </select>
        </div>
      </div>

      {/* Model Benchmarked Metrics Strip */}
      {currentModel && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 pt-3 border-t border-chrome-edge font-mono text-xs">
          <div className="bg-chrome-field/50 border border-chrome-line rounded p-2 flex flex-col overflow-hidden">
            <span className="text-[10px] text-chrome-dim uppercase font-bold">True Win Rate</span>
            <span className="text-base font-bold text-chrome-ink mt-0.5">{currentModel.trueWinRate}%</span>
            <span className="text-[9px] text-chrome-dim font-sans">TP / (TP + SL)</span>
          </div>

          <div className="bg-chrome-field/50 border border-chrome-line rounded p-2 flex flex-col overflow-hidden">
            <span className="text-[10px] text-chrome-dim uppercase font-bold">Net Win Rate</span>
            <span className={`text-base font-bold mt-0.5 ${currentModel.netWinRate >= 50 ? "text-win" : "text-loss"}`}>
              {currentModel.netWinRate}%
            </span>
            <span className="text-[9px] text-chrome-dim font-sans">Net &gt; 0 After Fees</span>
          </div>

          <div className="bg-chrome-field/50 border border-chrome-line rounded p-2 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[10px] text-chrome-dim uppercase font-bold">Avg Net R</span>
              <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-accent-tint text-chrome-green-ink border border-accent/30 font-bold truncate">
                {feePct.toFixed(3)}%
              </span>
            </div>
            <span className={`text-base font-bold mt-0.5 ${dynamicAvgNetR >= 0 ? "text-win" : "text-loss"}`}>
              {dynamicAvgNetR >= 0 ? "+" : ""}{dynamicAvgNetR.toFixed(3)} R
            </span>
            <span className="text-[9px] text-chrome-dim font-sans truncate">
              Friction: ({feePct.toFixed(3)}% + 18% GST + Slip)
            </span>
          </div>

          <div className="bg-chrome-field/50 border border-chrome-line rounded p-2 flex flex-col overflow-hidden">
            <span className="text-[10px] text-chrome-dim uppercase font-bold">Net Profit Factor</span>
            <span className={`text-base font-bold mt-0.5 ${currentModel.netProfitFactor >= 1.0 ? "text-win" : "text-loss"}`}>
              {currentModel.netProfitFactor}
            </span>
            <span className="text-[9px] text-chrome-dim font-sans">Net Win / Net Loss</span>
          </div>

          <div className="bg-chrome-field/50 border border-chrome-line rounded p-2 flex flex-col overflow-hidden">
            <span className="text-[10px] text-chrome-dim uppercase font-bold">TP/BE/SL Split</span>
            <span className="text-xs font-bold text-chrome-ink mt-1 flex items-baseline gap-0.5 flex-nowrap">
              <span className="text-win-dark">{currentModel.tpSplit}%</span>
              <span className="text-chrome-dim font-normal">/</span>
              <span>{currentModel.beSplit}%</span>
              <span className="text-chrome-dim font-normal">/</span>
              <span className="text-loss-dark">{currentModel.slSplit}%</span>
            </span>
            <span className="text-[9px] text-chrome-dim font-sans">Exit Distribution</span>
          </div>

          <div className={`border rounded p-2 flex flex-col overflow-hidden ${
            (currentModel.id === "unified-1h-engine" || currentModel.id === "1h-commodities-rf")
              ? "bg-win-tint border-win/40"
              : "bg-slate-50 border-slate-300"
          }`}>
            <span className={`text-[10px] uppercase font-bold ${
              (currentModel.id === "unified-1h-engine" || currentModel.id === "1h-commodities-rf") ? "text-chrome-green-ink" : "text-slate-600"
            }`}>Live Status</span>
            <span className={`text-xs font-bold mt-1 ${
              (currentModel.id === "unified-1h-engine" || currentModel.id === "1h-commodities-rf") ? "text-win-dark" : "text-slate-700 font-mono"
            }`}>
              {(currentModel.id === "unified-1h-engine" || currentModel.id === "1h-commodities-rf") ? "ACTIVE LIVE" : "SYNCED DB"}
            </span>
            <span className="text-[9px] text-chrome-dim font-sans">
              {(currentModel.id === "unified-1h-engine" || currentModel.id === "1h-commodities-rf") ? "Primary Live Paper Engine" : "Watermark Delta Cached"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ModelCard;
