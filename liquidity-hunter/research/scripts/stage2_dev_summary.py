"""Stage 2 sanity run on the DEVELOPMENT period only (no performance numbers).

Usage: python scripts/stage2_dev_summary.py <m1_bars.csv or .zip> <out_dir>
"""
import sys
import zipfile
from pathlib import Path

import pandas as pd

from lh.data.ingest import ServerTime, read_mt5_bars
from lh.data.resample import TIMEFRAMES, resample_bars
from lh.features.atr import atr
from lh.liquidity.pools import equal_pools, period_pools, session_pools, swing_pools
from lh.liquidity.sweep import detect_sweeps
from lh.structure.structure import run_structure
from lh.structure.swings import find_swings

DEV_START, DEV_END = "2022-11-09", "2025-01-01"


def load(path: Path) -> pd.DataFrame:
    if path.suffix == ".zip":
        with zipfile.ZipFile(path) as z:
            name = z.namelist()[0]
            tmp = Path(sys.argv[2]) / name
            tmp.write_bytes(z.read(name))
            path = tmp
    return read_mt5_bars(path, ServerTime(fixed_offset_hours=0))


def main():
    src, out = Path(sys.argv[1]), Path(sys.argv[2])
    out.mkdir(parents=True, exist_ok=True)
    m1 = load(src)
    m1 = m1[(m1.index >= DEV_START) & (m1.index < DEV_END)]
    tf = {k: resample_bars(m1, k) for k in ("M15", "H1", "H4")}
    tf = {k: v[v.complete].drop(columns="complete") for k, v in tf.items()}
    res = {}
    for k, b in tf.items():
        a = atr(b)
        sw = find_swings(b)
        ev, st = run_structure(b, sw, a)
        res[k] = dict(bars=b, atr=a, swings=sw, events=ev, state=st)
    pools = pd.concat([
        swing_pools(res["H1"]["swings"], "H1", TIMEFRAMES["H1"]),
        swing_pools(res["H4"]["swings"], "H4", TIMEFRAMES["H4"]),
        equal_pools(res["H1"]["swings"], tf["H1"], res["H1"]["atr"], "H1", TIMEFRAMES["H1"]),
        period_pools(tf["M15"], "D"), period_pools(tf["M15"], "W"), session_pools(tf["M15"]),
    ], ignore_index=True)
    sweeps = detect_sweeps(pools, tf["M15"], res["M15"]["atr"])
    sweeps.to_parquet(out / "dev_pools_sweeps.parquet")
    for k in res:
        res[k]["events"].to_parquet(out / f"dev_events_{k}.parquet")
        res[k]["state"].to_parquet(out / f"dev_state_{k}.parquet")

    L = [f"# Stage 2 sanity run — development period {DEV_START} to {DEV_END}", "",
         f"Source: `{src.name}`. Descriptive counts only; no trade simulation.", ""]
    L += ["## Bars, swings and structure events", "", "| TF | Bars | Swings | BOS | CHoCH | Median ATR ($) |", "|---|---|---|---|---|---|"]
    for k, r in res.items():
        ev = r["events"]
        L.append(f"| {k} | {len(r['bars'])} | {len(r['swings'])} | {ev.kind.str.startswith('BOS').sum()} | "
                 f"{ev.kind.str.startswith('CHOCH').sum()} | {r['atr'].median():.2f} |")
    L += ["", "## Regime share of bars", "", "| TF | " + " | ".join(
        ["BULL_TREND", "BEAR_TREND", "RANGE", "TRANSITIONAL", "INSUFFICIENT_DATA"]) + " |", "|---|---|---|---|---|---|"]
    for k, r in res.items():
        v = r["state"].regime.value_counts(normalize=True)
        L.append(f"| {k} | " + " | ".join(f"{v.get(x, 0):.1%}" for x in
                 ["BULL_TREND", "BEAR_TREND", "RANGE", "TRANSITIONAL", "INSUFFICIENT_DATA"]) + " |")
    sweeps["group"] = sweeps["type"].where(~sweeps["type"].str.contains("_"), "SESSION_" + sweeps["type"].str.split("_").str[0])
    sweeps["group"] = sweeps["group"].where(sweeps["type"] != "SWING", "SWING_" + sweeps["tf"])
    tab = sweeps.groupby("group")["status"].value_counts().unstack(fill_value=0)
    for c in ["RECLAIMED", "NO_RECLAIM", "BROKEN", "EXPIRED", "ACTIVE"]:
        if c not in tab:
            tab[c] = 0
    tab["total"] = tab.sum(axis=1)
    swept = tab["RECLAIMED"] + tab["NO_RECLAIM"] + sweeps[sweeps.sweep_time.notna() & (sweeps.status == "BROKEN")].groupby("group").size().reindex(tab.index, fill_value=0)
    tab["reclaimed_of_swept"] = (tab["RECLAIMED"] / swept).map(lambda x: f"{x:.0%}" if pd.notna(x) else "-")
    L += ["", "## Liquidity pools and M15 sweep outcomes", "",
          "`reclaimed_of_swept` = share of pools that were swept (depth >= s_min) and then closed back inside within 3 M15 bars.",
          "It describes how often the pattern occurs. It says nothing about what price does afterwards.", "",
          tab[["total", "RECLAIMED", "NO_RECLAIM", "BROKEN", "EXPIRED", "ACTIVE", "reclaimed_of_swept"]].to_markdown()]
    rc = sweeps[sweeps.status == "RECLAIMED"]
    L += ["", f"Reclaimed sweeps: {len(rc)}. Depth (ATR units) median {rc.sweep_depth_atr.median():.2f}, "
          f"p90 {rc.sweep_depth_atr.quantile(.9):.2f}. Bars to reclaim: " +
          ", ".join(f"{int(k)}: {v}" for k, v in rc.bars_to_reclaim.value_counts().sort_index().items()), ""]
    (out / "stage2_dev_summary.md").write_text("\n".join(L) + "\n")
    print("\n".join(L))


if __name__ == "__main__":
    main()
