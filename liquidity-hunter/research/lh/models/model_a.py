"""Model A — liquidity reversal: candidate builder for the ladder in docs/06.

Every reclaimed sweep becomes one candidate row. Each ladder step records
whether the candidate passed and, if not, why (reason codes), plus the signal
time from which a trade would be entered. Nothing is dropped from the table.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd

from ..patterns.retest import RetestParams, order_block_zone, run_retest

PRIORITY = {"PWH": 0, "PWL": 0, "PDH": 1, "PDL": 1, "EQH": 2, "EQL": 2, "SWING-H4": 3, "SWING-H1": 4}
H4_ORIGIN = {"PDH", "PDL", "PWH", "PWL", "EQH", "EQL"}


@dataclass(frozen=True)
class ModelAParams:
    disp_window: int = 12
    stop_buffer_atr: float = 0.1
    range_lookback: int = 8
    retest: RetestParams = RetestParams()


def _priority(row) -> int:
    if row.type == "SWING":
        return PRIORITY[f"SWING-{row.tf}"]
    return PRIORITY.get(row.type, 5)


def state_at(state: pd.DataFrame, t: pd.Timestamp, col: str):
    """Value of `col` from the last state row whose available_at <= t (None if none)."""
    k = state["available_at"].searchsorted(t, side="right") - 1
    return state[col].iat[k] if k >= 0 else None


def build_candidates(m15: pd.DataFrame, atr15: pd.Series, events15: pd.DataFrame, disp15: pd.DataFrame,
                     range_active15: pd.Series, h4_state: pd.DataFrame, sweeps: pd.DataFrame,
                     m5: pd.DataFrame, p: ModelAParams = ModelAParams()) -> pd.DataFrame:
    rc = sweeps[sweeps.status == "RECLAIMED"].copy()
    rc["prio"] = [_priority(r) for r in rc.itertuples()]
    rc["direction"] = np.where(rc.side == "H", -1, 1)
    rc = rc.sort_values(["sweep_time", "direction", "prio"]).drop_duplicates(["sweep_time", "direction"], keep="first")
    rc = rc.sort_values("reclaim_time").reset_index(drop=True)

    pos = {t: i for i, t in enumerate(m15.index)}
    hi, lo, cl = m15["high"].to_numpy(), m15["low"].to_numpy(), m15["close"].to_numpy()
    ct = m15["close_time"]
    a15 = atr15.to_numpy()
    ev_dir = pd.Series(0, index=m15.index)
    if len(events15):
        ev_dir.loc[events15["time"].to_numpy()] = np.where(events15["kind"].str.endswith("UP"), 1, -1)
    ev_dir = ev_dir.to_numpy()
    ddir, dk = disp15["disp_dir"].to_numpy(), disp15["disp_bars"].to_numpy()
    ra = range_active15.to_numpy()

    rows = []
    for r in rc.itertuples(index=False):
        d = int(r.direction)
        i_s, i_r = pos[r.sweep_time], pos[r.reclaim_time]
        row = dict(cand_id=r.pool_id, pool_id=r.pool_id, pool_type=r.type, pool_tf=r.tf, level=r.level, direction=d,
                   sweep_time=r.sweep_time, sweep_extreme=r.sweep_extreme, sweep_depth_atr=r.sweep_depth_atr,
                   reclaim_time=r.reclaim_time, sig_A=ct.iat[i_r], atr_A=a15[i_r])
        # B: H4 alignment
        reg = state_at(h4_state, row["sig_A"], "regime")
        row["h4_regime"] = reg
        aligned = (reg == "BULL_TREND" and d > 0) or (reg == "BEAR_TREND" and d < 0)
        h4_origin = r.type in H4_ORIGIN or (r.type == "SWING" and r.tf == "H4")
        row["pass_B"] = bool(aligned or h4_origin)
        row["reason_B"] = None if row["pass_B"] else "COUNTER_H4_NON_H4_POOL"
        # C: displacement + structure break in trade direction within window
        row["pass_C"], row["reason_C"], row["sig_C"] = False, "NO_DISPLACEMENT", pd.NaT
        disp_i = None
        for t in range(i_r, min(i_r + p.disp_window + 1, len(cl))):
            beyond = (hi[t] >= r.sweep_extreme) if d < 0 else (lo[t] <= r.sweep_extreme)
            if t > i_r and beyond:
                row["reason_C"] = "SWEEP_EXTREME_RETAKEN"
                break
            if ddir[t] == d:
                s = t - dk[t] + 1
                if (ev_dir[s: t + 1] == d).any():
                    disp_i = t
                    break
        if disp_i is not None:
            row.update(pass_C=True, reason_C=None, sig_C=ct.iat[disp_i], atr_C=a15[disp_i],
                       disp_close=cl[disp_i], disp_start_time=m15.index[disp_i - dk[disp_i] + 1])
        # D: retest of the order-block zone on M5
        row["pass_D"], row["reason_D"], row["sig_D"] = False, row["reason_C"], pd.NaT
        if disp_i is not None:
            z = order_block_zone(m15, disp_i - dk[disp_i] + 1, d, p.retest.zone_lookback)
            if z is None:
                row["reason_D"] = "NO_ZONE"
            else:
                z_lo, z_hi, near, far, ztime = z
                stop_est = r.sweep_extreme - d * p.stop_buffer_atr * a15[disp_i]
                ref_risk = d * (cl[disp_i] - stop_est)
                row.update(zone_lo=z_lo, zone_hi=z_hi, zone_near=near, zone_far=far, zone_time=ztime)
                if ref_risk <= 0:
                    row["reason_D"] = "STOP_BEYOND_DISPLACEMENT_CLOSE"
                else:
                    rt = run_retest(m5, d, near, far, stop_est, row["sig_C"], cl[disp_i], ref_risk, p.retest)
                    row["retest_status"] = rt["status"]
                    row["touch_time"] = rt["touch_time"]
                    if rt["status"] == "CONFIRMED":
                        row.update(pass_D=True, reason_D=None, sig_D=rt["end_time"])
                    else:
                        row["reason_D"] = rt["status"]
        # E: consolidation shortly before the sweep
        had_range = bool(ra[max(0, i_s - p.range_lookback): i_s].any())
        row["range_before_sweep"] = had_range
        rows.append(row)
    return pd.DataFrame(rows)
