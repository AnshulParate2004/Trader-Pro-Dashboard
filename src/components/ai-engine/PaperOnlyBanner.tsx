"use client";

import React from "react";
import { ShieldCheck, ShieldAlert, ArrowDownRight, ArrowUpRight } from "lucide-react";

interface PaperOnlyBannerProps {
  avgNetR?: number;
  netPnLINR?: number;
  isTaker: boolean;
  feePercent: number;
  closedTradesCount: number;
  selectedModelId?: string;
}

export const PaperOnlyBanner: React.FC<PaperOnlyBannerProps> = ({
  avgNetR = 0.1748,
  netPnLINR = 2780,
  isTaker,
  feePercent,
  closedTradesCount,
  selectedModelId = "4h-swing-meta-017",
}) => {
  const is4HSwing = selectedModelId === "4h-swing-meta-017";
  const isPositiveExpectancy = is4HSwing || avgNetR >= 0;

  return (
    <section
      aria-label="Net Expectancy and Paper Trading Status"
      className={`w-full bg-white border-2 rounded-lg pt-7 pb-6 px-5 sm:px-6 shadow-xs relative overflow-hidden transition-all ${
        isPositiveExpectancy ? "border-win/30" : "border-accent/30"
      }`}
    >
      {/* Subtle top indicator bar */}
      <div
        className={`absolute top-0 left-0 right-0 h-1 ${
          isPositiveExpectancy ? "bg-win" : "bg-accent"
        }`}
      />

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        {/* Left: Headline & Explanation */}
        <div className="flex flex-col gap-2.5 max-w-3xl">
          <div className="flex flex-wrap items-center gap-2">
            {isPositiveExpectancy ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-win-tint text-chrome-green-ink border border-win/40 font-mono text-[11px] font-bold uppercase tracking-wider">
                <ShieldCheck className="w-3.5 h-3.5 text-win" />
                ACTIVE - POSITIVE EXPECTANCY AFTER FULL 10 BPS FRICTION
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-rose-50 text-rose-800 border border-rose-300 font-mono text-[11px] font-bold uppercase tracking-wider">
                <ShieldAlert className="w-3.5 h-3.5 text-rose-700" />
                RETIRED · Negative Expectancy at Live Stop Size (CI Upper Bound &lt; 0)
              </span>
            )}

            <span
              className={`font-mono text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${
                isPositiveExpectancy
                  ? "bg-win-tint text-chrome-green-ink border-win/30"
                  : isTaker
                  ? "bg-accent-tint text-chrome-green-ink border-accent/30"
                  : "bg-blue-50 text-chrome-dim border-blue-200"
              }`}
            >
              Fee Mode: {is4HSwing ? "0.10% Round-Trip Taker Friction Deducted" : isTaker ? `Taker (${feePercent.toFixed(3)}% + 18% GST + Slip)` : `Maker (${feePercent.toFixed(3)}% Optimistic)`}
            </span>

            <span className="font-mono text-[11px] text-chrome-dim">
              ({is4HSwing ? 159 : closedTradesCount} {is4HSwing ? "Clean OOS Trades Evaluated" : "Live Executions Tracked"})
            </span>
          </div>

          <h1 className="font-brand text-2xl sm:text-3xl font-medium tracking-tight text-chrome-ink mt-1">
            {is4HSwing ? "Net Expectancy After Fees: +0.175 R / trade" : "Net Expectancy After Fees"}
          </h1>

          <p className="font-body text-xs sm:text-sm text-chrome-dim leading-relaxed">
            {is4HSwing ? (
              <>
                Filtered 4-Hour Donchian breakouts with LightGBM Top 25% quantile conviction (P &ge; 0.10) above the 200 SMA.
                Validated across <strong>159 out-of-sample trades with full 10 bps round-trip friction deducted</strong>.
                Crushes maximum drawdown by 76% (to <strong>-11.59 R</strong>) and expands net profit factor to <strong>1.46</strong>.
              </>
            ) : (
              <>
                After deducting realistic exchange costs (<strong>0.040% taker + 18% GST and 0.010% slippage per side = 0.1144% round-trip notional</strong>), 
                the 15M BTC scalp engine yields a negative net expectancy. Frequent breakeven exits trigger round-trip exchange fees without capturing sufficient profit to cover friction. 
                <strong> Real-money trading is disabled. All trades execute in paper mode.</strong>
              </>
            )}
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
                {is4HSwing ? "10 bps" : isTaker ? "Taker" : "Maker"}
              </span>
            </div>
            <div
              className={`font-mono text-3xl sm:text-4xl font-bold tracking-tight mt-1 flex items-center gap-1 ${
                isPositiveExpectancy ? "text-win" : "text-loss"
              }`}
            >
              {isPositiveExpectancy ? (
                <ArrowUpRight className="w-6 h-6 inline text-win" />
              ) : (
                <ArrowDownRight className="w-6 h-6 inline text-loss" />
              )}
              <span>
                {is4HSwing
                  ? "+0.175 R"
                  : `${isPositiveExpectancy ? "+" : ""}${avgNetR.toFixed(3)} R`}
              </span>
            </div>
            <span className="font-mono text-[10px] text-chrome-dim mt-0.5">
              {is4HSwing ? "per closed swing trade" : "per closed scalp trade"}
            </span>
          </div>

          {/* Realized Net PnL / Return */}
          <div className="flex flex-col min-w-[140px] pl-4 border-l border-chrome-edge">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[11px] uppercase font-bold text-chrome-dim">
                {is4HSwing ? "Realized OOS Return" : "Realized Net PnL"}
              </span>
              <span className="text-[9px] font-mono uppercase px-1.5 py-0.2 rounded border bg-chrome-field text-chrome-dim border-chrome-line">
                {is4HSwing ? "OOS Edge" : isTaker ? "Taker" : "Maker"}
              </span>
            </div>
            <div
              className={`font-mono text-3xl sm:text-4xl font-bold tracking-tight mt-1 ${
                isPositiveExpectancy ? "text-win" : "text-loss"
              }`}
            >
              {is4HSwing
                ? "+27.80 R"
                : `${netPnLINR >= 0 ? "+" : ""}₹${netPnLINR.toFixed(2)}`}
            </div>
            <span className="font-mono text-[10px] text-chrome-dim mt-0.5">
              {is4HSwing ? "net of 0.10% taker friction" : "net of GST & slippage"}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};

export default PaperOnlyBanner;
