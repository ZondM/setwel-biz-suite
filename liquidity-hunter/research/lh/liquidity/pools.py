"""Liquidity pool identification (spec B.1.4).

A pool is a price level where resting orders are *plausibly* clustered. It is
not a trade signal, and nothing here claims to know where real orders sit.

Every pool has `known_time` (when it becomes usable) and `expires_time`.
Pools are never deleted; later stages retire them with a reason.

Trading day convention: a trading day runs 17:00 -> 17:00 New York time and is
labelled by the calendar date on which it ends.
"""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
import pandas as pd

NY = "America/New_York"
POOL_COLUMNS = ["pool_id", "type", "side", "tf", "level", "price_lo", "price_hi",
                "origin_time", "known_time", "expires_time"]


@dataclass(frozen=True)
class EqualParams:
    eq_atr: float = 0.10
    eq_ticks: int = 3
    tick: float = 0.01
    min_bars_apart: int = 5
    lookback_swings: int = 10


@dataclass(frozen=True)
class SessionParams:
    """Session windows as minutes after the trading-day start (17:00 New York)."""
    windows: dict = field(default_factory=lambda: {
        "ASIA": (60, 540),      # 18:00 - 02:00 NY
        "LONDON": (540, 900),   # 02:00 - 08:00 NY
        "NEWYORK": (900, 1380), # 08:00 - 16:00 NY
    })
    expiry: pd.Timedelta = pd.Timedelta(hours=24)


def _frame(rows: list[tuple]) -> pd.DataFrame:
    return pd.DataFrame(rows, columns=POOL_COLUMNS)


def swing_pools(swings: pd.DataFrame, tf: str, tf_len: pd.Timedelta, max_age_bars: int = 200) -> pd.DataFrame:
    rows = []
    for s in swings.itertuples(index=False):
        rows.append((f"SWING-{tf}-{s.kind}-{s.bar_time:%Y%m%d%H%M}", "SWING", s.kind, tf, s.price, s.price, s.price,
                     s.bar_time, s.known_time, s.bar_time + max_age_bars * tf_len))
    return _frame(rows)


def equal_pools(swings: pd.DataFrame, bars: pd.DataFrame, atr: pd.Series, tf: str, tf_len: pd.Timedelta,
                p: EqualParams = EqualParams(), max_age_bars: int = 200) -> pd.DataFrame:
    """Equal highs / equal lows from pairs of confirmed swings.

    Pair (s1, s2) of same-kind swings qualifies when |s1 - s2| <= tol (ATR at
    s2's confirmation bar), they are >= min_bars_apart bars apart, and no bar
    between them traded beyond the pair's outer price. A new pool is skipped if
    an earlier, still-unexpired pool of the same side is within tol.
    """
    hi, lo, a = bars["high"].to_numpy(), bars["low"].to_numpy(), atr.to_numpy()
    rows, active = [], []
    for kind in ("H", "L"):
        ss = swings[swings["kind"] == kind].sort_values("known_idx")
        hist: list = []
        for s in ss.itertuples(index=False):
            atr_k = a[int(s.known_idx)]
            if np.isnan(atr_k):
                hist.append(s)
                continue
            tol = max(p.eq_atr * atr_k, p.eq_ticks * p.tick)
            for s1 in reversed(hist[-p.lookback_swings:]):
                if abs(s1.price - s.price) > tol or s.idx - s1.idx < p.min_bars_apart:
                    continue
                outer = max(s1.price, s.price) if kind == "H" else min(s1.price, s.price)
                between = slice(int(s1.idx) + 1, int(s.idx))
                if kind == "H" and hi[between].size and hi[between].max() > outer:
                    continue
                if kind == "L" and lo[between].size and lo[between].min() < outer:
                    continue
                dup = any(r[2] == kind and abs(r[4] - outer) <= tol and r[9] > s.known_time
                          for r in active)
                if not dup:
                    row = (f"EQ{kind}-{tf}-{s.bar_time:%Y%m%d%H%M}", f"EQ{kind}", kind, tf, outer,
                           min(s1.price, s.price), max(s1.price, s.price),
                           s1.bar_time, s.known_time, s.bar_time + max_age_bars * tf_len)
                    rows.append(row)
                    active.append(row)
                break
            hist.append(s)
    return _frame(rows).sort_values("known_time", kind="stable").reset_index(drop=True)


