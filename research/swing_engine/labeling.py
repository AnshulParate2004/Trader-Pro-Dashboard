#!/usr/bin/env python3
"""
Triple-Barrier Labeling Pipeline for 4H / Daily Swing Meta-Labeling Engine
Specification: docs/ARCHITECTURE.md, docs/KNOWN_ISSUES.md (Bug B Remedy)
Methodology: Marcos López de Prado (Advances in Financial Machine Learning)

Invariants:
1. Upper barrier: +2.5R
2. Lower barrier: -1.0R
3. Time barrier: 12 bars (48 hours on 4H cadence)
4. Simultaneous touch collision: Stop takes precedence (-1.0R)
5. CRITICAL: Round-trip friction (0.10%) is explicitly deducted before assigning y=1.
6. Breakeven exits MUST strictly be labeled y=0.
"""

from typing import Dict, List, Optional, Tuple, Union
import numpy as np
import pandas as pd

from .config import (
    LOWER_BARRIER_R,
    MAX_STOP_LOSS_PCT,
    MIN_STOP_LOSS_PCT,
    ROUND_TRIP_FRICTION_PCT,
    TIME_BARRIER_BARS,
    UPPER_BARRIER_R,
)


def compute_atr(
    df: pd.DataFrame,
    period: int = 14,
) -> pd.Series:
    """
    Computes Average True Range (ATR) across high, low, close series.
    """
    high = df["high"]
    low = df["low"]
    prev_close = df["close"].shift(1)

    tr1 = high - low
    tr2 = (high - prev_close).abs()
    tr3 = (low - prev_close).abs()
    tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)

    atr = tr.rolling(period).mean()
    return atr


def evaluate_single_trade_barriers(
    df: pd.DataFrame,
    entry_idx: int,
    direction: int,  # +1 for LONG, -1 for SHORT
    stop_distance_pct: float,
    upper_barrier_r: float = UPPER_BARRIER_R,
    lower_barrier_r: float = LOWER_BARRIER_R,
    time_barrier_bars: int = TIME_BARRIER_BARS,
    round_trip_friction_pct: float = ROUND_TRIP_FRICTION_PCT,
) -> Dict[str, Union[float, int, str]]:
    """
    Simulates a single trade against upper, lower, and time barriers.
    Enforces the simultaneous touch collision rule (Bug D remedy).
    Explicitly accounts for exchange friction on net return and label y.
    """
    n = len(df)
    entry_price = float(df.loc[entry_idx, "close"])
    entry_time = df.loc[entry_idx, "open_time"]

    # Barrier price levels
    if direction == 1:  # LONG
        target_price = entry_price * (1.0 + upper_barrier_r * stop_distance_pct)
        stop_price = entry_price * (1.0 - lower_barrier_r * stop_distance_pct)
        be_trigger_price = entry_price * (1.0 + 0.5 * stop_distance_pct)
    else:  # SHORT
        target_price = entry_price * (1.0 - upper_barrier_r * stop_distance_pct)
        stop_price = entry_price * (1.0 + lower_barrier_r * stop_distance_pct)
        be_trigger_price = entry_price * (1.0 - 0.5 * stop_distance_pct)

    # Cost in R units
    cost_r = round_trip_friction_pct / max(stop_distance_pct, 1e-6)

    exit_idx = None
    exit_price = None
    exit_type = None
    exit_time = None
    gross_r = 0.0

    be_activated = False

    max_idx = min(entry_idx + time_barrier_bars, n - 1)

    for i in range(entry_idx + 1, max_idx + 1):
        bar = df.iloc[i]
        bar_high = float(bar["high"])
        bar_low = float(bar["low"])

        # Check barrier touches
        if direction == 1:
            hit_target = bar_high >= target_price
            hit_stop = bar_low <= stop_price
            hit_be_trigger = bar_high >= be_trigger_price
        else:
            hit_target = bar_low <= target_price
            hit_stop = bar_high >= stop_price
            hit_be_trigger = bar_low <= be_trigger_price

        # Simultaneous Touch Invariant: Stop takes precedence over Target
        if hit_stop and hit_target:
            exit_idx = i
            exit_price = stop_price
            exit_type = "STOP"
            exit_time = bar["open_time"]
            gross_r = -lower_barrier_r
            break

        # Stop hit
        if hit_stop:
            exit_idx = i
            exit_price = stop_price
            exit_type = "BE_STOP" if be_activated else "STOP"
            exit_time = bar["open_time"]
            gross_r = 0.0 if be_activated else -lower_barrier_r
            break

        # Target hit
        if hit_target:
            exit_idx = i
            exit_price = target_price
            exit_type = "TARGET"
            exit_time = bar["open_time"]
            gross_r = upper_barrier_r
            break

        # Check BE ratchet arming
        if hit_be_trigger and not be_activated:
            be_activated = True
            stop_price = entry_price  # Move SL to breakeven

    # Time barrier expiry if neither target nor stop was touched
    if exit_idx is None:
        exit_idx = max_idx
        bar = df.iloc[exit_idx]
        exit_price = float(bar["close"])
        exit_type = "TIME_EXPIRY"
        exit_time = bar["open_time"]
        raw_pct_return = (exit_price / entry_price - 1.0) * direction
        gross_r = raw_pct_return / max(stop_distance_pct, 1e-6)

    # Net metrics after friction deduction
    net_r = float(gross_r - cost_r)
    gross_ret_pct = float((exit_price / entry_price - 1.0) * direction)
    net_ret_pct = float(gross_ret_pct - round_trip_friction_pct)

    # Invariant: Breakeven exits MUST strictly be labeled y=0.
    # y=1 is reserved strictly for high-quality net winners reaching the upper barrier or net R >= 2.0R.
    if exit_type == "TARGET" and net_r >= 2.0:
        y = 1
    elif exit_type == "BE_STOP" or abs(gross_r) < 0.10:
        # Explicit Breakeven exclusion
        y = 0
    elif net_r >= 2.0:
        y = 1
    else:
        y = 0

    return {
        "entry_idx": entry_idx,
        "entry_time": entry_time,
        "entry_price": entry_price,
        "direction": direction,
        "stop_distance_pct": stop_distance_pct,
        "exit_idx": exit_idx,
        "exit_time": exit_time,
        "exit_price": exit_price,
        "exit_type": exit_type,
        "holding_bars": exit_idx - entry_idx,
        "gross_r": gross_r,
        "cost_r": cost_r,
        "net_r": net_r,
        "gross_ret_pct": gross_ret_pct,
        "net_ret_pct": net_ret_pct,
        "label_y": y,
    }


