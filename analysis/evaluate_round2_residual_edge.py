#!/usr/bin/env python3
"""
Pre-Registered Evaluation Engine: Round 2 Macro Overlays & Residual Edge Analysis
Specification: docs/prereg/round2_residual_edge.md (including Amendments 1, 2, and 3)
Protocol Version: 1.0 (Strict One-Run Protocol, No Post-Hoc Parameter Tuning)

Strategies evaluated (M = 4 active tests):
1. EWMA(0.94) Volatility Targeting on BTCUSDT
2. 200-Day SMA Trend Filter on BTCUSDT
3. EWMA(0.94) Volatility Targeting on ETHUSDT
4. 200-Day SMA Trend Filter on ETHUSDT
Baseline Control: Passive Buy-and-Hold (not a test)

Decision Rule:
- Drawdown Condition: MaxDD_strategy < MaxDD_B&H
- Residual Alpha Condition: Stationary block bootstrap 98.75% CI (Bonferroni alpha = 0.05/4) strictly > 0
"""

import argparse
import json
import os
import sys
from typing import Dict, Tuple, Optional

import numpy as np
import pandas as pd
import statsmodels.api as sm


WARMUP_BARS = 200
EWMA_DECAY = 0.94
EWMA_SEED_BARS = 30
TARGET_VOL = 0.40
MAX_LEVERAGE = 1.0
ANNUALIZATION_FACTOR = 365.0

# Pre-registered friction schedules (Amendment 3: primary 50 bps round trip / 25 bps per unit one-way turnover)
FRICTION_TIERS = {
    "primary_50bps": 0.005000,      # 50 bps round-trip -> 25 bps per unit turnover (0.0025)
    "sensitivity_25bps": 0.002500,  # 25 bps round-trip -> 12.5 bps per unit turnover (0.00125)
    "tds_stress_100bps": 0.010000,  # 100 bps round-trip -> 50 bps per unit turnover (0.0050)
}

BONFERRONI_M = 4
ALPHA_FAMILY = 0.05
ALPHA_BONF = ALPHA_FAMILY / BONFERRONI_M  # 0.0125
BOOTSTRAP_BLOCK_L = 20
BOOTSTRAP_B = 1000


def compute_ewma_volatility(
    close_series: pd.Series,
    decay: float = EWMA_DECAY,
    seed_bars: int = EWMA_SEED_BARS,
    annualization: float = ANNUALIZATION_FACTOR,
) -> pd.Series:
    """
    Computes annualized EWMA volatility using RiskMetrics continuous formulation.
    Seed variance is the sample variance of the first seed_bars daily log returns.
    Calculation at day t uses only returns up to day t (zero future information).
    """
    n = len(close_series)
    vol_ann = pd.Series(index=close_series.index, dtype=float)

    if n <= seed_bars:
        return vol_ann

    log_returns = np.log(close_series / close_series.shift(1))
    var_series = np.full(n, np.nan)

    # Seed variance over initial log returns r_1 ... r_{seed_bars-1}
    seed_sample = log_returns.iloc[1:seed_bars].dropna()
    if len(seed_sample) >= 2:
        init_var = float(np.var(seed_sample, ddof=1))
    else:
        init_var = 1e-4

    var_series[seed_bars - 1] = init_var

    # Recursive update: sigma_t^2 = lambda * sigma_{t-1}^2 + (1 - lambda) * r_t^2
    for t in range(seed_bars, n):
        r_t = log_returns.iloc[t]
        if np.isnan(r_t):
            var_series[t] = var_series[t - 1]
        else:
            var_series[t] = decay * var_series[t - 1] + (1.0 - decay) * (r_t ** 2)

    vol_ann[:] = np.sqrt(np.maximum(0.0, var_series) * annualization)
    return vol_ann


