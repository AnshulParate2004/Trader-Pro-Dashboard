"use client";

import React from "react";
import { TOP_MODELS, AIStrategyModel } from "@/lib/engineTypes";
import { Brain, Sparkles, ChevronDown } from "lucide-react";

interface ModelCardProps {
  selectedModelId: string;
  onModelChange: (modelId: string) => void;
  isTaker: boolean;
}

export const ModelCard: React.FC<ModelCardProps> = ({
  selectedModelId,
  onModelChange,
  isTaker,
}) => {
  const currentModel = TOP_MODELS.find((m) => m.id === selectedModelId) || null;

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
              {currentModel && currentModel.statusBadge.includes("RETIRED") && (
                <span className="text-[10px] font-mono font-bold bg-rose-50 text-rose-800 px-2 py-0.5 rounded border border-rose-300">
                  RETIRED
                </span>
              )}
            </div>
            <p className="font-body text-xs text-chrome-dim max-w-2xl leading-relaxed mt-0.5">
              {currentModel
                ? currentModel.description
                : "Aggregated performance and execution logs across all 4 top-ranked algorithmic models from the backtesting suite."}
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
                {m.rank === 1 ? "🥇" : m.rank === 2 ? "🥈" : m.rank === 3 ? "🥉" : "🎯"} #{m.rank}: {m.name}
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
            <span className="text-base font-bold text-loss mt-0.5">{currentModel.netWinRate}%</span>
            <span className="text-[9px] text-chrome-dim font-sans">Net &gt; 0 After Fees</span>
          </div>

          <div className="bg-chrome-field/50 border border-chrome-line rounded p-2 flex flex-col overflow-hidden">
            <span className="text-[10px] text-chrome-dim uppercase font-bold">Avg Net R</span>
            <span className="text-base font-bold text-loss mt-0.5">{currentModel.avgNetR} R</span>
            <span className="text-[9px] text-chrome-dim font-sans">Taker + GST + Slip</span>
          </div>

          <div className="bg-chrome-field/50 border border-chrome-line rounded p-2 flex flex-col overflow-hidden">
            <span className="text-[10px] text-chrome-dim uppercase font-bold">Net Profit Factor</span>
            <span className="text-base font-bold text-chrome-ink mt-0.5">{currentModel.netProfitFactor}</span>
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

          <div className="bg-accent-tint border border-accent/40 rounded p-2 flex flex-col overflow-hidden">
            <span className="text-[10px] text-chrome-green-ink uppercase font-bold">Live Status</span>
            <span className="text-xs font-bold text-chrome-green-ink mt-1">PAPER ONLY</span>
            <span className="text-[9px] text-chrome-dim font-sans">Negative Expectancy</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ModelCard;
