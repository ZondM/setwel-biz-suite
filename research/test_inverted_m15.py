#!/usr/bin/env python3
"""Runs the pre-registered test in PREREG_inverted_M15.md on NEW gold data.
Usage: python3 test_inverted_m15.py <folder with XAUUSDmicro_M1.csv and XAUUSDmicro_spec.csv>
"""
import sys
import numpy as np
import pandas as pd
import gold_study as G
import tdi_engine as E

DISC_A = int(pd.Timestamp("2026-04-24 12:23").value // 10**9)
DISC_B = int(pd.Timestamp("2026-10-21 12:22").value // 10**9)


def main(folder):
    m1, spec = G.load(folder)
    point = float(spec["point"]); stops = float(spec["stops_level"]) * point
    path = G.Path(m1, point)
    tf = G.resample(m1, "15min"); htf = G.resample(m1, "60min")
    tr, _ = E.htf_trend_for(tf["time"].to_numpy(), htf, E.DEFAULTS, 900)
    sig, L = E.run(*(tf[k].to_numpy() for k in ("open", "high", "low", "close", "time")), tr)
    div = [s for s in sig if s["kind"] == E.DIV]
    inv = simulate(div, tf, path, point, stops)
    outside = inv[(inv["t_entry"] < DISC_A) | (inv["t_entry"] > DISC_B)] if len(inv) else inv
    print(f"data {m1['dt'].iloc[0]} .. {m1['dt'].iloc[-1]}; inverted trades total {len(inv)}, outside discovery window {len(outside)}")
    if len(outside) < 30:
        print("RESULT: not enough data yet (need >= 30 trades outside the discovery window) - no judgement")
        return
    mean = outside["r"].mean()
    tt = outside.assign(dist_atr=outside["dist_atr"])
    base = G.random_baseline(tt, tf, L["atr"], path, point, 2.0, n_perm=1000)
    base = base[np.isfinite(base)]
    p = (np.sum(base >= mean) + 1) / (len(base) + 1)
    ok = mean > 0 and p < 0.05
    print(f"trades {len(outside)}, win {100 * (outside['r'] > 0).mean():.1f}%, mean R {mean:+.3f}, "
          f"random-entry mean R {base.mean():+.3f}, one-sided p {p:.3f}")
    print("RESULT:", "PASS" if ok else "FAIL")


def simulate(sk, tf, path, point, stops):
    rows = []; busy = -1
    for s in sk:
        b = s["bar"] + 1
        if b >= len(tf): continue
        t_entry = int(tf["time"].iloc[b])
        if t_entry < busy: continue
        d0 = s["dir"]; i0 = path.idx(t_entry)
        if i0 >= len(path.t): continue
        dist = (G.entry_price(path, i0, d0) - (s["sl_ref"] - d0 * 0.3 * s["atr"])) * d0
        if dist <= 0 or dist > 4 * s["atr"] or dist <= stops: continue
        d = -d0; px = G.entry_price(path, i0, d)
        sl = px - d * dist; tp = px + d * 2 * dist
        f, is_sl = path.first_hit(i0, d, sl, tp)
        if f < 0: continue
        out = path.stop_fill(f, d, sl) if is_sl else tp
        t_exit = int(path.t[f])
        rows.append(dict(t_entry=t_entry, dir=d, r=((out - px) * d + path.swap(t_entry, t_exit, d, point)) / dist,
                         dist_atr=dist / s["atr"]))
        busy = t_exit
    return pd.DataFrame(rows)


if __name__ == "__main__":
    main(sys.argv[1])
