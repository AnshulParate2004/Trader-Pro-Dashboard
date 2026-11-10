import os
import sys
import json
import numpy as np
import pandas as pd
from datetime import datetime

sys.stdout.reconfigure(encoding='utf-8')

# Path setup
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
CONFIG_PATH = os.path.join(BASE_DIR, "Trader-Pro-Dashboard", "config", "fixed_rule_4h_v1.json")
if not os.path.exists(CONFIG_PATH):
    CONFIG_PATH = os.path.join(BASE_DIR, "config", "fixed_rule_4h_v1.json")

DATA_DIR = os.path.join(BASE_DIR, "Trader-Pro", "notebooks", "data")
if not os.path.exists(DATA_DIR):
    DATA_DIR = os.path.join(BASE_DIR, "..", "Trader-Pro", "notebooks", "data")
FUNDING_DIR = os.path.join(DATA_DIR, "funding")

def load_config(override_clamp_mode=None, override_direction=None):
    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        cfg = json.load(f)
    if override_clamp_mode:
        cfg["stop"]["clamp_mode"] = override_clamp_mode
    if override_direction:
        cfg["direction"] = override_direction
    return cfg

CANDLE_CACHE = {}
FUNDING_CACHE = {}

def load_candles(asset, tf='4h'):
    key = (asset, tf)
    if key in CANDLE_CACHE:
        return CANDLE_CACHE[key]
    paths = [
        os.path.join(DATA_DIR, tf, f"{asset}_{tf}.parquet"),
        os.path.join(DATA_DIR, f"{asset}_{tf}.parquet"),
    ]
    for p in paths:
        if os.path.exists(p):
            df = pd.read_parquet(p)
            col = 'open_time' if 'open_time' in df.columns else df.columns[0]
            if pd.api.types.is_datetime64_any_dtype(df[col]):
                df['datetime'] = pd.to_datetime(df[col]).dt.tz_localize(None) if df[col].dt.tz is not None else pd.to_datetime(df[col])
            else:
                try:
                    num = pd.to_numeric(df[col])
                    sample = num.dropna().iloc[0]
                    if sample > 1e16: df['datetime'] = pd.to_datetime(num, unit='ns')
                    elif sample > 1e11: df['datetime'] = pd.to_datetime(num, unit='ms')
                    elif sample > 1e8: df['datetime'] = pd.to_datetime(num, unit='s')
                    else: df['datetime'] = pd.to_datetime(df[col])
                except Exception:
                    df['datetime'] = pd.to_datetime(df[col])
            if df['datetime'].dt.tz is not None:
                df['datetime'] = df['datetime'].dt.tz_localize(None)
            clean_df = df.sort_values('datetime').reset_index(drop=True)
            CANDLE_CACHE[key] = clean_df
            return clean_df
    raise FileNotFoundError(f"Candles not found for {asset}_{tf}")

def load_funding_rates(asset):
    if asset in FUNDING_CACHE:
        return FUNDING_CACHE[asset]
    path = os.path.join(FUNDING_DIR, f"funding_{asset}.parquet")
    if os.path.exists(path):
        df = pd.read_parquet(path)
        col = 'fundingTime' if 'fundingTime' in df.columns else df.columns[0]
        df['datetime'] = pd.to_datetime(df[col])
        if df['datetime'].dt.tz is not None:
            df['datetime'] = df['datetime'].dt.tz_localize(None)
        df['fundingRate'] = df['fundingRate'].astype(float)
        res = df[['datetime', 'fundingRate']].sort_values('datetime').reset_index(drop=True)
        FUNDING_CACHE[asset] = res
        return res
    return None

def calculate_real_funding(asset, entry_dt, exit_dt, direction, funding_df, fallback_rate_8h):
    """
    Computes funding cost between entry_dt and exit_dt.
    If real funding df is present and covers the period, sums exact funding events.
    Otherwise uses fallback_rate_8h per 8-hour block.
    """
    if funding_df is not None:
        sub = funding_df[(funding_df['datetime'] >= entry_dt) & (funding_df['datetime'] <= exit_dt)]
        if len(sub) > 0:
            total_rate = sub['fundingRate'].sum()
            # For LONG, positive funding rate means payment (cost)
            # For SHORT, positive funding rate means receipt (benefit)
            return total_rate if direction == "LONG" else -total_rate

    # Fallback placeholder
    hours = (exit_dt - entry_dt).total_seconds() / 3600.0
    periods_8h = max(1.0, hours / 8.0)
    if direction == "LONG":
        return periods_8h * fallback_rate_8h
    else:
        return 0.0

