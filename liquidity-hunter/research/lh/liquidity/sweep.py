"""Sweep and reclaim detection (spec B.1.5), for a high pool; lows mirror.

Evaluated on closed bars of the sweep timeframe, starting with the first bar
that opens at or after the pool's known_time. ATR is taken from the previous
closed bar, so tolerances are fixed before each bar is evaluated.

  s_min = max(s_min_atr * ATR, s_min_ticks * tick)   minimum sweep depth
  s_max = s_max_atr * ATR                            deeper -> breakout
  b_tol = max(b_atr * ATR, b_ticks * tick)           close-through tolerance

Outcomes (one terminal status per pool):
  RECLAIMED  swept, then a close back inside within rc_bars (sweep bar counts)
  BROKEN     close beyond level + b_tol before reclaim, or depth > s_max
  NO_RECLAIM swept but not reclaimed within rc_bars
  EXPIRED    reached expires_time without a terminal event
  ACTIVE     still live at the end of the data
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd


@dataclass(frozen=True)
class SweepParams:
    s_min_atr: float = 0.05
    s_min_ticks: int = 2
    s_max_atr: float = 1.0
    b_atr: float = 0.05
    b_ticks: int = 2
    tick: float = 0.01
    rc_bars: int = 3


OUT_COLUMNS = ["status", "reason", "first_touch_time", "sweep_time", "sweep_extreme", "sweep_depth_atr",
               "reclaim_time", "bars_to_reclaim", "reclaim_close", "end_time"]


def detect_sweeps(pools: pd.DataFrame, bars: pd.DataFrame, atr: pd.Series,
                  p: SweepParams = SweepParams()) -> pd.DataFrame:
    """Return pools with outcome columns appended. `end_time` is when the
    terminal status became known (close_time of the deciding bar, or expiry)."""
    hi, lo, cl = bars["high"].to_numpy(), bars["low"].to_numpy(), bars["close"].to_numpy()
    ct = bars["close_time"]
    a_prev = atr.shift(1).to_numpy()
    data_end = ct.iat[-1] if len(bars) else None
    out = []
    for pool in pools.itertuples(index=False):
        out.append(_one(pool, hi, lo, cl, ct, a_prev, data_end, bars.index, p))
    res = pd.DataFrame(out, columns=OUT_COLUMNS, index=pools.index)
    return pd.concat([pools, res], axis=1)


def _one(pool, hi, lo, cl, ct, a_prev, data_end, idx, p: SweepParams):
    sign = 1.0 if pool.side == "H" else -1.0
    level = pool.level
    start = idx.searchsorted(pool.known_time, side="left")
    stop = idx.searchsorted(pool.expires_time, side="left")
    first_touch = sweep_t = extreme = depth = None
    sweep_i = None
    for i in range(start, len(cl)):
        if i >= stop and sweep_i is None:
            break  # expired; a sweep already in progress may finish its reclaim window
        a = a_prev[i]
        if np.isnan(a):
            continue
        s_min = max(p.s_min_atr * a, p.s_min_ticks * p.tick)
        s_max = p.s_max_atr * a
        b_tol = max(p.b_atr * a, p.b_ticks * p.tick)
        ext = hi[i] if sign > 0 else lo[i]
        pen = sign * (ext - level)          # how far beyond the level price traded
        close_beyond = sign * (cl[i] - level)
        if pen > 0 and first_touch is None:
            first_touch = idx[i]
        if sweep_i is None:
            if pen >= s_min:
                sweep_i, sweep_t, extreme = i, idx[i], ext
                depth = pen / a
            elif close_beyond >= b_tol:
                return ("BROKEN", "close_through", first_touch, None, None, None, None, None, None, ct.iat[i])
            else:
                continue
        else:
            if sign * (ext - extreme) > 0:
                extreme, depth = ext, sign * (ext - level) / a
        if sign * (extreme - level) > s_max:
            return ("BROKEN", "too_deep", first_touch, sweep_t, extreme, depth, None, None, None, ct.iat[i])
        if close_beyond < 0:
            return ("RECLAIMED", None, first_touch, sweep_t, extreme, depth, idx[i], i - sweep_i, cl[i], ct.iat[i])
        if close_beyond >= b_tol:
            return ("BROKEN", "close_through", first_touch, sweep_t, extreme, depth, None, None, None, ct.iat[i])
        if i - sweep_i + 1 >= p.rc_bars:
            return ("NO_RECLAIM", None, first_touch, sweep_t, extreme, depth, None, None, None, ct.iat[i])
    if sweep_i is None and data_end is not None and data_end >= pool.expires_time:
        return ("EXPIRED", None, first_touch, sweep_t, extreme, depth, None, None, None, pool.expires_time)
    return ("ACTIVE", None, first_touch, sweep_t, extreme, depth, None, None, None, None)
