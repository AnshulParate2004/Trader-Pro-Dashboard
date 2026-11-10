#!/usr/bin/env python3
"""
experiments/wider_universe/run_wider_universe_backtest.py

Wider Universe Execution Engine for Frozen Fixed-Rule 4H Engine (fixed_rule_4h_v1).
Evaluates:
  1. DESIGN Universe: BTC, ETH (Baseline)
  2. SEEN Universe: SOL, DOT, XAU, XAG, CL
  3. UNTOUCHED Universe: BNB, XRP, ADA, AVAX, LINK, DOGE, NEAR
  4. ALL Universe: All 14 assets combined

Under Pre-Registered Portfolio Constraints:
  - 1% risk per trade (₹70 on ₹7,000 capital)
  - Max 3% total open risk (max 3 concurrent open positions)
  - Causal rolling 90-day correlation clustering (r > 0.70)
  - Max 2 concurrent open positions per correlation cluster
  - Real Binance 8-hour funding rates & 11.44 bps taker friction
  - Primary evaluation window: 2022-01-01 to 2026-10-31 (58 calendar months)
"""

import os
import sys
import json
import numpy as np
import pandas as pd
from datetime import datetime

sys.stdout.reconfigure(encoding='utf-8')

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
BASE_DIR = os.path.abspath(os.path.join(CURRENT_DIR, "../.."))
ROOT_DIR = os.path.abspath(os.path.join(BASE_DIR, ".."))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from experiments.wider_universe.loader import (
    load_candles, load_funding_rates, calculate_real_funding,
    UNIVERSE_DESIGN, UNIVERSE_SEEN, UNIVERSE_UNTOUCHED, UNIVERSE_ALL,
    COMMODITY_ASSETS, CRYPTO_ALTS
)

CONFIG_PATH = os.path.join(BASE_DIR, "config", "fixed_rule_4h_v1.json")
if not os.path.exists(CONFIG_PATH):
    CONFIG_PATH = os.path.join(ROOT_DIR, "config", "fixed_rule_4h_v1.json")


def load_config():
    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def precompute_btc_regime(cfg):
    gate_cfg = cfg.get("btc_regime_gate", {})
    btc_df = load_candles(gate_cfg.get("btc_symbol", "BTCUSDT"))
    c = btc_df['close'].values.astype(float)
    n = len(btc_df)

    sma200 = pd.Series(c).rolling(gate_cfg.get("btc_sma_period", 200)).mean().values
    ema50 = pd.Series(c).ewm(span=gate_cfg.get("btc_ema_period", 50), adjust=False).mean().values
    ema_slope_bars = gate_cfg.get("btc_ema_slope_bars", 10)
    ema_slope = np.zeros(n)
    ema_slope[ema_slope_bars:] = (ema50[ema_slope_bars:] - ema50[:-ema_slope_bars]) / ema50[:-ema_slope_bars]

    btc_bull = (c > sma200) & (ema_slope > gate_cfg.get("btc_ema_slope_min", 0.0))
    btc_bear = (c < sma200) & (ema_slope < -gate_cfg.get("btc_ema_slope_min", 0.0))

    regime_df = pd.DataFrame({
        'datetime': btc_df['datetime'],
        'btc_bull': btc_bull,
        'btc_bear': btc_bear
    }).set_index('datetime')
    return regime_df