def run_candidate_generator(cfg):
    timeframe = cfg["timeframe"]
    assets = cfg["assets"]
    entry_cfg = cfg["entry"]
    filter_cfg = cfg["filters"]
    gate_cfg = cfg["btc_regime_gate"]
    stop_cfg = cfg["stop"]
    exit_cfg = cfg["exit"]
    cost_cfg = cfg["costs"]
    sizing_cfg = cfg["sizing"]
    direction_mode = cfg["direction"]

    donchian_n = entry_cfg["donchian_lookback"]
    sma_n = entry_cfg["sma_filter_period"]
    ema_n = filter_cfg["ema_period"]
    ema_slope_bars = filter_cfg["ema_slope_bars"]
    ema_slope_thresh = filter_cfg["ema_slope_threshold"]
    stretch_mult = filter_cfg["stretch_atr_mult"]
    min_body_ratio = filter_cfg["min_body_atr_ratio"]
    close_q_ratio = filter_cfg["close_quantile_ratio"]
    vol_mult = filter_cfg["min_volume_mult"]
    vol_sma_n = filter_cfg["volume_sma_period"]
    atr_n = filter_cfg["atr_period"]

    # Extended Variant Support (V1 - V8)
    use_daily_sma = filter_cfg.get("daily_sma200_trend_filter", False)
    use_mayer_gate = filter_cfg.get("mayer_multiple_expanding_90p_gate", False)
    use_cowen_gate = filter_cfg.get("cowen_macro_risk_gate", False)
    cowen_thresh = filter_cfg.get("cowen_risk_threshold", 0.75)
    breakeven_r = exit_cfg.get("breakeven_trigger_r", None)
    trigger_type = entry_cfg.get("trigger_type", "donchian")

    # Pre-compute daily context if requested (V3, V4, V5)
    daily_lookup = None
    if use_daily_sma or use_mayer_gate or use_cowen_gate:
        p_1d = os.path.join(DATA_DIR, "1d", "BTCUSDT_1d.parquet")
        if not os.path.exists(p_1d):
            p_1d = os.path.join(DATA_DIR, "BTCUSDT_1d.parquet")
        df_1d = pd.read_parquet(p_1d)
        c_1d_col = 'open_time' if 'open_time' in df_1d.columns else df_1d.columns[0]
        df_1d['datetime'] = pd.to_datetime(df_1d[c_1d_col]).dt.tz_localize(None) if df_1d[c_1d_col].dt.tz is not None else pd.to_datetime(df_1d[c_1d_col])
        df_1d = df_1d.sort_values('datetime').reset_index(drop=True)
        
        c_1d = df_1d['close'].values.astype(float)
        n_1d = len(df_1d)
        genesis = pd.to_datetime('2009-01-03')
        days = (df_1d['datetime'] - genesis).dt.days.values.astype(float)
        
        d_sma200 = pd.Series(c_1d).rolling(200).mean().values
        mayer = c_1d / np.where(d_sma200 > 0, d_sma200, np.nan)
        
        mayer_90p = np.full(n_1d, np.nan)
        for i in range(200, n_1d):
            mayer_90p[i] = np.percentile(mayer[:i+1][~np.isnan(mayer[:i+1])], 90)
            
        cowen_risk = np.zeros(n_1d) # 0.0 before day 365 -> ungated
        ln_t = np.log(days)
        ln_p = np.log(c_1d)
        for i in range(365, n_1d):
            slope, inter = np.polyfit(ln_t[:i+1], ln_p[:i+1], 1)
            res = ln_p[:i+1] - (inter + slope * ln_t[:i+1])
            cowen_risk[i] = (res < res[-1]).mean()
            
        daily_lookup = pd.DataFrame({
            'datetime': df_1d['datetime'],
            'd_close': c_1d,
            'd_sma200': d_sma200,
            'mayer': mayer,
            'mayer_90p': mayer_90p,
            'cowen_risk': cowen_risk,
        }).set_index('datetime')

    min_stop_pct = stop_cfg["min_stop_pct"]
    max_stop_pct = stop_cfg["max_stop_pct"]
    clamp_mode = stop_cfg["clamp_mode"]

    chandelier_mult = exit_cfg["chandelier_atr_mult"]
    max_hold_bars = exit_cfg["max_hold_bars"]
    taker_friction = cost_cfg["taker_round_trip_friction"]
    funding_fallback_long = cost_cfg["funding_rate_fallback_8h_long"]
    risk_inr = sizing_cfg["risk_per_trade_inr"]

    # Pre-load BTC for gate if enabled
    btc_df = load_candles("BTCUSDT", timeframe)
    btc_c = btc_df['close'].values.astype(float)
    btc_sma200 = pd.Series(btc_c).rolling(sma_n).mean().values
    btc_ema50 = pd.Series(btc_c).ewm(span=ema_n, adjust=False).mean().values
    btc_slope = np.zeros(len(btc_c))
    btc_slope[ema_slope_bars:] = (btc_ema50[ema_slope_bars:] - btc_ema50[:-ema_slope_bars]) / btc_ema50[:-ema_slope_bars]
    btc_regime_lookup = pd.DataFrame({
        'datetime': btc_df['datetime'],
        'btc_bull': (btc_c > btc_sma200) & (btc_slope > gate_cfg["btc_ema_slope_min"]),
        'btc_bear': (btc_c < btc_sma200) & (btc_slope < -gate_cfg["btc_ema_slope_min"])
    }).set_index('datetime')

    raw_candidates = []

    for symbol in assets:
        df = load_candles(symbol, timeframe)
        funding_df = load_funding_rates(symbol) if cost_cfg.get("use_binance_funding_history") else None

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

        # 20-bar Donchian High/Low shifted by 1 bar (bars t-20 to t-1)
        dh = pd.Series(h).shift(1).rolling(donchian_n).max().values
        dl = pd.Series(l).shift(1).rolling(donchian_n).min().values

        # 10-bar Lowest Low / Highest High shifted by 1 bar (bars t-10 to t-1)
        ll10 = pd.Series(l).shift(1).rolling(stop_cfg["lookback_bars"]).min().values
        hh10 = pd.Series(h).shift(1).rolling(stop_cfg["lookback_bars"]).max().values

        # Vectorized True Range & Wilder ATR-14
        prev_c = np.roll(c, 1)
        prev_c[0] = c[0]
        tr = np.maximum(h - l, np.maximum(np.abs(h - prev_c), np.abs(l - prev_c)))
        atr14 = pd.Series(tr).rolling(atr_n).mean().values

        # Vectorized BTC Regime Gate Alignment for Altcoins
        if gate_cfg["enabled_for_alts"] and symbol != "BTCUSDT":
            merged = pd.merge_asof(df[['datetime']], btc_regime_lookup.reset_index(), on='datetime', direction='backward')
            btc_bull_arr = merged['btc_bull'].fillna(False).values
            btc_bear_arr = merged['btc_bear'].fillna(False).values
        else:
            btc_bull_arr = np.ones(n, dtype=bool)
            btc_bear_arr = np.ones(n, dtype=bool)

        # Merge daily context if active
        if daily_lookup is not None:
            m_daily = pd.merge_asof(df[['datetime']], daily_lookup.reset_index(), on='datetime', direction='backward')
            d_sma200_arr = m_daily['d_sma200'].values
            mayer_arr = m_daily['mayer'].values
            mayer_90p_arr = m_daily['mayer_90p'].values
            cowen_risk_arr = m_daily['cowen_risk'].values
        else:
            d_sma200_arr = np.zeros(n)
            mayer_arr = np.zeros(n)
            mayer_90p_arr = np.full(n, 999.0)
            cowen_risk_arr = np.zeros(n)

        # SMC Causal Swing Triggers if requested
        smc_triggers = {}
        if trigger_type in ['smc_bos_retest', 'smc_sfp_sweep']:
            swing_len = 5
            confirmed_sh = []
            confirmed_sl = []
            pending_retests = []
            for t_bar in range(swing_len * 2, n - max_hold_bars - 2):
                s_check = t_bar - swing_len
                if h[s_check] == np.max(h[s_check - swing_len : s_check + swing_len + 1]):
                    confirmed_sh.append({'idx': s_check, 'price': h[s_check]})
                    if len(confirmed_sh) > 5: confirmed_sh.pop(0)
                elif l[s_check] == np.min(l[s_check - swing_len : s_check + swing_len + 1]):
                    confirmed_sl.append({'idx': s_check, 'price': l[s_check]})
                    if len(confirmed_sl) > 5: confirmed_sl.pop(0)

                if not confirmed_sh or not confirmed_sl: continue
                last_sh = confirmed_sh[-1]['price']
                last_sl = confirmed_sl[-1]['price']

                if trigger_type == 'smc_sfp_sweep':
                    if h[t_bar] > last_sh and c[t_bar] < last_sh:
                        smc_triggers[t_bar] = -1
                    elif l[t_bar] < last_sl and c[t_bar] > last_sl:
                        smc_triggers[t_bar] = 1
                elif trigger_type == 'smc_bos_retest':
                    if c[t_bar] > last_sh and c[t_bar-1] <= last_sh:
                        pending_retests.append({'level': last_sh, 'dir': 1, 'expires': t_bar + 24, 'bar': t_bar})
                    elif c[t_bar] < last_sl and c[t_bar-1] >= last_sl:
                        pending_retests.append({'level': last_sl, 'dir': -1, 'expires': t_bar + 24, 'bar': t_bar})

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

        last_exit_bar = -1

        for t in range(200, n - max_hold_bars - 2):
            if t <= last_exit_bar:
                continue

            cur_c = c[t]
            cur_atr = atr14[t]
            sig_dt = pd.to_datetime(dts[t])
            if np.isnan(sma200[t]) or cur_atr <= 0:
                continue

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

            # Direction filter
            if direction_mode == "LONG" and not rule_long: continue
            if direction_mode == "SHORT" and not rule_short: continue

            # BTC Regime Gate for Altcoins (ETH)
            if gate_cfg["enabled_for_alts"] and symbol != "BTCUSDT":
                if rule_long and not btc_bull_arr[t]: continue
                if rule_short and not btc_bear_arr[t]: continue

            # Rule: EMA50 Slope over 10 bars
            ema_slope = (ema50[t] - ema50[t - ema_slope_bars]) / ema50[t - ema_slope_bars]
            if rule_long and ema_slope <= ema_slope_thresh: continue
            if rule_short and ema_slope >= -ema_slope_thresh: continue

            # Rule: Rubber band stretch cap
            stretch = abs(cur_c - ema50[t]) / cur_atr
            if stretch > stretch_mult: continue

            # Rule: Decisive candle body & Quality close in top/bottom 40%
            c_range = h[t] - l[t]
            if c_range <= 0: continue
            body = abs(cur_c - o[t])
            if (body / cur_atr) < min_body_ratio: continue
            if rule_long and (cur_c - l[t]) < close_q_ratio * c_range: continue
            if rule_short and (h[t] - cur_c) < close_q_ratio * c_range: continue

            # Rule: Volume confirmation
            if v[t] < vol_mult * v_mean50[t]: continue

            # Extended Variant Filters (V3, V4, V5)
            if use_daily_sma:
                if rule_long and cur_c <= d_sma200_arr[t]: continue
                if rule_short and cur_c >= d_sma200_arr[t]: continue
            if use_mayer_gate:
                if rule_long and mayer_arr[t] > mayer_90p_arr[t]: continue
            if use_cowen_gate:
                if rule_long and cowen_risk_arr[t] > cowen_thresh: continue

            direction = "LONG" if rule_long else "SHORT"
            is_long = (direction == "LONG")

            # EXECUTION REALISM: Fill strictly at Open of bar t+1
            entry_idx = t + 1
            entry_price = o[entry_idx]
            entry_dt = pd.to_datetime(dts[entry_idx])

            # Stop distance calculation based on entry price and 10-bar structural level
            if is_long:
                raw_stop = (entry_price - ll10[t]) / entry_price
            else:
                raw_stop = (hh10[t] - entry_price) / entry_price

            is_outside_clamp = (raw_stop < min_stop_pct) or (raw_stop > max_stop_pct)

            if clamp_mode == "skip" and is_outside_clamp:
                continue  # Primary spec: Skip trade if outside 2.3% - 6.0% window

            stop_dist = np.clip(raw_stop, min_stop_pct, max_stop_pct)

            # Initial Stop Loss Price
            initial_sl = entry_price * (1.0 - stop_dist) if is_long else entry_price * (1.0 + stop_dist)

            # Chandelier Trailing Stop Simulation (3x ATR)
            # Updated only from the NEXT bar after entry; takes effect on next bar.
            active_stop = initial_sl
            anchor_close = entry_price
            exit_bar = max_hold_bars
            exit_type = "TIME"
            exit_price = c[entry_idx + max_hold_bars]
            exit_dt = pd.to_datetime(dts[entry_idx + max_hold_bars])
            be_activated = False

            for bar in range(0, max_hold_bars + 1):
                idx = entry_idx + bar
                b_o = o[idx]
                b_h = h[idx]
                b_l = l[idx]
                b_c = c[idx]
                b_atr = atr14[idx]

                # Breakeven ratchet check (V1, V2)
                if breakeven_r is not None and not be_activated:
                    if is_long:
                        cur_ur = (b_h - entry_price) / (entry_price * stop_dist)
                        if cur_ur >= breakeven_r:
                            be_level = entry_price * (1.0 + taker_friction)
                            if be_level > active_stop:
                                active_stop = be_level
                                be_activated = True
                    else:
                        cur_ur = (entry_price - b_l) / (entry_price * stop_dist)
                        if cur_ur >= breakeven_r:
                            be_level = entry_price * (1.0 - taker_friction)
                            if be_level < active_stop:
                                active_stop = be_level
                                be_activated = True

                # 1. Evaluate Stop on Current Bar against active_stop
                if is_long:
                    if b_l <= active_stop:
                        # Execution realism: gap open below stop fills at open, else at active_stop
                        exit_price = min(b_o, active_stop)
                        exit_bar = bar
                        exit_type = "STOP" if active_stop == initial_sl else "TRAIL"
                        exit_dt = pd.to_datetime(dts[idx])
                        break
                else:
                    if b_h >= active_stop:
                        exit_price = max(b_o, active_stop)
                        exit_bar = bar
                        exit_type = "STOP" if active_stop == initial_sl else "TRAIL"
                        exit_dt = pd.to_datetime(dts[idx])
                        break

                # 2. Update Trailing Stop at Close of Bar (takes effect starting next bar)
                if is_long:
                    if b_c > anchor_close: anchor_close = b_c
                    cand_sl = anchor_close - chandelier_mult * b_atr
                    if cand_sl > active_stop:
                        active_stop = cand_sl
                else:
                    if b_c < anchor_close: anchor_close = b_c
                    cand_sl = anchor_close + chandelier_mult * b_atr
                    if cand_sl < active_stop:
                        active_stop = cand_sl

            # Calculate Gross R
            if is_long:
                raw_return = (exit_price - entry_price) / entry_price
            else:
                raw_return = (entry_price - exit_price) / entry_price
            gross_r = raw_return / stop_dist

            # Costs in R units
            fee_r = taker_friction / stop_dist
            funding_pct = calculate_real_funding(symbol, entry_dt, exit_dt, direction, funding_df, funding_fallback_long)
            funding_r = funding_pct / stop_dist

            net_r = gross_r - fee_r - funding_r

            raw_candidates.append({
                'symbol': symbol,
                'direction': direction,
                'signal_time': sig_dt.strftime('%Y-%m-%d %H:%M:%S'),
                'entry_time': entry_dt.strftime('%Y-%m-%d %H:%M:%S'),
                'exit_time': exit_dt.strftime('%Y-%m-%d %H:%M:%S'),
                'entry_price': round(entry_price, 4),
                'stop_pct': round(stop_dist, 5),
                'risk_inr': round(risk_inr, 2),
                'exit_type': exit_type,
                'gross_r': round(gross_r, 4),
                'fee_r': round(fee_r, 4),
                'funding_r': round(funding_r, 4),
                'net_r': round(net_r, 4),
                'clamped_flag': is_outside_clamp,
                'entry_dt': entry_dt,
                'exit_dt': exit_dt
            })
            last_exit_bar = entry_idx + exit_bar

    return raw_candidates

