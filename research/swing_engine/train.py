#!/usr/bin/env python3
"""
Purged Walk-Forward Model Training for 4H / Daily Swing Meta-Labeling Engine
Specification: docs/prereg/swing_meta_labeling_4h.md (Step 3)

Invariants:
1. Walk-Forward expanding window splits (2021-2023 -> 2024; 2021-2024 -> 2025; 2021-2025 -> 2026).
2. Purging/Embargo: Drops the trailing 12 bars (48h) of each training window to prevent label leakage.
3. Shallow, regularized LightGBM classifier (max_depth=3, num_leaves=7, n_estimators=150).
4. Strictly out-of-sample probability generation (P(y=1)).
"""

from pathlib import Path
from typing import Dict, List, Optional, Tuple, Union

import lightgbm as lgb
import numpy as np
import pandas as pd
from sklearn.metrics import roc_auc_score

try:
    from .config import (
        BENCHMARK_SYMBOL,
        INTERVAL_4H,
        ROUND_TRIP_FRICTION_PCT,
        SYMBOLS,
        TIME_BARRIER_BARS,
    )
    from .data_loader import load_market_dataset
    from .features import build_swing_features
    from .labeling import evaluate_single_trade_barriers
    from .signals import generate_candidate_signals
except ImportError:
    import sys
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))
    from research.swing_engine.config import (
        BENCHMARK_SYMBOL,
        INTERVAL_4H,
        ROUND_TRIP_FRICTION_PCT,
        SYMBOLS,
        TIME_BARRIER_BARS,
    )
    from research.swing_engine.data_loader import load_market_dataset
    from research.swing_engine.features import build_swing_features
    from research.swing_engine.labeling import evaluate_single_trade_barriers
    from research.swing_engine.signals import generate_candidate_signals


FEATURE_COLUMNS = [
    "rs_vs_btc_3d",
    "rs_vs_btc_7d",
    "rs_vs_btc_30d",
    "funding_rate_zscore",
    "oi_delta_1d",
    "oi_delta_3d",
    "vol_ratio_30d",
    "volume_zscore_20",
    "dist_ema_20",
    "dist_ema_50",
    "dist_sma_200",
    "trend_aligned",
    "donchian_pos_20",
    "atr_pct",
]

WALK_FORWARD_SPLITS = [
    {
        "split_id": 1,
        "train_start": "2021-01-01",
        "train_end": "2023-12-31 23:59:59",
        "test_start": "2024-01-01 00:00:00",
        "test_end": "2024-12-31 23:59:59",
    },
    {
        "split_id": 2,
        "train_start": "2021-01-01",
        "train_end": "2024-12-31 23:59:59",
        "test_start": "2025-01-01 00:00:00",
        "test_end": "2025-12-31 23:59:59",
    },
    {
        "split_id": 3,
        "train_start": "2021-01-01",
        "train_end": "2025-12-31 23:59:59",
        "test_start": "2026-01-01 00:00:00",
        "test_end": "2026-10-31 23:59:59",
    },
]


def prepare_multi_asset_dataset(
    symbols: List[str] = SYMBOLS,
    interval: str = INTERVAL_4H,
    data_root: Optional[Union[str, Path]] = None,
    max_date: str = "2026-10-31",
) -> pd.DataFrame:
    """
    Constructs the pooled multi-asset dataset:
    1. Loads OHLCV, funding rates, and open interest per symbol.
    2. Computes leak-free feature matrix (aligned with BTC benchmark).
    3. Identifies candidate breakout signals.
    4. Evaluates triple-barrier realized returns and target labels.
    """
    btc_df = load_market_dataset(BENCHMARK_SYMBOL, interval=interval, data_root=data_root, max_date=max_date)

    pooled_records = []

    for sym in symbols:
        df_sym = load_market_dataset(sym, interval=interval, data_root=data_root, max_date=max_date)
        features_df = build_swing_features(df_sym, btc_df, interval=interval)
        signals_df = generate_candidate_signals(df_sym, symbol=sym, cross_only=True)

        for _, sig in signals_df.iterrows():
            idx = int(sig["entry_idx"])
            if idx >= len(df_sym) - TIME_BARRIER_BARS:
                continue

            outcome = evaluate_single_trade_barriers(
                df=df_sym,
                entry_idx=idx,
                direction=int(sig["direction"]),
                stop_distance_pct=float(sig["stop_distance_pct"]),
                round_trip_friction_pct=ROUND_TRIP_FRICTION_PCT,
            )

            feat_dict = features_df.loc[idx, FEATURE_COLUMNS].to_dict()
            sig_dict = sig.to_dict()

            record = {**sig_dict, **outcome, **feat_dict}
            pooled_records.append(record)

    df_dataset = pd.DataFrame(pooled_records)
    if not df_dataset.empty:
        df_dataset["open_time"] = pd.to_datetime(df_dataset["open_time"], utc=True)
        df_dataset = df_dataset.sort_values("open_time").reset_index(drop=True)

    return df_dataset


