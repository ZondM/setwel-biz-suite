"""Model B — trend continuation: candidate builder for the ladder in docs/08.

One candidate per M15 BOS/CHoCH. Each ladder condition records pass/fail and
a reason code; nothing is dropped.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd

from ..patterns.retest import RetestParams, order_block_zone, run_retest
from .model_a import state_at

TREND_DIR = {"BULL_TREND": 1, "BEAR_TREND": -1}
H1_DIR = {"BULL": 1, "BEAR": -1}


@dataclass(frozen=True)
class ModelBParams:
    retr_min: float = 0.30
    retr_max: float = 0.79
    disp_after: int = 2
    stop_buffer_atr: float = 0.1
    retest: RetestParams = RetestParams()


def regime_direction(state: pd.DataFrame, times: pd.Series) -> np.ndarray:
    """H4 trend direction (+1/-1/0) known at each time."""
    k = state["available_at"].searchsorted(times, side="right") - 1
    reg = np.where(k >= 0, state["regime"].to_numpy()[np.clip(k, 0, None)], None)
    return np.array([TREND_DIR.get(x, 0) for x in reg])


def build_candidates(m15: pd.DataFrame, atr15: pd.Series, events15: pd.DataFrame, disp15: pd.DataFrame,
                     h4_state: pd.DataFrame, h1_state: pd.DataFrame, h1_events: pd.DataFrame,
                     m5: pd.DataFrame, p: ModelBParams = ModelBParams()) -> pd.DataFrame:
    pos = {t: i for i, t in enumerate(m15.index)}
    hi, lo, cl = m15["high"].to_numpy(), m15["low"].to_numpy(), m15["close"].to_numpy()
    ct = m15["close_time"]
    a15 = atr15.to_numpy()
    ddir, dk = disp15["disp_dir"].to_numpy(), disp15["disp_bars"].to_numpy()
    h1_ev_dir = np.where(h1_events["kind"].str.endswith("UP"), 1, -1)
    h1_ev_t = h1_events["event_time"]
    h1_ev_open = h1_events["time"]

    rows = []
    for e in events15.itertuples(index=False):
        t = pos[e.time]
        sig = ct.iat[t]
        ev_d = 1 if e.kind.endswith("UP") else -1
        d = TREND_DIR.get(state_at(h4_state, sig, "regime"), 0)
        h1d = H1_DIR.get(state_at(h1_state, sig, "trend"), 0)
        row = dict(cand_id=f"B-{e.time:%Y%m%d%H%M}", m15_kind=e.kind, direction=ev_d, h4_dir=d, h1_dir=h1d,
                   sig_B1=sig, atr_B1=a15[t], stop_ref=e.protected)
        if d == 0:
            reason = "H4_NOT_TRENDING"
        elif ev_d != d:
            reason = "M15_AGAINST_H4"
        elif h1d != d:
            reason = "H1_NOT_ALIGNED"
        else:
            reason = None
        row["pass_B1"], row["reason_B1"] = reason is None, reason

        # B2: pullback = M15 CHoCH + 30-79% retracement of the H1 leg, leg intact
        row["pass_B2"], row["reason_B2"] = False, reason
        if reason is None:
            row["reason_B2"] = _pullback(row, e, t, d, sig, m15, hi, lo, h1_state, h1_ev_dir, h1_ev_t, h1_ev_open, p)
            row["pass_B2"] = row["reason_B2"] is None

        # B3: displacement including the break bar, ending at t..t+disp_after
        row["pass_B3"], row["reason_B3"], row["sig_B3"] = False, row["reason_B2"] or "NO_DISPLACEMENT", pd.NaT
        disp_t = None
        if row["pass_B2"]:
            row["reason_B3"] = "NO_DISPLACEMENT"
            for u in range(t, min(t + p.disp_after + 1, len(cl))):
                if u > t and (lo[u] <= e.protected if d > 0 else hi[u] >= e.protected):
                    row["reason_B3"] = "STOP_TRADED"
                    break
                if ddir[u] == d and u - dk[u] + 1 <= t:
                    disp_t = u
                    break
            if disp_t is not None:
                row.update(pass_B3=True, reason_B3=None, sig_B3=ct.iat[disp_t], atr_B3=a15[disp_t])

        # B4: mandatory retest
        row["pass_B4"], row["reason_B4"], row["sig_B4"] = False, row["reason_B3"], pd.NaT
        if disp_t is not None:
            s = disp_t - dk[disp_t] + 1
            z = order_block_zone(m15, s, d, p.retest.zone_lookback)
            if z is None:
                row["reason_B4"] = "NO_ZONE"
            else:
                z_lo, z_hi, near, far, _ = z
                stop_est = e.protected - d * p.stop_buffer_atr * a15[disp_t]
                ref_risk = d * (cl[disp_t] - stop_est)
                row.update(zone_lo=z_lo, zone_hi=z_hi, zone_near=near, zone_far=far)
                if ref_risk <= 0:
                    row["reason_B4"] = "STOP_BEYOND_DISPLACEMENT_CLOSE"
                else:
                    rt = run_retest(m5, d, near, far, stop_est, row["sig_B3"], cl[disp_t], ref_risk, p.retest)
                    row["retest_status"] = rt["status"]
                    if rt["status"] == "CONFIRMED":
                        row.update(pass_B4=True, reason_B4=None, sig_B4=rt["end_time"])
                    else:
                        row["reason_B4"] = rt["status"]
        rows.append(row)
    return pd.DataFrame(rows)


def _pullback(row, e, t, d, sig, m15, hi, lo, h1_state, h1_ev_dir, h1_ev_t, h1_ev_open, p):
    if not e.kind.startswith("CHOCH"):
        return "NOT_A_PULLBACK_CHOCH"
    k = h1_ev_t.searchsorted(sig, side="right") - 1
    while k >= 0 and h1_ev_dir[k] != d:
        k -= 1
    if k < 0:
        return "NO_H1_LEG"
    leg_start = m15.index.searchsorted(h1_ev_open.iat[k], side="left")
    if leg_start >= t:
        return "NO_H1_LEG"
    leg_end = state_at(h1_state, sig, "protected_low" if d > 0 else "protected_high")
    if leg_end is None or np.isnan(leg_end):
        return "NO_H1_LEG"
    if d > 0:
        j = leg_start + int(np.argmax(hi[leg_start:t]))
        ext, pb = hi[j], lo[j: t + 1].min()
        size, retr_amt, intact = ext - leg_end, ext - pb, pb > leg_end
    else:
        j = leg_start + int(np.argmin(lo[leg_start:t]))
        ext, pb = lo[j], hi[j: t + 1].max()
        size, retr_amt, intact = leg_end - ext, pb - ext, pb < leg_end
    row["retracement"] = retr_amt / size if size > 0 else np.nan
    if size <= 0 or not intact:
        return "H1_LEG_BROKEN"
    if not (p.retr_min <= row["retracement"] <= p.retr_max):
        return "RETRACEMENT_OUT_OF_RANGE"
    return None
