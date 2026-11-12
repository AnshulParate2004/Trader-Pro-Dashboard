#!/usr/bin/env python3
"""
scripts/test_interactions.py

Tests bivariate interaction binning, consistency mapping, and regime splits.
"""

import os
import sys
import numpy as np
import pandas as pd
from scipy import stats

sys.stdout.reconfigure(encoding='utf-8')

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DATA_DIR = os.path.join(BASE_DIR, "data", "us_equities")

df = pd.read_parquet(os.path.join(DATA_DIR, "features.parquet"))
print(f"Loaded features.parquet with {len(df)} rows.")

disc_df = df[df["sample_period"] == "DISCOVERY"].copy()
val_df = df[df["sample_period"] == "VALIDATION"].copy()

PAIRS = [
    ("value_z_own_pe", "momentum_12_1", "continuous", "continuous"),
    ("pe_vs_sector", "eps_growth_yoy", "continuous", "continuous"),
    ("value_z_own_pe", "ema20_50_state", "continuous", "binary"),
    ("value_z_own_pe", "dist_above_support_atr", "continuous", "continuous"),
    ("rsi14", "ema20_50_state", "continuous", "binary"),
    ("dist_above_support_atr", "volume_ratio_50d", "continuous", "continuous"),
    ("trendline_dist_atr", "value_z_own_pe", "continuous", "continuous"),
    ("momentum_12_1", "rsi14", "continuous", "continuous"),
]

def bin_factor(series, kind, q=5):
    if kind == "binary":
        return series.astype(int)
    else:
        # Cross-sectional or pooled quintiles with duplicate drop
        try:
            return pd.qcut(series.dropna(), q=q, labels=[f"Q{i+1}" for i in range(q)], duplicates="drop")
        except Exception:
            return pd.cut(series.dropna(), bins=q, labels=[f"Q{i+1}" for i in range(q)])

def evaluate_interaction(sub_df, x_col, y_col, x_kind, y_kind, target_col="fwd_excess_ret_63d", min_n=30):
    valid = sub_df.dropna(subset=[x_col, y_col, target_col]).copy()
    valid["qx"] = bin_factor(valid[x_col], x_kind)
    valid["qy"] = bin_factor(valid[y_col], y_kind)
    
    # Group by
    stats_matrix = {}
    for (qx, qy), group in valid.groupby(["qx", "qy"], observed=False):
        n = len(group)
        if n < min_n:
            stats_matrix[(qx, qy)] = {"n": n, "mean": np.nan, "t": np.nan, "masked": True}
        else:
            vals = group[target_col].values
            mean_val = np.mean(vals) * 100.0 # in %
            std_val = np.std(vals, ddof=1) * 100.0
            t_stat = mean_val / (std_val / np.sqrt(n)) if std_val > 0 else 0.0
            stats_matrix[(qx, qy)] = {"n": n, "mean": mean_val, "t": t_stat, "masked": False}
    return stats_matrix

print("\n--- Testing 8 Interaction Pairs on Discovery (2010-2019) vs Validation (2020-2026) ---")
consistency_summary = []

for x_col, y_col, x_kind, y_kind in PAIRS:
    disc_res = evaluate_interaction(disc_df, x_col, y_col, x_kind, y_kind)
    val_res = evaluate_interaction(val_df, x_col, y_col, x_kind, y_kind)
    
    total_cells = len(disc_res)
    consistent_cells = 0
    consistent_details = []
    
    for k in disc_res.keys():
        d = disc_res.get(k)
        v = val_res.get(k)
        if d and v and not d["masked"] and not v["masked"]:
            d_t = d["t"]
            v_mean = v["mean"]
            d_mean = d["mean"]
            # Criteria: |t_disc| >= 2.0 AND sign(mean_disc) == sign(mean_val)
            if abs(d_t) >= 2.0 and np.sign(d_mean) == np.sign(v_mean):
                consistent_cells += 1
                consistent_details.append(f"{k}: Disc t={d_t:.2f} (mean={d_mean:.1f}%), Val mean={v_mean:.1f}%")
                
    expected_chance = total_cells * 0.05 * 0.50 # Two-tailed 5% with 50% sign agreement = 2.5%
    pair_name = f"{x_col} x {y_col}"
    print(f"\nPair: {pair_name}")
    print(f"  Total Grid Cells: {total_cells} | Consistent Cells: {consistent_cells} | Expected by Chance: {expected_chance:.2f}")
    if consistent_details:
        for det in consistent_details:
            print(f"    -> {det}")
    else:
        print("    -> ZERO consistent cells found.")
        
    consistency_summary.append({
        "pair": pair_name,
        "total_cells": total_cells,
        "consistent_cells": consistent_cells,
        "expected_chance": expected_chance,
        "is_signal": consistent_cells > max(2, int(expected_chance * 2))
    })

print("\n" + "=" * 80)
print("INTERACTION SUMMARY TABLE:")
print("=" * 80)
summary_df = pd.DataFrame(consistency_summary)
print(summary_df.to_string(index=False))
