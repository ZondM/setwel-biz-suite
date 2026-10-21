"""Order-block retest zone and M5 retest state machine (spec B.1.8, v0.4)."""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd


@dataclass(frozen=True)
class RetestParams:
    zone_lookback: int = 10
    expiry: pd.Timedelta = pd.Timedelta(hours=6)
    max_entry_atr: float = 0.5


def order_block_zone(bars: pd.DataFrame, disp_start_pos: int, direction: int, lookback: int = 10):
    """Last opposite-coloured candle within `lookback` bars before position disp_start_pos.

    Short (direction -1): last bullish candle, zone [open, high].
    Long (+1): last bearish candle, zone [low, open].
    Returns (zone_lo, zone_hi, near_edge, far_edge, candle_time) or None.
    """
    o, h, l, c = (bars[x].to_numpy() for x in ("open", "high", "low", "close"))
    for i in range(disp_start_pos - 1, max(disp_start_pos - 1 - lookback, -1), -1):
        if direction < 0 and c[i] > o[i]:
            return o[i], h[i], o[i], h[i], bars.index[i]
        if direction > 0 and c[i] < o[i]:
            return l[i], o[i], o[i], l[i], bars.index[i]
    return None


def run_retest(m5: pd.DataFrame, direction: int, near: float, far: float, stop: float,
               start: pd.Timestamp, ref_entry: float, ref_risk: float,
               p: RetestParams = RetestParams()) -> dict:
    """Walk closed M5 bars opening at/after `start` until the zone holds, fails or expires.

    status: CONFIRMED (confirm_time = close of the hold bar), INVALID_FAR_CLOSE,
            INVALID_STOP, MISSED_NO_RETEST, EXPIRED, NO_DATA.
    """
    d = direction
    i = m5.index.searchsorted(start, side="left")
    end = start + p.expiry
    h, l, c = m5["high"].to_numpy(), m5["low"].to_numpy(), m5["close"].to_numpy()
    ct = m5["close_time"]
    missed_level = ref_entry + d * ref_risk
    touched = None
    while i < len(c) and m5.index[i] < end:
        if d < 0:
            stop_hit, missed = h[i] >= stop, l[i] <= missed_level
            touch, far_close, back = h[i] >= near, c[i] > far, c[i] < near
        else:
            stop_hit, missed = l[i] <= stop, h[i] >= missed_level
            touch, far_close, back = l[i] <= near, c[i] < far, c[i] > near
        if stop_hit:
            return {"status": "INVALID_STOP", "touch_time": touched, "end_time": ct.iat[i]}
        if touched is None and missed:
            return {"status": "MISSED_NO_RETEST", "touch_time": None, "end_time": ct.iat[i]}
        if touch and touched is None:
            touched = m5.index[i]
        if touched is not None:
            if far_close:
                return {"status": "INVALID_FAR_CLOSE", "touch_time": touched, "end_time": ct.iat[i]}
            if back:
                return {"status": "CONFIRMED", "touch_time": touched, "end_time": ct.iat[i]}
        i += 1
    if i >= len(c):
        return {"status": "NO_DATA", "touch_time": touched, "end_time": None}
    return {"status": "EXPIRED", "touch_time": touched, "end_time": end}
