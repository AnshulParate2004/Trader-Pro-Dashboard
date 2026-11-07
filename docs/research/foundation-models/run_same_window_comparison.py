import os, sys, time, json, urllib.request, joblib
import numpy as np
import pandas as pd
from scipy import stats
import torch
from chronos import ChronosBoltPipeline
import timesfm

print("Initializing comparative benchmark on SAME window: 2024-11-01 to 2026-10-31...")

# ------------------------------------------------------------------------------
# 1. LOAD DATA
# ------------------------------------------------------------------------------
# A. Daily Data
base_url = "https://api.binance.com/api/v3/klines"
curr_ts = int(pd.Timestamp("2024-01-01", tz="UTC").timestamp() * 1000)
all_daily = []
headers = {"User-Agent": "Mozilla/5.0"}
while True:
    url = f"{base_url}?symbol=BTCUSDT&interval=1d&startTime={curr_ts}&limit=1000"
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode())
    if not data:
        break
    all_daily.extend(data)
    curr_ts = data[-1][6] + 1
    if len(data) < 1000:
        break

df_daily = pd.DataFrame(all_daily)
df_daily["open_time"] = pd.to_datetime(df_daily[0], unit="ms", utc=True)
df_daily["close_time"] = pd.to_datetime(df_daily[6], unit="ms", utc=True)
for c, name in enumerate(["open_time", "open", "high", "low", "close", "volume", "close_time"]):
    if name not in ["open_time", "close_time"]:
        df_daily[name] = df_daily[c].astype(float)
df_daily = df_daily.iloc[:-1].reset_index(drop=True)

# B. 15M Data & Model
MODEL_PATH = r"D:\Projects_Main\Trade-Pro\Trader-Pro-Dashboard\src\models\15m\final_model_BTCUSDT_15m.joblib"
FEAT_PATH = r"C:\Users\Kaizen\.gemini\antigravity\brain\2a5d3b65-201a-47b6-8a7f-ad98e7c6f21d\scratch\features_15m.parquet"

m_bundle = joblib.load(MODEL_PATH)
mL, mS = m_bundle["model_long"], m_bundle["model_short"]
features, thr_long, thr_short = m_bundle["features"], m_bundle["thr_long"], m_bundle["thr_short"]
tp_atr = float(m_bundle.get("tp_atr", 2.0))
sl_atr = float(m_bundle.get("sl_atr", 1.0))
horizon = int(m_bundle.get("horizon", 24))

df_15m = pd.read_parquet(FEAT_PATH)
df_15m["open_time"] = pd.to_datetime(df_15m["open_time"], utc=True)

valid = ~df_15m[["atr_pct", "rsi14", "ema_dist_50", "vol_z", "bb_pctb", "macd_hist"]].isna().any(axis=1)
pL = np.full(len(df_15m), np.nan)
pS = np.full(len(df_15m), np.nan)
pL[valid] = mL.predict_proba(df_15m.loc[valid, features])[:, 1]
pS[valid] = mS.predict_proba(df_15m.loc[valid, features])[:, 1]
df_15m["pL"] = pL
df_15m["pS"] = pS

# ------------------------------------------------------------------------------
# 2. STATISTICAL HELPER FUNCTIONS
# ------------------------------------------------------------------------------
def calc_mdd(equity_series):
    # equity_series: 1.0, 1.0 + r1, ...
    peaks = np.maximum.accumulate(equity_series)
    dds = (equity_series - peaks) / peaks
    return float(np.min(dds)) * 100.0

def block_bootstrap_ci(arr, B=1000, L=20, seed=42):
    vals = np.array(arr)
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

