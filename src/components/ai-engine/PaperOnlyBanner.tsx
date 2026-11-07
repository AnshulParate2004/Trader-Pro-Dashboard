import { TradeOrder } from "@/lib/engineTypes";
"use client";

import React from "react";
import { ShieldCheck, ShieldAlert, ArrowDownRight, ArrowUpRight } from "lucide-react";

export interface AssetPerformanceData {
  assetKey: string;
  assetLabel: string;
  timeframe: string;
  historicalTradesCount: number;
  liveTradesCount: number;
  avgNetR: number;
  realizedReturnR: number;
  netPnLINR: number;
  winRate: number;
  profitFactor: number;
  maxDrawdownR: number;
  tpPercent: number;
  slPercent: number;
  allocatedCapitalINR: number;
  totalPortfolioCapitalINR: number;
  description: string;
  // Live real-time performance & capital accounting
  liveAvgNetR: number;
  liveRealizedReturnR: number;
  liveNetPnLINR: number;
  liveChargesINR: number;
  liveCurrentCapitalINR: number;
  liveWinRate: number;
  liveProfitFactor: number;
  liveTpPercent: number;
  liveSlPercent: number;
  liveDescription?: string;
}

export const ASSET_METRICS_MAP: Record<string, AssetPerformanceData> = {
  ALL: {
    assetKey: "ALL",
    assetLabel: "Portfolio - All 7 Assets",
    timeframe: "4H / 1H Multi-Asset",
    historicalTradesCount: 495,
    liveTradesCount: 70,
    avgNetR: 0.165,
    realizedReturnR: 78.70,
    netPnLINR: 7870,
    winRate: 49.5,
    profitFactor: 1.34,
    maxDrawdownR: -24.18,
    tpPercent: 49.5,
    slPercent: 50.5,
    allocatedCapitalINR: 7000,
    totalPortfolioCapitalINR: 7000,
    description: "Unified quantitative multi-asset portfolio across 4H Crypto (BTC, ETH, SOL, DOT) and 1H Macro Commodities (Gold, Silver, Crude Oil) with LightGBM and Random Forest meta-labeling.",
    liveAvgNetR: 0.336,
    liveRealizedReturnR: 23.54,
    liveNetPnLINR: 2354.00,
    liveChargesINR: 140.20,
    liveCurrentCapitalINR: 9354.00,
    liveWinRate: 60.0,
    liveProfitFactor: 2.47,
    liveTpPercent: 60.0,
    liveSlPercent: 40.0,
    liveDescription: "Live paper trading executions on unseen real-time feeds with ₹1,000 allocated per asset (₹7,000 portfolio). Net profit of +₹2,354.00 (+23.54R) after all Shark Exchange fees + 18% GST deducted.",
  },
  BTCUSDT: {
    assetKey: "BTCUSDT",
    assetLabel: "Bitcoin (BTC/USDT 4H)",
    timeframe: "4H Swing",
    historicalTradesCount: 71,
    liveTradesCount: 1,
    avgNetR: 0.175,
    realizedReturnR: 12.42,
    netPnLINR: 1242,
    winRate: 52.8,
    profitFactor: 1.46,
    maxDrawdownR: -11.59,
    tpPercent: 52.8,
    slPercent: 47.2,
    allocatedCapitalINR: 1000,
    totalPortfolioCapitalINR: 7000,
    description: "Filtered 4-Hour Donchian breakouts on Bitcoin with LightGBM Top 25% quantile conviction (P >= 0.10) above the 200 SMA.",
    liveAvgNetR: -1.030,
    liveRealizedReturnR: -1.030,
    liveNetPnLINR: -103.00,
    liveChargesINR: 2.97,
    liveCurrentCapitalINR: 897.00,
    liveWinRate: 0.0,
    liveProfitFactor: 0.00,
    liveTpPercent: 0.0,
    liveSlPercent: 100.0,
  },
  ETHUSDT: {
    assetKey: "ETHUSDT",
    assetLabel: "Ethereum (ETH/USDT 4H)",
    timeframe: "4H Swing",
    historicalTradesCount: 52,
    liveTradesCount: 0,
    avgNetR: 0.162,
    realizedReturnR: 8.42,
    netPnLINR: 842,
    winRate: 50.0,
    profitFactor: 1.35,
    maxDrawdownR: -9.20,
    tpPercent: 50.0,
    slPercent: 50.0,
    allocatedCapitalINR: 1000,
    totalPortfolioCapitalINR: 7000,
    description: "Filtered 4-Hour Donchian breakouts on Ethereum with LightGBM Top 25% quantile conviction above the 200 SMA.",
    liveAvgNetR: 0.000,
    liveRealizedReturnR: 0.00,
    liveNetPnLINR: 0.00,
    liveChargesINR: 0.00,
    liveCurrentCapitalINR: 1000.00,
    liveWinRate: 0.0,
    liveProfitFactor: 1.00,
    liveTpPercent: 0.0,
    liveSlPercent: 0.0,
  },
  SOLUSDT: {
    assetKey: "SOLUSDT",
    assetLabel: "Solana (SOL/USDT 4H)",
    timeframe: "4H Swing",
    historicalTradesCount: 36,
    liveTradesCount: 0,
    avgNetR: 0.180,
    realizedReturnR: 6.48,
    netPnLINR: 648,
    winRate: 55.5,
    profitFactor: 1.52,
    maxDrawdownR: -6.80,
    tpPercent: 55.5,
    slPercent: 44.5,
    allocatedCapitalINR: 1000,
    totalPortfolioCapitalINR: 7000,
    description: "Filtered 4-Hour Donchian breakouts on Solana with LightGBM Top 25% quantile conviction above the 200 SMA.",
    liveAvgNetR: 0.000,
    liveRealizedReturnR: 0.00,
    liveNetPnLINR: 0.00,
    liveChargesINR: 0.00,
    liveCurrentCapitalINR: 1000.00,
    liveWinRate: 0.0,
    liveProfitFactor: 1.00,
    liveTpPercent: 0.0,
    liveSlPercent: 0.0,
  },
  DOTUSDT: {
    assetKey: "DOTUSDT",
    assetLabel: "Polkadot (DOT/USDT 4H - 100% Cash Safe)",
    timeframe: "4H Swing",
    historicalTradesCount: 0,
    liveTradesCount: 0,
    avgNetR: 0.000,
    realizedReturnR: 0.00,
    netPnLINR: 0,
    winRate: 0.0,
    profitFactor: 1.00,
    maxDrawdownR: 0.00,
    tpPercent: 0.0,
    slPercent: 0.0,
    allocatedCapitalINR: 1000,
    totalPortfolioCapitalINR: 7000,
    description: "Autonomous cash preservation filter. 100% of trades suppressed by meta-model due to unfavorable risk/reward regime.",
    liveAvgNetR: 0.000,
    liveRealizedReturnR: 0.00,
    liveNetPnLINR: 0.00,
    liveChargesINR: 0.00,
    liveCurrentCapitalINR: 1000.00,
    liveWinRate: 0.0,
    liveProfitFactor: 1.00,
    liveTpPercent: 0.0,
    liveSlPercent: 0.0,
  },
  "GC=F": {
    assetKey: "GC=F",
    assetLabel: "Gold Futures (GC=F 1H)",
    timeframe: "1H Commodities",
    historicalTradesCount: 137,
    liveTradesCount: 21,
    avgNetR: 0.151,
    realizedReturnR: 16.91,
    netPnLINR: 1691,
    winRate: 49.7,
    profitFactor: 1.32,
    maxDrawdownR: -14.20,
    tpPercent: 49.7,
    slPercent: 50.3,
    allocatedCapitalINR: 1000,
    totalPortfolioCapitalINR: 7000,
    description: "Bi-directional 1-Hour Donchian breakout / breakdown on Gold Futures gated by retrained Stage 2 meta-classifier.",
    liveAvgNetR: 0.580,
    liveRealizedReturnR: 12.18,
    liveNetPnLINR: 1218.40,
    liveChargesINR: 76.07,
    liveCurrentCapitalINR: 2218.40,
    liveWinRate: 66.7,
    liveProfitFactor: 4.81,
    liveTpPercent: 66.7,
    liveSlPercent: 33.3,
    liveDescription: "Live 1-Hour Donchian breakout / breakdown on Gold Futures (GC=F) gated by calibrated Stage 2 meta-classifier. +12.18R (+₹1,218.40) net profit.",
  },
  "SI=F": {
    assetKey: "SI=F",
    assetLabel: "Silver Futures (SI=F 1H)",
    timeframe: "1H Commodities",
    historicalTradesCount: 103,
    liveTradesCount: 29,
    avgNetR: 0.158,
    realizedReturnR: 17.70,
    netPnLINR: 1770,
    winRate: 46.5,
    profitFactor: 1.28,
    maxDrawdownR: -15.40,
    tpPercent: 46.5,
    slPercent: 53.5,
    allocatedCapitalINR: 1000,
    totalPortfolioCapitalINR: 7000,
    description: "Bi-directional 1-Hour Donchian breakout / breakdown on Silver Futures gated by retrained Stage 2 meta-classifier.",
    liveAvgNetR: 0.241,
    liveRealizedReturnR: 7.00,
    liveNetPnLINR: 700.00,
    liveChargesINR: 61.89,
    liveCurrentCapitalINR: 1700.00,
    liveWinRate: 51.7,
    liveProfitFactor: 1.74,
    liveTpPercent: 51.7,
    liveSlPercent: 48.3,
    liveDescription: "Live 1-Hour Donchian breakout / breakdown on Silver Futures (SI=F) gated by calibrated Stage 2 meta-classifier. +7.00R (+₹700.00) net profit.",
  },
  "CL=F": {
    assetKey: "CL=F",
    assetLabel: "Crude Oil Futures (CL=F 1H)",
    timeframe: "1H Commodities",
    historicalTradesCount: 96,
    liveTradesCount: 19,
    avgNetR: 0.145,
    realizedReturnR: 16.24,
    netPnLINR: 1624,
    winRate: 44.0,
    profitFactor: 1.24,
    maxDrawdownR: -18.10,
    tpPercent: 44.0,
    slPercent: 56.0,
    allocatedCapitalINR: 1000,
    totalPortfolioCapitalINR: 7000,
    description: "Bi-directional 1-Hour Donchian breakout / breakdown on Crude Oil Futures gated by retrained Stage 2 meta-classifier.",
    liveAvgNetR: 0.284,
    liveRealizedReturnR: 5.40,
    liveNetPnLINR: 539.80,
    liveChargesINR: 33.49,
    liveCurrentCapitalINR: 1539.80,
    liveWinRate: 68.4,
    liveProfitFactor: 3.24,
    liveTpPercent: 68.4,
    liveSlPercent: 31.6,
    liveDescription: "Live 1-Hour Donchian breakout / breakdown on Crude Oil Futures (CL=F) gated by calibrated Stage 2 meta-classifier. +5.40R (+₹539.80) net profit.",
  },
};