def purge_training_set(
    df_train: pd.DataFrame,
    test_start_time: pd.Timestamp,
    embargo_bars: int = TIME_BARRIER_BARS,
    bar_interval_hours: int = 4,
) -> pd.DataFrame:
    """
    Purges trailing training trades whose outcome window touches or overlaps the test start time.
    """
    embargo_delta = pd.Timedelta(hours=embargo_bars * bar_interval_hours)
    cutoff = test_start_time - embargo_delta
    purged = df_train[df_train["open_time"] < cutoff].copy()
    return purged


def train_walk_forward_meta_classifier(
    df_dataset: pd.DataFrame,
    splits: List[Dict] = WALK_FORWARD_SPLITS,
    hyperparams: Optional[Dict] = None,
) -> Tuple[pd.DataFrame, Dict[str, float]]:
    """
    Executes expanding-window Purged Walk-Forward validation with LightGBM:
    Returns DataFrame containing all out-of-sample trades with 'meta_prob',
    and a dictionary of out-of-sample evaluation metrics.
    """
    if hyperparams is None:
        hyperparams = {
            "max_depth": 3,
            "num_leaves": 7,
            "learning_rate": 0.03,
            "n_estimators": 150,
            "min_child_samples": 30,
            "subsample": 0.80,
            "colsample_bytree": 0.80,
            "random_state": 42,
            "verbose": -1,
            "n_jobs": -1,
        }

    oos_results = []
    split_metrics = {}

    for split in splits:
        s_id = split["split_id"]
        t_start = pd.to_datetime(split["train_start"], utc=True)
        t_end = pd.to_datetime(split["train_end"], utc=True)
        v_start = pd.to_datetime(split["test_start"], utc=True)
        v_end = pd.to_datetime(split["test_end"], utc=True)

        raw_train = df_dataset[(df_dataset["open_time"] >= t_start) & (df_dataset["open_time"] <= t_end)]
        raw_test = df_dataset[(df_dataset["open_time"] >= v_start) & (df_dataset["open_time"] <= v_end)]

        if raw_test.empty:
            continue

        # Apply Purging to training set
        purged_train = purge_training_set(raw_train, test_start_time=v_start, embargo_bars=TIME_BARRIER_BARS)

        X_train = purged_train[FEATURE_COLUMNS].fillna(0.0)
        y_train = purged_train["label_y"].astype(int)

        X_test = raw_test[FEATURE_COLUMNS].fillna(0.0)
        y_test = raw_test["label_y"].astype(int)

        # Train regularized LightGBM meta-classifier
        clf = lgb.LGBMClassifier(**hyperparams)
        clf.fit(X_train, y_train)

        # Predict out-of-sample probabilities
        test_preds = clf.predict_proba(X_test)[:, 1]

        # Calculate fold AUC
        if len(np.unique(y_test)) > 1:
            fold_auc = float(roc_auc_score(y_test, test_preds))
        else:
            fold_auc = 0.50

        split_metrics[f"split_{s_id}_auc"] = fold_auc
        split_metrics[f"split_{s_id}_train_samples"] = len(purged_train)
        split_metrics[f"split_{s_id}_test_samples"] = len(raw_test)

        test_records = raw_test.copy()
        test_records["meta_prob"] = test_preds
        test_records["split_id"] = s_id
        oos_results.append(test_records)

    if not oos_results:
        return pd.DataFrame(), split_metrics

    df_oos = pd.concat(oos_results, axis=0).sort_values("open_time").reset_index(drop=True)

    # Pooled Out-of-Sample AUC
    if len(np.unique(df_oos["label_y"])) > 1:
        pooled_auc = float(roc_auc_score(df_oos["label_y"], df_oos["meta_prob"]))
    else:
        pooled_auc = 0.50

    split_metrics["pooled_oos_auc"] = pooled_auc
    split_metrics["total_oos_trades"] = len(df_oos)

    return df_oos, split_metrics


