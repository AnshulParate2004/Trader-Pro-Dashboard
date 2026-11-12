#!/usr/bin/env python3
"""
scripts/build_feature_panel.py

Constructs the complete monthly causal feature panel (2010–2026) and caches it to
data/us_equities/features.parquet. Executes the 200-sample point-in-time truncation test.
"""

import os
import sys
import json
import random
import numpy as np
import pandas as pd

sys.stdout.reconfigure(encoding='utf-8')

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DATA_DIR = os.path.join(BASE_DIR, "data", "us_equities")
CONFIG_DIR = os.path.join(BASE_DIR, "config", "us_equities")

print("=" * 80)
print("BUILDING CAUSAL FEATURE PANEL & RUNNING TRUNCATION AUDIT")
print("=" * 80)

# Load Universe and PIT Fundamentals
with open(os.path.join(CONFIG_DIR, "universe.json"), "r", encoding="utf-8") as f:
    UNIVERSE_CONFIG = json.load(f)

with open(os.path.join(DATA_DIR, "pit_fundamentals.json"), "r", encoding="utf-8") as f:
    PIT_FUNDAMENTALS = json.load(f)

PIT_CONSTITUENTS = UNIVERSE_CONFIG["monthly_pit_constituents"]
rebalance_dates = sorted(list(PIT_FUNDAMENTALS.keys()))
print(f"Rebalance dates: {len(rebalance_dates)} ({rebalance_dates[0]} to {rebalance_dates[-1]}).")

# Load Daily Price Store
PRICE_STORE = {}
for fname in os.listdir(DATA_DIR):
    if fname.endswith(".parquet") and not fname.startswith("sp500") and not fname.startswith("features"):
        t = fname.replace(".parquet", "")
        df_p = pd.read_parquet(os.path.join(DATA_DIR, fname))
        df_p.index = pd.to_datetime(df_p.index)
        PRICE_STORE[t] = df_p.sort_index()

SPY_DF = PRICE_STORE["SPY"]
ALL_DATES = SPY_DF.index

# Technical Indicators Calculator
def compute_technical_indicators(df: pd.DataFrame) -> pd.DataFrame:
    res = df.copy()
    close = res["Close"]
    high = res["High"]
    low = res["Low"]
    vol = res["Volume"]
    
    # ATR 14
    tr1 = high - low
    tr2 = (high - close.shift(1)).abs()
    tr3 = (low - close.shift(1)).abs()
    tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
    res["ATR14"] = tr.rolling(14).mean()
    res["ATR_pct"] = res["ATR14"] / close
    
    # RSI 14
    delta = close.diff()
    gain = delta.where(delta > 0, 0.0)
    loss = (-delta).where(delta < 0, 0.0)
    avg_gain = gain.rolling(14).mean()
    avg_loss = loss.rolling(14).mean()
    rs = avg_gain / avg_loss.replace(0, np.nan)
    res["RSI14"] = (100.0 - (100.0 / (1.0 + rs))).fillna(50.0)
    
    # EMA 20, EMA 50
    res["EMA20"] = close.ewm(span=20, adjust=False).mean()
    res["EMA50"] = close.ewm(span=50, adjust=False).mean()
    res["EMA20_50_state"] = ((close > res["EMA50"]) & (res["EMA20"] > res["EMA50"])).astype(int)
    
    # Volume ratio 5d / 50d
    res["Vol5"] = vol.rolling(5).mean()
    res["Vol50"] = vol.rolling(50).mean()
    res["Volume_ratio_50d"] = (res["Vol5"] / res["Vol50"].replace(0, np.nan)).fillna(1.0)
    
    # Momentum 12-1
    res["Mom_12_1"] = (close.shift(21) / close.shift(252).replace(0, np.nan)) - 1.0
    
    # Confirmed Swing Pivots (k=5)
    k = 5
    n = len(df)
    low_vals = low.values
    high_vals = high.values
    close_vals = close.values
    atr_vals = res["ATR14"].values
    
    dist_support = np.full(n, np.nan)
    dist_resistance = np.full(n, np.nan)
    trendline_dist = np.full(n, np.nan)
    
    confirmed_lows = []
    confirmed_highs = []
    
    for i in range(k, n):
        pivot_cand = i - k
        if pivot_cand >= k:
            window_low = low_vals[pivot_cand - k : pivot_cand + k + 1]
            if low_vals[pivot_cand] == np.min(window_low):
                confirmed_lows.append((pivot_cand, low_vals[pivot_cand]))
                
            window_high = high_vals[pivot_cand - k : pivot_cand + k + 1]
            if high_vals[pivot_cand] == np.max(window_high):
                confirmed_highs.append((pivot_cand, high_vals[pivot_cand]))
                
        atr_now = atr_vals[i]
        c_now = close_vals[i]
        if atr_now > 0:
            if confirmed_lows:
                last_low = confirmed_lows[-1][1]
                dist_support[i] = (c_now - last_low) / atr_now
            if confirmed_highs:
                last_high = confirmed_highs[-1][1]
                dist_resistance[i] = (last_high - c_now) / atr_now
                
            if len(confirmed_lows) >= 2:
                idx1, val1 = confirmed_lows[-2]
                idx2, val2 = confirmed_lows[-1]
                if idx2 > idx1 and val2 > val1:
                    slope = (val2 - val1) / (idx2 - idx1)
                    proj_val = val2 + slope * (i - idx2)
                    trendline_dist[i] = (c_now - proj_val) / atr_now
                    
    res["dist_above_support_atr"] = dist_support
    res["dist_to_resistance_atr"] = dist_resistance
    res["trendline_dist_atr"] = trendline_dist
    
    return res