def calc_residual_alpha(strat_rets, btc_rets, nw_lags=20):
    # Regression: R_strat = alpha + beta * R_btc + e
    y = np.array(strat_rets)
    x = np.array(btc_rets)
    n = len(y)
    if n < 5 or np.std(x) < 1e-12 or np.all(y == 0):
        return {"alpha_ann_pct": 0.0, "beta": 0.0, "t_stat": 0.0, "p_val": 1.0, "ci_95": [0.0, 0.0]}
    
    X = np.column_stack([np.ones(n), x])
    # OLS
    beta_hat = np.linalg.lstsq(X, y, rcond=None)[0]
    alpha_daily = beta_hat[0]
    beta_btc = beta_hat[1]
    
    # Residuals
    e = y - (X @ beta_hat)
    
    # Newey-West HAC covariance
    # S = (1/n) * sum(e_t^2 * x_t * x_t') + sum_l (1 - l/(L+1)) * (e_t * e_{t-l} * (x_t * x_{t-l}' + ...))
    Xe = X * e[:, None]
    gamma0 = (Xe.T @ Xe) / n
    gamma_sum = np.zeros_like(gamma0)
    for l in range(1, nw_lags + 1):
        weight = 1.0 - (l / (nw_lags + 1.0))
        gamma_l = (Xe[l:].T @ Xe[:-l]) / n
        gamma_sum += weight * (gamma_l + gamma_l.T)
    
    V = np.linalg.inv(X.T @ X / n) @ (gamma0 + gamma_sum) @ np.linalg.inv(X.T @ X / n) / n
    se_alpha = np.sqrt(max(V[0, 0], 1e-12))
    
    t_stat = float(alpha_daily / se_alpha)
    p_val = float(2.0 * (1.0 - stats.norm.cdf(abs(t_stat))))
    
    # Annualized alpha (365 days)
    alpha_ann = float(alpha_daily * 365.0 * 100.0)
    alpha_ci_l = float((alpha_daily - 1.96 * se_alpha) * 365.0 * 100.0)
    alpha_ci_u = float((alpha_daily + 1.96 * se_alpha) * 365.0 * 100.0)
    
    return {
        "alpha_ann_pct": alpha_ann,
        "beta": float(beta_btc),
        "t_stat": t_stat,
        "p_val": p_val,
        "ci_95": [alpha_ci_l, alpha_ci_u]
    }

# ------------------------------------------------------------------------------
# 3. RUN 15M ENGINE (STRICT-FILL SIMULATOR)
# ------------------------------------------------------------------------------
print("Running 15M Strict-Fill Simulation...")

def simulate_15m_strict(df_sub, fee_bps=14.0):
    op = df_sub["open"].values
    hi = df_sub["high"].values
    lo = df_sub["low"].values
    cl = df_sub["close"].values
    at = df_sub["atr"].values
    times = df_sub["open_time"].values
    pL = df_sub["pL"].values
    pS = df_sub["pS"].values
    
    sigL = (pL > thr_long)
    sigS = (pS > thr_short)
    
    n = len(op)
    trades = []
    busy = -1
    cost_frac = fee_bps * 1e-4
    
    for t in range(n - 1):
        if t < busy:
            continue
        sL = bool(sigL[t])
        sS = bool(sigS[t])
        if not sL and not sS:
            continue
        if sL and sS:
            side = 1 if (pL[t] - thr_long) >= (pS[t] - thr_short) else -1
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
            
        delta_stop = sl_atr * a0
        delta_tp = tp_atr * a0
        stop_pct = delta_stop / p_entry
        cost_R = cost_frac / stop_pct
        
        if side == 1:
            p_stop = p_entry - delta_stop
            p_target = p_entry + delta_tp
        else:
            p_stop = p_entry + delta_stop
            p_target = p_entry - delta_tp
            
        max_idx = min(entry_idx + horizon - 1, n - 1)
        resolved = False
        exit_idx = max_idx
        gross_R = 0.0
        
        for tau in range(entry_idx, max_idx + 1):
            h_tau = hi[tau]
            l_tau = lo[tau]
            if side == 1:
                # Stop checked before target
                if l_tau <= p_stop:
                    resolved = True
                    exit_idx = tau
                    gross_R = -1.0
                    break
                if h_tau >= p_target:
                    resolved = True
                    exit_idx = tau
                    gross_R = 2.0
                    break
            else:
                if h_tau >= p_stop:
                    resolved = True
                    exit_idx = tau
                    gross_R = -1.0
                    break
                if l_tau <= p_target:
                    resolved = True
                    exit_idx = tau
                    gross_R = 2.0
                    break
                    
        if not resolved:
            p_exit = cl[max_idx]
            gross_R = ((p_exit - p_entry) if side == 1 else (p_entry - p_exit)) / delta_stop
            
        net_R = gross_R - cost_R
        busy = exit_idx
        trades.append({
            "entry_bar": entry_idx,
            "entry_time": times[entry_idx],
            "exit_bar": exit_idx,
            "exit_time": times[exit_idx],
            "side": side,
            "p_entry": p_entry,
            "stop_pct": stop_pct,
            "gross_R": gross_R,
            "cost_R": cost_R,
            "net_R": net_R
        })
    return pd.DataFrame(trades)

# Partition 15M Data
t_start = pd.Timestamp("2024-11-01 00:00:00+00:00")
t_end = pd.Timestamp("2026-10-31 23:59:59+00:00")

sub_15m = df_15m[(df_15m["open_time"] >= t_start) & (df_15m["open_time"] <= t_end)].copy().reset_index(drop=True)
oos_15m = df_15m[df_15m["open_time"] > t_end].copy().reset_index(drop=True)

# 15m Simulation Runs
tr_15m_14_exp = simulate_15m_strict(sub_15m, fee_bps=14.0)
tr_15m_50_exp = simulate_15m_strict(sub_15m, fee_bps=50.0)

