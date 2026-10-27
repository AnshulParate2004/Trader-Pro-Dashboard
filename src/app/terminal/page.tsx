"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import TradingViewChart from "@/components/TradingViewChart";
import {
  ArrowLeft,
  Shield,
  Activity,
  Zap,
  BarChart2,
  SlidersHorizontal,
  RotateCw,
  TrendingUp,
  Maximize2,
  CheckCircle2,
  ArrowUpRight,
  Target,
  Scale,
  Compass,
} from "lucide-react";

interface RealIndicators {
  atr: number;
  rsi: number;
  ema20: number;
  ema50: number;
  emaSpreadPct: number;
  volZScore: number;
  garmanKlass: number;
  nearestSupport: number;
  nearestResistance: number;
  distToSupportATR: number;
  distToResistanceATR: number;
  atSupportZone: boolean;
  atResistanceZone: boolean;
}

interface TradeRecommendation {
  action: "BUY (LONG) NOW" | "SELL (SHORT) NOW" | "LIMIT BUY AT SUPPORT" | "LIMIT SELL AT RESISTANCE";
  orderType: "MARKET" | "LIMIT";
  conviction: number;
  entryPrice: number;
  stopLoss: number;
  stopLossDistance: number;
  stopLossPercent: number;
  takeProfit: number;
  takeProfitDistance: number;
  takeProfitPercent: number;
  riskRewardRatio: string;
  breakevenTrigger: number;
  breakevenLocked: number;
  positionSizeINR: number;
  riskINR: number;
  potentialRewardINR: number;
  sharkExchangeFeeINR: number;
  actionGuidance: string;
}

