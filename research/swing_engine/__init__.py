"""
Trader-Pro 4H / Daily Swing Meta-Labeling Engine
"""

from .config import (
    get_data_root,
    SYMBOLS,
    BENCHMARK_SYMBOL,
    INTERVAL_4H,
    INTERVAL_1D,
    UPPER_BARRIER_R,
    LOWER_BARRIER_R,
    TIME_BARRIER_BARS,
    ROUND_TRIP_FRICTION_PCT,
    META_QUALITY_THRESHOLD,
    VOL_TARGET_ANNUAL,
    EWMA_DECAY_LAMBDA,
)

__all__ = [
    "get_data_root",
    "SYMBOLS",
    "BENCHMARK_SYMBOL",
    "INTERVAL_4H",
    "INTERVAL_1D",
    "UPPER_BARRIER_R",
    "LOWER_BARRIER_R",
    "TIME_BARRIER_BARS",
    "ROUND_TRIP_FRICTION_PCT",
    "META_QUALITY_THRESHOLD",
    "VOL_TARGET_ANNUAL",
    "EWMA_DECAY_LAMBDA",
]
