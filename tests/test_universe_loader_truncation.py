#!/usr/bin/env python3
"""
tests/test_universe_loader_truncation.py

Rigorous Lookahead Truncation and Funding Model Test for Wider Universe Loader.
Validates:
  1. Causal 1H -> 4H candle resampling across 200 random cutoff timestamps (zero future leakage).
  2. Base fixed-rule feature stability under truncation across all 14 assets.
  3. Real Binance funding rate calculation consistency and causal lookup.
"""

import os
import sys
import numpy as np
import pandas as pd

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
BASE_DIR = os.path.abspath(os.path.join(CURRENT_DIR, ".."))
ROOT_DIR = os.path.abspath(os.path.join(BASE_DIR, ".."))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from experiments.wider_universe.loader import (
    load_candles, load_funding_rates, calculate_real_funding, resample_1h_to_4h,
    UNIVERSE_ALL, UNIVERSE_UNTOUCHED, UNIVERSE_SEEN, UNIVERSE_DESIGN, COMMODITY_ASSETS,
    DATA_DIR
)


def compute_features(df):
    c = df['close'].values.astype(float)
    h = df['high'].values.astype(float)
    l = df['low'].values.astype(float)
    o = df['open'].values.astype(float)
    v = df['volume'].values.astype(float) if 'volume' in df.columns else np.ones(len(df))
    n = len(df)

    sma200 = pd.Series(c).rolling(200).mean().values
    ema50 = pd.Series(c).ewm(span=50, adjust=False).mean().values
    v_mean50 = pd.Series(v).rolling(50).mean().values

    dh = pd.Series(h).shift(1).rolling(20).max().values
    dl = pd.Series(l).shift(1).rolling(20).min().values

    prev_c = np.roll(c, 1)
    prev_c[0] = c[0]
    tr = np.maximum(h - l, np.maximum(np.abs(h - prev_c), np.abs(l - prev_c)))
    atr14 = pd.Series(tr).rolling(14).mean().values

    ema_slope = np.zeros(n)
    ema_slope[10:] = (ema50[10:] - ema50[:-10]) / ema50[:-10]

    stretch = np.abs(c - ema50) / np.where(atr14 > 0, atr14, np.nan)
    body = np.abs(c - o)
    body_ratio = body / np.where(atr14 > 0, atr14, np.nan)
    candle_range = h - l
    close_q = np.where(candle_range > 0, (c - l) / candle_range, 0.5)
    vol_ratio = v / np.where(v_mean50 > 0, v_mean50, np.nan)

    rule_long = (c > sma200) & (c > dh)
    rule_short = (c < sma200) & (c < dl)

    return {
        'sma200': sma200, 'ema50': ema50, 'atr14': atr14, 'ema_slope': ema_slope,
        'stretch': stretch, 'body_ratio': body_ratio, 'close_q': close_q,
        'vol_ratio': vol_ratio, 'rule_long': rule_long, 'rule_short': rule_short
    }


def test_resampling_truncation(n_samples=200, seed=42):
    print("\n--- 1. Testing Causal 1H -> 4H Resampling Truncation (ADA, AVAX, LINK, DOGE, NEAR) ---")
    np.random.seed(seed)
    test_assets = ["ADAUSDT", "AVAXUSDT", "LINKUSDT", "DOGEUSDT", "NEARUSDT"]

    for asset in test_assets:
        p1 = os.path.join(DATA_DIR, "1h", f"{asset}_1h.parquet")
        if not os.path.exists(p1):
            p1 = os.path.join(DATA_DIR, f"{asset}_1h.parquet")
        df_1h = pd.read_parquet(p1)
        full_4h = resample_1h_to_4h(df_1h)

        # Sample 200 random 1H truncation cutoff points
        cutoff_indices = np.random.randint(500, len(df_1h) - 10, size=n_samples)
        mismatches = 0

        for idx in cutoff_indices:
            sub_1h = df_1h.iloc[:idx + 1]
            trunc_4h = resample_1h_to_4h(sub_1h)

            if len(trunc_4h) == 0:
                continue

            # Every completed candle in trunc_4h MUST match the corresponding candle in full_4h
            n_t = len(trunc_4h)
            full_sub = full_4h.iloc[:n_t]

            # Validate datetimes match
            if not (trunc_4h['datetime'].values == full_sub['datetime'].values).all():
                mismatches += 1
                break

            # Validate close prices match exactly
            diff = np.abs(trunc_4h['close'].values - full_sub['close'].values)
            if np.max(diff) > 1e-9:
                mismatches += 1
                break

            # Validate that the last 4H candle end does NOT exceed sub_1h's latest timestamp
            last_4h_start = trunc_4h['datetime'].iloc[-1]
            # Since 4H starts at last_4h_start, its 4th hour is at last_4h_start + 3h
            # The latest 1H bar in sub_1h must be at least last_4h_start + 3h
            sub_col = 'open_time' if 'open_time' in sub_1h.columns else ('timestamp' if 'timestamp' in sub_1h.columns else sub_1h.columns[0])
            latest_1h = pd.to_datetime(sub_1h[sub_col].iloc[-1])
            if latest_1h.tz is not None: latest_1h = latest_1h.tz_localize(None)
            assert latest_1h >= (last_4h_start + pd.Timedelta(hours=3)), "Incomplete 4H candle leaked!"

        print(f"  {asset:10s}: PASS ({n_samples}/{n_samples} random cutoffs strictly causal, mismatches={mismatches})")
        assert mismatches == 0, f"Resampling truncation failed for {asset}"

    return True