def apply_portfolio_constraints(candidates, max_open_risk_pct=2.0, max_positions=2):
    # Sort chronologically by entry time
    sorted_cands = sorted(candidates, key=lambda x: x['entry_dt'])
    accepted = []
    active = []

    for c in sorted_cands:
        c_entry = c['entry_dt']
        # Remove positions that exited on or before candidate's entry
        active = [p for p in active if p['exit_dt'] > c_entry]

        # Check total concurrent open risk / positions
        if len(active) >= max_positions:
            continue

        accepted.append(c)
        active.append(c)

    return accepted

def block_bootstrap_ci(net_rs, block_size=10, n_bootstraps=1000, alpha=0.05, seed=42):
    np.random.seed(seed)
    n = len(net_rs)
    if n < block_size:
        return np.mean(net_rs), np.mean(net_rs)

    n_blocks = int(np.ceil(n / block_size))
    # Create overlapping blocks
    blocks = [net_rs[i:i + block_size] for i in range(n - block_size + 1)]
    boot_means = []

    for _ in range(n_bootstraps):
        chosen_indices = np.random.choice(len(blocks), size=n_blocks, replace=True)
        sampled = np.concatenate([blocks[idx] for idx in chosen_indices])[:n]
        boot_means.append(np.mean(sampled))

    lower = np.percentile(boot_means, 100 * (alpha / 2))
    upper = np.percentile(boot_means, 100 * (1 - alpha / 2))
    return lower, upper