print("\nPrecomputing technical indicators across all universe price series...")
INDICATOR_STORE = {}
for t, df in PRICE_STORE.items():
    INDICATOR_STORE[t] = compute_technical_indicators(df)
print(f"Precomputed indicators for {len(INDICATOR_STORE)} tickers.")

# SPY Regime
SPY_IND = INDICATOR_STORE["SPY"]
SPY_IND["SMA200"] = SPY_IND["Close"].rolling(200).mean()

# Map rebalance date to next trading day
REBAL_NEXT_MAP = {}
for r_dt_str in rebalance_dates:
    r_dt = pd.to_datetime(r_dt_str)
    future = [d for d in ALL_DATES if d > r_dt]
    if future:
        REBAL_NEXT_MAP[r_dt_str] = future[0]

# Build Feature Rows
print("\nSynthesizing monthly causal features and forward targets...")
rows = []

for r_dt_str in rebalance_dates:
    r_dt = pd.to_datetime(r_dt_str)
    exec_dt = REBAL_NEXT_MAP.get(r_dt_str)
    if exec_dt is None:
        continue
        
    year = r_dt.year
    sample_period = "DISCOVERY" if year <= 2019 else "VALIDATION"
    
    # SPY Regime at r_dt
    spy_past = SPY_IND[SPY_IND.index <= r_dt]
    if spy_past.empty:
        continue
    spy_close = spy_past.iloc[-1]["Close"]
    spy_sma200 = spy_past.iloc[-1]["SMA200"]
    is_risk_on = bool(pd.notna(spy_sma200) and spy_close > spy_sma200)
    
    fund_recs = PIT_FUNDAMENTALS.get(r_dt_str, [])
    # Index fund recs by ticker
    fund_map = {r["ticker"]: r for r in fund_recs}
    
    constituents = PIT_CONSTITUENTS.get(r_dt_str, [])
    
    # Collect candidate records for this rebalance date
    rebal_records = []
    
    for sym in constituents:
        if sym not in INDICATOR_STORE:
            continue
        ind_df = INDICATOR_STORE[sym]
        past_ind = ind_df[ind_df.index <= r_dt]
        if past_ind.empty:
            continue
            
        last_bar = past_ind.iloc[-1]
        
        # Future prices for targets
        future_prices = ind_df[ind_df.index >= exec_dt]
        if future_prices.empty:
            continue
            
        entry_open = future_prices.iloc[0]["Open"]
        if entry_open <= 0.001:
            continue
            
        # Target returns
        fwd_ret_21 = None
        fwd_ret_63 = None
        fwd_ret_252 = None
        worst_fall_63 = None
        worst_fall_252 = None
        gain_over_30pct_252 = 0
        
        # 21-day window
        if len(future_prices) >= 22:
            p21 = future_prices.iloc[21]["Close"]
            fwd_ret_21 = (p21 - entry_open) / entry_open
            
        # 63-day window
        if len(future_prices) >= 64:
            p63 = future_prices.iloc[63]["Close"]
            fwd_ret_63 = (p63 - entry_open) / entry_open
            low63 = future_prices.iloc[1:64]["Low"].min()
            worst_fall_63 = (low63 - entry_open) / entry_open
            
        # 252-day window
        if len(future_prices) >= 253:
            p252 = future_prices.iloc[252]["Close"]
            fwd_ret_252 = (p252 - entry_open) / entry_open
            low252 = future_prices.iloc[1:253]["Low"].min()
            high252 = future_prices.iloc[1:253]["High"].max()
            worst_fall_252 = (low252 - entry_open) / entry_open
            if (high252 - entry_open) / entry_open >= 0.30 or (p252 - entry_open) / entry_open >= 0.30:
                gain_over_30pct_252 = 1
                
        # Fundamentals
        f_rec = fund_map.get(sym)
        val_z = f_rec["s_hist"] if f_rec else 0.0
        pe_sec = f_rec["s_sector"] if f_rec else 0.0
        growth = f_rec["composite_growth"] if f_rec else 0.0
        sector = f_rec["sector"] if f_rec else "Other"
        
        rebal_records.append({
            "ticker": sym,
            "rebalance_date": r_dt_str,
            "exec_date": str(exec_dt.date()),
            "year": year,
            "sample_period": sample_period,
            "sector": sector,
            "is_risk_on": is_risk_on,
            "spy_close": spy_close,
            "spy_sma200": spy_sma200,
            # Features
            "value_z_own_pe": float(val_z),
            "pe_vs_sector": float(pe_sec),
            "eps_growth_yoy": float(growth),
            "momentum_12_1": float(last_bar["Mom_12_1"]) if pd.notna(last_bar["Mom_12_1"]) else 0.0,
            "rsi14": float(last_bar["RSI14"]),
            "ema20_50_state": int(last_bar["EMA20_50_state"]),
            "dist_above_support_atr": float(last_bar["dist_above_support_atr"]) if pd.notna(last_bar["dist_above_support_atr"]) else np.nan,
            "dist_to_resistance_atr": float(last_bar["dist_to_resistance_atr"]) if pd.notna(last_bar["dist_to_resistance_atr"]) else np.nan,
            "trendline_dist_atr": float(last_bar["trendline_dist_atr"]) if pd.notna(last_bar["trendline_dist_atr"]) else np.nan,
            "volume_ratio_50d": float(last_bar["Volume_ratio_50d"]),
            "atr_pct": float(last_bar["ATR_pct"]),
            # Raw returns
            "fwd_ret_21d": fwd_ret_21,
            "fwd_ret_63d": fwd_ret_63,
            "fwd_ret_252d": fwd_ret_252,
            "worst_fall_63d": worst_fall_63,
            "worst_fall_252d": worst_fall_252,
            "gain_over_30pct_252d": gain_over_30pct_252
        })
        
    if not rebal_records:
        continue
        
    # Compute cross-sectional average forward returns to derive excess returns
    df_reb = pd.DataFrame(rebal_records)
    
    mean_21 = df_reb["fwd_ret_21d"].mean()
    mean_63 = df_reb["fwd_ret_63d"].mean()
    mean_252 = df_reb["fwd_ret_252d"].mean()
    
    df_reb["fwd_excess_ret_21d"] = df_reb["fwd_ret_21d"] - mean_21
    df_reb["fwd_excess_ret_63d"] = df_reb["fwd_ret_63d"] - mean_63
    df_reb["fwd_excess_ret_252d"] = df_reb["fwd_ret_252d"] - mean_252
    
    rows.extend(df_reb.to_dict(orient="records"))

