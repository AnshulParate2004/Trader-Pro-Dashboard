"""
Unit Tests for Round 2 Macro Overlays & Residual Edge Engine
Specification: docs/prereg/round2_residual_edge.md (Amendments 1 & 2)

Tests use synthetic data only:
1. Constant price gives zero turnover
2. Known-vol series gives expected weight
3. Changing future prices never changes today's weight (look-ahead protection)
4. Cost equals turnover times friction / 2 (Amendment 2 rule)
5. Warm-up rows (first 200 bars) are strictly excluded from all metrics
"""

import sys
import os
import numpy as np
import pandas as pd
import pytest

# Add parent directory to path to import analysis engine
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from analysis.evaluate_round2_residual_edge import (
    compute_ewma_volatility,
    compute_weights_ewma,
    compute_weights_sma200,
    compute_weights_buy_and_hold,
    simulate_strategy_returns,
    compute_max_drawdown,
    compute_performance_metrics,
    fit_ols_hac,
    compute_stationary_block_bootstrap_alpha_ci,
    WARMUP_BARS,
    TARGET_VOL,
    ANNUALIZATION_FACTOR,
)


def test_constant_price_zero_turnover():
    """
    1. Constant price series must produce zero rebalancing turnover.
    """
    n = 300
    constant_prices = pd.Series([100.0] * n)

    # Buy and hold
    w_bh = compute_weights_buy_and_hold(constant_prices)
    sim_bh = simulate_strategy_returns(constant_prices, w_bh, friction_round_trip=0.0025)
    assert (sim_bh["one_way_turnover"] == 0.0).all(), "Buy-and-hold turnover must be 0 on constant price"
    assert (sim_bh["cost"] == 0.0).all(), "Buy-and-hold cost must be 0 on constant price"

    # SMA 200
    w_sma = compute_weights_sma200(constant_prices)
    sim_sma = simulate_strategy_returns(constant_prices, w_sma, friction_round_trip=0.0025)
    assert (sim_sma["one_way_turnover"] == 0.0).all(), "SMA200 turnover must be 0 on constant price"
    assert (sim_sma["cost"] == 0.0).all(), "SMA200 cost must be 0 on constant price"

    # EWMA vol targeting
    w_ewma = compute_weights_ewma(constant_prices)
    sim_ewma = simulate_strategy_returns(constant_prices, w_ewma, friction_round_trip=0.0025)
    # Once seed period passes, vol remains flat and weights do not change
    assert (sim_ewma["one_way_turnover"] == 0.0).all(), "EWMA turnover must be 0 on constant price"
    assert (sim_ewma["cost"] == 0.0).all(), "EWMA cost must be 0 on constant price"


def test_known_vol_expected_weight():
    """
    2. Known volatility series must yield the mathematically expected weight.
    Target annualized vol = 0.40.
    If annualized realized vol = 0.50, expected weight = 0.40 / 0.50 = 0.80.
    """
    target_vol = 0.40
    known_ann_vol = 0.50
    daily_r = known_ann_vol / np.sqrt(ANNUALIZATION_FACTOR)

    # Construct series with alternating log return of +/- daily_r
    # So r_t^2 is constant = daily_r^2, leading to exact stationary EWMA vol
    n = 300
    prices = [100.0]
    for i in range(1, n):
        sign = 1 if i % 2 == 1 else -1
        next_price = prices[-1] * np.exp(sign * daily_r)
        prices.append(next_price)

    price_series = pd.Series(prices)
    vol_ann = compute_ewma_volatility(price_series)
    weights = compute_weights_ewma(price_series, target_vol=target_vol)

    # In the stationary region (after bar 60), realized EWMA vol must match known_ann_vol
    expected_weight = target_vol / known_ann_vol  # 0.40 / 0.50 = 0.80
    converged_weights = weights.iloc[100:]
    np.testing.assert_allclose(
        converged_weights.values,
        expected_weight,
        rtol=1e-3,
        err_msg=f"Expected weight {expected_weight}, but got {converged_weights.mean()}",
    )


