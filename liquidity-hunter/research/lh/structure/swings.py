"""Confirmed fractal swing points (spec B.1.1).

Bar i is a swing high if its high is strictly above the L bars before it and
greater than or equal to the R bars after it (so a flat top yields one swing,
at its earliest bar). Swing lows mirror this.

A swing is only knowable once bar i+R has closed: `known_time` is the
close_time of bar i+R. Nothing may use a swing before its known_time.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd


@dataclass(frozen=True)
class SwingParams:
    left: int = 2
    right: int = 2


def find_swings(bars: pd.DataFrame, p: SwingParams = SwingParams()) -> pd.DataFrame:
    """Return swings sorted by known order.

    Columns: kind ('H'/'L'), idx (bar position), bar_time, price, known_idx,
    known_time. Requires a `close_time` column on bars.
    """
    hi, lo = bars["high"].to_numpy(), bars["low"].to_numpy()
    n = len(bars)
    rows = []
    if n <= p.left + p.right:
        return pd.DataFrame(columns=["kind", "idx", "price", "known_idx", "bar_time", "known_time"])
    for kind, x, better, better_eq in (
        ("H", hi, np.greater, np.greater_equal),
        ("L", lo, np.less, np.less_equal),
    ):
        ok = np.zeros(n, dtype=bool)
        ok[p.left: n - p.right] = True
        for k in range(1, p.left + 1):
            ok[p.left: n - p.right] &= better(x[p.left: n - p.right], x[p.left - k: n - p.right - k])
        for k in range(1, p.right + 1):
            ok[p.left: n - p.right] &= better_eq(x[p.left: n - p.right], x[p.left + k: n - p.right + k])
        for i in np.flatnonzero(ok):
            rows.append((kind, i, x[i]))
    df = pd.DataFrame(rows, columns=["kind", "idx", "price"])
    df["known_idx"] = df["idx"] + p.right
    df["bar_time"] = bars.index[df["idx"].to_numpy()]
    df["known_time"] = bars["close_time"].iloc[df["known_idx"].to_numpy()].array
    return df.sort_values(["known_idx", "idx", "kind"], kind="stable").reset_index(drop=True)