def generate_triple_barrier_labels(
    df: pd.DataFrame,
    candidate_signals: pd.Series,  # Series of +1 (LONG), -1 (SHORT), 0 (NO_TRADE)
    atr_multiplier: float = 2.0,
    min_stop_pct: float = MIN_STOP_LOSS_PCT,
    max_stop_pct: float = MAX_STOP_LOSS_PCT,
    upper_barrier_r: float = UPPER_BARRIER_R,
    lower_barrier_r: float = LOWER_BARRIER_R,
    time_barrier_bars: int = TIME_BARRIER_BARS,
    round_trip_friction_pct: float = ROUND_TRIP_FRICTION_PCT,
) -> pd.DataFrame:
    """
    Applies Triple-Barrier labeling across all candidate signals in a dataset.
    Returns DataFrame of labeled trades ready for meta-classifier training.
    """
    atr = compute_atr(df, period=14)
    records = []

    # Iterate through signals
    signal_indices = candidate_signals[candidate_signals != 0].index

    for idx in signal_indices:
        if idx >= len(df) - time_barrier_bars:
            # Exclude incomplete trailing window
            continue

        direction = int(candidate_signals.loc[idx])
        close_p = float(df.loc[idx, "close"])
        atr_val = float(atr.loc[idx]) if not np.isnan(atr.loc[idx]) else close_p * 0.02

        # Volatility-based stop distance clamped to viable swing parameters
        raw_stop = (atr_val * atr_multiplier) / close_p
        stop_dist = float(np.clip(raw_stop, min_stop_pct, max_stop_pct))

        trade_res = evaluate_single_trade_barriers(
            df=df,
            entry_idx=idx,
            direction=direction,
            stop_distance_pct=stop_dist,
            upper_barrier_r=upper_barrier_r,
            lower_barrier_r=lower_barrier_r,
            time_barrier_bars=time_barrier_bars,
            round_trip_friction_pct=round_trip_friction_pct,
        )
        records.append(trade_res)

    if not records:
        return pd.DataFrame()

    df_labels = pd.DataFrame(records)
    return df_labels
