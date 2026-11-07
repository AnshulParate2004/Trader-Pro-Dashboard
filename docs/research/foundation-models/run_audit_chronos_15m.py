import os, sys, time, math, json, urllib.request, joblib
import numpy as np
import pandas as pd
from scipy import stats
import torch
from chronos import ChronosBoltPipeline
import timesfm

CONFIG = {
    "CONTEXT_LENGTH": 128,
    "MIN_EXPANDING_HIST": 500,
    "PRIMARY_HORIZON": 1,
    "K_STEP": 1,
    "TEST_RATIO": 0.20,
    "BOOTSTRAP_BLOCK_LEN": 20,
    "BOOTSTRAP_ROUNDS": 1000,
    "EWMA_LAMBDA": 0.94,
    "BATCH_SIZE": 32,
    "BONFERRONI_ALPHA": 0.01,
}

def predict_ewma(series, lam=0.94):
    w = (1.0 - lam) * (lam ** np.arange(len(series) - 1, -1, -1))
    return float(np.sum(w * series) / np.sum(w))

def compute_qlike_vec(act_var, pred_var):
    a = np.maximum(act_var, 1e-8)
    p = np.maximum(pred_var, 1e-8)
    return np.log(p) + (a / p)

def evaluate_paired_diff(loss_base, loss_model, B=1000, L=20, seed=42):
    # loss difference d_t = loss_model_t - loss_base_t
    # If d < 0, model has lower loss (model is better)
    d = np.array(loss_model) - np.array(loss_base)
    n = len(d)
    mean_diff = float(np.mean(d))
    
    rng = np.random.default_rng(seed)
    boot_means = []
    for b in range(B):
        idx = []
        while len(idx) < n:
            start = rng.integers(0, n)
            curr = start
            for _ in range(L):
                if len(idx) >= n:
                    break
                idx.append(curr)
                curr = (curr + 1) % n
        boot_means.append(np.mean(d[idx]))
    ci_lower = float(np.percentile(boot_means, 2.5))
    ci_upper = float(np.percentile(boot_means, 97.5))
    
    # Newey-West HAC DM test
    d_demean = d - mean_diff
    gamma0 = np.var(d, ddof=1)
    gamma_sum = 0.0
    for l in range(1, 6):
        weight = 1.0 - (l / 6.0)
        autocov = np.sum(d_demean[l:] * d_demean[:-l]) / n
        gamma_sum += 2.0 * weight * autocov
    lr_var = max(gamma0 + gamma_sum, 1e-12)
    dm_stat = mean_diff / np.sqrt(lr_var / n)
    p_val = float(2.0 * (1.0 - stats.norm.cdf(abs(dm_stat))))
    
    return mean_diff, ci_lower, ci_upper, p_val

def calc_pinball(y_true, y_pred, tau):
    err = y_true - y_pred
    return float(np.mean(np.maximum(tau * err, (tau - 1.0) * err)))

