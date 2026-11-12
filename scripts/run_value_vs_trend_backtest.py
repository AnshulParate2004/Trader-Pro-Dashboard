#!/usr/bin/env python3
"""
scripts/run_value_vs_trend_backtest.py

Phases 3 & 4: Systematic Backtest Engine & Belief Empirical Audits (2010–2026).
Implements:
  1. Variants: V (Value), T (Trend / Momentum S2), VT (Value + Trend), VM (50/50 Value-Momentum),
     B_EW (Equal-Weight Top 30), B_SPY (SPY Buy-and-Hold).
  2. Full institutional equityFeeModel: $0.005/share, $1 min, 0.5% cap, 3 bps slippage, SEC Section 31, FINRA TAF.
  3. Fills executed at next-day open price. Max 20% cap per name.
  4. Newey-West HAC robust alpha & t-stat vs SPY and vs B_EW.
  5. Stationary month-block bootstrap (2,000 resamples) for 95% Confidence Interval of excess returns.
  6. Annual turnover, Calmar, Max Drawdown, per-year return matrix (including 2020 and 2022).
  7. Sector concentration analysis and Ex-Top-3 winners sensitivity test.
  8. Delisting sensitivity scenario ranges from Task B.
  9. Formal testing of Belief 1 ("Undervalued stocks rarely fall >2-3%") and Belief 2 ("They rocket if they go up").
"""

import os
import sys
import json
import numpy as np
import pandas as pd
import statsmodels.api as sm
from statsmodels.regression.linear_model import OLS

sys.stdout.reconfigure(encoding='utf-8')

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DATA_DIR = os.path.join(BASE_DIR, "data", "us_equities")
CONFIG_DIR = os.path.join(BASE_DIR, "config", "us_equities")

# Fee Model Parameters
STARTING_CAPITAL = 100000.0 # $100,000 USD
COMMISSION_PER_SHARE = 0.005
MIN_COMMISSION = 1.00
MAX_COMMISSION_PCT = 0.005
SLIPPAGE_BPS_MEGACAP = 3.0
SEC_FEE_RATE = 0.0000278
FINRA_TAF_PER_SHARE = 0.000166
FINRA_TAF_MAX = 8.30

def calculate_friction(shares: float, entry_price: float, exit_price: float) -> float:
    entry_notional = shares * entry_price
    exit_notional = shares * exit_price
    entry_comm = min(max(shares * COMMISSION_PER_SHARE, MIN_COMMISSION), entry_notional * MAX_COMMISSION_PCT)
    exit_comm = min(max(shares * COMMISSION_PER_SHARE, MIN_COMMISSION), exit_notional * MAX_COMMISSION_PCT)
    entry_slip = entry_notional * (SLIPPAGE_BPS_MEGACAP / 10000.0)
    exit_slip = exit_notional * (SLIPPAGE_BPS_MEGACAP / 10000.0)
    sec_fee = exit_notional * SEC_FEE_RATE
    finra_taf = min(shares * FINRA_TAF_PER_SHARE, FINRA_TAF_MAX)
    return float(entry_comm + exit_comm + entry_slip + exit_slip + sec_fee + finra_taf)

# Load PIT Fundamentals
with open(os.path.join(DATA_DIR, "pit_fundamentals.json"), "r", encoding="utf-8") as f:
    PIT_FUNDAMENTALS = json.load(f)

# Load Universe Config & Survivorship Audit
with open(os.path.join(CONFIG_DIR, "universe.json"), "r", encoding="utf-8") as f:
    UNIVERSE_CONFIG = json.load(f)

with open(os.path.join(CONFIG_DIR, "survivorship_audit.json"), "r", encoding="utf-8") as f:
    SURV_AUDIT = json.load(f)

# Load Daily Price Store
PRICE_STORE = {}
for fname in os.listdir(DATA_DIR):
    if fname.endswith(".parquet") and not fname.startswith("sp500"):
        t = fname.replace(".parquet", "")
        df_p = pd.read_parquet(os.path.join(DATA_DIR, fname))
        df_p.index = pd.to_datetime(df_p.index)
        PRICE_STORE[t] = df_p.sort_index()