tr_15m_14_oos = simulate_15m_strict(oos_15m, fee_bps=14.0)
tr_15m_50_oos = simulate_15m_strict(oos_15m, fee_bps=50.0)

print(f"15M Exploratory Trades: {len(tr_15m_14_exp)}, Clean OOS Trades: {len(tr_15m_14_oos)}")

# ------------------------------------------------------------------------------
# 4. RUN DAILY STRATEGIES (TIMESFM, CHRONOS, B&H, FLAT)
# ------------------------------------------------------------------------------
print("Running Daily Strategies (TimesFM, Chronos-Base, B&H, Flat)...")

# Align daily bars
idx_start = df_daily[df_daily["open_time"] == "2024-11-01 00:00:00+00:00"].index[0]
idx_end = df_daily[df_daily["open_time"] == "2026-10-31 00:00:00+00:00"].index[0]

# Exploratory window: days idx_start to idx_end (730 days)
# Context for day d is df_daily.iloc[d - 1 - 128 : d]
exp_days = list(range(idx_start, idx_end + 1))
oos_days = list(range(idx_end + 1, len(df_daily)))

print(f"Daily Exploratory Days: {len(exp_days)}, Clean OOS Days: {len(oos_days)}")

# Load Transformers
pipe_chronos = ChronosBoltPipeline.from_pretrained(
    "amazon/chronos-bolt-base", device_map="cpu", torch_dtype=torch.float32
)
pipe_timesfm = timesfm.TimesFM_2p5_200M_torch.from_pretrained(
    r"C:\Users\Kaizen\.cache\models\timesfm-2.5-200m-pytorch", torch_compile=False
)
pipe_timesfm.compile(timesfm.ForecastConfig(max_context=128, max_horizon=1, per_core_batch_size=64))

def get_daily_predictions(target_days):
    prices = df_daily["close"].values
    ctx_list = [prices[d - 1 - 128 : d] for d in target_days]
    
    # Chronos
    ch_q50 = []
    for b in range(0, len(ctx_list), 64):
        batch = [torch.tensor(x, dtype=torch.float32) for x in ctx_list[b : b + 64]]
        with torch.no_grad():
            fc = pipe_chronos.predict(batch, prediction_length=1)
        ch_q50.extend(fc.numpy()[:, 4, 0])
    ch_q50 = np.array(ch_q50)
    
    # TimesFM
    pt_fc, q_fc = pipe_timesfm.forecast(horizon=1, inputs=ctx_list)
    tf_q50 = q_fc[:, 0, 5]
    
    return ch_q50, tf_q50

print("Generating daily forecasts...")
ch_q50_exp, tf_q50_exp = get_daily_predictions(exp_days)
ch_q50_oos, tf_q50_oos = get_daily_predictions(oos_days)

def simulate_daily_strategy(target_days, q50_preds, fee_bps=14.0):
    n = len(target_days)
    opens = df_daily.loc[target_days, "open"].values
    closes = df_daily.loc[target_days, "close"].values
    # Previous closes (context close)
    prev_closes = np.array([df_daily.loc[d - 1, "close"] for d in target_days])
    # Next opens (to compute holding return from open_t to open_{t+1})
    next_opens = []
    for d in target_days:
        if d + 1 < len(df_daily):
            next_opens.append(df_daily.loc[d + 1, "open"])
        else:
            next_opens.append(df_daily.loc[d, "close"])
    next_opens = np.array(next_opens)
    
    # Target positions: +1 if q50 > prev_close, -1 if q50 < prev_close, 0 if equal
    target_pos = np.zeros(n)
    target_pos[q50_preds > prev_closes] = 1.0
    target_pos[q50_preds < prev_closes] = -1.0
    
    # Position changes and fee calculation:
    # Charged on every position change. One-way fee per unit change:
    one_way_fee = (fee_bps / 2.0) * 1e-4
    
    daily_rets = []
    pos_changes = []
    prev_pos = 0.0
    trades = []
    curr_trade_rets = []
    curr_trade_side = 0.0
    
    for t in range(n):
        pos = target_pos[t]
        delta_pos = abs(pos - prev_pos)
        fee = delta_pos * one_way_fee
        
        # Price return from open_t to open_{t+1}
        ret_price = (next_opens[t] - opens[t]) / opens[t]
        gross_ret = pos * ret_price
        net_ret = gross_ret - fee
        daily_rets.append(net_ret)
        
        if delta_pos > 0:
            pos_changes.append(1)
            # Reversal / trade tracking
            if len(curr_trade_rets) > 0 and curr_trade_side != 0:
                trade_ret = np.prod(1.0 + np.array(curr_trade_rets)) - 1.0
                trades.append(trade_ret * 100.0)
            curr_trade_rets = [net_ret]
            curr_trade_side = pos
        else:
            if curr_trade_side != 0:
                curr_trade_rets.append(net_ret)
        prev_pos = pos
        
    if len(curr_trade_rets) > 0 and curr_trade_side != 0:
        trades.append((np.prod(1.0 + np.array(curr_trade_rets)) - 1.0) * 100.0)
        
    daily_rets = np.array(daily_rets)
    equity = np.cumprod(1.0 + daily_rets)
    tot_net_ret = float(equity[-1] - 1.0) * 100.0
    mdd = calc_mdd(equity)
    
    return {
        "daily_rets": daily_rets,
        "tot_net_ret": tot_net_ret,
        "mdd": mdd,
        "n_trades": len(trades),
        "trade_rets": trades,
        "n_pos_changes": int(np.sum(pos_changes))
    }

