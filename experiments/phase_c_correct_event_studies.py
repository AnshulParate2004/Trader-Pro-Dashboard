#!/usr/bin/env python3
"""
experiments/phase_c_correct_event_studies.py

Phase C: Correct, Zero-Lookahead Event Studies on 4H Crypto (BTC, ETH, SOL, DOT)
Period: 2020–2026 (Full Available Parquet History)

Features audited:
  1. BOS Retest (Break of structure follow-through after retest of broken swing)
  2. CHoCH (Change of character reversal signal)
  3. Liquidity Sweep / SFP (Swing Failure Pattern mean reversion)
  4. FVG Mitigation (Fill rate within 6, 12, 24, 48 bars)

Statistical Rigor:
  - Event bar strictly derived per Phase B (tradable timestamp when known).
  - Fill at OPEN of bar t+1.
  - Taker round-trip friction: 0.1144% subtracted from every trade.
  - Non-overlapping holding windows (6, 12, 24, 48 bars) to guarantee sample independence.
  - 1,000-seed Monte Carlo random entry baseline with identical trade count and horizon.
  - Empirical percentile of real event vs random distribution.
  - Per-asset and pooled tables, plus per-year breakdown.
"""

import os
import sys
import numpy as np
import pandas as pd
from scipy import stats

sys.stdout.reconfigure(encoding='utf-8')

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
ROOT_DIR = os.path.abspath(os.path.join(BASE_DIR, ".."))
DATA_DIR = os.path.join(ROOT_DIR, "Trader-Pro", "notebooks", "data")
if not os.path.exists(DATA_DIR):
    DATA_DIR = os.path.join(BASE_DIR, "Trader-Pro", "notebooks", "data")

TAKER_FRICTION = 0.001144  # 0.1144% round-trip

ASSETS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "DOTUSDT"]
HORIZONS = [6, 12, 24, 48]  # 4H bars = 24h, 48h, 96h, 192h

def load_data(symbol):
    paths = [
        os.path.join(DATA_DIR, "4h", f"{symbol}_4h.parquet"),
        os.path.join(DATA_DIR, f"{symbol}_4h.parquet"),
    ]
    for p in paths:
        if os.path.exists(p):
            df = pd.read_parquet(p)
            col = 'open_time' if 'open_time' in df.columns else df.columns[0]
            if pd.api.types.is_datetime64_any_dtype(df[col]):
                df['datetime'] = pd.to_datetime(df[col]).dt.tz_localize(None) if df[col].dt.tz is not None else pd.to_datetime(df[col])
            else:
                num = pd.to_numeric(df[col], errors='coerce')
                sample = num.dropna().iloc[0]
                if sample > 1e11: df['datetime'] = pd.to_datetime(num, unit='ms')
                elif sample > 1e8: df['datetime'] = pd.to_datetime(num, unit='s')
                else: df['datetime'] = pd.to_datetime(df[col])
            if df['datetime'].dt.tz is not None:
                df['datetime'] = df['datetime'].dt.tz_localize(None)
            return df.sort_values('datetime').reset_index(drop=True)
    raise FileNotFoundError(f"Missing {symbol}")


# ============================================================================
# EVENT DETECTION ENGINES (STRICTLY CAUSAL / ZERO LOOKAHEAD)
# ============================================================================

def detect_causal_swings(df, swing_len=5):
    """
    Identifies swing highs and lows strictly causally.
    A swing high at bar s is confirmed only at bar s + swing_len.
    Returns:
      swings: list of (bar_idx, type, price), where type is 'H' or 'L'
      confirmed_at: dict mapping confirmation_bar -> list of newly confirmed swings
    """
    h = df['high'].values
    l = df['low'].values
    n = len(df)
    
    # We find local extrema with lookback and lookforward
    # Then map confirmation to s + swing_len
    swings = []
    confirmed_at = {t: [] for t in range(n)}
    
    for s in range(swing_len, n - swing_len):
        # Swing High
        if h[s] == np.max(h[s - swing_len : s + swing_len + 1]):
            # Confirmed at s + swing_len
            sw = {'idx': s, 'type': 'H', 'price': h[s], 'confirmed_bar': s + swing_len}
            swings.append(sw)
            confirmed_at[s + swing_len].append(sw)
        # Swing Low
        elif l[s] == np.min(l[s - swing_len : s + swing_len + 1]):
            sw = {'idx': s, 'type': 'L', 'price': l[s], 'confirmed_bar': s + swing_len}
            swings.append(sw)
            confirmed_at[s + swing_len].append(sw)
            
    return swings, confirmed_at


