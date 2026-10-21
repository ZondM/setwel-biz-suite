#!/usr/bin/env python3
"""Phase 0: is there anything to predict?

Reads the files written by mt5/Scripts/TDI_ExportData.mq5
(<symbol>_M1.csv, <symbol>_ticks.csv, <symbol>_spec.csv) from a folder and
writes phase0_report.md next to them.

For every symbol and for M1 / M5 / M15 log returns:
  - lag-1 autocorrelation and Ljung-Box test (10 lags)
  - Lo-MacKinlay variance ratio (heteroskedasticity-robust z) for q = 2, 5, 10
  - Wald-Wolfowitz runs test on return signs
  - Hurst exponent (aggregated-variance method)
  - economic size: the largest edge per bar the measured autocorrelation could
    give, compared with the spread
For Boom / Crash ticks:
  - spike detection, average ticks between spikes vs the advertised rate
  - memorylessness: KS test of the gaps against a geometric distribution and
    the spike hazard after short vs long waits

Usage:  python3 phase0.py <folder>
"""
import glob
import math
import os
import sys

import numpy as np
import pandas as pd
from scipy import stats
from statsmodels.stats.diagnostic import acorr_ljungbox

ALPHA = 0.01          # per-test significance; many tests are run, so keep it strict


def read_spec(path):
    if not os.path.exists(path):
        return {}
    df = pd.read_csv(path)
    return dict(zip(df["key"], df["value"]))


def spike_side(name):
    n = name.lower()
    if "boom" in n:
        return 1
    if "crash" in n:
        return -1
    return 0


def advertised_rate(name):
    for tok in name.replace("_", " ").split():
        if tok.isdigit():
            return int(tok)
    return None


# ---------------------------------------------------------------- tests
def variance_ratio(r, q):
    """Lo-MacKinlay variance ratio with the heteroskedasticity-robust z (z*)."""
    r = np.asarray(r, float)
    n = len(r)
    mu = r.mean()
    d = r - mu
    var1 = (d ** 2).sum() / (n - 1)
    rq = np.convolve(r, np.ones(q), "valid")
    m = q * (n - q + 1) * (1 - q / n)
    varq = ((rq - q * mu) ** 2).sum() / m
    vr = varq / var1
    d2 = d ** 2
    denom = d2.sum() ** 2
    theta = 0.0
    for j in range(1, q):
        delta = n * (d2[j:] * d2[:-j]).sum() / denom
        theta += (2 * (q - j) / q) ** 2 * delta
    z = math.sqrt(n) * (vr - 1) / math.sqrt(theta) if theta > 0 else 0.0   # sqrt(n)(VR-1) ~ N(0, theta)
    return vr, z, 2 * (1 - stats.norm.cdf(abs(z)))


def runs_test(r):
    s = np.sign(r[r != 0])
    n1, n2 = float((s > 0).sum()), float((s < 0).sum())
    n = n1 + n2
    if n1 == 0 or n2 == 0:
        return 0.0, 1.0
    runs = 1 + (s[1:] != s[:-1]).sum()
    mu = 2 * n1 * n2 / n + 1
    var = 2 * n1 * n2 * (2 * n1 * n2 - n) / (n ** 2 * (n - 1))
    z = (runs - mu) / math.sqrt(var)
    return z, 2 * (1 - stats.norm.cdf(abs(z)))


