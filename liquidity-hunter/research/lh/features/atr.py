"""Average True Range (Wilder), computed from closed bars only.

ATR at bar i uses bars 0..i and is available at that bar's close_time.
Code that sets a tolerance *before* evaluating bar i should use atr.shift(1).
"""
from __future__ import annotations

import numpy as np
import pandas as pd


def true_range(bars: pd.DataFrame) -> pd.Series:
    prev_close = bars["close"].shift(1)
    tr = pd.concat([
        bars["high"] - bars["low"],
        (bars["high"] - prev_close).abs(),
        (bars["low"] - prev_close).abs(),
    ], axis=1).max(axis=1)
    tr.iloc[0] = bars["high"].iloc[0] - bars["low"].iloc[0]
    return tr


def atr(bars: pd.DataFrame, n: int = 14) -> pd.Series:
    """Wilder ATR. NaN for the first n-1 bars (warm-up)."""
    tr = true_range(bars).to_numpy()
    out = np.full(len(tr), np.nan)
    if len(tr) >= n:
        out[n - 1] = tr[:n].mean()
        for i in range(n, len(tr)):
            out[i] = (out[i - 1] * (n - 1) + tr[i]) / n
    return pd.Series(out, index=bars.index, name=f"atr{n}")
