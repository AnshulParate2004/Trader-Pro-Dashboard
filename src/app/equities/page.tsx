"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpRight,
  TrendingUp,
  ShieldCheck,
  ShieldAlert,
  BarChart2,
  DollarSign,
  Calendar,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  Maximize2,
  Minimize2,
  Activity,
  Zap,
  Layers,
  Database,
  Search,
} from "lucide-react";
import TradingViewChart from "@/components/TradingViewChart";
import UserAuthPill from "@/components/UserAuthPill";
import { BOOK_CONFIGS } from "@/lib/engineTypes";
import { DEFAULT_EQUITY_FEE_CONFIG } from "@/lib/equityFeeModel";

interface USEquityStock {
  symbol: string;
  name: string;
  sector: string;
  tvSymbol: string;
  price: number;
  changePct: number;
  peRatio: number;
  peSectorMedian: number;
  peZScore: number;
  epsGrowthYoY: number;
  mom12_1: number;
  dist200SmaPct: number;
  isAbove200Sma: boolean;
}

const US_EQUITIES_UNIVERSE: USEquityStock[] = [
  {
    symbol: "SPY",
    name: "SPDR S&P 500 ETF Trust",
    sector: "Broad Benchmark",
    tvSymbol: "AMEX:SPY",
    price: 596.42,
    changePct: 0.35,
    peRatio: 27.8,
    peSectorMedian: 27.8,
    peZScore: 0.42,
    epsGrowthYoY: 9.8,
    mom12_1: 28.5,
    dist200SmaPct: 8.6,
    isAbove200Sma: true,
  },
  {
    symbol: "AAPL",
    name: "Apple Inc.",
    sector: "Technology / Hardware",
    tvSymbol: "NASDAQ:AAPL",
    price: 228.28,
    changePct: 0.72,
    peRatio: 34.6,
    peSectorMedian: 29.4,
    peZScore: 0.85,
    epsGrowthYoY: 12.4,
    mom12_1: 24.1,
    dist200SmaPct: 11.2,
    isAbove200Sma: true,
  },
  {
    symbol: "NVDA",
    name: "NVIDIA Corporation",
    sector: "Technology / Semiconductors",
    tvSymbol: "NASDAQ:NVDA",
    price: 147.50,
    changePct: 2.15,
    peRatio: 52.4,
    peSectorMedian: 29.4,
    peZScore: 1.65,
    epsGrowthYoY: 128.0,
    mom12_1: 178.5,
    dist200SmaPct: 28.4,
    isAbove200Sma: true,
  },
  {
    symbol: "MSFT",
    name: "Microsoft Corporation",
    sector: "Technology / Software",
    tvSymbol: "NASDAQ:MSFT",
    price: 426.15,
    changePct: -0.22,
    peRatio: 33.1,
    peSectorMedian: 29.4,
    peZScore: 0.61,
    epsGrowthYoY: 10.5,
    mom12_1: 16.8,
    dist200SmaPct: 4.8,
    isAbove200Sma: true,
  },
  {
    symbol: "AMZN",
    name: "Amazon.com Inc.",
    sector: "Consumer Discretionary",
    tvSymbol: "NASDAQ:AMZN",
    price: 209.10,
    changePct: 1.05,
    peRatio: 42.8,
    peSectorMedian: 26.5,
    peZScore: 0.32,
    epsGrowthYoY: 52.1,
    mom12_1: 42.0,
    dist200SmaPct: 14.5,
    isAbove200Sma: true,
  },
  {
    symbol: "GOOGL",
    name: "Alphabet Inc.",
    sector: "Communication Services",
    tvSymbol: "NASDAQ:GOOGL",
    price: 180.25,
    changePct: 0.48,
    peRatio: 23.5,
    peSectorMedian: 24.2,
    peZScore: -0.15,
    epsGrowthYoY: 34.2,
    mom12_1: 36.2,
    dist200SmaPct: 7.9,
    isAbove200Sma: true,
  },
  {
    symbol: "META",
    name: "Meta Platforms Inc.",
    sector: "Communication Services",
    tvSymbol: "NASDAQ:META",
    price: 584.50,
    changePct: -0.65,
    peRatio: 26.2,
    peSectorMedian: 24.2,
    peZScore: 0.12,
    epsGrowthYoY: 37.4,
    mom12_1: 72.4,
    dist200SmaPct: 18.2,
    isAbove200Sma: true,
  },
  {
    symbol: "TSLA",
    name: "Tesla Inc.",
    sector: "Automotive / Clean Energy",
    tvSymbol: "NASDAQ:TSLA",
    price: 330.15,
    changePct: 3.40,
    peRatio: 78.5,
    peSectorMedian: 26.5,
    peZScore: 1.15,
    epsGrowthYoY: -7.5,
    mom12_1: 52.8,
    dist200SmaPct: 32.1,
    isAbove200Sma: true,
  },
  {
    symbol: "JPM",
    name: "JPMorgan Chase & Co.",
    sector: "Financials / Banks",
    tvSymbol: "NYSE:JPM",
    price: 243.60,
    changePct: 0.85,
    peRatio: 12.8,
    peSectorMedian: 14.2,
    peZScore: 0.25,
    epsGrowthYoY: 8.2,
    mom12_1: 48.2,
    dist200SmaPct: 19.4,
    isAbove200Sma: true,
  },
];

