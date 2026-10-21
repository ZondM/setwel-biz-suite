"""Consolidation ranges (spec B.1.6, v0.4).

A range becomes valid at the close of the n_min-th bar of a window whose width
(max high - min low) is <= c_atr * ATR (ATR of the bar before the window) and
where >= overlap_share of bars overlap the previous bar by >= overlap_min of
their own range. Later bars extend it while the close stays inside the
boundaries +/- b_tol and the width stays within the limit. It ends on a close
beyond a boundary (BREAK_UP / BREAK_DOWN) or when the width exceeds the limit
(INVALID). Only one range is active at a time.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd


@dataclass(frozen=True)
class ConsolidationParams:
    n_min: int = 8
    c_atr: float = 2.5
    overlap_share: float = 0.6
    overlap_min: float = 0.5
    b_atr: float = 0.05
    b_ticks: int = 2
    tick: float = 0.01


def _overlap_ok(hi, lo, i, p) -> bool:
    rng = hi[i] - lo[i]
    if rng <= 0:
        return True
    ov = min(hi[i], hi[i - 1]) - max(lo[i], lo[i - 1])
    return ov >= p.overlap_min * rng


def find_consolidations(bars: pd.DataFrame, atr: pd.Series,
                        p: ConsolidationParams = ConsolidationParams()) -> tuple[pd.DataFrame, pd.Series]:
    """Return (ranges, active).

    ranges: start_time, valid_time (close of the bar that validated it),
            end_time (close of the bar that ended it, NaT if still active),
            high, low, end_reason.
    active: bool per bar, True if a valid range is active after that bar's close.
    """
    hi, lo, cl = (bars[c].to_numpy() for c in ("high", "low", "close"))
    a = atr.to_numpy()
    ct = bars["close_time"]
    n = len(bars)
    active = np.zeros(n, dtype=bool)
    rows = []
    cur = None  # dict(start, hi, lo, limit)
    t = 0
    while t < n:
        if cur is not None:
            tol = max(p.b_atr * cur["atr"], p.b_ticks * p.tick)
            if cl[t] > cur["hi"] + tol or cl[t] < cur["lo"] - tol:
                reason = "BREAK_UP" if cl[t] > cur["hi"] else "BREAK_DOWN"
            elif max(cur["hi"], hi[t]) - min(cur["lo"], lo[t]) > cur["limit"]:
                reason = "INVALID"
            else:
                reason = None
                cur["hi"], cur["lo"] = max(cur["hi"], hi[t]), min(cur["lo"], lo[t])
                active[t] = True
            if reason:
                rows.append((bars.index[cur["start"]], cur["valid_time"], ct.iat[t], cur["hi"], cur["lo"], reason))
                cur = None
            t += 1
            continue
        s = t - p.n_min + 1
        if s >= 1 and not np.isnan(a[s - 1]):
            w_hi, w_lo = hi[s: t + 1].max(), lo[s: t + 1].min()
            limit = p.c_atr * a[s - 1]
            if w_hi - w_lo <= limit:
                ok = sum(_overlap_ok(hi, lo, i, p) for i in range(s, t + 1))
                if ok >= p.overlap_share * p.n_min:
                    cur = dict(start=s, hi=w_hi, lo=w_lo, limit=limit, atr=a[s - 1], valid_time=ct.iat[t])
                    active[t] = True
        t += 1
    if cur is not None:
        rows.append((bars.index[cur["start"]], cur["valid_time"], pd.NaT, cur["hi"], cur["lo"], None))
    ranges = pd.DataFrame(rows, columns=["start_time", "valid_time", "end_time", "high", "low", "end_reason"])
    return ranges, pd.Series(active, index=bars.index, name="range_active")
