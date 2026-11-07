#!/usr/bin/env python3
"""
Institutional Retraining & Feature Expansion of Stage 2 ML Meta-Model
Trader-Pro Quant Architecture

Invariants & Governance:
1. Invariant SHA-256 for src/lib/paperExecutor1HA.ts must NEVER change:
   C1DE3359D29A4B4C6BFB3662A65C2ABF5DD4001052BDF6CAA1A7AA50FB8B33A8
2. Zero lookahead: Features strictly evaluated at t-1 candle close.
3. Realistic friction: 5 bps + 18% GST (0.059% round-trip) on Commodities.
4. Purged Walk-Forward Splits: Trailing 12 bars purged between folds.
5. Objective Function: Score = Total Net R - 0.2 * |Max Drawdown R|
"""

import os
import sys
import json
import math
import time
import datetime
from pathlib import Path
from typing import Dict, List, Any, Tuple

import numpy as np
import pandas as pd
import lightgbm as lgb
from sklearn.metrics import roc_auc_score

# Windows console encoding
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

ROOT_DIR = Path("D:/Projects_Main/Trade-Pro/Trader-Pro-Dashboard")
DATA_DIR = ROOT_DIR / "data"
MODELS_DIR = ROOT_DIR / "src" / "models" / "swing_1h_commodities"
RESEARCH_DIR = ROOT_DIR / "research"

COMMODITY_SYMBOLS = ["GC=F", "SI=F", "CL=F"]
BENCHMARK_SYMBOL = "DX-Y.NYB"
COMMODITY_FRICTION = 0.00059  # 5 bps + 18% GST
TIME_BARRIER_BARS = 24        # 24 1H bars
UPPER_BARRIER_R = 2.0         # +2.0R target profit
LOWER_BARRIER_R = -1.0        # -1.0R initial stop loss

FEATURE_NAMES = [
    'feat_dxy_mom_24h',
    'feat_dxy_mom_72h',
    'feat_dxy_corr_60',
    'feat_vol_zscore',
    'feat_volatility_ratio',
    'feat_atr_pct',
    'feat_donchian_pos',
    'feat_trend_dist_200',
]


def load_and_prepare_commodities_data() -> Tuple[Dict[str, pd.DataFrame], pd.DataFrame]:
    """Loads commodity parquets and merges DXY benchmark."""
    dxy_path = DATA_DIR / "DXY_1h.parquet"
    if not dxy_path.exists():
        raise FileNotFoundError(f"Missing {dxy_path}")
    dxy_df = pd.read_parquet(dxy_path)
    dxy_df.index = pd.to_datetime(dxy_df.index, utc=True)
    dxy_ref = dxy_df[['close']].rename(columns={'close': 'dxy_close'}).sort_index()

    commodity_dfs = {}
    for s in COMMODITY_SYMBOLS:
        fname = s.replace("=", "_") + "_1h.parquet"
        p = DATA_DIR / fname
        if not p.exists():
            raise FileNotFoundError(f"Missing {p}")
        df = pd.read_parquet(p)
        time_col = [c for c in df.columns if 'time' in c.lower() or 'date' in c.lower()][0]
        df['datetime'] = pd.to_datetime(df[time_col], utc=True)
        df = df.set_index('datetime').sort_index()
        for col in ['open', 'high', 'low', 'close', 'volume']:
            df[col] = df[col].astype(float)

        # Merge DXY benchmark
        merged = pd.merge_asof(
            df, dxy_ref,
            left_index=True, right_index=True,
            direction='backward'
        )
        merged['dxy_close'] = merged['dxy_close'].ffill()
        merged['symbol'] = s
        commodity_dfs[s] = merged
        print(f"  Loaded {s}: {len(merged)} 1H bars ({merged.index.min().date()} to {merged.index.max().date()})")

    return commodity_dfs, dxy_ref


