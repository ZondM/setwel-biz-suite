"""Shared research pipeline: load M1, build timeframes, structure, pools, sweeps, patterns."""
from __future__ import annotations

import zipfile
from pathlib import Path

import pandas as pd

from .data.ingest import ServerTime, read_mt5_bars
from .data.resample import TIMEFRAMES, resample_bars
from .features.atr import atr
from .liquidity.pools import equal_pools, period_pools, session_pools, swing_pools
from .liquidity.sweep import detect_sweeps
from .patterns.consolidation import find_consolidations
from .patterns.displacement import find_displacements
from .structure.structure import run_structure
from .structure.swings import find_swings


def load_m1(path: Path, tmp: Path, start: str, end: str) -> pd.DataFrame:
    if path.suffix == ".zip":
        with zipfile.ZipFile(path) as z:
            name = z.namelist()[0]
            (tmp / name).write_bytes(z.read(name))
            path = tmp / name
    m1 = read_mt5_bars(path, ServerTime(fixed_offset_hours=0))
    return m1[(m1.index >= start) & (m1.index < end)]


def build_base(m1: pd.DataFrame, setup: str = "M15", confirm: str = "M5", mid: str = "H1", top: str = "H4") -> dict:
    """Build all research layers. Timeframe roles default to the original spec;
    variant H1 (docs/10) uses setup=H1, confirm=M15, mid=H4, top=D1."""
    names = dict.fromkeys([confirm, setup, "H1", "H4", mid, top])
    tf = {k: resample_bars(m1, k) for k in names}
    tf = {k: v[v.complete].drop(columns="complete") for k, v in tf.items()}
    st = {}
    for k in names:
        if k == confirm:
            continue
        b = tf[k]
        a = atr(b)
        sw = find_swings(b)
        ev, state = run_structure(b, sw, a)
        st[k] = dict(bars=b, atr=a, swings=sw, events=ev, state=state)
    pools = pd.concat([
        swing_pools(st["H1"]["swings"], "H1", TIMEFRAMES["H1"]),
        swing_pools(st["H4"]["swings"], "H4", TIMEFRAMES["H4"]),
        equal_pools(st["H1"]["swings"], tf["H1"], st["H1"]["atr"], "H1", TIMEFRAMES["H1"]),
        period_pools(tf[setup], "D"), period_pools(tf[setup], "W"), session_pools(tf[setup]),
    ], ignore_index=True)
    sweeps = detect_sweeps(pools, tf[setup], st[setup]["atr"])
    disp = find_displacements(tf[setup], st[setup]["atr"])
    _, active = find_consolidations(tf[setup], st[setup]["atr"])
    return dict(tf=tf, st=st, sweeps=sweeps, disp=disp, range_active=active,
                setup=setup, confirm=confirm, mid=mid, top=top)