def compute_metrics(trades, label="PORTFOLIO"):
    if not trades:
        return None

    # Sort trades by exit time to compute true equity curve
    trades_by_exit = sorted(trades, key=lambda x: x['exit_dt'])
    n = len(trades)
    net_rs = np.array([t['net_r'] for t in trades])
    gross_rs = np.array([t['gross_r'] for t in trades])
    net_pnls = net_rs * 70.0 # INR 70 per 1R risk

    wins = [t for t in trades if t['net_r'] > 0]
    losses = [t for t in trades if t['net_r'] <= 0]
    win_rate = (len(wins) / n) * 100

    sum_wins_inr = sum(t['net_r'] * 70.0 for t in wins)
    sum_losses_inr = abs(sum(t['net_r'] * 70.0 for t in losses)) if losses else 1.0
    profit_factor = sum_wins_inr / sum_losses_inr if sum_losses_inr > 0 else 0.0

    mean_net_r = np.mean(net_rs)
    ci_lower, ci_upper = block_bootstrap_ci(net_rs, block_size=10, n_bootstraps=1000)

    avg_win_r = np.mean([t['net_r'] for t in wins]) if wins else 0.0
    avg_loss_r = np.mean([t['net_r'] for t in losses]) if losses else 0.0

    # Exit type percentages
    stop_cnt = sum(1 for t in trades if t['exit_type'] == "STOP")
    trail_cnt = sum(1 for t in trades if t['exit_type'] == "TRAIL")
    time_cnt = sum(1 for t in trades if t['exit_type'] == "TIME")

    # Equity Curve & Drawdown
    equity = 7000.0
    peak = equity
    max_dd_inr = 0.0
    max_dd_pct = 0.0
    equity_curve = [equity]

    for t in trades_by_exit:
        equity += t['net_r'] * 70.0
        equity_curve.append(equity)
        if equity > peak: peak = equity
        dd_inr = peak - equity
        dd_pct = (dd_inr / peak) * 100 if peak > 0 else 0
        if dd_inr > max_dd_inr: max_dd_inr = dd_inr
        if dd_pct > max_dd_pct: max_dd_pct = dd_pct

    # Indian 30% Tax on gross winning trades (no loss offset)
    gross_gains_inr = sum_wins_inr
    tax_30_pct = gross_gains_inr * 0.30
    total_net_pnl = sum(net_pnls)
    after_tax_pnl = total_net_pnl - tax_30_pct

    # Note: 1% TDS on trade turnover
    # Position size in INR = 70.0 / stop_pct. TDS is 1% on notional trade turnover
    tds_1pct_approx = sum((70.0 / t['stop_pct']) * 0.01 for t in trades)

    return {
        'label': label,
        'trades': n,
        'win_rate': win_rate,
        'profit_factor': profit_factor,
        'mean_net_r': mean_net_r,
        'ci_lower': ci_lower,
        'ci_upper': ci_upper,
        'avg_win_r': avg_win_r,
        'avg_loss_r': avg_loss_r,
        'stop_pct_exits': (stop_cnt / n) * 100,
        'trail_pct_exits': (trail_cnt / n) * 100,
        'time_pct_exits': (time_cnt / n) * 100,
        'total_net_pnl': total_net_pnl,
        'final_equity': equity,
        'max_dd_inr': max_dd_inr,
        'max_dd_pct': max_dd_pct,
        'gross_gains_inr': gross_gains_inr,
        'gross_losses_inr': sum_losses_inr,
        'tax_30_pct': tax_30_pct,
        'after_tax_pnl': after_tax_pnl,
        'tds_1pct_approx': tds_1pct_approx,
        'clamped_trades_pct': (sum(1 for t in trades if t['clamped_flag']) / n) * 100,
        'trades_list': trades_by_exit
    }

