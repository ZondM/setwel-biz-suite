#!/usr/bin/env python3
"""Pre-registered test in PREREG_gold_fade.md.
Usage: python3 fade_study.py <dev folder (Apr-Oct 2026)> <test folder (Oct 2025-Apr 2026)> <report.md>"""
import sys
import numpy as np
import pandas as pd
import gold_study as G

RNG = np.random.default_rng(20261022)
GRID = [(tf, k, H) for tf in ("M5", "M15") for k in (1.5, 2.0, 2.5) for H in (3, 6)]


def setup(folder):
    m1, spec = G.load(folder)
    point = float(spec["point"])
    return m1, G.Path(m1, point), point


def bars(m1, tfn):
    tf = G.resample(m1, f"{G.TF_MIN[tfn]}min")
    import tdi_engine as E
    tf["atr"] = E.atr_sma(tf.high.to_numpy(), tf.low.to_numpy(), tf.close.to_numpy(), 14)
    return tf


def trade(path, point, t_in, t_out, d, stop_mult_atr):
    i0 = path.idx(t_in); i1 = path.idx(t_out)
    n = len(path.t)
    if i0 >= n or i1 >= n or i1 <= i0: return None
    px = G.entry_price(path, i0, d)
    dist = stop_mult_atr
    sl = px - d * dist
    seg = slice(i0, i1)
    hit = (path.l[seg] <= sl) if d > 0 else (path.h[seg] + path.spr[seg] >= sl)
    if hit.any():
        f = i0 + int(np.argmax(hit)); out = path.stop_fill(f, d, sl); t_exit = int(path.t[f])
    else:
        out = (path.o[i1] - G.SLIP) if d > 0 else (path.o[i1] + path.spr[i1] + G.SLIP); t_exit = int(path.t[i1])
    return ((out - px) * d + path.swap(int(path.t[i0]), t_exit, d, point)) / dist, t_exit


def run(tf, path, point, k, H):
    c = tf.close.to_numpy(); atr = tf.atr.to_numpy(); t = tf.time.to_numpy()
    rows = []; busy = -1
    for i in range(20, len(tf) - H - 1):
        z = (c[i] - c[i - 1]) / atr[i - 1] if atr[i - 1] > 0 else 0
        if abs(z) < k or t[i + 1] < busy: continue
        d = -1 if z > 0 else 1
        r = trade(path, point, int(t[i + 1]), int(t[i + 1 + H]), d, 2.0 * atr[i])
        if r is None: continue
        rows.append(dict(bar=i, dir=d, r=r[0])); busy = r[1]
    return pd.DataFrame(rows)


def baseline(tf, path, point, trades, H, n_perm=400):
    t = tf.time.to_numpy(); atr = tf.atr.to_numpy()
    p_buy = (trades.dir > 0).mean(); out = []
    cand = np.arange(20, len(tf) - H - 1)
    for _ in range(n_perm):
        rs = []
        for i in RNG.choice(cand, len(trades)):
            d = 1 if RNG.random() < p_buy else -1
            r = trade(path, point, int(t[i + 1]), int(t[i + 1 + H]), d, 2.0 * atr[i])
            if r is not None: rs.append(r[0])
        out.append(np.mean(rs))
    return np.array(out)


def main(dev, test, rep_path):
    m1d, pd_, ptd = setup(dev)
    res = {}
    for g in GRID:
        tf = bars(m1d, g[0]); tr = run(tf, pd_, ptd, g[1], g[2])
        res[g] = tr
    rows = ["| TF | k | H | trades | win % | mean R |", "|---|---|---|---|---|---|"]
    for g, tr in res.items():
        rows.append(f"| {g[0]} | {g[1]} | {g[2]} | {len(tr)} | {100 * (tr.r > 0).mean():.1f} | {tr.r.mean():+.4f} |")
    elig = {g: tr.r.mean() for g, tr in res.items() if len(tr) >= 200}
    best = max(elig, key=elig.get)
    srs = [tr.r.mean() / tr.r.std(ddof=1) for tr in res.values() if len(tr) > 10]
    dsr = G.deflated_sharpe(res[best].r.to_numpy(), srs)
    m1t, pt_, ptt = setup(test)
    tft = bars(m1t, best[0]); tt = run(tft, pt_, ptt, best[1], best[2])
    b = baseline(tft, pt_, ptt, tt, best[2])
    p = (np.sum(b >= tt.r.mean()) + 1) / (len(b) + 1)
    passed = len(tt) >= 200 and tt.r.mean() > 0 and p < 0.05 and dsr > 0.95
    sm = G.summary(tt)
    rep = ["# Pre-registered test — fade the big candle on gold", "",
           f"## Verdict: **{'PASS' if passed else 'FAIL'}**", "",
           f"Chosen on development data (2026-04-24 – 2026-10-21): **{best[0]}, k {best[1]}, H {best[2]} bars**, "
           f"mean R {elig[best]:+.4f}, deflated Sharpe probability {dsr:.2f} (needs > 0.95).", "",
           f"Test (2025-10-01 – 2026-04-24, run once): {sm['n']} trades, win {sm['win']:.1f}%, mean R {sm['mean_r']:+.4f} "
           f"(95% CI {sm['ci_lo']:+.4f} .. {sm['ci_hi']:+.4f}), random-entry mean R {b.mean():+.4f}, one-sided p {p:.3f}.", "",
           "## Development grid (all 12 settings)", ""] + rows
    open(rep_path, "w").write("\n".join(rep))
    print("\n".join(rep))


if __name__ == "__main__":
    main(*sys.argv[1:4])
