"use client";

import React from "react";
import { AlertTriangle, ShieldAlert, ArrowDownRight, ArrowUpRight } from "lucide-react";

interface PaperOnlyBannerProps {
  avgNetR?: number;
  netPnLINR?: number;
  isTaker: boolean;
  feePercent: number;
  closedTradesCount: number;
}

export const PaperOnlyBanner: React.FC<PaperOnlyBannerProps> = ({
  avgNetR = -0.261,
  netPnLINR = 0,
  isTaker,
  feePercent,
  closedTradesCount,
}) => {
  const isPositiveExpectancy = avgNetR >= 0;

  return (
    <section
      aria-label="Net Expectancy and Paper Trading Status"
      className="w-full bg-white border-2 border-accent/30 rounded-lg pt-7 pb-6 px-5 sm:px-6 shadow-xs relative overflow-hidden transition-all"
    >
      {/* Subtle top indicator bar */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-accent" />

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        
        {/* Left: Headline & Explanation */}
        <div className="flex flex-col gap-2.5 max-w-3xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-accent-tint text-chrome-green-ink border border-accent/40 font-mono text-[11px] font-bold uppercase tracking-wider">
              <ShieldAlert className="w-3.5 h-3.5 text-chrome-green-ink" />
              PAPER ONLY · Negative Expectancy
            </span>

            <span
              className={`font-mono text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${
                isTaker
                  ? "bg-accent-tint text-chrome-green-ink border-accent/30"
                  : "bg-blue-50 text-chrome-dim border-blue-200"
              }`}
            >
              Fee Mode: {isTaker ? `Taker (${feePercent.toFixed(3)}% + 18% GST + Slip)` : `Maker (${feePercent.toFixed(3)}% Optimistic)`}
            </span>

            <span className="font-mono text-[11px] text-chrome-dim">
              ({closedTradesCount} Live Executions Tracked)
            </span>
          </div>

          <h1 className="font-brand text-2xl sm:text-3xl font-medium tracking-tight text-chrome-ink mt-1">
            Net Expectancy After Fees
          </h1>

          <p className="font-body text-xs sm:text-sm text-chrome-dim leading-relaxed">
            After deducting realistic exchange costs (<strong>0.040% taker + 18% GST and 0.010% slippage per side = 0.1144% round-trip notional</strong>), 
            the 15M BTC scalp engine yields a negative net expectancy. Frequent breakeven exits trigger round-trip exchange fees without capturing sufficient profit to cover friction. 
            <strong> Real-money trading is disabled. All trades execute in paper mode.</strong>
          </p>
        </div>

        {/* Right: Key Big Numbers */}
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-4 lg:gap-6 shrink-0 border-t lg:border-t-0 lg:border-l border-chrome-edge pt-4 lg:pt-0 lg:pl-6">
          
          {/* Avg Net R */}
          <div className="flex flex-col min-w-[140px]">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[11px] uppercase font-bold text-chrome-dim">
                Avg Net R
              </span>
              <span className="text-[9px] font-mono uppercase px-1.5 py-0.2 rounded border bg-chrome-field text-chrome-dim border-chrome-line">
                {isTaker ? "Taker" : "Maker"}
              </span>
            </div>
            <div
              className={`font-mono text-3xl sm:text-4xl font-bold tracking-tight mt-1 flex items-center gap-1 ${
                isPositiveExpectancy ? "text-win" : "text-loss"
              }`}
            >
              {isPositiveExpectancy ? <ArrowUpRight className="w-6 h-6 inline" /> : <ArrowDownRight className="w-6 h-6 inline" />}
              <span>{isPositiveExpectancy ? "+" : ""}{avgNetR.toFixed(3)} R</span>
            </div>
            <span className="font-mono text-[10px] text-chrome-dim mt-0.5">
              per closed scalp trade
            </span>
          </div>

          {/* Realized Net PnL */}
          <div className="flex flex-col min-w-[140px] pl-4 border-l border-chrome-edge">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[11px] uppercase font-bold text-chrome-dim">
                Realized Net PnL
              </span>
              <span className="text-[9px] font-mono uppercase px-1.5 py-0.2 rounded border bg-chrome-field text-chrome-dim border-chrome-line">
                {isTaker ? "Taker" : "Maker"}
              </span>
            </div>
            <div
              className={`font-mono text-3xl sm:text-4xl font-bold tracking-tight mt-1 ${
                netPnLINR >= 0 ? "text-win" : "text-loss"
              }`}
            >
              {netPnLINR >= 0 ? "+" : ""}₹{netPnLINR.toFixed(2)}
            </div>
            <span className="font-mono text-[10px] text-chrome-dim mt-0.5">
              net of GST &amp; slippage
            </span>
          </div>

        </div>

      </div>
    </section>
  );
};

export default PaperOnlyBanner;
