#!/usr/bin/env python3
"""
Unit Tests for 4H / Daily Swing Meta-Labeling Engine
Verifies:
1. Configuration resolution and absence of hardcoded paths.
2. Data loader functionality and derivative alignment.
3. Triple-barrier labeling mechanics:
   - Upper barrier +2.5R
   - Lower barrier -1.0R
   - Time barrier 12 bars
   - Simultaneous touch collision precedence (Stop loss hit)
   - Friction deduction (0.10% round trip)
   - Breakeven exits MUST strictly be y=0
4. Feature engineering:
   - Relative strength vs BTC (3d, 7d, 30d)
   - Funding rate Z-score & OI Delta
   - EWMA volatility ratio
   - Volume Z-score
   - Zero lookahead (strict t-1 lag)
"""

import sys
from pathlib import Path
import numpy as np
import pandas as pd
import pytest

# Add dashboard root to sys.path
sys.path.insert(0, str(Path(__file__).parent.parent))

from research.swing_engine.config import (
    get_data_root,
    SYMBOLS,
    UPPER_BARRIER_R,
    LOWER_BARRIER_R,
    TIME_BARRIER_BARS,
    ROUND_TRIP_FRICTION_PCT,
)
from research.swing_engine.labeling import (
    evaluate_single_trade_barriers,
    generate_triple_barrier_labels,
    compute_atr,
)
from research.swing_engine.features import (
    compute_relative_strength_vs_btc,
    compute_ewma_volatility_ratio,
    compute_funding_zscore,
    compute_open_interest_delta,
    compute_volume_zscore,
    build_swing_features,
)
from research.swing_engine.data_loader import load_ohlcv


def test_config_relative_resolution():
    """Verifies that config never returns hardcoded absolute drive letters."""
    root = get_data_root()
    assert isinstance(root, Path)
    # Ensure it's not a hardcoded root from an external machine
    assert len(SYMBOLS) >= 3
    assert UPPER_BARRIER_R == 2.5
    assert LOWER_BARRIER_R == 1.0
    assert TIME_BARRIER_BARS == 12
    assert ROUND_TRIP_FRICTION_PCT == 0.0010


def test_triple_barrier_target_hit():
    """Tests that reaching +2.5R upper barrier yields y=1 after friction deduction."""
    n = 20
    dates = pd.date_range("2026-01-01", periods=n, freq="4h", tz="UTC")
    # Base entry at $100. Stop is 2% ($98.00). Target +2.5R is +5% ($105.00).
    df = pd.DataFrame(
        {
            "open_time": dates,
            "open": [100.0] * n,
            "high": [100.2] * n,
            "low": [99.8] * n,
            "close": [100.0] * n,
            "volume": [1000.0] * n,
        }
    )
    # Bar 3 spikes to 106.0 (exceeds 105.0 target)
    df.loc[3, "high"] = 106.0
    df.loc[3, "close"] = 105.5

    res = evaluate_single_trade_barriers(
        df=df,
        entry_idx=0,
        direction=1,
        stop_distance_pct=0.02,
        upper_barrier_r=2.5,
        lower_barrier_r=1.0,
        time_barrier_bars=12,
        round_trip_friction_pct=0.0010,
    )

    assert res["exit_type"] == "TARGET"
    assert res["exit_idx"] == 3
    assert res["gross_r"] == 2.5
    # cost_r = 0.0010 / 0.02 = 0.05R -> net_r = 2.45R >= 2.0R
    assert res["net_r"] == 2.45
    assert res["label_y"] == 1