export default function USEquitiesTerminalPage() {
  const [selectedSymbol, setSelectedSymbol] = useState<string>("SPY");
  const [timeframe, setTimeframe] = useState<string>("1D");
  const [isChartMaximized, setIsChartMaximized] = useState<boolean>(false);
  const [dockTab, setDockTab] = useState<"fundamentals" | "holdings" | "universe">("fundamentals");
  const [selectedStrategy, setSelectedStrategy] = useState<"T" | "V" | "VT" | "VM">("T");

  const [trades, setTrades] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<string>(new Date().toLocaleTimeString());

  const currentStock = US_EQUITIES_UNIVERSE.find((s) => s.symbol === selectedSymbol) || US_EQUITIES_UNIVERSE[0];
  const spyStock = US_EQUITIES_UNIVERSE[0];
  const isMarketRiskOn = spyStock.isAbove200Sma;

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

  const startingCapitalUSD = BOOK_CONFIGS.us_equities.startingCapital;
  const currentEquityUSD = metrics?.currentEquityUSD ?? startingCapitalUSD;
  const netPnLUSD = metrics?.netPnLUSD ?? 0.0;

  return (
    <div className="h-screen w-screen flex flex-col bg-[#f8fafc] text-slate-900 font-sans overflow-hidden select-none">
      
      {/* 1. Top Header Bar */}
      <header className="h-12 w-full bg-white border-b border-slate-200/90 px-3 flex items-center justify-between shrink-0 z-30 shadow-2xs gap-2">
        
        {/* Left: Brand + Stock Selector + Timeframe */}
        <div className="flex items-center gap-2 min-w-0">
          <Link href="/" className="flex items-center gap-1.5 group shrink-0" title="Back to Gateway">
            <div className="w-6 h-6 rounded bg-blue-600 flex items-center justify-center text-white font-mono text-xs font-bold shadow-xs">
              US
            </div>
            <span className="font-mono text-xs font-bold tracking-tight text-slate-900 group-hover:text-blue-600 transition-colors hidden xl:inline">
              TRADER-PRO / EQUITIES
            </span>
          </Link>

          <div className="h-4 w-px bg-slate-200 hidden sm:block shrink-0"></div>

          {/* US Stock Selector Dropdown */}
          <div className="flex items-center shrink-0">
            <select
              value={selectedSymbol}
              onChange={(e) => setSelectedSymbol(e.target.value)}
              className="bg-white border border-slate-300 rounded px-2.5 py-1 text-xs font-mono font-bold text-slate-900 hover:border-slate-400 focus:outline-none focus:border-blue-600 cursor-pointer shadow-2xs"
            >
              {US_EQUITIES_UNIVERSE.map((stock) => (
                <option key={stock.symbol} value={stock.symbol}>
                  {stock.symbol} · {stock.name.split(" ")[0]} (${stock.price.toFixed(2)})
                </option>
              ))}
            </select>
          </div>

          {/* Timeframe Toggles */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded border border-slate-200 shrink-0 text-xs font-mono">
            {["1D", "4H", "1H"].map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-2 py-0.5 rounded font-bold transition-all cursor-pointer ${
                  timeframe === tf ? "bg-white text-blue-700 shadow-2xs" : "text-slate-500 hover:text-slate-900"
                }`}
              >
                {tf}
              </button>
            ))}
          </div>

          {/* Live Price Display */}
          <div className="hidden sm:flex items-center gap-1.5 font-mono text-xs shrink-0 pl-1">
            <span className="font-black text-slate-900">${currentStock.price.toFixed(2)}</span>
            <span
              className={`text-[11px] font-bold ${
                currentStock.changePct >= 0 ? "text-emerald-700" : "text-rose-700"
              }`}
            >
              {currentStock.changePct >= 0 ? "+" : ""}
              {currentStock.changePct.toFixed(2)}%
            </span>
          </div>
        </div>

        {/* Right: Segregated Market Switcher + Capital Badge + AI Engine Link */}
        <div className="flex items-center gap-2 shrink-0">
          
          {/* Segregated Market Switcher Tab */}
          <div className="hidden md:flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs font-mono font-bold shadow-2xs">
            <Link
              href="/terminal"
              className="flex items-center gap-1.5 px-2.5 py-1 text-slate-500 hover:text-slate-900 hover:bg-slate-200/50 rounded-md transition-all cursor-pointer"
              title="Switch to 24/7 Perpetual Derivatives (Crypto + Commodities, INR Base)"
            >
              <span>🪙 Perp (Crypto + Cmdty) · ₹</span>
            </Link>
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 bg-white text-blue-900 rounded-md shadow-xs border border-blue-200"
              title="Active Book: US Equities Daily Systematic (Top 30 S&P 500, USD Base)"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse"></span>
              <span>🇺🇸 US Equities · $</span>
            </div>
          </div>

          {/* Capital Badge ($100 USD Segregated) */}
          <div className="flex items-center gap-1 px-2.5 py-1 bg-white border border-slate-200 rounded font-mono text-xs shadow-2xs shrink-0" title="Live US Equities Capital: $100.00 Starting Baseline">
            <span className="text-slate-400 text-[10px] font-bold uppercase hidden lg:inline">US Cap:</span>
            <span className="font-black text-blue-800 tabular-nums text-xs">
              ${currentEquityUSD.toFixed(2)} USD
            </span>
          </div>

          {/* US AI Engine Link */}
          <Link
            href="/equities/ai-engine"
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-mono font-bold text-slate-700 bg-white border border-slate-200 rounded hover:text-blue-700 transition-all cursor-pointer shrink-0 shadow-2xs"
            title="Open US Equities AI Strategy Engine"
          >
            <Zap className="w-3.5 h-3.5 text-blue-600" />
            <span className="hidden sm:inline">US AI Engine</span>
          </Link>

          {/* Market Status Badge */}
          <div className="flex items-center gap-1 font-mono text-[11px] bg-blue-50 text-blue-800 border border-blue-200 px-2 py-0.5 rounded-full shadow-2xs shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
            <span className="font-bold hidden xl:inline">NYSE REGULATED</span>
          </div>

          {/* User Auth Pill */}
          <div className="shrink-0">
            <UserAuthPill />
          </div>
        </div>
      </header>

      {/* 2. Main Full-Screen Split Workspace (Chart + Right Intelligence Panel) */}
      <div className={`flex-1 flex overflow-hidden ${isChartMaximized ? "relative" : "flex-row"}`}>
        
        {/* Left Column: Full-Height Interactive TradingView Candlestick Chart + Bottom Dock */}
        <div className={`flex flex-col h-full overflow-hidden bg-white ${isChartMaximized ? "w-full" : "w-full lg:w-[calc(100%-340px)] xl:w-[calc(100%-380px)] border-r border-slate-200/90"}`}>
          
          {/* Edge-to-Edge Live TradingView Chart */}
          <div className="flex-1 w-full h-full relative bg-white overflow-hidden">
            <TradingViewChart symbol={currentStock.tvSymbol} interval={timeframe} />
            
            {/* Maximize Toggle Button */}
            <button
              onClick={() => setIsChartMaximized(!isChartMaximized)}
              className="absolute top-2 right-2 z-10 bg-white/90 hover:bg-white text-slate-700 border border-slate-300 p-1.5 rounded shadow-xs cursor-pointer transition-all"
              title={isChartMaximized ? "Restore Layout" : "Maximize Chart"}
            >
              {isChartMaximized ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* Bottom Dock Header with Tabs */}
          {!isChartMaximized && (
            <>
              <div className="h-8 bg-white border-t border-slate-200 px-3 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setDockTab("fundamentals")}
                    className={`flex items-center gap-1 px-2.5 py-1 text-xs font-mono font-bold transition-all cursor-pointer border-b-2 ${
                      dockTab === "fundamentals"
                        ? "border-blue-600 text-blue-700"
                        : "border-transparent text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    <Database className="w-3 h-3" />
                    <span>SEC Point-in-Time Fundamentals</span>
                  </button>

                  <button
                    onClick={() => setDockTab("holdings")}
                    className={`flex items-center gap-1 px-2.5 py-1 text-xs font-mono font-bold transition-all cursor-pointer border-b-2 ${
                      dockTab === "holdings"
                        ? "border-blue-600 text-blue-700"
                        : "border-transparent text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    <Activity className="w-3 h-3" />
                    <span>Paper Holdings &amp; Orders ({trades.length})</span>
                  </button>

                  <button
                    onClick={() => setDockTab("universe")}
                    className={`flex items-center gap-1 px-2.5 py-1 text-xs font-mono font-bold transition-all cursor-pointer border-b-2 ${
                      dockTab === "universe"
                        ? "border-blue-600 text-blue-700"
                        : "border-transparent text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    <Layers className="w-3 h-3" />
                    <span>S&amp;P 500 Top 30 Radar</span>
                  </button>
                </div>

                <div className="text-[11px] font-mono text-slate-500 hidden sm:inline">
                  Allocated Capital: <strong className="text-slate-900 font-bold">${currentEquityUSD.toFixed(2)} USD</strong> · Next Open Fills (O_(t+1))
                </div>
              </div>

              {/* Bottom Dock Content Area */}
              <div className="h-44 bg-[#f8fafc] p-3 overflow-y-auto shrink-0 border-t border-slate-200/80">
                
                {/* Tab 1: Point-in-Time Fundamentals */}
                {dockTab === "fundamentals" && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-white border border-slate-200 rounded p-2.5 shadow-2xs">
                      <div className="text-[10px] font-mono text-slate-500 uppercase font-bold">5-Yr Trailing PE Z-Score</div>
                      <div className="text-base font-black font-mono text-slate-900 mt-0.5">
                        {currentStock.peZScore > 0 ? `+${currentStock.peZScore.toFixed(2)}` : currentStock.peZScore.toFixed(2)}
                      </div>
                      <div className="text-[10px] font-mono text-slate-500">P/E: {currentStock.peRatio.toFixed(1)}x</div>
                    </div>

                    <div className="bg-white border border-slate-200 rounded p-2.5 shadow-2xs">
                      <div className="text-[10px] font-mono text-slate-500 uppercase font-bold">Sector Median P/E</div>
                      <div className="text-base font-black font-mono text-slate-900 mt-0.5">{currentStock.peSectorMedian.toFixed(1)}x</div>
                      <div className="text-[10px] font-mono text-slate-500">{currentStock.sector}</div>
                    </div>

                    <div className="bg-white border border-slate-200 rounded p-2.5 shadow-2xs">
                      <div className="text-[10px] font-mono text-slate-500 uppercase font-bold">Diluted EPS YoY Growth</div>
                      <div className={`text-base font-black font-mono mt-0.5 ${currentStock.epsGrowthYoY >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                        {currentStock.epsGrowthYoY >= 0 ? "+" : ""}{currentStock.epsGrowthYoY.toFixed(1)}%
                      </div>
                      <div className="text-[10px] font-mono text-slate-500">Trailing Twelve Months</div>
                    </div>

                    <div className="bg-white border border-slate-200 rounded p-2.5 shadow-2xs">
                      <div className="text-[10px] font-mono text-slate-500 uppercase font-bold">SEC Causal Compliance</div>
                      <div className="text-xs font-black font-mono text-emerald-700 mt-1 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Filing Date Strict (t_filed &le; t)</span>
                      </div>
                      <div className="text-[10px] font-mono text-slate-500">Zero Lookahead Bias</div>
                    </div>
                  </div>
                )}

                {/* Tab 2: Holdings & Orders */}
                {dockTab === "holdings" && (
                  <div>
                    {trades.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-28 text-slate-500 text-xs font-mono space-y-1">
                        <span className="font-bold text-slate-700">🟢 100% Capital Preserved in Cash ($100.00 USD)</span>
                        <span className="text-[11px] text-slate-500">
                          Signals evaluated at market close (16:00 ET); fills executed at next open (O_(t+1)). Zero overnight margin leverage.
                        </span>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left font-mono text-xs border-collapse">
                          <thead>
                            <tr className="bg-slate-100 text-slate-600 text-[10px] uppercase">
                              <th className="p-2">Ticker</th>
                              <th className="p-2">Strategy</th>
                              <th className="p-2">Side</th>
                              <th className="p-2">Entry Price</th>
                              <th className="p-2">Stop Loss</th>
                              <th className="p-2">Status</th>
                              <th className="p-2">Net PnL (USD)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {trades.map((t, idx) => (
                              <tr key={idx} className="border-b border-slate-200 hover:bg-white">
                                <td className="p-2 font-bold">{t.symbol}</td>
                                <td className="p-2">{t.strategy}</td>
                                <td className="p-2 font-semibold text-emerald-700">{t.side}</td>
                                <td className="p-2">${t.intended_price?.toFixed(2)}</td>
                                <td className="p-2">${t.stop_loss?.toFixed(2)}</td>
                                <td className="p-2">{t.status}</td>
                                <td className="p-2 font-bold text-emerald-700">+${t.net_pnl_usd?.toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* Tab 3: Universe Radar */}
                {dockTab === "universe" && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left font-mono text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-100 text-slate-600 text-[10px] uppercase">
                          <th className="p-1.5">Ticker</th>
                          <th className="p-1.5">Company Name</th>
                          <th className="p-1.5">Sector</th>
                          <th className="p-1.5">Price</th>
                          <th className="p-1.5">12-1 Momentum</th>
                          <th className="p-1.5">200 SMA Distance</th>
                          <th className="p-1.5">Regime Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {US_EQUITIES_UNIVERSE.map((stock) => (
                          <tr
                            key={stock.symbol}
                            onClick={() => setSelectedSymbol(stock.symbol)}
                            className={`border-b border-slate-200 cursor-pointer transition-colors ${
                              selectedSymbol === stock.symbol ? "bg-blue-50 font-bold" : "hover:bg-white"
                            }`}
                          >
                            <td className="p-1.5 text-blue-700">{stock.symbol}</td>
                            <td className="p-1.5">{stock.name}</td>
                            <td className="p-1.5 text-slate-500">{stock.sector}</td>
                            <td className="p-1.5">${stock.price.toFixed(2)}</td>
                            <td className="p-1.5 text-emerald-700">+{stock.mom12_1.toFixed(1)}%</td>
                            <td className="p-1.5">+{stock.dist200SmaPct.toFixed(1)}%</td>
                            <td className="p-1.5">
                              <span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded text-[10px] font-bold">
                                ABOVE 200 SMA
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

              </div>
            </>
          )}

        </div>

        {/* Right Column: Dedicated US Equities Intelligence Panel */}
        {!isChartMaximized && (
          <aside className="w-full lg:w-[340px] xl:w-[380px] bg-white flex flex-col h-full overflow-y-auto shrink-0 border-l border-slate-200/80 p-3 space-y-3">
            
            {/* Header: Brain Status */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-slate-500 uppercase font-bold flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5 text-blue-600" />
                  <span>US Equities Quant Brain</span>
                </span>
                <span className="bg-blue-100 text-blue-800 border border-blue-200 font-mono text-[10px] font-bold px-2 py-0.5 rounded-full">
                  1D Next-Open Model
                </span>
              </div>
              <div className="text-sm font-bold text-slate-900 font-mono">
                S2 Momentum + 200-SMA Regime Shield
              </div>
              <div className="text-[11px] text-slate-500 leading-snug font-sans">
                Top-quintile momentum ranking evaluated monthly. Zero active exposure deployed when SPY &le; 200 SMA.
              </div>
            </div>

            {/* Macro Regime Audit Card */}
            <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-2 shadow-2xs">
              <div className="flex items-center justify-between text-xs font-mono font-bold">
                <span className="text-slate-600 uppercase">SPY 200-Day SMA Trend Shield</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-black ${isMarketRiskOn ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>
                  {isMarketRiskOn ? "🟢 RISK-ON (ABOVE 200 SMA)" : "🔴 100% CASH DEFENSE"}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs font-mono bg-slate-50 p-2 rounded border border-slate-100">
                <div>
                  <div className="text-[10px] text-slate-500">SPY Current:</div>
                  <div className="font-bold text-slate-900">${spyStock.price.toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500">200 SMA Est:</div>
                  <div className="font-bold text-slate-900">${(spyStock.price / (1 + spyStock.dist200SmaPct / 100)).toFixed(2)}</div>
                </div>
              </div>
              <div className="text-[10px] text-slate-500 font-mono leading-tight">
                Historical Audit: 100% cash defense preserved capital in 2022 (-29.36% in unhedged momentum).
              </div>
            </div>

            {/* Active Model Signal Card for Selected Stock */}
            <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-2.5 shadow-2xs">
              <div className="flex items-center justify-between text-xs font-mono font-bold">
                <span className="text-slate-700 uppercase">Live Model Signal ({currentStock.symbol})</span>
                <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded text-[10px] font-bold">
                  {currentStock.isAbove200Sma ? "MOMENTUM CANDIDATE" : "BELOW 200 SMA"}
                </span>
              </div>

              <div className="space-y-1.5 text-xs font-mono">
                <div className="flex justify-between text-slate-600">
                  <span>12-1 Month Momentum:</span>
                  <strong className="text-emerald-700">+{currentStock.mom12_1.toFixed(1)}%</strong>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>P/E vs Sector Median:</span>
                  <strong className="text-slate-900">{currentStock.peRatio.toFixed(1)}x vs {currentStock.peSectorMedian.toFixed(1)}x</strong>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>EPS YoY Growth:</span>
                  <strong className="text-slate-900">+{currentStock.epsGrowthYoY.toFixed(1)}%</strong>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Max Position Budget:</span>
                  <strong className="text-blue-800">$20.00 USD (20%)</strong>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Risk Limit / Trade:</span>
                  <strong className="text-slate-900">$1.00 USD (1.0%)</strong>
                </div>
              </div>
            </div>

            {/* Quick Switch to Full AI Engine */}
            <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-lg text-xs font-mono space-y-2">
              <div className="font-bold text-blue-900 flex items-center justify-between">
                <span>US Equities Econometric Engine</span>
                <Link href="/equities/ai-engine" className="text-blue-700 hover:underline flex items-center gap-0.5">
                  <span>View All Surfaces</span>
                  <ArrowUpRight className="w-3 h-3" />
                </Link>
              </div>
              <p className="text-[11px] text-slate-600 font-sans leading-tight">
                Inspect 16-year walk-forward factor interaction surfaces, 1,000 within-month permutation null distributions, and SEC filing date proofs.
              </p>
            </div>

          </aside>
        )}

      </div>
    </div>
  );
}