def extract_candidate_breakouts_and_features(commodity_dfs: Dict[str, pd.DataFrame]) -> pd.DataFrame:
    """Extracts candidate breakouts and computes 8 institutional features strictly lagged at t-1."""
    all_candidates = []

    for s, df_raw in commodity_dfs.items():
        df = df_raw.copy().reset_index()
        c = df['close']
        h = df['high']
        l = df['low']
        v = df['volume']
        dxy_c = df['dxy_close']

        # Trend & Channel definitions (evaluated at completed t-1 close)
        df['sma_200'] = c.rolling(200, min_periods=50).mean().shift(1)
        df['high_20'] = h.rolling(20, min_periods=10).max().shift(1)
        df['low_20'] = l.rolling(20, min_periods=10).min().shift(1)
        df['sma_20'] = c.rolling(20, min_periods=10).mean().shift(1)
        df['stop_low_10'] = l.rolling(10, min_periods=5).min().shift(1)
        df['stop_high_10'] = h.rolling(10, min_periods=5).max().shift(1)

        # 1. Macro DXY features strictly lagged t-1
        dxy_s1 = dxy_c.shift(1)
        df['feat_dxy_mom_24h'] = ((dxy_s1 / dxy_c.shift(25)) - 1.0).clip(-0.1, 0.1)
        df['feat_dxy_mom_72h'] = ((dxy_s1 / dxy_c.shift(73)) - 1.0).clip(-0.15, 0.15)

        # 60-period rolling correlation
        comm_ret = np.log(c / c.shift(1))
        dxy_ret = np.log(dxy_c / dxy_c.shift(1))
        df['feat_dxy_corr_60'] = comm_ret.rolling(60).corr(dxy_ret).shift(1).fillna(-0.20).clip(-1.0, 1.0)

        # 2. Volume Z-Score relative to 20-period average
        v_s1 = v.shift(1)
        v_mean = v_s1.rolling(20, min_periods=5).mean()
        v_std = v_s1.rolling(20, min_periods=5).std().replace(0, np.nan)
        df['feat_vol_zscore'] = ((v_s1 - v_mean) / (v_std + 1e-8)).clip(-4.0, 4.0).fillna(0.0)

        # 3. Volatility Ratio (ATR14 / ATR50)
        tr = pd.concat([h - l, (h - c.shift(1)).abs(), (l - c.shift(1)).abs()], axis=1).max(axis=1)
        atr14 = tr.rolling(14, min_periods=5).mean().shift(1)
        atr50 = tr.rolling(50, min_periods=15).mean().shift(1)
        df['feat_volatility_ratio'] = (atr14 / (atr50 + 1e-8)).clip(0.2, 5.0).fillna(1.0)

        # 4. Normalized ATR pct
        df['feat_atr_pct'] = (atr14 / (c.shift(1) + 1e-8)).clip(0.001, 0.08).fillna(0.005)

        # 5. Donchian Position / Breakout Velocity
        donch_rng = (df['high_20'] - df['low_20']).replace(0, np.nan)
        df['feat_donchian_pos'] = ((c.shift(1) - df['sma_20']) / (donch_rng + 1e-8)).clip(-2.0, 2.0).fillna(0.0)

        # 6. Trend Distance / Elastic Stretch from 200 SMA
        df['feat_trend_dist_200'] = ((c.shift(1) - df['sma_200']) / (df['sma_200'] + 1e-8)).clip(-0.3, 0.3).fillna(0.0)

        # Breakout Entry Signal
        is_long = (c > df['sma_200']) & (c > df['high_20'])
        is_short = (c < df['sma_200']) & (c < df['low_20'])
        cand_indices = df.index[is_long | is_short].tolist()

        n_bars = len(df)
        for idx in cand_indices:
            if idx < 200 or idx >= n_bars - TIME_BARRIER_BARS:
                continue
            row = df.iloc[idx]
            entry_p = float(row['close'])
            direction = 1 if is_long.iloc[idx] else -1

            raw_dist = (entry_p - float(row['stop_low_10'])) / entry_p if direction == 1 else (float(row['stop_high_10']) - entry_p) / entry_p
            clamped_dist = float(np.clip(raw_dist, 0.010, 0.040))  # Clamped [1.0%, 4.0%]

            entry_time = row['datetime']
            all_candidates.append({
                'symbol': s,
                'idx': idx,
                'entry_time': entry_time,
                'direction': direction,
                'entry_price': entry_p,
                'stop_dist_pct': clamped_dist,
                **{f: float(row[f]) for f in FEATURE_NAMES}
            })

    df_cand = pd.DataFrame(all_candidates).sort_values('entry_time').reset_index(drop=True)
    return df_cand


