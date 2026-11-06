"use client";

import React from "react";
import { Percent, Info, AlertTriangle } from "lucide-react";

interface FeeModeToggleProps {
  tradingFeePercent: number;
  onFeeChange: (fee: number) => void;
  isTaker: boolean;
}

export const FeeModeToggle: React.FC<FeeModeToggleProps> = ({
  tradingFeePercent,
  onFeeChange,
  isTaker,
}) => {
  return (
    <div className="bg-white border border-chrome-line rounded-lg p-4 sm:p-5 flex flex-col gap-3 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-chrome-edge pb-2.5">
        <div className="flex items-center gap-2">
          <Percent className="w-4 h-4 text-accent" />
          <h3 className="font-brand text-sm font-medium text-chrome-ink uppercase">
            Exchange Fee Mode &amp; Slippage Config
          </h3>
          <span
            className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
              isTaker
                ? "bg-accent-tint text-accent border-accent/30"
                : "bg-blue-50 text-chrome-dim border-blue-200"
            }`}
          >
            Active: {isTaker ? "Taker (Realistic Default)" : "Maker (Optimistic Scenario)"}
          </span>
        </div>
        <span className="font-mono text-xs text-chrome-dim">
          GST Rate: 18.0% · Slip: 0.010%/side
        </span>
      </div>

      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        {/* Fee mode selection pills */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => onFeeChange(0.040)}
            className={`font-mono text-xs px-3 py-1.5 rounded transition-all cursor-pointer border ${
              tradingFeePercent === 0.040
                ? "bg-accent text-white border-accent font-bold shadow-xs"
                : "bg-chrome-field text-chrome-dim hover:text-chrome-ink border-chrome-line"
            }`}
            title="Shark Exchange Standard Taker: 0.040% per side (Realistic Default)"
          >
            Taker: 0.040% (Realistic Default)
          </button>

          <button
            onClick={() => onFeeChange(0.016)}
            className={`font-mono text-xs px-3 py-1.5 rounded transition-all cursor-pointer border ${
              tradingFeePercent === 0.016
                ? "bg-accent text-white border-accent font-bold shadow-xs"
                : "bg-chrome-field text-chrome-dim hover:text-chrome-ink border-chrome-line"
            }`}
            title="Maker: 0.016% (Optimistic Scenario — assumes 100% passive queue fills without adverse selection)"
          >
            Maker: 0.016% (Optimistic Scenario)
          </button>

          <button
            onClick={() => onFeeChange(0.030)}
            className={`font-mono text-xs px-3 py-1.5 rounded transition-all cursor-pointer border ${
              tradingFeePercent === 0.030
                ? "bg-accent text-white border-accent font-bold shadow-xs"
                : "bg-chrome-field text-chrome-dim hover:text-chrome-ink border-chrome-line"
            }`}
            title="Discount Taker Fee: 0.030%"
          >
            Mid Taker: 0.030%
          </button>

          <button
            onClick={() => onFeeChange(0.018)}
            className={`font-mono text-xs px-3 py-1.5 rounded transition-all cursor-pointer border ${
              tradingFeePercent === 0.018
                ? "bg-accent text-white border-accent font-bold shadow-xs"
                : "bg-chrome-field text-chrome-dim hover:text-chrome-ink border-chrome-line"
            }`}
            title="VIP Maker Fee: 0.018%"
          >
            VIP Maker: 0.018%
          </button>
        </div>

        {/* Custom manual fee input */}
        <div className="flex items-center gap-2 self-stretch sm:self-auto">
          <label className="text-xs font-mono text-chrome-dim whitespace-nowrap">
            Custom Base Fee:
          </label>
          <div className="flex items-center gap-1.5 bg-chrome-field border border-chrome-line rounded px-2.5 py-1">
            <input
              type="number"
              step="0.002"
              min="0.005"
              max="0.2"
              value={tradingFeePercent}
              onChange={(e) => onFeeChange(parseFloat(e.target.value) || 0.040)}
              className="w-16 bg-transparent font-mono text-xs font-bold text-chrome-ink outline-none"
            />
            <span className="text-xs font-mono text-chrome-dim font-bold">%</span>
          </div>
        </div>
      </div>

      {/* Advisory explanation */}
      <div className="text-[11px] font-mono text-chrome-dim flex items-center gap-1.5 pt-1">
        <Info className="w-3.5 h-3.5 text-accent shrink-0" />
        <span>
          Round-trip taker friction equals <strong>0.1144%</strong> (0.040% fee + 18% GST + 0.010% slippage per side). Maker mode is purely an optimistic benchmark.
        </span>
      </div>
    </div>
  );
};

export default FeeModeToggle;
