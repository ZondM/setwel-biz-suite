"""Stage 3 — Model A ladder on the development period (protocol: docs/06).

Usage: python scripts/stage3_model_a.py <m1 bars .zip/.csv> <out_dir>
"""
import subprocess
import sys
import zipfile
from pathlib import Path

import numpy as np
import pandas as pd

from lh.analysis.stats import bootstrap_ci, bootstrap_diff_p, holm, summary, week_key
from lh.data.ingest import ServerTime, read_mt5_bars
from lh.data.resample import TIMEFRAMES, resample_bars
from lh.features.atr import atr
from lh.liquidity.pools import equal_pools, period_pools, session_pools, swing_pools
from lh.liquidity.sweep import detect_sweeps
from lh.models.model_a import ModelAParams, build_candidates
from lh.patterns.consolidation import find_consolidations
from lh.patterns.displacement import find_displacements
from lh.sim.trades import M1Market, entry_allowed, simulate
from lh.structure.structure import run_structure
from lh.structure.swings import find_swings

DEV_START, DEV_END = "2022-11-09", "2025-01-01"
N_RANDOM = 50
SEED = 20261021


def load_m1(path: Path, tmp: Path) -> pd.DataFrame:
    if path.suffix == ".zip":
        with zipfile.ZipFile(path) as z:
            name = z.namelist()[0]
            (tmp / name).write_bytes(z.read(name))
            path = tmp / name
    m1 = read_mt5_bars(path, ServerTime(fixed_offset_hours=0))
    return m1[(m1.index >= DEV_START) & (m1.index < DEV_END)]


def build(m1: pd.DataFrame):
    tf = {k: resample_bars(m1, k) for k in ("M5", "M15", "H1", "H4")}
    tf = {k: v[v.complete].drop(columns="complete") for k, v in tf.items()}
    out = {}
    for k in ("M15", "H1", "H4"):
        b = tf[k]
        a = atr(b)
        sw = find_swings(b)
        ev, st = run_structure(b, sw, a)
        out[k] = dict(bars=b, atr=a, swings=sw, events=ev, state=st)
    pools = pd.concat([
        swing_pools(out["H1"]["swings"], "H1", TIMEFRAMES["H1"]),
        swing_pools(out["H4"]["swings"], "H4", TIMEFRAMES["H4"]),
        equal_pools(out["H1"]["swings"], tf["H1"], out["H1"]["atr"], "H1", TIMEFRAMES["H1"]),
        period_pools(tf["M15"], "D"), period_pools(tf["M15"], "W"), session_pools(tf["M15"]),
    ], ignore_index=True)
    sweeps = detect_sweeps(pools, tf["M15"], out["M15"]["atr"])
    disp = find_displacements(tf["M15"], out["M15"]["atr"])
    _, active = find_consolidations(tf["M15"], out["M15"]["atr"])
    cands = build_candidates(tf["M15"], out["M15"]["atr"], out["M15"]["events"], disp, active,
                             out["H4"]["state"], sweeps, tf["M5"], ModelAParams())
    return tf, out, cands


def run_step(mk: M1Market, rows: pd.DataFrame, sig_col: str, atr_col: str, chase_check: bool) -> pd.DataFrame:
    res = []
    for r in rows.itertuples(index=False):
        sig = getattr(r, sig_col)
        if chase_check:
            i0 = mk.first_bar_at_or_after(sig)
            if i0 < len(mk.o):
                px = mk.o[i0] + (mk.sp[i0] if r.direction > 0 else 0)
                beyond = r.direction * (r.zone_near - px)          # >0: price already past the near edge
                if beyond > ModelAParams().retest.max_entry_atr * getattr(r, atr_col):
                    res.append({"pool_id": r.pool_id, "status": "CHASED"})
                    continue
        t = simulate(mk, sig, r.direction, stop_ref=r.sweep_extreme,
                     buffer_atr=ModelAParams().stop_buffer_atr * getattr(r, atr_col))
        t["pool_id"] = r.pool_id
        res.append(t)
    return pd.DataFrame(res)


def random_baseline(mk: M1Market, m15: pd.DataFrame, atr15: pd.Series, trades_a: pd.DataFrame,
                    cands: pd.DataFrame) -> pd.DataFrame:
    rng = np.random.default_rng(SEED)
    ok = np.array([entry_allowed(t) for t in m15["close_time"]])
    pool_t = m15["close_time"].to_numpy()[ok]
    pool_a = atr15.to_numpy()[ok]
    valid = ~np.isnan(pool_a)
    pool_t, pool_a = pool_t[valid], pool_a[valid]
    atr_a = cands.set_index("pool_id")["atr_A"]
    res = []
    for tr in trades_a.itertuples(index=False):
        dist_atr = tr.risk / atr_a[tr.pool_id]
        for k in rng.integers(0, len(pool_t), N_RANDOM):
            t = simulate(mk, pd.Timestamp(pool_t[k]), int(tr.direction), stop_distance=dist_atr * pool_a[k])
            t["pool_id"] = tr.pool_id
            res.append(t)
    return pd.DataFrame(res)