def print_metrics_table(m):
    print(f"\n=========================================================================================")
    print(f"REPORT: {m['label']}")
    print(f"=========================================================================================")
    print(f"Total Portfolio Trades:       {m['trades']}")
    print(f"Win Rate:                     {m['win_rate']:.1f}%")
    print(f"Profit Factor:                {m['profit_factor']:.2f}")
    print(f"Mean Net R per Trade:         {m['mean_net_r']:+.4f}R")
    print(f"95% Block-Bootstrap CI (B=10): [{m['ci_lower']:+.4f}R, {m['ci_upper']:+.4f}R]")
    print(f"Avg Win / Loss R:             Win: {m['avg_win_r']:+.3f}R | Loss: {m['avg_loss_r']:+.3f}R")
    print(f"Exit Type Breakdown:          STOP: {m['stop_pct_exits']:.1f}% | TRAIL: {m['trail_pct_exits']:.1f}% | TIME: {m['time_pct_exits']:.1f}%")
    print(f"Total Net PnL (Pre-Tax):      ₹{m['total_net_pnl']:+,.2f} on ₹7,000 Starting Capital")
    print(f"Max Equity Drawdown:          ₹{m['max_dd_inr']:,.2f} ({m['max_dd_pct']:.2f}%)")
    print(f"Final Account Equity:         ₹{m['final_equity']:,.2f}")
    print(f"Indian Section 115BBH Tax:    Gross Gains: ₹{m['gross_gains_inr']:,.2f} | 30% Flat Tax: ₹{m['tax_30_pct']:,.2f}")
    print(f"Net PnL After 30% Tax:        ₹{m['after_tax_pnl']:+,.2f}")
    print(f"Note on 1% TDS Turnover Drag: Estimated ₹{m['tds_1pct_approx']:,.2f} if applicable on local exchange")
    print(f"Clamped Stop Flag:            {m['clamped_trades_pct']:.1f}% of trades touched clamp bounds")