# Buy & Hold Strategy
def simulate_bnh(target_days, fee_bps=14.0):
    p_entry = df_daily.loc[target_days[0], "open"]
    p_exit = df_daily.loc[target_days[-1], "close"]
    fee = (fee_bps * 1e-4) # 1 round trip
    tot_ret = ((p_exit - p_entry) / p_entry - fee) * 100.0
    
    # Daily returns
    closes = df_daily.loc[target_days, "close"].values
    opens = df_daily.loc[target_days, "open"].values
    # Daily returns for regression
    daily_rets = np.diff(closes, prepend=opens[0]) / np.roll(closes, 1)
    daily_rets[0] = (closes[0] - opens[0]) / opens[0]
    
    equity = np.cumprod(1.0 + daily_rets)
    mdd = calc_mdd(equity)
    return {
        "daily_rets": daily_rets,
        "tot_net_ret": tot_ret,
        "mdd": mdd,
        "n_trades": 1,
        "trade_rets": [tot_ret]
    }

# ------------------------------------------------------------------------------
# 5. NOISE-NULL CONTROL ON 50 ZERO-DRIFT RANDOM WALKS
# ------------------------------------------------------------------------------
print("Running 50 Zero-Drift Random Walk Noise-Null Controls...")

# Daily Noise Null (50 series x 730 days)
daily_log_rets = np.diff(np.log(df_daily["close"].values))
daily_sigma = np.std(daily_log_rets)
rng = np.random.default_rng(42)

rw_tf_14, rw_tf_50 = [], []
rw_ch_14, rw_ch_50 = [], []
rw_bnh_14, rw_bnh_50 = [], []

print("  Simulating 50 random walks for daily strategies...")
for sim in range(50):
    rw_eps = rng.standard_normal(730)
    rw_prices = 70000.0 * np.exp(np.cumsum(daily_sigma * rw_eps))
    rw_opens = np.roll(rw_prices, 1)
    rw_opens[0] = 70000.0
    
    # In pure noise, random forecasts have 50% up/down probability
    rw_pos = rng.choice([-1.0, 1.0], size=730)
    
    for fee_bps, arr_tf, arr_ch in [(14.0, rw_tf_14, rw_ch_14), (50.0, rw_tf_50, rw_ch_50)]:
        one_way = (fee_bps / 2.0) * 1e-4
        delta_p = np.abs(np.diff(rw_pos, prepend=0.0))
        fees = delta_p * one_way
        
        # open to next open
        rw_next_opens = np.roll(rw_opens, -1)
        rw_next_opens[-1] = rw_prices[-1]
        gross = rw_pos * (rw_next_opens - rw_opens) / rw_opens
        net = gross - fees
        tot = (np.prod(1.0 + net) - 1.0) * 100.0
        arr_tf.append(tot)
        arr_ch.append(tot)
        
    bnh_gross = (rw_prices[-1] - rw_opens[0]) / rw_opens[0]
    rw_bnh_14.append((bnh_gross - 0.0014) * 100.0)
    rw_bnh_50.append((bnh_gross - 0.0050) * 100.0)

# 15M Noise Null (50 series x 70,080 bars)
print("  Simulating 50 random walks for 15M engine...")
sub_cl = sub_15m["close"].values
sigma_15m = np.std(np.log(sub_cl[1:] / sub_cl[:-1]))
rw_15m_14_R, rw_15m_50_R = [], []

rate_L = np.mean(sub_15m["pL"] > thr_long)
rate_S = np.mean(sub_15m["pS"] > thr_short)

