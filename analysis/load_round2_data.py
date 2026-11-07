#!/usr/bin/env python3
"""
Data Ingestion Module for Round 2 Macro Overlays
Specification: docs/prereg/round2_residual_edge.md (Amendment 4)

Loads daily parquet OHLCV data from a configurable DATA_ROOT.
Uses relative paths by default; contains zero hardcoded absolute drive paths.
"""

import os
from pathlib import Path
from typing import Optional
import pandas as pd


DEFAULT_DATA_ROOT = os.environ.get("DATA_ROOT", "data")


def get_data_root(custom_root: Optional[str] = None) -> Path:
    """
    Resolves data root path using relative defaults or environment variable.
    """
    if custom_root:
        return Path(custom_root)
    env_root = os.environ.get("DATA_ROOT")
    if env_root:
        return Path(env_root)
    # Check common relative project paths
    candidates = [
        Path("data"),
        Path("../data"),
        Path("notebooks/data"),
        Path("../notebooks/data"),
        Path("../Trader-Pro/notebooks/data"),
    ]
    for c in candidates:
        if c.exists():
            return c
    return Path(DEFAULT_DATA_ROOT)


def load_daily_series(
    symbol: str,
    data_root: Optional[str] = None,
    max_allowed_date: str = "2026-10-31",
) -> pd.Series:
    """
    Loads daily close price series for symbol (e.g. 'BTCUSDT' or 'ETHUSDT').
    Enforces that all dates are <= max_allowed_date for Stage X exploratory runs.
    """
    root = get_data_root(data_root)
    
    # Try finding daily parquet file
    possible_paths = [
        root / "1d" / f"{symbol}_1d.parquet",
        root / f"{symbol}_1d.parquet",
        root / f"{symbol}.parquet",
    ]
    
    selected_path = None
    for p in possible_paths:
        if p.exists():
            selected_path = p
            break
            
    if selected_path is None:
        raise FileNotFoundError(
            f"Daily parquet data for {symbol} not found under {root}. Searched: {[str(p) for p in possible_paths]}"
        )
        
    df = pd.read_parquet(selected_path)
    
    # Standardize date and close columns
    date_col = next((c for c in df.columns if c.lower() in ("date", "time", "timestamp", "opentime", "open_time")), None)
    close_col = next((c for c in df.columns if c.lower() in ("close", "close_price")), None)
    
    if not date_col or not close_col:
        raise ValueError(f"Required date or close column not found in {selected_path}. Columns: {df.columns.tolist()}")
        
    df[date_col] = pd.to_datetime(df[date_col])
    df = df.sort_values(date_col).reset_index(drop=True)
    
    # Assert date boundary
    last_date = df[date_col].max().strftime("%Y-%m-%d")
    if last_date > max_allowed_date:
        raise AssertionError(
            f"Dataset {selected_path} contains data up to {last_date}, which exceeds max allowed date {max_allowed_date}!"
        )
        
    series = df.set_index(date_col)[close_col].astype(float)
    return series
