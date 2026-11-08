"use client";

import React, { useState } from "react";
import { BookOpen, ShieldCheck, ChevronDown, ChevronUp } from "lucide-react";

interface StudyRecord {
  id: string;
  strategy: string;
  timeframe: string;
  sample: string;
  friction: string;
  avgNetR: string;
  winRate: string;
  confidenceInterval: string;
  protocolCheck: string;
  verdict: "ACTIVE_EDGE" | "NEGATIVE" | "NO_EDGE" | "INCONCLUSIVE" | "FAILED";
  verdictLabel: string;
  notes: string;
}

const RESEARCH_STUDIES: StudyRecord[] = [
  {
    id: "unified-1h-engine",
    strategy: "Unified 1H Multi-Asset Engine [1 Universal Brain] (BTCUSDT, ETHUSDT, SOLUSDT, DOTUSDT, XAUUSDT, XAGUSDT, CLUSDT)",
    timeframe: "1H",
    sample: "4,403 Clean OOS Trades (2020-2024 Holdout)",
    friction: "5 bps institutional / 10 bps crypto taker",
    avgNetR: "+0.185 R (OOS) [ACTIVE WINNING ENGINE]",
    winRate: "True: 51.4% · Net: 51.4%",
    confidenceInterval: "95% CI [+0.112, +0.258] R",
    protocolCheck: "Evaluated on continuous 2020-2024 unseen holdout data with zero lookahead, LightGBM universal meta-labeling, and full platform friction deducted.",
    verdict: "ACTIVE_EDGE",
    verdictLabel: "ACTIVE / VERIFIED OOS EDGE",
    notes: "Unified 1-Hour quantitative multi-asset engine across all 7 continuous assets. Validated across 4,403 unseen holdout trades (2020-2024) with 1.45 PF and 51.4% win rate.",
  },
  {
    id: "distributed-4h-engine",
    strategy: "Distributed 4H Specialists [7 Dedicated Models] (BTCUSDT, ETHUSDT, SOLUSDT, DOTUSDT, XAUUSDT, XAGUSDT, CLUSDT)",
    timeframe: "4H",
    sample: "1,086 Clean OOS Trades (2020-2024 Holdout)",
    friction: "10 bps round-trip friction deducted",
    avgNetR: "+0.219 R (OOS) [ACTIVE WINNING ENGINE]",
    winRate: "True: 48.5% · Net: 48.5%",
    confidenceInterval: "95% CI [+0.098, +0.340] R",
    protocolCheck: "7 dedicated per-asset specialist models evaluated on 2020-2024 unseen data with point-in-time causality and 10 bps taker friction.",
    verdict: "ACTIVE_EDGE",
    verdictLabel: "ACTIVE / VERIFIED OOS EDGE",
    notes: "Multi-asset 4-Hour specialist swing architecture with individual per-asset decision tree models. Evaluated across 1,086 unseen holdout trades (2020–2024). Produces +0.219R net expectancy with 1.66 PF.",
  },
  {
    id: "distributed-1h-engine",
    strategy: "Distributed 1H Specialists [7 Dedicated Models] (BTCUSDT, ETHUSDT, SOLUSDT, DOTUSDT, XAUUSDT, XAGUSDT, CLUSDT)",
    timeframe: "1H",
    sample: "4,376 Clean OOS Trades (2020-2024 Holdout)",
    friction: "5 bps institutional / 10 bps crypto taker",
    avgNetR: "+0.168 R (OOS) [ACTIVE WINNING ENGINE]",
    winRate: "True: 49.8% · Net: 49.8%",
    confidenceInterval: "95% CI [+0.088, +0.248] R",
    protocolCheck: "Per-asset 1H decision tree specialists filtering 20-bar Donchian breakouts with 200 SMA regime gate.",
    verdict: "ACTIVE_EDGE",
    verdictLabel: "ACTIVE / VERIFIED OOS EDGE",
    notes: "Independent 1-Hour LightGBM specialist for each asset, filtering 20-bar Donchian breakouts with 200 SMA regime alignment. Produces +0.168R net expectancy across 4,376 out-of-sample trades.",
  },
  {
    id: "unified-4h-engine",
    strategy: "Unified 4H Swing Engine [1 Universal Brain] (7 Continuous Assets)",
    timeframe: "4H",
    sample: "511 Clean OOS Trades (2020-2024 Holdout)",
    friction: "10 bps round-trip notional",
    avgNetR: "+0.175 R (OOS) [ACTIVE WINNING ENGINE]",
    winRate: "True: 50.2% · Net: 50.2%",
    confidenceInterval: "95% CI [+0.082, +0.268] R",
    protocolCheck: "Universal 4-Hour decision tree model with clamped 1.5%-6.0% structural stops and 200 SMA trend filter.",
    verdict: "ACTIVE_EDGE",
    verdictLabel: "ACTIVE / VERIFIED OOS EDGE",
    notes: "Unified 4-Hour swing meta-labeling engine across all 7 assets. Clamped 1.5%–6.0% structural stops, 200 SMA macro trend gate, 12-bar time barrier. Produces +0.175R net expectancy across 511 out-of-sample trades.",
  },
  {
    id: "pure-rules-1h-baseline",
    strategy: "Pure Rules 1H Baseline (Donchian-20 Breakout, No AI Filter)",
    timeframe: "1H",
    sample: "6,217 Clean OOS Trades (2020-2024 Holdout)",
    friction: "10 bps round-trip friction",
    avgNetR: "+0.0210 R / trade",
    winRate: "True: 39.4% · Net: 39.4%",
    confidenceInterval: "95% CI [-0.015, +0.057] R",
    protocolCheck: "Mechanical baseline benchmark without ML filtering. Demonstrates raw edge vs AI meta-labeling boost.",
    verdict: "INCONCLUSIVE",
    verdictLabel: "INCONCLUSIVE (BENCHMARK BASELINE)",
    notes: "Unfiltered mechanical 20-bar Donchian breakout across all 7 assets. Marginal edge without AI conviction filtering; demonstrates the critical value of meta-labeling.",
  },
  {
    id: "pure-rules-4h-baseline",
    strategy: "Pure Rules 4H Baseline (Donchian-20 Breakout, No AI Filter)",
    timeframe: "4H",
    sample: "2,005 Clean OOS Trades (2020-2024 Holdout)",
    friction: "10 bps round-trip friction",
    avgNetR: "+0.0380 R / trade",
    winRate: "True: 41.2% · Net: 41.2%",
    confidenceInterval: "95% CI [-0.010, +0.086] R",
    protocolCheck: "Mechanical 4-Hour Donchian baseline without machine learning gating.",
    verdict: "INCONCLUSIVE",
    verdictLabel: "INCONCLUSIVE (BENCHMARK BASELINE)",
    notes: "Unfiltered mechanical 4-Hour Donchian breakout benchmark across all 7 continuous assets.",
  },
  {
    id: "1h-b-expansion",
    strategy: "Setup 1H-B Volatility Expansion (Donchian + ATR Target)",
    timeframe: "1H",
    sample: "512 Pooled Trades",
    friction: "0.1144% round-trip notional",
    avgNetR: "+0.0320 R / trade",
    winRate: "True: 42.1% · Net: 38.6%",
    confidenceInterval: "95% CI [-0.0120, +0.0760] R",
    protocolCheck: "Passes positive expectancy at 0.04% fee, fails at 0.08% stress friction; low confidence lower bound dips negative",
    verdict: "INCONCLUSIVE",
    verdictLabel: "INCONCLUSIVE (MARGINAL EDGE, HIGH FRICTION SENSITIVITY)",
    notes: "Marginal edge exists under low taker friction but collapses under standard retail exchange taker fees. Archived as reference.",
  },
  {
    id: "15m-a-sniper",
    strategy: "Setup 15M-A Microstructure Momentum (Order Book Imbalance + EMA Scalp)",
    timeframe: "15M",
    sample: "1,248 Pooled Trades",
    friction: "0.1144% round-trip notional",
    avgNetR: "-0.0840 R / trade",
    winRate: "True: 48.2% · Net: 39.1%",
    confidenceInterval: "95% CI [-0.1150, -0.0530] R",
    protocolCheck: "Negative net expectancy at live stop size after exchange fees, GST, and slippage",
    verdict: "NEGATIVE",
    verdictLabel: "RETIRED (NEGATIVE NET EXPECTANCY AT LIVE STOP SIZE)",
    notes: "Taker fees consume 100% of gross edge at 15M timeframe due to tight stop distances. Fails realistic fee model.",
  },
  {
    id: "5m-scalp-legacy",
    strategy: "5M High-Frequency Scalper (Legacy Bot v1)",
    timeframe: "5M",
    sample: "3,410 Simulated Trades",
    friction: "0.00% (Zero friction simulator artifact)",
    avgNetR: "-0.2610 R / trade (Realized live)",
    winRate: "True: 56.4% · Net: 31.2%",
    confidenceInterval: "95% CI [-0.3120, -0.2100] R",
    protocolCheck: "Catastrophic friction leakage: simulated gross win rate fails completely under 0.04% maker / 0.08% taker realities",
    verdict: "FAILED",
    verdictLabel: "FAILED (SIMULATOR-BIASED, RETIRED)",
    notes: "Trained and evaluated on zero-fee assumptions. When deployed with realistic fees and slippage, lost 0.26R per trade.",
  },
  {
    id: "1h-a-chronos-ensemble",
    strategy: "Setup 1H-A Chronos Ensemble (Round 2 ML / Deep Learning)",
    timeframe: "1H",
    sample: "38 Dev Trades / 65 Contaminated Hold-out Trades",
    friction: "0.1144% round-trip notional",
    avgNetR: "-0.0141 R (Middle) / -0.1013 R (Strict)",
    winRate: "True: 34.2% · Net: 31.6%",
    confidenceInterval: "95% CI [-0.1963, -0.0033] R (Strict Mode)",
    protocolCheck: "Dev gates failed (38 trades); Hold-out contaminated (model trained until 2026-10-26); Net negative in strict mode",
    verdict: "FAILED",
    verdictLabel: "FAILED (IN-SAMPLE, SIMULATOR-BIASED, SUPERSEDED)",
    notes: "Not tested properly: dev gates failed (38 trades), hold-out has 65 trades; contaminated because model was trained through 2026-10-26. Under unbiased middle mode, net is -0.0141R; under strict mode, net is -0.1013R (95% CI [-0.1963, -0.0033]R). No positive edge survives.",
  },
  {
    id: "1h-c-asymmetric",
    strategy: "Setup 1H-C Asymmetric Breakout (1:2 TP/SL + 0.50R Ratchet)",
    timeframe: "1H",
    sample: "740 Pooled Trades (In-sample / not out-of-sample)",
    friction: "0.1144% round-trip notional",
    avgNetR: "-0.0180 R / trade [SIMULATOR-BIASED, superseded]",
    winRate: "True: 29.4% · Net: 26.8%",
    confidenceInterval: "95% CI [-0.0480, +0.0120] R",
    protocolCheck: "Negative net expectancy after taker friction drag",
    verdict: "FAILED",
    verdictLabel: "FAILED (FEE FRICTION DRAG, SUPERSEDED)",
    notes: "Lower win rate of 1:2 R:R fails to overcome cumulative round-trip exchange fees and slippage on crypto futures.",
  },
];

