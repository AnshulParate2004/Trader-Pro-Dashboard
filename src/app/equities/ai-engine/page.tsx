"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpRight,
  TrendingUp,
  ShieldCheck,
  AlertTriangle,
  BarChart2,
  Database,
  CheckCircle2,
  Zap,
  Activity,
  Layers,
  FileText,
  Info,
} from "lucide-react";
import UserAuthPill from "@/components/UserAuthPill";
import researchData from "@/data/us_research_summary.json";

export default function USEquitiesAiEnginePage() {
  const [activeTab, setActiveTab] = useState<
    "factor_surfaces" | "backtest_audit" | "permutation_null" | "sec_pit"
  >("factor_surfaces");

  const { benchmarks, factorInteractions, permutationNull, caveats, meta } = researchData;

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
              <span className="bg-amber-100 text-amber-800 border border-amber-300 font-mono text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                <Info className="w-3 h-3 text-amber-700" />
                <span>RESEARCH RESULTS (STATIC)</span>
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
        
        {/* Static Research Disclaimer & Segregation Banner */}
        <div className="bg-amber-50/80 border border-amber-300/80 rounded-xl p-4 text-xs font-mono text-amber-950 flex items-start gap-3 shadow-2xs">
          <Info className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-bold uppercase tracking-wider text-amber-900 flex items-center gap-2">
              <span>Historical Research Audit (Static Econometric Findings 2010–2026)</span>
              <span className="text-[10px] bg-amber-200/70 text-amber-900 px-1.5 py-0.5 rounded font-mono font-bold">
                Non-Streaming Benchmark
              </span>
            </div>
            <p className="text-amber-900/90 leading-relaxed font-sans">
              The metrics on this page represent rigorous, pre-registered econometric backtest results derived from official SEC EDGAR XBRL filings and historical daily bars.
              All findings are sourced directly from <code className="font-mono text-amber-950 font-bold">{meta.sources[0]}</code> and <code className="font-mono text-amber-950 font-bold">{meta.sources[1]}</code>.
              These figures are not live streaming quotes.
            </p>
          </div>
        </div>

        {/* 16-Year Quantitative Benchmark Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {benchmarks.slice(0, 4).map((bm) => (
            <div key={bm.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
              <div className="text-[11px] font-mono text-slate-500 uppercase font-bold flex items-center justify-between">
                <span>{bm.name}</span>
                <span className="text-blue-600">{bm.role}</span>
              </div>
              <div className={`text-2xl font-black font-mono mt-1 ${bm.id === 'T' ? 'text-emerald-700' : 'text-slate-900'}`}>
                {bm.cagr.toFixed(2)}% CAGR
              </div>
              <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                Sharpe: {bm.sharpe.toFixed(2)} · Max DD: {bm.maxDrawdown.toFixed(2)}%
              </div>
              <div className={`text-[10px] font-mono mt-1.5 font-bold ${
                bm.status.includes('REJECTED') ? 'text-rose-700' : 'text-emerald-700'
              }`}>
                {bm.status}
              </div>
            </div>
          ))}
        </div>

        {/* Caveats Box */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-2">
          <div className="font-mono text-xs font-bold text-slate-900 uppercase flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span>Key Institutional Caveats &amp; Empirical Findings</span>
          </div>
          <ul className="list-disc list-inside space-y-1.5 text-xs text-slate-600 font-sans leading-relaxed">
            {caveats.map((caveat, idx) => (
              <li key={idx}>{caveat}</li>
            ))}
          </ul>
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
            <span>Permutation Null Test ({permutationNull.runs.toLocaleString()} Runs)</span>
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
                    Pre-registered 8 factor pairs across {factorInteractions.totalGridCells} grid cells evaluated under month-clustered standard errors.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="bg-rose-100 text-rose-800 border border-rose-300 font-mono text-[10px] font-bold px-2 py-0.5 rounded-full">
                    Verdict: {factorInteractions.verdict} ({factorInteractions.tightenedBar2Pct}% pass)
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
                    {factorInteractions.pairs.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50/80">
                        <td className="p-2.5 font-bold text-blue-700">{p.id}</td>
                        <td className="p-2.5 font-semibold">{p.name}</td>
                        <td className="p-2.5">{p.totalCells}</td>
                        <td className={`p-2.5 font-bold ${p.bar1Cells > 0 ? "text-emerald-700" : "text-rose-700"}`}>
                          {p.bar1Cells} {p.bar1Cells === 1 ? "cell" : "cells"}
                        </td>
                        <td className={`p-2.5 font-bold ${p.bar2Cells > 0 ? "text-emerald-700" : "text-rose-700"}`}>
                          {p.bar2Cells} {p.bar2Cells === 1 ? "cell" : "cells"}
                        </td>
                        <td className="p-2.5 text-slate-500">{p.nullMean.toFixed(2)} cells</td>
                        <td className="p-2.5">{p.pValue.toFixed(4)}</td>
                        <td className="p-2.5 text-slate-600 font-semibold">{p.verdict}</td>
                      </tr>
                    ))}
                    <tr className="bg-slate-50 font-bold border-t-2 border-slate-300">
                      <td className="p-2.5 text-slate-900" colSpan={2}>TOTAL EVALUATED SPACE</td>
                      <td className="p-2.5">{factorInteractions.totalGridCells}</td>
                      <td className="p-2.5 text-emerald-700">
                        {factorInteractions.clusteredBar1Cells} ({factorInteractions.clusteredBar1Pct}%)
                      </td>
                      <td className="p-2.5 text-rose-700">
                        {factorInteractions.tightenedBar2Cells} ({factorInteractions.tightenedBar2Pct}%)
                      </td>
                      <td className="p-2.5 text-slate-600">{factorInteractions.nullExpectation.toFixed(2)} cells</td>
                      <td className="p-2.5 text-blue-800">{factorInteractions.permutationPValue.toFixed(4)}</td>
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
                    Within-Month Permutation Null Test ({permutationNull.runs.toLocaleString()} Runs, Seed {permutationNull.seed})
                  </h3>
                  <p className="text-xs text-slate-500 font-sans mt-0.5">
                    Shuffles forward returns across stocks strictly within each month, destroying factor predictive links while preserving market shocks.
                  </p>
                </div>
                <span className="font-mono text-xs bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md border border-slate-200">
                  Fixed Seed: {permutationNull.seed} · {permutationNull.runs.toLocaleString()} Permutations
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                  <div className="text-[11px] font-mono text-slate-500 uppercase">Null Distribution Mean</div>
                  <div className="text-xl font-black font-mono text-slate-900 mt-1">{permutationNull.nullMean.toFixed(2)} Cells</div>
                  <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                    Std: {permutationNull.nullStd.toFixed(2)} · Median: {permutationNull.nullMedian.toFixed(1)}
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                  <div className="text-[11px] font-mono text-slate-500 uppercase">Observed Tightened Bar 2</div>
                  <div className="text-xl font-black font-mono text-emerald-700 mt-1">
                    {permutationNull.observedTightened} Cells
                  </div>
                  <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                    Out of {permutationNull.observedTotalCells} grid cells ({((permutationNull.observedTightened / permutationNull.observedTotalCells) * 100).toFixed(2)}%)
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                  <div className="text-[11px] font-mono text-slate-500 uppercase">Empirical p-Value</div>
                  <div className="text-xl font-black font-mono text-blue-800 mt-1">p = {permutationNull.empiricalPValue.toFixed(4)}</div>
                  <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                    8 of {permutationNull.runs.toLocaleString()} runs reached &ge; {permutationNull.observedTightened}
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-700 space-y-2 font-sans leading-relaxed">
                <p>
                  <strong>Statistical Interpretation:</strong> While {permutationNull.observedTightened} cells is statistically unlikely under pure cross-sectional noise (<code className="font-mono text-blue-700">p = {permutationNull.empiricalPValue.toFixed(4)}</code>),
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
                  {benchmarks.map((bm) => (
                    <tr key={bm.id} className="hover:bg-slate-50">
                      <td className="p-2.5 font-bold text-blue-800">{bm.name}</td>
                      <td className="p-2.5 font-bold">{bm.cagr.toFixed(2)}%</td>
                      <td className="p-2.5">{bm.sharpe.toFixed(2)}</td>
                      <td className="p-2.5 text-rose-700 font-semibold">{bm.maxDrawdown.toFixed(2)}%</td>
                      <td className={`p-2.5 font-bold ${bm.return2020 >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                        {bm.return2020 >= 0 ? "+" : ""}{bm.return2020.toFixed(2)}%
                      </td>
                      <td className={`p-2.5 font-bold ${bm.return2022 >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                        {bm.return2022 >= 0 ? "+" : ""}{bm.return2022.toFixed(2)}%
                      </td>
                      <td className="p-2.5">{bm.alphaT === 0 ? "Benchmark" : `${bm.alphaT > 0 ? "+" : ""}${bm.alphaT.toFixed(2)}`}</td>
                      <td className={`p-2.5 font-bold ${
                        bm.status.includes("REJECTED") ? "text-rose-700" : bm.status.includes("CORE") ? "text-blue-700" : "text-slate-600"
                      }`}>
                        {bm.status}
                      </td>
                    </tr>
                  ))}
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