def generate_asset_candidates(symbol, cfg, btc_regime_lookup):
    df = load_candles(symbol)
    c = df['close'].values.astype(float)
    h = df['high'].values.astype(float)
    l = df['low'].values.astype(float)
    o = df['open'].values.astype(float)
    v = df['volume'].values.astype(float) if 'volume' in df.columns else np.ones(len(df))
    dts = df['datetime'].values
    n = len(df)

    # Config parameters
    donchian_lookback = cfg["entry"]["donchian_lookback"]
    sma_filter_period = cfg["entry"]["sma_filter_period"]
    ema_period = cfg["filters"]["ema_period"]
    ema_slope_bars = cfg["filters"]["ema_slope_bars"]
    ema_slope_threshold = cfg["filters"]["ema_slope_threshold"]
    stretch_atr_mult = cfg["filters"]["stretch_atr_mult"]
    min_body_atr_ratio = cfg["filters"]["min_body_atr_ratio"]
    close_quantile_ratio = cfg["filters"]["close_quantile_ratio"]
    min_volume_mult = cfg["filters"]["min_volume_mult"]
    volume_sma_period = cfg["filters"]["volume_sma_period"]
    atr_period = cfg["filters"]["atr_period"]
    stop_lookback = cfg["stop"]["lookback_bars"]
    min_stop_pct = cfg["stop"]["min_stop_pct"]
    max_stop_pct = cfg["stop"]["max_stop_pct"]
    clamp_mode = cfg["stop"].get("clamp_mode", "skip")
    chandelier_mult = cfg["exit"]["chandelier_atr_mult"]
    chandelier_period = cfg["exit"]["chandelier_atr_period"]
    max_hold_bars = cfg["exit"]["max_hold_bars"]
    taker_friction = cfg["costs"]["taker_round_trip_friction"]
    funding_fallback_long = cfg["costs"].get("funding_rate_fallback_8h_long", 0.0001)

    # Indicator series
    sma200 = pd.Series(c).rolling(sma_filter_period).mean().values
    ema50 = pd.Series(c).ewm(span=ema_period, adjust=False).mean().values
    v_mean50 = pd.Series(v).rolling(volume_sma_period).mean().values

    dh = pd.Series(h).shift(1).rolling(donchian_lookback).max().values
    dl = pd.Series(l).shift(1).rolling(donchian_lookback).min().values

    ll_stop = pd.Series(l).shift(1).rolling(stop_lookback).min().values
    hh_stop = pd.Series(h).shift(1).rolling(stop_lookback).max().values

    prev_c = np.roll(c, 1)
    prev_c[0] = c[0]
    tr = np.maximum(h - l, np.maximum(np.abs(h - prev_c), np.abs(l - prev_c)))
    atr14 = pd.Series(tr).rolling(atr_period).mean().values

    ema_slope = np.zeros(n)
    ema_slope[ema_slope_bars:] = (ema50[ema_slope_bars:] - ema50[:-ema_slope_bars]) / ema50[:-ema_slope_bars]

    # BTC regime check: Crypto alts gated, commodities & BTC exempt
    is_commodity = symbol in COMMODITY_ASSETS
    is_crypto_alt = symbol in CRYPTO_ALTS
    gate_enabled = cfg["btc_regime_gate"]["enabled_for_alts"] and is_crypto_alt

    if gate_enabled:
        merged = pd.merge_asof(df[['datetime']], btc_regime_lookup.reset_index(), on='datetime', direction='backward')
        btc_bull_arr = merged['btc_bull'].fillna(False).values
        btc_bear_arr = merged['btc_bear'].fillna(False).values
    else:
        btc_bull_arr = np.ones(n, dtype=bool)
        btc_bear_arr = np.ones(n, dtype=bool)

    funding_df = load_funding_rates(symbol)

    start_idx = max(sma_filter_period, 50, donchian_lookback + 1)
    candidates = []

    last_exit_bar = -1

    for i in range(start_idx, n - max_hold_bars - 2):
        if i <= last_exit_bar:
            continue

        c_close = c[i]
        c_open = o[i]
        c_high = h[i]
        c_low = l[i]
        c_atr = atr14[i]
        c_vol = v[i]

        if np.isnan(c_atr) or c_atr <= 0:
            continue

        # Stretch & Body filters
        stretch = abs(c_close - ema50[i]) / c_atr
        if stretch > stretch_atr_mult:
            continue

        body_ratio = abs(c_close - c_open) / c_atr
        if body_ratio < min_body_atr_ratio:
            continue

        candle_range = c_high - c_low
        if candle_range <= 0:
            continue

        vol_benchmark = min_volume_mult * v_mean50[i]
        if c_vol < vol_benchmark:
            continue

        rel_vol_ratio = c_vol / (v_mean50[i] if v_mean50[i] > 0 else 1.0)

        # Long Signal
        long_rule = (c_close > sma200[i]) and (c_close > dh[i])
        long_filter = (ema_slope[i] > ema_slope_threshold) and ((c_close - c_low) / candle_range >= close_quantile_ratio)
        long_gate = btc_bull_arr[i]
        sig_long = long_rule and long_filter and long_gate

        # Short Signal
        short_rule = (c_close < sma200[i]) and (c_close < dl[i])
        short_filter = (ema_slope[i] < -ema_slope_threshold) and ((c_high - c_close) / candle_range >= close_quantile_ratio)
        short_gate = btc_bear_arr[i]
        sig_short = short_rule and short_filter and short_gate

        if not (sig_long or sig_short):
            continue

        direction = "LONG" if sig_long else "SHORT"
        is_long = (direction == "LONG")

        sig_dt = pd.to_datetime(dts[i])
        entry_idx = i + 1
        entry_price = o[entry_idx]
        entry_dt = pd.to_datetime(dts[entry_idx])

        # Stop loss calculation
        if is_long:
            raw_stop = (entry_price - ll_stop[i]) / entry_price
        else:
            raw_stop = (hh_stop[i] - entry_price) / entry_price

        is_outside_clamp = (raw_stop < min_stop_pct) or (raw_stop > max_stop_pct)
        if clamp_mode == "skip" and is_outside_clamp:
            continue

        stop_dist = np.clip(raw_stop, min_stop_pct, max_stop_pct)
        initial_sl = entry_price * (1.0 - stop_dist) if is_long else entry_price * (1.0 + stop_dist)

        # Chandelier Trailing Exit Simulation
        active_stop = initial_sl
        anchor_close = entry_price
        exit_bar = max_hold_bars
        exit_type = "TIME"
        exit_price = c[entry_idx + max_hold_bars]
        exit_dt = pd.to_datetime(dts[entry_idx + max_hold_bars])

        for bar in range(0, max_hold_bars + 1):
            idx = entry_idx + bar
            b_o = o[idx]
            b_h = h[idx]
            b_l = l[idx]
            b_c = c[idx]
            b_atr = atr14[idx]

            # Stop hit check (Stop First ambiguity)
            if is_long:
                if b_l <= active_stop:
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

            # Update chandelier stop at bar close
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

        # Returns & Costs
        raw_return = (exit_price - entry_price) / entry_price if is_long else (entry_price - exit_price) / entry_price
        gross_r = raw_return / stop_dist
        fee_r = taker_friction / stop_dist
        funding_pct = calculate_real_funding(symbol, entry_dt, exit_dt, direction, funding_df, funding_fallback_long)
        funding_r = funding_pct / stop_dist
        net_r = gross_r - fee_r - funding_r

        candidates.append({
            'symbol': symbol,
            'direction': direction,
            'signal_time': sig_dt.strftime('%Y-%m-%d %H:%M:%S'),
            'entry_time': entry_dt.strftime('%Y-%m-%d %H:%M:%S'),
            'exit_time': exit_dt.strftime('%Y-%m-%d %H:%M:%S'),
            'entry_price': round(entry_price, 4),
            'stop_pct': round(stop_dist, 5),
            'exit_type': exit_type,
            'gross_r': round(gross_r, 4),
            'fee_r': round(fee_r, 4),
            'funding_r': round(funding_r, 4),
            'net_r': round(net_r, 4),
            'clamped_flag': is_outside_clamp,
            'entry_dt': entry_dt,
            'exit_dt': exit_dt,
            'vol_ratio': rel_vol_ratio
        })
        last_exit_bar = entry_idx + exit_bar

    return candidates


