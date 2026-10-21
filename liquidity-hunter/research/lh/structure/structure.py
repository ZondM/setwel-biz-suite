"""Market structure: BOS / CHoCH events and regime (spec B.1.2, B.1.3).

Processed bar by bar on closed bars. At the close of bar t the engine knows:
bars 0..t, swings whose known_idx <= t, and ATR up to t.

Rules (v0.3):
- Reference high/low = the most recent confirmed swing high/low that has not
  been broken yet.
- Break tolerance tol = max(b_atr * ATR[t-1], b_ticks * tick), fixed before bar t.
- Close above ref_high + tol: BOS_UP if trend was bullish or undefined,
  CHOCH_UP if trend was bearish. Mirror for downside.
- After an up-break, protected_low = lowest low from the broken swing's bar to
  the break bar (the pullback low the move came from). Mirror for down-breaks.
- Regime precedence: INSUFFICIENT_DATA > RANGE > TRANSITIONAL > BULL/BEAR_TREND.
  RANGE: the last `range_n` confirmed swing prices fit inside r_atr * ATR.
  TRANSITIONAL: no break yet, or the last break was a CHoCH (no confirming BOS).
"""
from __future__ import annotations

from collections import deque
from dataclasses import dataclass

import numpy as np
import pandas as pd

BULL, BEAR, NONE = "BULL", "BEAR", "NONE"


@dataclass(frozen=True)
class StructureParams:
    b_atr: float = 0.05
    b_ticks: int = 2
    tick: float = 0.01
    min_swings: int = 6
    range_n: int = 6
    r_atr: float = 3.0


def run_structure(bars: pd.DataFrame, swings: pd.DataFrame, atr: pd.Series,
                  p: StructureParams = StructureParams()) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Return (events, state).

    events: one row per BOS/CHoCH with time, event_time, kind, level,
            broken_swing_time, close, tol, protected, prior_trend.
    state:  one row per bar, valid from `available_at` (the bar's close_time):
            trend, regime, ref_high, ref_low, protected_low, protected_high,
            last_event, swing_label (label of swings confirmed on this bar).
    """
    n = len(bars)
    hi, lo, cl = (bars[c].to_numpy() for c in ("high", "low", "close"))
    a = atr.to_numpy()
    by_known: dict[int, list] = {}
    for s in swings.itertuples(index=False):
        by_known.setdefault(int(s.known_idx), []).append(s)

    trend, last_event = NONE, None
    ref_high = ref_low = None          # (price, idx, bar_time)
    prev_sh = prev_sl = None
    prot_low = prot_high = np.nan
    recent = deque(maxlen=p.range_n)
    n_swings = 0
    events, states = [], []

    for t in range(n):
        labels = []
        for s in by_known.get(t, []):
            n_swings += 1
            recent.append(s.price)
            if s.kind == "H":
                labels.append("HH" if prev_sh is None or s.price > prev_sh else ("EH" if s.price == prev_sh else "LH"))
                prev_sh = s.price
                ref_high = (s.price, int(s.idx), s.bar_time)
            else:
                labels.append("LL" if prev_sl is None or s.price < prev_sl else ("EL" if s.price == prev_sl else "HL"))
                prev_sl = s.price
                ref_low = (s.price, int(s.idx), s.bar_time)

        prev_atr = a[t - 1] if t >= 1 else np.nan
        if not np.isnan(prev_atr):
            tol = max(p.b_atr * prev_atr, p.b_ticks * p.tick)
            kind = None
            if ref_high is not None and cl[t] > ref_high[0] + tol:
                kind = "CHOCH_UP" if trend == BEAR else "BOS_UP"
                level, sw_idx, sw_time = ref_high
                prot = float(lo[sw_idx: t + 1].min())
                prior, trend, ref_high = trend, BULL, None
                prot_low, prot_high = prot, np.nan
            elif ref_low is not None and cl[t] < ref_low[0] - tol:
                kind = "CHOCH_DOWN" if trend == BULL else "BOS_DOWN"
                level, sw_idx, sw_time = ref_low
                prot = float(hi[sw_idx: t + 1].max())
                prior, trend, ref_low = trend, BEAR, None
                prot_high, prot_low = prot, np.nan
            if kind:
                last_event = kind
                events.append((bars.index[t], bars["close_time"].iat[t], kind, level, sw_time,
                               cl[t], tol, prot, prior))

        if np.isnan(a[t]) or n_swings < p.min_swings:
            regime = "INSUFFICIENT_DATA"
        elif len(recent) == p.range_n and max(recent) - min(recent) <= p.r_atr * a[t]:
            regime = "RANGE"
        elif trend == NONE or (last_event or "").startswith("CHOCH"):
            regime = "TRANSITIONAL"
        else:
            regime = "BULL_TREND" if trend == BULL else "BEAR_TREND"

        states.append((trend, regime,
                       ref_high[0] if ref_high else np.nan, ref_low[0] if ref_low else np.nan,
                       prot_low, prot_high, last_event, ",".join(labels) or None))

    ev = pd.DataFrame(events, columns=["time", "event_time", "kind", "level", "broken_swing_time",
                                       "close", "tol", "protected", "prior_trend"])
    st = pd.DataFrame(states, index=bars.index, columns=["trend", "regime", "ref_high", "ref_low",
                                                         "protected_low", "protected_high", "last_event",
                                                         "swing_label"])
    st["available_at"] = bars["close_time"]
    return ev, st