def run_split_and_granular_reports(trades):
    # Splits: DEV 2020-01-01 to 2023-12-31, TEST 2024-01-01 to 2026-10-31
    dev_trades = [t for t in trades if t['entry_dt'] < pd.to_datetime('2024-01-01')]
    test_trades = [t for t in trades if (t['entry_dt'] >= pd.to_datetime('2024-01-01')) and (t['entry_dt'] <= pd.to_datetime('2026-10-31 23:59:59'))]

    m_dev = compute_metrics(dev_trades, "DEV SPLIT (2020-01-01 to 2023-12-31)")
    m_test = compute_metrics(test_trades, "TEST SPLIT (2024-01-01 to 2026-10-31)")

    print(f"\n=========================================================================================")
    print(f"STABILITY SPLIT BREAKDOWN (DEV vs TEST)")
    print(f"Note: Whole history was explored in earlier studies; this verifies stability only.")
    print(f"True sealed out-of-sample is forward paper trading initiated after 2026-10-31.")
    print(f"=========================================================================================")
    print(f"| {'Split Period':30s} | {'Trades':7s} | {'Win Rate':9s} | {'PF':5s} | {'Mean Net R (95% CI)':28s} | {'Net PnL (INR)':14s} |")
    print(f"|{'-'*32}|{'-'*9}|{'-'*11}|{'-'*7}|{'-'*30}|{'-'*16}|")
    for m in [m_dev, m_test]:
        ci_str = f"[{m['ci_lower']:+.3f}, {m['ci_upper']:+.3f}]"
        print(f"| {m['label']:30s} | {m['trades']:7d} | {m['win_rate']:8.1f}% | {m['profit_factor']:5.2f} | {m['mean_net_r']:+7.3f}R {ci_str:18s} | ₹{m['total_net_pnl']:+12.2f} |")

    # Per-Year Breakdown
    print(f"\n=========================================================================================")
    print(f"PER-YEAR PERFORMANCE AUDIT")
    print(f"=========================================================================================")
    years = sorted(list(set(t['entry_dt'].year for t in trades)))
    print(f"| {'Year':6s} | {'Trades':7s} | {'Win Rate':9s} | {'PF':5s} | {'Mean Net R':11s} | {'Pre-Tax PnL':13s} | {'After-Tax PnL':14s} |")
    print(f"|{'-'*8}|{'-'*9}|{'-'*11}|{'-'*7}|{'-'*13}|{'-'*15}|{'-'*16}|")
    for yr in years:
        yr_t = [t for t in trades if t['entry_dt'].year == yr]
        m_yr = compute_metrics(yr_t, str(yr))
        print(f"| {str(yr):6s} | {m_yr['trades']:7d} | {m_yr['win_rate']:8.1f}% | {m_yr['profit_factor']:5.2f} | {m_yr['mean_net_r']:+10.3f}R | ₹{m_yr['total_net_pnl']:+11.2f} | ₹{m_yr['after_tax_pnl']:+12.2f} |")

    # Per-Asset Breakdown
    print(f"\n=========================================================================================")
    print(f"PER-ASSET BREAKDOWN")
    print(f"=========================================================================================")
    for a in sorted(list(set(t['symbol'] for t in trades))):
        a_t = [t for t in trades if t['symbol'] == a]
        m_a = compute_metrics(a_t, a)
        print(f"| {a:8s} | {m_a['trades']:7d} trades | Win%: {m_a['win_rate']:5.1f}% | PF: {m_a['profit_factor']:4.2f} | Mean Net R: {m_a['mean_net_r']:+7.3f}R | Net PnL: ₹{m_a['total_net_pnl']:+9.2f} | After-Tax: ₹{m_a['after_tax_pnl']:+9.2f} |")

    # Long vs Short Breakdown
    print(f"\n=========================================================================================")
    print(f"DIRECTIONAL BREAKDOWN: LONG vs SHORT")
    print(f"=========================================================================================")
    for d in ["LONG", "SHORT"]:
        d_t = [t for t in trades if t['direction'] == d]
        if d_t:
            m_d = compute_metrics(d_t, d)
            print(f"| {d:6s} | {m_d['trades']:7d} trades | Win%: {m_d['win_rate']:5.1f}% | PF: {m_d['profit_factor']:4.2f} | Mean Net R: {m_d['mean_net_r']:+7.3f}R | Net PnL: ₹{m_d['total_net_pnl']:+9.2f} |")

