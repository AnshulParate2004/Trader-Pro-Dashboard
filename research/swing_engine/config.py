#!/usr/bin/env python3
"""
Centralized Configuration for 4H / Daily Swing Meta-Labeling Engine
Specification: docs/ARCHITECTURE.md
Invariant: Zero hardcoded absolute paths. Reads DATA_ROOT from environment with relative defaults.
"""

import os
from pathlib import Path
from typing import List, Optional


# Search candidates for data root in priority order
CANDIDATE_DATA_PATHS = [
    Path("data"),
    Path("../data"),
    Path("notebooks/data"),
    Path("../notebooks/data"),
    Path("../Trader-Pro/notebooks/data"),
    Path("research/data"),
]


def get_data_root(custom_root: Optional[str] = None) -> Path:
    """
    Resolves data root path using relative defaults or environment variable.
    Guarantees no hardcoded absolute drive paths.
    """
    if custom_root:
        return Path(custom_root)
    env_root = os.environ.get("DATA_ROOT")
    if env_root:
        return Path(env_root)
    for c in CANDIDATE_DATA_PATHS:
        if c.exists():
            return c
    return Path("data")


# Core Universe
SYMBOLS: List[str] = ["BTCUSDT", "ETHUSDT", "SOLUSDT"]
BENCHMARK_SYMBOL: str = "BTCUSDT"

# Execution Timeframes
INTERVAL_4H: str = "4h"
INTERVAL_1D: str = "1d"

# Triple-Barrier Method Parameters
UPPER_BARRIER_R: float = 2.5       # +2.5R target profit
LOWER_BARRIER_R: float = 1.0       # -1.0R initial stop loss
TIME_BARRIER_BARS: int = 12        # 12 bars (48 hours on 4H cadence)
ROUND_TRIP_FRICTION_PCT: float = 0.0010  # 0.10% standard exchange friction (fees + GST + slippage)

# Meta-Classifier Gating Parameters
META_QUALITY_THRESHOLD: float = 0.65     # Minimum P(net win >= 2R) required to execute
MIN_STOP_LOSS_PCT: float = 0.015         # 1.5% minimum stop distance floor
MAX_STOP_LOSS_PCT: float = 0.060         # 6.0% maximum stop distance ceiling
MAX_COST_R_THRESHOLD: float = 0.08       # Maximum allowable friction-to-risk ratio

# Volatility Targeting (J.P. Morgan RiskMetrics)
VOL_TARGET_ANNUAL: float = 0.35          # 35% annualized volatility target
EWMA_DECAY_LAMBDA: float = 0.94          # Standard daily EWMA decay factor
MIN_POSITION_WEIGHT: float = 0.20        # Minimum leverage allocation
MAX_POSITION_WEIGHT: float = 1.50        # Maximum leverage allocation
ANNUALIZATION_FACTOR_4H: float = 365.25 * 6
ANNUALIZATION_FACTOR_DAILY: float = 365.25

# Binance Public API Endpoints
BINANCE_SPOT_BASE_URL: str = "https://data-api.binance.vision/api/v3"
BINANCE_FUTURES_BASE_URL: str = "https://fapi.binance.com/fapi/v1"
