#!/usr/bin/env python3
"""
experiments/wider_universe/loader.py

Unified Data & Funding Loader for the Wider Universe Evaluation.
Supports:
  - 14 Assets across DESIGN (BTC, ETH), SEEN (SOL, DOT, XAU, XAG, CL),
    and UNTOUCHED (BNB, XRP, ADA, AVAX, LINK, DOGE, NEAR).
  - Native 4H parquet loading and causal 1H -> 4H candle aggregation.
  - Uniform datetime standardization (datetime64[us]) to prevent merge_asof failures.
  - Real Binance 8-hour funding rates extraction from funding parquet archives.
"""

import os
import sys
import numpy as np
import pandas as pd

# Path Discovery
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
BASE_DIR = os.path.abspath(os.path.join(CURRENT_DIR, "../.."))
ROOT_DIR = os.path.abspath(os.path.join(BASE_DIR, ".."))

DATA_DIRS = [
    os.path.join(ROOT_DIR, "Trader-Pro", "notebooks", "data"),
    os.path.join(BASE_DIR, "Trader-Pro", "notebooks", "data"),
    os.path.join(BASE_DIR, "notebooks", "data"),
]

DATA_DIR = None
for d in DATA_DIRS:
    if os.path.exists(d):
        DATA_DIR = d
        break

if DATA_DIR is None:
    raise FileNotFoundError(f"Could not locate Trader-Pro data directory in {DATA_DIRS}")

FUNDING_DIR = os.path.join(DATA_DIR, "funding")
ROUND3_DIR = os.path.join(DATA_DIR, "round3")

# Universe Specifications
UNIVERSE_DESIGN = ["BTCUSDT", "ETHUSDT"]
UNIVERSE_SEEN = ["SOLUSDT", "DOTUSDT", "XAUUSDT", "XAGUSDT", "CLUSDT"]
UNIVERSE_UNTOUCHED = [
    "BNBUSDT", "XRPUSDT", "ADAUSDT", "AVAXUSDT", "LINKUSDT", "DOGEUSDT", "NEARUSDT"
]
UNIVERSE_ALL = UNIVERSE_DESIGN + UNIVERSE_SEEN + UNIVERSE_UNTOUCHED

COMMODITY_ASSETS = {"XAUUSDT", "XAGUSDT", "CLUSDT"}
CRYPTO_ALTS = set(UNIVERSE_SEEN + UNIVERSE_UNTOUCHED) - COMMODITY_ASSETS - {"BTCUSDT"}

CANDLE_CACHE = {}
FUNDING_CACHE = {}


def resample_1h_to_4h(df_1h: pd.DataFrame) -> pd.DataFrame:
    """
    Causally aggregates 1H candles into 4H candles strictly on Binance UTC boundaries
    (00:00, 04:00, 08:00, 12:00, 16:00, 20:00).
    Requires exactly 4 completed 1H bars per 4H interval to prevent incomplete candle leakage.
    """
    col = 'open_time' if 'open_time' in df_1h.columns else ('timestamp' if 'timestamp' in df_1h.columns else df_1h.columns[0])
    df = df_1h.copy()
    if pd.api.types.is_datetime64_any_dtype(df[col]):
        df['datetime'] = pd.to_datetime(df[col]).dt.tz_localize(None) if df[col].dt.tz is not None else pd.to_datetime(df[col])
    else:
        try:
            num = pd.to_numeric(df[col])
            sample = num.dropna().iloc[0]
            if sample > 1e16: df['datetime'] = pd.to_datetime(num, unit='ns')
            elif sample > 1e11: df['datetime'] = pd.to_datetime(num, unit='ms')
            elif sample > 1e8: df['datetime'] = pd.to_datetime(num, unit='s')
            else: df['datetime'] = pd.to_datetime(df[col])
        except Exception:
            df['datetime'] = pd.to_datetime(df[col])

    if df['datetime'].dt.tz is not None:
        df['datetime'] = df['datetime'].dt.tz_localize(None)

    df = df.sort_values('datetime').reset_index(drop=True)

    # Resample with 4h left-closed left-labeled bins
    resampled = df.set_index('datetime').resample('4h', closed='left', label='left').agg({
        'open': 'first',
        'high': 'max',
        'low': 'min',
        'close': 'last',
        'volume': 'sum'
    })
    counts = df.set_index('datetime').resample('4h', closed='left', label='left')['open'].count()
    resampled['count'] = counts

    # Keep only fully completed 4H bars (count == 4)
    resampled = resampled[resampled['count'] == 4].drop(columns=['count']).dropna().reset_index()
    resampled['datetime'] = resampled['datetime'].astype('datetime64[us]')
    return resampled