def main():
    src, out = Path(sys.argv[1]), Path(sys.argv[2])
    out.mkdir(parents=True, exist_ok=True)
    m1 = load_m1(src, out)
    tf, st, cands = build(m1)
    mk = M1Market(m1)
    cands.to_parquet(out / "model_a_candidates.parquet")

    sel = {
        "A": cands,
        "B": cands[cands.pass_B],
        "C": cands[cands.pass_B & cands.pass_C],
        "D": cands[cands.pass_B & cands.pass_C & cands.pass_D],
        "E": cands[cands.pass_B & cands.pass_C & cands.pass_D & cands.range_before_sweep],
    }
    spec = {"A": ("sig_A", "atr_A", False), "B": ("sig_A", "atr_A", False), "C": ("sig_C", "atr_C", False),
            "D": ("sig_D", "atr_C", True), "E": ("sig_D", "atr_C", True)}
    trades = {k: run_step(mk, sel[k], *spec[k]) for k in sel}
    filled = {k: v[v.status == "FILLED"].copy() for k, v in trades.items()}
    trades["A0"] = random_baseline(mk, tf["M15"], st["M15"]["atr"], filled["A"], cands)
    filled["A0"] = trades["A0"][trades["A0"].status == "FILLED"].copy()
    for k, v in trades.items():
        v.to_parquet(out / f"model_a_trades_{k}.parquet")

    order = ["A0", "A", "B", "C", "D", "E"]
    stats, weeks = {}, {}
    for k in order:
        f = filled[k]
        weeks[k] = week_key(f["entry_time"]) if len(f) else np.array([])
        s = summary(f["r"].to_numpy(), f["entry_time"]) if len(f) else {"n": 0}
        s["ci"] = bootstrap_ci(f["r"].to_numpy(), weeks[k], seed=1) if len(f) else (np.nan, np.nan)
        s["candidates"] = len(sel[k]) if k in sel else len(trades[k])
        s["rejected"] = trades[k]["status"].value_counts().drop("FILLED", errors="ignore").to_dict()
        if len(f):
            s["exit_reasons"] = f["exit_reason"].value_counts().to_dict()
            s["mean_risk_usd"] = f["risk"].mean()
            s["mean_spread_r"] = f["spread_entry_r"].mean()
        stats[k] = s
    comps = [("A", "A0"), ("B", "A"), ("C", "B"), ("D", "C"), ("E", "D")]
    diffs = [bootstrap_diff_p(filled[a]["r"].to_numpy(), weeks[a], filled[b]["r"].to_numpy(), weeks[b], seed=2)
             for a, b in comps]
    rej = holm([p for _, p in diffs])

    sha = subprocess.run(["git", "rev-parse", "--short", "HEAD"], capture_output=True, text=True).stdout.strip()
    L = ["# Stage 3 results — Model A ladder (development period)", "",
         f"Protocol: docs/06 (committed before this run). Code commit: `{sha}`. Data: `{src.name}`, "
         f"{DEV_START} to {DEV_END}. Instrument: Deriv XAUUSDmicro. Exit: stop at sweep extreme + buffer, 2R target, 24 h max.", "",
         "## Results per step (after spread, slippage and swap)", "",
         "| Step | Candidates | Trades | Mean R | 95% CI | Win rate | Profit factor | Total R | Max DD (R) | Max losing streak |",
         "|---|---|---|---|---|---|---|---|---|---|"]
    for k in order:
        s = stats[k]
        if s["n"] == 0:
            L.append(f"| {k} | {s['candidates']} | 0 | - | - | - | - | - | - | - |")
            continue
        L.append(f"| {k} | {s['candidates']} | {s['n']} | {s['mean_r']:+.3f} | [{s['ci'][0]:+.3f}, {s['ci'][1]:+.3f}] | "
                 f"{s['win_rate']:.1%} | {s['profit_factor']:.2f} | {s['total_r']:+.1f} | {s['max_dd_r']:.1f} | {s['max_losing_streak']} |")
    L += ["", "A0 = random entries (50 per step-A trade); its Max DD / streak figures are not comparable because it has 50x more trades.", "",
          "## Does each added condition improve the result?", "",
          "| Comparison | Difference in mean R | One-sided p | Holm significant (α=0.05) | Verdict |", "|---|---|---|---|---|"]
    for (a, b), (d, p), r in zip(comps, diffs, rej):
        verdict = "adds value" if r else "not shown to add value"
        L.append(f"| {a} vs {b} | {d:+.3f} | {p:.3f} | {'yes' if r else 'no'} | {verdict} |")
    L += ["", "## Rejections and exits", ""]
    for k in order:
        s = stats[k]
        L.append(f"- **{k}**: rejected {s['rejected']}; exits {s.get('exit_reasons', {})}; "
                 f"mean risk ${s.get('mean_risk_usd', float('nan')):.2f}/oz; entry spread = {s.get('mean_spread_r', float('nan')):.1%} of R")
    reasons = {c: cands[f"reason_{c}"].value_counts(dropna=True).to_dict() for c in ("B", "C", "D")}
    L += ["", "## Why candidates failed each condition (all reclaimed sweeps)", ""]
    for c, v in reasons.items():
        L.append(f"- {c}: {v}")
    (out / "stage3_model_a_results.md").write_text("\n".join(L) + "\n")
    print("\n".join(L))


if __name__ == "__main__":
    main()