# Cache 4H returns for correlation calculation
RETURNS_CACHE = {}

def get_asset_returns(symbol):
    if symbol in RETURNS_CACHE:
        return RETURNS_CACHE[symbol]
    df = load_candles(symbol)
    rets = pd.Series(np.log(df['close'].astype(float) / df['close'].astype(float).shift(1)).values,
                     index=df['datetime']).dropna()
    RETURNS_CACHE[symbol] = rets
    return rets


def compute_causal_correlation(sym_a, sym_b, entry_dt, window_days=90):
    """
    Computes pairwise return correlation over the past 90 calendar days strictly prior to entry_dt.
    """
    r_a = get_asset_returns(sym_a)
    r_b = get_asset_returns(sym_b)

    cutoff_start = entry_dt - pd.Timedelta(days=window_days)
    sub_a = r_a[(r_a.index >= cutoff_start) & (r_a.index < entry_dt)]
    sub_b = r_b[(r_b.index >= cutoff_start) & (r_b.index < entry_dt)]

    # Align common timestamps
    common = pd.concat([sub_a, sub_b], axis=1, join='inner').dropna()
    if len(common) < 60: # Minimum sample
        # Default: crypto with crypto is correlated, crypto with commodity is uncorrelated
        if (sym_a in COMMODITY_ASSETS) ^ (sym_b in COMMODITY_ASSETS):
            return 0.10
        elif (sym_a in COMMODITY_ASSETS) and (sym_b in COMMODITY_ASSETS):
            return 0.60
        else:
            return 0.80

    corr = np.corrcoef(common.iloc[:, 0].values, common.iloc[:, 1].values)[0, 1]
    return 0.0 if np.isnan(corr) else corr


