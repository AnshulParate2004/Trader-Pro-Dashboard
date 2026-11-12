"use client";

import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  LineStyle,
  ColorType,
  CrosshairMode,
  createSeriesMarkers,
  type IChartApi,
  type ISeriesApi,
  type IPriceLine,
  type UTCTimestamp,
  type SeriesMarker,
} from "lightweight-charts";
import {
  TrendingUp,
  TrendingDown,
  Layers,
  Activity,
  Maximize2,
  Minimize2,
  ChevronLeft,
  ChevronRight,
  Eye,
  Sliders,
  CheckCircle,
  AlertTriangle,
  Clock,
  Sparkles,
  ExternalLink,
} from "lucide-react";

export interface ChartTrade {
  id: string;
  trade_id?: string;
  entryTime?: string;
  entry_time?: string;
  entry_time_ms?: number;
  exitTime?: string;
  exit_time?: string;
  exit_time_ms?: number;
  direction?: "LONG" | "SHORT";
  side?: "LONG" | "SHORT";
  symbol: string;
  rawSymbol?: string;
  displaySymbol?: string;
  entryPrice: number;
  entry_price?: number;
  stopLoss: number;
  stop_loss?: number;
  takeProfit: number;
  take_profit?: number;
  exitPrice?: number;
  exit_price?: number;
  exitReason?: string;
  exit_type?: string;
  status?: string;
  net_r?: number;
  outcomeR?: number;
  returnPct?: number;
  stopDistancePct?: number;
  stop_distance_pct?: number;
  positionSizeINR?: number;
  pnlNetINR?: number;
  bars_held?: number;
  holdingBars?: number;
  modelId?: string;
  routed_engine?: string;
  routedEngine?: string;
}

interface ProTradeChartProps {
  symbol: string;
  interval: string;
  trades: ChartTrade[];
  selectedTrade: ChartTrade | null;
  onSelectTrade: (trade: ChartTrade | null) => void;
  showFibonacci: boolean;
  onToggleFibonacci: () => void;
  filterType: "ALL" | "LIVE" | "HISTORICAL";
  onChangeFilterType: (filter: "ALL" | "LIVE" | "HISTORICAL") => void;
  onSwitchToTradingView: () => void;
  isMaximized: boolean;
  onToggleMaximize: () => void;
}