def compute_weights_ewma(
    close_series: pd.Series,
    target_vol: float = TARGET_VOL,
    decay: float = EWMA_DECAY,
    seed_bars: int = EWMA_SEED_BARS,
    max_leverage: float = MAX_LEVERAGE,
) -> pd.Series:
    """
    Computes target portfolio weight at daily close of day t.
    w_t = max(0.0, min(max_leverage, target_vol / sigma_{ann, t}))
    """
    vol_ann = compute_ewma_volatility(close_series, decay=decay, seed_bars=seed_bars)
    weights = pd.Series(0.0, index=close_series.index, dtype=float)

    valid_mask = vol_ann > 1e-6
    raw_weights = target_vol / vol_ann[valid_mask]
    constrained_weights = np.clip(raw_weights, 0.0, max_leverage)
    weights.loc[valid_mask] = constrained_weights
    return weights


def compute_weights_sma200(
    close_series: pd.Series,
    window: int = 200,
) -> pd.Series:
    """
    Computes 200-day simple moving average binary weight at daily close of day t.
    w_t = 1.0 if close_t > SMA_{200, t} else 0.0
    For t < window - 1, weight is 0.0 (warm-up).
    """
    sma = close_series.rolling(window=window).mean()
    weights = pd.Series(0.0, index=close_series.index, dtype=float)
    valid_mask = ~sma.isna()
    weights.loc[valid_mask] = np.where(close_series.loc[valid_mask] > sma.loc[valid_mask], 1.0, 0.0)
    return weights


def compute_weights_buy_and_hold(close_series: pd.Series) -> pd.Series:
    """
    Passive Buy-and-Hold benchmark: 100% long at all times (w_t = 1.0).
    """
    return pd.Series(1.0, index=close_series.index, dtype=float)


def simulate_strategy_returns(
    close_series: pd.Series,
    weights: pd.Series,
    friction_round_trip: float,
    warmup_bars: int = WARMUP_BARS,
) -> pd.DataFrame:
    """
    Simulates close-to-close returns following Amendment 2 & 3:
    - Weight decided at close of day t earns close-to-close return of day t+1:
      R_{gross, t+1} = w_t * (close_{t+1} / close_t - 1)
    - Rebalance cost per unit of one-way turnover:
      Cost_{t+1} = |w_{t+1} - w_t| * (friction_round_trip / 2)
    - Net return:
      R_{net, t+1} = R_{gross, t+1} - Cost_{t+1}
    - The first warmup_bars are strictly excluded from returned metrics.
    """
    n = len(close_series)
    if n <= warmup_bars:
        raise ValueError(f"Series length {n} must exceed warmup_bars {warmup_bars}.")

    # Underlying asset close-to-close return: close_t / close_{t-1} - 1
    asset_ret = close_series.pct_change()

    # Strategy gross return earned at day t: w_{t-1} * asset_ret_t
    gross_ret = weights.shift(1) * asset_ret

    # One-way turnover at close of day t: |w_t - w_{t-1}|
    one_way_turnover = (weights - weights.shift(1)).abs()

    # Cost applied on day t for rebalancing from w_{t-1} to w_t
    rebalance_cost = one_way_turnover * (friction_round_trip / 2.0)

    # Net return
    net_ret = gross_ret - rebalance_cost

    df = pd.DataFrame(
        {
            "close": close_series,
            "weight": weights,
            "asset_return": asset_ret,
            "gross_return": gross_ret,
            "one_way_turnover": one_way_turnover,
            "cost": rebalance_cost,
            "net_return": net_ret,
        },
        index=close_series.index,
    )

    # Exclude warm-up window strictly
    df_eval = df.iloc[warmup_bars:].copy()
    return df_eval


def compute_max_drawdown(net_returns: pd.Series) -> float:
    """
    Calculates maximum peak-to-trough equity drawdown.
    """
    cum_equity = (1.0 + net_returns).cumprod()
    running_max = cum_equity.cummax()
    drawdowns = (cum_equity - running_max) / running_max
    return float(drawdowns.min())