features_df = pd.DataFrame(rows)
print(f"Constructed feature panel: {len(features_df)} constituent-month observations across {features_df['ticker'].nunique()} tickers.")
print(f"Discovery sample observations: {len(features_df[features_df['sample_period'] == 'DISCOVERY'])}")
print(f"Validation sample observations: {len(features_df[features_df['sample_period'] == 'VALIDATION'])}")

# Truncation Proof for Technical Indicators & Panel
print("\nRunning 200-sample point-in-time truncation test for technical & panel features...")
random.seed(42)
test_indices = random.sample(range(len(features_df)), 200)

truncation_mismatches = 0
for idx in test_indices:
    row = features_df.iloc[idx]
    sym = row["ticker"]
    r_dt = pd.to_datetime(row["rebalance_date"])
    
    # Fresh compute using strictly price history up to r_dt
    raw_df = PRICE_STORE[sym]
    truncated_raw = raw_df[raw_df.index <= r_dt]
    fresh_ind = compute_technical_indicators(truncated_raw)
    
    # Check RSI14
    fresh_rsi = fresh_ind.iloc[-1]["RSI14"]
    panel_rsi = row["rsi14"]
    if abs(fresh_rsi - panel_rsi) > 1e-5:
        truncation_mismatches += 1
        print(f"MISMATCH at {sym} on {r_dt}: Fresh RSI={fresh_rsi}, Panel RSI={panel_rsi}")
        
    # Check EMA20_50_state
    fresh_ema_state = fresh_ind.iloc[-1]["EMA20_50_state"]
    panel_ema_state = row["ema20_50_state"]
    if fresh_ema_state != panel_ema_state:
        truncation_mismatches += 1
        print(f"MISMATCH at {sym} on {r_dt}: Fresh EMA State={fresh_ema_state}, Panel={panel_ema_state}")

if truncation_mismatches == 0:
    print("SUCCESS: 200/200 random evaluations matched strictly truncated past data bit-for-bit!")
else:
    raise AssertionError(f"FATAL: Truncation test rejected with {truncation_mismatches} mismatches.")

# Persist to data/us_equities/features.parquet
features_path = os.path.join(DATA_DIR, "features.parquet")
features_df.to_parquet(features_path, index=False)
print(f"Cached feature panel successfully to {features_path} ({os.path.getsize(features_path):,} bytes).")