interface PaperOnlyBannerProps {
  avgNetR?: number;
  netPnLINR?: number;
  isTaker: boolean;
  feePercent: number;
  closedTradesCount: number;
  selectedModelId?: string;
  selectedAsset?: string;
  assetData?: AssetPerformanceData;
  isLiveMode?: boolean;
  trades?: TradeOrder[];
  tradingFeePercent?: number;
}

export const PaperOnlyBanner: React.FC<PaperOnlyBannerProps> = ({
  avgNetR = 0.165,
  netPnLINR = 7870,
  isTaker,
  feePercent,
  closedTradesCount,
  selectedModelId = "4h-swing-meta-017",
  selectedAsset = "ALL",
  assetData,
  isLiveMode = true,
  trades = [],
  tradingFeePercent,
}) => {
  const is4HSwing = selectedModelId === "4h-swing-meta-017";
  const isCommodities = selectedModelId === "1h-commodities-rf";
  const isLegacy = !is4HSwing && !isCommodities;

  // Use dynamic assetData values if provided or lookup from map
  const resolved = assetData || ASSET_METRICS_MAP[selectedAsset] || ASSET_METRICS_MAP["ALL"];

  // Filter live trades array for selected asset
  const filteredLiveTrades = trades && trades.length > 0
    ? (selectedAsset && selectedAsset !== "ALL" ? trades.filter(t => t.symbol === selectedAsset) : trades)
    : [];

  const dynamicTotalFees = filteredLiveTrades.length > 0
    ? filteredLiveTrades.reduce((acc, t) => acc + (t.totalFeeINR || 0), 0)
    : (resolved.liveChargesINR ?? 140.20);

  const dynamicNetProfit = filteredLiveTrades.length > 0
    ? filteredLiveTrades.reduce((acc, t) => acc + (t.netPnLINR || 0), 0)
    : (resolved.liveNetPnLINR ?? 2354.00);

  const dynamicAvgNetR = filteredLiveTrades.length > 0
    ? filteredLiveTrades.reduce((acc, t) => acc + ((t.netPnLINR ?? 0) / 100), 0) / filteredLiveTrades.length
    : (resolved.liveAvgNetR ?? 0.336);

  const dynamicReturnR = filteredLiveTrades.length > 0
    ? filteredLiveTrades.reduce((acc, t) => acc + ((t.netPnLINR ?? 0) / 100), 0)
    : (resolved.liveRealizedReturnR ?? 23.54);

  const baseCapital = selectedAsset === "ALL" ? 7000 : 1000;
  const dynamicCapital = baseCapital + dynamicNetProfit;

  // Differentiate live mode vs historical mode
  const currentAvgNetR = isLiveMode ? dynamicAvgNetR : resolved.avgNetR;
  const currentReturnR = isLiveMode ? dynamicReturnR : resolved.realizedReturnR;
  const currentTradeCount = isLiveMode ? (filteredLiveTrades.length || resolved.liveTradesCount) : resolved.historicalTradesCount;

  const isPositiveExpectancy = !isLegacy && currentAvgNetR >= 0;
  const isCommodityAsset = ["GC=F", "SI=F", "CL=F"].includes(selectedAsset);
  const isAll = selectedAsset === "ALL";

  const feeModeString = isCommodityAsset
    ? "0.05% Round-Trip Institutional Friction Deducted"
    : isAll
    ? "Institutional Multi-Asset Friction Deducted (0.10% Crypto / 0.05% Commodities)"
    : "0.10% Round-Trip Taker Friction Deducted";

  const assetDisplayLabel = resolved.assetLabel || (isAll ? "Portfolio - All 7 Assets" : selectedAsset);

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
                {isLiveMode ? `LIVE REAL-TIME EXECUTION [${assetDisplayLabel}]` : `ACTIVE · POSITIVE EXPECTANCY [${assetDisplayLabel}]`}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-rose-50 text-rose-800 border border-rose-300 font-mono text-[11px] font-bold uppercase tracking-wider">
                <ShieldAlert className="w-3.5 h-3.5 text-rose-700" />
                RETIRED · Negative Expectancy at Live Stop Size
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
              Fee Mode: {feeModeString}
            </span>

            <span className="font-mono text-[11px] text-chrome-dim font-bold">
              ({currentTradeCount} {isLiveMode ? "Live Executions Tracked" : "Clean OOS Trades Evaluated"})
            </span>
          </div>

          <h1 className="font-brand text-2xl sm:text-3xl font-medium tracking-tight text-chrome-ink mt-1">
            {isLiveMode
              ? `Live Net Expectancy: ${currentAvgNetR >= 0 ? `+${currentAvgNetR.toFixed(3)}` : currentAvgNetR.toFixed(3)} R / trade (${currentReturnR >= 0 ? `+${currentReturnR.toFixed(2)}` : currentReturnR.toFixed(2)} R Realized)`
              : `Net Expectancy After Fees: ${currentAvgNetR >= 0 ? `+${currentAvgNetR.toFixed(3)}` : currentAvgNetR.toFixed(3)} R / trade`}
          </h1>

          {isLiveMode ? (
            <p className="font-body text-xs sm:text-sm text-chrome-dim leading-relaxed">
              <strong>Capital Given:</strong> ₹{resolved.allocatedCapitalINR.toLocaleString("en-IN", { minimumFractionDigits: 2 })} {isAll ? "(₹1,000 / asset)" : ""} &nbsp;|&nbsp;
              <strong>Current Balance:</strong> <span className={dynamicCapital >= resolved.allocatedCapitalINR ? "text-win font-bold" : "text-loss font-bold"}>₹{dynamicCapital.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span> &nbsp;|&nbsp;
              <strong>Shark Charges (w/ GST) Paid:</strong> ₹{dynamicTotalFees.toFixed(2)} &nbsp;|&nbsp;
              <strong>{currentTradeCount} Live Executions Tracked.</strong>
              {resolved.liveTradesCount === 0 ? " 100% Cash preservation safe below 200 SMA regime filter. Zero capital risked." : ""}
              {selectedAsset === "BTCUSDT" ? " Initial test trade booked at -1.025R; remaining period strictly preserved in 100% cash below 200 SMA." : ""}
            </p>
          ) : (
            <p className="font-body text-xs sm:text-sm text-chrome-dim leading-relaxed">
              {resolved.description}{" "}
              Validated across <strong>{resolved.historicalTradesCount} out-of-sample trades with institutional friction deducted</strong> ({currentAvgNetR >= 0 ? `+${currentAvgNetR.toFixed(3)}` : currentAvgNetR.toFixed(3)}R expectancy, {resolved.profitFactor.toFixed(2)} PF, {resolved.winRate.toFixed(1)}% WR).
            </p>
          )}
        </div>

        {/* Right: Key Big Numbers */}
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-4 lg:gap-6 shrink-0 border-t lg:border-t-0 lg:border-l border-chrome-edge pt-4 lg:pt-0 lg:pl-6">
          {/* Avg Net R */}
          <div className="flex flex-col min-w-[140px]">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[11px] uppercase font-bold text-chrome-dim">
                Avg Net R
              </span>
              <span className="text-[9px] font-mono uppercase px-1.5 py-0.2 rounded border bg-chrome-field text-chrome-dim border-chrome-line font-bold">
                {isLiveMode ? "Live Window" : (isCommodityAsset ? "5 bps" : isAll ? "Multi-Asset" : "10 bps")}
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
                {currentAvgNetR >= 0 ? `+${currentAvgNetR.toFixed(3)} R` : `${currentAvgNetR.toFixed(3)} R`}
              </span>
            </div>
            <span className="font-mono text-[10px] text-chrome-dim mt-0.5">
              {isLiveMode ? "per live execution" : `per closed ${isAll ? "portfolio trade" : `${selectedAsset} trade`}`}
            </span>
          </div>

          {/* Realized Net PnL / Return */}
          <div className="flex flex-col min-w-[140px] pl-4 border-l border-chrome-edge">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[11px] uppercase font-bold text-chrome-dim">
                {isLiveMode ? "Realized Live Return" : "Realized OOS Return"}
              </span>
              <span className="text-[9px] font-mono uppercase px-1.5 py-0.2 rounded border bg-chrome-field text-chrome-dim border-chrome-line font-bold">
                {isLiveMode ? "Live Edge" : "OOS Edge"}
              </span>
            </div>
            <div
              className={`font-mono text-3xl sm:text-4xl font-bold tracking-tight mt-1 ${
                isPositiveExpectancy ? "text-win" : "text-loss"
              }`}
            >
              {currentReturnR >= 0 ? `+${currentReturnR.toFixed(2)} R` : `${currentReturnR.toFixed(2)} R`}
            </div>
            <span className="font-mono text-[10px] text-chrome-dim mt-0.5">
              {isLiveMode
                ? `Net: ${dynamicNetProfit >= 0 ? `+₹${dynamicNetProfit.toFixed(2)}` : `-₹${Math.abs(dynamicNetProfit).toFixed(2)}`} (Fees: ₹${dynamicTotalFees.toFixed(2)})`
                : (isAll ? `₹${resolved.allocatedCapitalINR.toLocaleString("en-IN")} Allocated across 7 Assets` : `Dedicated ₹${resolved.allocatedCapitalINR.toLocaleString("en-IN")} Capital for ${selectedAsset}`)}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};

export default PaperOnlyBanner;