def apply_portfolio_risk_rules(all_candidates, max_total_positions=3, max_cluster_positions=2, corr_thresh=0.70):
    """
    Applies:
      1. Chronological event simulation.
      2. Deterministic simultaneous signal tie-breaking (vol_ratio desc, symbol asc).
      3. Total open risk cap (max_total_positions = 3).
      4. Causal 90-day correlation clustering cap (max_cluster_positions = 2).
    """
    # Deterministic sort: entry_dt asc, vol_ratio desc, symbol asc
    sorted_cands = sorted(all_candidates, key=lambda x: (x['entry_dt'], -x['vol_ratio'], x['symbol']))
    accepted = []
    active = []

    for cand in sorted_cands:
        c_entry = cand['entry_dt']
        c_sym = cand['symbol']

        # 1. Prune expired positions
        active = [p for p in active if p['exit_dt'] > c_entry]

        # 2. Total open risk cap (3%)
        if len(active) >= max_total_positions:
            continue

        # 3. Correlation Clustering check
        # Count how many currently active positions are in the same cluster (corr > 0.70)
        same_cluster_count = 0
        for act in active:
            act_sym = act['symbol']
            if act_sym == c_sym:
                same_cluster_count += 1
            else:
                corr = compute_causal_correlation(c_sym, act_sym, c_entry)
                if corr > corr_thresh:
                    same_cluster_count += 1

        if same_cluster_count >= max_cluster_positions:
            continue

        accepted.append(cand)
        active.append(cand)

    return accepted


def block_bootstrap_monthly_ci(monthly_r_series, block_size=3, n_bootstraps=10000, alpha=0.05, seed=42):
    np.random.seed(seed)
    n = len(monthly_r_series)
    if n < block_size:
        return np.mean(monthly_r_series), np.mean(monthly_r_series)

    n_blocks = int(np.ceil(n / block_size))
    blocks = [monthly_r_series[i:i + block_size] for i in range(n - block_size + 1)]
    boot_means = []

    for _ in range(n_bootstraps):
        chosen_indices = np.random.choice(len(blocks), size=n_blocks, replace=True)
        sampled = np.concatenate([blocks[idx] for idx in chosen_indices])[:n]
        boot_means.append(np.mean(sampled))

    lower_pct = 100 * (alpha / 2.0)
    upper_pct = 100 * (1.0 - alpha / 2.0)
    return float(np.percentile(boot_means, lower_pct)), float(np.percentile(boot_means, upper_pct))