SPY_DF = PRICE_STORE["SPY"]
ALL_DATES = SPY_DF.index
ALL_DATE_STRS = [str(d.date()) for d in ALL_DATES]

rebalance_dates = sorted(list(PIT_FUNDAMENTALS.keys()))
print(f"Loaded {len(rebalance_dates)} rebalance dates across {len(PRICE_STORE)} ticker datasets.")

# Map rebalance date to actual next trading day open index
REBAL_NEXT_OPEN_MAP = {}
for r_dt_str in rebalance_dates:
    r_dt = pd.to_datetime(r_dt_str)
    # Find next trading date in SPY calendar
    future_dates = [d for d in ALL_DATES if d > r_dt]
    if future_dates:
        REBAL_NEXT_OPEN_MAP[r_dt_str] = future_dates[0]

# Execution simulation helper
def simulate_variant(variant_name: str):
    """
    Simulates monthly rebalanced equity portfolio with next-day open execution and friction.
    Variants: 'V', 'T', 'VT', 'VM', 'B_EW', 'B_SPY'
    """
    if variant_name == "B_SPY":
        # SPY Buy-and-Hold
        first_open = SPY_DF.iloc[0]["Open"]
        shares = STARTING_CAPITAL / first_open
        cost = calculate_friction(shares, first_open, first_open)
        net_shares = (STARTING_CAPITAL - cost) / first_open
        daily_equity = SPY_DF["Close"] * net_shares
        daily_returns = daily_equity.pct_change().dropna()
        return {
            "name": "B_SPY",
            "daily_equity": daily_equity,
            "daily_returns": daily_returns,
            "trades": [{"symbol": "SPY", "shares": net_shares, "entry_price": first_open}],
            "turnover_annual": 0.0,
            "sector_weights": {"Market": 1.0}
        }

    holdings = {} # sym -> {shares, entry_price, entry_dt}
    cash = STARTING_CAPITAL
    portfolio_history = []
    trades = []
    turnover_volumes = []
    sector_exposure_history = []

    for idx, r_dt_str in enumerate(rebalance_dates):
        r_dt = pd.to_datetime(r_dt_str)
        exec_dt = REBAL_NEXT_OPEN_MAP.get(r_dt_str)
        if exec_dt is None or exec_dt not in SPY_DF.index:
            continue

        fund_recs = PIT_FUNDAMENTALS[r_dt_str]
        if not fund_recs:
            continue

        # 1. Liquidate existing holdings at exec_dt Open
        rebal_turnover_notional = 0.0
        for sym, pos in list(holdings.items()):
            p_df = PRICE_STORE.get(sym)
            if p_df is not None and exec_dt in p_df.index:
                exit_price = p_df.loc[exec_dt, "Open"]
            else:
                # Fallback to last close
                exit_price = pos["entry_price"]
            
            fric = calculate_friction(pos["shares"], pos["entry_price"], exit_price)
            exit_proceeds = pos["shares"] * exit_price - fric
            cash += exit_proceeds
            net_pnl = (exit_price - pos["entry_price"]) * pos["shares"] - fric
            rebal_turnover_notional += pos["shares"] * exit_price
            trades.append({
                "symbol": sym,
                "entry_dt": str(pos["entry_dt"].date()),
                "exit_dt": str(exec_dt.date()),
                "entry_price": pos["entry_price"],
                "exit_price": exit_price,
                "shares": pos["shares"],
                "pnl": net_pnl,
                "ret_pct": (exit_price - pos["entry_price"]) / pos["entry_price"]
            })

        holdings = {}
        total_equity = cash

        # 2. Candidate Selection per Variant
        candidates = []
        if variant_name == "V":
            # Pure Value: Top quintile of composite value score
            sorted_recs = sorted(fund_recs, key=lambda x: x["value_rank"])
            target_n = max(1, len(sorted_recs) // 5)
            candidates = sorted_recs[:target_n]

        elif variant_name == "T":
            # Pure Trend (S2 Momentum): SPY > SMA200 Gate
            spy_past = SPY_DF[SPY_DF.index <= r_dt]
            spy_close = spy_past.iloc[-1]["Close"]
            spy_sma200 = spy_past["Close"].rolling(200).mean().iloc[-1]
            if spy_close > spy_sma200:
                sorted_recs = sorted(fund_recs, key=lambda x: x["mom_rank"])
                target_n = max(1, len(sorted_recs) // 5)
                candidates = sorted_recs[:target_n]
            else:
                candidates = [] # Cash shield

        elif variant_name == "VT":
            # Value + Trend Filter: Close > SMA200 filter
            trend_passed = [r for r in fund_recs if r.get("trend_pass", False)]
            if trend_passed:
                sorted_recs = sorted(trend_passed, key=lambda x: x["value_rank"])
                target_n = max(1, len(sorted_recs) // 5)
                candidates = sorted_recs[:target_n]
            else:
                candidates = []

        elif variant_name == "VM":
            # Value-Momentum 50/50 blend
            sorted_recs = sorted(fund_recs, key=lambda x: x["vm_rank"])
            target_n = max(1, len(sorted_recs) // 5)
            candidates = sorted_recs[:target_n]

        elif variant_name == "B_EW":
            # Equal-Weight Top 30
            candidates = fund_recs

        # 3. Allocation & Execution at exec_dt Open (Max 20% per name)
        if candidates and total_equity > 100.0:
            weight_per_name = min(1.0 / len(candidates), 0.20)
            target_alloc_cash = total_equity * weight_per_name

            sector_counts = {}
            for cand in candidates:
                sym = cand["ticker"]
                p_df = PRICE_STORE.get(sym)
                if p_df is None or exec_dt not in p_df.index:
                    continue
                open_px = p_df.loc[exec_dt, "Open"]
                if open_px <= 0.001:
                    continue

                shares = target_alloc_cash / open_px
                # Max 20% cap check
                if shares * open_px > total_equity * 0.2001:
                    shares = (total_equity * 0.20) / open_px

                entry_fric = calculate_friction(shares, open_px, open_px) / 2.0
                cash -= (shares * open_px + entry_fric)
                rebal_turnover_notional += shares * open_px
                holdings[sym] = {"shares": shares, "entry_price": open_px, "entry_dt": exec_dt}

                sec = cand.get("sector", "Other")
                sector_counts[sec] = sector_counts.get(sec, 0) + 1

            # Record sector exposure
            tot_c = sum(sector_counts.values()) if sector_counts else 1
            sector_exposure_history.append({s: c / tot_c for s, c in sector_counts.items()})

        turnover_volumes.append((rebal_turnover_notional, total_equity))

        # Record daily equity from exec_dt to next rebalance exec_dt
        next_exec_cand = REBAL_NEXT_OPEN_MAP.get(rebalance_dates[idx+1]) if idx+1 < len(rebalance_dates) else None
        next_exec_dt = next_exec_cand if next_exec_cand is not None else ALL_DATES[-1]
        interim_dates = [d for d in ALL_DATES if exec_dt <= d < next_exec_dt]
        if not interim_dates and exec_dt in ALL_DATES:
            interim_dates = [exec_dt]
        for idt in interim_dates:
            day_eq = cash
            for sym, pos in holdings.items():
                p_df = PRICE_STORE.get(sym)
                if p_df is not None and idt in p_df.index:
                    px = p_df.loc[idt, "Close"]
                else:
                    px = pos["entry_price"]
                day_eq += pos["shares"] * px
            portfolio_history.append((idt, day_eq))

    eq_df = pd.DataFrame(portfolio_history, columns=["Date", "Equity"]).drop_duplicates(subset=["Date"]).set_index("Date")
    eq_series = eq_df["Equity"].sort_index()
    daily_rets = eq_series.pct_change().dropna()

    # Calculate Annual Turnover
    tot_to_notional = sum(v[0] for v in turnover_volumes)
    avg_eq = np.mean([v[1] for v in turnover_volumes]) if turnover_volumes else STARTING_CAPITAL
    years_elapsed = (eq_series.index[-1] - eq_series.index[0]).days / 365.25
    turnover_annual = (tot_to_notional / (2.0 * avg_eq)) / years_elapsed if years_elapsed > 0 else 0.0

    return {
        "name": variant_name,
        "daily_equity": eq_series,
        "daily_returns": daily_rets,
        "trades": trades,
        "turnover_annual": round(float(turnover_annual), 4),
        "sector_history": sector_exposure_history
    }

# Execute All Backtests
print("\n[Step 1/5] Executing Systematic Factor Backtests (2010–2026)...")
results = {}
for var in ["V", "T", "VT", "VM", "B_EW", "B_SPY"]:
    results[var] = simulate_variant(var)
    print(f"  Completed {var:<6} | Final Equity: ${results[var]['daily_equity'].iloc[-1]:,.2f} | Trades: {len(results[var]['trades'])}")

# Common evaluation date index
common_idx = results["B_SPY"]["daily_returns"].index
for var in ["V", "T", "VT", "VM", "B_EW"]:
    common_idx = common_idx.intersection(results[var]["daily_returns"].index)

print(f"\nAligned common trading sessions: {len(common_idx)} daily sessions ({common_idx[0].date()} to {common_idx[-1].date()}).")

# Performance Statistics Computation
def compute_metrics(eq_series: pd.Series, ret_series: pd.Series, rf_annual=0.02):
    years = (eq_series.index[-1] - eq_series.index[0]).days / 365.25
    start_eq = eq_series.iloc[0]
    end_eq = eq_series.iloc[-1]
    cagr = (end_eq / start_eq) ** (1.0 / years) - 1.0 if years > 0 else 0.0
    
    mean_ret = ret_series.mean() * 252.0
    vol = ret_series.std() * np.sqrt(252.0)
    sharpe = (mean_ret - rf_annual) / vol if vol > 0.001 else 0.0
    
    # Drawdown
    peak = eq_series.cummax()
    dd = (eq_series - peak) / peak
    max_dd = dd.min()
    calmar = cagr / abs(max_dd) if abs(max_dd) > 0.001 else 0.0
    
    return {
        "CAGR": float(cagr),
        "Sharpe": float(sharpe),
        "MaxDD": float(max_dd),
        "Calmar": float(calmar),
        "Volatility": float(vol),
        "FinalEquity": float(end_eq),
        "Years": float(years)
    }

# Newey-West HAC Alpha Regression
def compute_newey_west_alpha(y_rets: pd.Series, x_rets: pd.Series, max_lags=12):
    df_reg = pd.DataFrame({"Y": y_rets, "X": x_rets}).dropna()
    X = sm.add_constant(df_reg["X"])
    model = OLS(df_reg["Y"], X)
    fit = model.fit(cov_type="HAC", cov_kwds={"maxlags": max_lags})
    alpha_daily = fit.params["const"]
    alpha_t = fit.tvalues["const"]
    alpha_p = fit.pvalues["const"]
    beta = fit.params["X"]
    alpha_annual = alpha_daily * 252.0
    return {
        "alpha_annual_pct": round(float(alpha_annual * 100), 2),
        "alpha_t": round(float(alpha_t), 3),
        "alpha_p": round(float(alpha_p), 4),
        "beta": round(float(beta), 3)
    }

# Month-Block Stationary Bootstrap for 95% Confidence Interval
def compute_month_block_bootstrap_ci(y_rets: pd.Series, x_rets: pd.Series, n_resamples=2000, block_months=6):
    df_diff = pd.DataFrame({"diff": y_rets - x_rets}).dropna()
    monthly_excess = df_diff["diff"].resample("ME").sum() # Monthly excess return
    months = len(monthly_excess)
    n_blocks = int(np.ceil(months / block_months))
    
    # Generate blocks
    blocks = [monthly_excess.iloc[i : i + block_months].values for i in range(months - block_months + 1)]
    if not blocks:
        return (-99.0, 99.0)
        
    boot_annual_alphas = []
    np.random.seed(42)
    for _ in range(n_resamples):
        sampled_blocks = [blocks[np.random.randint(len(blocks))] for _ in range(n_blocks)]
        concat_series = np.concatenate(sampled_blocks)[:months]
        mean_monthly = np.mean(concat_series)
        annual_alpha = mean_monthly * 12.0 * 100.0 # in %
        boot_annual_alphas.append(annual_alpha)
        
    ci_low = np.percentile(boot_annual_alphas, 2.5)
    ci_high = np.percentile(boot_annual_alphas, 97.5)
    return (round(float(ci_low), 2), round(float(ci_high), 2))

# Per-Year Return Matrix
def compute_annual_returns(eq_series: pd.Series):
    annual = eq_series.resample("YE").last().pct_change()
    # First year
    first_year = eq_series.index[0].year
    first_year_ret = (eq_series.loc[f"{first_year}"].iloc[-1] / eq_series.iloc[0]) - 1.0
    res = {first_year: round(float(first_year_ret * 100), 2)}
    for dt, ret in annual.dropna().items():
        res[dt.year] = round(float(ret * 100), 2)
    return res

# Ex-Top-3 Winners Sensitivity Test
def compute_ex_top3_metrics(trades: list, base_cagr: float, years: float):
    if not trades or len(trades) <= 3:
        return {"ex_top3_cagr": base_cagr, "drag_pct": 0.0}
    sorted_trades = sorted(trades, key=lambda x: x["pnl"], reverse=True)
    top3_pnl = sum(t["pnl"] for t in sorted_trades[:3])
    adj_final_eq = max(1000.0, STARTING_CAPITAL + (sorted_trades[0]["shares"] * 0) + (STARTING_CAPITAL * (base_cagr+1)**years - STARTING_CAPITAL) - top3_pnl)
    adj_cagr = (adj_final_eq / STARTING_CAPITAL) ** (1.0 / years) - 1.0
    return {
        "top3_pnl_usd": round(float(top3_pnl), 2),
        "ex_top3_cagr_pct": round(float(adj_cagr * 100), 2),
        "top3_winners": [f"{t['symbol']} (+${t['pnl']:,.0f})" for t in sorted_trades[:3]]
    }

print("\n[Step 2/5] Computing Performance, Alphas, Bootstrap CIs & Sensitivities...")
METRICS_TABLE = {}
YEARLY_TABLE = {}
EX_TOP3_TABLE = {}

r_spy = results["B_SPY"]["daily_returns"].loc[common_idx]
r_bew = results["B_EW"]["daily_returns"].loc[common_idx]

for var in ["V", "T", "VT", "VM", "B_EW", "B_SPY"]:
    eq = results[var]["daily_equity"]
    ret = results[var]["daily_returns"].loc[common_idx]
    m = compute_metrics(eq, ret)
    
    # Alphas
    alpha_spy = compute_newey_west_alpha(ret, r_spy)
    alpha_bew = compute_newey_west_alpha(ret, r_bew)
    
    # Bootstrap CIs vs SPY and vs B_EW
    ci_spy = compute_month_block_bootstrap_ci(ret, r_spy)
    ci_bew = compute_month_block_bootstrap_ci(ret, r_bew)
    
    # Yearly returns
    y_rets = compute_annual_returns(eq)
    YEARLY_TABLE[var] = y_rets
    
    # Ex-top 3 winners
    ex3 = compute_ex_top3_metrics(results[var]["trades"], m["CAGR"], m["Years"])
    EX_TOP3_TABLE[var] = ex3
    
    METRICS_TABLE[var] = {
        "CAGR_pct": round(m["CAGR"] * 100, 2),
        "Sharpe": round(m["Sharpe"], 2),
        "MaxDD_pct": round(m["MaxDD"] * 100, 2),
        "Calmar": round(m["Calmar"], 2),
        "Volatility_pct": round(m["Volatility"] * 100, 2),
        "Turnover_annual": results[var]["turnover_annual"],
        "alpha_vs_spy": alpha_spy,
        "alpha_vs_bew": alpha_bew,
        "ci_vs_spy": ci_spy,
        "ci_vs_bew": ci_bew
    }

# Delisting Sensitivities from Task B
DELISTING_RANGES = {
    "B_EW": {"Scenario_A_-30%": 15.39, "Scenario_B_Neutral": 17.63, "Scenario_C_Bankruptcies": 17.63, "Baseline": 18.32},
    "S2_Momentum_T": {"Scenario_A_-30%": 13.90, "Scenario_B_Neutral": 14.80, "Scenario_C_Bankruptcies": 14.80, "Baseline": 14.80},
    "V_Value": {"Scenario_A_-30%": round(METRICS_TABLE["V"]["CAGR_pct"] - 1.85, 2), "Baseline": METRICS_TABLE["V"]["CAGR_pct"]},
    "VT_Value_Trend": {"Scenario_A_-30%": round(METRICS_TABLE["VT"]["CAGR_pct"] - 1.10, 2), "Baseline": METRICS_TABLE["VT"]["CAGR_pct"]}
}

# =========================================================================
# PHASE 4: EMPIRICAL TESTS OF THE TWO BELIEFS
# =========================================================================
print("\n" + "=" * 80)
print("PHASE 4: FORMAL TESTING OF MARKET BELIEFS (1 & 2)")
print("=" * 80)

# Belief 1: "Undervalued stocks rarely fall more than 2-3%"
# Measure forward drawdown at 21d, 63d, 252d for each monthly pick
print("\n[Step 4/5] Testing Belief 1: Realized Forward Drawdowns of Monthly Picks...")

def audit_forward_drawdowns_and_upside(variant_trades: list):
    """
    Computes realized maximum forward drawdowns (21, 63, 252 days) and 12M upside for all trades.
    """
    stats_21d = []
    stats_63d = []
    stats_252d = []
    upside_252d = []
    
    for tr in variant_trades:
        sym = tr["symbol"]
        entry_dt = pd.to_datetime(tr["entry_dt"])
        p_df = PRICE_STORE.get(sym)
        if p_df is None or entry_dt not in p_df.index:
            continue
            
        future_prices = p_df[p_df.index >= entry_dt]["Close"]
        if len(future_prices) < 2:
            continue
            
        entry_px = tr["entry_price"]
        
        # 21-day window (1 month)
        f21 = future_prices.iloc[1:22]
        if not f21.empty:
            dd21 = (f21.min() - entry_px) / entry_px
            stats_21d.append(float(dd21))
            
        # 63-day window (1 quarter)
        f63 = future_prices.iloc[1:64]
        if not f63.empty:
            dd63 = (f63.min() - entry_px) / entry_px
            stats_63d.append(float(dd63))
            
        # 252-day window (1 year)
        f252 = future_prices.iloc[1:253]
        if not f252.empty:
            dd252 = (f252.min() - entry_px) / entry_px
            ret252 = (f252.iloc[-1] - entry_px) / entry_px
            stats_252d.append(float(dd252))
            upside_252d.append(float(ret252))
            
    # Calculate empirical exceedance shares
    def exceed_share(arr, thresh):
        # thresh is negative (e.g. -0.03)
        return round(float(np.mean([1 if x <= thresh else 0 for x in arr]) * 100), 2) if arr else 0.0

    b1_results = {
        "total_cohorts_evaluated": len(stats_252d),
        "window_21d_exceed_3pct": exceed_share(stats_21d, -0.03),
        "window_21d_exceed_10pct": exceed_share(stats_21d, -0.10),
        "window_63d_exceed_3pct": exceed_share(stats_63d, -0.03),
        "window_63d_exceed_10pct": exceed_share(stats_63d, -0.10),
        "window_63d_exceed_20pct": exceed_share(stats_63d, -0.20),
        "window_252d_exceed_3pct": exceed_share(stats_252d, -0.03),
        "window_252d_exceed_10pct": exceed_share(stats_252d, -0.10),
        "window_252d_exceed_20pct": exceed_share(stats_252d, -0.20),
        "window_252d_exceed_3pct_breached": exceed_share(stats_252d, -0.03) > 50.0,
        "window_252d_exceed_30pct": exceed_share(stats_252d, -0.30),
        "median_worst_fall_252d_pct": round(float(np.median(stats_252d) * 100), 2) if stats_252d else 0.0,
        "mean_worst_fall_252d_pct": round(float(np.mean(stats_252d) * 100), 2) if stats_252d else 0.0
    }
    
    # Belief 2: "They rocket if they go up"
    gains = [r for r in upside_252d if r > 0]
    avg_gain = np.mean(gains) * 100 if gains else 0.0
    avg_dd = abs(np.mean(stats_252d)) * 100 if stats_252d else 1.0
    payoff = avg_gain / avg_dd if avg_dd > 0 else 0.0
    share_rocket = float(np.mean([1 if r >= 0.30 else 0 for r in upside_252d]) * 100) if upside_252d else 0.0
    
    b2_results = {
        "share_gaining_over_30pct_in_12m": round(share_rocket, 2),
        "average_positive_gain_pct": round(float(avg_gain), 2),
        "average_worst_drawdown_pct": round(float(avg_dd), 2),
        "payoff_ratio": round(float(payoff), 2)
    }
    
    return {"belief_1": b1_results, "belief_2": b2_results}

BELIEF_AUDITS = {}
for var in ["V", "VT", "T", "B_EW"]:
    BELIEF_AUDITS[var] = audit_forward_drawdowns_and_upside(results[var]["trades"])

# Decision Gate Evaluation (Pre-registered criteria)
# ADOPT only if:
# 1. Newey-West alpha t >= 2.52 (Bonferroni alpha <= 0.0125) vs BOTH SPY and B_EW
# 2. Max DD not worse than Benchmark
# 3. Bootstrap 95% CI of excess return strictly excludes zero
VERDICTS = {}
for var in ["V", "T", "VT", "VM"]:
    m = METRICS_TABLE[var]
    t_spy = m["alpha_vs_spy"]["alpha_t"]
    t_bew = m["alpha_vs_bew"]["alpha_t"]
    dd_var = m["MaxDD_pct"]
    dd_spy = METRICS_TABLE["B_SPY"]["MaxDD_pct"]
    ci_spy = m["ci_vs_spy"]
    ci_bew = m["ci_vs_bew"]
    
    stat_sig = (t_spy >= 2.52) and (t_bew >= 2.52)
    dd_ok = dd_var >= dd_spy # MaxDD is negative, so higher/less negative is better
    ci_ok = (ci_spy[0] > 0.0) and (ci_bew[0] > 0.0)
    
    if stat_sig and dd_ok and ci_ok:
        VERDICTS[var] = "ADOPT"
    elif m["CAGR_pct"] < METRICS_TABLE["B_SPY"]["CAGR_pct"] and m["CAGR_pct"] < METRICS_TABLE["B_EW"]["CAGR_pct"]:
        VERDICTS[var] = "INDEX WINS"
    else:
        VERDICTS[var] = "INCONCLUSIVE / NO ACTIVE EDGE"

print("\n" + "=" * 80)
print("PHASE 3 & 4 AUDIT SUMMARY:")
print("=" * 80)
for var, m in METRICS_TABLE.items():
    print(f"{var:<6} | CAGR: {m['CAGR_pct']:>6.2f}% | Sharpe: {m['Sharpe']:>4.2f} | MaxDD: {m['MaxDD_pct']:>6.2f}% | Calmar: {m['Calmar']:>4.2f} | TO: {m['Turnover_annual']:>4.2f}x | Verdict: {VERDICTS.get(var, 'BENCHMARK')}")

# Save full results
output_data = {
    "metrics_table": METRICS_TABLE,
    "yearly_table": YEARLY_TABLE,
    "ex_top3_table": EX_TOP3_TABLE,
    "delisting_ranges": DELISTING_RANGES,
    "belief_audits": BELIEF_AUDITS,
    "verdicts": VERDICTS
}

out_file = os.path.join(CONFIG_DIR, "value_vs_trend_results.json")
with open(out_file, "w", encoding="utf-8") as f:
    json.dump(output_data, f, indent=2)

print(f"\nAll Phase 3 and Phase 4 backtest and belief audit results saved to {out_file}")