def apply_triple_barrier_labeling(df_cand: pd.DataFrame, commodity_dfs: Dict[str, pd.DataFrame]) -> pd.DataFrame:
    """Applies Triple-Barrier labeling with realistic taker friction."""
    labeled = []

    for _, row in df_cand.iterrows():
        s = row['symbol']
        df = commodity_dfs[s].reset_index(drop=True)
        idx = int(row['idx'])
        direction = int(row['direction'])
        entry_p = float(row['entry_price'])
        stop_dist = float(row['stop_dist_pct'])

        stop_p = entry_p * (1.0 - stop_dist) if direction == 1 else entry_p * (1.0 + stop_dist)
        tp_p = entry_p * (1.0 + UPPER_BARRIER_R * stop_dist) if direction == 1 else entry_p * (1.0 - UPPER_BARRIER_R * stop_dist)

        fw_highs = df['high'].iloc[idx+1 : idx+1+TIME_BARRIER_BARS].values
        fw_lows = df['low'].iloc[idx+1 : idx+1+TIME_BARRIER_BARS].values
        fw_closes = df['close'].iloc[idx+1 : idx+1+TIME_BARRIER_BARS].values

        cost_r = COMMODITY_FRICTION / stop_dist
        exit_r = 0.0
        exit_type = "TIME"
        label_y = 0

        for k in range(len(fw_highs)):
            h_k, l_k = fw_highs[k], fw_lows[k]
            touch_tp = (h_k >= tp_p) if direction == 1 else (l_k <= tp_p)
            touch_sl = (l_k <= stop_p) if direction == 1 else (h_k >= stop_p)

            # Invariant: Simultaneous collision booked strictly as STOP LOSS
            if touch_tp and touch_sl:
                exit_r = LOWER_BARRIER_R
                exit_type = "COLLISION_STOP"
                break
            elif touch_tp:
                exit_r = UPPER_BARRIER_R
                exit_type = "TARGET"
                break
            elif touch_sl:
                exit_r = LOWER_BARRIER_R
                exit_type = "STOP"
                break

        if exit_type == "TIME":
            c_end = fw_closes[-1] if len(fw_closes) > 0 else entry_p
            unrealized_pct = (c_end - entry_p) / entry_p if direction == 1 else (entry_p - c_end) / entry_p
            exit_r = unrealized_pct / stop_dist

        net_r = exit_r - cost_r
        # Binary target: y = 1 if Net R >= +1.0R (meaningful trend continuation)
        label_y = 1 if net_r >= 1.0 else 0

        item = row.to_dict()
        item.update({
            'gross_r': exit_r,
            'cost_r': cost_r,
            'net_r': net_r,
            'exit_type': exit_type,
            'y': label_y
        })
        labeled.append(item)

    df_labeled = pd.DataFrame(labeled)
    df_labeled['entry_time'] = pd.to_datetime(df_labeled['entry_time'], utc=True)
    return df_labeled.sort_values('entry_time').reset_index(drop=True)


