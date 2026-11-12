"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpRight,
  TrendingUp,
  ShieldCheck,
  ShieldAlert,
  BarChart2,
  Database,
  CheckCircle2,
  XCircle,
  Zap,
  Activity,
  Layers,
  Sparkles,
  RefreshCw,
  Clock,
  Eye,
  SlidersHorizontal,
  FileText,
} from "lucide-react";
import UserAuthPill from "@/components/UserAuthPill";

export default function USEquitiesAiEnginePage() {
  const [activeTab, setActiveTab] = useState<"factor_surfaces" | "backtest_audit" | "permutation_null" | "sec_pit">("factor_surfaces");

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-16">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 px-4 py-3 sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center gap-3">
          <Link
            href="/equities"
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
            title="Back to US Equities Terminal"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-black text-slate-900 tracking-tight">
                TRADER-PRO / US EQUITIES AI ENGINE
              </span>
              <span className="bg-blue-100 text-blue-800 border border-blue-300 font-mono text-[10px] font-bold px-2 py-0.5 rounded-full">
                BOOK: us_equities ($)
              </span>
              <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 font-mono text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>POINT-IN-TIME VERIFIED</span>
              </span>
            </div>
            <div className="text-xs text-slate-500 font-mono">
              Quantitative Strategy Research, Factor Surfaces &amp; 16-Year SEC Econometric Audit
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Segregated Market Book Switcher */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs font-mono font-bold shadow-2xs">
            <Link
              href="/ai-engine"
              className="flex items-center gap-1.5 px-2.5 py-1 text-slate-500 hover:text-slate-900 hover:bg-slate-200/50 rounded-md transition-all cursor-pointer"
              title="Switch to 24/7 Perpetual Derivatives AI Engine (Crypto + Commodities, INR Base)"
            >
              <span>Perp AI Engine (₹)</span>
            </Link>
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 bg-white text-blue-900 rounded-md shadow-xs border border-blue-200"
              title="Active Engine: US Equities Quantitative Strategy Engine ($ USD Base)"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse"></span>
              <span>US AI Engine ($)</span>
            </div>
          </div>

          <Link
            href="/equities"
            className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white font-mono text-xs font-bold px-3 py-1.5 rounded-md transition-all shadow-xs cursor-pointer"
          >
            <span>US Stock Terminal</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>

          <UserAuthPill />
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 mt-6 space-y-6">
        
        {/* Compliance & Segregation Banner */}
        <div className="bg-blue-50/80 border border-blue-200 rounded-xl p-4 text-xs font-mono text-blue-950 flex items-start gap-3 shadow-2xs">
          <Database className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-bold uppercase tracking-wider text-blue-900">
              Dedicated US Equities Research &amp; Quantitative Engine (Zero Crypto / Commodity Co-mingling)
            </div>
            <p className="text-slate-600 leading-relaxed font-sans">
              This engine operates in complete separation from the 24/7 continuous perpetual derivatives models.
              All empirical findings and execution systems strictly obey SEC EDGAR filing acceptance dates (<code className="font-mono text-blue-800">filed &le; t</code>),
              causal next-day open fills (<code className="font-mono text-blue-800">O_(t+1)</code>), and institutional transaction friction models.
            </p>
          </div>
        </div>

        {/* 16-Year Quantitative Benchmark Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
            <div className="text-[11px] font-mono text-slate-500 uppercase font-bold flex items-center justify-between">
              <span>SPY Benchmark</span>
              <span className="text-blue-600">Core Index</span>
            </div>
            <div className="text-2xl font-black font-mono text-blue-800 mt-1">13.85% CAGR</div>
            <div className="text-[11px] font-mono text-slate-500 mt-0.5">Sharpe: 0.78 · Max DD: -33.72%</div>
            <div className="text-[10px] font-mono text-emerald-700 mt-1.5 font-bold">Validated Long-Term Core</div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
            <div className="text-[11px] font-mono text-slate-500 uppercase font-bold flex items-center justify-between">
              <span>Equal-Weight S&amp;P 500</span>
              <span className="text-slate-600">PIT Universe</span>
            </div>
            <div className="text-2xl font-black font-mono text-slate-900 mt-1">16.45% CAGR</div>
            <div className="text-[11px] font-mono text-slate-500 mt-0.5">Sharpe: 0.86 · Max DD: -37.80%</div>
            <div className="text-[10px] font-mono text-slate-600 mt-1.5 font-bold">Unweighted 30 Constituents</div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
            <div className="text-[11px] font-mono text-slate-500 uppercase font-bold flex items-center justify-between">
              <span>S2 Momentum (T)</span>
              <span className="text-emerald-700">Trend Strategy</span>
            </div>
            <div className="text-2xl font-black font-mono text-emerald-700 mt-1">17.85% CAGR</div>
            <div className="text-[11px] font-mono text-slate-500 mt-0.5">Sharpe: 0.80 · Max DD: -38.30%</div>
            <div className="text-[10px] font-mono text-emerald-700 mt-1.5 font-bold">+70.00% Return in 2020</div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
            <div className="text-[11px] font-mono text-slate-500 uppercase font-bold flex items-center justify-between">
              <span>Point-in-Time Value (V)</span>
              <span className="text-amber-700">PE Z-Score</span>
            </div>
            <div className="text-2xl font-black font-mono text-slate-900 mt-1">14.12% CAGR</div>
            <div className="text-[11px] font-mono text-slate-500 mt-0.5">Sharpe: 0.68 · Max DD: -44.15%</div>
            <div className="text-[10px] font-mono text-rose-700 mt-1.5 font-bold">Lacks Alpha Over Index</div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 gap-1 bg-white p-1 rounded-xl shadow-xs">
          <button
            onClick={() => setActiveTab("factor_surfaces")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
              activeTab === "factor_surfaces"
                ? "bg-blue-600 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Factor Interaction Surfaces</span>
          </button>

          <button
            onClick={() => setActiveTab("permutation_null")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
              activeTab === "permutation_null"
                ? "bg-blue-600 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Permutation Null Test (1,000 Runs)</span>
          </button>

          <button
            onClick={() => setActiveTab("backtest_audit")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
              activeTab === "backtest_audit"
                ? "bg-blue-600 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <BarChart2 className="w-3.5 h-3.5" />
            <span>16-Year Econometric Audit</span>
          </button>

          <button
            onClick={() => setActiveTab("sec_pit")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
              activeTab === "sec_pit"
                ? "bg-blue-600 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>SEC Causal Data Integrity</span>
          </button>
        </div>

        {/* Tab 1: Factor Surfaces & Interaction Grid */}
        {activeTab === "factor_surfaces" && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <h3 className="font-mono text-sm font-bold text-slate-900 uppercase">
                    Bivariate Factor Interaction Surfaces (Discovery 2010–19 vs Validation 2020–26)
                  </h3>
                  <p className="text-xs text-slate-500 font-sans mt-0.5">
                    Pre-registered 8 factor pairs across 170 grid cells evaluated under month-clustered standard errors.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="bg-rose-100 text-rose-800 border border-rose-300 font-mono text-[10px] font-bold px-2 py-0.5 rounded-full">
                    Verdict: Interactivity Not Supported (2.35% pass)
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-[11px] uppercase">
                      <th className="p-2.5">Pair ID</th>
                      <th className="p-2.5">Factor Interaction Model</th>
                      <th className="p-2.5">Total Cells</th>
                      <th className="p-2.5">Clustered Bar 1 (|t|&ge;2)</th>
                      <th className="p-2.5">Tightened Bar 2 (|t_val|&ge;1.5)</th>
                      <th className="p-2.5">Null Expectation</th>
                      <th className="p-2.5">Permutation p-val</th>
                      <th className="p-2.5">Scientific Verdict</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr className="hover:bg-slate-50/80">
                      <td className="p-2.5 font-bold text-blue-700">a</td>
                      <td className="p-2.5 font-semibold">value_z_own_pe &times; momentum_12_1</td>
                      <td className="p-2.5">25</td>
                      <td className="p-2.5 text-emerald-700 font-bold">3 cells</td>
                      <td className="p-2.5 text-rose-700 font-bold">0 cells</td>
                      <td className="p-2.5 text-slate-500">0.09 cells</td>
                      <td className="p-2.5">1.0000</td>
                      <td className="p-2.5 text-slate-600 font-semibold">Fails Tightened Bar</td>
                    </tr>
                    <tr className="hover:bg-slate-50/80">
                      <td className="p-2.5 font-bold text-blue-700">b</td>
                      <td className="p-2.5 font-semibold">pe_vs_sector &times; eps_growth_yoy</td>
                      <td className="p-2.5">25</td>
                      <td className="p-2.5 text-emerald-700 font-bold">2 cells</td>
                      <td className="p-2.5 text-emerald-700 font-bold">1 cell</td>
                      <td className="p-2.5 text-slate-500">0.07 cells</td>
                      <td className="p-2.5">0.0640</td>
                      <td className="p-2.5 text-slate-600 font-semibold">Isolated Cell (Noise)</td>
                    </tr>
                    <tr className="hover:bg-slate-50/80">
                      <td className="p-2.5 font-bold text-blue-700">c</td>
                      <td className="p-2.5 font-semibold">value_z_own_pe &times; ema20_50_state</td>
                      <td className="p-2.5">10</td>
                      <td className="p-2.5 text-emerald-700 font-bold">1 cell</td>
                      <td className="p-2.5 text-emerald-700 font-bold">1 cell</td>
                      <td className="p-2.5 text-slate-500">0.04 cells</td>
                      <td className="p-2.5">0.0360</td>
                      <td className="p-2.5 text-slate-600 font-semibold">Single Cell Pass</td>
                    </tr>
                    <tr className="hover:bg-slate-50/80">
                      <td className="p-2.5 font-bold text-blue-700">d</td>
                      <td className="p-2.5 font-semibold">value_z_own_pe &times; dist_above_support_atr</td>
                      <td className="p-2.5">25</td>
                      <td className="p-2.5 text-emerald-700 font-bold">1 cell</td>
                      <td className="p-2.5 text-emerald-700 font-bold">1 cell</td>
                      <td className="p-2.5 text-slate-500">0.08 cells</td>
                      <td className="p-2.5">0.0750</td>
                      <td className="p-2.5 text-rose-700 font-semibold">Support Floor Not Supported</td>
                    </tr>
                    <tr className="hover:bg-slate-50/80">
                      <td className="p-2.5 font-bold text-blue-700">e</td>
                      <td className="p-2.5 font-semibold">rsi14 &times; ema20_50_state</td>
                      <td className="p-2.5">10</td>
                      <td className="p-2.5 text-emerald-700 font-bold">1 cell</td>
                      <td className="p-2.5 text-rose-700 font-bold">0 cells</td>
                      <td className="p-2.5 text-slate-500">0.03 cells</td>
                      <td className="p-2.5">1.0000</td>
                      <td className="p-2.5 text-slate-600 font-semibold">Fails Tightened Bar</td>
                    </tr>
                    <tr className="hover:bg-slate-50/80">
                      <td className="p-2.5 font-bold text-blue-700">f</td>
                      <td className="p-2.5 font-semibold">dist_above_support_atr &times; volume_ratio_50d</td>
                      <td className="p-2.5">25</td>
                      <td className="p-2.5 text-rose-700 font-bold">0 cells</td>
                      <td className="p-2.5 text-rose-700 font-bold">0 cells</td>
                      <td className="p-2.5 text-slate-500">0.10 cells</td>
                      <td className="p-2.5">1.0000</td>
                      <td className="p-2.5 text-slate-500 font-semibold">Zero Alpha</td>
                    </tr>
                    <tr className="hover:bg-slate-50/80">
                      <td className="p-2.5 font-bold text-blue-700">g</td>
                      <td className="p-2.5 font-semibold">trendline_dist_atr &times; value_z_own_pe</td>
                      <td className="p-2.5">25</td>
                      <td className="p-2.5 text-emerald-700 font-bold">2 cells</td>
                      <td className="p-2.5 text-rose-700 font-bold">0 cells</td>
                      <td className="p-2.5 text-slate-500">0.09 cells</td>
                      <td className="p-2.5">1.0000</td>
                      <td className="p-2.5 text-slate-600 font-semibold">Fails Tightened Bar</td>
                    </tr>
                    <tr className="hover:bg-slate-50/80">
                      <td className="p-2.5 font-bold text-blue-700">h</td>
                      <td className="p-2.5 font-semibold">momentum_12_1 &times; rsi14</td>
                      <td className="p-2.5">25</td>
                      <td className="p-2.5 text-emerald-700 font-bold">2 cells</td>
                      <td className="p-2.5 text-emerald-700 font-bold">1 cell</td>
                      <td className="p-2.5 text-slate-500">0.10 cells</td>
                      <td className="p-2.5">0.0980</td>
                      <td className="p-2.5 text-slate-600 font-semibold">Single Cell Pass</td>
                    </tr>
                    <tr className="bg-slate-50 font-bold border-t-2 border-slate-300">
                      <td className="p-2.5 text-slate-900" colSpan={2}>TOTAL EVALUATED SPACE</td>
                      <td className="p-2.5">170</td>
                      <td className="p-2.5 text-emerald-700">12 (7.06%)</td>
                      <td className="p-2.5 text-rose-700">4 (2.35%)</td>
                      <td className="p-2.5 text-slate-600">0.60 cells</td>
                      <td className="p-2.5 text-blue-800">0.0080</td>
                      <td className="p-2.5 text-rose-800">NO SYSTEMIC EDGE</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Permutation Null Hypothesis Test */}
        {activeTab === "permutation_null" && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="font-mono text-sm font-bold text-slate-900 uppercase">
                    Within-Month Permutation Null Test (1,000 Runs, Seed 42)
                  </h3>
                  <p className="text-xs text-slate-500 font-sans mt-0.5">
                    Shuffles forward returns across stocks strictly within each month, destroying factor predictive links while preserving market shocks.
                  </p>
                </div>
                <span className="font-mono text-xs bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md border border-slate-200">
                  Fixed Seed: 42 · 1,000 Permutations
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                  <div className="text-[11px] font-mono text-slate-500 uppercase">Null Distribution Mean</div>
                  <div className="text-xl font-black font-mono text-slate-900 mt-1">0.60 Cells</div>
                  <div className="text-[10px] font-mono text-slate-500 mt-0.5">Std: 0.77 · Median: 0.0</div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                  <div className="text-[11px] font-mono text-slate-500 uppercase">Observed Tightened Bar 2</div>
                  <div className="text-xl font-black font-mono text-emerald-700 mt-1">4 Cells</div>
                  <div className="text-[10px] font-mono text-slate-500 mt-0.5">Out of 170 grid cells (2.35%)</div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                  <div className="text-[11px] font-mono text-slate-500 uppercase">Empirical p-Value</div>
                  <div className="text-xl font-black font-mono text-blue-800 mt-1">p = 0.0080</div>
                  <div className="text-[10px] font-mono text-slate-500 mt-0.5">8 of 1,000 runs reached &ge; 4</div>
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-700 space-y-2 font-sans leading-relaxed">
                <p>
                  <strong>Statistical Interpretation:</strong> While 4 cells is statistically unlikely under pure cross-sectional noise (<code className="font-mono text-blue-700">p = 0.0080</code>),
                  the 4 surviving cells are isolated across 4 completely distinct pairs (Pair b: 1, Pair c: 1, Pair d: 1, Pair h: 1).
                  They do not form contiguous, economically actionable surfaces.
                </p>
                <p>
                  In a production trading strategy, an allocation to an isolated cell without contiguous neighboring support is highly susceptible to regime shifts and factor rotation risks.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: 16-Year Econometric Audit */}
        {activeTab === "backtest_audit" && (
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
            <h3 className="font-mono text-sm font-bold text-slate-900 uppercase border-b border-slate-100 pb-3">
              16-Year Walk-Forward Performance (2010–2026) vs. Reference Benchmarks
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-[11px] uppercase">
                    <th className="p-2.5">Strategy / Benchmark</th>
                    <th className="p-2.5">CAGR (%)</th>
                    <th className="p-2.5">Sharpe Ratio</th>
                    <th className="p-2.5">Max Drawdown</th>
                    <th className="p-2.5">2020 Return</th>
                    <th className="p-2.5">2022 Return</th>
                    <th className="p-2.5">Newey-West Alpha t</th>
                    <th className="p-2.5">Production Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr className="hover:bg-slate-50">
                    <td className="p-2.5 font-bold text-blue-800">SPY Buy &amp; Hold</td>
                    <td className="p-2.5 font-bold">13.85%</td>
                    <td className="p-2.5">0.78</td>
                    <td className="p-2.5 text-rose-700 font-semibold">-33.72%</td>
                    <td className="p-2.5 text-emerald-700">+18.40%</td>
                    <td className="p-2.5 text-rose-700">-18.17%</td>
                    <td className="p-2.5">Benchmark</td>
                    <td className="p-2.5 text-blue-700 font-bold">BENCHMARK CORE</td>
                  </tr>
                  <tr className="hover:bg-slate-50">
                    <td className="p-2.5 font-bold text-slate-900">Equal-Weight Top 30</td>
                    <td className="p-2.5 font-bold">16.45%</td>
                    <td className="p-2.5">0.86</td>
                    <td className="p-2.5 text-rose-700 font-semibold">-37.80%</td>
                    <td className="p-2.5 text-emerald-700">+22.10%</td>
                    <td className="p-2.5 text-rose-700">-21.31%</td>
                    <td className="p-2.5">+1.42</td>
                    <td className="p-2.5 text-slate-600 font-bold">REFERENCE</td>
                  </tr>
                  <tr className="hover:bg-slate-50">
                    <td className="p-2.5 font-bold text-emerald-700">S2 Momentum (T)</td>
                    <td className="p-2.5 font-bold">17.85%</td>
                    <td className="p-2.5">0.80</td>
                    <td className="p-2.5 text-rose-700 font-semibold">-38.30%</td>
                    <td className="p-2.5 text-emerald-700 font-bold">+70.00%</td>
                    <td className="p-2.5 text-rose-700 font-bold">-29.36%</td>
                    <td className="p-2.5">+1.18</td>
                    <td className="p-2.5 text-emerald-700 font-bold">SHADOW TRACKING</td>
                  </tr>
                  <tr className="hover:bg-slate-50">
                    <td className="p-2.5 font-bold text-slate-800">Point-in-Time Value (V)</td>
                    <td className="p-2.5 font-bold">14.12%</td>
                    <td className="p-2.5">0.68</td>
                    <td className="p-2.5 text-rose-700 font-semibold">-44.15%</td>
                    <td className="p-2.5 text-emerald-700">+11.20%</td>
                    <td className="p-2.5 text-rose-700">-16.50%</td>
                    <td className="p-2.5">-0.34</td>
                    <td className="p-2.5 text-rose-700 font-bold">REJECTED (NO ALPHA)</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 4: SEC Point-in-Time Data Integrity */}
        {activeTab === "sec_pit" && (
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
            <h3 className="font-mono text-sm font-bold text-slate-900 uppercase border-b border-slate-100 pb-3">
              SEC EDGAR XBRL Point-in-Time Data Pipeline &amp; Verification Proof
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2">
                <div className="font-mono text-xs font-bold text-slate-900 uppercase flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Zero Lookahead Bias Mandate</span>
                </div>
                <p className="text-xs text-slate-600 font-sans leading-relaxed">
                  Financial statements are tagged exclusively by their SEC EDGAR acceptance/filing timestamp (<code className="font-mono text-blue-700">filed &le; t</code>).
                  Never uses period-end date. Q4 diluted EPS is derived strictly as FY minus the sum of Q1, Q2, and Q3.
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2">
                <div className="font-mono text-xs font-bold text-slate-900 uppercase flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>200-Sample Truncation Integrity Proof</span>
                </div>
                <p className="text-xs text-slate-600 font-sans leading-relaxed">
                  Recomputed 200 randomly sampled evaluation dates from historical past daily bars and past SEC filings alone.
                  Result: <strong>0 mismatches out of 200 dates (bit-for-bit parity confirmed)</strong>.
                </p>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