def trading_day(times: pd.DatetimeIndex) -> pd.DatetimeIndex:
    """Label each UTC timestamp with its trading day (17:00 NY boundary)."""
    ny = times.tz_convert(NY)
    return (ny + pd.Timedelta(hours=7)).normalize().tz_localize(None)


def _day_end_utc(day: pd.Timestamp) -> pd.Timestamp:
    return pd.Timestamp(day.year, day.month, day.day, 17, 0).tz_localize(NY).tz_convert("UTC")


def _next_weekday(day: pd.Timestamp) -> pd.Timestamp:
    nxt = day + pd.Timedelta(days=1)
    while nxt.dayofweek >= 5:
        nxt += pd.Timedelta(days=1)
    return nxt


def period_pools(bars: pd.DataFrame, period: str) -> pd.DataFrame:
    """Previous-day (period='D') or previous-week (period='W') high and low.

    The pool is known at the period's end and expires at the end of the next
    period. Periods still in progress at the end of the data are not emitted.
    """
    day = trading_day(bars.index)
    key = day if period == "D" else day.to_period("W-SUN").start_time
    g = bars.groupby(key)
    hi, lo = g["high"].max(), g["low"].min()
    hi_t = bars["high"].groupby(key).idxmax()
    lo_t = bars["low"].groupby(key).idxmin()
    data_start, data_end = bars.index.min(), bars["close_time"].max()
    name = "PD" if period == "D" else "PW"
    rows = []
    for k in hi.index:
        first_day = k
        last_day = k if period == "D" else k + pd.Timedelta(days=4)
        if _day_end_utc(first_day - pd.Timedelta(days=1)) < data_start:
            continue  # period only partly covered by the data
        end = _day_end_utc(last_day)
        if end > data_end:
            continue  # period still in progress
        nxt_end = _day_end_utc(_next_weekday(last_day) if period == "D" else last_day + pd.Timedelta(days=7))
        rows.append((f"{name}H-{k:%Y%m%d}", f"{name}H", "H", period, hi[k], hi[k], hi[k], hi_t[k], end, nxt_end))
        rows.append((f"{name}L-{k:%Y%m%d}", f"{name}L", "L", period, lo[k], lo[k], lo[k], lo_t[k], end, nxt_end))
    return _frame(rows)


def session_pools(bars: pd.DataFrame, p: SessionParams = SessionParams()) -> pd.DataFrame:
    """High/low of each configured session, known at the session's end."""
    day = trading_day(bars.index)
    uniq = day.unique()
    start_map = pd.Series([_day_end_utc(d - pd.Timedelta(days=1)) for d in uniq], index=uniq)
    day_start = pd.DatetimeIndex(start_map.reindex(day).to_numpy())
    minutes = (bars.index - day_start).total_seconds().to_numpy() / 60
    data_start, data_end = bars.index.min(), bars["close_time"].max()
    rows = []
    for name, (m0, m1) in p.windows.items():
        sel = (minutes >= m0) & (minutes < m1)
        b = bars[sel]
        if b.empty:
            continue
        k = day[sel]
        g = b.groupby(k)
        for d, grp in g:
            begin = start_map[d] + pd.Timedelta(minutes=m0)
            end = start_map[d] + pd.Timedelta(minutes=m1)
            if begin < data_start or end > data_end:
                continue  # session only partly covered by the data
            h_t, l_t = grp["high"].idxmax(), grp["low"].idxmin()
            rows.append((f"{name}H-{d:%Y%m%d}", f"{name}_H", "H", "SESSION", grp["high"].max(),
                         grp["high"].max(), grp["high"].max(), h_t, end, end + p.expiry))
            rows.append((f"{name}L-{d:%Y%m%d}", f"{name}_L", "L", "SESSION", grp["low"].min(),
                         grp["low"].min(), grp["low"].min(), l_t, end, end + p.expiry))
    return _frame(rows).sort_values("known_time", kind="stable").reset_index(drop=True)
