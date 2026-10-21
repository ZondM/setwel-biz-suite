"""Single-trade simulation on M1 bid bars with spread (protocol docs/06).

Bars are bid prices. Spread per M1 bar = (bar spread points + extra_points) * point.
Long: buy at ask = bid open + spread, exit at bid. Short: sell at bid, exit at ask.
Stop exits fill one extra spread worse (and at the bar open if price gapped
through). Targets fill exactly at the target. If stop and target are both
inside one M1 bar, the stop is taken first. Results are in R, where
1R = |entry fill - stop|.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd

NY = "America/New_York"


@dataclass(frozen=True)
class CostParams:
    point: float = 0.01
    extra_spread_points: float = 2.0
    swap_long_per_night: float = -0.45   # price units per 1 oz
    swap_short_per_night: float = 0.20
    triple_weekday: int = 2              # Wednesday
    min_stop_points: float = 20.0        # broker stops level


@dataclass(frozen=True)
class ExitParams:
    target_r: float = 2.0
    max_hold: pd.Timedelta = pd.Timedelta(hours=24)
    friday_exit_ny: tuple[int, int] = (16, 50)


class M1Market:
    """M1 bid bars as numpy arrays for fast slicing."""

    def __init__(self, m1: pd.DataFrame, costs: CostParams = CostParams()):
        self.index = m1.index
        self.o, self.h, self.l, self.c = (m1[x].to_numpy() for x in ("open", "high", "low", "close"))
        self.sp = (m1["spread"].fillna(0).to_numpy() + costs.extra_spread_points) * costs.point
        self.costs = costs

    def first_bar_at_or_after(self, t: pd.Timestamp) -> int:
        return int(self.index.searchsorted(t, side="left"))


def entry_allowed(t: pd.Timestamp) -> bool:
    """No entries 16:30-18:00 New York, nor after 16:00 New York on Friday."""
    ny = t.tz_convert(NY)
    hm = ny.hour * 60 + ny.minute
    if 16 * 60 + 30 <= hm < 18 * 60:
        return False
    if ny.dayofweek == 4 and hm >= 16 * 60:
        return False
    return ny.dayofweek != 5


def _deadline(entry_time: pd.Timestamp, ex: ExitParams) -> pd.Timestamp:
    ny = entry_time.tz_convert(NY)
    days_to_fri = (4 - ny.dayofweek) % 7
    fri = (ny.normalize() + pd.Timedelta(days=days_to_fri)).replace(hour=ex.friday_exit_ny[0], minute=ex.friday_exit_ny[1])
    if fri <= ny:
        fri += pd.Timedelta(days=7)
    return min(entry_time + ex.max_hold, fri.tz_convert("UTC"))


def _nights(t0: pd.Timestamp, t1: pd.Timestamp, triple_weekday: int) -> int:
    """Swap nights charged at each 17:00 New York rollover in (t0, t1]."""
    a, b = t0.tz_convert(NY), t1.tz_convert(NY)
    day = a.normalize()
    n = 0
    while True:
        roll = day.replace(hour=17)
        if roll > b:
            break
        if roll > a and roll.dayofweek < 5:
            n += 3 if roll.dayofweek == triple_weekday else 1
        day += pd.Timedelta(days=1)
    return n


def simulate(mk: M1Market, signal_time: pd.Timestamp, direction: int, *,
             stop_price: float | None = None, stop_ref: float | None = None, buffer_atr: float = 0.0,
             stop_distance: float | None = None, ex: ExitParams = ExitParams()) -> dict:
    """Simulate one trade entered at the first M1 open at/after signal_time.

    Stop is given as one of:
      stop_price                 absolute price
      stop_ref (+ buffer_atr)    structural level; buffer = max(buffer_atr, 1.5 * entry spread)
      stop_distance              distance from the entry fill
    Returns a dict; `status` is 'FILLED' or a rejection reason.
    """
    i0 = mk.first_bar_at_or_after(signal_time)
    if i0 >= len(mk.o):
        return {"status": "NO_DATA"}
    t0 = mk.index[i0]
    if t0 - signal_time > pd.Timedelta(minutes=30) or not entry_allowed(t0):
        return {"status": "TIME_FILTER", "entry_time": t0}
    d = direction
    sp0 = mk.sp[i0]
    fill = mk.o[i0] + sp0 if d > 0 else mk.o[i0]
    if stop_price is not None:
        stop = stop_price
    elif stop_ref is not None:
        stop = stop_ref - d * max(buffer_atr, 1.5 * sp0)
    else:
        stop = fill - d * stop_distance
    risk = d * (fill - stop)
    if risk <= 0:
        return {"status": "STOP_BEYOND_ENTRY", "entry_time": t0}
    if risk < mk.costs.min_stop_points * mk.costs.point + sp0:
        return {"status": "STOP_TOO_TIGHT", "entry_time": t0}
    target = fill + d * ex.target_r * risk

    j1 = mk.first_bar_at_or_after(_deadline(t0, ex))
    seg = slice(i0, max(j1, i0 + 1))
    h, l, o, sp = mk.h[seg], mk.l[seg], mk.o[seg], mk.sp[seg]
    if d > 0:
        stop_hit = l <= stop
        tgt_hit = h >= target
    else:
        stop_hit = h + sp >= stop
        tgt_hit = l + sp <= target
    fs = int(np.argmax(stop_hit)) if stop_hit.any() else len(h)
    ft = int(np.argmax(tgt_hit)) if tgt_hit.any() else len(h)
    if fs < len(h) and fs <= ft:
        k, reason = fs, "STOP"
        if d > 0:
            exit_px = min(stop, o[k]) - sp[k]
        else:
            exit_px = max(stop, o[k] + sp[k]) + sp[k]
    elif ft < len(h):
        k, reason, exit_px = ft, "TARGET", target
    else:
        k = len(h) - 1
        if j1 < len(mk.o):
            reason, exit_px, exit_time = "TIME", mk.o[j1] + (mk.sp[j1] if d < 0 else 0.0), mk.index[j1]
        else:
            reason, exit_px, exit_time = "END_OF_DATA", mk.c[seg][-1] + (sp[-1] if d < 0 else 0.0), mk.index[seg][-1]
    if reason in ("STOP", "TARGET"):
        exit_time = mk.index[i0 + k]
    path_h = h[: k + 1] + (sp[: k + 1] if d < 0 else 0)
    path_l = l[: k + 1] + (sp[: k + 1] if d < 0 else 0)
    mfe = (path_h.max() - fill) if d > 0 else (fill - path_l.min())
    mae = (fill - path_l.min()) if d > 0 else (path_h.max() - fill)
    nights = _nights(t0, exit_time, mk.costs.triple_weekday)
    swap = nights * (mk.costs.swap_long_per_night if d > 0 else mk.costs.swap_short_per_night)
    pnl = d * (exit_px - fill) + swap
    return {"status": "FILLED", "entry_time": t0, "direction": d, "entry": fill, "stop": stop,
            "target": target, "risk": risk, "exit_time": exit_time, "exit": exit_px, "exit_reason": reason,
            "swap": swap, "r": pnl / risk, "mfe_r": mfe / risk, "mae_r": mae / risk,
            "spread_entry_r": sp0 / risk}