def export_production_model(
    output_dir: Optional[Union[str, Path]] = None,
    max_date: str = "2026-10-31",
    p_cutoff: float = 0.10,
    hyperparams: Optional[Dict] = None,
) -> Dict[str, Union[str, float, int]]:
    """
    Trains the final production LightGBM Meta-Classifier on all data up to max_date
    (holding post-max_date strictly out-of-sample) and exports:
    1. src/models/swing_4h/model.json (LightGBM decision trees and split thresholds)
    2. src/models/swing_4h/metadata.json (Feature definitions, scaling stats, p_cutoff, verification samples)
    """
    import json

    if output_dir is None:
        repo_dir = Path(__file__).resolve().parent.parent.parent
        output_dir = repo_dir / "src" / "models" / "swing_4h"
    else:
        output_dir = Path(output_dir)

    output_dir.mkdir(parents=True, exist_ok=True)

    if hyperparams is None:
        hyperparams = {
            "max_depth": 3,
            "num_leaves": 7,
            "learning_rate": 0.03,
            "n_estimators": 150,
            "min_child_samples": 30,
            "subsample": 0.80,
            "colsample_bytree": 0.80,
            "random_state": 42,
            "verbose": -1,
            "n_jobs": -1,
        }

    print(f"[EXPORT] Preparing multi-asset dataset up to {max_date}...")
    df_dataset = prepare_multi_asset_dataset(max_date=max_date)

    X = df_dataset[FEATURE_COLUMNS].replace([np.inf, -np.inf], np.nan).fillna(0.0)
    y = df_dataset["label_y"].astype(int)

    print(f"[EXPORT] Training LightGBM production meta-classifier on {len(X)} samples...")
    clf = lgb.LGBMClassifier(**hyperparams)
    clf.fit(X, y)

    # In-sample probability distribution and quantiles
    probs = clf.predict_proba(X)[:, 1]
    pct_75 = float(np.percentile(probs, 75))
    pct_80 = float(np.percentile(probs, 80))
    pct_90 = float(np.percentile(probs, 90))

    # Dump tree structure to model.json
    model_dump = clf.booster_.dump_model()
    model_json_path = output_dir / "model.json"
    with open(model_json_path, "w", encoding="utf-8") as f:
        json.dump(model_dump, f, indent=2)

    # Calculate feature summary statistics
    feature_stats = {}
    for col in FEATURE_COLUMNS:
        col_clean = X[col].replace([np.inf, -np.inf], np.nan).fillna(0.0)
        feature_stats[col] = {
            "mean": float(np.nan_to_num(col_clean.mean(), nan=0.0, posinf=0.0, neginf=0.0)),
            "std": float(np.nan_to_num(col_clean.std(), nan=1.0, posinf=1.0, neginf=1.0)) if float(col_clean.std()) > 0 else 1.0,
            "min": float(np.nan_to_num(col_clean.min(), nan=0.0, posinf=0.0, neginf=0.0)),
            "max": float(np.nan_to_num(col_clean.max(), nan=0.0, posinf=0.0, neginf=0.0)),
        }

    # Generate 5 verification samples for TypeScript unit tests
    verification_samples = []
    test_indices = [0, len(X) // 4, len(X) // 2, (3 * len(X)) // 4, len(X) - 1]
    for idx in test_indices:
        sample_row = X.iloc[idx].to_dict()
        verification_samples.append({
            "features": sample_row,
            "feature_array": [float(sample_row[c]) for c in FEATURE_COLUMNS],
            "expected_prob": float(probs[idx]),
        })

    metadata = {
        "model_name": "lgbm_meta_4h_swing",
        "training_max_date": max_date,
        "n_samples": len(X),
        "target_base_rate": float(y.mean()),
        "p_cutoff": float(p_cutoff),
        "percentile_75": pct_75,
        "percentile_80": pct_80,
        "percentile_90": pct_90,
        "num_trees": len(model_dump["tree_info"]),
        "feature_names": FEATURE_COLUMNS,
        "feature_stats": feature_stats,
        "verification_samples": verification_samples,
    }

    metadata_json_path = output_dir / "metadata.json"
    with open(metadata_json_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)

    print(f"[EXPORT] Successfully exported production model to {output_dir}:")
    print(f"  - model.json: {model_json_path.stat().st_size} bytes")
    print(f"  - metadata.json: {metadata_json_path.stat().st_size} bytes (P_cutoff={p_cutoff})")

    return {
        "model_json": str(model_json_path),
        "metadata_json": str(metadata_json_path),
        "samples": len(X),
        "p_cutoff": p_cutoff,
        "percentile_75": pct_75,
    }


if __name__ == "__main__":
    export_production_model()
