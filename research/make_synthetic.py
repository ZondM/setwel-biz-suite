#!/usr/bin/env python3
"""Fake data in the TDI_ExportData format, to prove phase0.py tells random from non-random.
Usage: python3 make_synthetic.py <out folder>"""
import os, sys
import numpy as np
import pandas as pd

rng = np.random.default_rng(7)
out = sys.argv[1]
os.makedirs(out, exist_ok=True)
T0 = 1_760_000_000

def write(name, m1_close, ticks_mid, point=0.001, spread_pts=10):
    t = T0 + 60 * np.arange(len(m1_close))
    o = np.r_[m1_close[0], m1_close[:-1]]
    pd.DataFrame({"time": t, "open": o, "high": np.maximum(o, m1_close), "low": np.minimum(o, m1_close),
                  "close": m1_close, "tick_volume": 30, "spread": spread_pts}).to_csv(f"{out}/{name}_M1.csv", index=False)
    half = spread_pts * point / 2
    pd.DataFrame({"time_msc": T0 * 1000 + 2000 * np.arange(len(ticks_mid)),
                  "bid": ticks_mid - half, "ask": ticks_mid + half}).to_csv(f"{out}/{name}_ticks.csv", index=False)
    pd.DataFrame({"key": ["symbol", "description", "point", "spread_points"],
                  "value": [name, "synthetic test data", point, spread_pts]}).to_csv(f"{out}/{name}_spec.csv", index=False)

NB, NT = 60 * 1440, 300_000
# 1) pure random walk (what Deriv says the Volatility indices are)
write("Fake_Random_Walk", 1000 * np.exp(np.cumsum(rng.normal(0, 4e-4, NB))),
      1000 * np.exp(np.cumsum(rng.normal(0, 6e-5, NT))))
# 2) momentum: AR(1) = 0.15 in M1 returns (a real, tradable structure)
e = rng.normal(0, 4e-4, NB); r = np.zeros(NB)
for i in range(1, NB): r[i] = 0.15 * r[i - 1] + e[i]
write("Fake_Momentum", 1000 * np.exp(np.cumsum(r)), 1000 * np.exp(np.cumsum(rng.normal(0, 6e-5, NT))))
# 3) Boom-like: drift down, memoryless spikes up (prob 1/1000 per tick)
def boom(n, p, regular=False):
    d = rng.normal(-2e-3, 0.05, n)
    if regular:   # spikes "due": every 900-1100 ticks
        idx = np.cumsum(rng.integers(900, 1100, n // 900))
        idx = idx[idx < n]
    else:
        idx = np.where(rng.random(n) < p)[0]
    d[idx] += 15.0
    return 10000 + np.cumsum(d)
tb = boom(NT, 1 / 1000)
write("Fake_Boom_1000_Index", 10000 + np.cumsum(rng.normal(0, 0.5, NB)), tb)
# 4) Crash-like with spikes that ARE predictable in time (not memoryless) -> must be flagged
tc = 20000 - (boom(NT, 0, regular=True) - 10000)
write("Fake_Crash_1000_Index_due", 20000 + np.cumsum(rng.normal(0, 0.5, NB)), tc)
print("written to", out)
