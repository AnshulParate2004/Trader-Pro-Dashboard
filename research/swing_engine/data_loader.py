#!/usr/bin/env python3
"""
Data Ingestion & Binance Download Pipeline for 4H / Daily Swing Engine
Specification: docs/ARCHITECTURE.md
Invariant: Zero hardcoded absolute paths. Seamlessly falls back from local parquets to Binance REST API.
"""

import json
import time
import urllib.request
import urllib.error
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Union

import numpy as np
import pandas as pd

from .config import (
    BINANCE_FUTURES_BASE_URL,
    BINANCE_SPOT_BASE_URL,
    INTERVAL_1D,
    INTERVAL_4H,
    SYMBOLS,
    get_data_root,
)


def _http_get_json(url: str, timeout: int = 15) -> Union[List, Dict]:
    """Resilient HTTP GET request for Binance public endpoints."""
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "Trader-Pro-Quant/1.0 (Autonomous Swing Engine)"},
    )
    with urllib.request.urlopen(req, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


def download_binance_klines(
    symbol: str,
    interval: str = INTERVAL_4H,
    limit: int = 1000,
    start_time_ms: Optional[int] = None,
    end_time_ms: Optional[int] = None,
) -> pd.DataFrame:
    """
    Downloads historical OHLCV klines from Binance Vision / Futures public API.
    """
    base_urls = [
        f"{BINANCE_SPOT_BASE_URL}/klines",
        "https://api.binance.com/api/v3/klines",
        f"{BINANCE_FUTURES_BASE_URL}/klines",
    ]

    params = f"symbol={symbol}&interval={interval}&limit={limit}"
    if start_time_ms:
        params += f"&startTime={start_time_ms}"
    if end_time_ms:
        params += f"&endTime={end_time_ms}"

    last_err = None
    for base in base_urls:
        try:
            url = f"{base}?{params}"
            raw = _http_get_json(url)
            if isinstance(raw, list) and len(raw) > 0:
                cols = [
                    "open_time",
                    "open",
                    "high",
                    "low",
                    "close",
                    "volume",
                    "close_time",
                    "quote_volume",
                    "trades",
                    "taker_buy_base",
                    "taker_buy_quote",
                    "ignore",
                ]
                df = pd.DataFrame(raw, columns=cols)
                df["open_time"] = pd.to_datetime(df["open_time"].astype(np.int64), unit="ms", utc=True)
                df["close_time"] = pd.to_datetime(df["close_time"].astype(np.int64), unit="ms", utc=True)
                for col in ["open", "high", "low", "close", "volume", "quote_volume", "taker_buy_base"]:
                    df[col] = df[col].astype(float)
                df = df.sort_values("open_time").reset_index(drop=True)
                return df
        except Exception as e:
            last_err = e
            continue

    raise RuntimeError(f"Failed to fetch klines for {symbol} ({interval}): {last_err}")


def download_funding_rates(
    symbol: str,
    limit: int = 1000,
    start_time_ms: Optional[int] = None,
    end_time_ms: Optional[int] = None,
) -> pd.DataFrame:
    """
    Downloads perpetual futures funding rate history from Binance Futures API.
    """
    url = f"{BINANCE_FUTURES_BASE_URL}/fundingRate?symbol={symbol}&limit={limit}"
    if start_time_ms:
        url += f"&startTime={start_time_ms}"
    if end_time_ms:
        url += f"&endTime={end_time_ms}"

    raw = _http_get_json(url)
    if not isinstance(raw, list):
        raise ValueError(f"Invalid funding rate response for {symbol}: {raw}")

    records = []
    for item in raw:
        records.append(
            {
                "symbol": item["symbol"],
                "funding_time": pd.to_datetime(int(item["fundingTime"]), unit="ms", utc=True),
                "funding_rate": float(item["fundingRate"]),
                "mark_price": float(item.get("markPrice", 0.0) or 0.0),
            }
        )

    df = pd.DataFrame(records)
    if not df.empty:
        df = df.sort_values("funding_time").reset_index(drop=True)
    return df


def download_open_interest(
    symbol: str,
    period: str = "4h",
    limit: int = 500,
    start_time_ms: Optional[int] = None,
    end_time_ms: Optional[int] = None,
) -> pd.DataFrame:
    """
    Downloads historical Open Interest statistics from Binance Futures data API.
    """
    url = f"https://fapi.binance.com/futures/data/openInterestHist?symbol={symbol}&period={period}&limit={limit}"
    if start_time_ms:
        url += f"&startTime={start_time_ms}"
    if end_time_ms:
        url += f"&endTime={end_time_ms}"

    raw = _http_get_json(url)
    if not isinstance(raw, list):
        raise ValueError(f"Invalid open interest response for {symbol}: {raw}")

    records = []
    for item in raw:
        records.append(
            {
                "symbol": item["symbol"],
                "open_time": pd.to_datetime(int(item["timestamp"]), unit="ms", utc=True),
                "sum_open_interest": float(item["sumOpenInterest"]),
                "sum_open_interest_value": float(item["sumOpenInterestValue"]),
            }
        )

    df = pd.DataFrame(records)
    if not df.empty:
        df = df.sort_values("open_time").reset_index(drop=True)
    return df


def load_ohlcv(
    symbol: str,
    interval: str = INTERVAL_4H,
    data_root: Optional[Union[str, Path]] = None,
    max_date: Optional[str] = "2026-10-31",
) -> pd.DataFrame:
    """
    Loads OHLCV dataset from local parquet store with zero hardcoded paths,
    falling back to Binance public download if not cached locally.
    """
    root = get_data_root(str(data_root) if data_root else None)

    # Search local candidate paths
    candidates = [
        root / interval / f"{symbol}_{interval}.parquet",
        root / interval / f"{symbol}.parquet",
        root / f"{symbol}_{interval}.parquet",
        root / f"{symbol}.parquet",
    ]

    selected_path = next((p for p in candidates if p.exists()), None)

    if selected_path:
        df = pd.read_parquet(selected_path)
    else:
        # Fallback to Binance REST API download
        print(f"[DATA LOADER] Local cache not found for {symbol} ({interval}) under {root}. Fetching from Binance...")
        df = download_binance_klines(symbol, interval=interval, limit=1000)

    # Normalize date columns
    date_col = next((c for c in df.columns if c.lower() in ("open_time", "opentime", "date", "time", "timestamp")), None)
    if not date_col:
        raise ValueError(f"No date column found in dataset. Columns: {df.columns.tolist()}")

    df["open_time"] = pd.to_datetime(df[date_col], utc=True)
    df = df.sort_values("open_time").reset_index(drop=True)

    # Ensure standard numeric types
    for col in ["open", "high", "low", "close", "volume"]:
        if col in df.columns:
            df[col] = df[col].astype(float)

    # Clean window enforcement
    if max_date:
        cutoff = pd.to_datetime(max_date, utc=True)
        df = df[df["open_time"] <= cutoff].copy().reset_index(drop=True)

    return df


def load_market_dataset(
    symbol: str,
    interval: str = INTERVAL_4H,
    data_root: Optional[Union[str, Path]] = None,
    max_date: Optional[str] = "2026-10-31",
) -> pd.DataFrame:
    """
    Loads base OHLCV and integrates perpetual funding rates and open interest.
    Strictly prevents lookahead leakage: all derivative metrics are aligned to the candle open_time.
    """
    df = load_ohlcv(symbol=symbol, interval=interval, data_root=data_root, max_date=max_date)

    root = get_data_root(str(data_root) if data_root else None)

    # 1. Integrate Funding Rates
    fr_candidates = [
        root / "derivatives" / f"funding_rates_{symbol}.parquet",
        root / "derivatives" / f"funding_{symbol}.parquet",
    ]
    fr_path = next((p for p in fr_candidates if p.exists()), None)
    if fr_path:
        df_fr = pd.read_parquet(fr_path)
        time_col = next((c for c in df_fr.columns if "time" in c.lower()), None)
        rate_col = next((c for c in df_fr.columns if "rate" in c.lower()), None)
        if time_col and rate_col:
            df_fr["funding_time"] = pd.to_datetime(df_fr[time_col], utc=True)
            df_fr["funding_rate"] = df_fr[rate_col].astype(float)
            df_fr = df_fr.sort_values("funding_time").drop_duplicates("funding_time")

            # Merge as-of previous completed funding settlement (zero lookahead)
            df = pd.merge_asof(
                df,
                df_fr[["funding_time", "funding_rate"]],
                left_on="open_time",
                right_on="funding_time",
                direction="backward",
            )
            df["funding_rate"] = df["funding_rate"].fillna(0.0)

    # 2. Integrate Open Interest
    oi_candidates = [
        root / "derivatives" / f"metrics_{symbol}_{interval}.parquet",
        root / "derivatives" / f"oi_{symbol}_{interval}.parquet",
    ]
    oi_path = next((p for p in oi_candidates if p.exists()), None)
    if oi_path:
        df_oi = pd.read_parquet(oi_path)
        oi_time = next((c for c in df_oi.columns if "time" in c.lower()), None)
        oi_val = next((c for c in df_oi.columns if "open_interest" in c.lower()), None)
        if oi_time and oi_val:
            df_oi["open_time"] = pd.to_datetime(df_oi[oi_time], utc=True)
            df_oi["open_interest"] = df_oi[oi_val].astype(float)
            df_oi = df_oi.sort_values("open_time").drop_duplicates("open_time")

            # Merge backward on open_time
            df = pd.merge_asof(
                df,
                df_oi[["open_time", "open_interest"]],
                on="open_time",
                direction="backward",
            )
            df["open_interest"] = df["open_interest"].ffill()

    return df