def compute_metrics(trades, universe_name, start_date='2022-01-01', end_date='2026-10-31',
                    starting_capital=7000.0, risk_per_trade_inr=70.0):
    # Filter by date range
    sub = [t for t in trades if (t['entry_dt'] >= pd.to_datetime(start_date)) and (t['entry_dt'] <= pd.to_datetime(end_date))]
    n_trades = len(sub)

    months_list = pd.date_range(start_date, end_date, freq='MS').strftime('%Y-%m').tolist()
    n_months = len(months_list)

    if n_trades == 0:
        return {
            'universe': universe_name, 'n_trades': 0, 'trades_per_year': 0.0,
            'win_rate': 0.0, 'profit_factor': 0.0, 'mean_net_r': 0.0,
            'total_r_month': 0.0, 'ci_lower': 0.0, 'ci_upper': 0.0,
            'total_net_pnl': 0.0, 'portfolio_return_pct': 0.0,
            'max_dd_inr': 0.0, 'max_dd_pct': 0.0,
            'gross_gains_inr': 0.0, 'tax_30_pct': 0.0, 'after_tax_pnl': 0.0,
            'verdict': 'FAIL (No Trades)'
        }

    net_rs = np.array([t['net_r'] for t in sub])
    gross_rs = np.array([t['gross_r'] for t in sub])

    wins = net_rs[net_rs > 0]
    losses = net_rs[net_rs <= 0]
    win_rate = 100.0 * len(wins) / n_trades

    sum_wins = np.sum(wins) if len(wins) > 0 else 0.0
    sum_losses = np.sum(np.abs(losses)) if len(losses) > 0 else 0.0
    pf = (sum_wins / sum_losses) if sum_losses > 0 else 999.0

    # Monthly Net R aggregation
    df_t = pd.DataFrame(sub)
    df_t['exit_dt'] = pd.to_datetime(df_t['exit_time'])
    df_t['month'] = df_t['exit_dt'].dt.strftime('%Y-%m')
    monthly_r = df_t.groupby('month')['net_r'].sum().reindex(months_list, fill_value=0.0).values

    mean_monthly_r = float(np.mean(monthly_r))
    ci_low, ci_high = block_bootstrap_monthly_ci(monthly_r, block_size=3, n_bootstraps=10000, alpha=0.05)

    # Financial Equity Curve & Tax
    years = n_months / 12.0
    trades_per_year = n_trades / years

    equity = starting_capital
    peak = starting_capital
    max_dd_inr = 0.0
    max_dd_pct = 0.0

    pnl_inr_list = []
    gross_gains_inr = 0.0

    for t in sub:
        trade_pnl = t['net_r'] * risk_per_trade_inr
        pnl_inr_list.append(trade_pnl)
        if trade_pnl > 0:
            gross_gains_inr += trade_pnl

        equity += trade_pnl
        if equity > peak:
            peak = equity
        dd_inr = peak - equity
        dd_pct = (dd_inr / peak) * 100.0 if peak > 0 else 0.0
        if dd_inr > max_dd_inr: max_dd_inr = dd_inr
        if dd_pct > max_dd_pct: max_dd_pct = dd_pct

    total_net_pnl = equity - starting_capital
    portfolio_return_pct = (total_net_pnl / starting_capital) * 100.0
    tax_30_pct = gross_gains_inr * 0.30
    after_tax_pnl = total_net_pnl - tax_30_pct

    # Pre-registered Verdict: PASS requires PF >= 1.20 and CI_lower > 0
    passed = (pf >= 1.20) and (ci_low > 0.0)
    verdict = "PASS" if passed else "FAIL"

    return {
        'universe': universe_name,
        'n_trades': n_trades,
        'trades_per_year': round(trades_per_year, 1),
        'win_rate': round(win_rate, 1),
        'profit_factor': round(pf, 2),
        'mean_net_r': round(float(np.mean(net_rs)), 4),
        'total_r_month': round(mean_monthly_r, 4),
        'ci_lower': round(ci_low, 4),
        'ci_upper': round(ci_high, 4),
        'total_net_pnl': round(total_net_pnl, 2),
        'portfolio_return_pct': round(portfolio_return_pct, 2),
        'max_dd_inr': round(max_dd_inr, 2),
        'max_dd_pct': round(max_dd_pct, 2),
        'gross_gains_inr': round(gross_gains_inr, 2),
        'tax_30_pct': round(tax_30_pct, 2),
        'after_tax_pnl': round(after_tax_pnl, 2),
        'verdict': verdict,
        'trades_list': sub
    }


