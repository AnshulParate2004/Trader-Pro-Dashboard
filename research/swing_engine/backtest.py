#!/usr/bin/env python3
"""
Backtest & Expectancy Evaluator for 4H / Daily Swing Meta-Labeling Engine
Specification: docs/prereg/swing_meta_labeling_4h.md (Step 4)

Compares:
1. Base Strategy: Raw candidate breakout signals without AI filtering.
2. AI-Filtered Strategy: Trades gated by LightGBM Meta-Classifier (P >= 0.65).

Metrics:
- Total Trades (N)
- Win Rate (%) [Net of 0.10% friction]
- Profit Factor
- Net Return (R) & Mean Expectancy per Trade (Net R)
- Maximum Drawdown in R
- Out-of-Sample ROC-AUC of the Meta-Classifier
"""

from pathlib import Path
from typing import Dict, List, Optional, Tuple, Union
import numpy as np
import pandas as pd
from sklearn.metrics import roc_auc_score

try:
    from .config import (
        META_QUALITY_THRESHOLD,
        ROUND_TRIP_FRICTION_PCT,
    )
    from .train import (
        prepare_multi_asset_dataset,
        train_walk_forward_meta_classifier,
    )
except ImportError:
    import sys
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))
    from research.swing_engine.config import (
        META_QUALITY_THRESHOLD,
        ROUND_TRIP_FRICTION_PCT,
    )
    from research.swing_engine.train import (
        prepare_multi_asset_dataset,
        train_walk_forward_meta_classifier,
    )


def compute_trade_series_metrics(
    df_trades: pd.DataFrame,
    r_col: str = "net_r",
) -> Dict[str, Union[int, float]]:
    """
    Computes rigorous trade metrics on a series of completed trades:
    N, Win Rate (%), Profit Factor, Cumulative Net R, Mean Expectancy (Net R), Max Drawdown in R.
    """
    n = len(df_trades)
    if n == 0:
        return {
            "n_trades": 0,
            "win_rate_pct": 0.0,
            "profit_factor": 0.0,
            "total_net_r": 0.0,
            "mean_net_r": 0.0,
            "max_dd_r": 0.0,
        }

    r_vals = df_trades[r_col].values

    wins = r_vals[r_vals > 0]
    losses = r_vals[r_vals < 0]

    win_rate = (len(wins) / n) * 100.0

    sum_wins = float(wins.sum()) if len(wins) > 0 else 0.0
    sum_losses = float(np.abs(losses).sum()) if len(losses) > 0 else 0.0

    if sum_losses > 0:
        profit_factor = sum_wins / sum_losses
    elif sum_wins > 0:
        profit_factor = float("inf")
    else:
        profit_factor = 0.0

    total_net_r = float(r_vals.sum())
    mean_net_r = float(r_vals.mean())

    # Drawdown in R
    cum_r = np.cumsum(r_vals)
    cum_max = np.maximum.accumulate(cum_r)
    dd_r = cum_r - cum_max
    max_dd_r = float(dd_r.min())

    return {
        "n_trades": n,
        "win_rate_pct": win_rate,
        "profit_factor": profit_factor,
        "total_net_r": total_net_r,
        "mean_net_r": mean_net_r,
        "max_dd_r": max_dd_r,
    }


def evaluate_backtest_comparison(
    df_oos: pd.DataFrame,
    threshold: float = META_QUALITY_THRESHOLD,
) -> Dict[str, Dict]:
    """
    Performs side-by-side evaluation of Base Strategy vs AI-Filtered Strategy.
    """
    # 1. Base Strategy (All candidate trades in OOS window)
    metrics_base = compute_trade_series_metrics(df_oos, r_col="net_r")

    # 2. AI-Filtered Strategy (Candidate trades with meta_prob >= threshold)
    df_ai = df_oos[df_oos["meta_prob"] >= threshold].copy().reset_index(drop=True)
    metrics_ai = compute_trade_series_metrics(df_ai, r_col="net_r")

    # Out-of-sample ROC-AUC
    if len(np.unique(df_oos["label_y"])) > 1:
        oos_auc = float(roc_auc_score(df_oos["label_y"], df_oos["meta_prob"]))
    else:
        oos_auc = 0.50

    metrics_base["oos_auc"] = oos_auc
    metrics_ai["oos_auc"] = oos_auc

    # Expectancy Delta
    delta_mean_r = metrics_ai["mean_net_r"] - metrics_base["mean_net_r"]

    return {
        "base_strategy": metrics_base,
        "ai_filtered_strategy": metrics_ai,
        "delta_mean_r": delta_mean_r,
        "threshold": threshold,
    }


