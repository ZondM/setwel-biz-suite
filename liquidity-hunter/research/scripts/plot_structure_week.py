"""Plot one week of M15 candles with swings, BOS/CHoCH and swept pools, for visual checking.

Usage: python scripts/plot_structure_week.py <stage2_out_dir> <m1 csv> <week start YYYY-MM-DD> <out.png>
"""
import sys
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import pandas as pd

from lh.data.ingest import ServerTime, read_mt5_bars
from lh.data.resample import resample_bars
from lh.structure.swings import find_swings


def main():
    out_dir, csv, start, png = Path(sys.argv[1]), sys.argv[2], pd.Timestamp(sys.argv[3], tz="UTC"), sys.argv[4]
    end = start + pd.Timedelta(days=2)
    m1 = read_mt5_bars(csv, ServerTime(fixed_offset_hours=0))
    m1 = m1[(m1.index >= start - pd.Timedelta(days=3)) & (m1.index < end)]
    b = resample_bars(m1, "M15")
    sw = find_swings(b)
    b, sw = b[b.index >= start], sw[sw.bar_time >= start]
    ev = pd.read_parquet(out_dir / "dev_events_M15.parquet")
    ev = ev[(ev.time >= start) & (ev.time < end)]
    pools = pd.read_parquet(out_dir / "dev_pools_sweeps.parquet")
    pools = pools[(pools.sweep_time >= start) & (pools.sweep_time < end) & pools.type.isin(["PDH", "PDL", "SWING", "EQH", "EQL"])]

    x = {t: i for i, t in enumerate(b.index)}
    fig, ax = plt.subplots(figsize=(22, 9))
    for t, r in b.iterrows():
        i = x[t]
        col = "#2e7d32" if r.close >= r.open else "#c62828"
        ax.vlines(i, r.low, r.high, color=col, lw=0.8)
        ax.add_patch(plt.Rectangle((i - 0.35, min(r.open, r.close)), 0.7, max(abs(r.close - r.open), 0.01), color=col))
    for s in sw.itertuples():
        ax.plot(x[s.bar_time], s.price, "v" if s.kind == "H" else "^", color="#1565c0", ms=5,
                markeredgewidth=0, alpha=0.7, transform=ax.transData)
    for e in ev.itertuples():
        i = x.get(e.time)
        if i is None:
            continue
        j = x.get(e.broken_swing_time, i - 5)
        col = "#6a1b9a" if "CHOCH" in e.kind else "#000000"
        ax.hlines(e.level, j, i, colors=col, lw=1.2, linestyles="--")
        ax.text(i, e.level, " " + e.kind.replace("_", " "), color=col, fontsize=8, va="bottom" if "UP" in e.kind else "top")
    for p in pools.itertuples():
        i = x.get(p.sweep_time)
        if i is None:
            continue
        col = {"RECLAIMED": "#ef6c00", "BROKEN": "#757575"}.get(p.status, "#9e9e9e")
        ax.hlines(p.level, max(0, x.get(p.known_time, 0) if p.known_time >= start else 0), i + 2, colors=col, lw=1)
        ax.text(i + 2, p.level, f" {p.type} {p.tf} {p.status.lower()}", color=col, fontsize=7, va="center")
    ticks = list(range(0, len(b), 16))
    ax.set_xticks(ticks, [b.index[i].strftime("%a %H:%M") for i in ticks], rotation=45, fontsize=8)
    ax.set_title(f"Deriv XAUUSDmicro M15, {start:%Y-%m-%d} +2 days (UTC). Blue triangles = confirmed swings; "
                 "dashed = BOS (black) / CHoCH (purple); orange = pool swept & reclaimed, grey = pool broken")
    ax.grid(alpha=0.2)
    fig.tight_layout()
    fig.savefig(png, dpi=110)


if __name__ == "__main__":
    main()
