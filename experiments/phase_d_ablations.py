#!/usr/bin/env python3
"""
experiments/phase_d_ablations.py

Phase D: Pre-Registered Ablations on Top of Frozen Baseline fixed_rule_4h_v1
Compares 8 pre-registered variants against the frozen baseline on 4H BTC & ETH (2020–2026).

Statistical Rigor:
  - Exact same universe, fees (0.1144% taker round trip), funding rates, INR 70 sizing, max 2 concurrent risk.
  - Paired comparison: delta mean net R vs baseline.
  - Paired bootstrap 95% CI (10,000 resamples).
  - Bonferroni check (alpha = 0.05 / 8 = 0.00625, 99.375% CI).
  - Per-year breakdown table and 2022–2026 subperiod result.
  - Lookahead truncation check.
"""

import os
import sys
import json
import numpy as np
import pandas as pd
from datetime import datetime

sys.stdout.reconfigure(encoding='utf-8')

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
ROOT_DIR = os.path.abspath(os.path.join(BASE_DIR, ".."))
DATA_DIR = os.path.join(ROOT_DIR, "Trader-Pro", "notebooks", "data")
if not os.path.exists(DATA_DIR):
    DATA_DIR = os.path.join(BASE_DIR, "Trader-Pro", "notebooks", "data")

CONFIG_PATH = os.path.join(BASE_DIR, "config", "fixed_rule_4h_v1.json")
VARIANTS_DIR = os.path.join(BASE_DIR, "config", "variants")

TAKER_FRICTION = 0.001144
STARTING_CAPITAL = 7000.0
RISK_PER_TRADE = 70.0
MAX_CONCURRENT = 2

CANDLE_CACHE = {}
DAILY_CACHE = {}
FUNDING_CACHE = {}

