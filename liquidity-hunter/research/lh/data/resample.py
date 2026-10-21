"""Build higher-timeframe bars from M1 bars of the same feed.

Each output bar carries `close_time`. A higher-timeframe bar may only be used
by lower-timeframe logic at or after its close_time (Phase 7 synchronisation).
"""
from __future__ import annotations

import pandas as pd

TIMEFRAMES = {
    "M1": pd.Timedelta(minutes=1),
    "M5": pd.Timedelta(minutes=5),
    "M15": pd.Timedelta(minutes=15),
    "H1": pd.Timedelta(hours=1),
    "H4": pd.Timedelta(hours=4),
    "D1": pd.Timedelta(days=1),
}


def resample_bars(m1: pd.DataFrame, tf: str, anchor_offset: pd.Timedelta = pd.Timedelta(0)) -> pd.DataFrame:
    """Aggregate M1 bars (UTC open-time index) into `tf` bars.

    anchor_offset shifts the bar grid relative to UTC midnight. With a GMT+0
    broker server, 0 reproduces the broker's own H4/D1 grid.

    Columns: open, high, low, close, tick_volume, spread_max, spread_median,
    n_src (M1 bars used), close_time, complete.
    `complete` is False for a final bar whose period extends past the data end.
    """
    freq = TIMEFRAMES[tf]
    g = m1.resample(freq, label="left", closed="left", origin=pd.Timestamp("1970-01-01", tz="UTC") + anchor_offset)
    out = pd.DataFrame({
        "open": g["open"].first(),
        "high": g["high"].max(),
        "low": g["low"].min(),
        "close": g["close"].last(),
        "tick_volume": g["tick_volume"].sum(min_count=1),
        "spread_max": g["spread"].max(),
        "spread_median": g["spread"].median(),
        "n_src": g["open"].count(),
    })
    out = out[out["n_src"] > 0].copy()
    out["close_time"] = out.index + freq
    data_end = m1.index.max() + TIMEFRAMES["M1"]
    out["complete"] = out["close_time"] <= data_end
    return out
