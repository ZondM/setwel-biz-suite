#!/usr/bin/env python3
"""Phases 1-3 on gold: TDI divergence (indicator v9.2 rules) vs random entries, after costs.

Usage: python3 gold_study.py <folder with XAUUSDmicro_M1.csv and _spec.csv> <report.md>

Pre-registered (written before any result was seen, see research/PHASE1_3_gold.md):
  primary hypothesis : v9.2 defaults, EA exits (SL = last-leg extreme -/+ 0.3 ATR, TP = 2R), M5/M15/M30
  grid (36)          : TF {M5,M15,M30} x pivot-left {3,5,8} x HTF filter {on,off} x RR {1.5,2.0}
  development        : 2026-04-24 .. 2026-08-20   holdout (untouched until the end): 2026-08-21 .. end
  pass               : >= 200 out-of-sample trades, mean R after costs > 0, p < 0.05 vs random entries,
                       holdout mean R > 0, neighbours of the chosen setting also > 0
"""
import math
import sys
import time

import numpy as np
import pandas as pd
from scipy import stats

import tdi_engine as E

RNG = np.random.default_rng(20261021)
SLIP = 0.05                    # adverse slippage on market entries and stop exits, price units
SWAP_LONG_PTS, SWAP_SHORT_PTS = -45, 20
HOLDOUT_START = pd.Timestamp("2026-08-21")
TF_MIN = {"M5": 5, "M15": 15, "M30": 30}
HTF_RULE = {"M5": "60min", "M15": "60min", "M30": "240min"}


# ------------------------------------------------------------------ data
def load(folder):
    m1 = pd.read_csv(f"{folder}/XAUUSDmicro_M1.csv")
    spec = dict(pd.read_csv(f"{folder}/XAUUSDmicro_spec.csv").values)
    m1["dt"] = pd.to_datetime(m1["time"], unit="s")
    return m1, spec