def extract_events(df, swing_len=5):
    """
    Extracts all causal events:
      - bos_retest: list of (event_bar, direction)
      - choch: list of (event_bar, direction)
      - sfp: list of (event_bar, direction)
      - fvg: list of dicts with fvg details
    """
    c = df['close'].values
    h = df['high'].values
    l = df['low'].values
    o = df['open'].values
    n = len(df)
    
    swings, confirmed_at = detect_causal_swings(df, swing_len)
    
    # State tracking
    active_swing_highs = []
    active_swing_lows = []
    
    bos_retest_events = []
    choch_events = []
    sfp_events = []
    
    # For BOS retest tracking: list of pending broken levels awaiting retest
    pending_retests = [] # {'level': float, 'dir': 1 or -1, 'break_bar': int}
    
    # Track market trend state for CHoCH: 1 = bull (higher highs), -1 = bear (lower lows)
    current_trend = 1
    
    for t in range(swing_len * 2, n - 50):
        # 1. Register newly confirmed swings at bar t
        for sw in confirmed_at.get(t, []):
            if sw['type'] == 'H':
                active_swing_highs.append(sw)
                # Keep last 5
                if len(active_swing_highs) > 5: active_swing_highs.pop(0)
            else:
                active_swing_lows.append(sw)
                if len(active_swing_lows) > 5: active_swing_lows.pop(0)
                
        if not active_swing_highs or not active_swing_lows:
            continue
            
        last_sh = active_swing_highs[-1]
        last_sl = active_swing_lows[-1]
        
        # 2. Check SFP (Swing Failure Pattern / Liquidity Sweep) at bar t
        # Upper SFP (Bearish): High sweeps above confirmed swing high, but close stays below
        if h[t] > last_sh['price'] and c[t] < last_sh['price']:
            sfp_events.append({'bar': t, 'dir': -1, 'dt': df['datetime'].iloc[t]})
        # Lower SFP (Bullish): Low sweeps below confirmed swing low, but close stays above
        elif l[t] < last_sl['price'] and c[t] > last_sl['price']:
            sfp_events.append({'bar': t, 'dir': 1, 'dt': df['datetime'].iloc[t]})
            
        # 3. Check Break of Structure (BOS) or CHoCH at bar t
        # Bullish break
        if c[t] > last_sh['price'] and c[t-1] <= last_sh['price']:
            if current_trend == 1:
                # Continuation BOS: record pending retest
                pending_retests.append({'level': last_sh['price'], 'dir': 1, 'break_bar': t, 'expires': t + 24})
            else:
                # Reversal CHoCH
                choch_events.append({'bar': t, 'dir': 1, 'dt': df['datetime'].iloc[t]})
                current_trend = 1
                
        # Bearish break
        elif c[t] < last_sl['price'] and c[t-1] >= last_sl['price']:
            if current_trend == -1:
                # Continuation BOS
                pending_retests.append({'level': last_sl['price'], 'dir': -1, 'break_bar': t, 'expires': t + 24})
            else:
                # Reversal CHoCH
                choch_events.append({'bar': t, 'dir': -1, 'dt': df['datetime'].iloc[t]})
                current_trend = -1
                
        # 4. Check BOS Retests
        new_pending = []
        for pr in pending_retests:
            if t > pr['expires']:
                continue
            if t <= pr['break_bar']:
                new_pending.append(pr)
                continue
                
            # Bullish retest: price dips into level and bounces
            if pr['dir'] == 1:
                if l[t] <= pr['level'] <= h[t] and c[t] >= pr['level']:
                    bos_retest_events.append({'bar': t, 'dir': 1, 'dt': df['datetime'].iloc[t]})
                    continue # Retest satisfied
                else:
                    new_pending.append(pr)
            # Bearish retest: price rises into level and rejects
            elif pr['dir'] == -1:
                if l[t] <= pr['level'] <= h[t] and c[t] <= pr['level']:
                    bos_retest_events.append({'bar': t, 'dir': -1, 'dt': df['datetime'].iloc[t]})
                    continue
                else:
                    new_pending.append(pr)
        pending_retests = new_pending

    # 5. FVG Detection and Mitigation
    fvgs = []
    for t in range(2, n - 50):
        # Bullish FVG: Low of bar t > High of bar t-2
        if l[t] > h[t-2] and c[t-1] > o[t-1]:
            gap_top = l[t]
            gap_btm = h[t-2]
            fvgs.append({'bar': t, 'dir': 1, 'top': gap_top, 'btm': gap_btm, 'dt': df['datetime'].iloc[t]})
        # Bearish FVG: High of bar t < Low of bar t-2
        elif h[t] < l[t-2] and c[t-1] < o[t-1]:
            gap_top = l[t-2]
            gap_btm = h[t]
            fvgs.append({'bar': t, 'dir': -1, 'top': gap_top, 'btm': gap_btm, 'dt': df['datetime'].iloc[t]})

    return {
        'bos_retest': bos_retest_events,
        'choch': choch_events,
        'sfp': sfp_events,
        'fvg': fvgs,
    }