# ==============================================================================
# PART 1: CHRONOS-BOLT VS TIMESFM VS EWMA ON SAME LOCAL DATA & CPU
# ==============================================================================
def run_foundation_benchmark():
    print("="*75)
    print("PART 1: CHRONOS-BOLT vs TIMESFM vs EWMA ON IDENTICAL LOCAL DATA & CPU")
    print("="*75)
    
    # Fetch Binance Daily Data
    base_url = "https://api.binance.com/api/v3/klines"
    start_ts = int(pd.Timestamp("2018-01-01", tz="UTC").timestamp() * 1000)
    all_bars = []
    curr_ts = start_ts
    headers = {"User-Agent": "Mozilla/5.0"}
    while True:
        url = f"{base_url}?symbol=BTCUSDT&interval=1d&startTime={curr_ts}&limit=1000"
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read().decode())
            if not data:
                break
            all_bars.extend(data)
            curr_ts = data[-1][6] + 1
            if len(data) < 1000:
                break
        except Exception as e:
            print(f"Error fetching klines: {e}")
            break
            
    df = pd.DataFrame(all_bars, columns=[
        "open_time", "open", "high", "low", "close", "volume",
        "close_time", "quote_volume", "trades", "taker_buy_base", "taker_buy_quote", "ignore"
    ])
    df["timestamp"] = pd.to_datetime(df["open_time"], unit="ms", utc=True)
    for c in ["open", "high", "low", "close", "volume"]:
        df[c] = df[c].astype(float)
    df = df.sort_values("timestamp").drop_duplicates(subset=["timestamp"]).reset_index(drop=True)
    
    log_hl = np.log(df["high"] / df["low"]) ** 2
    log_co = np.log(df["close"] / df["open"]) ** 2
    gk_var = 0.5 * log_hl - (2.0 * np.log(2.0) - 1.0) * log_co
    df["realized_var"] = np.maximum(gk_var, 1e-8)
    df["log_ret"] = np.log(df["close"] / df["close"].shift(1)).fillna(0.0)
    df["close_var"] = df["log_ret"] ** 2
    df = df.iloc[:-1].reset_index(drop=True)
    
    CTX = CONFIG["CONTEXT_LENGTH"]
    MIN_HIST = CONFIG["MIN_EXPANDING_HIST"]
    H = CONFIG["PRIMARY_HORIZON"]
    
    all_origins = list(range(MIN_HIST, len(df) - H, CONFIG["K_STEP"]))[-2730:]
    n_dev = int(len(all_origins) * (1.0 - CONFIG["TEST_RATIO"]))
    dev_origins = all_origins[:n_dev]
    holdout_origins = all_origins[n_dev:]
    
    print(f"Total origins: {len(all_origins)} (Dev: {len(dev_origins)}, Holdout: {len(holdout_origins)})")
    
    # Load Models
    print("Loading ChronosBoltPipeline (amazon/chronos-bolt-base)...")
    pipe_chronos = ChronosBoltPipeline.from_pretrained(
        "amazon/chronos-bolt-base", device_map="cpu", torch_dtype=torch.float32
    )
    
    print("Loading TimesFM 2.5 (google/timesfm-2.5-200m-pytorch)...")
    timesfm_dir = r"C:\Users\Kaizen\.cache\models\timesfm-2.5-200m-pytorch"
    pipe_timesfm = timesfm.TimesFM_2p5_200M_torch.from_pretrained(timesfm_dir, torch_compile=False)
    fc = timesfm.ForecastConfig(max_context=128, max_horizon=1, per_core_batch_size=32)
    pipe_timesfm.compile(fc)
    
    results = {}
    
    for split_name, origins in [("Dev", dev_origins), ("Holdout", holdout_origins)]:
        print(f"\n--- Running Inference on {split_name} ({len(origins)} origins) ---")
        prices = df["close"].values
        gk_vars = df["realized_var"].values
        close_vars = df["close_var"].values
        
        ctx_list = [prices[o - CTX : o + 1] for o in origins]
        act_ret = np.array([np.log(prices[o + 1] / prices[o]) for o in origins])
        act_var = np.array([gk_vars[o + 1] for o in origins])
        act_prices = np.array([prices[o + 1] for o in origins])
        last_prices = np.array([prices[o] for o in origins])
        
        # Baselines
        ewma_rv_preds = np.array([predict_ewma(gk_vars[: o + 1], lam=CONFIG["EWMA_LAMBDA"]) for o in origins])
        ewma_close_preds = np.array([predict_ewma(close_vars[: o + 1], lam=CONFIG["EWMA_LAMBDA"]) for o in origins])
        
        ewma_rv_qlike = compute_qlike_vec(act_var, ewma_rv_preds)
        ewma_close_qlike = compute_qlike_vec(act_var, ewma_close_preds)
        
        # 1. Chronos Inference
        print("  Evaluating Chronos-Base...")
        t0 = time.time()
        chronos_q10, chronos_q50, chronos_q90 = [], [], []
        for b in range(0, len(ctx_list), CONFIG["BATCH_SIZE"]):
            batch_inputs = [torch.tensor(x, dtype=torch.float32) for x in ctx_list[b : b + CONFIG["BATCH_SIZE"]]]
            with torch.no_grad():
                # quantiles: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]
                fc_out = pipe_chronos.predict(batch_inputs, prediction_length=1)  # (B, 9, 1)
            fc_np = fc_out.numpy()
            chronos_q10.extend(fc_np[:, 0, 0])
            chronos_q50.extend(fc_np[:, 4, 0])
            chronos_q90.extend(fc_np[:, 8, 0])
        chronos_q10 = np.array(chronos_q10)
        chronos_q50 = np.array(chronos_q50)
        chronos_q90 = np.array(chronos_q90)
        print(f"  Chronos done in {time.time()-t0:.1f}s")
        
        # 2. TimesFM Inference
        print("  Evaluating TimesFM 2.5...")
        t0 = time.time()
        pt_fc, q_fc = pipe_timesfm.forecast(horizon=1, inputs=ctx_list)
        timesfm_q10 = q_fc[:, 0, 1]
        timesfm_q50 = q_fc[:, 0, 5]
        timesfm_q90 = q_fc[:, 0, 9]
        print(f"  TimesFM done in {time.time()-t0:.1f}s")
        
        # Chronos Metrics
        ch_ret = np.log(chronos_q50 / last_prices)
        ch_vol = np.log(np.maximum(chronos_q90, 1e-4) / np.maximum(chronos_q10, 1e-4)) / 2.5631
        ch_var = np.maximum(ch_vol ** 2, 1e-8)
        ch_qlike = compute_qlike_vec(act_var, ch_var)
        
        ch_corr = (np.sign(ch_ret) == np.sign(act_ret))
        ch_da = float(np.mean(ch_corr) * 100.0)
        ch_binom_p = float(stats.binomtest(int(np.sum(ch_corr)), len(ch_corr), 0.5).pvalue)
        ch_ic = float(np.corrcoef(ch_ret, act_ret)[0, 1])
        ch_mae_bps = float(np.mean(np.abs(ch_ret - act_ret)) * 10000.0)
        _, _, _, ch_dm_zero_p = evaluate_paired_diff(np.abs(act_ret), np.abs(ch_ret - act_ret))
        
        ch_cov = float(np.mean((act_prices >= chronos_q10) & (act_prices <= chronos_q90)) * 100.0)
        ch_l10 = calc_pinball(act_prices, chronos_q10, 0.10) / np.mean(last_prices) * 10000.0
        ch_l50 = calc_pinball(act_prices, chronos_q50, 0.50) / np.mean(last_prices) * 10000.0
        ch_l90 = calc_pinball(act_prices, chronos_q90, 0.90) / np.mean(last_prices) * 10000.0
        
        # TimesFM Metrics
        tf_ret = np.log(timesfm_q50 / last_prices)
        tf_vol = np.log(np.maximum(timesfm_q90, 1e-4) / np.maximum(timesfm_q10, 1e-4)) / 2.5631
        tf_var = np.maximum(tf_vol ** 2, 1e-8)
        tf_qlike = compute_qlike_vec(act_var, tf_var)
        
        tf_corr = (np.sign(tf_ret) == np.sign(act_ret))
        tf_da = float(np.mean(tf_corr) * 100.0)
        tf_binom_p = float(stats.binomtest(int(np.sum(tf_corr)), len(tf_corr), 0.5).pvalue)
        tf_ic = float(np.corrcoef(tf_ret, act_ret)[0, 1])
        tf_mae_bps = float(np.mean(np.abs(tf_ret - act_ret)) * 10000.0)
        _, _, _, tf_dm_zero_p = evaluate_paired_diff(np.abs(act_ret), np.abs(tf_ret - act_ret))
        
        tf_cov = float(np.mean((act_prices >= timesfm_q10) & (act_prices <= timesfm_q90)) * 100.0)
        tf_l10 = calc_pinball(act_prices, timesfm_q10, 0.10) / np.mean(last_prices) * 10000.0
        tf_l50 = calc_pinball(act_prices, timesfm_q50, 0.50) / np.mean(last_prices) * 10000.0
        tf_l90 = calc_pinball(act_prices, timesfm_q90, 0.90) / np.mean(last_prices) * 10000.0
        
        # Paired Tests
        # Chronos vs EWMA_RV
        ch_ewma_diff, ch_ewma_ci_l, ch_ewma_ci_u, ch_ewma_p = evaluate_paired_diff(ewma_rv_qlike, ch_qlike)
        # TimesFM vs EWMA_RV
        tf_ewma_diff, tf_ewma_ci_l, tf_ewma_ci_u, tf_ewma_p = evaluate_paired_diff(ewma_rv_qlike, tf_qlike)
        # TimesFM vs Chronos (loss_model=tf_qlike, loss_base=ch_qlike: diff = tf_qlike - ch_qlike)
        tf_ch_diff, tf_ch_ci_l, tf_ch_ci_u, tf_ch_p = evaluate_paired_diff(ch_qlike, tf_qlike)
        
        results[split_name] = {
            "n_obs": len(origins),
            "ewma_rv_qlike": float(np.mean(ewma_rv_qlike)),
            "ewma_close_qlike": float(np.mean(ewma_close_qlike)),
            "chronos": {
                "qlike": float(np.mean(ch_qlike)),
                "diff_vs_ewma_rv": ch_ewma_diff,
                "ci_vs_ewma_rv": [ch_ewma_ci_l, ch_ewma_ci_u],
                "p_vs_ewma_rv": ch_ewma_p,
                "da_pct": ch_da,
                "binom_p": ch_binom_p,
                "ic": ch_ic,
                "mae_bps": ch_mae_bps,
                "dm_zero_p": ch_dm_zero_p,
                "cov_80": ch_cov,
                "pinball_q10": ch_l10,
                "pinball_q50": ch_l50,
                "pinball_q90": ch_l90,
                "pinball_mean": float(np.mean([ch_l10, ch_l50, ch_l90]))
            },
            "timesfm": {
                "qlike": float(np.mean(tf_qlike)),
                "diff_vs_ewma_rv": tf_ewma_diff,
                "ci_vs_ewma_rv": [tf_ewma_ci_l, tf_ewma_ci_u],
                "p_vs_ewma_rv": tf_ewma_p,
                "da_pct": tf_da,
                "binom_p": tf_binom_p,
                "ic": tf_ic,
                "mae_bps": tf_mae_bps,
                "dm_zero_p": tf_dm_zero_p,
                "cov_80": tf_cov,
                "pinball_q10": tf_l10,
                "pinball_q50": tf_l50,
                "pinball_q90": tf_l90,
                "pinball_mean": float(np.mean([tf_l10, tf_l50, tf_l90]))
            },
            "timesfm_vs_chronos_paired": {
                "qlike_diff": tf_ch_diff, # negative means TimesFM has lower loss
                "95_ci": [tf_ch_ci_l, tf_ch_ci_u],
                "dm_p_value": tf_ch_p
            }
        }
    return results