def run_purged_walk_forward_cv(
    df_labeled: pd.DataFrame,
    hyperparams: Dict[str, Any]
) -> Tuple[pd.DataFrame, float]:
    """Runs expanding Purged Walk-Forward CV and generates out-of-sample prediction probabilities."""
    min_date = df_labeled['entry_time'].min()
    max_date = df_labeled['entry_time'].max()

    # Define expanding Walk-Forward splits
    # Hold out the final unseen test window (2026-10-21 onwards) strictly unseen
    cv_end_date = pd.to_datetime("2026-10-21 00:00:00", utc=True)
    df_cv = df_labeled[df_labeled['entry_time'] < cv_end_date].copy()

    split1_test = pd.to_datetime("2025-06-01 00:00:00", utc=True)
    split2_test = pd.to_datetime("2026-01-01 00:00:00", utc=True)

    splits = [
        {
            'name': 'Fold 1',
            'train_start': min_date,
            'train_end': split1_test - pd.Timedelta(hours=24),  # 24h Purging
            'test_start': split1_test,
            'test_end': split2_test - pd.Timedelta(hours=1),
        },
        {
            'name': 'Fold 2',
            'train_start': min_date,
            'train_end': split2_test - pd.Timedelta(hours=24),  # 24h Purging
            'test_start': split2_test,
            'test_end': cv_end_date,
        }
    ]

    oos_dfs = []
    for sp in splits:
        tr_mask = (df_cv['entry_time'] >= sp['train_start']) & (df_cv['entry_time'] <= sp['train_end'])
        te_mask = (df_cv['entry_time'] >= sp['test_start']) & (df_cv['entry_time'] <= sp['test_end'])

        X_tr = df_cv.loc[tr_mask, FEATURE_NAMES].fillna(0.0)
        y_tr = df_cv.loc[tr_mask, 'y']
        X_te = df_cv.loc[te_mask, FEATURE_NAMES].fillna(0.0)
        test_slice = df_cv.loc[te_mask].copy()

        if len(X_te) == 0 or len(y_tr.unique()) <= 1:
            continue

        clf = lgb.LGBMClassifier(**hyperparams)
        clf.fit(X_tr, y_tr)
        test_slice['meta_prob'] = clf.predict_proba(X_te)[:, 1]
        test_slice['fold'] = sp['name']
        oos_dfs.append(test_slice)

    if not oos_dfs:
        raise ValueError("No OOS results produced")

    df_oos = pd.concat(oos_dfs, axis=0).sort_values('entry_time').reset_index(drop=True)
    oos_auc = roc_auc_score(df_oos['y'], df_oos['meta_prob'])
    return df_oos, float(oos_auc)


def sweep_cutoff_thresholds(df_oos: pd.DataFrame) -> Tuple[float, pd.DataFrame]:
    """Sweeps candidate tau in [0.040, 0.080] in steps of 0.0025 on OOS validation trades."""
    thresholds = [round(t, 4) for t in np.arange(0.040, 0.0805, 0.0025)]
    results = []

    for tau in thresholds:
        admitted = df_oos[df_oos['meta_prob'] >= tau].copy()
        n_trades = len(admitted)
        if n_trades == 0:
            continue

        net_r_total = float(admitted['net_r'].sum())
        wins = admitted[admitted['net_r'] > 0]
        losses = admitted[admitted['net_r'] <= 0]
        wr = (len(wins) / n_trades) * 100.0

        gross_win = float(wins['gross_r'].sum())
        gross_loss = abs(float(losses['gross_r'].sum()))
        pf = (gross_win / gross_loss) if gross_loss > 0 else (999.0 if gross_win > 0 else 1.0)

        # Cumulative drawdown in R
        cumsum = admitted['net_r'].cumsum()
        peak = cumsum.cummax()
        dd = cumsum - peak
        max_dd = float(dd.min()) if len(dd) > 0 else 0.0

        # Ratified Objective Score: Total Net R - 0.2 * |Max DD R|
        score = net_r_total - 0.2 * abs(max_dd)

        # Asset breakdown for validation
        n_gc = len(admitted[admitted['symbol'] == 'GC=F'])
        n_si = len(admitted[admitted['symbol'] == 'SI=F'])
        n_cl = len(admitted[admitted['symbol'] == 'CL=F'])

        results.append({
            'tau': tau,
            'trades': n_trades,
            'wr': wr,
            'net_r': net_r_total,
            'max_dd': max_dd,
            'pf': pf,
            'score': score,
            'trades_gc': n_gc,
            'trades_si': n_si,
            'trades_cl': n_cl,
        })

    df_sweep = pd.DataFrame(results)
    best_row = df_sweep.loc[df_sweep['score'].idxmax()]
    best_tau = float(best_row['tau'])
    return best_tau, df_sweep