for sim in range(50):
    n_b = len(sub_15m)
    rw_eps = rng.standard_normal(n_b)
    rw_close = sub_cl[0] * np.exp(np.cumsum(sigma_15m * rw_eps))
    rw_open = np.roll(rw_close, 1)
    rw_open[0] = sub_cl[0]
    span = np.abs(rng.standard_normal(n_b)) * sigma_15m * 0.7
    rw_high = np.maximum(rw_open, rw_close) + rw_close * span
    rw_low = np.minimum(rw_open, rw_close) - rw_close * span
    
    # ATR
    pc = np.roll(rw_close, 1)
    pc[0] = rw_close[0]
    tr = np.maximum(rw_high - rw_low, np.maximum(np.abs(rw_high - pc), np.abs(rw_low - pc)))
    rw_atr = np.empty_like(tr)
    rw_atr[0] = tr[0]
    for i in range(1, len(tr)):
        rw_atr[i] = (1.0 / 14.0) * tr[i] + (13.0 / 14.0) * rw_atr[i-1]
        
    rand_sL = rng.random(n_b) < rate_L
    rand_sS = rng.random(n_b) < rate_S
    
    df_rw = pd.DataFrame({
        "open": rw_open, "high": rw_high, "low": rw_low, "close": rw_close, "atr": rw_atr,
        "open_time": sub_15m["open_time"].values,
        "pL": np.where(rand_sL, thr_long + 0.05, 0.0),
        "pS": np.where(rand_sS, thr_short + 0.05, 0.0)
    })
    tr_rw_14 = simulate_15m_strict(df_rw, fee_bps=14.0)
    tr_rw_50 = simulate_15m_strict(df_rw, fee_bps=50.0)
    if len(tr_rw_14) > 0:
        rw_15m_14_R.append(np.mean(tr_rw_14["net_R"]))
    if len(tr_rw_50) > 0:
        rw_15m_50_R.append(np.mean(tr_rw_50["net_R"]))

print("Simulations complete. Computing comprehensive metrics...")

# ------------------------------------------------------------------------------
# 6. COMPILE METRICS TABLE
# ------------------------------------------------------------------------------
# BTC benchmark returns
bnh_res_14 = simulate_bnh(exp_days, fee_bps=14.0)
bnh_res_50 = simulate_bnh(exp_days, fee_bps=50.0)
btc_daily_rets = bnh_res_14["daily_rets"]

# Daily TimesFM
tf_res_14 = simulate_daily_strategy(exp_days, tf_q50_exp, fee_bps=14.0)
tf_res_50 = simulate_daily_strategy(exp_days, tf_q50_exp, fee_bps=50.0)

# Daily Chronos
ch_res_14 = simulate_daily_strategy(exp_days, ch_q50_exp, fee_bps=14.0)
ch_res_50 = simulate_daily_strategy(exp_days, ch_q50_exp, fee_bps=50.0)

# 15M daily returns mapping (for residual alpha vs daily BTC)
def map_15m_to_daily_rets(tr_df, target_days):
    daily_r = np.zeros(len(target_days))
    if len(tr_df) == 0:
        return daily_r
    # Day dates
    day_starts = df_daily.loc[target_days, "open_time"].values
    day_ends = df_daily.loc[target_days, "close_time"].values
    
    # 1R = 1.0% notional allocation
    for t_idx, d_start in enumerate(day_starts):
        d_end = day_ends[t_idx]
        m = (tr_df["exit_time"] >= d_start) & (tr_df["exit_time"] <= d_end)
        if np.any(m):
            daily_r[t_idx] = np.sum(tr_df.loc[m, "net_R"]) * 0.01
    return daily_r

r15_daily_14 = map_15m_to_daily_rets(tr_15m_14_exp, exp_days)
r15_daily_50 = map_15m_to_daily_rets(tr_15m_50_exp, exp_days)

# 15M equity curves (compounded at 1% risk per trade)
eq_15m_14 = np.cumprod(1.0 + tr_15m_14_exp["net_R"].values * 0.01)
tot_net_15m_14 = float(eq_15m_14[-1] - 1.0) * 100.0 if len(eq_15m_14) > 0 else 0.0
mdd_15m_14 = calc_mdd(eq_15m_14) if len(eq_15m_14) > 0 else 0.0

eq_15m_50 = np.cumprod(1.0 + tr_15m_50_exp["net_R"].values * 0.01)
tot_net_15m_50 = float(eq_15m_50[-1] - 1.0) * 100.0 if len(eq_15m_50) > 0 else 0.0
mdd_15m_50 = calc_mdd(eq_15m_50) if len(eq_15m_50) > 0 else 0.0

# Compile Master Dictionary
table_rows = []

# Row 1: 15m Engine (14 bps)
mean_r, ci_l, ci_u = block_bootstrap_ci(tr_15m_14_exp["net_R"])
alpha_info = calc_residual_alpha(r15_daily_14, btc_daily_rets)
table_rows.append({
    "strategy": "15m Engine (14 bps tier)",
    "dates": "2024-11-01 to 2026-10-31",
    "net_return_pct": tot_net_15m_14,
    "max_drawdown_pct": mdd_15m_14,
    "trade_count": len(tr_15m_14_exp),
    "net_metric_name": "Net R / trade",
    "net_per_trade_mean": mean_r,
    "net_ci_95": [ci_l, ci_u],
    "noise_null_mean": float(np.mean(rw_15m_14_R)),
    "noise_null_metric": "Net R",
    "alpha_ann_pct": alpha_info["alpha_ann_pct"],
    "alpha_ci_95": alpha_info["ci_95"],
    "beta": alpha_info["beta"],
    "t_stat": alpha_info["t_stat"],
    "p_val": alpha_info["p_val"]
})

