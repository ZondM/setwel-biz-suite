"""Displacement (spec B.1.7, v0.4).

At bar t, a displacement of direction d (+1 up / -1 down) exists if for some
k in 1..max_bars the bars t-k+1..t are all in direction d, every body is
>= body_min of its range, the net move d*(close[t] - open[t-k+1]) is
>= d_atr * ATR[t-k] (ATR before the sequence), and bar t closes in the outer
close_zone of its range. The shortest qualifying k is reported.

The structure-break requirement is applied by the model, which combines this
with BOS/CHoCH events.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd


@dataclass(frozen=True)
class DisplacementParams:
    max_bars: int = 3
    d_atr: float = 1.5
    body_min: float = 0.6
    close_zone: float = 0.25


def find_displacements(bars: pd.DataFrame, atr: pd.Series,
                       p: DisplacementParams = DisplacementParams()) -> pd.DataFrame:
    """Per bar: disp_dir (+1, -1 or 0), disp_bars (k), disp_start (time of first bar), disp_move_atr."""
    o, h, l, c = (bars[x].to_numpy() for x in ("open", "high", "low", "close"))
    a = atr.to_numpy()
    n = len(bars)
    rng = h - l
    body = np.abs(c - o)
    strong = np.where(rng > 0, body >= p.body_min * rng, False)
    sign = np.sign(c - o)
    out_dir = np.zeros(n, dtype=int)
    out_k = np.zeros(n, dtype=int)
    out_move = np.full(n, np.nan)
    for t in range(n):
        if rng[t] <= 0:
            continue
        for d in (1, -1):
            pos = (c[t] - l[t]) / rng[t] if d == 1 else (h[t] - c[t]) / rng[t]
            if pos < 1 - p.close_zone:
                continue
            for k in range(1, p.max_bars + 1):
                s = t - k + 1
                if s < 1 or sign[s] != d or not strong[s]:
                    break
                ref = a[s - 1]
                if np.isnan(ref):
                    break
                move = d * (c[t] - o[s])
                if move >= p.d_atr * ref:
                    out_dir[t], out_k[t], out_move[t] = d, k, move / ref
                    break
            if out_dir[t]:
                break
    starts = bars.index[np.clip(np.arange(n) - np.maximum(out_k, 1) + 1, 0, None)]
    return pd.DataFrame({"disp_dir": out_dir, "disp_bars": out_k,
                         "disp_start": pd.Series(starts, index=bars.index).where(out_dir != 0),
                         "disp_move_atr": out_move}, index=bars.index)