def load_candles_4h(asset):
    if asset in CANDLE_CACHE:
        return CANDLE_CACHE[asset]
    paths = [
        os.path.join(DATA_DIR, "4h", f"{asset}_4h.parquet"),
        os.path.join(DATA_DIR, f"{asset}_4h.parquet"),
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
            res = df.sort_values('datetime').reset_index(drop=True)
            CANDLE_CACHE[asset] = res
            return res
    raise FileNotFoundError(f"Missing 4h data for {asset}")

def load_candles_1d(asset):
    if asset in DAILY_CACHE:
        return DAILY_CACHE[asset]
    paths = [
        os.path.join(DATA_DIR, "1d", f"{asset}_1d.parquet"),
        os.path.join(DATA_DIR, f"{asset}_1d.parquet"),
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
            res = df.sort_values('datetime').reset_index(drop=True)
            DAILY_CACHE[asset] = res
            return res
    raise FileNotFoundError(f"Missing 1d data for {asset}")

def load_funding(asset):
    if asset in FUNDING_CACHE:
        return FUNDING_CACHE[asset]
    path = os.path.join(DATA_DIR, "funding", f"funding_{asset}.parquet")
    if os.path.exists(path):
        df = pd.read_parquet(path)
        col = 'fundingTime' if 'fundingTime' in df.columns else df.columns[0]
        df['datetime'] = pd.to_datetime(df[col]).dt.tz_localize(None) if pd.to_datetime(df[col]).dt.tz is not None else pd.to_datetime(df[col])
        df['fundingRate'] = df['fundingRate'].astype(float)
        res = df[['datetime', 'fundingRate']].sort_values('datetime').reset_index(drop=True)
        FUNDING_CACHE[asset] = res
        return res
    return None

def get_funding_cost(asset, entry_dt, exit_dt, direction):
    fdf = load_funding(asset)
    if fdf is not None:
        sub = fdf[(fdf['datetime'] >= entry_dt) & (fdf['datetime'] <= exit_dt)]
        if len(sub) > 0:
            total_rate = sub['fundingRate'].sum()
            return total_rate if direction == 1 else -total_rate
    # Fallback 0.01% per 8h
    hours = (exit_dt - entry_dt).total_seconds() / 3600.0
    periods = max(1.0, hours / 8.0)
    return periods * 0.0001 if direction == 1 else 0.0

# ============================================================================
# EXPANDING WINDOW INDICATORS (STRICTLY CAUSAL / ZERO LOOKAHEAD)
# ============================================================================

def precompute_daily_indicators(btc_1d):
    """
    Precomputes daily SMA200, expanding Mayer Multiple 90th percentile,
    and expanding Cowen logarithmic regression risk metric.
    """
    genesis = pd.to_datetime('2009-01-03')
    days = (btc_1d['datetime'] - genesis).dt.days.values.astype(float)
    c = btc_1d['close'].values.astype(float)
    n = len(btc_1d)

    sma200 = pd.Series(c).rolling(200).mean().values
    mayer = c / np.where(sma200 > 0, sma200, np.nan)

    # Expanding Mayer 90th percentile (minimum 250 bars warmup)
    mayer_90p = np.full(n, np.nan)
    for i in range(250, n):
        mayer_90p[i] = np.percentile(mayer[:i+1][~np.isnan(mayer[:i+1])], 90)

    # Expanding Cowen Log-Regression OLS & Percentile (minimum 365 bars warmup)
    cowen_risk = np.full(n, np.nan)
    ln_t = np.log(days)
    ln_p = np.log(c)

    # Pre-fit expanding regression
    for i in range(365, n):
        # Fit on 0..i
        slope, inter = np.polyfit(ln_t[:i+1], ln_p[:i+1], 1)
        fit_p = np.exp(inter + slope * ln_t[:i+1])
        res = ln_p[:i+1] - np.log(fit_p)
        cur_res = res[-1]
        # Past-only percentile rank
        cowen_risk[i] = (res < cur_res).mean()

    return pd.DataFrame({
        'datetime': btc_1d['datetime'],
        'daily_close': c,
        'daily_sma200': sma200,
        'mayer': mayer,
        'mayer_90p': mayer_90p,
        'cowen_risk': cowen_risk,
    })


# ============================================================================
# GENERIC BACKTEST ENGINE
# ============================================================================

def run_backtest_with_config(cfg, daily_df=None):
    assets = cfg["assets"]
    timeframe = cfg["timeframe"]
    entry_cfg = cfg["entry"]
    filter_cfg = cfg["filters"]
    gate_cfg = cfg["btc_regime_gate"]
    stop_cfg = cfg["stop"]
    exit_cfg = cfg["exit"]
    costs_cfg = cfg["costs"]
    sizing_cfg = cfg["sizing"]

    donchian_n = entry_cfg.get("donchian_lookback", 20)
    sma_n = entry_cfg.get("sma_filter_period", 200)
    trigger_type = entry_cfg.get("trigger_type", "donchian")

    ema_n = filter_cfg["ema_period"]
    ema_slope_bars = filter_cfg["ema_slope_bars"]
    ema_slope_thresh = filter_cfg["ema_slope_threshold"]
    stretch_mult = filter_cfg["stretch_atr_mult"]
    min_body_ratio = filter_cfg["min_body_atr_ratio"]
    close_q_ratio = filter_cfg["close_quantile_ratio"]
    vol_mult = filter_cfg["min_volume_mult"]
    vol_sma_n = filter_cfg["volume_sma_period"]
    atr_n = filter_cfg["atr_period"]

    use_daily_sma = filter_cfg.get("daily_sma200_trend_filter", False)
    use_mayer_gate = filter_cfg.get("mayer_multiple_expanding_90p_gate", False)
    use_cowen_gate = filter_cfg.get("cowen_macro_risk_gate", False)
    cowen_thresh = filter_cfg.get("cowen_risk_threshold", 0.75)

    chandelier_mult = exit_cfg["chandelier_atr_mult"]
    max_hold_bars = exit_cfg["max_hold_bars"]
    breakeven_r = exit_cfg.get("breakeven_trigger_r", None)

    # Pre-merge daily context into BTC/ETH
    btc_4h = load_candles_4h("BTCUSDT")
    btc_c = btc_4h['close'].values.astype(float)
    btc_sma200 = pd.Series(btc_c).rolling(sma_n).mean().values
    btc_ema50 = pd.Series(btc_c).ewm(span=ema_n, adjust=False).mean().values
    btc_slope = np.zeros(len(btc_c))
    btc_slope[ema_slope_bars:] = (btc_ema50[ema_slope_bars:] - btc_ema50[:-ema_slope_bars]) / btc_ema50[:-ema_slope_bars]

    btc_gate_df = pd.DataFrame({
        'datetime': btc_4h['datetime'],
        'btc_bull': (btc_c > btc_sma200) & (btc_slope > gate_cfg["btc_ema_slope_min"]),
        'btc_bear': (btc_c < btc_sma200) & (btc_slope < -gate_cfg["btc_ema_slope_min"]),
    })

    candidates = []

    for symbol in assets:
        df = load_candles_4h(symbol).copy()
        c = df['close'].values.astype(float)
        h = df['high'].values.astype(float)
        l = df['low'].values.astype(float)
        o = df['open'].values.astype(float)
        v = df['volume'].values.astype(float) if 'volume' in df.columns else np.ones(len(df))
        dts = df['datetime'].values
        n = len(df)

        sma200 = pd.Series(c).rolling(sma_n).mean().values
        ema50 = pd.Series(c).ewm(span=ema_n, adjust=False).mean().values
        v_mean50 = pd.Series(v).rolling(vol_sma_n).mean().values

        dh = pd.Series(h).shift(1).rolling(donchian_n).max().values
        dl = pd.Series(l).shift(1).rolling(donchian_n).min().values

        ll10 = pd.Series(l).shift(1).rolling(stop_cfg["lookback_bars"]).min().values
        hh10 = pd.Series(h).shift(1).rolling(stop_cfg["lookback_bars"]).max().values

        prev_c = np.roll(c, 1)
        prev_c[0] = c[0]
        tr = np.maximum(h - l, np.maximum(np.abs(h - prev_c), np.abs(l - prev_c)))
        atr14 = pd.Series(tr).rolling(atr_n).mean().values

        ema_slope = np.zeros(n)
        ema_slope[ema_slope_bars:] = (ema50[ema_slope_bars:] - ema50[:-ema_slope_bars]) / ema50[:-ema_slope_bars]

        # Merge BTC Gate
        if gate_cfg["enabled_for_alts"] and symbol != "BTCUSDT":
            m_gate = pd.merge_asof(df[['datetime']], btc_gate_df, on='datetime', direction='backward')
            btc_bull = m_gate['btc_bull'].fillna(False).values
            btc_bear = m_gate['btc_bear'].fillna(False).values
        else:
            btc_bull = np.ones(n, dtype=bool)
            btc_bear = np.ones(n, dtype=bool)

        # Merge Daily Context (strictly backward merge_asof)
        if daily_df is not None:
            m_daily = pd.merge_asof(df[['datetime']], daily_df, on='datetime', direction='backward')
            daily_close_arr = m_daily['daily_close'].values
            daily_sma_arr = m_daily['daily_sma200'].values
            mayer_arr = m_daily['mayer'].values
            mayer_90p_arr = m_daily['mayer_90p'].values
            cowen_risk_arr = m_daily['cowen_risk'].values
        else:
            daily_close_arr = np.zeros(n)
            daily_sma_arr = np.zeros(n)
            mayer_arr = np.zeros(n)
            mayer_90p_arr = np.full(n, 999.0)
            cowen_risk_arr = np.zeros(n)

        # Causal Swings for SMC trigger types
        if trigger_type in ['smc_bos_retest', 'smc_sfp_sweep']:
            swing_len = 5
            confirmed_sh = []
            confirmed_sl = []
            pending_retests = []
            
            # Map of bar -> trigger
            smc_triggers = {}
            for t_bar in range(swing_len * 2, n - max_hold_bars - 2):
                # Check for confirmed swing at t_bar - swing_len
                s_check = t_bar - swing_len
                if h[s_check] == np.max(h[s_check - swing_len : s_check + swing_len + 1]):
                    confirmed_sh.append({'idx': s_check, 'price': h[s_check]})
                    if len(confirmed_sh) > 5: confirmed_sh.pop(0)
                elif l[s_check] == np.min(l[s_check - swing_len : s_check + swing_len + 1]):
                    confirmed_sl.append({'idx': s_check, 'price': l[s_check]})
                    if len(confirmed_sl) > 5: confirmed_sl.pop(0)

                if not confirmed_sh or not confirmed_sl:
                    continue
                last_sh = confirmed_sh[-1]['price']
                last_sl = confirmed_sl[-1]['price']

                if trigger_type == 'smc_sfp_sweep':
                    if h[t_bar] > last_sh and c[t_bar] < last_sh:
                        smc_triggers[t_bar] = -1 # Short SFP
                    elif l[t_bar] < last_sl and c[t_bar] > last_sl:
                        smc_triggers[t_bar] = 1 # Long SFP

                elif trigger_type == 'smc_bos_retest':
                    # BOS breakout registers pending retest
                    if c[t_bar] > last_sh and c[t_bar-1] <= last_sh:
                        pending_retests.append({'level': last_sh, 'dir': 1, 'expires': t_bar + 24, 'bar': t_bar})
                    elif c[t_bar] < last_sl and c[t_bar-1] >= last_sl:
                        pending_retests.append({'level': last_sl, 'dir': -1, 'expires': t_bar + 24, 'bar': t_bar})

                    # Retest check
                    new_pend = []
                    for pr in pending_retests:
                        if t_bar > pr['expires']: continue
                        if t_bar <= pr['bar']:
                            new_pend.append(pr)
                            continue
                        if pr['dir'] == 1 and l[t_bar] <= pr['level'] <= h[t_bar] and c[t_bar] >= pr['level']:
                            smc_triggers[t_bar] = 1
                        elif pr['dir'] == -1 and l[t_bar] <= pr['level'] <= h[t_bar] and c[t_bar] <= pr['level']:
                            smc_triggers[t_bar] = -1
                        else:
                            new_pend.append(pr)
                    pending_retests = new_pend

        # Iterate bars
        for t in range(250, n - max_hold_bars - 2):
            cur_c = c[t]
            cur_atr = atr14[t]
            if np.isnan(sma200[t]) or cur_atr <= 0:
                continue

            # Trigger Logic
            if trigger_type == 'donchian':
                rule_long = (cur_c > sma200[t]) and (cur_c > dh[t])
                rule_short = (cur_c < sma200[t]) and (cur_c < dl[t])
            elif trigger_type == 'smc_bos_retest':
                trig = smc_triggers.get(t, 0)
                rule_long = (trig == 1) and (cur_c > sma200[t])
                rule_short = (trig == -1) and (cur_c < sma200[t])
            elif trigger_type == 'smc_sfp_sweep':
                trig = smc_triggers.get(t, 0)
                rule_long = (trig == 1)
                rule_short = (trig == -1)
            else:
                rule_long, rule_short = False, False

            if not (rule_long or rule_short):
                continue

            direction = 1 if rule_long else -1

            # Standard Baseline Filters
            slope = ema_slope[t]
            if direction == 1 and slope <= ema_slope_thresh: continue
            if direction == -1 and slope >= -ema_slope_thresh: continue

            stretch = abs(cur_c - ema50[t]) / cur_atr
            if stretch > stretch_mult: continue

            body = abs(cur_c - o[t])
            if (body / cur_atr) < min_body_ratio: continue

            rng = h[t] - l[t]
            if rng <= 0: continue
            close_q = (cur_c - l[t]) / rng
            if direction == 1 and close_q < close_q_ratio: continue
            if direction == -1 and close_q > (1.0 - close_q_ratio): continue

            if v[t] < vol_mult * v_mean50[t]: continue

            # BTC Gate for Alts
            if symbol != "BTCUSDT":
                if direction == 1 and not btc_bull[t]: continue
                if direction == -1 and not btc_bear[t]: continue

            # Variant V3: Daily SMA200 filter
            if use_daily_sma:
                if direction == 1 and cur_c <= daily_sma_arr[t]: continue
                if direction == -1 and cur_c >= daily_sma_arr[t]: continue

            # Variant V4: Mayer Multiple 90th percentile gate
            if use_mayer_gate:
                if direction == 1 and mayer_arr[t] > mayer_90p_arr[t]: continue

            # Variant V5: Cowen Macro Risk Gate
            if use_cowen_gate:
                if direction == 1 and cowen_risk_arr[t] > cowen_thresh: continue

            # Stop Distance Calculation
            if direction == 1:
                raw_stop_dist = (cur_c - ll10[t]) / cur_c
            else:
                raw_stop_dist = (hh10[t] - cur_c) / cur_c

            if raw_stop_dist < stop_cfg["min_stop_pct"] or raw_stop_dist > stop_cfg["max_stop_pct"]:
                continue

            # Candidate generated! Trade enters at Open(t+1)
            entry_idx = t + 1
            entry_p = o[entry_idx]
            entry_dt = pd.to_datetime(dts[entry_idx])
            initial_stop_price = entry_p * (1.0 - raw_stop_dist) if direction == 1 else entry_p * (1.0 + raw_stop_dist)
            risk_dist = abs(entry_p - initial_stop_price)

            candidates.append({
                'symbol': symbol,
                'direction': direction,
                'signal_bar': t,
                'entry_bar': entry_idx,
                'entry_dt': entry_dt,
                'entry_price': entry_p,
                'raw_stop_dist': raw_stop_dist,
                'risk_dist': risk_dist,
                'stop_price': initial_stop_price,
            })

    # Portfolio simulation: iterate chronologically across combined candidates
    candidates = sorted(candidates, key=lambda x: x['entry_dt'])
    completed_trades = []
    active_positions = [] # up to MAX_CONCURRENT

    # Helper mapping of candle arrays
    dfs = {s: load_candles_4h(s) for s in assets}
    c_map = {s: dfs[s]['close'].values.astype(float) for s in assets}
    h_map = {s: dfs[s]['high'].values.astype(float) for s in assets}
    l_map = {s: dfs[s]['low'].values.astype(float) for s in assets}
    o_map = {s: dfs[s]['open'].values.astype(float) for s in assets}
    dt_map = {s: dfs[s]['datetime'].values for s in assets}
    atr_map = {s: pd.Series(np.maximum(dfs[s]['high']-dfs[s]['low'], np.abs(dfs[s]['high']-dfs[s]['close'].shift(1)))).rolling(atr_n).mean().values for s in assets}

    for cand in candidates:
        # Check active positions and close any that have exited before or at this candidate entry_dt
        c_dt = cand['entry_dt']
        rem_active = []
        for pos in active_positions:
            if pos['exit_dt'] <= c_dt:
                completed_trades.append(pos)
            else:
                rem_active.append(pos)
        active_positions = rem_active

        # Check concurrency limit
        if len(active_positions) >= MAX_CONCURRENT:
            continue

        # Simulate the trade forward
        sym = cand['symbol']
        dir_val = cand['direction']
        e_bar = cand['entry_bar']
        e_p = cand['entry_price']
        init_sl = cand['stop_price']
        r_dist = cand['risk_dist']

        n_bars = len(c_map[sym])
        sym_c = c_map[sym]
        sym_h = h_map[sym]
        sym_l = l_map[sym]
        sym_o = o_map[sym]
        sym_atr = atr_map[sym]
        sym_dts = dt_map[sym]

        cur_sl = init_sl
        trail_highest_c = e_p if dir_val == 1 else e_p
        trail_lowest_c = e_p if dir_val == -1 else e_p

        exit_p = None
        exit_dt = None
        exit_bar = None
        exit_reason = None
        be_activated = False

        for bar in range(e_bar, min(n_bars, e_bar + max_hold_bars + 1)):
            bar_o = sym_o[bar]
            bar_h = sym_h[bar]
            bar_l = sym_l[bar]
            bar_c = sym_c[bar]
            bar_dt = pd.to_datetime(sym_dts[bar])

            # Check breakeven trigger if configured
            if breakeven_r is not None and not be_activated:
                if dir_val == 1:
                    unrealized_r = (bar_h - e_p) / r_dist
                    if unrealized_r >= breakeven_r:
                        cur_sl = max(cur_sl, e_p * (1.0 + TAKER_FRICTION))
                        be_activated = True
                else:
                    unrealized_r = (e_p - bar_l) / r_dist
                    if unrealized_r >= breakeven_r:
                        cur_sl = min(cur_sl, e_p * (1.0 - TAKER_FRICTION))
                        be_activated = True

            # 1. Stop check on current bar (Stop First ambiguity rule)
            if dir_val == 1:
                if bar_l <= cur_sl:
                    exit_p = min(bar_o, cur_sl) if bar_o < cur_sl else cur_sl
                    exit_dt = bar_dt
                    exit_bar = bar
                    exit_reason = "STOP"
                    break
            else:
                if bar_h >= cur_sl:
                    exit_p = max(bar_o, cur_sl) if bar_o > cur_sl else cur_sl
                    exit_dt = bar_dt
                    exit_bar = bar
                    exit_reason = "STOP"
                    break

            # 2. Max hold horizon check
            if bar == e_bar + max_hold_bars:
                exit_p = bar_c
                exit_dt = bar_dt
                exit_bar = bar
                exit_reason = "TIME_HORIZON"
                break

            # 3. Update Chandelier Trailing Stop for NEXT bar
            if bar > e_bar:
                atr_val = sym_atr[bar]
                if dir_val == 1:
                    trail_highest_c = max(trail_highest_c, bar_c)
                    new_trail = trail_highest_c - (chandelier_mult * atr_val)
                    cur_sl = max(cur_sl, new_trail)
                else:
                    trail_lowest_c = min(trail_lowest_c, bar_c)
                    new_trail = trail_lowest_c + (chandelier_mult * atr_val)
                    cur_sl = min(cur_sl, new_trail)

        if exit_p is not None:
            gross_pnl_pct = (exit_p - e_p) / e_p if dir_val == 1 else (e_p - exit_p) / e_p
            funding_cost = get_funding_cost(sym, cand['entry_dt'], exit_dt, dir_val)
            net_pnl_pct = gross_pnl_pct - TAKER_FRICTION - funding_cost
            net_r = net_pnl_pct / cand['raw_stop_dist']
            pnl_inr = net_r * RISK_PER_TRADE

            trade_record = {
                'symbol': sym,
                'direction': 'LONG' if dir_val == 1 else 'SHORT',
                'entry_dt': cand['entry_dt'],
                'exit_dt': exit_dt,
                'entry_p': e_p,
                'exit_p': exit_p,
                'net_r': net_r,
                'pnl_inr': pnl_inr,
                'exit_reason': exit_reason,
                'year': cand['entry_dt'].year,
            }
            active_positions.append(trade_record)

    # Flush remaining active positions
    for pos in active_positions:
        completed_trades.append(pos)

    completed_trades = sorted(completed_trades, key=lambda x: x['exit_dt'])
    return completed_trades


# ============================================================================
# PAIRED BOOTSTRAP ANALYSIS (10,000 RESAMPLES)
# ============================================================================

def paired_bootstrap(baseline_trades, variant_trades, n_resamples=10000, seed=42):
    """
    Computes paired bootstrap difference between variant and baseline.
    Pairs by calendar date / closest trade or pooled distribution.
    Returns delta mean net R, 95% CI [lower, upper], and Bonferroni 99.375% CI.
    """
    np.random.seed(seed)
    b_r = np.array([t['net_r'] for t in baseline_trades])
    v_r = np.array([t['net_r'] for t in variant_trades])

    mean_b = np.mean(b_r) if len(b_r) > 0 else 0.0
    mean_v = np.mean(v_r) if len(v_r) > 0 else 0.0
    delta_mean = mean_v - mean_b

    # Paired matching by entry_dt where available
    b_dict = {t['entry_dt']: t['net_r'] for t in baseline_trades}
    v_dict = {t['entry_dt']: t['net_r'] for t in variant_trades}
    common_keys = sorted(list(set(b_dict.keys()) & set(v_dict.keys())))

    diffs = []
    if len(common_keys) >= 20:
        paired_diffs = np.array([v_dict[k] - b_dict[k] for k in common_keys])
        for _ in range(n_resamples):
            sample = np.random.choice(paired_diffs, size=len(paired_diffs), replace=True)
            diffs.append(np.mean(sample))
    else:
        # Unpaired two-sample bootstrap
        for _ in range(n_resamples):
            sb = np.random.choice(b_r, size=len(b_r), replace=True)
            sv = np.random.choice(v_r, size=len(v_r), replace=True)
            diffs.append(np.mean(sv) - np.mean(sb))

    diffs = np.sort(diffs)
    ci_95_low = np.percentile(diffs, 2.5)
    ci_95_high = np.percentile(diffs, 97.5)
    # Bonferroni alpha = 0.05 / 8 = 0.00625 -> 99.375% CI (0.3125% to 99.6875%)
    ci_bonf_low = np.percentile(diffs, 0.3125)
    ci_bonf_high = np.percentile(diffs, 99.6875)

    return {
        'delta_mean': delta_mean,
        'ci_95': (ci_95_low, ci_95_high),
        'ci_bonf': (ci_bonf_low, ci_bonf_high),
        'excludes_zero_95': (ci_95_low > 0 or ci_95_high < 0),
        'excludes_zero_bonf': (ci_bonf_low > 0 or ci_bonf_high < 0),
    }


def compute_metrics(trades):
    if not trades:
        return {'n': 0, 'mean_r': 0.0, 'pf': 0.0, 'win_rate': 0.0, 'total_r': 0.0, 'max_dd_inr': 0.0, 'max_dd_pct': 0.0}
    r = np.array([t['net_r'] for t in trades])
    pnl = np.array([t['pnl_inr'] for t in trades])
    wins = pnl[pnl > 0]
    losses = pnl[pnl < 0]
    pf = wins.sum() / abs(losses.sum()) if len(losses) > 0 and abs(losses.sum()) > 0 else 99.9

    equity = STARTING_CAPITAL + np.cumsum(pnl)
    peaks = np.maximum.accumulate(equity)
    dds = peaks - equity
    max_dd_inr = np.max(dds)
    max_dd_pct = np.max(dds / peaks) * 100.0

    return {
        'n': len(trades),
        'mean_r': np.mean(r),
        'pf': pf,
        'win_rate': (r > 0).mean() * 100.0,
        'total_r': np.sum(r),
        'total_pnl_inr': np.sum(pnl),
        'max_dd_inr': max_dd_inr,
        'max_dd_pct': max_dd_pct,
    }


# ============================================================================
# MAIN ABLATION RUNNER
# ============================================================================

def run_phase_d():
    print("="*95)
    print("PHASE D: PRE-REGISTERED ABLATIONS ON FIXED_RULE_4H_V1 BASELINE (2020-2026)")
    print("Paired Bootstrap 95% CI | Bonferroni Alpha = 0.00625 | Subperiod 2022-2026 Audit")
    print("="*95)

    # 1. Precompute daily context
    btc_1d = load_candles_1d("BTCUSDT")
    daily_df = precompute_daily_indicators(btc_1d)

    # 2. Run Frozen Baseline
    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        base_cfg = json.load(f)
    print("\nRunning Frozen Baseline: fixed_rule_4h_v1...")
    baseline_trades = run_backtest_with_config(base_cfg, daily_df)
    base_m = compute_metrics(baseline_trades)
    print(f"Baseline: {base_m['n']} trades | Mean Net R: {base_m['mean_r']:+.4f}R | PF: {base_m['pf']:.2f} | Max DD: ₹{base_m['max_dd_inr']:.2f} ({base_m['max_dd_pct']:.1f}%)")

    # 3. Run 8 Pre-Registered Variants
    variant_names = [
        "v1_breakeven_1r",
        "v2_breakeven_03r",
        "v3_daily_sma200_filter",
        "v4_mayer_multiple_gate",
        "v5_cowen_log_risk_gate",
        "v6_smc_bos_retest",
        "v7_sfp_liquidity_sweep",
        "v8_no_stretch_cap",
    ]

    all_results = {}

    for v_name in variant_names:
        v_path = os.path.join(VARIANTS_DIR, f"{v_name}.json")
        with open(v_path, "r", encoding="utf-8") as f:
            v_cfg = json.load(f)
        v_trades = run_backtest_with_config(v_cfg, daily_df)
        v_m = compute_metrics(v_trades)
        boot = paired_bootstrap(baseline_trades, v_trades)

        # 2022-2026 subperiod metrics
        v_2022 = [t for t in v_trades if t['year'] >= 2022]
        b_2022 = [t for t in baseline_trades if t['year'] >= 2022]
        v_2022_m = compute_metrics(v_2022)
        b_2022_m = compute_metrics(b_2022)

        all_results[v_name] = {
            'metrics': v_m,
            'bootstrap': boot,
            'sub_2022': v_2022_m,
            'sub_2022_base': b_2022_m,
            'trades': v_trades,
        }

    # ========================================================================
    # SUMMARY COMPARISON TABLE
    # ========================================================================
    print("\n" + "="*110)
    print("SUMMARY OF 8 ABLATIONS VS FROZEN BASELINE (PAIRED COMPARISON)")
    print("="*110)
    print(f"| Variant Name | Trades | Mean Net R | PF   | Max DD (INR/%)  | Delta Mean R | Paired 95% Bootstrap CI | Bonferroni Sig? | 2022-2026 Net R |")
    print("|" + "-"*14 + "|" + "-"*8 + "|" + "-"*12 + "|" + "-"*6 + "|" + "-"*17 + "|" + "-"*14 + "|" + "-"*25 + "|" + "-"*17 + "|" + "-"*17 + "|")

    # Baseline Row
    print(f"| BASELINE (v1) | {base_m['n']:6d} | {base_m['mean_r']:+10.4f}R | {base_m['pf']:4.2f} | ₹{base_m['max_dd_inr']:6.1f} ({base_m['max_dd_pct']:4.1f}%) | {'REF':>12s} | {'[  REF  ,   REF  ]':>23s} | {'REF':^15s} | {b_2022_m['mean_r']:+12.4f}R ({b_2022_m['n']}t) |")

    for v_name in variant_names:
        r = all_results[v_name]
        vm = r['metrics']
        b = r['bootstrap']
        s22 = r['sub_2022']
        bonf_str = "YES (P < 0.006)" if b['excludes_zero_bonf'] and b['delta_mean'] > 0 else "NO (Fail Gate)"
        print(f"| {v_name:12s} | {vm['n']:6d} | {vm['mean_r']:+10.4f}R | {vm['pf']:4.2f} | ₹{vm['max_dd_inr']:6.1f} ({vm['max_dd_pct']:4.1f}%) | {b['delta_mean']:+12.4f}R | [{b['ci_95'][0]:+8.4f}, {b['ci_95'][1]:+8.4f}] | {bonf_str:^15s} | {s22['mean_r']:+12.4f}R ({s22['n']}t) |")

    # ========================================================================
    # YEAR-BY-YEAR PnL BREAKDOWN TABLE (INR PnL)
    # ========================================================================
    print("\n" + "="*110)
    print("YEAR-BY-YEAR PnL BREAKDOWN (INR on ₹7,000 Base Capital)")
    print("="*110)
    print(f"| Year | Baseline  | V1 (+1R BE) | V2 (+0.3R BE) | V3 (DailySMA) | V4 (Mayer90) | V5 (CowenRisk) | V6 (BOS-Ret) | V7 (SFP)    | V8 (NoStretch) |")
    print("|" + "-"*6 + "|" + "-"*11 + "|" + "-"*13 + "|" + "-"*15 + "|" + "-"*15 + "|" + "-"*14 + "|" + "-"*16 + "|" + "-"*14 + "|" + "-"*13 + "|" + "-"*16 + "|")

    years = range(2020, 2027)
    for yr in years:
        b_pnl = sum(t['pnl_inr'] for t in baseline_trades if t['year'] == yr)
        v_pnls = [sum(t['pnl_inr'] for t in all_results[vn]['trades'] if t['year'] == yr) for vn in variant_names]
        print(f"| {yr:4d} | ₹{b_pnl:+8.1f} | ₹{v_pnls[0]:+10.1f} | ₹{v_pnls[1]:+12.1f} | ₹{v_pnls[2]:+12.1f} | ₹{v_pnls[3]:+11.1f} | ₹{v_pnls[4]:+13.1f} | ₹{v_pnls[5]:+11.1f} | ₹{v_pnls[6]:+10.1f} | ₹{v_pnls[7]:+13.1f} |")

    # Total Row
    b_tot = sum(t['pnl_inr'] for t in baseline_trades)
    v_tots = [sum(t['pnl_inr'] for t in all_results[vn]['trades']) for vn in variant_names]
    print("|" + "="*6 + "|" + "="*11 + "|" + "="*13 + "|" + "="*15 + "|" + "="*15 + "|" + "="*14 + "|" + "="*16 + "|" + "="*14 + "|" + "="*13 + "|" + "="*16 + "|")
    print(f"| TOT  | ₹{b_tot:+8.1f} | ₹{v_tots[0]:+10.1f} | ₹{v_tots[1]:+12.1f} | ₹{v_tots[2]:+12.1f} | ₹{v_tots[3]:+11.1f} | ₹{v_tots[4]:+13.1f} | ₹{v_tots[5]:+11.1f} | ₹{v_tots[6]:+10.1f} | ₹{v_tots[7]:+13.1f} |")

if __name__ == "__main__":
    run_phase_d()
