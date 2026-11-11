"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, TrendingUp, ShieldAlert, DollarSign, Calendar, RefreshCw, BarChart2, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { BOOK_CONFIGS } from "@/lib/engineTypes";
import { DEFAULT_EQUITY_FEE_CONFIG } from "@/lib/equityFeeModel";

export default function USEquitiesPage() {
  const [trades, setTrades] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [lastUpdated, setLastUpdated] = useState<string>("Loading...");

  const fetchEquitiesData = async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/equities/trades");
      if (res.ok) {
        const data = await res.json();
        setTrades(data.trades || []);
        setMetrics(data.metrics || null);
        setLastUpdated(new Date().toLocaleTimeString());
      }
    } catch (e) {
      console.warn("Could not fetch equities data:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEquitiesData();
  }, []);

  const startingCapital = BOOK_CONFIGS.us_equities.startingCapital;
  const currentEquity = metrics?.currentEquityUSD ?? startingCapital;
  const netPnL = metrics?.netPnLUSD ?? 0.0;
  const winRate = metrics?.winRatePct ?? null;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-16">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 px-4 py-3 sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/terminal"
            className="p-1.5 rounded hover:bg-slate-100 text-slate-600 transition-colors"
            title="Back to Perp Terminal"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-black text-slate-900 tracking-tight">
                TRADER-PRO / US EQUITIES BOOK
              </span>
              <span className="bg-blue-100 text-blue-800 border border-blue-300 font-mono text-[10px] font-bold px-2 py-0.5 rounded-full">
                BOOK: us_equities
              </span>
              <span className="bg-amber-100 text-amber-900 border border-amber-300 font-mono text-[10px] font-bold px-2 py-0.5 rounded-full">
                PAPER ONLY
              </span>
            </div>
            <div className="text-xs text-slate-500 font-mono">
              NYSE/NASDAQ Daily Session (09:30 - 16:00 ET) · Point-in-Time Top 30 Large-Cap Universe
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/terminal"
            className="text-xs font-mono text-slate-600 hover:text-slate-900 bg-slate-100 px-2.5 py-1.5 rounded border border-slate-200 font-semibold"
          >
            24x7 Perp Book (Crypto/Cmdty)
          </Link>
          <Link
            href="/ai-engine"
            className="text-xs font-mono text-slate-600 hover:text-slate-900 bg-slate-100 px-2.5 py-1.5 rounded border border-slate-200 font-semibold"
          >
            AI Engine (Perp)
          </Link>
          <button
            onClick={fetchEquitiesData}
            disabled={isLoading}
            className="flex items-center gap-1 text-xs font-mono bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 px-2.5 py-1.5 rounded cursor-pointer transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-blue-600" : ""}`} />
            <span>{lastUpdated}</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 mt-6 space-y-6">
        {/* Paper-Trading Warning & Segregation Banner */}
        <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 text-xs font-mono text-amber-950 flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-bold uppercase tracking-wide">
              Isolated US Equities Paper Book (Strictly Regulated Session)
            </div>
            <p className="text-amber-900 font-sans text-xs">
              This book operates completely segregated from the 24/7 perpetual derivatives book. It models <strong>daily bars</strong> on the <strong>NYSE/NASDAQ calendar</strong> (09:30–16:00 ET).
              Signals are evaluated at the daily close ($t$) and filled at the next day open ($t+1$).
              <strong> Zero machine learning</strong> is deployed in this book; all tested systems are closed-form rule-based models.
            </p>
          </div>
        </div>

        {/* Institutional Alpha Verdict Callout */}
        <div className="bg-slate-900 text-white rounded-lg p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <XCircle className="w-5 h-5 text-rose-400" />
              <span className="font-mono text-xs font-black uppercase tracking-wider text-rose-400">
                16-Year Quantitative Audit Verdict (2010–2026): REJECT ACTIVE TRADING
              </span>
            </div>
            <span className="text-[10px] font-mono bg-slate-800 text-slate-300 border border-slate-700 px-2 py-0.5 rounded">
              Validated N=4,240 Daily Bars · 203 Monthly Rebalances
            </span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed font-sans">
            Under our pre-registered institutional rule (Alpha t-statistic &ge; 2.0 with validated 95% bootstrap CI excluding zero after friction),
            <strong> all 3 pre-registered active strategies failed to beat Buy-and-Hold the Index</strong>.
            Over the full 2010–2026 horizon, <strong>SPY Buy-and-Hold generated 13.92% CAGR</strong> and <strong>Equal-Weight Point-in-Time generated 18.32% CAGR</strong> (likely survivorship-inflated until Task B audit),
            decisively crushing active trend and pullback rules whose returns were degraded by cash-drag, friction, and whipsaws during sideways bull runs.
            <strong> In this test, no active strategy beat buy-and-hold on a risk-adjusted basis.</strong>
          </p>
        </div>

        {/* Portfolio Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
            <div className="text-xs font-mono text-slate-500 uppercase">Book Capital (USD)</div>
            <div className="text-2xl font-black font-mono text-slate-900 mt-1 tabular-nums">
              ${currentEquity.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] font-mono text-slate-400 mt-1">
              Starting Baseline: ${startingCapital.toLocaleString("en-US")}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
            <div className="text-xs font-mono text-slate-500 uppercase">Net Realized PnL</div>
            <div className={`text-2xl font-black font-mono mt-1 tabular-nums ${netPnL >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
              {netPnL >= 0 ? "+" : ""}${netPnL.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] font-mono text-slate-400 mt-1">
              After commissions &amp; regulatory fees
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
            <div className="text-xs font-mono text-slate-500 uppercase">Win Rate</div>
            <div className="text-2xl font-black font-mono text-slate-900 mt-1 tabular-nums">
              {winRate !== null ? `${winRate.toFixed(1)}%` : "N/A"}
            </div>
            <div className="text-[11px] font-mono text-slate-400 mt-1">
              {metrics?.closedTrades ?? 0} closed / {metrics?.totalTrades ?? 0} total trades
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
            <div className="text-xs font-mono text-slate-500 uppercase">Risk Budget</div>
            <div className="text-2xl font-black font-mono text-blue-700 mt-1 tabular-nums">
              1.0% / Trade
            </div>
            <div className="text-[11px] font-mono text-slate-400 mt-1">
              Max 8 positions · Max 20% equity cap
            </div>
          </div>
        </div>

        {/* 16-Year Quantitative Audit Comparison Table */}
        <div className="bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50">
            <div className="font-mono text-xs font-bold text-slate-800 uppercase flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-slate-600" />
              <span>Audit Performance Matrix vs Mandatory Benchmarks (2010–2026)</span>
            </div>
            <span className="text-[10px] font-mono text-slate-500">All-in Institutional Friction Deducted</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-100/70 border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="py-2.5 px-3">System / Strategy</th>
                  <th className="py-2.5 px-3">Universe Type</th>
                  <th className="py-2.5 px-3 text-right">CAGR</th>
                  <th className="py-2.5 px-3 text-right">Final Equity ($100k)</th>
                  <th className="py-2.5 px-3 text-right">Max Drawdown</th>
                  <th className="py-2.5 px-3 text-right">Sharpe</th>
                  <th className="py-2.5 px-3 text-right">Newey-West Alpha t</th>
                  <th className="py-2.5 px-3 text-center">Verdict</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr className="bg-emerald-50/50 font-bold">
                  <td className="py-2.5 px-3 text-emerald-950 flex flex-col">
                    <span>🏆 Benchmark 2: Equal-Weight Top 30</span>
                    <span className="text-[10px] text-amber-700 font-normal">likely survivorship-inflated until Task B is done</span>
                  </td>
                  <td className="py-2.5 px-3 text-slate-600">Point-in-Time Monthly</td>
                  <td className="py-2.5 px-3 text-right text-emerald-700">18.32%</td>
                  <td className="py-2.5 px-3 text-right text-emerald-700">$1,693,295</td>
                  <td className="py-2.5 px-3 text-right text-slate-700">-32.87%</td>
                  <td className="py-2.5 px-3 text-right text-slate-700">1.04</td>
                  <td className="py-2.5 px-3 text-right text-slate-500">Benchmark</td>
                  <td className="py-2.5 px-3 text-center text-emerald-700">OUTPERFORM</td>
                </tr>
                <tr className="bg-blue-50/40 font-bold">
                  <td className="py-2.5 px-3 text-blue-950">
                    <span>🥈 Benchmark 1: SPY S&amp;P 500 Buy &amp; Hold</span>
                  </td>
                  <td className="py-2.5 px-3 text-slate-600">Index ETF</td>
                  <td className="py-2.5 px-3 text-right text-blue-800">13.92%</td>
                  <td className="py-2.5 px-3 text-right text-blue-800">$896,115</td>
                  <td className="py-2.5 px-3 text-right text-slate-700">-33.72%</td>
                  <td className="py-2.5 px-3 text-right text-slate-700">0.85</td>
                  <td className="py-2.5 px-3 text-right text-slate-500">Benchmark</td>
                  <td className="py-2.5 px-3 text-center text-blue-700">SOLID CORE</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 text-slate-900 font-semibold">S2 Cross-Sectional Momentum (12-1m)</td>
                  <td className="py-2.5 px-3 text-slate-600">Point-in-Time Monthly</td>
                  <td className="py-2.5 px-3 text-right text-slate-800">12.65%</td>
                  <td className="py-2.5 px-3 text-right text-slate-800">$741,777</td>
                  <td className="py-2.5 px-3 text-right text-rose-700">-35.72%</td>
                  <td className="py-2.5 px-3 text-right text-slate-700">0.71</td>
                  <td className="py-2.5 px-3 text-right text-slate-700">+0.92 (p=0.359)</td>
                  <td className="py-2.5 px-3 text-center text-rose-600 font-semibold">REJECT</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 text-slate-900 font-semibold">S1 Trend Following (55d Donchian)</td>
                  <td className="py-2.5 px-3 text-slate-600">Point-in-Time Top 30</td>
                  <td className="py-2.5 px-3 text-right text-slate-800">5.57%</td>
                  <td className="py-2.5 px-3 text-right text-slate-800">$249,072</td>
                  <td className="py-2.5 px-3 text-right text-slate-700">-30.46%</td>
                  <td className="py-2.5 px-3 text-right text-slate-700">0.51</td>
                  <td className="py-2.5 px-3 text-right text-slate-700">+0.47 (p=0.640)</td>
                  <td className="py-2.5 px-3 text-center text-rose-600 font-semibold">REJECT</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 text-slate-900 font-semibold">S3 Pullback in Uptrend</td>
                  <td className="py-2.5 px-3 text-slate-600">Point-in-Time Top 30</td>
                  <td className="py-2.5 px-3 text-right text-slate-800">3.45%</td>
                  <td className="py-2.5 px-3 text-right text-slate-800">$176,856</td>
                  <td className="py-2.5 px-3 text-right text-emerald-700">-23.77%</td>
                  <td className="py-2.5 px-3 text-right text-slate-700">0.36</td>
                  <td className="py-2.5 px-3 text-right text-slate-700">-0.77 (p=0.441)</td>
                  <td className="py-2.5 px-3 text-center text-rose-600 font-semibold">REJECT</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Survivorship & Hindsight Bias Exposure */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs space-y-3">
          <div className="flex items-center gap-2 font-mono text-xs font-bold text-slate-800 uppercase">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span>Survivorship &amp; Hindsight Bias Spread (The Mag-7 Illusion)</span>
          </div>
          <p className="text-xs text-slate-600 font-sans leading-relaxed">
            When the exact same Equal-Weight buy-and-hold strategy was run on the <strong>Hindsight Watchlist</strong> (NVDA, GOOGL, MSFT, AMZN, AAPL, META, SONY),
            its CAGR surged from <strong>18.32% to 26.79%</strong>. This reveals an immense <strong>+8.48% annualized survivorship &amp; selection bias gap</strong>.
            Backtesting only on today&apos;s mega-cap winners creates a massive illusion of strategy outperformance that disappears under rigorous point-in-time constituent reconstruction.
          </p>
        </div>

        {/* Cost & Tax Sensitivity Disclosure */}
        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs space-y-3">
          <div className="flex items-center gap-2 font-mono text-xs font-bold text-slate-800 uppercase">
            <DollarSign className="w-4 h-4 text-slate-600" />
            <span>Cost Model &amp; Indian Tax Sensitivity (Configurable)</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
            <div className="bg-slate-50 p-3 rounded border border-slate-200 space-y-1">
              <div className="font-bold text-slate-700">Friction Parameters (Active in Backtest)</div>
              <div className="text-slate-600">Commission: ${DEFAULT_EQUITY_FEE_CONFIG.perShareCommissionUSD}/share (min ${DEFAULT_EQUITY_FEE_CONFIG.minCommissionUSD}, max {DEFAULT_EQUITY_FEE_CONFIG.maxCommissionPct}%)</div>
              <div className="text-slate-600">Slippage: {DEFAULT_EQUITY_FEE_CONFIG.slippageBpsMegaCap} bps (Mega-Cap) / {DEFAULT_EQUITY_FEE_CONFIG.slippageBpsLargeCap} bps (Large-Cap)</div>
              <div className="text-slate-600">US Regulatory: SEC 31 (0.00278%) + FINRA TAF ($0.000166/share sold)</div>
              <div className="text-slate-600">FX Markup: {DEFAULT_EQUITY_FEE_CONFIG.fxMarkupBps} bps (INR/USD)</div>
            </div>
            <div className="bg-slate-50 p-3 rounded border border-slate-200 space-y-1">
              <div className="font-bold text-amber-800 flex items-center gap-1">
                <span>Tax Assumptions (UNCONFIRMED · DEFAULT OFF)</span>
              </div>
              <div className="text-slate-600">TCS under LRS: 20% on remittances above ₹7L [UNCONFIRMED - OFF]</div>
              <div className="text-slate-600">Foreign Capital Gains: Slab rate (STCG) / 20% (LTCG &gt; 24m) [UNCONFIRMED - OFF]</div>
              <div className="text-slate-500 font-sans text-[11px] pt-1">
                Note: Tax rates are config parameters awaiting formal review with a Chartered Accountant (CA).
              </div>
            </div>
          </div>
        </div>

        {/* Forward Paper Trades Ledger Table */}
        <div className="bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50">
            <div className="font-mono text-xs font-bold text-slate-800 uppercase flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-600" />
              <span>US Equities Forward Paper Ledger (NYSE Session: 09:30–16:00 ET)</span>
            </div>
            <div className="font-mono text-[11px] text-slate-500">
              {trades.length} Records
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="py-2.5 px-3">Date (ET)</th>
                  <th className="py-2.5 px-3">Ticker</th>
                  <th className="py-2.5 px-3">Strategy</th>
                  <th className="py-2.5 px-3">Shares</th>
                  <th className="py-2.5 px-3">Entry ($)</th>
                  <th className="py-2.5 px-3">Stop ($)</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Net PnL ($)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {trades.length > 0 ? (
                  trades.map((t, idx) => (
                    <tr key={t.id || idx} className="hover:bg-slate-50/80">
                      <td className="py-2 px-3 text-slate-600">{t.date || "-"}</td>
                      <td className="py-2 px-3 font-bold text-slate-900">{t.symbol}</td>
                      <td className="py-2 px-3 text-slate-600">{t.strategy}</td>
                      <td className="py-2 px-3 text-slate-700">{t.shares}</td>
                      <td className="py-2 px-3 text-slate-700">${t.entryPrice?.toFixed(2)}</td>
                      <td className="py-2 px-3 text-slate-700">${t.stopLoss?.toFixed(2)}</td>
                      <td className="py-2 px-3 font-bold">{t.status}</td>
                      <td className={`py-2 px-3 font-bold ${(t.net_pnl_usd || 0) >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                        {(t.net_pnl_usd || 0) >= 0 ? "+" : ""}${t.net_pnl_usd?.toFixed(2) || "0.00"}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-500 font-sans">
                      Forward paper ledger sealed. Zero active executions opened (consistent with honest audit verdict rejecting active rule trading).
                      SpaceX (SPCX) signals logged as watchlist-only.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