def train_production_model_and_export(
    df_labeled: pd.DataFrame,
    hyperparams: Dict[str, Any],
    p_cutoff: float
) -> Dict[str, Any]:
    """Trains final model up to October 2026 and exports model.json + metadata.json."""
    # Data up to October 21, 2026 (holding unseen window out)
    cv_end_date = pd.to_datetime("2026-10-21 00:00:00", utc=True)
    df_train = df_labeled[df_labeled['entry_time'] < cv_end_date].copy()

    X_train = df_train[FEATURE_NAMES].fillna(0.0)
    y_train = df_train['y']

    clf = lgb.LGBMClassifier(**hyperparams)
    clf.fit(X_train, y_train)

    # In-sample probability distribution
    probs = clf.predict_proba(X_train)[:, 1]
    q75 = float(np.percentile(probs, 75))
    q80 = float(np.percentile(probs, 80))
    q90 = float(np.percentile(probs, 90))

    # Dump trees
    model_dump = clf.booster_.dump_model()

    # Feature statistics
    feature_stats = {}
    for col in FEATURE_NAMES:
        feature_stats[col] = {
            'mean': float(X_train[col].mean()),
            'std': float(X_train[col].std()) if float(X_train[col].std()) > 0 else 1.0,
            'min': float(X_train[col].min()),
            'max': float(X_train[col].max())
        }

    # Generate 5 fresh verification samples for TypeScript
    verification_samples = []
    test_indices = [0, len(X_train) // 4, len(X_train) // 2, (3 * len(X_train)) // 4, len(X_train) - 1]
    for idx in test_indices:
        row_dict = X_train.iloc[idx].to_dict()
        verification_samples.append({
            'features': row_dict,
            'feature_array': [float(row_dict[c]) for c in FEATURE_NAMES],
            'expected_prob': float(probs[idx]),
        })

    metadata = {
        'model_name': 'lgbm_meta_1h_macro_commodities',
        'asset_class': 'commodities',
        'timeframe': '1h',
        'universe': COMMODITY_SYMBOLS,
        'benchmark': BENCHMARK_SYMBOL,
        'n_samples': len(X_train),
        'target_base_rate': float(y_train.mean()),
        'p_cutoff': p_cutoff,
        'percentile_75': q75,
        'percentile_80': q80,
        'percentile_90': q90,
        'friction_bps': 5.0,
        'num_trees': len(model_dump.get('tree_info', [])),
        'feature_names': FEATURE_NAMES,
        'feature_stats': feature_stats,
        'verification_samples': verification_samples,
        'calibration_protocol': 'OOS Expectancy Score Maximization (Score = Net R - 0.2 * |Max DD|)',
    }

    # Write files to src/models/swing_1h_commodities
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    model_json_path = MODELS_DIR / "model.json"
    metadata_json_path = MODELS_DIR / "metadata.json"

    with open(model_json_path, "w", encoding="utf-8") as f:
        json.dump(model_dump, f, indent=2)

    with open(metadata_json_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)

    return {
        'model': clf,
        'metadata': metadata,
        'model_json_path': str(model_json_path),
        'metadata_json_path': str(metadata_json_path),
        'num_trees': len(model_dump.get('tree_info', [])),
        'n_samples': len(X_train),
    }


def evaluate_on_live_unseen_window(
    clf: lgb.LGBMClassifier,
    p_cutoff: float,
    commodity_dfs: Dict[str, pd.DataFrame]
) -> Dict[str, Any]:
    """Evaluates the retrained model on the 17-day live unseen window (Oct 21 - Nov 7)."""
    # Load live prediction logs
    logs_path = ROOT_DIR / "src" / "data" / "live_unseen_prediction_logs.json"
    with open(logs_path, "r", encoding="utf-8") as f:
        logs = json.load(f)

    # Extract breakout logs
    breakout_logs = [
        e for e in logs
        if e.get("decision") == "EXECUTED_TRADE" or "rejected by AI meta-classifier" in e.get("decision_reason", "")
    ]

    import audit_79_breakouts as ab
    base_results = ab.all_results

    # Evaluate each breakout event
    old_trades = []
    new_trades = []

    for i, bo in enumerate(breakout_logs):
        if i >= len(base_results):
            break
        res = base_results[i]
        sym = bo["symbol"]
        is_comm = "=F" in sym
        old_prob = bo["probability"]

        # Predict with new model if commodity
        if is_comm:
            feats = bo.get("features", [])
            if len(feats) == len(FEATURE_NAMES):
                new_prob = float(clf.predict_proba([feats])[0, 1])
            else:
                new_prob = old_prob
        else:
            new_prob = old_prob

        # Old Model decision (p_cutoff = 0.0635 for commodities, 0.10 for crypto)
        old_cutoff = 0.0635 if is_comm else 0.10
        if old_prob >= old_cutoff:
            old_trades.append({**res, 'symbol': sym, 'prob': old_prob})

        # New Model decision (calibrated p_cutoff)
        new_cutoff = p_cutoff if is_comm else 0.10
        if new_prob >= new_cutoff:
            new_trades.append({**res, 'symbol': sym, 'prob': new_prob})

    def calc_metrics(trades: List[Dict]) -> Dict[str, Any]:
        n = len(trades)
        if n == 0:
            return {'n': 0, 'wr': 0.0, 'net_r': 0.0, 'max_dd': 0.0, 'pf': 1.0}
        net_r = sum(t['net_r'] for t in trades)
        wins = [t for t in trades if t['net_r'] > 0]
        losses = [t for t in trades if t['net_r'] <= 0]
        wr = (len(wins) / n) * 100.0

        gross_win = sum(t['gross_r'] for t in wins)
        gross_loss = abs(sum(t['gross_r'] for t in losses))
        pf = (gross_win / gross_loss) if gross_loss > 0 else (999.0 if gross_win > 0 else 1.0)

        cumsum = pd.Series([t['net_r'] for t in trades]).cumsum()
        peak = cumsum.cummax()
        dd = cumsum - peak
        max_dd = float(dd.min()) if len(dd) > 0 else 0.0

        return {
            'n': n,
            'wr': wr,
            'net_r': net_r,
            'max_dd': max_dd,
            'pf': pf,
            'wins': len(wins),
            'losses': len(losses)
        }

    return {
        'old_model': calc_metrics(old_trades),
        'new_model': calc_metrics(new_trades),
        'new_trades_list': new_trades,
    }


def main():
    print("=" * 80)
    print("INSTITUTIONAL RETRAINING OF STAGE 2 LIGHTGBM META-MODEL")
    print("=" * 80)

    # 1. Load data
    print("\n[STEP 1] Ingesting multi-asset parquets and DXY reference...")
    commodity_dfs, dxy_ref = load_and_prepare_commodities_data()

    # 2. Extract signals and features
    print("\n[STEP 2] Extracting candidate breakouts and computing 8 institutional features...")
    df_cand = extract_candidate_breakouts_and_features(commodity_dfs)
    print(f"  Extracted {len(df_cand)} candidate breakout setups across GC=F, SI=F, CL=F.")

    # 3. Apply Triple-Barrier Labeling
    print("\n[STEP 3] Applying Triple-Barrier labeling (TP=+2.0R, SL=-1.0R, 24h barrier, 5 bps friction)...")
    df_labeled = apply_triple_barrier_labeling(df_cand, commodity_dfs)
    pos_rate = df_labeled['y'].mean() * 100.0
    print(f"  Total labeled trade setups: {len(df_labeled)} (Positive rate: {pos_rate:.1f}%)")

    # 4. Purged Walk-Forward Cross-Validation
    print("\n[STEP 4] Executing Purged Walk-Forward CV (Expanding Windows + 24h Embargo)...")
    hyperparams = {
        'max_depth': 3,
        'num_leaves': 7,
        'learning_rate': 0.03,
        'n_estimators': 100,  # 100 decision trees strictly invariant
        'min_child_samples': 30,
        'subsample': 0.80,
        'colsample_bytree': 0.80,
        'random_state': 42,
        'verbose': -1,
        'n_jobs': -1,
    }
    df_oos, oos_auc = run_purged_walk_forward_cv(df_labeled, hyperparams)
    print(f"  Pooled Out-of-Sample ROC-AUC: {oos_auc:.4f} across {len(df_oos)} OOS trades.")

    # 5. Threshold Calibration on OOS Folds
    print("\n[STEP 5] Sweeping candidate thresholds tau in [0.040, 0.080] on OOS validation trades...")
    print("  Objective Function: Score = Total Net R - 0.2 * |Max DD R|")
    best_tau, df_sweep = sweep_cutoff_thresholds(df_oos)
    print(f"\n  Threshold Sweep Results (Top 5):")
    top5 = df_sweep.sort_values('score', ascending=False).head(5)
    for _, r in top5.iterrows():
        print(f"    tau={r['tau']:.4f} | Trades={int(r['trades']):3d} | WR={r['wr']:.1f}% | Net R={r['net_r']:+6.2f}R | MaxDD={r['max_dd']:5.2f}R | PF={r['pf']:.2f} | Score={r['score']:+6.2f}")

    print(f"\n  --> Calibrated Optimal Cutoff Threshold: tau* = {best_tau:.4f}")

    # 6. Production Model Retraining & Export
    print(f"\n[STEP 6] Retraining final production LightGBM on all data up to Oct 2026...")
    export_info = train_production_model_and_export(df_labeled, hyperparams, p_cutoff=best_tau)
    print(f"  Model Export Complete:")
    print(f"    - Trees: {export_info['num_trees']}")
    print(f"    - Training Samples: {export_info['n_samples']}")
    print(f"    - p_cutoff: {best_tau}")
    print(f"    - model.json: {export_info['model_json_path']}")
    print(f"    - metadata.json: {export_info['metadata_json_path']}")

    # 7. Evaluate on Live Unseen Window (Oct 21 - Nov 7)
    print(f"\n[STEP 7] Evaluating against live unseen window (Oct 21 - Nov 7, 2026)...")
    eval_res = evaluate_on_live_unseen_window(export_info['model'], best_tau, commodity_dfs)

    old_m = eval_res['old_model']
    new_m = eval_res['new_model']

    print("\n" + "=" * 80)
    print("EXECUTIVE PERFORMANCE COMPARISON: OLD MODEL vs RETRAINED MODEL")
    print("=" * 80)
    print(f"{'Metric':<25} | {'Old Model (tau=0.0635)':<22} | {'New Retrained (tau*=' + f'{best_tau:.4f})':<22}")
    print("-" * 75)
    print(f"{'Total Executed Trades':<25} | {old_m['n']:<22d} | {new_m['n']:<22d}")
    print(f"{'Win Rate (%)':<25} | {old_m['wr']:<21.1f}% | {new_m['wr']:<21.1f}%")
    print(f"{'Total Net Return (R)':<25} | {old_m['net_r']:<+21.2f}R | {new_m['net_r']:<+21.2f}R")
    print(f"{'Max Drawdown (R)':<25} | {old_m['max_dd']:<21.2f}R | {new_m['max_dd']:<21.2f}R")
    print(f"{'Profit Factor':<25} | {old_m['pf']:<22.2f} | {new_m['pf']:<22.2f}")
    print("=" * 80)


if __name__ == "__main__":
    main()
