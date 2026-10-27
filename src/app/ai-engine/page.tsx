"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Activity,
  Zap,
  BarChart2,
  Database,
  SlidersHorizontal,
  RotateCw,
  TrendingUp,
  Percent,
  CheckCircle2,
  XCircle,
  Play,
  Pause,
  AlertTriangle,
  ArrowUpRight,
  Shield,
  Coins,
} from "lucide-react";
import { TradeOrder, EngineConfig, EnginePerformanceMetrics } from "@/lib/tradingEngine";

export default function AiEnginePage() {
  const [trades, setTrades] = useState<TradeOrder[]>([]);
  const [metrics, setMetrics] = useState<EnginePerformanceMetrics | null>(null);
  const [config, setConfig] = useState<EngineConfig>({
    autoTradingEnabled: true,
    currency: "INR",
    accountBalanceINR: 1000,
    tradingFeePercent: 0.040, // Shark Exchange Taker
    makerFeePercent: 0.016,   // Shark Exchange Maker
    gstPercent: 18.0,         // 18% GST
    riskPerTradePercent: 1.0, // 1% = ₹10
    ratchetEnabled: true,
    maxConcurrentTrades: 2,
  });
  const [mongoConnected, setMongoConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSimulating, setIsSimulating] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string>("Connecting...");

  // Fetch engine data and trade logs
  const fetchData = async () => {
    try {
      const res = await fetch("/api/trades");
      if (!res.ok) throw new Error("Failed to fetch engine data");
      const data = await res.json();
      if (data.success) {
        setTrades(data.trades);
        setMetrics(data.metrics);
        setMongoConnected(data.mongoConfigured);
        setLastUpdated(new Date().toLocaleTimeString());
      }
    } catch (err) {
      console.error("Error fetching AI engine data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, []);

  // Update Fee Percentage (Shark Exchange presets)
  const handleFeeChange = async (newFee: number) => {
    const updated = { ...config, tradingFeePercent: newFee };
    setConfig(updated);
    try {
      await fetch("/api/engine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tradingFeePercent: newFee }),
      });
      fetchData();
    } catch (err) {
      console.error("Failed to update fee percentage:", err);
    }
  };

  // Toggle Auto-Trading
  const handleToggleAuto = async () => {
    const newState = !config.autoTradingEnabled;
    setConfig({ ...config, autoTradingEnabled: newState });
    try {
      await fetch("/api/engine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoTradingEnabled: newState }),
      });
      fetchData();
    } catch (err) {
      console.error("Failed to toggle auto trading:", err);
    }
  };

  // Trigger Simulated Live Scalp with ₹1,000 INR Artificial Capital & Shark Exchange Fees
  const handleSimulateTrade = async () => {
    setIsSimulating(true);
    try {
      const tickerRes = await fetch("https://fapi.binance.com/fapi/v1/ticker/price?symbol=BTCUSDT");
      const tickerData = await tickerRes.json();
      const currentPrice = parseFloat(tickerData.price) || 79500;

      const direction = Math.random() > 0.45 ? "LONG" : "SHORT";
      const atr = currentPrice * 0.0055;

      await fetch("/api/trades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: "BTCUSDT",
          direction,
          entryPrice: currentPrice,
          atr,
          customFeePercent: config.tradingFeePercent,
          triggerReason: `Shark Exchange Scalp: 50-Bar Pivot ${direction === "LONG" ? "Support Bounce" : "Resistance Defense"}`,
        }),
      });

      fetchData();
    } catch (err) {
      console.error("Simulation error:", err);
    } finally {
      setIsSimulating(false);
    }
  };

  // Close Active Trade
  const handleCloseTrade = async (tradeId: string, entryPrice: number, dir: "LONG" | "SHORT") => {
    try {
      const tickerRes = await fetch("https://fapi.binance.com/fapi/v1/ticker/price?symbol=BTCUSDT");
      const tickerData = await tickerRes.json();
      const livePrice = parseFloat(tickerData.price) || (dir === "LONG" ? entryPrice * 1.006 : entryPrice * 0.994);

      await fetch(`/api/trades/${tradeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exitPrice: livePrice,
          reason: "Shark Exchange Execution Close",
        }),
      });
      fetchData();
    } catch (err) {
      console.error("Error closing trade:", err);
    }
  };

  const currentBalance = metrics?.currentBalanceINR ?? 1000;
  const netPnL = metrics?.netPnLINR ?? 0;
  const totalFees = metrics?.totalFeesPaidINR ?? 0;

  return (
    <div className="min-h-screen w-full flex flex-col bg-white text-gray-900 font-sans selection:bg-emerald-500/20">
      
      {/* 1. Header Navigation Bar */}
      <header className="h-14 w-full bg-[#f8f9fa] border-b border-[#e5e7eb] px-6 flex items-center justify-between shrink-0 sticky top-0 z-40">
        <div className="flex items-center gap-4">
          <Link href="/terminal" className="flex items-center gap-2 group mr-2" title="Go to Trading Terminal">
            <div className="w-7 h-7 rounded bg-gray-900 flex items-center justify-center text-white font-mono text-xs font-bold shadow-sm">
              TP
            </div>
            <span className="font-mono text-sm font-bold tracking-tight text-gray-900 group-hover:text-emerald-600 transition-colors">
              TRADER-PRO <span className="text-emerald-600 font-extrabold">AI ENGINE</span>
            </span>
          </Link>

          <div className="h-4 w-px bg-gray-300"></div>

          {/* MongoDB Atlas Status */}
          <div
            className={`flex items-center gap-1.5 font-mono text-xs px-2.5 py-1 rounded-full border ${
              mongoConnected
                ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                : "bg-amber-50 text-amber-800 border-amber-300"
            }`}
            title={
              mongoConnected
                ? "MongoDB Atlas Connected: cluster0.ilejs4x.mongodb.net/that"
                : "MongoDB Atlas Ready: cluster0.ilejs4x.mongodb.net/that"
            }
          >
            <Database className="w-3.5 h-3.5" />
            <span className="font-bold">
              {mongoConnected ? "MONGO ATLAS: CONNECTED (cluster0)" : "MONGO ATLAS: STANDBY (ACTIVE MEMORY CACHE)"}
            </span>
          </div>

          <div className="h-4 w-px bg-gray-300 hidden md:block"></div>

          {/* Shark Exchange Fee Badge */}
          <div className="hidden lg:flex items-center gap-1.5 font-mono text-xs bg-blue-50 text-blue-800 border border-blue-200 px-2.5 py-1 rounded-full">
            <span className="font-bold">SHARK EXCHANGE: 0.040% TAKER / 0.016% MAKER (+18% GST)</span>
          </div>
        </div>

        {/* Right Header Navigation & Actions */}
        <div className="flex items-center gap-3">
          <Link
            href="/terminal"
            className="flex items-center gap-1.5 text-xs font-mono font-bold text-gray-700 hover:text-gray-900 bg-white border border-gray-300 px-3 py-1.5 rounded-md hover:border-gray-400 transition-all shadow-xs"
          >
            Trading Terminal
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>

          <button
            onClick={fetchData}
            className="flex items-center gap-1.5 text-xs font-mono text-gray-500 hover:text-gray-900 px-2 py-1"
            title="Refresh AI Engine Metrics"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-emerald-600" : ""}`} />
            <span className="hidden md:inline">{lastUpdated}</span>
          </button>
        </div>
      </header>

      {/* 2. Main Content Body */}
      <main className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6 flex flex-col gap-6">
        
        {/* Top KPI Cards: Starting Artificial Money ₹1,000 INR & Shark Exchange Fees */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Card 1: Virtual Balance (Starting ₹1,000 INR) */}
          <div className="bg-white border border-[#e5e7eb] rounded-xl p-4 flex flex-col gap-1 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-gray-500 uppercase font-semibold flex items-center gap-1">
                <Coins className="w-3.5 h-3.5 text-amber-500" /> Account Balance
              </span>
              <span className="text-[10px] font-mono bg-amber-50 text-amber-800 px-2 py-0.5 rounded border border-amber-200 font-bold">
                START: ₹1,000
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold font-mono tracking-tight text-gray-900">
              ₹{currentBalance.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-gray-500 font-mono flex items-center justify-between pt-1 border-t border-gray-100">
              <span>Artificial Capital: ₹1,000.00</span>
              {trades.length > 0 ? (
                <span className={netPnL >= 0 ? "text-emerald-600 font-bold" : "text-rose-600 font-bold"}>
                  {netPnL >= 0 ? "+" : ""}₹{netPnL.toFixed(2)}
                </span>
              ) : (
                <span className="text-gray-400">Realized: —</span>
              )}
            </div>
          </div>

          {/* Card 2: Net PnL (After Shark Exchange Fees & GST) */}
          <div className="bg-white border border-[#e5e7eb] rounded-xl p-4 flex flex-col gap-1 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-gray-500 uppercase font-semibold">Net Realized PnL</span>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded border font-bold ${
                trades.length > 0
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-gray-50 text-gray-400 border-gray-200"
              }`}>
                {trades.length > 0 ? "AFTER FEES & GST" : "NO TRADES YET"}
              </span>
            </div>
            <div className={`text-2xl sm:text-3xl font-extrabold font-mono tracking-tight ${
              trades.length === 0
                ? "text-gray-400"
                : netPnL >= 0
                ? "text-emerald-600"
                : "text-rose-600"
            }`}>
              {trades.length > 0 ? `${netPnL >= 0 ? "+" : ""}₹${netPnL.toFixed(2)}` : "—"}
            </div>
            <div className="text-[11px] text-gray-500 font-mono flex items-center justify-between pt-1 border-t border-gray-100">
              {trades.length > 0 ? (
                <>
                  <span>Gross: +₹{metrics?.grossProfitINR?.toFixed(2) || "0.00"}</span>
                  <span>Loss: -₹{metrics?.grossLossINR?.toFixed(2) || "0.00"}</span>
                </>
              ) : (
                <span className="text-gray-400 italic">No closed trades recorded</span>
              )}
            </div>
          </div>

          {/* Card 3: Shark Exchange Fees Deducted */}
          <div className="bg-white border border-[#e5e7eb] rounded-xl p-4 flex flex-col gap-1 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-gray-500 uppercase font-semibold">Shark Exchange Fees</span>
              <span className="text-[10px] font-mono bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200 font-bold">
                0.040% + 18% GST
              </span>
            </div>
            <div className={`text-2xl sm:text-3xl font-extrabold font-mono tracking-tight ${
              trades.length > 0 ? "text-blue-600" : "text-gray-400"
            }`}>
              {trades.length > 0 ? `₹${totalFees.toFixed(2)}` : "—"}
            </div>
            <div className="text-[11px] text-gray-500 font-mono flex items-center justify-between pt-1 border-t border-gray-100">
              <span>Effective Taker Fee:</span>
              <span className="font-bold text-gray-700">0.0472% (w/ GST)</span>
            </div>
          </div>

          {/* Card 4: Shark Exchange Fee Config */}
          <div className="bg-white border border-[#e5e7eb] rounded-xl p-4 flex flex-col gap-2 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-gray-500 uppercase font-semibold flex items-center gap-1">
                <Percent className="w-3.5 h-3.5 text-gray-400" /> Shark Fee Mode
              </span>
              <span className="text-[10px] font-mono text-emerald-700 font-bold">DERIVATIVES</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.004"
                min="0.01"
                max="0.2"
                value={config.tradingFeePercent}
                onChange={(e) => handleFeeChange(parseFloat(e.target.value) || 0.040)}
                className="w-24 bg-gray-50 border border-gray-300 rounded px-2.5 py-1 text-sm font-mono font-bold text-gray-900 focus:outline-none focus:border-emerald-500 shadow-inner"
              />
              <span className="text-xs font-mono font-bold text-gray-500">% + 18% GST</span>
            </div>
            <div className="flex gap-1.5">
              <button
                onClick={() => handleFeeChange(0.040)}
                className={`text-[10px] font-mono px-2 py-0.5 rounded border transition-colors ${
                  config.tradingFeePercent === 0.040
                    ? "bg-blue-600 text-white border-blue-700 font-bold"
                    : "bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100"
                }`}
                title="Shark Exchange Taker Fee: 0.040%"
              >
                Shark Taker (0.040%)
              </button>
              <button
                onClick={() => handleFeeChange(0.016)}
                className={`text-[10px] font-mono px-2 py-0.5 rounded border transition-colors ${
                  config.tradingFeePercent === 0.016
                    ? "bg-blue-600 text-white border-blue-700 font-bold"
                    : "bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100"
                }`}
                title="Shark Exchange Maker Fee: 0.016%"
              >
                Shark Maker (0.016%)
              </button>
            </div>
          </div>

        </section>

        {/* 3. Engine Control Deck & Shark Exchange Execution */}
        <section className="bg-[#f8f9fa] border border-[#e5e7eb] rounded-xl p-4 sm:p-5 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-emerald-600" />
              <h3 className="font-bold text-sm text-gray-900 font-mono uppercase">
                Shark Exchange AI Automated Scalp Engine
              </h3>
            </div>
            <p className="text-xs text-gray-500 max-w-xl">
              Trading with artificial capital of <span className="font-bold text-gray-900">₹1,000 INR</span>. Applies Shark Exchange futures taker fee of <span className="font-mono font-semibold text-blue-600">0.040% + 18% GST</span>. Automatically trails Stop Loss to Breakeven at <span className="font-mono font-semibold text-gray-900">+0.30R</span>.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Toggle Automation */}
            <button
              onClick={handleToggleAuto}
              className={`flex items-center gap-1.5 text-xs font-mono font-bold px-4 py-2 rounded-lg border transition-all ${
                config.autoTradingEnabled
                  ? "bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-700"
                  : "bg-gray-200 text-gray-700 border-gray-300 hover:bg-gray-300"
              }`}
            >
              {config.autoTradingEnabled ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>{config.autoTradingEnabled ? "AI Execution: Active" : "AI Execution: Paused"}</span>
            </button>

            {/* Trigger Simulation */}
            <button
              onClick={handleSimulateTrade}
              disabled={isSimulating}
              className="flex items-center gap-1.5 bg-gray-900 text-white text-xs font-mono font-bold px-4 py-2 rounded-lg hover:bg-black transition-all shadow-sm disabled:opacity-50"
            >
              <Zap className="w-3.5 h-3.5 text-emerald-400" />
              <span>{isSimulating ? "Placing Order..." : "Simulate Scalp (₹1,000 Capital)"}</span>
            </button>
          </div>
        </section>

        {/* 4. Live Trade Logs & Execution Table with Shark Exchange Fees in INR */}
        <section className="bg-white border border-[#e5e7eb] rounded-xl overflow-hidden shadow-sm flex flex-col">
          <div className="p-4 border-b border-[#e5e7eb] flex items-center justify-between bg-[#f8f9fa]">
            <div className="flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-gray-700" />
              <h3 className="font-bold text-sm text-gray-900 font-mono uppercase">
                Shark Exchange Trade Execution Log (₹1,000 INR Artificial Capital)
              </h3>
              <span className="text-xs text-gray-500 font-mono">({trades.length} trades)</span>
            </div>

            <div className="text-xs text-gray-500 font-mono">
              Net PnL = Gross PnL - Shark Fees (0.040% + 18% GST)
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse font-mono text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase text-[10px]">
                  <th className="py-2.5 px-3">Time</th>
                  <th className="py-2.5 px-3">Pair</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Entry Price</th>
                  <th className="py-2.5 px-3">Exit Price</th>
                  <th className="py-2.5 px-3">Position (INR)</th>
                  <th className="py-2.5 px-3">Shark Fee (w/ GST)</th>
                  <th className="py-2.5 px-3">Gross PnL</th>
                  <th className="py-2.5 px-3">Net PnL</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {trades.length > 0 ? (
                  trades.map((trade) => {
                    const isClosed = trade.status === "CLOSED";
                    const isPositive = (trade.netPnLINR || 0) >= 0;

                    return (
                      <tr key={trade.id} className="hover:bg-gray-50/80 transition-colors">
                        <td className="py-2.5 px-3 text-gray-400 text-[11px] whitespace-nowrap">
                          {new Date(trade.openedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-gray-900">{trade.symbol}</td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded font-extrabold text-[10px] ${
                              trade.direction === "LONG"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-rose-50 text-rose-700 border border-rose-200"
                            }`}
                          >
                            {trade.direction}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-bold text-gray-900">
                          ${trade.entryPrice.toLocaleString(undefined, { minimumFractionDigits: 1 })}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-gray-900">
                          {trade.exitPrice
                            ? `$${trade.exitPrice.toLocaleString(undefined, { minimumFractionDigits: 1 })}`
                            : "—"}
                        </td>
                        <td className="py-2.5 px-3 text-gray-700 font-semibold">
                          ₹{trade.positionSizeINR.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-2.5 px-3 text-blue-600 font-semibold">
                          ₹{trade.totalFeeINR?.toFixed(3) || "0.000"}
                        </td>
                        <td className="py-2.5 px-3 font-semibold">
                          {isClosed ? (
                            <span className={trade.grossPnLINR && trade.grossPnLINR >= 0 ? "text-emerald-600" : "text-rose-600"}>
                              {trade.grossPnLINR && trade.grossPnLINR >= 0 ? "+" : ""}₹{trade.grossPnLINR?.toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-gray-400">Floating</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-extrabold">
                          {isClosed ? (
                            <span className={isPositive ? "text-emerald-600" : "text-rose-600"}>
                              {isPositive ? "+" : ""}₹{trade.netPnLINR?.toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-blue-500 animate-pulse">Running</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              isClosed
                                ? "bg-gray-100 text-gray-600 border border-gray-200"
                                : "bg-emerald-100 text-emerald-800 border border-emerald-300"
                            }`}
                          >
                            {trade.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          {!isClosed ? (
                            <button
                              onClick={() => handleCloseTrade(trade.id, trade.entryPrice, trade.direction)}
                              className="bg-gray-900 hover:bg-black text-white text-[10px] font-bold px-2.5 py-1 rounded transition-colors"
                            >
                              Close
                            </button>
                          ) : (
                            <span className="text-gray-400 text-[10px]">{trade.exitReason || "Done"}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={11} className="py-16 text-center">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 text-base">
                          📋
                        </div>
                        <span className="font-mono text-sm font-bold text-gray-700">
                          No Trade Data Available
                        </span>
                        <span className="text-xs text-gray-400 max-w-sm">
                          No active or closed scalps recorded yet. When trades are executed, they will appear here live with Shark Exchange fees in INR.
                        </span>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

      </main>

      {/* Simple Clean Footer */}
      <footer className="border-t border-gray-200 py-6 px-6 text-center text-xs font-mono text-gray-500">
        TRADER-PRO AUTOMATED AI TRADING ENGINE · SHARK EXCHANGE DERIVATIVES (0.040% TAKER / 0.016% MAKER + 18% GST) · VERCEL DEPLOYABLE
      </footer>

    </div>
  );
}
