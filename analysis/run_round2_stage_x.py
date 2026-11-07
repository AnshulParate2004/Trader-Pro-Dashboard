#!/usr/bin/env python3
"""
Stage X (Exploratory Historical Run) Runner: Round 2 Macro Overlays
Specification: docs/prereg/round2_residual_edge.md (Amendments 1-4)
Strict Rule: Exploratory run on data up to and including 2026-10-31 only.
Outputs descriptive metrics only (no verdict field).

DO NOT RUN THIS SCRIPT UNTIL EXPLICITLY AUTHORIZED.
"""

import json
import os
import sys
from pathlib import Path
from typing import Dict, List

import pandas as pd

# Add parent directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from analysis.load_round2_data import load_daily_series
from analysis.evaluate_round2_residual_edge import (
    evaluate_overlay_pair,
    FRICTION_TIERS,
)

STAGE_X_MAX_DATE = "2026-10-31"
SYMBOLS = ["BTCUSDT", "ETHUSDT"]
STRATEGIES = ["ewma_vol_target", "sma_200_trend"]
TIERS = ["primary_50bps", "sensitivity_25bps", "tds_stress_100bps"]


def run_stage_x_evaluations(data_root: str = None) -> List[Dict]:
    """
    Executes Stage X descriptive evaluations across all pre-registered pairs and cost tiers.
    Strictly asserts that data does not exceed 2026-10-31.
    """
    results = []

    for symbol in SYMBOLS:
        # load_daily_series enforces date <= 2026-10-31
        series = load_daily_series(symbol, data_root=data_root, max_allowed_date=STAGE_X_MAX_DATE)

        # Explicit assertion before execution
        last_date = series.index.max().strftime("%Y-%m-%d")
        assert last_date <= STAGE_X_MAX_DATE, (
            f"FATAL: {symbol} data ends at {last_date}, exceeding Stage X boundary {STAGE_X_MAX_DATE}!"
        )

        for strat in STRATEGIES:
            for tier in TIERS:
                res = evaluate_overlay_pair(
                    series,
                    strategy_name=strat,
                    asset_name=symbol,
                    friction_tier=tier,
                    is_stage_x=True,  # Guarantees no verdict field
                )
                assert "verdict" not in res, "Stage X results must NEVER contain a verdict field!"
                results.append(res)

    return results


def save_stage_x_reports(results: List[Dict], output_dir: str = "analysis/results"):
    """
    Saves descriptive JSON and Markdown reports.
    """
    out_path = Path(output_dir)
    out_path.mkdir(parents=True, exist_ok=True)

    json_file = out_path / "stage_x_round2_descriptive.json"
    md_file = out_path / "stage_x_round2_descriptive.md"

    # Write JSON
    with open(json_file, "w", encoding="utf-8") as f:
        json.dump(
            {
                "protocol": "Round 2 Stage X Exploratory Historical Evaluation",
                "boundary_date": STAGE_X_MAX_DATE,
                "n_runs": len(results),
                "evaluations": results,
            },
            f,
            indent=2,
        )

    # Format Markdown summary
    lines = [
        "# Round 2 Stage X: Descriptive Historical Evaluation (Pre-2026-10-31)",
        "",
        f"**Cutoff Date:** `{STAGE_X_MAX_DATE}`  ",
        "**Status:** Descriptive Exploration Only (No Confirmatory Edge Verdicts)  ",
        "",
        "| Asset | Strategy | Tier | Net CAGR | MaxDD | Sharpe | B&H CAGR | B&H MaxDD | Beta | Alpha Ann | Alpha HAC SE | Alpha 98.75% CI |",
        "| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |",
    ]

    for r in results:
        ci_str = f"[{r['alpha_ann_ci_9875_lower']:.4f}, {r['alpha_ann_ci_9875_upper']:.4f}]"
        lines.append(
            f"| {r['asset']} | {r['strategy']} | {r['friction_tier']} | "
            f"{r['strategy_cagr']*100:.2f}% | {r['strategy_max_dd']*100:.2f}% | {r['strategy_sharpe']:.2f} | "
            f"{r['bh_cagr']*100:.2f}% | {r['bh_max_dd']*100:.2f}% | {r['beta']:.2f} | "
            f"{r['alpha_ann_point']*100:.2f}% | {r['alpha_ann_hac_se']*100:.2f}% | {ci_str} |"
        )

    with open(md_file, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")

    print(f"Stage X descriptive reports successfully saved to {out_path}.")


def main():
    print("Stage X execution script configured.")
    print("Execution is sealed until explicitly authorized.")


if __name__ == "__main__":
    main()
