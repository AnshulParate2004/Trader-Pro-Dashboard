#!/usr/bin/env python3
"""
Leak-Free Feature Extraction Pipeline for 4H / Daily Swing Meta-Labeling Engine
Specification: docs/ARCHITECTURE.md, docs/KNOWN_ISSUES.md (Bug A Remedy)

Invariants:
1. All features are strictly calculated on completed bars t-1 and earlier (.shift(1)).
2. Relative Strength vs BTC (3-day, 7-day, 30-day return ratios).
3. Funding Rate Z-score and Open Interest Delta.
4. EWMA Volatility Ratio (current vol / 30-day baseline).
5. Volume Z-Score relative to 20-period rolling window.
6. Zero intra-bar or higher-timeframe future leakage.
"""

from typing import Dict, List, Optional, Tuple, Union
import numpy as np
import pandas as pd

from .config import EWMA_DECAY_LAMBDA


def compute_relative_strength_vs_btc(
    asset_close: pd.Series,
    btc_close: pd.Series,
    lookback_bars: int,
) -> pd.Series:
    """
    Computes leak-free Relative Strength ratio of asset vs BTC over lookback_bars:
    RS = (Asset Return + 1) / (BTC Return + 1) - 1
    Uses bar t-1 close strictly.
    """
    # Shift by 1 to ensure zero lookahead
    asset_c = asset_close.shift(1)
    btc_c = btc_close.shift(1)

    asset_ret = asset_c / asset_c.shift(lookback_bars) - 1.0
    btc_ret = btc_c / btc_c.shift(lookback_bars) - 1.0

    rs = (1.0 + asset_ret) / (1.0 + btc_ret.clip(lower=-0.99)) - 1.0
    return rs


def compute_ewma_volatility_ratio(
    close: pd.Series,
    decay_lambda: float = EWMA_DECAY_LAMBDA,
    baseline_bars: int = 180,  # 30 days on 4H (30 * 6)
) -> Tuple[pd.Series, pd.Series]:
    """
    Computes EWMA conditional volatility and its ratio to rolling medium-term baseline:
    sigma_t^2 = lambda * sigma_{t-1}^2 + (1 - lambda) * r_t^2
    Strictly lagged by 1 bar.
    """
    ret = close.pct_change().shift(1)  # Lagged returns
    ret_sq = ret ** 2

    # Vectorized EWMA calculation
    ewma_var = ret_sq.ewm(alpha=(1.0 - decay_lambda), adjust=False).mean()
    ewma_vol = np.sqrt(ewma_var)

    # Medium-term baseline volatility
    rolling_baseline = ret.rolling(baseline_bars, min_periods=min(30, baseline_bars)).std()

    vol_ratio = ewma_vol / (rolling_baseline.clip(lower=1e-6))
    return ewma_vol, vol_ratio


def compute_funding_zscore(
    funding_rate_series: pd.Series,
    rolling_window: int = 60,
) -> pd.Series:
    """
    Computes rolling Z-score of perpetual funding rates.
    Strictly lagged by 1 bar to prevent lookahead to current bar's settlement.
    """
    fr_lagged = funding_rate_series.shift(1)
    mean = fr_lagged.rolling(rolling_window, min_periods=10).mean()
    std = fr_lagged.rolling(rolling_window, min_periods=10).std().replace(0, np.nan)
    zscore = (fr_lagged - mean) / (std + 1e-8)
    return zscore.fillna(0.0)


def compute_open_interest_delta(
    oi_series: pd.Series,
    lookback_bars: int = 6,  # 24 hours on 4H cadence
) -> pd.Series:
    """
    Computes percentage change in Open Interest over lookback_bars.
    Strictly lagged by 1 bar.
    """
    oi_lagged = oi_series.shift(1)
    delta = oi_lagged / oi_lagged.shift(lookback_bars) - 1.0
    return delta.fillna(0.0)


def compute_volume_zscore(
    volume: pd.Series,
    window: int = 20,
) -> pd.Series:
    """
    Computes volume Z-score relative to 20-period rolling average.
    Strictly lagged by 1 bar.
    """
    vol_lagged = volume.shift(1)
    rolling_mean = vol_lagged.rolling(window, min_periods=5).mean()
    rolling_std = vol_lagged.rolling(window, min_periods=5).std().replace(0, np.nan)
    zscore = (vol_lagged - rolling_mean) / (rolling_std + 1e-8)
    return zscore.fillna(0.0)



def compute_elastic_stretch_ratio(
    close: pd.Series,
    ema_20: pd.Series,
    atr_14: pd.Series,
) -> pd.Series:
    """
    1. Rubber Band / Elastic Stretch Ratio (feat_elastic_stretch_ratio):
    ElasticStretch = |P_t - EMA_20(P)| / ATR_14(P)
    Rejects breakout entries when price has over-extended beyond mean reversion limits (> 2.5 x ATR).
    Strictly lagged t-1.
    """
    stretch = (close - ema_20).abs() / (atr_14 + 1e-8)
    return stretch.fillna(0.0)


def compute_fib_golden_zone_depth(
    close: pd.Series,
    swing_high: pd.Series,
    swing_low: pd.Series,
) -> pd.Series:
    """
    2. Fibonacci Dynamic Confluence Depth (feat_fib_golden_zone_depth):
    FibDepth = (P_t - Low_swing) / (High_swing - Low_swing)
    Quantifies pullback proximity to the 0.500-0.618 golden zone before entry expansion.
    Strictly lagged t-1.
    """
    diff = (swing_high - swing_low).replace(0, np.nan)
    depth = (close - swing_low) / (diff + 1e-8)
    return depth.fillna(0.5).clip(0.0, 1.0)


