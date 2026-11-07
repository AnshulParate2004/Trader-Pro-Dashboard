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
    id: "1h-commodities-rf",
    strategy: "1H Macro Commodities (Donchian Breakout + 200 SMA + Random Forest Filter on Gold, Silver, Crude Oil)",
    timeframe: "1H",
    sample: "336 Clean OOS Trades (GC=F, SI=F, CL=F)",
    friction: "0.05% round-trip institutional friction",
    avgNetR: "+0.151 R (OOS) [ACTIVE WINNING ENGINE]",
    winRate: "True: 49.7% · Net: 45.2%",
    confidenceInterval: "95% CI [+0.038, +0.264] R",
    protocolCheck: "Clean Purged Walk-Forward (2024-2026) with zero lookahead, 100-tree Random Forest meta-classifier (P >= 0.0635), and full 5 bps institutional friction deducted. Generates 4.07 trades/day with +50.9R net profit.",
    verdict: "ACTIVE_EDGE",
    verdictLabel: "ACTIVE / VERIFIED OOS EDGE",
    notes: "Bi-directional Donchian breakout / breakdown on Gold, Silver, and Crude Oil. Gated by 100-tree RF meta-classifier (0.613 OOS ROC-AUC). Produces +0.1514R net expectancy with 1.32 PF across 336 out-of-sample trades.",
  },
  {
    id: "4h-swing-meta",
    strategy: "4H Swing Meta-Labeling (Donchian-20 Breakout + 200 SMA + LightGBM Filter)",
    timeframe: "4H",
    sample: "159 Clean OOS Trades",
    friction: "0.10% round-trip notional",
    avgNetR: "+0.175 R (OOS) [ACTIVE WINNING ENGINE]",
    winRate: "True: 52.8% · Net: 52.8%",
    confidenceInterval: "95% CI [+0.0820, +0.2676] R",
    protocolCheck: "Clean Purged Walk-Forward (2024-2026) with leak-free features, zero lookahead, and full 10 bps friction deducted. LightGBM Top 25% conviction filter triples return per trade and cuts drawdown by 76%.",
    verdict: "ACTIVE_EDGE",
    verdictLabel: "ACTIVE / VERIFIED OOS EDGE",
    notes: "Clean Purged Walk-Forward (2024-2026) with leak-free features, zero lookahead, and full 10 bps friction deducted. LightGBM Top 25% conviction filter triples return per trade and cuts drawdown by 76%.",
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