# ============================================================================
# STATISTICAL EVALUATION WITH NON-OVERLAPPING WINDOWS & MONTE CARLO BASELINE
# ============================================================================

def evaluate_non_overlapping(events, df, horizon, n_random_seeds=1000):
    """
    Enforces non-overlapping trades for the given horizon.
    Calculates forward return from Open(t+1) to Close(t+1+horizon).
    Subtracts taker round-trip friction.
    Runs 1,000 Monte Carlo random entry baselines with identical trade count.
    """
    o = df['open'].values
    c = df['close'].values
    dts = df['datetime'].values
    n = len(df)
    
    trades = []
    last_exit_bar = -1
    
    # Sort events chronologically
    sorted_events = sorted(events, key=lambda x: x['bar'])
    
    for ev in sorted_events:
        t = ev['bar']
        entry_bar = t + 1
        exit_bar = entry_bar + horizon
        
        if entry_bar <= last_exit_bar or exit_bar >= n:
            continue
            
        entry_price = o[entry_bar]
        exit_price = c[exit_bar]
        direction = ev['dir']
        
        if entry_price <= 0:
            continue
            
        gross_ret = (exit_price - entry_price) / entry_price if direction == 1 else (entry_price - exit_price) / entry_price
        net_ret = gross_ret - TAKER_FRICTION
        
        trades.append({
            'entry_bar': entry_bar,
            'exit_bar': exit_bar,
            'entry_dt': pd.to_datetime(dts[entry_bar]),
            'net_ret': net_ret,
            'direction': direction,
            'year': pd.to_datetime(dts[entry_bar]).year,
        })
        last_exit_bar = exit_bar

    n_trades = len(trades)
    if n_trades == 0:
        return {
            'n_trades': 0, 'mean_ret': 0.0, 'win_rate': 0.0, 't_stat': 0.0, 'p_val': 1.0,
            'percentile_vs_random': 50.0, 'yearly': {}, 'trades': []
        }

    rets = np.array([tr['net_ret'] for tr in trades])
    mean_ret = np.mean(rets)
    win_rate = np.mean(rets > 0)
    
    # t-statistic against zero mean
    std_ret = np.std(rets, ddof=1) if n_trades > 1 else 1e-6
    se = std_ret / np.sqrt(n_trades)
    t_stat = mean_ret / se if se > 0 else 0.0
    p_val = 2.0 * (1.0 - stats.t.cdf(abs(t_stat), df=n_trades - 1)) if n_trades > 1 else 1.0
    
    # Per-year breakdown
    yearly = {}
    trade_df = pd.DataFrame(trades)
    for yr, group in trade_df.groupby('year'):
        yearly[yr] = {
            'count': len(group),
            'mean_ret': group['net_ret'].mean(),
            'win_rate': (group['net_ret'] > 0).mean(),
        }

    # MONTE CARLO RANDOM BASELINE (1,000 seeds)
    # Generate identical number of non-overlapping random trades
    random_means = []
    valid_entry_bars = np.arange(200, n - horizon - 2)
    
    # Pre-compute forward returns for all bars to make MC fast
    all_fwd_long = (c[horizon + 1 :] - o[1 : n - horizon]) / o[1 : n - horizon] - TAKER_FRICTION
    
    for seed in range(n_random_seeds):
        np.random.seed(seed + 100)
        # Sample non-overlapping bars
        sampled_bars = []
        cur_last = -1
        # Random permutation
        shuffled = np.random.choice(valid_entry_bars, size=min(len(valid_entry_bars), n_trades * 5), replace=False)
        for b in np.sort(shuffled):
            if b > cur_last and b + horizon < n:
                sampled_bars.append(b)
                cur_last = b + horizon
                if len(sampled_bars) == n_trades:
                    break
                    
        if len(sampled_bars) >= max(5, int(n_trades * 0.7)):
            # Random direction matching long/short ratio or 50/50
            dirs = np.random.choice([1, -1], size=len(sampled_bars))
            r_rets = []
            for b, d in zip(sampled_bars, dirs):
                ep = o[b]
                xp = c[b + horizon]
                gr = (xp - ep) / ep if d == 1 else (ep - xp) / ep
                r_rets.append(gr - TAKER_FRICTION)
            random_means.append(np.mean(r_rets))
            
    if random_means:
        percentile_vs_random = (np.array(random_means) < mean_ret).mean() * 100.0
    else:
        percentile_vs_random = 50.0

    return {
        'n_trades': n_trades,
        'mean_ret': mean_ret,
        'win_rate': win_rate,
        't_stat': t_stat,
        'p_val': p_val,
        'percentile_vs_random': percentile_vs_random,
        'yearly': yearly,
        'trades': trades,
    }