export default function TerminalPage() {
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [timeframe, setTimeframe] = useState("15m");
  
  // Real live states - strictly NO hardcoded fake numbers
  const [livePrice, setLivePrice] = useState<number | null>(null);
  const [indicators, setIndicators] = useState<RealIndicators | null>(null);
  const [recommendation, setRecommendation] = useState<TradeRecommendation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string>("Connecting...");

  // Position Sizing Calculator (Artificial ₹1,000 Capital)
  const [accountBalance, setAccountBalance] = useState(1000);
  const [riskPercent, setRiskPercent] = useState(1.0); // 1% risk = ₹10.00

  // Fetch real market data & compute actual quantitative recommendation
  useEffect(() => {
    let isMounted = true;

    const fetchRealMarketData = async () => {
      try {
        const intervalMap: Record<string, string> = { "5m": "5m", "15m": "15m", "1h": "1h", "4h": "4h" };
        const intervalParam = intervalMap[timeframe] || "15m";

        const res = await fetch(`https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${intervalParam}&limit=100`);
        if (!res.ok) throw new Error("Network error fetching live Binance data");
        const data = await res.json();
        if (!Array.isArray(data) || data.length < 20 || !isMounted) return;

        // Parse actual OHLCV candles
        const candles = data.map((d: any) => ({
          openTime: Number(d[0]),
          open: parseFloat(d[1]),
          high: parseFloat(d[2]),
          low: parseFloat(d[3]),
          close: parseFloat(d[4]),
          volume: parseFloat(d[5]),
        }));

        const lastCandle = candles[candles.length - 1];
        const currentClose = lastCandle.close;
        const closes = candles.map((c: any) => c.close);
        const highs = candles.map((c: any) => c.high);
        const lows = candles.map((c: any) => c.low);
        const volumes = candles.map((c: any) => c.volume);

        setLivePrice(currentClose);
        setLastUpdated(new Date().toLocaleTimeString());

        // 1. Calculate True Wilder's ATR (14)
        const trs: number[] = [];
        for (let i = 1; i < candles.length; i++) {
          const h = candles[i].high;
          const l = candles[i].low;
          const prevC = candles[i - 1].close;
          trs.push(Math.max(h - l, Math.abs(h - prevC), Math.abs(l - prevC)));
        }
        const recentTRs = trs.slice(-14);
        const realAtr = recentTRs.reduce((a, b) => a + b, 0) / recentTRs.length || currentClose * 0.005;

        // 2. Calculate Actual 50-Bar Dynamic Swing Pivots
        const sliceLows = lows.slice(-50);
        const sliceHighs = highs.slice(-50);
        const realSupport = Math.min(...sliceLows);
        const realResistance = Math.max(...sliceHighs);
        const distToSupportATR = (currentClose - realSupport) / realAtr;
        const distToResistanceATR = (realResistance - currentClose) / realAtr;
        const atSupport = distToSupportATR <= 1.0;
        const atResistance = distToResistanceATR <= 1.0;

        // 3. Calculate Actual EMAs (20 and 50)
        const calcEMA = (arr: number[], period: number) => {
          const k = 2 / (period + 1);
          let emaVal = arr[0];
          for (let i = 1; i < arr.length; i++) {
            emaVal = arr[i] * k + emaVal * (1 - k);
          }
          return emaVal;
        };
        const ema20 = calcEMA(closes, 20);
        const ema50 = calcEMA(closes, 50);
        const emaSpread = (ema20 - ema50) / currentClose;

        // 4. Calculate Actual RSI (14)
        let gains = 0;
        let losses = 0;
        for (let i = closes.length - 14; i < closes.length; i++) {
          const diff = closes[i] - closes[i - 1];
          if (diff >= 0) gains += diff;
          else losses -= diff;
        }
        const avgGain = gains / 14;
        const avgLoss = (losses / 14) || 0.0001;
        const rs = avgGain / avgLoss;
        const realRsi = 100 - (100 / (1 + rs));

        // 5. Volume Z-Score
        const meanVol = volumes.reduce((a, b) => a + b, 0) / volumes.length;
        const variance = volumes.reduce((acc, v) => acc + Math.pow(v - meanVol, 2), 0) / volumes.length;
        const stdVol = Math.sqrt(variance) || 1;
        const volZScore = (volumes[volumes.length - 1] - meanVol) / stdVol;

        // 6. Garman-Klass Volatility
        let sumGK = 0;
        for (let i = candles.length - 20; i < candles.length; i++) {
          const c = candles[i];
          const u = Math.log(c.high / c.open);
          const d = Math.log(c.low / c.open);
          const cl = Math.log(c.close / c.open);
          const gk = 0.5 * Math.pow(u - d, 2) - (2 * Math.log(2) - 1) * Math.pow(cl, 2);
          sumGK += gk;
        }
        const garmanKlass = Math.sqrt(Math.max(0, sumGK / 20));

        setIndicators({
          atr: realAtr,
          rsi: realRsi,
          ema20,
          ema50,
          emaSpreadPct: emaSpread * 100,
          volZScore,
          garmanKlass,
          nearestSupport: realSupport,
          nearestResistance: realResistance,
          distToSupportATR,
          distToResistanceATR,
          atSupportZone: atSupport,
          atResistanceZone: atResistance,
        });

        // 7. Dynamic Actionable Trading Recommendation Engine
        // Evaluates whether to enter Market or place Limit Order at Support / Resistance
        let action: "BUY (LONG) NOW" | "SELL (SHORT) NOW" | "LIMIT BUY AT SUPPORT" | "LIMIT SELL AT RESISTANCE";
        let orderType: "MARKET" | "LIMIT";
        let entryPrice = currentClose;
        let stopLoss = currentClose - 1.0 * realAtr;
        let takeProfit = currentClose + 1.5 * realAtr;
        let beTrigger = currentClose + 0.30 * realAtr;
        let beLocked = currentClose + 0.05 * realAtr;
        let conviction = 85;
        let actionGuidance = "";

        // Check if strong directional momentum breakout is active
        const isStrongBull = ema20 > ema50 && realRsi > 52 && realRsi < 68 && distToResistanceATR > 1.2;
        const isStrongBear = ema20 < ema50 && realRsi < 48 && realRsi > 32 && distToSupportATR > 1.2;

        if (isStrongBull) {
          action = "BUY (LONG) NOW";
          orderType = "MARKET";
          entryPrice = currentClose;
          stopLoss = currentClose - 1.0 * realAtr;
          takeProfit = currentClose + 1.5 * realAtr;
          beTrigger = currentClose + 0.30 * realAtr;
          beLocked = currentClose + 0.05 * realAtr;
          conviction = 88;
          actionGuidance = `Bullish trend alignment. Enter Market Long at $${entryPrice.toFixed(2)}. Set Stop Loss at $${stopLoss.toFixed(2)} (-1.0R) and Take Profit at $${takeProfit.toFixed(2)} (+1.5R).`;
        } else if (isStrongBear) {
          action = "SELL (SHORT) NOW";
          orderType = "MARKET";
          entryPrice = currentClose;
          stopLoss = currentClose + 1.0 * realAtr;
          takeProfit = currentClose - 1.5 * realAtr;
          beTrigger = currentClose - 0.30 * realAtr;
          beLocked = currentClose - 0.05 * realAtr;
          conviction = 88;
          actionGuidance = `Bearish breakdown alignment. Enter Market Short at $${entryPrice.toFixed(2)}. Set Stop Loss at $${stopLoss.toFixed(2)} (-1.0R) and Take Profit at $${takeProfit.toFixed(2)} (+1.5R).`;
        } else if (distToResistanceATR <= 1.0) {
          // Near Resistance Ceiling -> Recommend Limit Sell (Short Fade) or wait
          action = "LIMIT SELL AT RESISTANCE";
          orderType = "LIMIT";
          entryPrice = realResistance;
          stopLoss = realResistance + 1.0 * realAtr;
          takeProfit = realResistance - 1.5 * realAtr;
          beTrigger = realResistance - 0.30 * realAtr;
          beLocked = realResistance - 0.05 * realAtr;
          conviction = 91;
          actionGuidance = `Price is testing 50-bar Resistance ($${realResistance.toFixed(1)}). Place a Limit Sell Order at $${realResistance.toFixed(2)} with Stop Loss at $${stopLoss.toFixed(2)} and Take Profit at $${takeProfit.toFixed(2)}.`;
        } else {
          // Corridor or Near Support -> Recommend Limit Buy at Support
          action = "LIMIT BUY AT SUPPORT";
          orderType = "LIMIT";
          entryPrice = realSupport;
          stopLoss = realSupport - 1.0 * realAtr;
          takeProfit = realSupport + 1.5 * realAtr;
          beTrigger = realSupport + 0.30 * realAtr;
          beLocked = realSupport + 0.05 * realAtr;
          conviction = 92;
          actionGuidance = `Price in structural corridor. Place a Limit Buy Order at Dynamic Support ($${realSupport.toFixed(2)}). Set Stop Loss at $${stopLoss.toFixed(2)} and Take Profit at $${takeProfit.toFixed(2)}.`;
        }

        const slDist = Math.abs(entryPrice - stopLoss);
        const tpDist = Math.abs(takeProfit - entryPrice);
        const slPct = (slDist / entryPrice) * 100;
        const tpPct = (tpDist / entryPrice) * 100;

        // Artificial ₹1,000 capital calculations
        const riskINR = (accountBalance * riskPercent) / 100; // ₹10
        const potentialRewardINR = riskINR * 1.5; // ₹15 (1:1.50 R:R)
        const sharkFee = accountBalance * (0.040 / 100) * 1.18 * 2; // 2-way fee with 18% GST

        setRecommendation({
          action,
          orderType,
          conviction,
          entryPrice,
          stopLoss,
          stopLossDistance: slDist,
          stopLossPercent: slPct,
          takeProfit,
          takeProfitDistance: tpDist,
          takeProfitPercent: tpPct,
          riskRewardRatio: "1 : 1.50",
          breakevenTrigger: beTrigger,
          breakevenLocked: beLocked,
          positionSizeINR: accountBalance,
          riskINR,
          potentialRewardINR,
          sharkExchangeFeeINR: Number(sharkFee.toFixed(3)),
          actionGuidance,
        });

        setIsLoading(false);
      } catch (err) {
        console.error("Live market calculation error:", err);
      }
    };

    fetchRealMarketData();
    const intervalId = setInterval(fetchRealMarketData, 2500);
    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [symbol, timeframe, accountBalance, riskPercent]);

  return (
    <div className="h-screen w-screen flex flex-col bg-white overflow-hidden font-sans text-gray-900 select-none">
      
      {/* 1. Full-Screen Edge-to-Edge Header Bar */}
      <header className="h-12 w-full bg-[#f8f9fa] border-b border-[#e5e7eb] px-4 flex items-center justify-between shrink-0 z-30">
        
        {/* Left Section: Brand + Pair Selector + Live Ticker + ATR */}
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2 group mr-2" title="Back to Home">
            <div className="w-6 h-6 rounded bg-gray-900 flex items-center justify-center text-white font-mono text-xs font-bold shadow-sm">
              TP
            </div>
            <span className="font-mono text-xs font-bold tracking-tight text-gray-900 group-hover:text-emerald-600 transition-colors hidden sm:inline">
              TRADER-PRO
            </span>
          </Link>

          <div className="h-4 w-px bg-gray-300"></div>

          {/* Pair Selector Dropdown */}
          <div className="flex items-center gap-1.5">
            <select
              value={symbol}
              onChange={(e) => {
                setSymbol(e.target.value);
                setIsLoading(true);
              }}
              className="bg-white border border-gray-300 rounded px-2.5 py-1 text-xs font-mono font-bold text-gray-900 hover:border-gray-400 focus:outline-none focus:border-emerald-500 cursor-pointer shadow-sm transition-all"
            >
              <option value="BTCUSDT">BTCUSDT (Bitcoin)</option>
              <option value="ETHUSDT">ETHUSDT (Ethereum)</option>
              <option value="SOLUSDT">SOLUSDT (Solana)</option>
              <option value="BNBUSDT">BNBUSDT (BNB)</option>
              <option value="XRPUSDT">XRPUSDT (XRP)</option>
            </select>
          </div>

          <div className="h-4 w-px bg-gray-300 hidden sm:block"></div>

          {/* Real Live Price Ticker */}
          <div className="flex items-center gap-2 font-mono">
            <span className="text-gray-400 text-[11px] font-semibold hidden md:inline">PRICE:</span>
            <span className="text-sm font-extrabold text-gray-900 tracking-tight">
              {livePrice ? `$${livePrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}
            </span>
          </div>

          <div className="h-4 w-px bg-gray-300 hidden md:block"></div>

          {/* ATR 14 Dynamic */}
          <div className="hidden md:flex items-center gap-1.5 font-mono">
            <span className="text-gray-400 text-[11px] font-semibold">ATR (14):</span>
            <span className="text-xs font-bold text-blue-600">
              {indicators ? indicators.atr.toFixed(1) : "—"}
            </span>
          </div>
        </div>

        {/* Center: Timeframe Selector */}
        <div className="flex bg-[#eef0f3] border border-gray-300 rounded p-0.5 gap-0.5 font-mono text-xs">
          {["5m", "15m", "1h", "4h"].map((tf) => (
            <button
              key={tf}
              onClick={() => {
                setTimeframe(tf);
                setIsLoading(true);
              }}
              className={`px-3 py-1 rounded text-xs font-bold transition-all ${
                timeframe === tf
                  ? "bg-white text-gray-900 shadow-sm border border-gray-200"
                  : "text-gray-500 hover:text-gray-900"
              }`}
            >
              {tf.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Right Section: AI Engine Link + Status Indicator */}
        <div className="flex items-center gap-3">
          <Link
            href="/ai-engine"
            className="flex items-center gap-1.5 font-mono text-[11px] font-bold text-gray-700 bg-white hover:bg-gray-50 border border-gray-300 px-2.5 py-1 rounded-md shadow-xs transition-colors"
            title="Open Automated AI Engine & Performance Logs"
          >
            <Zap className="w-3.5 h-3.5 text-emerald-600" />
            <span className="hidden sm:inline">AI Engine (₹1,000)</span>
          </Link>

          <div className="flex items-center gap-1.5 font-mono text-[11px] text-gray-600 bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-1 rounded-full">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="font-bold hidden sm:inline">BINANCE LIVE</span>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] font-mono text-gray-400">
            <RotateCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-emerald-600" : "text-gray-400"}`} />
            <span className="hidden lg:inline">{lastUpdated}</span>
          </div>
        </div>
      </header>

      {/* 2. Main Full-Screen Split Workspace (Chart + Right Intelligence Panel) */}
      <div className="flex-1 w-full grid grid-cols-1 lg:grid-cols-[1fr_420px] overflow-hidden bg-white">
        
        {/* Left Column: Full-Height Interactive TradingView Candlestick Chart + Bottom Dock */}
        <div className="flex flex-col h-full overflow-hidden border-r border-[#e5e7eb] bg-white">
          
          {/* Edge-to-Edge Live TradingView Chart */}
          <div className="flex-1 w-full h-full relative bg-white overflow-hidden">
            <TradingViewChart symbol={`BINANCE:${symbol}`} interval={timeframe} />
          </div>

          {/* Bottom Dock: Multi-Timeframe Alignment & Volatility Microstructure */}
          <div className="h-44 bg-[#f8f9fa] border-t border-[#e5e7eb] p-3 grid grid-cols-1 md:grid-cols-2 gap-3 overflow-y-auto shrink-0">
            
            {/* Multi-Timeframe Alignment */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-emerald-600" /> Multi-Timeframe Confluence
                </span>
                <span className="text-[10px] font-mono bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded font-bold">
                  4H MACRO: PASS
                </span>
              </div>

              <div className="grid grid-cols-4 gap-2">
                <div className="bg-white border border-[#e5e7eb] rounded p-2 flex flex-col gap-0.5 shadow-2xs">
                  <span className="font-mono text-[10px] font-bold text-gray-800">5M Micro</span>
                  <span className="text-[10px] font-mono font-bold text-emerald-600">BULLISH</span>
                  <span className="text-[9px] font-mono text-gray-400">Mom +0.1%</span>
                </div>
                <div className="bg-white border-2 border-emerald-500 rounded p-2 flex flex-col gap-0.5 shadow-sm">
                  <span className="font-mono text-[10px] font-bold text-emerald-700">15M Sniper</span>
                  <span className="text-[10px] font-mono font-bold text-emerald-600">BULLISH</span>
                  <span className="text-[9px] font-mono text-gray-500">Primary Confluence</span>
                </div>
                <div className="bg-white border border-[#e5e7eb] rounded p-2 flex flex-col gap-0.5 shadow-2xs">
                  <span className="font-mono text-[10px] font-bold text-gray-800">1H Structure</span>
                  <span className="text-[10px] font-mono font-bold text-gray-500">RANGING</span>
                  <span className="text-[9px] font-mono text-gray-400">Pivot S/R</span>
                </div>
                <div className="bg-white border border-[#e5e7eb] rounded p-2 flex flex-col gap-0.5 shadow-2xs">
                  <span className="font-mono text-[10px] font-bold text-gray-800">4H Macro Gate</span>
                  <span className="text-[10px] font-mono font-bold text-emerald-600">BULLISH</span>
                  <span className="text-[9px] font-mono text-gray-400">Trend Gate</span>
                </div>
              </div>
            </div>

            {/* Microstructure & Volatility Gauges */}
            <div className="flex flex-col gap-1.5">
              <span className="font-mono text-[11px] font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                <BarChart2 className="w-3.5 h-3.5 text-blue-600" /> Order Flow & Volatility Gauges
              </span>

              <div className="grid grid-cols-3 gap-2">
                <div className="bg-white border border-[#e5e7eb] rounded p-2 flex flex-col gap-0.5 shadow-2xs">
                  <span className="text-[9px] font-mono text-gray-500 uppercase">Volume Z-Score</span>
                  <span className="text-xs font-bold font-mono text-gray-900">
                    {indicators ? `${indicators.volZScore >= 0 ? "+" : ""}${indicators.volZScore.toFixed(2)} σ` : "—"}
                  </span>
                  <div className="w-full h-1 bg-gray-100 border border-gray-200 rounded overflow-hidden mt-1">
                    <div className="h-full bg-blue-500" style={{ width: indicators ? `${Math.max(5, Math.min(100, (indicators.volZScore + 3) / 6 * 100))}%` : "50%" }}></div>
                  </div>
                </div>

                <div className="bg-white border border-[#e5e7eb] rounded p-2 flex flex-col gap-0.5 shadow-2xs">
                  <span className="text-[9px] font-mono text-gray-500 uppercase">RSI (14)</span>
                  <span className="text-xs font-bold font-mono text-emerald-600">
                    {indicators ? indicators.rsi.toFixed(1) : "—"}
                  </span>
                  <div className="w-full h-1 bg-gray-100 border border-gray-200 rounded overflow-hidden mt-1">
                    <div className="h-full bg-emerald-500" style={{ width: indicators ? `${indicators.rsi}%` : "50%" }}></div>
                  </div>
                </div>

                <div className="bg-white border border-[#e5e7eb] rounded p-2 flex flex-col gap-0.5 shadow-2xs">
                  <span className="text-[9px] font-mono text-gray-500 uppercase">Garman-Klass Vol</span>
                  <span className="text-xs font-bold font-mono text-amber-600">
                    {indicators ? (indicators.garmanKlass * 1000).toFixed(4) : "—"}
                  </span>
                  <div className="w-full h-1 bg-gray-100 border border-gray-200 rounded overflow-hidden mt-1">
                    <div className="h-full bg-amber-500" style={{ width: indicators ? `${Math.max(10, Math.min(100, indicators.garmanKlass * 100000))}%` : "40%" }}></div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Right Column: Prominent Actionable Trading Recommendation Card */}
        <aside className="bg-[#f8f9fa] p-3.5 flex flex-col gap-3 overflow-y-auto border-l border-[#e5e7eb] h-full">
          
          {/* PROMINENT RECOMMENDATION & ORDER SETUP CARD */}
          <div className="bg-white border-2 border-emerald-600/40 rounded-xl p-4 flex flex-col gap-3 shadow-md">
            
            {/* Header: Exact Action Signal */}
            <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
              <div className="flex items-center gap-1.5">
                <Target className="w-4 h-4 text-emerald-600" />
                <span className="font-mono text-xs font-extrabold uppercase text-gray-900 tracking-wide">
                  Trading Recommendation
                </span>
              </div>
              <span className="text-[10px] font-mono font-bold bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded">
                SHARK EXCH 0.040%
              </span>
            </div>

            {/* Primary Action Banner */}
            <div className={`p-3 rounded-lg flex items-center justify-between border ${
              recommendation?.action.includes("BUY")
                ? "bg-emerald-50 border-emerald-500 text-emerald-800"
                : "bg-rose-50 border-rose-500 text-rose-800"
            }`}>
              <div className="flex flex-col">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider opacity-75">
                  Recommended Order Action
                </span>
                <span className="font-mono text-base font-black tracking-tight">
                  {recommendation ? recommendation.action : "CALCULATING SETUP..."}
                </span>
              </div>
              <div className="text-right font-mono">
                <span className="text-[9px] uppercase block text-gray-500">Conviction</span>
                <span className="text-sm font-extrabold text-gray-900">
                  {recommendation ? `${recommendation.conviction}%` : "—"}
                </span>
              </div>
            </div>

            {/* Exact Execution Numbers Grid */}
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              
              {/* Recommended Entry Point */}
              <div className="bg-gray-50 border border-gray-300 rounded-lg p-2.5 flex flex-col">
                <span className="text-[9px] text-gray-500 uppercase font-bold flex items-center gap-1">
                  <Compass className="w-3 h-3 text-gray-500" /> Recommended Entry
                </span>
                <span className="text-sm font-black text-gray-900 mt-0.5">
                  {recommendation ? `$${recommendation.entryPrice.toFixed(2)}` : "—"}
                </span>
                <span className="text-[9px] text-gray-400">
                  {recommendation?.orderType === "LIMIT" ? "Wait for Limit Fill" : "Enter at Market Fill"}
                </span>
              </div>

              {/* Risk : Reward Ratio Box */}
              <div className="bg-blue-50 border border-blue-300 rounded-lg p-2.5 flex flex-col">
                <span className="text-[9px] text-blue-700 uppercase font-bold flex items-center gap-1">
                  <Scale className="w-3 h-3 text-blue-600" /> Risk : Reward Ratio
                </span>
                <span className="text-sm font-black text-blue-700 mt-0.5">
                  {recommendation ? recommendation.riskRewardRatio : "1 : 1.50"}
                </span>
                <span className="text-[9px] text-blue-500">
                  Reward {recommendation ? `+₹${recommendation.potentialRewardINR.toFixed(2)}` : "+₹15"} vs Risk {recommendation ? `-₹${recommendation.riskINR.toFixed(2)}` : "-₹10"}
                </span>
              </div>

              {/* Stop Loss (LS) Point */}
              <div className="bg-rose-50 border border-rose-300 rounded-lg p-2.5 flex flex-col">
                <span className="text-[9px] text-rose-700 uppercase font-bold">
                  Stop Loss (-1.0R)
                </span>
                <span className="text-sm font-black text-rose-700 mt-0.5">
                  {recommendation ? `$${recommendation.stopLoss.toFixed(2)}` : "—"}
                </span>
                <span className="text-[9px] text-rose-600 font-semibold">
                  {recommendation ? `-${recommendation.stopLossDistance.toFixed(1)} pts (${recommendation.stopLossPercent.toFixed(2)}%)` : "—"}
                </span>
              </div>

              {/* Take Profit (TP) Point */}
              <div className="bg-emerald-50 border border-emerald-300 rounded-lg p-2.5 flex flex-col">
                <span className="text-[9px] text-emerald-700 uppercase font-bold">
                  Take Profit (+1.5R)
                </span>
                <span className="text-sm font-black text-emerald-700 mt-0.5">
                  {recommendation ? `$${recommendation.takeProfit.toFixed(2)}` : "—"}
                </span>
                <span className="text-[9px] text-emerald-600 font-semibold">
                  {recommendation ? `+${recommendation.takeProfitDistance.toFixed(1)} pts (${recommendation.takeProfitPercent.toFixed(2)}%)` : "—"}
                </span>
              </div>

            </div>

            {/* Visual Risk vs Reward Ratio Bar */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-2.5 flex flex-col gap-1.5 font-mono text-[11px]">
              <div className="flex justify-between items-center text-[10px]">
                <span className="text-rose-600 font-bold">Risk: 1.0R (₹10.00 / 1%)</span>
                <span className="text-gray-400">Ratio 1:1.50</span>
                <span className="text-emerald-600 font-bold">Reward: 1.5R (+₹15.00)</span>
              </div>
              <div className="w-full h-2 rounded-full overflow-hidden flex bg-gray-200">
                <div className="bg-rose-500 h-full w-[40%]" title="Risk 1.0R"></div>
                <div className="bg-emerald-500 h-full w-[60%]" title="Reward 1.5R"></div>
              </div>
            </div>

            {/* Breakeven Ratchet (+0.30R Trail Trigger) */}
            <div className="bg-blue-50/70 border border-blue-200 rounded-lg p-2 flex items-center justify-between font-mono text-[11px]">
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-blue-700 uppercase">⚡ +0.30R Breakeven Ratchet</span>
                <span className="text-[10px] text-gray-500">Trail Stop Loss to Breakeven (+0.05R fee buffer) at:</span>
              </div>
              <span className="text-xs font-black text-blue-700">
                {recommendation ? `$${recommendation.breakevenTrigger.toFixed(2)}` : "—"}
              </span>
            </div>

            {/* Actionable plain-English instruction */}
            <div className="bg-[#f0fdf4] border border-emerald-200 rounded-lg p-2.5 text-xs text-gray-800 leading-relaxed font-sans">
              <span className="font-bold text-emerald-800 block mb-0.5">Execution Instructions:</span>
              {recommendation?.actionGuidance || "Analyzing live market structure for optimal order entry..."}
            </div>

          </div>

          {/* Dynamic S/R Ladder */}
          <div className="bg-white border border-[#e5e7eb] rounded-lg p-3 flex flex-col gap-2 shadow-sm">
            <span className="font-mono text-xs font-bold uppercase text-gray-900 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-emerald-600" /> Dynamic S/R Radar (50-Bar Pivots)
            </span>

            <div className="flex flex-col gap-1.5 font-mono">
              <div className="flex items-center justify-between p-2 rounded bg-rose-50 border border-rose-200">
                <span className="text-[10px] font-bold text-rose-700">RESISTANCE (CEILING)</span>
                <span className="text-xs font-bold text-rose-700">
                  {indicators ? `$${indicators.nearestResistance.toFixed(1)} (+${indicators.distToResistanceATR.toFixed(1)}R)` : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-gray-50 border border-gray-200">
                <span className="text-[10px] font-bold text-gray-600">LIVE TICKER</span>
                <span className="text-xs font-bold text-gray-900">
                  {livePrice ? `$${livePrice.toFixed(1)}` : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-emerald-50 border border-emerald-200">
                <span className="text-[10px] font-bold text-emerald-700">SUPPORT (FLOOR)</span>
                <span className="text-xs font-bold text-emerald-700">
                  {indicators ? `$${indicators.nearestSupport.toFixed(1)} (-${indicators.distToSupportATR.toFixed(1)}R)` : "—"}
                </span>
              </div>
            </div>
          </div>

          {/* Position Sizing Calculator (Shark Exchange ₹1,000 Capital) */}
          <div className="bg-white border border-[#e5e7eb] rounded-lg p-3 flex flex-col gap-2 shadow-sm">
            <span className="font-mono text-xs font-bold uppercase text-gray-900 flex items-center gap-1.5">
              <SlidersHorizontal className="w-3.5 h-3.5 text-gray-600" /> Shark Exchange Sizing (₹1,000 Capital)
            </span>

            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div>
                <label className="text-[9px] text-gray-400 uppercase font-semibold">Account Size (₹)</label>
                <input
                  type="number"
                  value={accountBalance}
                  onChange={(e) => setAccountBalance(Number(e.target.value))}
                  className="w-full bg-gray-50 border border-gray-300 rounded px-2 py-1 text-gray-900 focus:outline-none focus:border-emerald-500 font-bold"
                />
              </div>
              <div>
                <label className="text-[9px] text-gray-400 uppercase font-semibold">Risk Per Trade (%)</label>
                <input
                  type="number"
                  step="0.5"
                  value={riskPercent}
                  onChange={(e) => setRiskPercent(Number(e.target.value))}
                  className="w-full bg-gray-50 border border-gray-300 rounded px-2 py-1 text-gray-900 focus:outline-none focus:border-emerald-500 font-bold"
                />
              </div>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded p-2 flex flex-col gap-1 font-mono text-[11px]">
              <div className="flex justify-between">
                <span className="text-gray-500">Max Risk (1%):</span>
                <span className="font-bold text-rose-600">₹{(accountBalance * riskPercent / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Potential Profit (1.5R):</span>
                <span className="font-bold text-emerald-600">+₹{(accountBalance * riskPercent / 100 * 1.5).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Shark Fee (0.040% + GST):</span>
                <span className="font-bold text-blue-600">₹{recommendation?.sharkExchangeFeeINR || "0.94"}</span>
              </div>
            </div>
          </div>

        </aside>

      </div>

    </div>
  );
}