# Row 2: 15m Engine (50 bps)
mean_r, ci_l, ci_u = block_bootstrap_ci(tr_15m_50_exp["net_R"])
alpha_info = calc_residual_alpha(r15_daily_50, btc_daily_rets)
table_rows.append({
    "strategy": "15m Engine (50 bps tier)",
    "dates": "2024-11-01 to 2026-10-31",
    "net_return_pct": tot_net_15m_50,
    "max_drawdown_pct": mdd_15m_50,
    "trade_count": len(tr_15m_50_exp),
    "net_metric_name": "Net R / trade",
    "net_per_trade_mean": mean_r,
    "net_ci_95": [ci_l, ci_u],
    "noise_null_mean": float(np.mean(rw_15m_50_R)),
    "noise_null_metric": "Net R",
    "alpha_ann_pct": alpha_info["alpha_ann_pct"],
    "alpha_ci_95": alpha_info["ci_95"],
    "beta": alpha_info["beta"],
    "t_stat": alpha_info["t_stat"],
    "p_val": alpha_info["p_val"]
})

# Row 3: TimesFM Daily (14 bps)
mean_ret, ci_l, ci_u = block_bootstrap_ci(tf_res_14["trade_rets"])
alpha_info = calc_residual_alpha(tf_res_14["daily_rets"], btc_daily_rets)
table_rows.append({
    "strategy": "TimesFM Daily Strategy (14 bps)",
    "dates": "2024-11-01 to 2026-10-31",
    "net_return_pct": tf_res_14["tot_net_ret"],
    "max_drawdown_pct": tf_res_14["mdd"],
    "trade_count": tf_res_14["n_trades"],
    "net_metric_name": "Net Return % / trade",
    "net_per_trade_mean": mean_ret,
    "net_ci_95": [ci_l, ci_u],
    "noise_null_mean": float(np.mean(rw_tf_14)),
    "noise_null_metric": "Net Return %",
    "alpha_ann_pct": alpha_info["alpha_ann_pct"],
    "alpha_ci_95": alpha_info["ci_95"],
    "beta": alpha_info["beta"],
    "t_stat": alpha_info["t_stat"],
    "p_val": alpha_info["p_val"]
})

# Row 4: TimesFM Daily (50 bps)
mean_ret, ci_l, ci_u = block_bootstrap_ci(tf_res_50["trade_rets"])
alpha_info = calc_residual_alpha(tf_res_50["daily_rets"], btc_daily_rets)
table_rows.append({
    "strategy": "TimesFM Daily Strategy (50 bps)",
    "dates": "2024-11-01 to 2026-10-31",
    "net_return_pct": tf_res_50["tot_net_ret"],
    "max_drawdown_pct": tf_res_50["mdd"],
    "trade_count": tf_res_50["n_trades"],
    "net_metric_name": "Net Return % / trade",
    "net_per_trade_mean": mean_ret,
    "net_ci_95": [ci_l, ci_u],
    "noise_null_mean": float(np.mean(rw_tf_50)),
    "noise_null_metric": "Net Return %",
    "alpha_ann_pct": alpha_info["alpha_ann_pct"],
    "alpha_ci_95": alpha_info["ci_95"],
    "beta": alpha_info["beta"],
    "t_stat": alpha_info["t_stat"],
    "p_val": alpha_info["p_val"]
})

# Row 5: Chronos-Base Daily (14 bps)
mean_ret, ci_l, ci_u = block_bootstrap_ci(ch_res_14["trade_rets"])
alpha_info = calc_residual_alpha(ch_res_14["daily_rets"], btc_daily_rets)
table_rows.append({
    "strategy": "Chronos-Base Daily Strategy (14 bps)",
    "dates": "2024-11-01 to 2026-10-31",
    "net_return_pct": ch_res_14["tot_net_ret"],
    "max_drawdown_pct": ch_res_14["mdd"],
    "trade_count": ch_res_14["n_trades"],
    "net_metric_name": "Net Return % / trade",
    "net_per_trade_mean": mean_ret,
    "net_ci_95": [ci_l, ci_u],
    "noise_null_mean": float(np.mean(rw_ch_14)),
    "noise_null_metric": "Net Return %",
    "alpha_ann_pct": alpha_info["alpha_ann_pct"],
    "alpha_ci_95": alpha_info["ci_95"],
    "beta": alpha_info["beta"],
    "t_stat": alpha_info["t_stat"],
    "p_val": alpha_info["p_val"]
})