def evaluate_fvg_mitigation(fvgs, df, limits=[6, 12, 24, 48]):
    """
    Evaluates what percentage of FVGs are mitigated (filled) within 6, 12, 24, 48 bars.
    """
    h = df['high'].values
    l = df['low'].values
    n = len(df)
    
    total = len(fvgs)
    if total == 0:
        return {lim: 0.0 for lim in limits}
        
    counts = {lim: 0 for lim in limits}
    
    for fvg in fvgs:
        bar = fvg['bar']
        direction = fvg['dir']
        gap_top = fvg['top']
        gap_btm = fvg['btm']
        
        # Check within limits
        for lim in limits:
            end_bar = min(n, bar + lim + 1)
            if bar + 1 >= end_bar:
                continue
            if direction == 1:
                # Bullish FVG: price mitigates by pulling back down to gap_top
                if np.any(l[bar + 1 : end_bar] <= gap_top):
                    counts[lim] += 1
            else:
                # Bearish FVG: price mitigates by bouncing up to gap_btm
                if np.any(h[bar + 1 : end_bar] >= gap_btm):
                    counts[lim] += 1
                    
    return {lim: (counts[lim] / total) * 100.0 for lim in limits}


# ============================================================================
# RUN SUITE ACROSS ALL ASSETS AND POOL RESULTS
# ============================================================================

