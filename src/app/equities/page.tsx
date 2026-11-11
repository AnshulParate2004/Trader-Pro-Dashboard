"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, TrendingUp, ShieldAlert, DollarSign, Calendar, RefreshCw, BarChart2 } from "lucide-react";
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
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-12">
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
              NYSE/NASDAQ Daily Session (09:30 - 16:00 ET) · Point-in-Time Constituent Universe
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/terminal"
            className="text-xs font-mono text-slate-600 hover:text-slate-900 bg-slate-100 px-2.5 py-1.5 rounded border border-slate-200"
          >
            24x7 Perp Book (Crypto/Cmdty)
          </Link>
          <Link
            href="/ai-engine"
            className="text-xs font-mono text-slate-600 hover:text-slate-900 bg-slate-100 px-2.5 py-1.5 rounded border border-slate-200"
          >
            AI Engine (Perp)
          </Link>
          <button
            onClick={fetchEquitiesData}
            disabled={isLoading}
            className="flex items-center gap-1 text-xs font-mono bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 px-2.5 py-1.5 rounded cursor-pointer transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
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
              Book Isolation Notice: Segregated US Equities Book
            </div>
            <p className="text-amber-900 font-sans text-xs">
              This book operates independently from the 24x7 Perpetual derivatives book. It runs strictly on <strong>daily bars</strong> aligned with the <strong>NYSE/NASDAQ trading calendar</strong> (09:30–16:00 ET).
              Signals are evaluated at the daily close and filled at the next day open. Fractional shares are modeled.
              <strong> Zero machine learning</strong> is deployed in this book; all models are pre-registered rule-based systems.
            </p>
          </div>
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

        {/* Cost & Tax Sensitivity Disclosure */}
        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs space-y-3">
          <div className="flex items-center gap-2 font-mono text-xs font-bold text-slate-800 uppercase">
            <DollarSign className="w-4 h-4 text-slate-600" />
            <span>Cost Model &amp; Indian Tax Sensitivity (Configurable)</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
            <div className="bg-slate-50 p-3 rounded border border-slate-200 space-y-1">
              <div className="font-bold text-slate-700">Friction Parameters (Active)</div>
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

        {/* Benchmark Comparison Notice */}
        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs space-y-2">
          <div className="flex items-center gap-2 font-mono text-xs font-bold text-slate-800 uppercase">
            <BarChart2 className="w-4 h-4 text-slate-600" />
            <span>Pre-Registered Strategies &amp; Mandatory Benchmarks</span>
          </div>
          <div className="text-xs text-slate-600 font-sans">
            Under Phase 3 rules, all strategies are benchmarked against <strong>SPY Buy-and-Hold</strong> and <strong>Equal-Weight Point-in-Time Universe Buy-and-Hold</strong>.
            A strategy is only recommended for adoption if its Newey-West alpha t-stat is &ge; 2.0 with validated 95% bootstrap confidence intervals excluding zero after all friction.
          </div>
        </div>

        {/* Forward Paper Trades Ledger Table */}
        <div className="bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
            <div className="font-mono text-xs font-bold text-slate-800 uppercase">
              US Equities Forward Paper Ledger (Sealed)
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
                    <td colSpan={8} className="py-8 text-center text-slate-400 font-sans">
                      Forward paper ledger initialized. Awaiting Phase 1-5 strategy execution and live daily bar signals.
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
