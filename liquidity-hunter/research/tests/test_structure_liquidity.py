import numpy as np
import pandas as pd
import pytest

from lh.data.resample import resample_bars
from lh.features.atr import atr
from lh.liquidity.pools import equal_pools, period_pools, session_pools, swing_pools, trading_day
from lh.liquidity.sweep import SweepParams, detect_sweeps
from lh.structure.structure import run_structure
from lh.structure.swings import SwingParams, find_swings
from test_data import synthetic_m1

M15 = pd.Timedelta(minutes=15)


def mk(rows, start="2025-01-06 10:00"):
    idx = pd.date_range(start, periods=len(rows), freq="15min", tz="UTC")
    df = pd.DataFrame(rows, columns=["open", "high", "low", "close"], index=idx, dtype=float)
    df["close_time"] = df.index + M15
    return df


def const_atr(bars, v=1.0):
    return pd.Series(v, index=bars.index)


# ---------- ATR ----------

def test_atr_wilder():
    b = mk([(10, 11, 9, 10)] * 3 + [(10, 14, 10, 13)])
    a = atr(b, n=3)
    assert np.isnan(a.iloc[1]) and a.iloc[2] == pytest.approx(2.0)
    assert a.iloc[3] == pytest.approx((2.0 * 2 + 4) / 3)


# ---------- swings ----------

def test_swings_flat_top_and_known_time():
    b = mk([(1, 1, 0, 1), (1, 2, 1, 2), (2, 5, 2, 4), (4, 5, 3, 4), (4, 3, 2, 3), (3, 2.5, 1, 2), (2, 3, 2, 3)])
    s = find_swings(b, SwingParams(2, 2))
    highs = s[s.kind == "H"]
    assert list(highs.idx) == [2]                      # flat top 5,5 -> earliest bar only
    assert highs.known_time.iloc[0] == b.close_time.iloc[4]
    lows = s[s.kind == "L"]
    assert list(lows.idx) == []                        # bar 5 low=1 lacks two right bars


# ---------- structure ----------

STRUCT_ROWS = [
    (5, 6, 4, 5), (5, 7, 5, 6), (6, 10, 6, 9), (9, 9.5, 7, 8), (8, 8.5, 6.5, 7),
    (7, 9, 6.8, 8.9), (8.9, 10.04, 8.8, 10.04), (10, 10.3, 9.9, 10.2), (10.2, 10.5, 9.5, 9.8),
    (9.8, 9.9, 9.0, 9.2), (9.2, 9.8, 9.1, 9.6), (9.6, 9.9, 9.3, 9.7), (9.7, 9.75, 8.8, 8.9),
]


def test_structure_bos_then_choch():
    b = mk(STRUCT_ROWS)
    ev, st = run_structure(b, find_swings(b), const_atr(b))
    assert list(ev.kind) == ["BOS_UP", "CHOCH_DOWN"]
    bos, choch = ev.iloc[0], ev.iloc[1]
    assert bos.time == b.index[7] and bos.level == 10 and bos.protected == 6
    assert bos.event_time == b.close_time.iloc[7]
    assert choch.time == b.index[12] and choch.level == 9.0 and choch.protected == 9.9
    assert st.trend.iloc[6] == "NONE" and st.trend.iloc[7] == "BULL" and st.trend.iloc[12] == "BEAR"


def test_structure_close_within_tolerance_is_not_a_break():
    b = mk(STRUCT_ROWS[:7])  # bar 6 closes 10.04, level 10 + tol 0.05
    ev, _ = run_structure(b, find_swings(b), const_atr(b))
    assert ev.empty


# ---------- sweeps ----------

def sweep_case(rows, side="H", level=100.0, expires_bars=50):
    b = mk([(99, 99.5, 98.5, 99) if side == "H" else (101, 101.5, 100.5, 101)] + rows)
    pool = pd.DataFrame([dict(pool_id="P", type="T", side=side, tf="M15", level=level, price_lo=level,
                              price_hi=level, origin_time=b.index[0], known_time=b.index[1],
                              expires_time=b.index[1] + expires_bars * M15)])
    return detect_sweeps(pool, b, const_atr(b), SweepParams()).iloc[0], b


def test_sweep_reclaim_same_bar():
    r, b = sweep_case([(99, 100.3, 99, 99.8)])
    assert r.status == "RECLAIMED" and r.bars_to_reclaim == 0
    assert r.sweep_depth_atr == pytest.approx(0.3) and r.end_time == b.close_time.iloc[1]


def test_sweep_reclaim_next_bar():
    r, _ = sweep_case([(99, 100.3, 99, 100.02), (100, 100.1, 99.5, 99.9)])
    assert r.status == "RECLAIMED" and r.bars_to_reclaim == 1


def test_close_through_is_breakout():
    r, _ = sweep_case([(99, 100.3, 99, 100.1)])
    assert r.status == "BROKEN" and r.reason == "close_through"


def test_too_deep_is_breakout():
    r, _ = sweep_case([(99, 101.5, 99, 99.5)])
    assert r.status == "BROKEN" and r.reason == "too_deep"


def test_no_reclaim_within_window():
    r, b = sweep_case([(99, 100.3, 99, 100.02), (100, 100.1, 100, 100.03), (100, 100.1, 100, 100.04),
                       (100, 100, 99, 99.5)])
    assert r.status == "NO_RECLAIM" and r.end_time == b.close_time.iloc[3]