def load_candles(asset: str, tf: str = '4h') -> pd.DataFrame:
    """
    Loads 4H candles for an asset. Uses native 4H parquet if available;
    falls back to causal 1H -> 4H resampling otherwise.
    Standardizes datetime to datetime64[us].
    """
    key = (asset, tf)
    if key in CANDLE_CACHE:
        return CANDLE_CACHE[key]

    # 1. Native 4H paths
    paths_4h = [
        os.path.join(DATA_DIR, tf, f"{asset}_{tf}.parquet"),
        os.path.join(DATA_DIR, f"{asset}_{tf}.parquet"),
    ]
    for p in paths_4h:
        if os.path.exists(p):
            df = pd.read_parquet(p)
            col = 'open_time' if 'open_time' in df.columns else ('timestamp' if 'timestamp' in df.columns else df.columns[0])
            if pd.api.types.is_datetime64_any_dtype(df[col]):
                df['datetime'] = pd.to_datetime(df[col]).dt.tz_localize(None) if df[col].dt.tz is not None else pd.to_datetime(df[col])
            else:
                try:
                    num = pd.to_numeric(df[col])
                    sample = num.dropna().iloc[0]
                    if sample > 1e16: df['datetime'] = pd.to_datetime(num, unit='ns')
                    elif sample > 1e11: df['datetime'] = pd.to_datetime(num, unit='ms')
                    elif sample > 1e8: df['datetime'] = pd.to_datetime(num, unit='s')
                    else: df['datetime'] = pd.to_datetime(df[col])
                except Exception:
                    df['datetime'] = pd.to_datetime(df[col])

            if df['datetime'].dt.tz is not None:
                df['datetime'] = df['datetime'].dt.tz_localize(None)

            clean_df = df.sort_values('datetime').reset_index(drop=True)
            clean_df['datetime'] = clean_df['datetime'].astype('datetime64[us]')
            CANDLE_CACHE[key] = clean_df
            return clean_df

    # 2. Resampling from 1H
    if tf == '4h':
        paths_1h = [
            os.path.join(DATA_DIR, "1h", f"{asset}_1h.parquet"),
            os.path.join(DATA_DIR, f"{asset}_1h.parquet"),
        ]
        for p in paths_1h:
            if os.path.exists(p):
                df_1h = pd.read_parquet(p)
                res_df = resample_1h_to_4h(df_1h)
                CANDLE_CACHE[key] = res_df
                return res_df

    raise FileNotFoundError(f"Candles not found for {asset}_{tf} across {DATA_DIR}")


def load_funding_rates(asset: str) -> pd.DataFrame:
    """
    Loads real historical 8-hour Binance funding rates.
    Returns DataFrame with ['datetime', 'fundingRate'] sorted ascending.
    """
    if asset in FUNDING_CACHE:
        return FUNDING_CACHE[asset]

    paths = [
        os.path.join(FUNDING_DIR, f"funding_{asset}.parquet"),
        os.path.join(ROUND3_DIR, f"funding_{asset}.parquet"),
    ]
    for p in paths:
        if os.path.exists(p):
            df = pd.read_parquet(p)
            col = 'fundingTime' if 'fundingTime' in df.columns else df.columns[0]
            df['datetime'] = pd.to_datetime(df[col])
            if df['datetime'].dt.tz is not None:
                df['datetime'] = df['datetime'].dt.tz_localize(None)
            df['fundingRate'] = df['fundingRate'].astype(float)
            res = df[['datetime', 'fundingRate']].sort_values('datetime').reset_index(drop=True)
            res['datetime'] = res['datetime'].astype('datetime64[us]')
            FUNDING_CACHE[asset] = res
            return res

    return None


def calculate_real_funding(asset: str, entry_dt: pd.Timestamp, exit_dt: pd.Timestamp,
                           direction: str, funding_df: pd.DataFrame = None,
                           fallback_rate_8h: float = 0.0001) -> float:
    """
    Computes cumulative funding cost between entry_dt and exit_dt.
    If real funding rates exist, sums all funding events during the trade.
    For LONG: positive rate is a payment (cost), negative rate is a rebate.
    For SHORT: positive rate is a receipt (rebate), negative rate is a cost.
    For commodities: returns 0.0.
    """
    if asset in COMMODITY_ASSETS:
        return 0.0

    if funding_df is None:
        funding_df = load_funding_rates(asset)

    if funding_df is not None:
        sub = funding_df[(funding_df['datetime'] >= entry_dt) & (funding_df['datetime'] <= exit_dt)]
        if len(sub) > 0:
            total_rate = float(sub['fundingRate'].sum())
            return total_rate if direction == "LONG" else -total_rate

    # Fallback placeholder if no funding file
    hours = (exit_dt - entry_dt).total_seconds() / 3600.0
    periods_8h = max(1.0, hours / 8.0)
    if direction == "LONG":
        return periods_8h * fallback_rate_8h
    return 0.0