def format_comparison_table(results: Dict[str, Dict]) -> str:
    """
    Formats markdown comparison table matching institutional reporting guidelines.
    """
    base = results["base_strategy"]
    ai = results["ai_filtered_strategy"]
    delta_r = results["delta_mean_r"]
    thresh = results["threshold"]
    auc = base["oos_auc"]

    pf_base_str = f"{base['profit_factor']:.2f}" if base["profit_factor"] != float("inf") else "inf"
    pf_ai_str = f"{ai['profit_factor']:.2f}" if ai["profit_factor"] != float("inf") else "inf"

    lines = [
        f"### Primary Pre-Registered Evaluation (Threshold P >= {thresh:.2f})",
        "",
        "| Metric | Rule-Only (Base Strategy) | AI-Filtered (Meta P >= 0.65) | Delta / Improvement |",
        "| :--- | :---: | :---: | :---: |",
        f"| **Total Trades (N)** | `{base['n_trades']}` | `{ai['n_trades']}` | `{ai['n_trades'] - base['n_trades']}` trades |",
        f"| **Win Rate (%)** | `{base['win_rate_pct']:.2f}%` | `{ai['win_rate_pct']:.2f}%` | `{ai['win_rate_pct'] - base['win_rate_pct']:+.2f}%` |",
        f"| **Profit Factor** | `{pf_base_str}` | `{pf_ai_str}` | - |",
        f"| **Total Net Return (R)** | `{base['total_net_r']:+.2f}R` | `{ai['total_net_r']:+.2f}R` | `{ai['total_net_r'] - base['total_net_r']:+.2f}R` |",
        f"| **Mean Net Expectancy / Trade** | `{base['mean_net_r']:+.4f}R` | `{ai['mean_net_r']:+.4f}R` | **`{delta_r:+.4f}R`** |",
        f"| **Max Drawdown (R)** | `{base['max_dd_r']:.2f}R` | `{ai['max_dd_r']:.2f}R` | `{ai['max_dd_r'] - base['max_dd_r']:+.2f}R` |",
        f"| **OOS Meta-Classifier AUC** | `{auc:.4f}` | `{auc:.4f}` | (Evaluated across pooled OOS) |",
    ]
    return "\n".join(lines)


def format_sensitivity_table(df_oos: pd.DataFrame, thresholds: List[float]) -> str:
    """
    Formats threshold sensitivity breakdown showing trade count, win rate, profit factor,
    and net expectancy across candidate probability cutoffs.
    """
    lines = [
        "### Empirical Threshold Sensitivity Analysis",
        "",
        "| Threshold Gate | Trades (N) | Win Rate (%) | Profit Factor | Mean Net R | Total Net R | Max Drawdown (R) |",
        "| :--- | :---: | :---: | :---: | :---: | :---: | :---: |",
    ]

    for t in thresholds:
        sub = df_oos[df_oos["meta_prob"] >= t].reset_index(drop=True)
        m = compute_trade_series_metrics(sub, r_col="net_r")
        pf_str = f"{m['profit_factor']:.2f}" if m["profit_factor"] != float("inf") else "inf"
        lines.append(
            f"| **P >= {t:.2f}** | `{m['n_trades']}` | `{m['win_rate_pct']:.2f}%` | `{pf_str}` | "
            f"`{m['mean_net_r']:+.4f}R` | `{m['total_net_r']:+.2f}R` | `{m['max_dd_r']:.2f}R` |"
        )

    return "\n".join(lines)


def run_full_swing_evaluation(
    data_root: Optional[Union[str, Path]] = None,
    threshold: float = META_QUALITY_THRESHOLD,
) -> Tuple[pd.DataFrame, Dict]:
    """
    Full pipeline runner:
    1. Prepares multi-asset data.
    2. Runs Purged Walk-Forward LightGBM training.
    3. Evaluates Base vs AI-Filtered performance.
    """
    print("\n================================================================================")
    print("4H / DAILY SWING META-LABELING ENGINE: FULL WALK-FORWARD BACKTEST")
    print(f"Candidate Universe: BTCUSDT, ETHUSDT, SOLUSDT (4H)")
    print(f"Meta-Classifier Gate: LightGBM P(y=1) >= {threshold:.2f}")
    print(f"Friction Deducted: {ROUND_TRIP_FRICTION_PCT*10000:.0f} bps round-trip per trade")
    print("================================================================================\n")

    print("[STEP 1/3] Ingesting market data and extracting leak-free features...")
    df_dataset = prepare_multi_asset_dataset(data_root=data_root)
    print(f"  -> Generated {len(df_dataset)} total candidate breakout trades across 2020-2026.")

    print("\n[STEP 2/3] Training LightGBM Meta-Classifier across 3 Purged Walk-Forward splits...")
    df_oos, split_metrics = train_walk_forward_meta_classifier(df_dataset)
    for k, v in split_metrics.items():
        if "auc" in k:
            print(f"  -> {k}: {v:.4f}")
        else:
            print(f"  -> {k}: {v}")

    print("\n[STEP 3/3] Evaluating out-of-sample backtest comparison (Base vs AI-Filtered)...")
    comparison = evaluate_backtest_comparison(df_oos, threshold=threshold)

    print("\n" + format_comparison_table(comparison) + "\n")

    thresholds_to_test = [0.00, 0.05, 0.08, 0.10, 0.12, 0.15, 0.20, 0.25, 0.30, 0.50, 0.65]
    print(format_sensitivity_table(df_oos, thresholds_to_test) + "\n")
    print("================================================================================\n")

    return df_oos, comparison


if __name__ == "__main__":
    run_full_swing_evaluation()
