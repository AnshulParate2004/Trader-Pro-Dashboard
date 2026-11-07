"""
Unit Tests for Round 2 Macro Overlays & Residual Edge Engine
Specification: docs/prereg/round2_residual_edge.md (Amendments 1, 2 & 3)

Tests use synthetic data only:
1. Constant price gives zero turnover
2. Known-vol series gives expected weight
3. Changing future prices never changes today's weight (look-ahead protection)
4. Cost equals turnover times friction / 2 (Primary 50 bps -> 25 bps per unit turnover)
5. Warm-up rows (first 200 bars) are strictly excluded from all metrics
6. SMA weight at t uses closes up to t only and earns the t+1 return
7. 5-bar toy series with hand-computed net return
8. OLS regression recovers planted alpha and beta
9. Bootstrap CI covers planted alpha under fixed seed
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
    evaluate_overlay_pair,
    WARMUP_BARS,
    TARGET_VOL,
    ANNUALIZATION_FACTOR,
    FRICTION_TIERS,
)


def test_constant_price_zero_turnover():
    """
    1. Constant price series must produce zero rebalancing turnover.
    """
    n = 300
    constant_prices = pd.Series([100.0] * n)

    # Buy and hold: initial entry at bar 200 incurs 1.0 turnover; subsequent rebalancing turnover is strictly 0.0
    w_bh = compute_weights_buy_and_hold(constant_prices)
    sim_bh = simulate_strategy_returns(constant_prices, w_bh, friction_round_trip=0.0050)
    assert (sim_bh["one_way_turnover"].iloc[1:] == 0.0).all(), "Buy-and-hold subsequent rebalance turnover must be 0"
    assert (sim_bh["cost"].iloc[1:] == 0.0).all(), "Buy-and-hold subsequent cost must be 0"
    assert sim_bh["one_way_turnover"].iloc[0] == 1.0, "Initial entry turnover is 1.0"

    # SMA 200: constant price equals SMA -> weight 0.0, zero entry turnover and zero subsequent turnover
    w_sma = compute_weights_sma200(constant_prices)
    sim_sma = simulate_strategy_returns(constant_prices, w_sma, friction_round_trip=0.0050)
    assert (sim_sma["one_way_turnover"] == 0.0).all(), "SMA200 turnover must be 0 on constant price"
    assert (sim_sma["cost"] == 0.0).all(), "SMA200 cost must be 0 on constant price"

    # EWMA vol targeting: flat after seed period, zero subsequent rebalance turnover
    w_ewma = compute_weights_ewma(constant_prices)
    sim_ewma = simulate_strategy_returns(constant_prices, w_ewma, friction_round_trip=0.0050)
    assert (sim_ewma["one_way_turnover"].iloc[1:] == 0.0).all(), "EWMA subsequent turnover must be 0"
    assert (sim_ewma["cost"].iloc[1:] == 0.0).all(), "EWMA subsequent cost must be 0"


def test_known_vol_expected_weight():
    """
    2. Known volatility series must yield the mathematically expected weight.
    Target annualized vol = 0.40.
    If annualized realized vol = 0.50, expected weight = 0.40 / 0.50 = 0.80.
    """
    target_vol = 0.40
    known_ann_vol = 0.50
    daily_r = known_ann_vol / np.sqrt(ANNUALIZATION_FACTOR)

    n = 300
    prices = [100.0]
    for i in range(1, n):
        sign = 1 if i % 2 == 1 else -1
        next_price = prices[-1] * np.exp(sign * daily_r)
        prices.append(next_price)

    price_series = pd.Series(prices)
    weights = compute_weights_ewma(price_series, target_vol=target_vol)

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

    w_ewma_base = compute_weights_ewma(series_base)
    w_sma_base = compute_weights_sma200(series_base)

    mutated_prices = base_prices.copy()
    mutated_prices[t_cutoff + 1:] = mutated_prices[t_cutoff + 1:] * 5.0 + 1000.0
    series_mutated = pd.Series(mutated_prices)

    w_ewma_mutated = compute_weights_ewma(series_mutated)
    w_sma_mutated = compute_weights_sma200(series_mutated)

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
    4. Cost formula verification (Amendment 3):
       Primary 50 bps round trip = 0.0050.
       Cost per unit of one-way turnover = 0.0050 / 2 = 0.0025 (25 bps).
    """
    n = 250
    prices = pd.Series(np.linspace(100, 200, n))
    weights = pd.Series([1.0 if i % 2 == 0 else 0.0 for i in range(n)])

    friction = FRICTION_TIERS["primary_50bps"]  # 0.0050
    sim = simulate_strategy_returns(prices, weights, friction_round_trip=friction, warmup_bars=200)

    expected_cost = sim["one_way_turnover"] * (friction / 2.0)
    np.testing.assert_allclose(
        sim["cost"].values,
        expected_cost.values,
        rtol=1e-12,
        err_msg="Rebalance cost does not equal one_way_turnover * (friction / 2)",
    )

    # Unit turnover |dw| = 1.0 must incur exactly 25 bps (0.0025)
    unit_turnover_rows = sim[sim["one_way_turnover"] == 1.0]
    assert len(unit_turnover_rows) > 0
    np.testing.assert_allclose(
        unit_turnover_rows["cost"].values,
        0.0025,
        rtol=1e-12,
        err_msg="Unit turnover cost under primary 50 bps friction must equal exactly 0.0025 (25 bps)",
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

    sim = simulate_strategy_returns(prices, weights, friction_round_trip=0.0050, warmup_bars=warmup)

    assert len(sim) == n - warmup, f"Expected {n - warmup} rows, got {len(sim)}"
    assert sim.index[0] == warmup, f"First index should be {warmup}, got {sim.index[0]}"
    assert sim.index[-1] == n - 1

    metrics = compute_performance_metrics(sim["net_return"])
    assert metrics["n_bars"] == n - warmup


def test_sma_weight_at_t_uses_closes_up_to_t_and_earns_t_plus_1_return():
    """
    6. SMA weight at t uses closes up to t only and earns the t+1 return.
    """
    # Create price series with a clear crossover at bar 205
    prices = [100.0] * 205 + [120.0, 125.0, 110.0, 95.0, 90.0]
    price_series = pd.Series(prices)

    weights = compute_weights_sma200(price_series, window=200)

    # At bar 204: price was 100.0, SMA is 100.0 -> price not > SMA -> weight is 0.0
    assert weights.iloc[204] == 0.0

    # At bar 205: price jumped to 120.0, SMA is (199*100 + 120)/200 = 100.1 -> price > SMA -> weight is 1.0
    assert weights.iloc[205] == 1.0

    # Simulate
    sim = simulate_strategy_returns(price_series, weights, friction_round_trip=0.0050, warmup_bars=200)

    # Strategy return at bar 205: uses weight at bar 204 (which was 0.0) -> gross return must be 0.0!
    assert sim.loc[205, "gross_return"] == 0.0

    # Strategy return at bar 206: uses weight at bar 205 (which was 1.0) -> earns bar 206 return (125/120 - 1)
    expected_bar206_gross = (125.0 / 120.0) - 1.0
    np.testing.assert_allclose(sim.loc[206, "gross_return"], expected_bar206_gross, rtol=1e-12)


def test_five_bar_toy_series_hand_computed_net_return():
    """
    7. 5-bar toy series with hand-computed net return:
       Prices: [100.0, 110.0, 105.0, 115.0, 120.0]
       Weights: [1.0, 0.5, 0.0, 1.0, 1.0]
       Friction: 50 bps round trip (friction/2 = 0.0025 per unit turnover)
       Warmup: 0 bars (all bars evaluated)
    """
    prices = pd.Series([100.0, 110.0, 105.0, 115.0, 120.0])
    weights = pd.Series([1.0, 0.5, 0.0, 1.0, 1.0])
    friction = 0.0050  # 50 bps

    sim = simulate_strategy_returns(prices, weights, friction_round_trip=friction, warmup_bars=0)

    # Bar 0: initial entry cost = |w_0| * (friction / 2) = 1.0 * 0.0025 = 0.0025
    np.testing.assert_allclose(sim.loc[0, "cost"], 0.0025, rtol=1e-12)
    np.testing.assert_allclose(sim.loc[0, "one_way_turnover"], 1.0, rtol=1e-12)

    # Bar 1: asset_ret = (110 - 100)/100 = +0.10
    #        gross_ret = w_0 * 0.10 = 1.0 * 0.10 = 0.10
    #        turnover = |0.5 - 1.0| = 0.5
    #        cost = 0.5 * 0.0025 = 0.00125
    #        net_ret = 0.10 - 0.00125 = 0.09875
    np.testing.assert_allclose(sim.loc[1, "gross_return"], 0.10, rtol=1e-12)
    np.testing.assert_allclose(sim.loc[1, "cost"], 0.00125, rtol=1e-12)
    np.testing.assert_allclose(sim.loc[1, "net_return"], 0.09875, rtol=1e-12)

    # Bar 2: asset_ret = (105 - 110)/110 = -5/110 = -0.045454545454545456
    #        gross_ret = w_1 * (-5/110) = 0.5 * (-5/110) = -0.022727272727272728
    #        turnover = |0.0 - 0.5| = 0.5
    #        cost = 0.5 * 0.0025 = 0.00125
    #        net_ret = -0.022727272727272728 - 0.00125 = -0.023977272727272728
    expected_b2_gross = 0.5 * ((105.0 - 110.0) / 110.0)
    np.testing.assert_allclose(sim.loc[2, "gross_return"], expected_b2_gross, rtol=1e-12)
    np.testing.assert_allclose(sim.loc[2, "cost"], 0.00125, rtol=1e-12)
    np.testing.assert_allclose(sim.loc[2, "net_return"], expected_b2_gross - 0.00125, rtol=1e-12)

    # Bar 3: asset_ret = (115 - 105)/105 = 10/105
    #        gross_ret = w_2 * (10/105) = 0.0 * (10/105) = 0.0
    #        turnover = |1.0 - 0.0| = 1.0
    #        cost = 1.0 * 0.0025 = 0.0025
    #        net_ret = 0.0 - 0.0025 = -0.0025
    np.testing.assert_allclose(sim.loc[3, "gross_return"], 0.0, rtol=1e-12)
    np.testing.assert_allclose(sim.loc[3, "cost"], 0.0025, rtol=1e-12)
    np.testing.assert_allclose(sim.loc[3, "net_return"], -0.0025, rtol=1e-12)

    # Bar 4: asset_ret = (120 - 115)/115 = 5/115
    #        gross_ret = w_3 * (5/115) = 1.0 * (5/115) = 5/115
    #        turnover = |1.0 - 1.0| = 0.0
    #        cost = 0.0
    #        net_ret = 5/115
    expected_b4_gross = (120.0 - 115.0) / 115.0
    np.testing.assert_allclose(sim.loc[4, "gross_return"], expected_b4_gross, rtol=1e-12)
    np.testing.assert_allclose(sim.loc[4, "cost"], 0.0, rtol=1e-12)
    np.testing.assert_allclose(sim.loc[4, "net_return"], expected_b4_gross, rtol=1e-12)


def test_regression_recovers_planted_alpha_and_beta():
    """
    8. The regression recovers a planted alpha and beta from synthetic data.
    """
    np.random.seed(42)
    n = 1000
    mkt = np.random.normal(0.0005, 0.02, n)
    mkt = mkt - mkt.mean()
    planted_alpha_daily = 0.0008
    planted_beta = 0.65
    planted_alpha_ann = planted_alpha_daily * 365.0  # 0.292

    eps = np.random.normal(0, 0.002, n)
    eps = eps - eps.mean()
    strat = planted_alpha_daily + planted_beta * mkt + eps

    res = fit_ols_hac(pd.Series(strat), pd.Series(mkt), max_lags=20, annualization=365.0)

    # Recovered estimates must be closely aligned with planted parameters
    assert abs(res["alpha_ann"] - planted_alpha_ann) < 1e-6, f"Expected ~{planted_alpha_ann}, got {res['alpha_ann']}"
    assert abs(res["beta"] - planted_beta) < 0.01, f"Expected ~{planted_beta}, got {res['beta']}"


def test_bootstrap_ci_covers_planted_alpha():
    """
    9. The bootstrap CI covers the planted alpha under a fixed seed.
    """
    np.random.seed(42)
    n = 500
    mkt = np.random.normal(0.0005, 0.02, n)
    planted_alpha_daily = 0.0005
    planted_beta = 0.70
    planted_alpha_ann = planted_alpha_daily * 365.0  # 0.1825

    strat = planted_alpha_daily + planted_beta * mkt + np.random.normal(0, 0.004, n)

    point_alpha, ci_low, ci_high = compute_stationary_block_bootstrap_alpha_ci(
        pd.Series(strat),
        pd.Series(mkt),
        block_length=20,
        n_bootstraps=500,
        alpha_level=0.0125,
        seed=42,
    )

    assert ci_low <= planted_alpha_ann <= ci_high, (
        f"Planted alpha {planted_alpha_ann} outside CI [{ci_low}, {ci_high}]"
    )


def test_symmetric_entry_cost_charged_to_buy_and_hold():
    """
    10. Amendment 4(d): Symmetric initial entry cost is charged to Buy-and-Hold
        and all strategies at the first evaluated bar.
    """
    n = 250
    prices = pd.Series(np.linspace(100, 200, n))
    w_bh = compute_weights_buy_and_hold(prices)
    friction = 0.0050  # 50 bps round trip -> 25 bps entry cost

    sim_bh = simulate_strategy_returns(prices, w_bh, friction_round_trip=friction, warmup_bars=200)

    # First evaluated bar (index 200) must have entry turnover = 1.0 and cost = 0.0025
    first_idx = sim_bh.index[0]
    assert first_idx == 200
    np.testing.assert_allclose(sim_bh.loc[first_idx, "one_way_turnover"], 1.0, rtol=1e-12)
    np.testing.assert_allclose(sim_bh.loc[first_idx, "cost"], 0.0025, rtol=1e-12)


def test_verdict_rules_and_stage_x_no_verdict():
    """
    11. Amendment 4(b) & 4(c):
        - If B&H MaxDD < 20%, drawdown condition is NOT_TESTABLE and verdict is INCONCLUSIVE.
        - Stage X output has descriptive fields only and NO 'verdict' key.
    """
    np.random.seed(42)
    n = 300
    # Gentle upward price series with very small drawdown (< 20%)
    prices = pd.Series(100.0 * np.exp(np.linspace(0, 0.20, n)))

    # Test standard run (is_stage_x=False)
    res_conf = evaluate_overlay_pair(prices, "sma_200_trend", "TEST_COIN", is_stage_x=False)
    assert "verdict" in res_conf
    assert abs(res_conf["bh_max_dd"]) < 0.20
    assert res_conf["drawdown_condition"] == "NOT_TESTABLE"
    assert res_conf["verdict"] == "INCONCLUSIVE"

    # Test Stage X run (is_stage_x=True)
    res_stage_x = evaluate_overlay_pair(prices, "sma_200_trend", "TEST_COIN", is_stage_x=True)
    assert "verdict" not in res_stage_x, "Stage X output must NEVER contain 'verdict' key!"
    assert "drawdown_condition" not in res_stage_x
    assert "alpha_ann_point" in res_stage_x
    assert "strategy_cagr" in res_stage_x