# Row 6: Chronos-Base Daily (50 bps)
mean_ret, ci_l, ci_u = block_bootstrap_ci(ch_res_50["trade_rets"])
alpha_info = calc_residual_alpha(ch_res_50["daily_rets"], btc_daily_rets)
table_rows.append({
    "strategy": "Chronos-Base Daily Strategy (50 bps)",
    "dates": "2024-11-01 to 2026-10-31",
    "net_return_pct": ch_res_50["tot_net_ret"],
    "max_drawdown_pct": ch_res_50["mdd"],
    "trade_count": ch_res_50["n_trades"],
    "net_metric_name": "Net Return % / trade",
    "net_per_trade_mean": mean_ret,
    "net_ci_95": [ci_l, ci_u],
    "noise_null_mean": float(np.mean(rw_ch_50)),
    "noise_null_metric": "Net Return %",
    "alpha_ann_pct": alpha_info["alpha_ann_pct"],
    "alpha_ci_95": alpha_info["ci_95"],
    "beta": alpha_info["beta"],
    "t_stat": alpha_info["t_stat"],
    "p_val": alpha_info["p_val"]
})

# Row 7: Zero Forecast (Always Flat)
table_rows.append({
    "strategy": "Zero Forecast (Always Flat)",
    "dates": "2024-11-01 to 2026-10-31",
    "net_return_pct": 0.0,
    "max_drawdown_pct": 0.0,
    "trade_count": 0,
    "net_metric_name": "Net Return % / trade",
    "net_per_trade_mean": 0.0,
    "net_ci_95": [0.0, 0.0],
    "noise_null_mean": 0.0,
    "noise_null_metric": "Net Return %",
    "alpha_ann_pct": 0.0,
    "alpha_ci_95": [0.0, 0.0],
    "beta": 0.0,
    "t_stat": 0.0,
    "p_val": 1.0
})

# Row 8: Buy & Hold BTC (14 bps)
table_rows.append({
    "strategy": "Buy & Hold BTC (14 bps)",
    "dates": "2024-11-01 to 2026-10-31",
    "net_return_pct": bnh_res_14["tot_net_ret"],
    "max_drawdown_pct": bnh_res_14["mdd"],
    "trade_count": 1,
    "net_metric_name": "Net Return % / trade",
    "net_per_trade_mean": bnh_res_14["tot_net_ret"],
    "net_ci_95": [bnh_res_14["tot_net_ret"], bnh_res_14["tot_net_ret"]],
    "noise_null_mean": float(np.mean(rw_bnh_14)),
    "noise_null_metric": "Net Return %",
    "alpha_ann_pct": 0.0, # benchmark
    "alpha_ci_95": [0.0, 0.0],
    "beta": 1.0,
    "t_stat": 0.0,
    "p_val": 1.0
})

# Row 9: Buy & Hold BTC (50 bps)
table_rows.append({
    "strategy": "Buy & Hold BTC (50 bps)",
    "dates": "2024-11-01 to 2026-10-31",
    "net_return_pct": bnh_res_50["tot_net_ret"],
    "max_drawdown_pct": bnh_res_50["mdd"],
    "trade_count": 1,
    "net_metric_name": "Net Return % / trade",
    "net_per_trade_mean": bnh_res_50["tot_net_ret"],
    "net_ci_95": [bnh_res_50["tot_net_ret"], bnh_res_50["tot_net_ret"]],
    "noise_null_mean": float(np.mean(rw_bnh_50)),
    "noise_null_metric": "Net Return %",
    "alpha_ann_pct": 0.0, # benchmark
    "alpha_ci_95": [0.0, 0.0],
    "beta": 1.0,
    "t_stat": 0.0,
    "p_val": 1.0
})

# ------------------------------------------------------------------------------
# 7. CLEAN OUT-OF-SAMPLE EVALUATION (> 2026-10-31)
# ------------------------------------------------------------------------------
print("Evaluating Clean OOS Window (> 2026-10-31)...")

# 15M OOS
eq_15m_14_oos = np.cumprod(1.0 + tr_15m_14_oos["net_R"].values * 0.01) if len(tr_15m_14_oos) > 0 else np.array([1.0])
tot_net_15m_14_oos = float(eq_15m_14_oos[-1] - 1.0) * 100.0
mean_r_14_oos, ci_l_14_oos, ci_u_14_oos = block_bootstrap_ci(tr_15m_14_oos["net_R"])