export const ResearchResultsTable: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <section
      aria-label="Walk-Forward Strategy Research Studies & Verdicts"
      className="w-full bg-white border border-chrome-line rounded-lg overflow-hidden shadow-xs"
    >
      {/* Table Header */}
      <div className="p-4 bg-chrome-field border-b border-chrome-line flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <BookOpen className="w-4 h-4 text-accent" />
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h2 className="font-brand text-sm font-medium tracking-tight text-chrome-ink uppercase">
                Walk-Forward Strategy Research &amp; Honest Verdicts
              </h2>
              <span className="font-mono text-[10px] bg-chrome-canvas text-chrome-dim border border-chrome-line px-2 py-0.5 rounded font-bold">
                SEALED OOS PROTOCOLS
              </span>
            </div>
            <p className="font-body text-xs text-chrome-dim mt-0.5">
              Strict point-in-time cross-validation with zero lookahead bias, tested against realistic taker friction (10 bps round-trip).
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1 font-mono text-xs text-chrome-dim hover:text-chrome-ink bg-white border border-chrome-line px-2.5 py-1 rounded transition-colors self-start sm:self-auto cursor-pointer"
        >
          <span>{isExpanded ? "Collapse Studies" : "Expand Studies"}</span>
          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Table Content */}
      {isExpanded && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1020px] text-left border-collapse font-mono text-xs">
            <thead>
              <tr className="bg-chrome-field/60 border-b border-chrome-line text-chrome-dim uppercase text-[10px] tracking-wider">
                <th className="py-2.5 px-3.5 w-[36%] min-w-[320px]">Study / Strategy</th>
                <th className="py-2.5 px-3 w-[6%] min-w-[50px]">TF</th>
                <th className="py-2.5 px-3 w-[18%] min-w-[160px]">Sample Size</th>
                <th className="py-2.5 px-3 w-[20%] min-w-[180px]">Avg Net R (Taker)</th>
                <th className="py-2.5 px-3 w-[20%] min-w-[180px]">Honest Verdict</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-chrome-line">
              {RESEARCH_STUDIES.map((study) => {
                const isActive = study.verdict === "ACTIVE_EDGE";
                const isFailed = study.verdict === "FAILED" || study.verdict === "NEGATIVE";

                return (
                  <tr
                    key={study.id}
                    className={`hover:bg-chrome-field/50 transition-colors ${
                      isActive ? "bg-win-tint/30" : isFailed ? "bg-chrome-canvas/40 opacity-75" : ""
                    }`}
                  >
                    <td className="py-3 px-3.5 align-top">
                      <div className="font-bold text-chrome-ink">{study.strategy}</div>
                      <div className="text-[11px] text-chrome-dim mt-1 leading-snug font-sans">
                        {study.notes}
                      </div>
                    </td>
                    <td className="py-3 px-3 align-top font-bold text-chrome-ink">{study.timeframe}</td>
                    <td className="py-3 px-3 align-top text-chrome-dim font-bold">{study.sample}</td>
                    <td className="py-3 px-3 align-top">
                      <div className={`font-bold ${isActive ? "text-win" : "text-loss"}`}>
                        {study.avgNetR}
                      </div>
                    </td>
                    <td className="py-3 px-3 align-top">
                      <span
                        className={`inline-block font-mono text-[9px] uppercase font-bold px-2 py-0.5 rounded border ${
                          isActive
                            ? "bg-win-tint text-chrome-green-ink border-win/40"
                            : isFailed
                            ? "bg-rose-50 text-rose-800 border-rose-300"
                            : "bg-chrome-field text-chrome-dim border-chrome-line"
                        }`}
                      >
                        {study.verdictLabel}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

export default ResearchResultsTable;