interface RawCandle {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export default function ProTradeChart({
  symbol,
  interval,
  trades,
  selectedTrade,
  onSelectTrade,
  showFibonacci,
  onToggleFibonacci,
  filterType,
  onChangeFilterType,
  onSwitchToTradingView,
  isMaximized,
  onToggleMaximize,
}: ProTradeChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<any>(null);
  const volumeSeriesRef = useRef<any>(null);
  const markersPluginRef = useRef<any>(null);
  const priceLinesRef = useRef<IPriceLine[]>([]);

  const [candles, setCandles] = useState<RawCandle[]>([]);
  const [isLoadingCandles, setIsLoadingCandles] = useState<boolean>(true);
  const [currentLivePrice, setCurrentLivePrice] = useState<number | null>(null);
  const [isInspectorExpanded, setIsInspectorExpanded] = useState<boolean>(true);

  // Normalize Interval for Binance API
  const binanceInterval = useMemo(() => {
    const map: Record<string, string> = {
      "1m": "1m",
      "5m": "5m",
      "15m": "15m",
      "1h": "1h",
      "4h": "4h",
      "1d": "1d",
    };
    return map[interval.toLowerCase()] || "4h";
  }, [interval]);

  // Clean symbol for Binance
  const cleanSymbol = useMemo(() => {
    return symbol.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  }, [symbol]);

  // 1. Fetch Candle Data (up to 1,000 historical candles)
  useEffect(() => {
    let isMounted = true;
    setIsLoadingCandles(true);

    const fetchCandles = async () => {
      try {
        let fetchedCandles: RawCandle[] = [];
        
        // Try Binance Futures first (supports crypto + metals/oil perpetuals)
        try {
          const res = await fetch(
            `https://fapi.binance.com/fapi/v1/klines?symbol=${cleanSymbol}&interval=${binanceInterval}&limit=1000`
          );
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data) && data.length > 0) {
              fetchedCandles = data.map((d: any) => ({
                openTime: Number(d[0]),
                open: parseFloat(d[1]),
                high: parseFloat(d[2]),
                low: parseFloat(d[3]),
                close: parseFloat(d[4]),
                volume: parseFloat(d[5]),
              }));
            }
          }
        } catch (e) {
          console.warn("Binance futures klines error:", e);
        }

        // Fallback for commodities or spot if futures returned empty
        if (fetchedCandles.length === 0) {
          try {
            const res = await fetch(
              `https://api.binance.com/api/v3/klines?symbol=${cleanSymbol}&interval=${binanceInterval}&limit=1000`
            );
            if (res.ok) {
              const data = await res.json();
              if (Array.isArray(data) && data.length > 0) {
                fetchedCandles = data.map((d: any) => ({
                  openTime: Number(d[0]),
                  open: parseFloat(d[1]),
                  high: parseFloat(d[2]),
                  low: parseFloat(d[3]),
                  close: parseFloat(d[4]),
                  volume: parseFloat(d[5]),
                }));
              }
            }
          } catch (e) {
            console.warn("Binance spot klines fallback error:", e);
          }
        }

        // Commodities fallback to internal market API
        if (fetchedCandles.length === 0 && ["GC=F", "SI=F", "CL=F", "XAUUSDT", "XAGUSDT", "CLUSDT"].includes(cleanSymbol)) {
          try {
            const res = await fetch(`/api/market/klines?symbol=${encodeURIComponent(cleanSymbol)}&range=1y`);
            if (res.ok) {
              const json = await res.json();
              if (json.success && Array.isArray(json.candles)) {
                fetchedCandles = json.candles;
              }
            }
          } catch (e) {
            console.warn("Commodity klines fallback error:", e);
          }
        }

        if (isMounted) {
          if (fetchedCandles.length > 0) {
            setCandles(fetchedCandles);
            setCurrentLivePrice(fetchedCandles[fetchedCandles.length - 1].close);
          }
          setIsLoadingCandles(false);
        }
      } catch (err) {
        console.error("Failed to fetch chart candles:", err);
        if (isMounted) setIsLoadingCandles(false);
      }
    };

    fetchCandles();

