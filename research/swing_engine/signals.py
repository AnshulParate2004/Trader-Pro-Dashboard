#!/usr/bin/env python3
"""
Candidate Signal Generator for 4H / Daily Swing Engine
Specification: docs/prereg/swing_meta_labeling_4h.md (Step 2)

Rules:
1. Macro Trend Filter: Close > 200-period SMA on 4H cadence.
2. Entry Trigger: Close breaks above the 20-period highest high of previous bars (strictly bar t-1).
3. Initial Stop Loss: Lowest low of the past 10 bars (clamped between 1.5% and 6.0%).
4. Zero Lookahead: Breakout reference level uses strictly lagged high data (shift(1)).
"""

from typing import Dict, List, Optional, Union
import numpy as np
import pandas as pd

from .config import (
    MAX_STOP_LOSS_PCT,
    MIN_STOP_LOSS_PCT,
)


def generate_candidate_signals(
    df: pd.DataFrame,
    symbol: str = "BTCUSDT",
    donchian_period: int = 20,
    sma_period: int = 200,
    stop_lookback_bars: int = 10,
    min_stop_pct: float = MIN_STOP_LOSS_PCT,
    max_stop_pct: float = MAX_STOP_LOSS_PCT,
    cross_only: bool = True,
) -> pd.DataFrame:
    """
    Scans OHLCV series and generates candidate breakout signals satisfying:
    1. Close_t > SMA_200_t (macro bullish regime)
    2. Close_t > max_{i=1..20} High_{t-i} (Donchian breakout)
    3. Stop distance clamped between min_stop_pct and max_stop_pct.

    Returns DataFrame of candidate signals with timestamps, entry prices, and stop distances.
    """
    n = len(df)
    if n < sma_period:
        return pd.DataFrame()

    close = df["close"]
    high = df["high"]
    low = df["low"]
    open_time = df["open_time"]

    # 1. 200-period SMA Macro Regime Filter
    sma_200 = close.rolling(sma_period, min_periods=sma_period).mean()
    trend_ok = close > sma_200

    # 2. 20-period Donchian High of strictly PREVIOUS bars (shift 1)
    # Highest high of bars t-1 through t-20
    high_lag = high.shift(1)
    donchian_high = high_lag.rolling(donchian_period, min_periods=donchian_period).max()

    # Breakout condition
    if cross_only:
        # Cross above: close_t > donchian_high and close_{t-1} <= donchian_high
        is_breakout = (close > donchian_high) & (close.shift(1) <= donchian_high) & trend_ok
    else:
        is_breakout = (close > donchian_high) & trend_ok

    # 3. Initial Stop Loss: Lowest low of past 10 bars
    # Using low of completed bars up to t
    lowest_low_10 = low.rolling(stop_lookback_bars, min_periods=stop_lookback_bars).min()
    raw_stop_dist = (close - lowest_low_10) / close

    # Clamp stop distance strictly between 1.5% and 6.0%
    clamped_stop_dist = raw_stop_dist.clip(lower=min_stop_pct, upper=max_stop_pct)

    # Filter signal indices
    signal_mask = is_breakout.fillna(False)
    signal_indices = df[signal_mask].index

    records = []
    for idx in signal_indices:
        entry_p = float(close.loc[idx])
        stop_dist = float(clamped_stop_dist.loc[idx])
        stop_p = float(entry_p * (1.0 - stop_dist))

        records.append(
            {
                "symbol": symbol,
                "entry_idx": idx,
                "open_time": open_time.loc[idx],
                "entry_price": entry_p,
                "stop_distance_pct": stop_dist,
                "stop_price": stop_p,
                "donchian_high_20": float(donchian_high.loc[idx]),
                "sma_200": float(sma_200.loc[idx]),
                "direction": 1,  # LONG
            }
        )

    if not records:
        return pd.DataFrame()

    df_signals = pd.DataFrame(records).reset_index(drop=True)
    return df_signals