def test_future_prices_never_change_today_weight():
    """
    3. Look-ahead test: modifying future prices (t > T) MUST NEVER alter
       weights at or before day T.
    """
    np.random.seed(12345)
    n = 300
    base_prices = 100.0 * np.exp(np.cumsum(np.random.normal(0, 0.02, n)))
    series_base = pd.Series(base_prices)

    t_cutoff = 150

    # Calculate baseline weights
    w_ewma_base = compute_weights_ewma(series_base)
    w_sma_base = compute_weights_sma200(series_base)

    # Create mutated future series (drastically alter prices after t_cutoff)
    mutated_prices = base_prices.copy()
    mutated_prices[t_cutoff + 1:] = mutated_prices[t_cutoff + 1:] * 5.0 + 1000.0
    series_mutated = pd.Series(mutated_prices)

    w_ewma_mutated = compute_weights_ewma(series_mutated)
    w_sma_mutated = compute_weights_sma200(series_mutated)

    # Weights up to t_cutoff must be exactly identical
    np.testing.assert_array_equal(
        w_ewma_base.iloc[: t_cutoff + 1].values,
        w_ewma_mutated.iloc[: t_cutoff + 1].values,
        err_msg="EWMA weight leaked future price information!",
    )
    np.testing.assert_array_equal(
        w_sma_base.iloc[: t_cutoff + 1].values,
        w_sma_mutated.iloc[: t_cutoff + 1].values,
        err_msg="SMA 200 weight leaked future price information!",
    )


def test_cost_equals_turnover_times_friction_half():
    """
    4. Cost formula verification (Amendment 2):
       Cost_{t+1} = |w_{t+1} - w_t| * (friction / 2)
    """
    n = 250
    # Alternating weights 0.0 and 1.0 to generate unit turnover |dw| = 1.0
    prices = pd.Series(np.linspace(100, 200, n))
    weights = pd.Series([1.0 if i % 2 == 0 else 0.0 for i in range(n)])

    friction = 0.0025  # 25 bps round-trip
    sim = simulate_strategy_returns(prices, weights, friction_round_trip=friction, warmup_bars=200)

    # Check identity on every single evaluation bar
    expected_cost = sim["one_way_turnover"] * (friction / 2.0)
    np.testing.assert_allclose(
        sim["cost"].values,
        expected_cost.values,
        rtol=1e-12,
        err_msg="Rebalance cost does not equal one_way_turnover * (friction / 2)",
    )

    # When turnover is 1.0, cost must be exactly 12.5 bps (0.00125)
    unit_turnover_rows = sim[sim["one_way_turnover"] == 1.0]
    assert len(unit_turnover_rows) > 0
    np.testing.assert_allclose(
        unit_turnover_rows["cost"].values,
        0.00125,
        rtol=1e-12,
        err_msg="Unit turnover cost under 25 bps friction must equal exactly 0.00125",
    )


def test_warmup_rows_excluded():
    """
    5. Warm-up exclusion verification:
       The first 200 daily bars must be strictly excluded from evaluation outputs.
    """
    n = 280
    warmup = 200
    prices = pd.Series(np.linspace(100, 150, n))
    weights = pd.Series([0.5] * n)

    sim = simulate_strategy_returns(prices, weights, friction_round_trip=0.0025, warmup_bars=warmup)

    # The length of evaluated simulation must be exactly n - warmup
    assert len(sim) == n - warmup, f"Expected {n - warmup} rows, got {len(sim)}"
    # First evaluated index must be exactly index 200
    assert sim.index[0] == warmup, f"First index should be {warmup}, got {sim.index[0]}"
    assert sim.index[-1] == n - 1

    # Verify performance metrics use strictly the post-warm-up length
    metrics = compute_performance_metrics(sim["net_return"])
    assert metrics["n_bars"] == n - warmup