def test_low_side_mirror():
    r, _ = sweep_case([(101, 101, 99.7, 100.2)], side="L")
    assert r.status == "RECLAIMED" and r.sweep_depth_atr == pytest.approx(0.3)


def test_pool_expires_and_active():
    r, _ = sweep_case([(99, 99.5, 98.5, 99)] * 6, expires_bars=3)
    assert r.status == "EXPIRED"
    r, _ = sweep_case([(99, 99.5, 98.5, 99)] * 2, expires_bars=10)
    assert r.status == "ACTIVE"


# ---------- pools ----------

def test_trading_day_boundary_is_17_ny():
    t = pd.DatetimeIndex(["2025-01-06 21:59", "2025-01-06 22:00", "2025-07-07 20:59", "2025-07-07 21:00"], tz="UTC")
    assert [str(d.date()) for d in trading_day(t)] == ["2025-01-06", "2025-01-07", "2025-07-07", "2025-07-08"]


def test_previous_day_pools():
    m15 = resample_bars(synthetic_m1(), "M15")
    pd_pools = period_pools(m15, "D")
    mon = pd_pools[pd_pools.pool_id == "PDH-20250106"].iloc[0]
    sel = m15[(m15.index >= "2025-01-05 22:00") & (m15.index < "2025-01-06 22:00")]
    assert mon.level == sel.high.max()
    assert mon.known_time == pd.Timestamp("2025-01-06 22:00", tz="UTC")
    assert mon.expires_time == pd.Timestamp("2025-01-07 22:00", tz="UTC")
    fri = pd_pools[pd_pools.pool_id == "PDH-20250110"].iloc[0]
    assert fri.expires_time == pd.Timestamp("2025-01-13 22:00", tz="UTC")  # next trading day is Monday
    wk = period_pools(m15, "W")
    assert set(wk.pool_id) >= {"PWH-20250106", "PWL-20250106"}


def test_session_pools_cover_their_window():
    m15 = resample_bars(synthetic_m1(), "M15")
    sp = session_pools(m15)
    ln = sp[sp.pool_id == "LONDONH-20250107"].iloc[0]
    # London = 02:00-08:00 NY = 07:00-13:00 UTC in January
    sel = m15[(m15.index >= "2025-01-07 07:00") & (m15.index < "2025-01-07 13:00")]
    assert ln.level == sel.high.max() and ln.known_time == pd.Timestamp("2025-01-07 13:00", tz="UTC")


def test_equal_highs_detected():
    rows = [(5, 6, 4, 5), (5, 7, 5, 6), (6, 10, 6, 9), (9, 9, 7, 8), (8, 8, 6.5, 7), (7, 8, 6, 7.5),
            (7.5, 9, 7, 8.5), (8.5, 10.05, 8, 9), (9, 9, 7, 8), (8, 8.5, 7, 8)]
    b = mk(rows)
    sw = find_swings(b)
    eq = equal_pools(sw, b, const_atr(b), "M15", M15)
    eqh = eq[eq.type == "EQH"]
    assert len(eqh) == 1 and eqh.level.iloc[0] == 10.05 and eqh.price_lo.iloc[0] == 10
    assert eqh.known_time.iloc[0] == b.close_time.iloc[9]


# ---------- look-ahead (truncation) tests ----------

@pytest.fixture(scope="module")
def m15():
    return resample_bars(synthetic_m1(seed=3), "M15").drop(columns=["complete"])


def _pipeline(bars):
    a = atr(bars)
    sw = find_swings(bars)
    ev, st = run_structure(bars, sw, a)
    pools = pd.concat([swing_pools(sw, "M15", M15), equal_pools(sw, bars, a, "M15", M15),
                       period_pools(bars, "D"), session_pools(bars)], ignore_index=True)
    sweeps = detect_sweeps(pools, bars, a)
    return sw, ev, st, pools, sweeps


@pytest.mark.parametrize("cut_pos", [400, 900, 1300])
def test_no_lookahead_anywhere(m15, cut_pos):
    full = _pipeline(m15)
    part_bars = m15.iloc[:cut_pos]
    cut = part_bars.close_time.iloc[-1]
    part = _pipeline(part_bars)

    sw_f, sw_p = full[0], part[0]
    pd.testing.assert_frame_equal(sw_p, sw_f[sw_f.known_time <= cut].reset_index(drop=True))

    ev_f, ev_p = full[1], part[1]
    pd.testing.assert_frame_equal(ev_p, ev_f[ev_f.event_time <= cut].reset_index(drop=True))

    pd.testing.assert_frame_equal(part[2], full[2].iloc[:cut_pos])

    key = ["pool_id", "level", "known_time", "expires_time"]
    pf = full[3][full[3].known_time <= cut][key].sort_values("pool_id").reset_index(drop=True)
    pp = part[3][key].sort_values("pool_id").reset_index(drop=True)
    pd.testing.assert_frame_equal(pp, pf)

    sf = full[4].set_index("pool_id")
    sp = part[4].set_index("pool_id")
    done = sp[sp.end_time.notna()]
    assert len(done) > 20
    pd.testing.assert_frame_equal(done, sf.loc[done.index, done.columns], check_dtype=False)
    still = sp[sp.status == "ACTIVE"].index
    assert (sf.loc[still, "end_time"].isna() | (sf.loc[still, "end_time"] > cut)).all()