def run_experiment():
    cfg = load_config()
    print("=" * 80)
    print("WIDER UNIVERSE MULTI-ASSET PORTFOLIO BACKTEST (FROZEN fixed_rule_4h_v1)")
    print(f"Reading configuration from: {CONFIG_PATH}")
    print("Primary Evaluation Window: 2022-01-01 to 2026-10-31 (58 calendar months)")
    print("=" * 80)

    # 1. Precompute BTC Regime
    print("\nPrecomputing causal BTC regime gate...")
    btc_regime = precompute_btc_regime(cfg)
    print(f"BTC regime table computed: {len(btc_regime)} 4H periods.")

    # 2. Candidate Generation for all 14 assets
    print("\nGenerating candidate trades across all 14 assets...")
    candidates_by_asset = {}
    for sym in UNIVERSE_ALL:
        cands = generate_asset_candidates(sym, cfg, btc_regime)
        candidates_by_asset[sym] = cands
        print(f"  {sym:10s}: {len(cands):4d} raw candidate trades")

    # 3. Assemble Universes
    universes = {
        'DESIGN (BTC, ETH)': UNIVERSE_DESIGN,
        'SEEN (SOL, DOT, XAU, XAG, CL)': UNIVERSE_SEEN,
        'UNTOUCHED (BNB, XRP, ADA, AVAX, LINK, DOGE, NEAR)': UNIVERSE_UNTOUCHED,
        'ALL (14 Assets Combined)': UNIVERSE_ALL
    }

    results = {}
    out_dir = os.path.join(BASE_DIR, "experiments", "wider_universe")
    os.makedirs(out_dir, exist_ok=True)

    print("\n" + "=" * 80)
    print("SIMULATING PORTFOLIO CONSTRAINTS & METRICS (2022-2026)")
    print("Risk cap: 3% total open risk | Cluster cap: max 2 positions per r > 0.70 cluster")
    print("=" * 80)

    for u_name, asset_list in universes.items():
        # Pool all candidates for this universe
        pooled = []
        for a in asset_list:
            pooled.extend(candidates_by_asset[a])

        # Apply portfolio constraints
        # For DESIGN, max positions is 2 (only 2 assets exist)
        max_pos = 2 if u_name.startswith('DESIGN') else 3
        port_trades = apply_portfolio_risk_rules(pooled, max_total_positions=max_pos, max_cluster_positions=2)

        m = compute_metrics(port_trades, u_name, start_date='2022-01-01', end_date='2026-10-31')
        results[u_name] = m

        # Save trade log
        safe_name = u_name.split()[0].lower()
        csv_file = os.path.join(out_dir, f"trades_{safe_name}.csv")
        pd.DataFrame(m['trades_list']).to_csv(csv_file, index=False)
        print(f"Saved {len(m['trades_list'])} trades to {csv_file}")

    # Master Report Table
    print("\n" + "=" * 105)
    print("MASTER SUMMARY TABLE: WIDER UNIVERSE PERFORMANCE (2022-01-01 to 2026-10-31)")
    print("=" * 105)
    headers = f"| {'Universe':35s} | {'N Trades':8s} | {'Total R/mo (95% CI)':25s} | {'PF':5s} | {'Max DD (INR / %)':18s} | {'After-Tax PnL':14s} | {'Verdict':7s} |"
    print(headers)
    print("|" + "-"*37 + "|" + "-"*10 + "|" + "-"*27 + "|" + "-"*7 + "|" + "-"*20 + "|" + "-"*16 + "|" + "-"*9 + "|")

    for u_name, m in results.items():
        ci_str = f"{m['total_r_month']:+.3f} [{m['ci_lower']:+.3f}, {m['ci_upper']:+.3f}]"
        dd_str = f"₹{m['max_dd_inr']:,.0f} ({m['max_dd_pct']:.1f}%)"
        pnl_str = f"₹{m['after_tax_pnl']:+,.2f}"
        print(f"| {u_name:35s} | {m['n_trades']:8d} | {ci_str:25s} | {m['profit_factor']:5.2f} | {dd_str:18s} | {pnl_str:14s} | {m['verdict']:7s} |")

    # Detailed Breakdown for UNTOUCHED Assets
    print("\n" + "=" * 80)
    print("INDIVIDUAL ASSET BREAKDOWN: UNTOUCHED UNIVERSE (2022-2026)")
    print("=" * 80)
    for sym in UNIVERSE_UNTOUCHED:
        sym_cands = candidates_by_asset[sym]
        m_sym = compute_metrics(sym_cands, sym, start_date='2022-01-01', end_date='2026-10-31')
        print(f"| {sym:10s} | {m_sym['n_trades']:3d} trades | Win%: {m_sym['win_rate']:4.1f}% | PF: {m_sym['profit_factor']:4.2f} | Net R/mo: {m_sym['total_r_month']:+6.3f}R | Pre-Tax: ₹{m_sym['total_net_pnl']:+8.2f} | After-Tax: ₹{m_sym['after_tax_pnl']:+8.2f} |")

    # Full History Report (2020-2026) for Universes with available data
    print("\n" + "=" * 105)
    print("FULL HISTORY REFERENCE (2020-01-01 to 2026-10-31, 82 months)")
    print("Note: ADA, AVAX, LINK, DOGE, NEAR start 2022-01-01; full history includes all available bars.")
    print("=" * 105)
    print(headers)
    print("|" + "-"*37 + "|" + "-"*10 + "|" + "-"*27 + "|" + "-"*7 + "|" + "-"*20 + "|" + "-"*16 + "|" + "-"*9 + "|")
    for u_name, asset_list in universes.items():
        pooled = []
        for a in asset_list:
            pooled.extend(candidates_by_asset[a])
        max_pos = 2 if u_name.startswith('DESIGN') else 3
        port_trades = apply_portfolio_risk_rules(pooled, max_total_positions=max_pos, max_cluster_positions=2)
        m_full = compute_metrics(port_trades, u_name, start_date='2020-01-01', end_date='2026-10-31')
        ci_str = f"{m_full['total_r_month']:+.3f} [{m_full['ci_lower']:+.3f}, {m_full['ci_upper']:+.3f}]"
        dd_str = f"₹{m_full['max_dd_inr']:,.0f} ({m_full['max_dd_pct']:.1f}%)"
        pnl_str = f"₹{m_full['after_tax_pnl']:+,.2f}"
        print(f"| {u_name:35s} | {m_full['n_trades']:8d} | {ci_str:25s} | {m_full['profit_factor']:5.2f} | {dd_str:18s} | {pnl_str:14s} | {m_full['verdict']:7s} |")

    return results


if __name__ == "__main__":
    run_experiment()