def compute_performance_metrics(
    net_returns: pd.Series,
    annualization: float = ANNUALIZATION_FACTOR,
) -> Dict[str, float]:
    """
    Computes annualized net return (CAGR), annualized volatility, Sharpe ratio, and MaxDD.
    """
    n_days = len(net_returns)
    if n_days == 0:
        return {"cagr": 0.0, "ann_vol": 0.0, "sharpe": 0.0, "max_dd": 0.0, "n_bars": 0}

    cum_prod = float((1.0 + net_returns).prod())
    cagr = (cum_prod ** (annualization / n_days)) - 1.0 if cum_prod > 0 else -1.0

    mean_daily = float(net_returns.mean())
    std_daily = float(net_returns.std(ddof=1)) if n_days > 1 else 0.0

    ann_vol = std_daily * np.sqrt(annualization)
    sharpe = (mean_daily / std_daily) * np.sqrt(annualization) if std_daily > 1e-8 else 0.0
    max_dd = compute_max_drawdown(net_returns)

    return {
        "cagr": cagr,
        "ann_vol": ann_vol,
        "sharpe": sharpe,
        "max_dd": max_dd,
        "n_bars": n_days,
    }


def fit_ols_hac(
    strategy_net_returns: pd.Series,
    benchmark_net_returns: pd.Series,
    max_lags: int = 20,
    annualization: float = ANNUALIZATION_FACTOR,
) -> Dict[str, float]:
    """
    Fits OLS: R_strategy,t = alpha + beta * R_benchmark,t + epsilon_t
    Computes Newey-West HAC standard errors with specified lag truncation.
    """
    y = strategy_net_returns.values
    X = sm.add_constant(benchmark_net_returns.values)

    model = sm.OLS(y, X)
    results = model.fit(cov_type="HAC", cov_kwds={"maxlags": max_lags})

    alpha_daily = float(results.params[0])
    beta = float(results.params[1])
    alpha_se_daily = float(results.bse[0])
    alpha_ann = alpha_daily * annualization
    alpha_ann_se = alpha_se_daily * annualization

    return {
        "alpha_ann": alpha_ann,
        "alpha_ann_se": alpha_ann_se,
        "beta": beta,
        "beta_se": float(results.bse[1]),
        "r2": float(results.rsquared),
        "pvalue_alpha": float(results.pvalues[0]),
    }


def compute_stationary_block_bootstrap_alpha_ci(
    strategy_net_returns: pd.Series,
    benchmark_net_returns: pd.Series,
    block_length: int = BOOTSTRAP_BLOCK_L,
    n_bootstraps: int = BOOTSTRAP_B,
    alpha_level: float = ALPHA_BONF,
    seed: int = 42,
    annualization: float = ANNUALIZATION_FACTOR,
) -> Tuple[float, float, float]:
    """
    Computes block bootstrap confidence interval for annualized alpha.
    Two-sided confidence interval at 1 - alpha_level (e.g. 98.75% for alpha=0.0125).
    Percentile bounds: [alpha_level / 2 * 100, (1 - alpha_level / 2) * 100].
    """
    rng = np.random.default_rng(seed)
    n = len(strategy_net_returns)
    y = strategy_net_returns.values
    x = benchmark_net_returns.values

    # Pre-calculate base OLS point estimate
    X_base = np.column_stack([np.ones(n), x])
    beta_vec, _, _, _ = np.linalg.lstsq(X_base, y, rcond=None)
    point_alpha_ann = float(beta_vec[0] * annualization)

    # Circular block bootstrap
    alphas_boot = np.empty(n_bootstraps, dtype=float)
    n_blocks = int(np.ceil(n / block_length))

    for b in range(n_bootstraps):
        start_indices = rng.integers(0, n, size=n_blocks)
        sample_indices = []
        for s in start_indices:
            sample_indices.extend([(s + i) % n for i in range(block_length)])
        idx = np.array(sample_indices[:n])

        y_b = y[idx]
        x_b = x[idx]
        X_b = np.column_stack([np.ones(n), x_b])

        try:
            b_vec, _, _, _ = np.linalg.lstsq(X_b, y_b, rcond=None)
            alphas_boot[b] = b_vec[0] * annualization
        except Exception:
            alphas_boot[b] = point_alpha_ann

    q_lower = (alpha_level / 2.0) * 100.0
    q_upper = (1.0 - alpha_level / 2.0) * 100.0
    ci_lower = float(np.percentile(alphas_boot, q_lower))
    ci_upper = float(np.percentile(alphas_boot, q_upper))

    return point_alpha_ann, ci_lower, ci_upper