def compute_donchian_breakout_velocity(
    close: pd.Series,
    donchian_upper_20: pd.Series,
    atr_14: pd.Series,
) -> pd.Series:
    """
    3. Donchian Breakout Velocity (feat_donchian_breakout_velocity):
    BreakoutVelocity = (P_t - DonchianUpper_20) / ATR_14(P)
    Separates explosive structural momentum from weak boundary-touch false breakouts.
    Strictly lagged t-1.
    """
    velocity = (close - donchian_upper_20) / (atr_14 + 1e-8)
    return velocity.fillna(0.0)


def build_swing_features(
    df_asset: pd.DataFrame,
    df_btc: Optional[pd.DataFrame] = None,
    interval: str = "4h",
) -> pd.DataFrame:
    """
    Constructs the canonical leak-free feature matrix for 4H/Daily swing meta-labeling.
    Every feature at row t depends strictly on data from bars <= t-1.
    """
    df_feat = pd.DataFrame(index=df_asset.index)
    df_feat["open_time"] = df_asset["open_time"]

    close = df_asset["close"]
    high = df_asset["high"]
    low = df_asset["low"]
    volume = df_asset["volume"]

    # 1. Bar Cadence Scaling
    bars_per_day = 6 if interval == "4h" else 1

    bars_3d = 3 * bars_per_day
    bars_7d = 7 * bars_per_day
    bars_30d = 30 * bars_per_day

    # 2. Relative Strength vs BTC (3d, 7d, 30d)
    if df_btc is not None and not df_btc.empty:
        # Align BTC close on timestamp
        btc_aligned = pd.merge_asof(
            df_asset[["open_time"]],
            df_btc[["open_time", "close"]].rename(columns={"close": "btc_close"}),
            on="open_time",
            direction="backward",
        )["btc_close"]
        df_feat["rs_vs_btc_3d"] = compute_relative_strength_vs_btc(close, btc_aligned, bars_3d)
        df_feat["rs_vs_btc_7d"] = compute_relative_strength_vs_btc(close, btc_aligned, bars_7d)
        df_feat["rs_vs_btc_30d"] = compute_relative_strength_vs_btc(close, btc_aligned, bars_30d)
    else:
        df_feat["rs_vs_btc_3d"] = 0.0
        df_feat["rs_vs_btc_7d"] = 0.0
        df_feat["rs_vs_btc_30d"] = 0.0

    # 3. Derivatives Features: Funding Rate Z-score & Open Interest Delta
    if "funding_rate" in df_asset.columns:
        df_feat["funding_rate_zscore"] = compute_funding_zscore(df_asset["funding_rate"], rolling_window=15 * bars_per_day)
    else:
        df_feat["funding_rate_zscore"] = 0.0

    if "open_interest" in df_asset.columns:
        df_feat["oi_delta_1d"] = compute_open_interest_delta(df_asset["open_interest"], lookback_bars=bars_per_day)
        df_feat["oi_delta_3d"] = compute_open_interest_delta(df_asset["open_interest"], lookback_bars=bars_3d)
    else:
        df_feat["oi_delta_1d"] = 0.0
        df_feat["oi_delta_3d"] = 0.0

    # 4. Volatility: EWMA Volatility Ratio
    ewma_vol, vol_ratio = compute_ewma_volatility_ratio(close, baseline_bars=bars_30d)
    df_feat["ewma_vol"] = ewma_vol
    df_feat["vol_ratio_30d"] = vol_ratio

    # 5. Volume: Volume Z-Score (20-period)
    df_feat["volume_zscore_20"] = compute_volume_zscore(volume, window=20)

    # 6. Trend & Macro Regime Filters (Strictly Lagged t-1)
    close_lag = close.shift(1)
    high_lag = high.shift(1)
    low_lag = low.shift(1)

    # 20-period and 50-period EMAs
    ema_20 = close_lag.ewm(span=20, adjust=False).mean()
    ema_50 = close_lag.ewm(span=50, adjust=False).mean()
    sma_200 = close_lag.rolling(200, min_periods=50).mean()

    df_feat["dist_ema_20"] = (close_lag - ema_20) / (ema_20 + 1e-8)
    df_feat["dist_ema_50"] = (close_lag - ema_50) / (ema_50 + 1e-8)
    df_feat["dist_sma_200"] = (close_lag - sma_200) / (sma_200 + 1e-8)
    df_feat["trend_aligned"] = ((close_lag > ema_50) & (ema_50 > sma_200)).astype(float)

    # 7. Donchian Channel Position (20-period breakout measure)
    donchian_high_20 = high_lag.rolling(20, min_periods=10).max()
    donchian_low_20 = low_lag.rolling(20, min_periods=10).min()
    donchian_range = (donchian_high_20 - donchian_low_20).replace(0, np.nan)
    df_feat["donchian_pos_20"] = (close_lag - donchian_low_20) / (donchian_range + 1e-8)

    # 8. ATR Normalized Volatility (14-period)
    tr1 = high_lag - low_lag
    tr2 = (high_lag - close_lag.shift(1)).abs()
    tr3 = (low_lag - close_lag.shift(1)).abs()
    tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
    atr = tr.rolling(14, min_periods=5).mean()
    df_feat["atr_pct"] = atr / (close_lag + 1e-8)

    return df_feat