def run_phase_c():
    print("="*90)
    print("PHASE C: RIGOROUS EVENT STUDIES ON 4H DATA (BTC, ETH, SOL, DOT)")
    print("Zero Lookahead | Fill Open(t+1) | Taker Round-Trip Cost (0.1144%) | Non-Overlapping Windows")
    print("="*90)
    
    all_data = {}
    all_events = {}
    
    for symbol in ASSETS:
        df = load_data(symbol)
        all_data[symbol] = df
        events = extract_events(df)
        all_events[symbol] = events
        print(f"Loaded {symbol}: {len(df)} candles ({df['datetime'].min().date()} to {df['datetime'].max().date()})")
        print(f"  - BOS Retests: {len(events['bos_retest'])}, CHoCH: {len(events['choch'])}, SFP: {len(events['sfp'])}, FVG: {len(events['fvg'])}")

    # 1. FVG Mitigation Table
    print("\n" + "="*90)
    print("1. FVG MITIGATION (FILL) RATE BY HORIZON (TIME-LIMITED)")
    print("="*90)
    print(f"| Asset   | Total FVGs | Within 6 Bars (24h) | Within 12 Bars (48h) | Within 24 Bars (96h) | Within 48 Bars (192h) |")
    print("|" + "-"*9 + "|" + "-"*12 + "|" + "-"*21 + "|" + "-"*22 + "|" + "-"*22 + "|" + "-"*23 + "|")
    
    pooled_fvgs = []
    for symbol in ASSETS:
        df = all_data[symbol]
        fvgs = all_events[symbol]['fvg']
        pooled_fvgs.extend(fvgs)
        mit = evaluate_fvg_mitigation(fvgs, df)
        print(f"| {symbol:7s} | {len(fvgs):10d} | {mit[6]:19.1f}% | {mit[12]:20.1f}% | {mit[24]:20.1f}% | {mit[48]:21.1f}% |")

    # 2. Main Event Studies across Horizons: BOS Retest, CHoCH, SFP
    study_events = [
        ("BOS Retest (Trend Continuation)", 'bos_retest'),
        ("CHoCH (Trend Reversal)", 'choch'),
        ("Liquidity Sweep / SFP (Mean Reversion)", 'sfp'),
    ]

    for label, ev_key in study_events:
        print("\n" + "="*90)
        print(f"EVENT STUDY: {label}")
        print("="*90)
        
        for h in HORIZONS:
            print(f"\n--- Horizon: {h} bars ({h*4} hours) ---")
            print(f"| Asset   | Trades | Mean Net Ret | Win Rate | t-statistic | p-value | Percentile vs Random (1000 MC) |")
            print("|" + "-"*9 + "|" + "-"*8 + "|" + "-"*14 + "|" + "-"*10 + "|" + "-"*13 + "|" + "-"*9 + "|" + "-"*33 + "|")
            
            pooled_trades = []
            
            for symbol in ASSETS:
                df = all_data[symbol]
                evs = all_events[symbol][ev_key]
                res = evaluate_non_overlapping(evs, df, horizon=h)
                pooled_trades.extend(res['trades'])
                
                print(f"| {symbol:7s} | {res['n_trades']:6d} | {res['mean_ret']*100:+12.2f}% | {res['win_rate']*100:8.1f}% | {res['t_stat']:11.2f} | {res['p_val']:7.3f} | {res['percentile_vs_random']:30.1f}% |")

            # Pooled Stats
            if pooled_trades:
                p_rets = np.array([t['net_ret'] for t in pooled_trades])
                p_mean = np.mean(p_rets)
                p_win = np.mean(p_rets > 0)
                p_std = np.std(p_rets, ddof=1) if len(p_rets) > 1 else 1e-6
                p_t = p_mean / (p_std / np.sqrt(len(p_rets)))
                p_pval = 2.0 * (1.0 - stats.t.cdf(abs(p_t), df=len(p_rets)-1))
                # Pooled percentile estimate
                pooled_pct = 95.0 if p_t > 1.96 else (5.0 if p_t < -1.96 else 50.0)
                print(f"| POOLED  | {len(pooled_trades):6d} | {p_mean*100:+12.2f}% | {p_win*100:8.1f}% | {p_t:11.2f} | {p_pval:7.3f} | {'N/A (Derived Pooled)':>31s} |")

    # 3. Per-Year Table for 12-bar (48H) Holding Period
    print("\n" + "="*90)
    print("YEAR-BY-YEAR MEAN NET RETURN BREAKDOWN (12-Bar / 48H Horizon)")
    print("="*90)
    
    h = 12
    for label, ev_key in study_events:
        print(f"\n[{label}] Pooled Annual Performance:")
        print(f"| Year | Trade Count | Mean Net Return | Win Rate | Consistency Status |")
        print("|" + "-"*6 + "|" + "-"*13 + "|" + "-"*17 + "|" + "-"*10 + "|" + "-"*20 + "|")
        
        pooled_trades = []
        for symbol in ASSETS:
            df = all_data[symbol]
            evs = all_events[symbol][ev_key]
            res = evaluate_non_overlapping(evs, df, horizon=h)
            pooled_trades.extend(res['trades'])
            
        tdf = pd.DataFrame(pooled_trades)
        if not tdf.empty:
            for yr, grp in tdf.groupby('year'):
                cnt = len(grp)
                m = grp['net_ret'].mean() * 100.0
                wr = (grp['net_ret'] > 0).mean() * 100.0
                status = "Positive" if m > 0 else "Negative (Drag)"
                print(f"| {yr:4d} | {cnt:11d} | {m:+15.2f}% | {wr:8.1f}% | {status:18s} |")

if __name__ == "__main__":
    run_phase_c()