    // Auto-refresh last candle every 15 seconds
    const refreshTimer = setInterval(fetchCandles, 15000);
    return () => {
      isMounted = false;
      clearInterval(refreshTimer);
    };
  }, [cleanSymbol, binanceInterval]);

  // 2. Initialize Lightweight Chart
  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container) return;

    // Destroy existing instance
    if (chartInstanceRef.current) {
      chartInstanceRef.current.remove();
      chartInstanceRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      markersPluginRef.current = null;
      priceLinesRef.current = [];
    }

    const chart = createChart(container, {
      width: container.clientWidth,
      height: container.clientHeight,
      layout: {
        background: { type: ColorType.Solid, color: "#ffffff" },
        textColor: "#475569",
        fontFamily: "'GT Standard Mono', 'GeistMono', monospace",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "#f1f5f9" },
        horzLines: { color: "#f1f5f9" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: "#94a3b8",
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: "#0f172a",
        },
        horzLine: {
          color: "#94a3b8",
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: "#0f172a",
        },
      },
      rightPriceScale: {
        borderColor: "#e2e8f0",
        scaleMargins: {
          top: 0.12,
          bottom: 0.18,
        },
      },
      timeScale: {
        borderColor: "#e2e8f0",
        timeVisible: true,
        secondsVisible: false,
      },
      handleScale: {
        mouseWheel: true,
        pinch: true,
        axisPressedMouseMove: true,
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: true,
      },
    });

    // Add Candlestick Series
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#10b981",
      downColor: "#ef4444",
      borderVisible: false,
      wickUpColor: "#10b981",
      wickDownColor: "#ef4444",
    });

    // Add Volume Series at bottom
    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: {
        type: "volume",
      },
      priceScaleId: "", // Overlay on pane
    });

    volumeSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.85,
        bottom: 0,
      },
    });

    chartInstanceRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;

    // Handle Resize
    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0 || !chartInstanceRef.current) return;
      const { width, height } = entries[0].contentRect;
      chartInstanceRef.current.applyOptions({ width, height });
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      if (chartInstanceRef.current) {
        chartInstanceRef.current.remove();
        chartInstanceRef.current = null;
      }
    };
  }, []);

  // 3. Update Candle and Volume Data
  useEffect(() => {
    const candleSeries = candleSeriesRef.current;
    const volumeSeries = volumeSeriesRef.current;
    if (!candleSeries || !volumeSeries || candles.length === 0) return;

    // Deduplicate and sort strictly ascending by timestamp
    const sorted = [...candles].sort((a, b) => a.openTime - b.openTime);
    const seenTimes = new Set<number>();
    const candleData: any[] = [];
    const volumeData: any[] = [];

    for (const c of sorted) {
      const t = Math.floor(c.openTime / 1000) as UTCTimestamp;
      if (!seenTimes.has(t)) {
        seenTimes.add(t);
        candleData.push({
          time: t,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        });
        volumeData.push({
          time: t,
          value: c.volume,
          color: c.close >= c.open ? "rgba(16, 185, 129, 0.25)" : "rgba(239, 68, 68, 0.25)",
        });
      }
    }

    candleSeries.setData(candleData);
    volumeSeries.setData(volumeData);
  }, [candles]);

  // 4. Filter Trades for this graph
  const filteredTrades = useMemo(() => {
    return trades.filter((t) => {
      const isLive = t.status === "ACTIVE" || (t.id && t.id.startsWith("router_"));
      if (filterType === "LIVE") return isLive;
      if (filterType === "HISTORICAL") return !isLive;
      return true;
    });
  }, [trades, filterType]);

  // Helper: map a millisecond timestamp to the nearest candle time in the chart
  const findNearestCandleTime = useCallback(
    (timeMs: number): UTCTimestamp | null => {
      if (candles.length === 0) return null;
      const sec = Math.floor(timeMs / 1000);
      const firstCandleSec = Math.floor(candles[0].openTime / 1000);
      if (sec < firstCandleSec) return null; // earlier than chart history

      for (let i = 0; i < candles.length; i++) {
        const curr = Math.floor(candles[i].openTime / 1000);
        const next =
          i < candles.length - 1 ? Math.floor(candles[i + 1].openTime / 1000) : Infinity;
        if (sec >= curr && sec < next) {
          return curr as UTCTimestamp;
        }
      }
      return Math.floor(candles[candles.length - 1].openTime / 1000) as UTCTimestamp;
    },
    [candles]
  );

  // 5. Update Trade Markers on Candlestick Bars
  useEffect(() => {
    const candleSeries = candleSeriesRef.current;
    if (!candleSeries || candles.length === 0) return;

    const markers: SeriesMarker<UTCTimestamp>[] = [];

    filteredTrades.forEach((trade) => {
      const entryMs = trade.entry_time_ms || (trade.entryTime ? new Date(trade.entryTime).getTime() : 0);
      if (!entryMs) return;

      const candleTime = findNearestCandleTime(entryMs);
      if (!candleTime) return;

      const isLive = trade.status === "ACTIVE" || (trade.id && trade.id.startsWith("router_"));
      const isLong = (trade.direction || trade.side) === "LONG";
      const isSelected = selectedTrade && (selectedTrade.id === trade.id || selectedTrade.trade_id === trade.trade_id);

      // Entry Marker
      markers.push({
        time: candleTime,
        position: isLong ? "belowBar" : "aboveBar",
        shape: isLong ? "arrowUp" : "arrowDown",
        color: isLong ? (isSelected ? "#2563eb" : "#10b981") : isSelected ? "#9333ea" : "#f43f5e",
        text: `${isLive ? "⚡LIVE " : ""}${isLong ? "LONG" : "SHORT"} @ $${Number(
          trade.entryPrice || trade.entry_price
        ).toLocaleString()}`,
        size: isSelected ? 2 : 1,
      });

      // Exit Marker (for closed trades)
      const exitMs = trade.exit_time_ms || (trade.exitTime ? new Date(trade.exitTime).getTime() : 0);
      if (exitMs && exitMs > entryMs) {
        const exitCandleTime = findNearestCandleTime(exitMs);
        if (exitCandleTime) {
          const exitReason = trade.exitReason || trade.exit_type || "";
          const isWin = exitReason === "TAKE_PROFIT" || (trade.net_r ?? 0) > 0;
          markers.push({
            time: exitCandleTime,
            position: isLong ? "aboveBar" : "belowBar",
            shape: "circle",
            color: isWin ? "#10b981" : exitReason === "STOP_LOSS" ? "#ef4444" : "#f59e0b",
            text: isWin ? "🎯 TP HIT (+2.5R)" : exitReason === "STOP_LOSS" ? "🛑 SL HIT (-1.0R)" : "⏱ EXPIRED",
            size: 1,
          });
        }
      }
    });

    // Sort markers by time strictly ascending
    markers.sort((a, b) => (a.time as number) - (b.time as number));

    if (!markersPluginRef.current) {
      markersPluginRef.current = createSeriesMarkers(candleSeries, markers);
    } else {
      markersPluginRef.current.setMarkers(markers);
    }
  }, [candles, filteredTrades, selectedTrade, findNearestCandleTime]);

  // 6. Draw SL, TP, Entry, and Fibonacci Price Lines for Selected Trade
  useEffect(() => {
    const candleSeries = candleSeriesRef.current;
    if (!candleSeries) return;

    // Clear previous price lines
    priceLinesRef.current.forEach((line) => {
      try {
        candleSeries.removePriceLine(line);
      } catch (e) {
        // line already disposed
      }
    });
    priceLinesRef.current = [];

    if (!selectedTrade) return;

    const entry = Number(selectedTrade.entryPrice || selectedTrade.entry_price || 0);
    const sl = Number(selectedTrade.stopLoss || selectedTrade.stop_loss || 0);
    const tp = Number(selectedTrade.takeProfit || selectedTrade.take_profit || 0);

    if (!entry || !sl || !tp) return;

    const isLong = (selectedTrade.direction || selectedTrade.side) === "LONG";
    const slDistPct = entry > 0 ? (Math.abs(entry - sl) / entry) * 100 : 0;
    const tpDistPct = entry > 0 ? (Math.abs(tp - entry) / entry) * 100 : 0;

    // 1. Entry Line (Cyan / Blue)
    const entryLine = candleSeries.createPriceLine({
      price: entry,
      color: "#2563eb",
      lineWidth: 2,
      lineStyle: LineStyle.Solid,
      axisLabelVisible: true,
      title: `ENTRY: $${entry.toLocaleString()} (${selectedTrade.direction || selectedTrade.side})`,
    });
    priceLinesRef.current.push(entryLine);

    // 2. Stop Loss Line (Crimson Red)
    const slLine = candleSeries.createPriceLine({
      price: sl,
      color: "#ef4444",
      lineWidth: 2,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
      title: `STOP LOSS (SL): $${sl.toLocaleString()} (-${slDistPct.toFixed(2)}% | -1.0R)`,
    });
    priceLinesRef.current.push(slLine);

    // 3. Take Profit Line (Bright Emerald Green)
    const tpLine = candleSeries.createPriceLine({
      price: tp,
      color: "#10b981",
      lineWidth: 2,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
      title: `TAKE PROFIT (TP): $${tp.toLocaleString()} (+${tpDistPct.toFixed(2)}% | +2.5R)`,
    });
    priceLinesRef.current.push(tpLine);

    // 4. Fibonacci Retracement Levels (if enabled)
    if (showFibonacci) {
      // Calculate Fibonacci levels across the trade's structural swing (SL to TP)
      // Standard Fibonacci ratios: 23.6%, 38.2%, 50.0%, 61.8% (Golden Pocket), 78.6%
      const swingLow = Math.min(sl, tp);
      const swingHigh = Math.max(sl, tp);
      const swingRange = swingHigh - swingLow;

      const fibRatios = [
        { label: "FIB 0.0%", ratio: 0.0, isGolden: false },
        { label: "FIB 23.6%", ratio: 0.236, isGolden: false },
        { label: "FIB 38.2%", ratio: 0.382, isGolden: false },
        { label: "FIB 50.0% (Equilibrium)", ratio: 0.500, isGolden: false },
        { label: "FIB 61.8% (GOLDEN POCKET)", ratio: 0.618, isGolden: true },
        { label: "FIB 78.6%", ratio: 0.786, isGolden: false },
        { label: "FIB 100.0%", ratio: 1.0, isGolden: false },
      ];

      fibRatios.forEach((fib) => {
        // Compute price level in the direction of the trade
        let fibPrice = 0;
        if (isLong) {
          // In LONG: 0.0% is structural base (SL), 100% is TP target
          fibPrice = swingLow + fib.ratio * swingRange;
        } else {
          // In SHORT: 0.0% is structural swing high (SL), 100% is TP target
          fibPrice = swingHigh - fib.ratio * swingRange;
        }

        // Avoid overlapping exact lines with entry, sl, or tp
        if (
          Math.abs(fibPrice - entry) / entry > 0.0015 &&
          Math.abs(fibPrice - sl) / sl > 0.0015 &&
          Math.abs(fibPrice - tp) / tp > 0.0015
        ) {
          const fibLine = candleSeries.createPriceLine({
            price: fibPrice,
            color: fib.isGolden ? "#d97706" : "#64748b",
            lineWidth: fib.isGolden ? 2 : 1,
            lineStyle: fib.isGolden ? LineStyle.Dashed : LineStyle.Dotted,
            axisLabelVisible: true,
            title: `${fib.label}: $${fibPrice.toFixed(2)}`,
          });
          priceLinesRef.current.push(fibLine);
        }
      });
    }
  }, [selectedTrade, showFibonacci]);

  // Focus chart on the selected trade's candlestick
  const handleFocusSelectedTrade = useCallback(() => {
    if (!selectedTrade || !chartInstanceRef.current || candles.length === 0) return;
    const entryMs = selectedTrade.entry_time_ms || (selectedTrade.entryTime ? new Date(selectedTrade.entryTime).getTime() : 0);
    if (!entryMs) return;

    const candleTime = findNearestCandleTime(entryMs);
    if (!candleTime) return;

    const chart = chartInstanceRef.current;
    const rangeBars = 30; // show 30 bars centered around the trade
    const targetSec = candleTime as number;

    const fromSec = Math.max(
      Math.floor(candles[0].openTime / 1000),
      targetSec - rangeBars * (binanceInterval === "4h" ? 14400 : binanceInterval === "1h" ? 3600 : 900)
    );
    const toSec = Math.min(
      Math.floor(candles[candles.length - 1].openTime / 1000),
      targetSec + rangeBars * (binanceInterval === "4h" ? 14400 : binanceInterval === "1h" ? 3600 : 900)
    );

    chart.timeScale().setVisibleRange({
      from: fromSec as UTCTimestamp,
      to: toSec as UTCTimestamp,
    });
  }, [selectedTrade, candles, binanceInterval, findNearestCandleTime]);

  // Navigation between trades
  const currentTradeIndex = useMemo(() => {
    if (!selectedTrade) return -1;
    return filteredTrades.findIndex(
      (t) => t.id === selectedTrade.id || (t.trade_id && t.trade_id === selectedTrade.trade_id)
    );
  }, [selectedTrade, filteredTrades]);

  const handlePrevTrade = () => {
    if (filteredTrades.length === 0) return;
    const nextIdx = currentTradeIndex <= 0 ? filteredTrades.length - 1 : currentTradeIndex - 1;
    onSelectTrade(filteredTrades[nextIdx]);
  };

  const handleNextTrade = () => {
    if (filteredTrades.length === 0) return;
    const nextIdx = currentTradeIndex >= filteredTrades.length - 1 ? 0 : currentTradeIndex + 1;
    onSelectTrade(filteredTrades[nextIdx]);
  };

  // Compute live distance from entry/SL/TP
  const tradeMetrics = useMemo(() => {
    if (!selectedTrade) return null;
    const entry = Number(selectedTrade.entryPrice || selectedTrade.entry_price || 0);
    const sl = Number(selectedTrade.stopLoss || selectedTrade.stop_loss || 0);
    const tp = Number(selectedTrade.takeProfit || selectedTrade.take_profit || 0);
    const isLong = (selectedTrade.direction || selectedTrade.side) === "LONG";
    const isLive = selectedTrade.status === "ACTIVE" || (selectedTrade.id && selectedTrade.id.startsWith("router_"));

    const riskDelta = Math.abs(entry - sl);
    const targetDelta = Math.abs(tp - entry);
    const riskPct = entry > 0 ? (riskDelta / entry) * 100 : 0;
    const targetPct = entry > 0 ? (targetDelta / entry) * 100 : 0;

    // Golden Pocket 61.8%
    const swingLow = Math.min(sl, tp);
    const swingHigh = Math.max(sl, tp);
    const goldenPocketPrice = isLong ? swingLow + 0.618 * (swingHigh - swingLow) : swingHigh - 0.618 * (swingHigh - swingLow);

    let currentPnLR = 0;
    let currentDistPct = 0;
    if (currentLivePrice && entry > 0 && riskDelta > 0) {
      if (isLong) {
        currentPnLR = (currentLivePrice - entry) / riskDelta;
        currentDistPct = ((currentLivePrice - entry) / entry) * 100;
      } else {
        currentPnLR = (entry - currentLivePrice) / riskDelta;
        currentDistPct = ((entry - currentLivePrice) / entry) * 100;
      }
    }

    return {
      entry,
      sl,
      tp,
      isLong,
      isLive,
      riskPct,
      targetPct,
      goldenPocketPrice,
      currentPnLR,
      currentDistPct,
      riskDelta,
      targetDelta,
    };
  }, [selectedTrade, currentLivePrice]);

  return (
    <div className="relative w-full h-full flex flex-col bg-white overflow-hidden select-none font-mono">
      {/* 1. Interactive Pro Chart Top Bar */}
      <div className="bg-white/95 backdrop-blur-sm border-b border-slate-200/90 px-3 py-1.5 flex flex-wrap items-center justify-between gap-2 z-20 shrink-0 text-xs shadow-2xs">
        {/* Left: Active Symbol, Price, & Mode Switch */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 font-black text-slate-900 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="tracking-tight">{symbol}</span>
            <span className="text-slate-400 font-normal">·</span>
            <span className="text-slate-600 font-bold">{interval.toUpperCase()}</span>
          </div>

          {currentLivePrice !== null && (
            <div className="font-bold text-slate-900 bg-emerald-50/80 text-emerald-800 border border-emerald-200/80 px-2 py-0.5 rounded text-[11px]">
              ${currentLivePrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
            </div>
          )}

          {/* Switch to TradingView Cloud Widget */}
          <button
            onClick={onSwitchToTradingView}
            className="flex items-center gap-1 text-[11px] font-bold text-slate-600 hover:text-slate-950 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-2 py-0.5 rounded transition-all cursor-pointer"
            title="Switch back to external TradingView Cloud Widget"
          >
            <ExternalLink className="w-3 h-3 text-blue-600" />
            <span>TV Cloud</span>
          </button>
        </div>

        {/* Center: Trade Markings Filter Tabs */}
        <div className="flex items-center gap-1 clay-white-inset p-0.5 rounded-md text-[11px]">
          <button
            onClick={() => onChangeFilterType("ALL")}
            className={`px-2 py-0.5 rounded font-bold transition-all cursor-pointer ${
              filterType === "ALL"
                ? "bg-white text-slate-950 shadow-2xs border border-slate-200"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            All Trades ({trades.length})
          </button>
          <button
            onClick={() => onChangeFilterType("LIVE")}
            className={`px-2 py-0.5 rounded font-bold transition-all cursor-pointer flex items-center gap-1 ${
              filterType === "LIVE"
                ? "bg-emerald-600 text-white shadow-2xs"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-ping" />
            Live Only
          </button>
          <button
            onClick={() => onChangeFilterType("HISTORICAL")}
            className={`px-2 py-0.5 rounded font-bold transition-all cursor-pointer ${
              filterType === "HISTORICAL"
                ? "bg-white text-slate-950 shadow-2xs border border-slate-200"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            Historical
          </button>
        </div>

        {/* Right: Fibonacci Toggle, Inspector Toggle & Maximize */}
        <div className="flex items-center gap-1.5">
          {/* Fibonacci Toggle */}
          <button
            onClick={onToggleFibonacci}
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-bold border transition-all cursor-pointer ${
              showFibonacci
                ? "bg-amber-50 text-amber-900 border-amber-300 shadow-2xs"
                : "bg-white text-slate-500 border-slate-200 hover:text-slate-900"
            }`}
            title="Toggle Fibonacci Retracement Grid (61.8% Golden Pocket, 50% Equilibrium, 38.2%)"
          >
            <Sparkles className={`w-3 h-3 ${showFibonacci ? "text-amber-600" : "text-slate-400"}`} />
            <span>Fibonacci {showFibonacci ? "ON" : "OFF"}</span>
            {showFibonacci && (
              <span className="bg-amber-200 text-amber-950 text-[9px] px-1 rounded font-black">61.8%</span>
            )}
          </button>

          {/* Maximize Button */}
          <button
            onClick={onToggleMaximize}
            className="p-1 rounded bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-950 cursor-pointer"
            title={isMaximized ? "Restore Layout (Esc)" : "Maximize Chart Area"}
          >
            {isMaximized ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* 2. Main Canvas Container */}
      <div className="flex-1 w-full h-full relative overflow-hidden bg-white">
        <div ref={chartContainerRef} className="w-full h-full" />

        {/* Loading Overlay */}
        {isLoadingCandles && (
          <div className="absolute inset-0 bg-white/70 backdrop-blur-xs flex items-center justify-center z-30">
            <div className="flex flex-col items-center gap-2 bg-white px-4 py-3 rounded-xl border border-slate-200 shadow-lg font-mono text-xs text-slate-700">
              <div className="w-5 h-5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
              <span>Loading 1,000 Candles & Executing Trade Overlay...</span>
            </div>
          </div>
        )}

        {/* 3. Floating Interactive Trade & Fibonacci Execution HUD */}
        {selectedTrade && tradeMetrics && (
          <div
            className={`absolute top-3 right-3 z-30 bg-slate-950/95 text-white rounded-xl shadow-2xl border border-slate-800 backdrop-blur-md transition-all duration-200 ${
              isInspectorExpanded ? "w-80 p-3.5" : "w-auto px-3 py-1.5 cursor-pointer"
            }`}
          >
            {/* Header / Bar */}
            <div
              onClick={() => !isInspectorExpanded && setIsInspectorExpanded(true)}
              className="flex items-center justify-between gap-2 cursor-pointer pb-1.5 border-b border-slate-800"
            >
              <div className="flex items-center gap-1.5 text-xs font-bold">
                {tradeMetrics.isLive ? (
                  <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[9px] px-1.5 py-0.5 rounded font-black flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                    LIVE ROUTER TRADE
                  </span>
                ) : (
                  <span className="bg-purple-500/20 text-purple-400 border border-purple-500/40 text-[9px] px-1.5 py-0.5 rounded font-black">
                    HISTORICAL TRADE
                  </span>
                )}
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-black ${
                    tradeMetrics.isLong
                      ? "bg-emerald-600 text-white"
                      : "bg-rose-600 text-white"
                  }`}
                >
                  {tradeMetrics.isLong ? "LONG" : "SHORT"}
                </span>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsInspectorExpanded(!isInspectorExpanded);
                  }}
                  className="text-slate-400 hover:text-white p-0.5 rounded text-[10px]"
                >
                  {isInspectorExpanded ? "Hide ▲" : "Inspect ▼"}
                </button>
              </div>
            </div>

            {/* Expanded Detailed Trade Metrics */}
            {isInspectorExpanded && (
              <div className="mt-2.5 space-y-2 text-xs">
                {/* Trade Selector & Stepper */}
                <div className="flex items-center justify-between gap-1 text-[11px] text-slate-400 pb-2 border-b border-slate-800/80">
                  <span className="truncate">
                    Trade #{currentTradeIndex + 1} of {filteredTrades.length}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={handlePrevTrade}
                      className="p-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 cursor-pointer"
                      title="Previous trade"
                    >
                      <ChevronLeft className="w-3 h-3" />
                    </button>
                    <button
                      onClick={handleNextTrade}
                      className="p-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 cursor-pointer"
                      title="Next trade"
                    >
                      <ChevronRight className="w-3 h-3" />
                    </button>
                    <button
                      onClick={handleFocusSelectedTrade}
                      className="px-2 py-0.5 rounded bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 border border-blue-500/50 font-bold text-[10px] cursor-pointer"
                      title="Zoom chart to this trade's entry bar"
                    >
                      Focus Bar
                    </button>
                  </div>
                </div>

                {/* Primary Price Execution Matrix */}
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  {/* Entry Price */}
                  <div className="bg-slate-900/80 p-2 rounded-lg border border-blue-500/30">
                    <div className="text-blue-400 text-[10px] font-bold">ENTRY PRICE</div>
                    <div className="text-sm font-black text-white mt-0.5">
                      ${tradeMetrics.entry.toLocaleString()}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {selectedTrade.entryTime ? new Date(selectedTrade.entryTime).toLocaleDateString() : ""}
                    </div>
                  </div>

                  {/* Stop Loss */}
                  <div className="bg-slate-900/80 p-2 rounded-lg border border-rose-500/30">
                    <div className="text-rose-400 text-[10px] font-bold">STOP LOSS (SL)</div>
                    <div className="text-sm font-black text-white mt-0.5">
                      ${tradeMetrics.sl.toLocaleString()}
                    </div>
                    <div className="text-[10px] text-rose-300 font-bold">
                      -{tradeMetrics.riskPct.toFixed(2)}% (-1.0R)
                    </div>
                  </div>
                </div>

                {/* Take Profit & Fibonacci Level */}
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  {/* Take Profit */}
                  <div className="bg-slate-900/80 p-2 rounded-lg border border-emerald-500/30">
                    <div className="text-emerald-400 text-[10px] font-bold">TAKE PROFIT (TP)</div>
                    <div className="text-sm font-black text-white mt-0.5">
                      ${tradeMetrics.tp.toLocaleString()}
                    </div>
                    <div className="text-[10px] text-emerald-300 font-bold">
                      +{tradeMetrics.targetPct.toFixed(2)}% (+2.5R)
                    </div>
                  </div>

                  {/* Fibonacci Golden Pocket */}
                  <div className="bg-slate-900/80 p-2 rounded-lg border border-amber-500/30">
                    <div className="text-amber-400 text-[10px] font-bold flex items-center gap-1">
                      <Sparkles className="w-2.5 h-2.5" />
                      <span>FIB 61.8% (GOLDEN)</span>
                    </div>
                    <div className="text-sm font-black text-amber-300 mt-0.5">
                      ${tradeMetrics.goldenPocketPrice.toFixed(2)}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Target Ratio 1 : 2.5
                    </div>
                  </div>
                </div>

                {/* Outcome or Live PnL */}
                <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800 text-[11px]">
                  {tradeMetrics.isLive ? (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Live Status:</span>
                      <span className="text-emerald-400 font-bold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        ACTIVE ({tradeMetrics.currentDistPct >= 0 ? "+" : ""}
                        {tradeMetrics.currentDistPct.toFixed(2)}% | {tradeMetrics.currentPnLR >= 0 ? "+" : ""}
                        {tradeMetrics.currentPnLR.toFixed(2)}R)
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Exit Reason:</span>
                        <span
                          className={`font-black ${
                            selectedTrade.exitReason === "TAKE_PROFIT"
                              ? "text-emerald-400"
                              : selectedTrade.exitReason === "STOP_LOSS"
                              ? "text-rose-400"
                              : "text-amber-400"
                          }`}
                        >
                          {selectedTrade.exitReason || selectedTrade.exit_type || "CLOSED"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-slate-400">Net Outcome:</span>
                        <span
                          className={`font-bold ${
                            (selectedTrade.net_r ?? 0) >= 0 ? "text-emerald-400" : "text-rose-400"
                          }`}
                        >
                          {(selectedTrade.net_r ?? 0) >= 0 ? "+" : ""}
                          {Number(selectedTrade.net_r || 0).toFixed(2)}R ·{" "}
                          {(selectedTrade.pnlNetINR ?? 0) >= 0 ? "+₹" : "-₹"}
                          {Math.abs(selectedTrade.pnlNetINR || 0).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