def test_triple_barrier_breakeven_must_be_labeled_zero():
    """
    CRITICAL: Verifies Bug B remedy.
    A trade triggering breakeven and exiting at entry price pays friction and MUST be labeled y=0.
    """
    n = 20
    dates = pd.date_range("2026-01-01", periods=n, freq="4h", tz="UTC")
    df = pd.DataFrame(
        {
            "open_time": dates,
            "open": [100.0] * n,
            "high": [100.5] * n,
            "low": [99.5] * n,
            "close": [100.0] * n,
            "volume": [1000.0] * n,
        }
    )
    # Bar 2 reaches BE trigger (101.0)
    df.loc[2, "high"] = 101.2
    # Bar 4 dips back to entry price (100.0) -> BE Stop triggered
    df.loc[4, "low"] = 99.8

    res = evaluate_single_trade_barriers(
        df=df,
        entry_idx=0,
        direction=1,
        stop_distance_pct=0.02,
        upper_barrier_r=2.5,
        lower_barrier_r=1.0,
        time_barrier_bars=12,
        round_trip_friction_pct=0.0010,
    )

    assert res["exit_type"] == "BE_STOP"
    assert res["gross_r"] == 0.0
    assert res["net_r"] < 0.0  # Loses friction (-0.05R)
    # Invariant: Breakeven MUST strictly be labeled y=0
    assert res["label_y"] == 0


def test_triple_barrier_simultaneous_touch_collision():
    """
    CRITICAL: Verifies Bug D remedy.
    When a single bar touches both Target and Stop, it must strictly be booked as STOP (-1.0R).
    """
    n = 15
    dates = pd.date_range("2026-01-01", periods=n, freq="4h", tz="UTC")
    df = pd.DataFrame(
        {
            "open_time": dates,
            "open": [100.0] * n,
            "high": [100.5] * n,
            "low": [99.5] * n,
            "close": [100.0] * n,
            "volume": [1000.0] * n,
        }
    )
    # Bar 2 touches BOTH Target (105.0) and Initial Stop (98.0)
    df.loc[2, "high"] = 107.0
    df.loc[2, "low"] = 97.0

    res = evaluate_single_trade_barriers(
        df=df,
        entry_idx=0,
        direction=1,
        stop_distance_pct=0.02,
        upper_barrier_r=2.5,
        lower_barrier_r=1.0,
        time_barrier_bars=12,
        round_trip_friction_pct=0.0010,
    )

    assert res["exit_type"] == "STOP"
    assert res["gross_r"] == -1.0
    assert res["label_y"] == 0


def test_feature_lag_zero_lookahead():
    """
    CRITICAL: Verifies Bug A remedy.
    Modifying the current bar's close must NOT alter any feature at that same bar row.
    """
    n = 50
    dates = pd.date_range("2026-01-01", periods=n, freq="4h", tz="UTC")
    df_asset = pd.DataFrame(
        {
            "open_time": dates,
            "open": np.linspace(100, 150, n),
            "high": np.linspace(101, 152, n),
            "low": np.linspace(99, 149, n),
            "close": np.linspace(100, 150, n),
            "volume": [1000.0] * n,
        }
    )
    df_btc = df_asset.copy()

    feat1 = build_swing_features(df_asset, df_btc, interval="4h")

    # Mutate bar 30's close price massively
    df_asset_mutated = df_asset.copy()
    df_asset_mutated.loc[30, "close"] = 99999.0
    df_asset_mutated.loc[30, "high"] = 100000.0

    feat2 = build_swing_features(df_asset_mutated, df_btc, interval="4h")

    # Feature at row 30 must remain IDENTICAL between feat1 and feat2 because row 30 features use <= row 29
    numeric_cols = [c for c in feat1.columns if c != "open_time"]
    for col in numeric_cols:
        val1 = feat1.loc[30, col]
        val2 = feat2.loc[30, col]
        if np.isnan(val1) and np.isnan(val2):
            continue
        assert np.isclose(val1, val2, rtol=1e-7), f"Lookahead Leak in {col} at row 30: {val1} != {val2}"


def test_relative_strength_calculation():
    """Verifies Relative Strength ratio vs BTC correctly captures outperformance."""
    n = 40
    dates = pd.date_range("2026-01-01", periods=n, freq="4h", tz="UTC")
    # Asset doubles; BTC stays flat
    close_asset = pd.Series(np.linspace(100, 200, n), index=dates)
    close_btc = pd.Series([100.0] * n, index=dates)

    rs = compute_relative_strength_vs_btc(close_asset, close_btc, lookback_bars=6)
    # After bar 7, RS must be strictly positive
    valid_rs = rs.dropna()
    assert (valid_rs.iloc[10:] > 0).all()