# ==============================================================================
# PART 2: 15M ENGINE AT 14 BPS TIER + NOISE-NULL
# ==============================================================================
def run_15m_14bps_test():
    print("\n" + "="*75)
    print("PART 2: 15M SCALPING ENGINE AT 14 BPS TIER (0.14% ROUND-TRIP FRICTION)")
    print("="*75)
    
    MODEL_PATH = r"D:\Projects_Main\Trade-Pro\Trader-Pro-Dashboard\src\models\15m\final_model_BTCUSDT_15m.joblib"
    FEAT_PATH = r"C:\Users\Kaizen\.gemini\antigravity\brain\2a5d3b65-201a-47b6-8a7f-ad98e7c6f21d\scratch\features_15m.parquet"
    
    m_bundle = joblib.load(MODEL_PATH)
    mL, mS = m_bundle["model_long"], m_bundle["model_short"]
    features, thr_long, thr_short = m_bundle["features"], m_bundle["thr_long"], m_bundle["thr_short"]
    tp_atr = float(m_bundle.get("tp_atr", 2.0))
    sl_atr = float(m_bundle.get("sl_atr", 1.0))
    horizon = int(m_bundle.get("horizon", 24))
    
    df = pd.read_parquet(FEAT_PATH)
    df["open_time"] = pd.to_datetime(df["open_time"], utc=True)
    
    valid = ~df[["atr_pct", "rsi14", "ema_dist_50", "vol_z", "bb_pctb", "macd_hist"]].isna().any(axis=1)
    pL = np.full(len(df), np.nan)
    pS = np.full(len(df), np.nan)
    pL[valid] = mL.predict_proba(df.loc[valid, features])[:, 1]
    pS[valid] = mS.predict_proba(df.loc[valid, features])[:, 1]
    df["pL"] = pL
    df["pS"] = pS
    
    # Strict simulator function
    def simulate_strict(op, hi, lo, cl, at, times, sig_long, sig_short, pL_arr, pS_arr, 
                        thr_L=0.6315, thr_S=0.6405, tp_mult=2.0, sl_mult=1.0, 
                        horizon_bars=24, fee_bps=14.0):
        n = len(op)
        trades = []
        busy = -1
        cost_frac = fee_bps * 1e-4
        
        for t in range(n - 1):
            if t < busy:
                continue
            sL = bool(sig_long[t])
            sS = bool(sig_short[t])
            if not sL and not sS:
                continue
            if sL and sS:
                side = 1 if (pL_arr[t] - thr_L) >= (pS_arr[t] - thr_S) else -1
            elif sL:
                side = 1
            else:
                side = -1
                
            entry_idx = t + 1
            if entry_idx >= n:
                break
            p_entry = op[entry_idx]
            a0 = at[t]
            if np.isnan(a0) or a0 <= 0 or p_entry <= 0:
                continue
                
            delta_stop = sl_mult * a0
            delta_tp = tp_mult * a0
            stop_pct = delta_stop / p_entry
            cost_R = cost_frac / stop_pct
            
            if side == 1:
                p_stop = p_entry - delta_stop
                p_target = p_entry + delta_tp
            else:
                p_stop = p_entry + delta_stop
                p_target = p_entry - delta_tp
                
            max_idx = min(entry_idx + horizon_bars - 1, n - 1)
            resolved = False
            exit_idx = max_idx
            gross_R = 0.0
            exit_type = "horizon"
            
            for tau in range(entry_idx, max_idx + 1):
                h_tau = hi[tau]
                l_tau = lo[tau]
                if side == 1:
                    # Strict priority: stop checked before target
                    if l_tau <= p_stop:
                        resolved = True
                        exit_idx = tau
                        gross_R = -1.0
                        exit_type = "stop"
                        break
                    if h_tau >= p_target:
                        resolved = True
                        exit_idx = tau
                        gross_R = 2.0
                        exit_type = "target"
                        break
                else:
                    if h_tau >= p_stop:
                        resolved = True
                        exit_idx = tau
                        gross_R = -1.0
                        exit_type = "stop"
                        break
                    if l_tau <= p_target:
                        resolved = True
                        exit_idx = tau
                        gross_R = 2.0
                        exit_type = "target"
                        break
                        
            if not resolved:
                p_exit = cl[max_idx]
                if side == 1:
                    gross_R = (p_exit - p_entry) / delta_stop
                else:
                    gross_R = (p_entry - p_exit) / delta_stop
                    
            net_R = gross_R - cost_R
            busy = exit_idx
            trades.append({
                "entry_bar": entry_idx,
                "entry_time": times[entry_idx] if times is not None else entry_idx,
                "exit_bar": exit_idx,
                "side": side,
                "p_entry": p_entry,
                "stop_pct": stop_pct,
                "gross_R": gross_R,
                "cost_R": cost_R,
                "net_R": net_R,
                "exit_type": exit_type
            })
        return pd.DataFrame(trades)

    op = df["open"].values
    hi = df["high"].values
    lo = df["low"].values
    cl = df["close"].values
    at = df["atr"].values
    times = df["open_time"].values
    pL_arr = df["pL"].values
    pS_arr = df["pS"].values

    # Signals
    sigL_pure = (pL_arr > thr_long)
    sigS_pure = (pS_arr > thr_short)
    
    # Run 14 bps simulation on Real Trades
    tr_pure_14 = simulate_strict(op, hi, lo, cl, at, times, sigL_pure, sigS_pure, pL_arr, pS_arr, fee_bps=14.0)
    
    # Partition: <= 2026-10-31 is exploratory, > 2026-10-31 is OOS
    tr_pure_14["entry_time"] = pd.to_datetime(tr_pure_14["entry_time"], utc=True)
    cutoff = pd.Timestamp("2026-10-31 23:59:59+00:00")
    exp_mask = tr_pure_14["entry_time"] <= cutoff
    oos_mask = tr_pure_14["entry_time"] > cutoff
    
    def calc_boot_ci(series, B=1000, L=20, seed=42):
        vals = np.array(series)
        n = len(vals)
        if n == 0:
            return 0.0, 0.0, 0.0
        rng = np.random.default_rng(seed)
        boot_means = []
        for _ in range(B):
            idx = []
            while len(idx) < n:
                start = rng.integers(0, n)
                curr = start
                for _ in range(L):
                    if len(idx) >= n:
                        break
                    idx.append(curr)
                    curr = (curr + 1) % n
            boot_means.append(np.mean(vals[idx]))
        return float(np.mean(vals)), float(np.percentile(boot_means, 2.5)), float(np.percentile(boot_means, 97.5))

    # Real Metrics
    exp_net_mean, exp_ci_l, exp_ci_u = calc_boot_ci(tr_pure_14.loc[exp_mask, "net_R"])
    oos_net_mean, oos_ci_l, oos_ci_u = calc_boot_ci(tr_pure_14.loc[oos_mask, "net_R"])
    
    # Run 50 Zero-Drift Random Walks at 14 bps
    print("  Running 50 Zero-Drift Random Walks at 14 bps...")
    log_rets = np.log(cl[1:] / cl[:-1])
    sigma_15m = np.std(log_rets)
    p0 = cl[0]
    n_bars = len(cl)
    rw_net_means = []
    
    rng = np.random.default_rng(42)
    for sim in range(50):
        rw_eps = rng.standard_normal(n_bars)
        rw_close = p0 * np.exp(np.cumsum(sigma_15m * rw_eps))
        rw_open = np.roll(rw_close, 1)
        rw_open[0] = p0
        # synthetic high/low with realistic intra-bar spread
        bar_span = np.abs(rng.standard_normal(n_bars)) * sigma_15m * 0.7
        rw_high = np.maximum(rw_open, rw_close) + rw_close * bar_span
        rw_low = np.minimum(rw_open, rw_close) - rw_close * bar_span
        
        # Wilder ATR
        pc = np.roll(rw_close, 1)
        pc[0] = rw_close[0]
        tr = np.maximum(rw_high - rw_low, np.maximum(np.abs(rw_high - pc), np.abs(rw_low - pc)))
        rw_atr = np.empty_like(tr)
        rw_atr[0] = tr[0]
        for i in range(1, len(tr)):
            rw_atr[i] = (1.0 / 14.0) * tr[i] + (13.0 / 14.0) * rw_atr[i-1]
            
        # Random signal rate matching real engine
        rate_L = np.mean(sigL_pure)
        rate_S = np.mean(sigS_pure)
        rand_sL = rng.random(n_bars) < rate_L
        rand_sS = rng.random(n_bars) < rate_S
        
        tr_rw = simulate_strict(rw_open, rw_high, rw_low, rw_close, rw_atr, None,
                                rand_sL, rand_sS, np.zeros(n_bars), np.zeros(n_bars), fee_bps=14.0)
        if len(tr_rw) > 0:
            rw_net_means.append(np.mean(tr_rw["net_R"]))
            
    rw_null_mean = float(np.mean(rw_net_means))
    rw_null_se = float(np.std(rw_net_means) / np.sqrt(len(rw_net_means)))
    
    res_15m = {
        "fee_bps": 14.0,
        "noise_null": {
            "mean_net_R": rw_null_mean,
            "se_net_R": rw_null_se
        },
        "exploratory": {
            "n_trades": int(np.sum(exp_mask)),
            "gross_R": float(np.mean(tr_pure_14.loc[exp_mask, "gross_R"])),
            "mean_cost_R": float(np.mean(tr_pure_14.loc[exp_mask, "cost_R"])),
            "net_R": exp_net_mean,
            "ci_95": [exp_ci_l, exp_ci_u],
            "cost_R_dist": {
                "p10": float(np.percentile(tr_pure_14.loc[exp_mask, "cost_R"], 10)),
                "median": float(np.percentile(tr_pure_14.loc[exp_mask, "cost_R"], 50)),
                "p90": float(np.percentile(tr_pure_14.loc[exp_mask, "cost_R"], 90)),
                "mean": float(np.mean(tr_pure_14.loc[exp_mask, "cost_R"]))
            },
            "share_cost_gt_015": float(np.mean(tr_pure_14.loc[exp_mask, "cost_R"] > 0.15) * 100.0)
        },
        "oos": {
            "n_trades": int(np.sum(oos_mask)),
            "gross_R": float(np.mean(tr_pure_14.loc[oos_mask, "gross_R"])),
            "mean_cost_R": float(np.mean(tr_pure_14.loc[oos_mask, "cost_R"])),
            "net_R": oos_net_mean,
            "ci_95": [oos_ci_l, oos_ci_u],
            "cost_R_dist": {
                "p10": float(np.percentile(tr_pure_14.loc[oos_mask, "cost_R"], 10)),
                "median": float(np.percentile(tr_pure_14.loc[oos_mask, "cost_R"], 50)),
                "p90": float(np.percentile(tr_pure_14.loc[oos_mask, "cost_R"], 90)),
                "mean": float(np.mean(tr_pure_14.loc[oos_mask, "cost_R"]))
            },
            "share_cost_gt_015": float(np.mean(tr_pure_14.loc[oos_mask, "cost_R"] > 0.15) * 100.0)
        }
    }
    return res_15m

def main():
    res_foundation = run_foundation_benchmark()
    with open(r"C:\Users\Kaizen\.gemini\antigravity\brain\2a5d3b65-201a-47b6-8a7f-ad98e7c6f21d\scratch\foundation_results_identical.json", "w") as fp:
        json.dump(res_foundation, fp, indent=2)
    print("Foundation benchmark saved.")
    
    res_15m = run_15m_14bps_test()
    with open(r"C:\Users\Kaizen\.gemini\antigravity\brain\2a5d3b65-201a-47b6-8a7f-ad98e7c6f21d\scratch\15m_14bps_results.json", "w") as fp:
        json.dump(res_15m, fp, indent=2)
    
    out_all = {
        "foundation_benchmark": res_foundation,
        "15m_14bps_test": res_15m
    }
    
    out_path = r"C:\Users\Kaizen\.gemini\antigravity\brain\2a5d3b65-201a-47b6-8a7f-ad98e7c6f21d\scratch\audit_results_chronos_15m.json"
    with open(out_path, "w") as fp:
        json.dump(out_all, fp, indent=2)
    print(f"\nAll results saved to {out_path}")

if __name__ == "__main__":
    main()