def resample(m1, rule):
    g = m1.set_index("dt").resample(rule, label="left", closed="left")
    df = pd.DataFrame({"open": g["open"].first(), "high": g["high"].max(), "low": g["low"].min(),
                       "close": g["close"].last(), "spread": g["spread"].first()}).dropna()
    df["time"] = (df.index.astype("int64") // 10**9).astype("int64")
    return df.reset_index()


# ------------------------------------------------------------------ trade simulation on the M1 path
class Path:
    def __init__(self, m1, point):
        self.t = m1["time"].to_numpy()
        self.o = m1["open"].to_numpy(); self.h = m1["high"].to_numpy(); self.l = m1["low"].to_numpy()
        self.spr = m1["spread"].to_numpy() * point
        self.dates = pd.to_datetime(self.t, unit="s")

    def idx(self, ts):
        return int(np.searchsorted(self.t, ts, side="left"))

    def first_hit(self, i0, d, sl, tp):
        """First M1 bar from i0 where the stop or target is touched. SL wins ties (conservative)."""
        n = len(self.t); j = i0; w = 512
        while j < n:
            k = min(n, j + w)
            if d > 0:
                hs = self.l[j:k] <= sl; ht = (self.h[j:k] >= tp) if tp else np.zeros(k - j, bool)
            else:
                hs = self.h[j:k] + self.spr[j:k] >= sl; ht = (self.l[j:k] + self.spr[j:k] <= tp) if tp else np.zeros(k - j, bool)
            any_ = hs | ht
            if any_.any():
                f = j + int(np.argmax(any_))
                return f, bool(hs[f - j])
            j = k; w *= 2
        return -1, False

    def stop_fill(self, f, d, sl):
        if d > 0:
            return min(self.o[f], sl) - SLIP
        return max(self.o[f] + self.spr[f], sl) + SLIP

    def swap(self, t_in, t_out, d, point):
        if t_out <= t_in: return 0.0
        days = pd.date_range(pd.to_datetime(t_in, unit="s").normalize() + pd.Timedelta(days=1),
                             pd.to_datetime(t_out, unit="s"), freq="D")
        nights = sum(3 if x.weekday() == 3 else (1 if x.weekday() in (1, 2, 4, 5) else 0) for x in days)
        return nights * (SWAP_LONG_PTS if d > 0 else SWAP_SHORT_PTS) * point


def entry_price(path, i0, d):
    return path.o[i0] + path.spr[i0] + SLIP if d > 0 else path.o[i0] - SLIP


def simulate(signals, tf, path, point, stops_level, rr=2.0, ea_exits=False, one_position=True,
             sl_buf=0.3, max_sl_atr=4.0, trail_atr=None):
    """EA rules: entry next TF bar open, SL beyond last leg, TP = rr x risk, one position at a time."""
    trades = []
    busy_until = -1
    for s in signals:
        b = s["bar"] + 1
        if b >= len(tf): continue
        t_entry = int(tf["time"].iloc[b])
        if one_position and t_entry < busy_until: continue
        d = s["dir"]
        i0 = path.idx(t_entry)
        if i0 >= len(path.t): continue
        px = entry_price(path, i0, d)
        sl = s["sl_ref"] - d * sl_buf * s["atr"]
        dist = (px - sl) * d
        if dist <= 0 or dist > max_sl_atr * s["atr"] or dist <= stops_level: continue
        tp = px + d * rr * dist
        if not ea_exits:
            f, is_sl = path.first_hit(i0, d, sl, tp)
            if f < 0: continue                                   # still open at the end of the data
            out = path.stop_fill(f, d, sl) if is_sl else tp
        else:
            f, out = ea_walk(path, i0, d, px, sl, tp, dist, s["atr"], trail_atr)
            if f < 0: continue
        t_exit = int(path.t[f])
        pnl = (out - px) * d + path.swap(t_entry, t_exit, d, point)
        trades.append(dict(t_entry=t_entry, t_exit=t_exit, dir=d, kind=s["kind"], legs=s["legs"], r=pnl / dist,
                           dist_atr=dist / s["atr"], bars=f - i0))
        busy_until = t_exit
    return pd.DataFrame(trades)


def ea_walk(path, i0, d, px, sl, tp, R, atr, trail_atr):
    """Break-even at 0.5R (lock 0.1R), trailing from 1R at 1.5 ATR. Exits are checked before the stop moves."""
    trail = 1.5 * atr if trail_atr is None else trail_atr * atr
    n = len(path.t)
    for f in range(i0, n):
        bid_l, bid_h = path.l[f], path.h[f]
        if d > 0:
            if bid_l <= sl: return f, path.stop_fill(f, d, sl)
            if bid_h >= tp: return f, tp
            best = bid_h - px
            if best >= 0.5 * R: sl = max(sl, px + 0.1 * R)
            if best >= 1.0 * R: sl = max(sl, bid_h - trail)
        else:
            ask_l, ask_h = bid_l + path.spr[f], bid_h + path.spr[f]
            if ask_h >= sl: return f, path.stop_fill(f, d, sl)
            if ask_l <= tp: return f, tp
            best = px - ask_l
            if best >= 0.5 * R: sl = min(sl, px - 0.1 * R)
            if best >= 1.0 * R: sl = min(sl, ask_l + trail)
    return -1, 0.0


def random_baseline(trades, tf, atr, path, point, rr, n_perm=1000, start_bar=200, period=None):
    """Same number of trades, same buy/sell mix, same stop sizes in ATR, random entry bars."""
    if len(trades) == 0: return np.array([])
    bars = np.arange(start_bar, len(tf) - 2)
    if period is not None:
        tt = tf["time"].to_numpy()[bars]
        bars = bars[(tt >= period[0]) & (tt < period[1])]
    p_buy = (trades["dir"] > 0).mean()
    ratios = trades["dist_atr"].to_numpy()
    means = np.empty(n_perm)
    tf_time = tf["time"].to_numpy()
    for k in range(n_perm):
        rs = []
        for _ in range(len(trades)):
            b = int(RNG.choice(bars)) + 1
            d = 1 if RNG.random() < p_buy else -1
            i0 = path.idx(int(tf_time[b]))
            if i0 >= len(path.t): continue
            px = entry_price(path, i0, d)
            dist = float(RNG.choice(ratios)) * atr[b - 1]
            sl = px - d * dist; tp = px + d * rr * dist
            f, is_sl = path.first_hit(i0, d, sl, tp)
            if f < 0: continue
            out = path.stop_fill(f, d, sl) if is_sl else tp
            rs.append(((out - px) * d) / dist)
        means[k] = np.mean(rs) if rs else np.nan
    return means


def summary(tr):
    if len(tr) == 0:
        return dict(n=0)
    r = tr["r"].to_numpy()
    wins = r[r > 0]; losses = r[r <= 0]
    eq = np.cumsum(r); dd = (np.maximum.accumulate(eq) - eq).max()
    streak = mx = 0
    for x in r:
        streak = streak + 1 if x <= 0 else 0; mx = max(mx, streak)
    se = r.std(ddof=1) / math.sqrt(len(r)) if len(r) > 1 else float("nan")
    return dict(n=len(r), win=100 * len(wins) / len(r), avg_win=wins.mean() if len(wins) else 0,
                avg_loss=losses.mean() if len(losses) else 0, mean_r=r.mean(), ci_lo=r.mean() - 1.96 * se,
                ci_hi=r.mean() + 1.96 * se, pf=wins.sum() / -losses.sum() if losses.sum() < 0 else float("inf"),
                max_dd_r=dd, max_losing_streak=mx, total_r=r.sum())


def deflated_sharpe(r, sr_trials):
    """Bailey & Lopez de Prado: probability the best Sharpe is real after N trials (per-trade Sharpe)."""
    r = np.asarray(r); T = len(r); N = len(sr_trials)
    if T < 10 or N < 2: return float("nan")
    sr = r.mean() / r.std(ddof=1)
    g3 = stats.skew(r); g4 = stats.kurtosis(r, fisher=False)
    v = np.var(sr_trials, ddof=1); em = 0.5772156649
    sr0 = math.sqrt(v) * ((1 - em) * stats.norm.ppf(1 - 1 / N) + em * stats.norm.ppf(1 - 1 / (N * math.e)))
    z = (sr - sr0) * math.sqrt(T - 1) / math.sqrt(max(1e-12, 1 - g3 * sr + (g4 - 1) / 4 * sr ** 2))
    return stats.norm.cdf(z)


# ------------------------------------------------------------------ look-ahead test
def lookahead_test(tf, htf_tr, P, cuts=6):
    o, h, l, c, t = (tf[k].to_numpy() for k in ("open", "high", "low", "close", "time"))
    full, _ = E.run(o, h, l, c, t, htf_tr, P)
    key = lambda s: (s["bar"], s["dir"], s["kind"], round(s["sl_ref"], 4))
    bad = 0
    for cut in RNG.integers(len(tf) // 3, len(tf) - 10, cuts):
        part, _ = E.run(o[:cut], h[:cut], l[:cut], c[:cut], t[:cut], htf_tr[:cut], P)
        a = {key(s) for s in full if s["bar"] <= cut - 2}
        b = {key(s) for s in part}
        bad += len(a ^ b)
    return bad, len(full)


# ------------------------------------------------------------------ main
def main(folder, out):
    t0 = time.time()
    m1, spec = load(folder)
    point = float(spec["point"]); stops = float(spec["stops_level"]) * point
    path = Path(m1, point)
    end = m1["dt"].iloc[-1]
    rep = ["# Phases 1-3 on gold (XAUUSDmicro): does the TDI divergence method beat random entries after costs?", "",
           f"Data: {len(m1):,} M1 bid candles, {m1['dt'].iloc[0]} to {end}. Costs: real per-minute spread from the data, "
           f"{SLIP} slippage on entries and stop exits, swap {SWAP_LONG_PTS}/{SWAP_SHORT_PTS} points per night (triple Wednesday). "
           "Stops are checked before targets inside each M1 candle (conservative).", ""]
    tfs, htfs, sigs_cache = {}, {}, {}
    for tfn in TF_MIN:
        tfs[tfn] = resample(m1, f"{TF_MIN[tfn]}min")
        htfs[tfn] = resample(m1, HTF_RULE[tfn])

    def signals(tfn, **over):
        key = (tfn, tuple(sorted(over.items())))
        if key not in sigs_cache:
            tf = tfs[tfn]; P = dict(E.DEFAULTS, **over)
            tr, _ = E.htf_trend_for(tf["time"].to_numpy(), htfs[tfn], P, TF_MIN[tfn] * 60)
            s, L = E.run(*(tf[k].to_numpy() for k in ("open", "high", "low", "close", "time")), tr, P)
            sigs_cache[key] = (s, L)
        return sigs_cache[key]

    # --- Phase 2: look-ahead test
    tf = tfs["M15"]
    tr, _ = E.htf_trend_for(tf["time"].to_numpy(), htfs["M15"], E.DEFAULTS, 900)
    bad, nfull = lookahead_test(tf, tr, E.DEFAULTS)
    rep += ["## Phase 2 — look-ahead test", "",
            f"M15, defaults: {nfull} signals on the full data. Re-run on 6 random truncations of the data: "
            f"**{bad} signals differed** (0 = no signal ever uses future data).", ""]

    # --- Phase 3a: primary hypothesis, v9.2 defaults (never fitted to gold -> whole period is out-of-sample)
    rep += ["## Phase 3a — primary test: indicator v9.2 defaults (EXH excluded, as in the EA)", "",
            "These settings were fixed before any gold data was seen, so the whole 180 days is out-of-sample for them.", "",
            "| TF | exits | trades | win % | avg win R | avg loss R | mean R (95% CI) | profit factor | max DD R | longest losing streak | random-entry mean R | p vs random |",
            "|---|---|---|---|---|---|---|---|---|---|---|---|"]
    primary = {}
    for tfn in TF_MIN:
        s, L = signals(tfn)
        s = [x for x in s if x["kind"] != E.EXH]
        for mode in ("SL/TP 2R", "EA: BE + trailing"):
            trd = simulate(s, tfs[tfn], path, point, stops, rr=2.0, ea_exits=(mode != "SL/TP 2R"))
            sm = summary(trd)
            if sm["n"] == 0:
                rep.append(f"| {tfn} | {mode} | 0 | | | | | | | | | |"); continue
            if mode == "SL/TP 2R":
                base = random_baseline(trd, tfs[tfn], L["atr"], path, point, 2.0, n_perm=400)
                p = (np.sum(base >= sm["mean_r"]) + 1) / (np.sum(np.isfinite(base)) + 1)
                bm = f"{np.nanmean(base):+.3f}"; ps = f"{p:.3f}"
                primary[tfn] = (sm, p, trd)
            else:
                bm = ps = "—"
            rep.append(f"| {tfn} | {mode} | {sm['n']} | {sm['win']:.1f} | {sm['avg_win']:+.2f} | {sm['avg_loss']:+.2f} | "
                       f"{sm['mean_r']:+.3f} ({sm['ci_lo']:+.3f} .. {sm['ci_hi']:+.3f}) | {sm['pf']:.2f} | {sm['max_dd_r']:.1f} | "
                       f"{sm['max_losing_streak']} | {bm} | {ps} |")
    rep.append("")
    # by kind / inverted
    rep += ["Per signal kind and inverted signals (SL/TP 2R):", "", "| TF | kind | trades | mean R | inverted mean R |", "|---|---|---|---|---|"]
    for tfn in TF_MIN:
        s, L = signals(tfn)
        for k in (E.DIV, E.CONT, E.EXH):
            sk = [x for x in s if x["kind"] == k]
            trd = simulate(sk, tfs[tfn], path, point, stops, rr=2.0)
            inv = [dict(x, dir=-x["dir"], sl_ref=x["sl_ref"]) for x in sk]
            # inverted: same entry, opposite direction, stop the same distance away on the other side
            inv_tr = simulate_inverted(sk, tfs[tfn], path, point, stops)
            rep.append(f"| {tfn} | {E.KIND_NAME[k]} | {len(trd)} | {trd['r'].mean() if len(trd) else float('nan'):+.3f} | "
                       f"{inv_tr['r'].mean() if len(inv_tr) else float('nan'):+.3f} |")
    rep.append("")

    # --- Phase 3b: pre-registered grid on development period, walk-forward, then holdout
    dev_end = HOLDOUT_START.value // 10**9
    t_start = int(m1["time"].iloc[0])
    grid = [(tfn, pl, hf, rr) for tfn in TF_MIN for pl in (3, 5, 8) for hf in (True, False) for rr in (1.5, 2.0)]
    res = {}
    for g in grid:
        tfn, pl, hf, rr = g
        s, L = signals(tfn, piv_left=pl, use_htf=hf)
        s = [x for x in s if x["kind"] != E.EXH]
        res[g] = simulate(s, tfs[tfn], path, point, stops, rr=rr)
    def period(trd, a, b):
        return trd[(trd["t_entry"] >= a) & (trd["t_entry"] < b)] if len(trd) else trd
    dev_mean = {g: (period(t, t_start, dev_end)["r"].mean() if len(period(t, t_start, dev_end)) >= 40 else -9) for g, t in res.items()}
    best = max(dev_mean, key=dev_mean.get)
    # walk-forward: choose on 2 months, test on the next month
    m = lambda s: int(pd.Timestamp(s).value // 10**9)
    folds = [("2026-04-24", "2026-06-23", "2026-07-23"), ("2026-05-23", "2026-07-23", "2026-08-21")]
    wf_rows, wf_r = [], []
    for a, b, cc in folds:
        sel = max(grid, key=lambda g: (period(res[g], m(a), m(b))["r"].mean() if len(period(res[g], m(a), m(b))) >= 20 else -9))
        te = period(res[sel], m(b), m(cc))
        wf_r += list(te["r"]) if len(te) else []
        wf_rows.append(f"| {a} → {b} | {b} → {cc} | {sel[0]} pivot {sel[1]} HTF {'on' if sel[2] else 'off'} RR {sel[3]} | "
                       f"{len(te)} | {te['r'].mean() if len(te) else float('nan'):+.3f} |")
    hold = period(res[best], dev_end, 10**12)
    srs = [period(t, t_start, dev_end)["r"].mean() / period(t, t_start, dev_end)["r"].std(ddof=1)
           for t in res.values() if len(period(t, t_start, dev_end)) > 10]
    dsr = deflated_sharpe(period(res[best], t_start, dev_end)["r"], srs)
    neigh = [g for g in grid if g[0] == best[0] and g[3] == best[3] and g[2] == best[2] and g[1] != best[1]]
    rep += ["## Phase 3b — pre-registered grid (36 settings), walk-forward and untouched holdout", "",
            f"Best on the development period (to {HOLDOUT_START.date()}): **{best[0]}, pivot-left {best[1]}, HTF filter "
            f"{'on' if best[2] else 'off'}, RR {best[3]}**, development mean R {dev_mean[best]:+.3f}. "
            f"Deflated Sharpe probability (36 trials): {dsr:.2f} (needs > 0.95).", "",
            "Neighbouring settings (pivot-left changed) on the development period: " +
            ", ".join(f"pivot {g[1]} = {dev_mean[g]:+.3f}" for g in neigh) + ".", "",
            "Walk-forward (choose on 2 months, test on the next month):", "",
            "| choose on | test on | chosen | test trades | test mean R |", "|---|---|---|---|---|"] + wf_rows + [
            "", f"Walk-forward out-of-sample total: {len(wf_r)} trades, mean R {np.mean(wf_r) if wf_r else float('nan'):+.3f}.", ""]
    hs = summary(hold)
    if hs["n"]:
        tfn = best[0]; s, L = signals(tfn, piv_left=best[1], use_htf=best[2])
        hb = random_baseline(hold, tfs[tfn], L["atr"], path, point, best[3], n_perm=400,
                             period=(dev_end, 10**12))
        hp = (np.sum(hb >= hs["mean_r"]) + 1) / (np.sum(np.isfinite(hb)) + 1)
        rep += [f"**Holdout ({HOLDOUT_START.date()} to {end.date()}), opened once at the end:** {hs['n']} trades, win {hs['win']:.1f}%, "
                f"mean R {hs['mean_r']:+.3f} (95% CI {hs['ci_lo']:+.3f} .. {hs['ci_hi']:+.3f}), random-entry mean R {np.nanmean(hb):+.3f}, "
                f"p vs random {hp:.3f}.", ""]
    else:
        hp = 1.0
        rep += ["**Holdout:** no trades.", ""]

    # --- verdict
    oos_n = max((v[0]["n"] for v in primary.values()), default=0)
    passed = [tfn for tfn, (sm, p, _) in primary.items() if sm["n"] >= 200 and sm["mean_r"] > 0 and p < 0.05]
    grid_pass = hs.get("n", 0) > 0 and hs["mean_r"] > 0 and hp < 0.05 and dsr > 0.95 and all(dev_mean[g] > 0 for g in neigh)
    verdict = ("PASS on " + ", ".join(passed)) if passed else "FAIL"
    rep = rep[:4] + ["## Verdict", "",
                     f"- Primary test (defaults, whole period out-of-sample): **{verdict}** "
                     "(needs ≥ 200 trades, mean R > 0 after costs, p < 0.05 vs random entries).",
                     f"- Grid + walk-forward + holdout: **{'PASS' if grid_pass else 'FAIL'}** "
                     "(needs holdout mean R > 0 with p < 0.05, deflated Sharpe > 0.95, neighbours > 0).", ""] + rep[4:]
    rep += [f"_Run time {time.time() - t0:.0f} s._"]
    open(out, "w").write("\n".join(rep))
    print("\n".join(rep[:12]))


def simulate_inverted(sk, tf, path, point, stops):
    """Opposite direction at the same entry, stop at the same distance on the other side, TP 2R."""
    trades = []; busy = -1
    for s in sk:
        b = s["bar"] + 1
        if b >= len(tf): continue
        t_entry = int(tf["time"].iloc[b])
        if t_entry < busy: continue
        d0 = s["dir"]; i0 = path.idx(t_entry)
        if i0 >= len(path.t): continue
        px0 = entry_price(path, i0, d0)
        dist = (px0 - (s["sl_ref"] - d0 * 0.3 * s["atr"])) * d0
        if dist <= 0 or dist > 4 * s["atr"] or dist <= stops: continue
        d = -d0; px = entry_price(path, i0, d)
        sl = px - d * dist; tp = px + d * 2 * dist
        f, is_sl = path.first_hit(i0, d, sl, tp)
        if f < 0: continue
        out = path.stop_fill(f, d, sl) if is_sl else tp
        trades.append(dict(r=((out - px) * d + path.swap(t_entry, int(path.t[f]), d, point)) / dist))
        busy = int(path.t[f])
    return pd.DataFrame(trades)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