if __name__ == "__main__":
    print("=========================================================================================")
    print("PHASE 1: REFERENCE BACKTEST FOR 100% FIXED-RULE 4H ENGINE (PRIMARY SPEC)")
    print("Reading from: config/fixed_rule_4h_v1.json")
    print("=========================================================================================")

    out_dir = os.path.join(BASE_DIR, "experiments", "fixed_rule_4h_v2")
    os.makedirs(out_dir, exist_ok=True)

    # 1. PRIMARY RUN: clamp_mode = "skip", direction = "BOTH"
    cfg_primary = load_config(override_clamp_mode="skip", override_direction="BOTH")
    raw_primary = run_candidate_generator(cfg_primary)
    port_primary = apply_portfolio_constraints(raw_primary, max_open_risk_pct=2.0, max_positions=2)
    m_primary = compute_metrics(port_primary, "PRIMARY SPEC (clamp_mode='skip', direction='BOTH')")
    print_metrics_table(m_primary)

    # Save Trade Log CSV
    trade_fields = [
        'symbol', 'direction', 'signal_time', 'entry_time', 'exit_time',
        'entry_price', 'stop_pct', 'risk_inr', 'exit_type', 'gross_r',
        'fee_r', 'funding_r', 'net_r', 'clamped_flag'
    ]
    csv_path = os.path.join(out_dir, "trades_fixed_rule_4h.csv")
    df_trades = pd.DataFrame(m_primary['trades_list'])[trade_fields]
    df_trades.to_csv(csv_path, index=False)
    print(f"\nSaved trade log CSV to: {csv_path} ({len(df_trades)} trades)")

    run_split_and_granular_reports(port_primary)

    # 2. COMPARISON RUNS: Clamp vs Skip & Long vs Short variants
    print(f"\n=========================================================================================")
    print(f"VARIANT COMPARISONS (CLAMP vs SKIP & DIRECTION VARIANTS)")
    print(f"=========================================================================================")
    variants = [
        ("clamp_mode='skip', dir='BOTH' [PRIMARY]", "skip", "BOTH"),
        ("clamp_mode='clamp', dir='BOTH'", "clamp", "BOTH"),
        ("clamp_mode='skip', dir='LONG'", "skip", "LONG"),
        ("clamp_mode='skip', dir='SHORT'", "skip", "SHORT"),
        ("clamp_mode='clamp', dir='LONG'", "clamp", "LONG"),
        ("clamp_mode='clamp', dir='SHORT'", "clamp", "SHORT")
    ]
    print(f"| {'Variant Description':40s} | {'Trades':7s} | {'Win Rate':9s} | {'PF':5s} | {'Mean Net R':11s} | {'Pre-Tax PnL':13s} | {'Max DD%':7s} |")
    print(f"|{'-'*42}|{'-'*9}|{'-'*11}|{'-'*7}|{'-'*13}|{'-'*15}|{'-'*9}|")
    for desc, c_mode, d_mode in variants:
        cfg_v = load_config(override_clamp_mode=c_mode, override_direction=d_mode)
        cands_v = run_candidate_generator(cfg_v)
        port_v = apply_portfolio_constraints(cands_v)
        m_v = compute_metrics(port_v, desc)
        if m_v:
            print(f"| {desc[:40]:40s} | {m_v['trades']:7d} | {m_v['win_rate']:8.1f}% | {m_v['profit_factor']:5.2f} | {m_v['mean_net_r']:+10.4f}R | ₹{m_v['total_net_pnl']:+11.2f} | {m_v['max_dd_pct']:6.2f}% |")