def hurst(r):
    """Aggregated-variance Hurst exponent: Var(sum of m returns) ~ m^(2H)."""
    r = np.asarray(r, float)
    ms = [m for m in (1, 2, 4, 8, 16, 32, 64) if len(r) // m >= 50]
    if len(ms) < 3:
        return float("nan")
    v = [np.var(r[: len(r) // m * m].reshape(-1, m).sum(1)) for m in ms]
    slope = np.polyfit(np.log(ms), np.log(v), 1)[0]
    return slope / 2


def series_tests(r, spread_price, mean_abs_move):
    r = np.asarray(r, float)
    r = r[np.isfinite(r)]
    n = len(r)
    ac1 = pd.Series(r).autocorr(1)
    lb = acorr_ljungbox(r, lags=[10], return_df=True)["lb_pvalue"].iloc[0]
    vrs = {q: variance_ratio(r, q) for q in (2, 5, 10)}
    rz, rp = runs_test(r)
    h = hurst(r)
    # best-case edge per bar from lag-1 autocorrelation, in price units, vs the spread
    edge = abs(ac1) * mean_abs_move if np.isfinite(ac1) else 0.0
    pvals = [lb, rp] + [v[2] for v in vrs.values()]
    flagged = [p < ALPHA for p in pvals]
    return {
        "n": n, "ac1": ac1, "band": 1.96 / math.sqrt(n), "lb_p": lb,
        "vr2": vrs[2][0], "vr2_p": vrs[2][2], "vr5": vrs[5][0], "vr5_p": vrs[5][2],
        "vr10": vrs[10][0], "vr10_p": vrs[10][2], "runs_z": rz, "runs_p": rp, "hurst": h,
        "edge": edge, "spread": spread_price, "any_flag": any(flagged),
        "edge_beats_spread": any(flagged) and spread_price > 0 and edge > spread_price,
    }


def spike_tests(ticks, side, rate, k=8.0):
    """Detect spikes on mid price and test whether their arrival is memoryless."""
    mid = ((ticks["bid"] + ticks["ask"]) / 2).to_numpy()
    ch = np.diff(mid)
    base = np.median(np.abs(ch[ch * side <= 0])) if (ch * side <= 0).any() else np.median(np.abs(ch))
    spikes = np.where((ch * side > 0) & (np.abs(ch) > k * base))[0]
    out = {"ticks": len(mid), "spikes": len(spikes), "base_move": base}
    if len(spikes) < 30:
        out["note"] = "too few spikes to test"
        return out
    gaps = np.diff(spikes)
    out["mean_gap"] = gaps.mean()
    out["advertised"] = rate
    # geometric with p = 1/mean: compare via KS on the continuous exponential approximation
    ks = stats.kstest(gaps, "expon", args=(0, gaps.mean()))
    out["ks_p"] = ks.pvalue
    # hazard: share of waits that end within the next 'h' ticks, after short vs long waits
    med = np.median(gaps)
    h = max(1, int(med / 4))
    surv = lambda g, t: g[g > t]
    short_w, long_w = surv(gaps, 0), surv(gaps, int(med))
    hz_short = (short_w <= h).mean() if len(short_w) else float("nan")
    hz_long = ((long_w - int(med)) <= h).mean() if len(long_w) else float("nan")
    out["hazard_fresh"] = hz_short
    out["hazard_after_median_wait"] = hz_long
    out["hazard_window"] = h
    return out


# ---------------------------------------------------------------- report
def fmt_p(p):
    return "<0.0001" if p < 1e-4 else f"{p:.4f}"


def analyse(folder):
    files = sorted(glob.glob(os.path.join(folder, "*_M1.csv")))
    names = sorted({os.path.basename(f).rsplit("_", 1)[0] for f in glob.glob(os.path.join(folder, "*_*.csv"))})
    lines = ["# Phase 0 report — is there anything to predict?", "",
             f"Per-test significance level {ALPHA}. Every row is a separate symbol and timeframe.", ""]
    verdicts = []
    for name in names:
        spec = read_spec(os.path.join(folder, name + "_spec.csv"))
        point = float(spec.get("point", 0) or 0)
        spread_pts = float(spec.get("spread_points", 0) or 0)
        spread_price = spread_pts * point
        side = spike_side(name)
        lines += [f"## {name.replace('_', ' ')}", ""]
        if spec.get("description"):
            lines += [f"Broker description: *{spec['description']}*", ""]
        flags, economic = [], []
        bars_path = os.path.join(folder, name + "_M1.csv")
        if os.path.exists(bars_path):
            bars = pd.read_csv(bars_path)
            bars["time"] = pd.to_datetime(bars["time"], unit="s")
            bars = bars.set_index("time")
            lines += [f"M1 bars: {len(bars):,} from {bars.index[0]} to {bars.index[-1]}", "",
                      "| TF | n | lag-1 autocorr (95% band) | Ljung-Box p | VR(2) p | VR(5) p | VR(10) p | runs p | Hurst | best edge/bar vs spread |",
                      "|---|---|---|---|---|---|---|---|---|---|"]
            for tf, rule in (("M1", None), ("M5", "5min"), ("M15", "15min")):
                close = bars["close"] if rule is None else bars["close"].resample(rule).last().dropna()
                lr = np.diff(np.log(close.to_numpy()))
                mam = np.mean(np.abs(np.diff(close.to_numpy())))
                t = series_tests(lr, spread_price, mam)
                if t["any_flag"]:
                    flags.append(tf)
                if t["edge_beats_spread"]:
                    economic.append(tf)
                lines.append(
                    f"| {tf} | {t['n']:,} | {t['ac1']:+.4f} (±{t['band']:.4f}) | {fmt_p(t['lb_p'])} | "
                    f"{t['vr2']:.3f} / {fmt_p(t['vr2_p'])} | {t['vr5']:.3f} / {fmt_p(t['vr5_p'])} | "
                    f"{t['vr10']:.3f} / {fmt_p(t['vr10_p'])} | {fmt_p(t['runs_p'])} | {t['hurst']:.3f} | "
                    f"{t['edge']:.5g} vs {t['spread']:.5g} |")
            lines.append("")
        ticks_path = os.path.join(folder, name + "_ticks.csv")
        if os.path.exists(ticks_path):
            ticks = pd.read_csv(ticks_path)
            mid = ((ticks["bid"] + ticks["ask"]) / 2).to_numpy()
            tr = np.diff(mid)
            if side != 0:
                base = np.median(np.abs(tr))
                tr = tr[~((tr * side > 0) & (np.abs(tr) > 8 * base))]   # drift between spikes
            ac = pd.Series(tr).autocorr(1)
            lines += [f"Ticks: {len(ticks):,}. Tick-to-tick lag-1 autocorrelation"
                      f"{' (spikes removed)' if side else ''}: {ac:+.4f} (95% band ±{1.96 / math.sqrt(len(tr)):.4f}).", ""]
            if side != 0:
                s = spike_tests(ticks, side, advertised_rate(name))
                if "note" in s:
                    lines += [f"Spikes: {s['spikes']} found — {s['note']}.", ""]
                else:
                    lines += [
                        f"Spikes: {s['spikes']} in {s['ticks']:,} ticks. Mean gap {s['mean_gap']:.0f} ticks"
                        f" (advertised about {s['advertised']}).",
                        f"Memoryless test (gaps vs exponential, KS): p = {fmt_p(s['ks_p'])}.",
                        f"Chance of a spike within the next {s['hazard_window']} ticks: "
                        f"{100 * s['hazard_fresh']:.1f}% right after a spike vs "
                        f"{100 * s['hazard_after_median_wait']:.1f}% after already waiting the median gap. "
                        "Equal numbers = a spike is never 'due'.", ""]
                    if s["ks_p"] < ALPHA:
                        flags.append("spike timing")
        price_flags = [f for f in flags if f != "spike timing"]
        if "spike timing" in flags:
            v = "SPIKE TIMING IS NOT MEMORYLESS — spikes are partly predictable in time; worth Phase 1-3 testing."
            if price_flags:
                v += f" Price returns also show structure on {', '.join(price_flags)}."
        elif price_flags and economic:
            v = f"STRUCTURE FOUND ({', '.join(price_flags)}) and large enough to beat the spread on {', '.join(economic)} — worth Phase 1-3 testing."
        elif price_flags:
            v = f"Statistically detectable structure ({', '.join(flags)}), but too small to beat the spread — no tradable edge expected."
        else:
            v = "No detectable predictability — behaves like a random walk / memoryless process. No price-based rule can have positive expectancy here."
        verdicts.append((name, v))
        lines += [f"**Verdict:** {v}", ""]
    head = ["## Summary", "", "| Symbol | Verdict |", "|---|---|"] + [f"| {n.replace('_', ' ')} | {v} |" for n, v in verdicts] + [""]
    report = "\n".join(lines[:4] + head + lines[4:])
    out = os.path.join(folder, "phase0_report.md")
    with open(out, "w") as f:
        f.write(report)
    return out, verdicts


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(__doc__)
        sys.exit(1)
    path, v = analyse(sys.argv[1])
    for n, x in v:
        print(f"{n}: {x}")
    print("report:", path)