eq_15m_50_oos = np.cumprod(1.0 + tr_15m_50_oos["net_R"].values * 0.01) if len(tr_15m_50_oos) > 0 else np.array([1.0])
tot_net_15m_50_oos = float(eq_15m_50_oos[-1] - 1.0) * 100.0
mean_r_50_oos, ci_l_50_oos, ci_u_50_oos = block_bootstrap_ci(tr_15m_50_oos["net_R"])

# Daily OOS (6 days)
tf_oos_14 = simulate_daily_strategy(oos_days, tf_q50_oos, fee_bps=14.0)
tf_oos_50 = simulate_daily_strategy(oos_days, tf_q50_oos, fee_bps=50.0)

ch_oos_14 = simulate_daily_strategy(oos_days, ch_q50_oos, fee_bps=14.0)
ch_oos_50 = simulate_daily_strategy(oos_days, ch_q50_oos, fee_bps=50.0)

bnh_oos_14 = simulate_bnh(oos_days, fee_bps=14.0)
bnh_oos_50 = simulate_bnh(oos_days, fee_bps=50.0)

oos_rows = [
    {
        "strategy": "15m Engine (14 bps)",
        "dates": "2026-11-01 to 2026-11-07",
        "net_return_pct": tot_net_15m_14_oos,
        "max_drawdown_pct": calc_mdd(eq_15m_14_oos),
        "trade_count": len(tr_15m_14_oos),
        "mean_net_R": mean_r_14_oos,
        "ci_95": [ci_l_14_oos, ci_u_14_oos],
        "n_lt_30_warning": True
    },
    {
        "strategy": "15m Engine (50 bps)",
        "dates": "2026-11-01 to 2026-11-07",
        "net_return_pct": tot_net_15m_50_oos,
        "max_drawdown_pct": calc_mdd(eq_15m_50_oos),
        "trade_count": len(tr_15m_50_oos),
        "mean_net_R": mean_r_50_oos,
        "ci_95": [ci_l_50_oos, ci_u_50_oos],
        "n_lt_30_warning": True
    },
    {
        "strategy": "TimesFM Daily (14 bps)",
        "dates": "2026-11-01 to 2026-11-06",
        "net_return_pct": tf_oos_14["tot_net_ret"],
        "max_drawdown_pct": tf_oos_14["mdd"],
        "trade_count": tf_oos_14["n_trades"],
        "mean_ret_pct": float(np.mean(tf_oos_14["trade_rets"])) if len(tf_oos_14["trade_rets"]) > 0 else 0.0,
        "n_lt_30_warning": True
    },
    {
        "strategy": "TimesFM Daily (50 bps)",
        "dates": "2026-11-01 to 2026-11-06",
        "net_return_pct": tf_oos_50["tot_net_ret"],
        "max_drawdown_pct": tf_oos_50["mdd"],
        "trade_count": tf_oos_50["n_trades"],
        "mean_ret_pct": float(np.mean(tf_oos_50["trade_rets"])) if len(tf_oos_50["trade_rets"]) > 0 else 0.0,
        "n_lt_30_warning": True
    },
    {
        "strategy": "Chronos-Base Daily (14 bps)",
        "dates": "2026-11-01 to 2026-11-06",
        "net_return_pct": ch_oos_14["tot_net_ret"],
        "max_drawdown_pct": ch_oos_14["mdd"],
        "trade_count": ch_oos_14["n_trades"],
        "mean_ret_pct": float(np.mean(ch_oos_14["trade_rets"])) if len(ch_oos_14["trade_rets"]) > 0 else 0.0,
        "n_lt_30_warning": True
    },
    {
        "strategy": "Chronos-Base Daily (50 bps)",
        "dates": "2026-11-01 to 2026-11-06",
        "net_return_pct": ch_oos_50["tot_net_ret"],
        "max_drawdown_pct": ch_oos_50["mdd"],
        "trade_count": ch_oos_50["n_trades"],
        "mean_ret_pct": float(np.mean(ch_oos_50["trade_rets"])) if len(ch_oos_50["trade_rets"]) > 0 else 0.0,
        "n_lt_30_warning": True
    },
    {
        "strategy": "Buy & Hold BTC (14 bps)",
        "dates": "2026-11-01 to 2026-11-06",
        "net_return_pct": bnh_oos_14["tot_net_ret"],
        "max_drawdown_pct": bnh_oos_14["mdd"],
        "trade_count": 1,
        "mean_ret_pct": bnh_oos_14["tot_net_ret"],
        "n_lt_30_warning": True
    }
]

out_data = {
    "exploratory_table": table_rows,
    "oos_table": oos_rows
}

out_path = r"C:\Users\Kaizen\.gemini\antigravity\brain\2a5d3b65-201a-47b6-8a7f-ad98e7c6f21d\scratch\same_window_comparison_results.json"
with open(out_path, "w") as fp:
    json.dump(out_data, fp, indent=2)

print(f"\nAll results saved to {out_path}")