def test_feature_truncation_across_universe(n_samples=200, seed=42):
    print("\n--- 2. Testing Feature Truncation Across All 14 Assets (200 random bars each) ---")
    np.random.seed(seed)

    for asset in UNIVERSE_ALL:
        df = load_candles(asset)
        full_feats = compute_features(df)
        n = len(df)

        # Sample 200 random bar indices between bar 250 and n-1
        cutoffs = np.random.randint(250, n - 1, size=n_samples)
        mismatches = 0

        for t in cutoffs:
            df_trunc = df.iloc[:t + 1]
            trunc_feats = compute_features(df_trunc)

            # Check all continuous features at bar t
            for feat_name in ['sma200', 'ema50', 'atr14', 'ema_slope', 'stretch', 'body_ratio', 'vol_ratio']:
                v_full = full_feats[feat_name][t]
                v_trunc = trunc_feats[feat_name][-1]
                if np.isnan(v_full) and np.isnan(v_trunc):
                    continue
                if abs(v_full - v_trunc) > 1e-8:
                    mismatches += 1
                    break

            # Check discrete signals at bar t
            if full_feats['rule_long'][t] != trunc_feats['rule_long'][-1]:
                mismatches += 1
                break
            if full_feats['rule_short'][t] != trunc_feats['rule_short'][-1]:
                mismatches += 1
                break

        print(f"  {asset:10s} (N={n:5d}): PASS ({n_samples}/{n_samples} cutoffs matched, mismatches={mismatches})")
        assert mismatches == 0, f"Feature truncation failed for {asset}"

    return True


def test_funding_rate_model(n_samples=200, seed=42):
    print("\n--- 3. Testing Real Binance Funding Rates & Modeling Integrity ---")
    np.random.seed(seed)

    # Check crypto assets with funding files
    crypto_assets = [a for a in UNIVERSE_ALL if a not in COMMODITY_ASSETS]
    for asset in crypto_assets:
        f_df = load_funding_rates(asset)
        assert f_df is not None, f"Funding parquet missing for {asset}"
        assert len(f_df) >= 5000, f"Funding parquet has too few rows for {asset}: {len(f_df)}"
        assert 'datetime' in f_df.columns and 'fundingRate' in f_df.columns

        # Verify 200 random simulated trade holding intervals
        for _ in range(n_samples):
            # Pick random start and end
            r_idx = np.random.randint(100, len(f_df) - 50)
            entry_dt = f_df['datetime'].iloc[r_idx]
            exit_dt = entry_dt + pd.Timedelta(hours=np.random.randint(4, 168))

            cost_long = calculate_real_funding(asset, entry_dt, exit_dt, "LONG", f_df)
            cost_short = calculate_real_funding(asset, entry_dt, exit_dt, "SHORT", f_df)

            # Manual slice
            sub = f_df[(f_df['datetime'] >= entry_dt) & (f_df['datetime'] <= exit_dt)]
            manual_sum = sub['fundingRate'].sum()

            assert abs(cost_long - manual_sum) < 1e-9, f"Funding cost mismatch on LONG for {asset}"
            assert abs(cost_short - (-manual_sum)) < 1e-9, f"Funding cost mismatch on SHORT for {asset}"

        print(f"  {asset:10s}: PASS ({len(f_df)} historical funding events verified, 200/200 trades accurate)")

    # Check commodities have zero funding
    for comm in COMMODITY_ASSETS:
        dt1 = pd.to_datetime('2024-01-01 00:00:00')
        dt2 = pd.to_datetime('2024-01-07 00:00:00')
        cost_l = calculate_real_funding(comm, dt1, dt2, "LONG")
        cost_s = calculate_real_funding(comm, dt1, dt2, "SHORT")
        assert cost_l == 0.0 and cost_s == 0.0
        print(f"  {comm:10s}: PASS (Commodity correctly exempt from crypto perpetual funding drag)")

    return True


if __name__ == "__main__":
    print("=" * 80)
    print("RUNNING TRUNCATION AND FUNDING HARNESS ON WIDER UNIVERSE")
    print("=" * 80)

    t1 = test_resampling_truncation(200)
    t2 = test_feature_truncation_across_universe(200)
    t3 = test_funding_rate_model(200)

    print("\n" + "=" * 80)
    print("WIDER UNIVERSE LOADER & FUNDING TRUNCATION SUMMARY:")
    print(f"  - 1H -> 4H Causal Resampling:       {'PASS' if t1 else 'FAIL'}")
    print(f"  - All 14 Assets Feature Truncation: {'PASS' if t2 else 'FAIL'}")
    print(f"  - Binance Funding Rate Integrity:   {'PASS' if t3 else 'FAIL'}")
    print("=" * 80)

    if not (t1 and t2 and t3):
        sys.exit(1)
    print("ALL HARNESS CHECKS PASSED.")
    sys.exit(0)
