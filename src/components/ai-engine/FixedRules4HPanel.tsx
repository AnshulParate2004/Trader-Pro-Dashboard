"use client";

import React, { useState, useEffect } from "react";
import {
  ShieldAlert,
  ShieldCheck,
  Download,
  AlertTriangle,
  TrendingUp,
  Percent,
  Activity,
  Layers,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Clock,
  ArrowRight,
  Info,
} from "lucide-react";

interface EquityPoint {
  index: number;
  date: string;
  equity: number;
  pnl: number;
  drawdown: number;
}

interface SummaryData {
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  profitFactor: number;
  meanNetR: number;
  bootstrapCI95: [number, number];
  preTaxPnLINR: number;
  grossGainsINR: number;
  tax30INR: number;
  afterTaxPnLINR: number;
  tdsTurnoverINR: number;
  maxDrawdownINR: number;
  maxDrawdownPct: number;
  exitDistribution: {
    stop: { count: number; pct: number };
    trail: { count: number; pct: number };
    time: { count: number; pct: number };
  };
  forwardTestStartDate: string;
  startingCapitalINR: number;
  riskPerTradeINR: number;
  openRiskCapINR: number;
  openRiskCapPct: number;
}

export default function FixedRules4HPanel() {
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [equityPoints, setEquityPoints] = useState<EquityPoint[]>([]);
  const [trades, setTrades] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterSymbol, setFilterSymbol] = useState<"ALL" | "BTCUSDT" | "ETHUSDT">("ALL");
  const [filterDirection, setFilterDirection] = useState<"ALL" | "LONG" | "SHORT">("ALL");
  const [showFullTradeLog, setShowFullTradeLog] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/fixed-rule-4h/trades?format=json");
        const data = await res.json();
        if (data.success) {
          setSummary(data.summary);
          setEquityPoints(data.equityPoints || []);
          setTrades(data.trades || []);
        }
      } catch (err) {
        console.error("Failed to load fixed rules 4h data", err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

  // Filtered trades for trade table
  const filteredTrades = trades.filter((t) => {
    if (filterSymbol !== "ALL" && t.symbol !== filterSymbol) return false;
    if (filterDirection !== "ALL" && t.direction !== filterDirection) return false;
    return true;
  });

  // Calculate SVG dimensions for Equity Curve
  const svgWidth = 800;
  const svgHeight = 220;
  const padding = { top: 20, right: 30, bottom: 30, left: 60 };

  const minEquity = equityPoints.length > 0 ? Math.min(...equityPoints.map((p) => p.equity)) * 0.98 : 6800;
  const maxEquity = equityPoints.length > 0 ? Math.max(...equityPoints.map((p) => p.equity)) * 1.02 : 9000;

  const getX = (idx: number) => {
    if (equityPoints.length <= 1) return padding.left;
    return padding.left + (idx / (equityPoints.length - 1)) * (svgWidth - padding.left - padding.right);
  };

  const getY = (val: number) => {
    return (
      svgHeight -
      padding.bottom -
      ((val - minEquity) / (maxEquity - minEquity || 1)) * (svgHeight - padding.top - padding.bottom)
    );
  };

  const pathD = equityPoints.length > 1
    ? equityPoints.reduce((acc, p, i) => `${acc} ${i === 0 ? "M" : "L"} ${getX(i)} ${getY(p.equity)}`, "")
    : "";

  const areaD = equityPoints.length > 1
    ? `${pathD} L ${getX(equityPoints.length - 1)} ${svgHeight - padding.bottom} L ${padding.left} ${svgHeight - padding.bottom} Z`
    : "";

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Header Banner & Identity */}
      <div className="bg-white border border-chrome-line rounded-lg p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-chrome-field border border-chrome-line flex items-center justify-center text-lg font-bold shrink-0">
            ⚖️
          </div>
          <div className="flex flex-col">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-brand text-base font-bold text-chrome-ink">
                Fixed-Rule 4H Trend Engine (v2)
              </h2>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-300">
                NO ML / PURE CODE
              </span>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-900 border border-blue-300">
                TIME: 4H
              </span>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-900 border border-emerald-300">
                BTC + ETH
              </span>
            </div>
            <p className="font-body text-xs text-chrome-dim mt-1 max-w-3xl leading-relaxed">
              Strict rule-based 20-bar Donchian breakout engine with 200 SMA trend filter, EMA50 slope, ATR stretch cap, 10-bar structural stops clamped [2.3%, 6.0%], and 3×ATR Chandelier trailing exit. Evaluated on completed bar <span className="font-mono font-bold text-chrome-ink">t</span>, strictly filled at open of bar <span className="font-mono font-bold text-chrome-ink">t+1</span>.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 shrink-0">
          <a
            href="/api/fixed-rule-4h/trades?format=csv"
            download="trades_fixed_rule_4h.csv"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-chrome-field hover:bg-chrome-line border border-chrome-line rounded font-mono text-xs font-bold text-chrome-ink transition-colors shadow-2xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download CSV Log</span>
          </a>
        </div>
      </div>

      {/* 2. Mandatory Statistical Caveat & Governance Notice */}
      <div className="bg-amber-50/70 border-l-4 border-amber-500 rounded-r-lg p-4 text-xs font-mono text-amber-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex flex-col gap-0.5 font-sans">
            <span className="font-bold text-amber-900 text-xs">
              Scientific Integrity Notice (docs/LESSONS.md):
            </span>
            <span className="text-amber-800 text-xs leading-relaxed">
              95% Block-Bootstrap CI is <strong className="font-mono">[-0.0283R, +0.4052R]</strong> (crosses zero). Strategy is not statistically distinguishable from noise at 95% confidence. <strong>Gate 7 Residual Alpha vs Buy-and-Hold fails (t_HAC = 1.267 &lt; 2.0)</strong>. Forward paper testing started on <strong className="font-mono">2026-10-31</strong>.
            </span>
          </div>
        </div>
        <div className="bg-white/80 border border-amber-300 rounded px-2.5 py-1 text-[11px] font-mono font-bold text-amber-900 shrink-0">
          Forward Start: 2026-10-31
        </div>
      </div>

      {/* 3. Key Metrics Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total Trades & Win Rate */}
        <div className="bg-white border border-chrome-line rounded-lg p-3.5 flex flex-col shadow-2xs">
          <span className="text-[10px] font-mono uppercase font-bold text-chrome-dim">Trades & Win Rate</span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-lg font-bold text-chrome-ink font-mono">{summary?.totalTrades ?? 134}</span>
            <span className="text-xs text-chrome-dim font-mono">({summary?.winRate ?? 32.1}%)</span>
          </div>
          <span className="text-[10px] text-chrome-dim mt-0.5">43 Wins / 91 Losses</span>
        </div>

        {/* Mean Net R & 95% CI */}
        <div className="bg-white border border-chrome-line rounded-lg p-3.5 flex flex-col shadow-2xs">
          <span className="text-[10px] font-mono uppercase font-bold text-chrome-dim">Mean Net R</span>
          <span className="text-lg font-bold text-emerald-700 font-mono mt-1">
            {summary ? (summary.meanNetR >= 0 ? `+${summary.meanNetR.toFixed(3)}R` : `${summary.meanNetR.toFixed(3)}R`) : "+0.192R"}
          </span>
          <span className="text-[9px] font-mono text-chrome-dim mt-0.5 truncate" title="[-0.028R, +0.405R]">
            95% CI: [-0.028R, +0.405R]
          </span>
        </div>

        {/* Profit Factor */}
        <div className="bg-white border border-chrome-line rounded-lg p-3.5 flex flex-col shadow-2xs">
          <span className="text-[10px] font-mono uppercase font-bold text-chrome-dim">Profit Factor</span>
          <span className="text-lg font-bold text-emerald-700 font-mono mt-1">
            {summary?.profitFactor ?? 1.47}
          </span>
          <span className="text-[10px] text-chrome-dim mt-0.5">Gross Win / Loss</span>
        </div>

        {/* Pre-Tax PnL */}
        <div className="bg-white border border-chrome-line rounded-lg p-3.5 flex flex-col shadow-2xs">
          <span className="text-[10px] font-mono uppercase font-bold text-chrome-dim">Pre-Tax PnL (₹7k Base)</span>
          <span className="text-lg font-bold text-emerald-700 font-mono mt-1">
            +₹{summary?.preTaxPnLINR?.toLocaleString() ?? "1,800.84"}
          </span>
          <span className="text-[10px] text-chrome-dim mt-0.5">+25.7% gross on ₹7k</span>
        </div>

        {/* Indian Tax 30% Impact */}
        <div className="bg-white border border-rose-200 rounded-lg p-3.5 flex flex-col shadow-2xs bg-rose-50/20">
          <span className="text-[10px] font-mono uppercase font-bold text-rose-800">After-Tax Net (30% 115BBH)</span>
          <span className="text-lg font-bold text-chrome-ink font-mono mt-1">
            +₹{summary?.afterTaxPnLINR?.toLocaleString() ?? "109.57"}
          </span>
          <span className="text-[9px] font-mono text-rose-700 mt-0.5 truncate" title="Tax: ₹1,691.27 (93.9% of gains)">
            Tax: ₹1,691 (93.9% of PnL)
          </span>
        </div>

        {/* Capital & Open Risk Cap */}
        <div className="bg-white border border-chrome-line rounded-lg p-3.5 flex flex-col shadow-2xs">
          <span className="text-[10px] font-mono uppercase font-bold text-chrome-dim">Risk Cap (Gate 6)</span>
          <span className="text-lg font-bold text-chrome-ink font-mono mt-1">
            ₹70 / trade
          </span>
          <span className="text-[10px] text-chrome-dim mt-0.5 font-mono">
            Max Risk: 2% (₹140) / 2 pos
          </span>
        </div>
      </div>

      {/* 4. Equity Curve & Exit Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Equity Curve SVG Chart */}
        <div className="lg:col-span-2 bg-white border border-chrome-line rounded-lg p-5 shadow-xs flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-chrome-edge">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              <h3 className="font-mono text-xs font-bold uppercase text-chrome-ink">
                Portfolio Cumulative Equity Curve (₹7,000 Starting Capital)
              </h3>
            </div>
            <div className="text-[11px] font-mono text-chrome-dim">
              Ending: <strong className="text-chrome-ink font-bold font-mono">₹{summary ? (7000 + summary.preTaxPnLINR).toFixed(2) : "8,800.84"}</strong> | Max DD: <strong className="text-rose-600 font-bold font-mono">-₹{summary?.maxDrawdownINR ?? "632.11"} ({summary?.maxDrawdownPct ?? "7.66"}%)</strong>
            </div>
          </div>

          <div className="w-full mt-3 overflow-x-auto">
            <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-48">
              <defs>
                <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              <line x1={padding.left} y1={padding.top} x2={svgWidth - padding.right} y2={padding.top} stroke="#e5e7eb" strokeDasharray="3 3" />
              <line x1={padding.left} y1={svgHeight / 2} x2={svgWidth - padding.right} y2={svgHeight / 2} stroke="#e5e7eb" strokeDasharray="3 3" />
              <line x1={padding.left} y1={svgHeight - padding.bottom} x2={svgWidth - padding.right} y2={svgHeight - padding.bottom} stroke="#9ca3af" />

              {/* Baseline ₹7,000 */}
              <line
                x1={padding.left}
                y1={getY(7000)}
                x2={svgWidth - padding.right}
                y2={getY(7000)}
                stroke="#6b7280"
                strokeDasharray="4 4"
                strokeWidth="1"
              />
              <text x={padding.left + 5} y={getY(7000) - 4} fontSize="9" fill="#6b7280" fontFamily="monospace">
                ₹7,000 Base
              </text>

              {/* Equity Area & Line */}
              {areaD && <path d={areaD} fill="url(#equityGrad)" />}
              {pathD && <path d={pathD} fill="none" stroke="#059669" strokeWidth="2.0" />}

              {/* Y Axis Labels */}
              <text x={padding.left - 8} y={padding.top + 4} textAnchor="end" fontSize="9" fill="#9ca3af" fontFamily="monospace">
                ₹{Math.round(maxEquity)}
              </text>
              <text x={padding.left - 8} y={svgHeight / 2 + 3} textAnchor="end" fontSize="9" fill="#9ca3af" fontFamily="monospace">
                ₹{Math.round((maxEquity + minEquity) / 2)}
              </text>
              <text x={padding.left - 8} y={svgHeight - padding.bottom} textAnchor="end" fontSize="9" fill="#9ca3af" fontFamily="monospace">
                ₹{Math.round(minEquity)}
              </text>

              {/* X Axis Labels */}
              <text x={padding.left} y={svgHeight - 10} fontSize="9" fill="#9ca3af" fontFamily="monospace">
                2020 (Trade 1)
              </text>
              <text x={svgWidth / 2} y={svgHeight - 10} textAnchor="middle" fontSize="9" fill="#9ca3af" fontFamily="monospace">
                2023 (Trade 67)
              </text>
              <text x={svgWidth - padding.right} y={svgHeight - 10} textAnchor="end" fontSize="9" fill="#9ca3af" fontFamily="monospace">
                2026 (Trade 134)
              </text>
            </svg>
          </div>
        </div>

        {/* Exit & Split Diagnostics */}
        <div className="bg-white border border-chrome-line rounded-lg p-5 shadow-xs flex flex-col justify-between">
          <div className="flex flex-col gap-3">
            <h3 className="font-mono text-xs font-bold uppercase text-chrome-ink pb-2 border-b border-chrome-edge">
              Exit Type & Asset Breakdown
            </h3>

            {/* Exit Distribution */}
            <div className="flex flex-col gap-2">
              <span className="text-[11px] font-mono text-chrome-dim font-bold">Exit Distribution (134 Trades):</span>
              <div className="flex flex-col gap-1.5 font-mono text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-chrome-dim flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                    Stop Loss (Initial SL)
                  </span>
                  <span className="font-bold text-rose-700">8.2% (11 trades)</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-chrome-dim flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    Chandelier Trailing Stop
                  </span>
                  <span className="font-bold text-emerald-700">79.9% (107 trades)</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-chrome-dim flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                    Time Barrier (42 bars)
                  </span>
                  <span className="font-bold text-amber-700">11.9% (16 trades)</span>
                </div>
              </div>
            </div>

            {/* Directional Split */}
            <div className="flex flex-col gap-2 pt-3 border-t border-chrome-edge">
              <span className="text-[11px] font-mono text-chrome-dim font-bold">Directional Performance:</span>
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="p-2 rounded bg-emerald-50 border border-emerald-200 flex flex-col">
                  <span className="font-bold text-emerald-900">LONG (82 trades)</span>
                  <span className="text-emerald-700 text-[11px] mt-0.5">WR: 34.1% · PF: 1.93</span>
                  <span className="text-emerald-800 font-bold mt-1">+0.344R (+₹1,972.63)</span>
                </div>
                <div className="p-2 rounded bg-rose-50 border border-rose-200 flex flex-col">
                  <span className="font-bold text-rose-900">SHORT (52 trades)</span>
                  <span className="text-rose-700 text-[11px] mt-0.5">WR: 28.8% · PF: 0.78</span>
                  <span className="text-rose-800 font-bold mt-1">-0.109R (-₹171.79)</span>
                </div>
              </div>
            </div>
          </div>

          <div className="text-[10px] text-chrome-dim mt-3 pt-2 border-t border-chrome-edge font-sans leading-tight">
            *Indian Section 194S 1% TDS Turnover Impact: estimated <strong>₹2,368.26</strong> across 6.8-year turnover if applied on Indian VDA exchanges.
          </div>
        </div>
      </div>

      {/* 5. Validation Gates 1-7 Audit Table */}
      <div className="bg-white border border-chrome-line rounded-lg p-5 shadow-xs flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-chrome-ink" />
            <h3 className="font-mono text-xs font-bold uppercase text-chrome-ink">
              Governance & Validation Gates Audit (docs/LESSONS.md)
            </h3>
          </div>
          <span className="text-[11px] font-mono text-chrome-dim">
            Methodology: Strict falsification protocols
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs border-collapse">
            <thead>
              <tr className="border-b border-chrome-line bg-chrome-field/50 text-[11px] text-chrome-dim">
                <th className="py-2 px-3 font-bold">Gate</th>
                <th className="py-2 px-3 font-bold">Gate Name</th>
                <th className="py-2 px-3 font-bold">Pass Requirement</th>
                <th className="py-2 px-3 font-bold">Observed Verification</th>
                <th className="py-2 px-3 font-bold text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-chrome-edge">
              <tr>
                <td className="py-2 px-3 font-bold text-chrome-ink">Gate 1</td>
                <td className="py-2 px-3">Zero-Lookahead Verification</td>
                <td className="py-2 px-3 text-chrome-dim">Decision at t uses only bars &lt;= t</td>
                <td className="py-2 px-3 text-chrome-ink">Unit test confirmed; next-bar fill</td>
                <td className="py-2 px-3 text-center">
                  <span className="px-2 py-0.5 rounded font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px]">
                    PASS
                  </span>
                </td>
              </tr>

              <tr>
                <td className="py-2 px-3 font-bold text-chrome-ink">Gate 2</td>
                <td className="py-2 px-3">Noise Null Invariant</td>
                <td className="py-2 px-3 text-chrome-dim">|Mean Gross R| &lt;= 0.01R on GBM</td>
                <td className="py-2 px-3 text-chrome-ink">-0.0083R across 100 GBM seeds</td>
                <td className="py-2 px-3 text-center">
                  <span className="px-2 py-0.5 rounded font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px]">
                    PASS
                  </span>
                </td>
              </tr>

              <tr>
                <td className="py-2 px-3 font-bold text-chrome-ink">Gate 3</td>
                <td className="py-2 px-3">Execution Realism</td>
                <td className="py-2 px-3 text-chrome-dim">Fill at t+1 Open; Stop beats Trail</td>
                <td className="py-2 px-3 text-chrome-ink">Same-bar collision books Stop first</td>
                <td className="py-2 px-3 text-center">
                  <span className="px-2 py-0.5 rounded font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px]">
                    PASS
                  </span>
                </td>
              </tr>

              <tr>
                <td className="py-2 px-3 font-bold text-chrome-ink">Gate 4</td>
                <td className="py-2 px-3">Cost Friction Feasibility</td>
                <td className="py-2 px-3 text-chrome-dim">cost_R &lt;= 0.05 (11.44 bps taker)</td>
                <td className="py-2 px-3 text-chrome-ink">cost_R = 0.0497R at 2.3% min stop</td>
                <td className="py-2 px-3 text-center">
                  <span className="px-2 py-0.5 rounded font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px]">
                    PASS
                  </span>
                </td>
              </tr>

              <tr>
                <td className="py-2 px-3 font-bold text-chrome-ink">Gate 5</td>
                <td className="py-2 px-3">Sealed Out-of-Sample Integrity</td>
                <td className="py-2 px-3 text-chrome-dim">Unseen holdout verification</td>
                <td className="py-2 px-3 text-chrome-ink">Forward paper log post-2026-10-31</td>
                <td className="py-2 px-3 text-center">
                  <span className="px-2 py-0.5 rounded font-bold bg-blue-100 text-blue-800 border border-blue-300 text-[10px]">
                    PASS*
                  </span>
                </td>
              </tr>

              <tr>
                <td className="py-2 px-3 font-bold text-chrome-ink">Gate 6</td>
                <td className="py-2 px-3">Dynamic Risk Normalization</td>
                <td className="py-2 px-3 text-chrome-dim">R = Net PnL / Entry Risk INR</td>
                <td className="py-2 px-3 text-chrome-ink">₹70 risk per trade; 2% portfolio cap</td>
                <td className="py-2 px-3 text-center">
                  <span className="px-2 py-0.5 rounded font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px]">
                    PASS
                  </span>
                </td>
              </tr>

              {/* Gate 7 Highlighted Failure */}
              <tr className="bg-rose-50/40">
                <td className="py-2 px-3 font-bold text-rose-900">Gate 7</td>
                <td className="py-2 px-3 font-bold text-rose-900">Residual Alpha Attribution</td>
                <td className="py-2 px-3 text-rose-800 font-bold">t_HAC &gt;= 2.0 vs Buy-and-Hold</td>
                <td className="py-2 px-3 text-rose-900 font-bold">t_HAC = 1.267 (p = 0.205)</td>
                <td className="py-2 px-3 text-center">
                  <span className="px-2 py-0.5 rounded font-bold bg-rose-200 text-rose-900 border border-rose-400 text-[10px]">
                    FAIL
                  </span>
                </td>
              </tr>

              {/* Random Baseline Comparison */}
              <tr className="bg-amber-50/30">
                <td className="py-2 px-3 font-bold text-amber-900">Null Baseline</td>
                <td className="py-2 px-3">Random-Entry Coin Flips</td>
                <td className="py-2 px-3 text-chrome-dim">p-value &lt; 0.05 vs 200 random seeds</td>
                <td className="py-2 px-3 text-amber-900">94.5th percentile (p = 0.0550)</td>
                <td className="py-2 px-3 text-center">
                  <span className="px-2 py-0.5 rounded font-bold bg-amber-200 text-amber-900 border border-amber-400 text-[10px]">
                    FAIL
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-chrome-dim font-sans leading-relaxed">
          *Gate 5 Note: Historical 2020-2026 data was previously observed during exploratory research; true out-of-sample confirmation relies on the forward paper execution log recorded from 2026-10-31 onwards.
        </p>
      </div>

      {/* 6. Raw Trade Log Preview Table */}
      <div className="bg-white border border-chrome-line rounded-lg p-5 shadow-xs flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-chrome-edge">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-chrome-ink" />
            <h3 className="font-mono text-xs font-bold uppercase text-chrome-ink">
              Reference Trade Execution Log ({filteredTrades.length} Trades)
            </h3>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 font-mono text-xs">
            <select
              value={filterSymbol}
              onChange={(e) => setFilterSymbol(e.target.value as any)}
              className="bg-chrome-field border border-chrome-line rounded px-2 py-1 text-chrome-ink"
            >
              <option value="ALL">All Assets</option>
              <option value="BTCUSDT">BTCUSDT</option>
              <option value="ETHUSDT">ETHUSDT</option>
            </select>

            <select
              value={filterDirection}
              onChange={(e) => setFilterDirection(e.target.value as any)}
              className="bg-chrome-field border border-chrome-line rounded px-2 py-1 text-chrome-ink"
            >
              <option value="ALL">All Directions</option>
              <option value="LONG">LONG Only</option>
              <option value="SHORT">SHORT Only</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto max-h-96">
          <table className="w-full text-left font-mono text-xs border-collapse">
            <thead className="sticky top-0 bg-chrome-field border-b border-chrome-line">
              <tr className="text-[10px] text-chrome-dim uppercase">
                <th className="py-2 px-2.5">Symbol</th>
                <th className="py-2 px-2.5">Side</th>
                <th className="py-2 px-2.5">Signal Time</th>
                <th className="py-2 px-2.5">Entry Time</th>
                <th className="py-2 px-2.5">Exit Time</th>
                <th className="py-2 px-2.5">Entry Price</th>
                <th className="py-2 px-2.5">Stop %</th>
                <th className="py-2 px-2.5">Exit Type</th>
                <th className="py-2 px-2.5">Net R</th>
                <th className="py-2 px-2.5">Net PnL</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-chrome-edge">
              {filteredTrades.slice(0, showFullTradeLog ? filteredTrades.length : 25).map((t, idx) => (
                <tr key={idx} className="hover:bg-chrome-field/30">
                  <td className="py-1.5 px-2.5 font-bold text-chrome-ink">{t.symbol}</td>
                  <td className="py-1.5 px-2.5">
                    <span className={`px-1.5 py-0.2 rounded font-bold text-[10px] ${t.direction === "LONG" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>
                      {t.direction}
                    </span>
                  </td>
                  <td className="py-1.5 px-2.5 text-chrome-dim text-[11px]">{t.signal_time}</td>
                  <td className="py-1.5 px-2.5 text-chrome-ink text-[11px]">{t.entry_time}</td>
                  <td className="py-1.5 px-2.5 text-chrome-dim text-[11px]">{t.exit_time}</td>
                  <td className="py-1.5 px-2.5 font-bold">${t.entry_price?.toLocaleString()}</td>
                  <td className="py-1.5 px-2.5">{(t.stop_pct * 100).toFixed(2)}%</td>
                  <td className="py-1.5 px-2.5">
                    <span className={`px-1.5 py-0.2 rounded font-bold text-[10px] ${t.exit_type === "TRAIL" ? "bg-emerald-50 text-emerald-700" : t.exit_type === "STOP" ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700"}`}>
                      {t.exit_type}
                    </span>
                  </td>
                  <td className={`py-1.5 px-2.5 font-bold ${t.net_r >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                    {t.net_r >= 0 ? `+${t.net_r.toFixed(3)}R` : `${t.net_r.toFixed(3)}R`}
                  </td>
                  <td className={`py-1.5 px-2.5 font-bold ${t.net_pnl_inr >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                    {t.net_pnl_inr >= 0 ? `+₹${t.net_pnl_inr.toFixed(2)}` : `-₹${Math.abs(t.net_pnl_inr).toFixed(2)}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredTrades.length > 25 && (
          <div className="flex justify-center pt-2">
            <button
              onClick={() => setShowFullTradeLog(!showFullTradeLog)}
              className="px-3 py-1 bg-chrome-field hover:bg-chrome-line border border-chrome-line rounded font-mono text-xs font-bold text-chrome-ink transition-colors"
            >
              {showFullTradeLog ? "Show First 25 Rows" : `Show All ${filteredTrades.length} Rows`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
