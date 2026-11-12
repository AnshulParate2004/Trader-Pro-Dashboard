"use client";

import React, { useEffect, useRef, memo } from "react";

interface TradingViewChartProps {
  symbol: string;
  interval: string;
  market?: "crypto" | "us";
}

const US_EQUITY_PREFIX_MAP: Record<string, string> = {
  SPY: "AMEX:SPY",
  AAPL: "NASDAQ:AAPL",
  NVDA: "NASDAQ:NVDA",
  MSFT: "NASDAQ:MSFT",
  AMZN: "NASDAQ:AMZN",
  GOOGL: "NASDAQ:GOOGL",
  META: "NASDAQ:META",
  TSLA: "NASDAQ:TSLA",
  "BRK-B": "NYSE:BRK.B",
  BRK_B: "NYSE:BRK.B",
  JPM: "NYSE:JPM",
  QQQ: "NASDAQ:QQQ",
  DIA: "AMEX:DIA",
  IWM: "AMEX:IWM",
  V: "NYSE:V",
  UNH: "NYSE:UNH",
  XOM: "NYSE:XOM",
  LLY: "NYSE:LLY",
  WMT: "NYSE:WMT",
  JNJ: "NYSE:JNJ",
  PG: "NYSE:PG",
  AVGO: "NASDAQ:AVGO",
  MA: "NYSE:MA",
  HD: "NYSE:HD",
  COST: "NASDAQ:COST",
  ORCL: "NYSE:ORCL",
};

function TradingViewChart({ symbol, interval, market }: TradingViewChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Clean up previous instance on symbol or interval change
    container.innerHTML = "";

    const widgetDiv = document.createElement("div");
    widgetDiv.className = "tradingview-widget-container__widget";
    widgetDiv.style.height = "100%";
    widgetDiv.style.width = "100%";
    container.appendChild(widgetDiv);

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;

    // Convert timeframe to TradingView format
    // 1D -> D, 4H -> 240, 1H -> 60, 15m -> 15, 5m -> 5
    const intervalMap: Record<string, string> = {
      "1m": "1",
      "5m": "5",
      "15m": "15",
      "1h": "60",
      "4h": "240",
      "1d": "D",
    };
    const tvInterval = intervalMap[interval.toLowerCase()] || "D";

    // Format symbol for TradingView
    const cleanSym = symbol.trim().toUpperCase();
    let tvSymbol = symbol;

    if (US_EQUITY_PREFIX_MAP[cleanSym]) {
      tvSymbol = US_EQUITY_PREFIX_MAP[cleanSym];
    } else if (cleanSym.includes(":")) {
      // Already has exchange prefix (e.g. NASDAQ:AAPL, AMEX:SPY, BINANCE:BTCUSDT)
      tvSymbol = cleanSym;
    } else if (market === "us") {
      // US equity without explicit prefix - do NOT prefix with BINANCE
      tvSymbol = cleanSym;
    } else if (
      cleanSym.endsWith("USDT") ||
      cleanSym.endsWith("PERP") ||
      cleanSym.endsWith("BTC") ||
      cleanSym === "BTC" ||
      cleanSym === "ETH"
    ) {
      // Explicit crypto symbol
      tvSymbol = `BINANCE:${cleanSym}`;
    } else {
      // Generic symbol without prefix
      tvSymbol = cleanSym;
    }

    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: tvSymbol,
      interval: tvInterval,
      timezone: "Etc/UTC",
      theme: "light",
      style: "1",
      locale: "en",
      backgroundColor: "#ffffff",
      gridColor: "#f0f3fa",
      hide_top_toolbar: false,
      hide_legend: false,
      hide_side_toolbar: false,
      allow_symbol_change: true,
      save_image: true,
      calendar: false,
      hide_volume: false,
      support_host: "https://www.tradingview.com",
    });

    container.appendChild(script);

    return () => {
      if (container) {
        container.innerHTML = "";
      }
    };
  }, [symbol, interval, market]);

  return (
    <div
      className="tradingview-widget-container h-full w-full bg-white relative overflow-hidden"
      ref={containerRef}
      style={{ height: "100%", width: "100%" }}
    >
      <div className="tradingview-widget-container__widget h-full w-full"></div>
    </div>
  );
}

export default memo(TradingViewChart);