def evaluate_overlay_pair(
    close_series: pd.Series,
    strategy_name: str,
    asset_name: str,
    friction_tier: str = "primary_50bps",
    seed: int = 42,
) -> Dict:
    """
    Evaluates one active overlay strategy against buy-and-hold on a single asset series.
    """
    friction = FRICTION_TIERS[friction_tier]

    # Compute weights
    if strategy_name == "ewma_vol_target":
        weights = compute_weights_ewma(close_series)
    elif strategy_name == "sma_200_trend":
        weights = compute_weights_sma200(close_series)
    else:
        raise ValueError(f"Unknown strategy: {strategy_name}")

    bh_weights = compute_weights_buy_and_hold(close_series)

    # Simulate
    strat_sim = simulate_strategy_returns(close_series, weights, friction)
    bh_sim = simulate_strategy_returns(close_series, bh_weights, friction)

    strat_metrics = compute_performance_metrics(strat_sim["net_return"])
    bh_metrics = compute_performance_metrics(bh_sim["net_return"])

    # Residual edge analysis
    ols_hac = fit_ols_hac(strat_sim["net_return"], bh_sim["net_return"])
    point_alpha, ci_low, ci_high = compute_stationary_block_bootstrap_alpha_ci(
        strat_sim["net_return"],
        bh_sim["net_return"],
        alpha_level=ALPHA_BONF,
        seed=seed,
    )

    # Decision rule logic
    drawdown_condition_met = strat_metrics["max_dd"] > bh_metrics["max_dd"]  # max_dd is negative, closer to 0 is lower DD
    alpha_ci_excludes_zero = ci_low > 0.0

    # Amendment 2(g) caveats
    drawdown_testable = True
    if abs(bh_metrics["max_dd"]) < 0.20:
        drawdown_testable = False
        dd_verdict = "NOT_TESTABLE (B&H MaxDD < 20%)"
    else:
        dd_verdict = "PASS" if drawdown_condition_met else "FAIL"

    if alpha_ci_excludes_zero and drawdown_condition_met and drawdown_testable:
        verdict = "INDEPENDENT_RESIDUAL_EDGE_CONFIRMED"
    elif drawdown_condition_met:
        verdict = "RISK_REDUCTION_BETA_SCALING"
    else:
        verdict = "NO_EDGE"

    return {
        "asset": asset_name,
        "strategy": strategy_name,
        "friction_tier": friction_tier,
        "friction_bps": friction * 10000,
        "n_bars_eval": strat_metrics["n_bars"],
        "strategy_cagr": strat_metrics["cagr"],
        "strategy_max_dd": strat_metrics["max_dd"],
        "strategy_sharpe": strat_metrics["sharpe"],
        "bh_cagr": bh_metrics["cagr"],
        "bh_max_dd": bh_metrics["max_dd"],
        "bh_sharpe": bh_metrics["sharpe"],
        "beta": ols_hac["beta"],
        "r2": ols_hac["r2"],
        "alpha_ann_point": point_alpha,
        "alpha_ann_hac_se": ols_hac["alpha_ann_se"],
        "alpha_ann_ci_9875_lower": ci_low,
        "alpha_ann_ci_9875_upper": ci_high,
        "drawdown_condition": dd_verdict,
        "residual_alpha_condition": "PASS" if alpha_ci_excludes_zero else "FAIL",
        "verdict": verdict,
    }


def main():
    parser = argparse.ArgumentParser(description="Round 2 Macro Overlays Evaluation Engine")
    parser.add_argument("--synthetic-test", action="store_true", help="Run sanity check on synthetic data only")
    args = parser.parse_args()

    if args.synthetic_test:
        print("Running synthetic validation...")
        np.random.seed(42)
        n = 500
        # Synthetic random walk
        prices = 100.0 * np.exp(np.cumsum(np.random.normal(0, 0.02, n)))
        close_series = pd.Series(prices)
        res = evaluate_overlay_pair(close_series, "ewma_vol_target", "SYNTHETIC_COIN")
        print("Synthetic test completed successfully:")
        print(json.dumps(res, indent=2))
        return

    print("Canonical pre-registered script analysis/evaluate_round2_residual_edge.py loaded.")
    print("Execution on real data is sealed until confirmatory gates or authorized Stage X exploratory run.")


if __name__ == "__main__":
    main()
