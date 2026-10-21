import numpy as np
import pandas as pd
import pytest

from lh.analysis.stats import bootstrap_ci, holm, summary
from lh.data.resample import resample_bars
from lh.features.atr import atr
from lh.patterns.consolidation import find_consolidations
from lh.patterns.displacement import find_displacements
from lh.patterns.retest import order_block_zone, run_retest
from lh.sim.trades import CostParams, M1Market, _nights, entry_allowed, simulate
from test_data import synthetic_m1
from test_structure_liquidity import const_atr, mk

M1 = pd.Timedelta(minutes=1)


# ---------- consolidation ----------

def test_consolidation_valid_then_breaks_up():
    rows = [(100, 101, 99, 100)] * 9 + [(100, 100.8, 99.4, 100.4)] * 3 + [(100.4, 103, 100.3, 102.8)]
    b = mk(rows)
    ranges, active = find_consolidations(b, const_atr(b, 1.0))
    assert len(ranges) == 1
    r = ranges.iloc[0]
    assert r.valid_time == b.close_time.iloc[8]       # 8-bar window from bar 1 (needs ATR of bar 0)
    assert r.end_reason == "BREAK_UP" and r.end_time == b.close_time.iloc[12]
    assert active.iloc[8:12].all() and not active.iloc[12]


def test_consolidation_rejects_wide_window():
    rows = [(100, 104, 96, 100)] * 12
    b = mk(rows)
    ranges, active = find_consolidations(b, const_atr(b, 1.0))
    assert ranges.empty and not active.any()


# ---------- displacement ----------

def test_displacement_single_and_multi_bar():
    rows = [(100, 100.5, 99.5, 100)] * 3 + [(100, 101.7, 99.95, 101.6)]       # 1 bar, +1.6 ATR
    d = find_displacements(mk(rows), const_atr(mk(rows)))
    assert d.disp_dir.iloc[3] == 1 and d.disp_bars.iloc[3] == 1
    rows = [(100, 100.5, 99.5, 100)] * 3 + [(100, 100.8, 99.95, 100.7), (100.7, 101.65, 100.65, 101.6)]
    d = find_displacements(mk(rows), const_atr(mk(rows)))
    assert d.disp_dir.iloc[4] == 1 and d.disp_bars.iloc[4] == 2
    assert d.disp_start.iloc[4] == mk(rows).index[3]


def test_displacement_requires_strong_close():
    rows = [(100, 100.5, 99.5, 100)] * 3 + [(100, 103, 99.95, 101.6)]          # closes mid-range
    d = find_displacements(mk(rows), const_atr(mk(rows)))
    assert d.disp_dir.iloc[3] == 0


# ---------- retest ----------

def m5_bars(rows, start="2025-01-07 10:00"):
    idx = pd.date_range(start, periods=len(rows), freq="5min", tz="UTC")
    df = pd.DataFrame(rows, columns=["open", "high", "low", "close"], index=idx, dtype=float)
    df["close_time"] = df.index + pd.Timedelta(minutes=5)
    return df


def test_order_block_zone_short():
    b = mk([(100, 101, 99, 100.5), (100.5, 100.6, 99.8, 99.9), (99.9, 100, 98, 98.1)])
    z = order_block_zone(b, 1, -1)
    assert z[:4] == (100, 101, 100, 101)


def test_retest_confirmed_short():
    m5 = m5_bars([(99, 99.5, 98.8, 99.2), (99.2, 100.3, 99.1, 99.8), (99.8, 99.9, 99.2, 99.4)])
    r = run_retest(m5, -1, near=100, far=101, stop=102, start=m5.index[0], ref_entry=99, ref_risk=3)
    assert r["status"] == "CONFIRMED" and r["touch_time"] == m5.index[1] and r["end_time"] == m5.close_time.iloc[1]


def test_retest_far_close_and_missed():
    m5 = m5_bars([(99, 101.5, 99, 101.2)])
    assert run_retest(m5, -1, 100, 101, 102, m5.index[0], 99, 3)["status"] == "INVALID_FAR_CLOSE"
    m5 = m5_bars([(99, 99.2, 95.9, 96.5)])
    assert run_retest(m5, -1, 100, 101, 102, m5.index[0], 99, 3)["status"] == "MISSED_NO_RETEST"
    m5 = m5_bars([(99, 102.1, 99, 99.5)])
    assert run_retest(m5, -1, 100, 101, 102, m5.index[0], 99, 3)["status"] == "INVALID_STOP"


# ---------- trade simulation ----------

def m1_market(path, start="2025-01-07 15:00", spread_pts=8):
    """path: list of (o,h,l,c) bid bars; spread = (8+2) pts = $0.10."""
    idx = pd.date_range(start, periods=len(path), freq="1min", tz="UTC")
    df = pd.DataFrame(path, columns=["open", "high", "low", "close"], index=idx, dtype=float)
    df["spread"] = spread_pts
    return M1Market(df), idx


def test_long_target_hit():
    mkt, idx = m1_market([(100, 100.2, 99.9, 100.1), (100.1, 104.5, 100, 104)])
    r = simulate(mkt, idx[0], +1, stop_price=98.1)
    assert r["entry"] == pytest.approx(100.1) and r["risk"] == pytest.approx(2.0)
    assert r["exit_reason"] == "TARGET" and r["r"] == pytest.approx(2.0)


def test_long_stop_has_extra_spread():
    mkt, idx = m1_market([(100, 100.2, 99.9, 100.1), (100.1, 100.2, 97, 97.5)])
    r = simulate(mkt, idx[0], +1, stop_price=98.1)
    assert r["exit_reason"] == "STOP" and r["exit"] == pytest.approx(98.0)
    assert r["r"] == pytest.approx((98.0 - 100.1) / 2.0)


def test_short_uses_ask_and_same_bar_conflict_takes_stop():
    mkt, idx = m1_market([(100, 100.1, 99.9, 100), (100, 103, 95, 99)])
    r = simulate(mkt, idx[0], -1, stop_price=102)
    assert r["entry"] == 100 and r["risk"] == 2
    assert r["exit_reason"] == "STOP" and r["exit"] == pytest.approx(102.1)


def test_time_exit_and_stop_rejections():
    mkt, idx = m1_market([(100, 100.2, 99.9, 100)] * (60 * 25))
    r = simulate(mkt, idx[0], +1, stop_distance=2.0)
    assert r["exit_reason"] == "TIME" and r["exit_time"] == idx[0] + pd.Timedelta(hours=24)
    assert simulate(mkt, idx[0], +1, stop_price=100.3)["status"] == "STOP_BEYOND_ENTRY"
    assert simulate(mkt, idx[0], +1, stop_distance=0.15)["status"] == "STOP_TOO_TIGHT"


def test_entry_time_filter_and_swap_nights():
    assert not entry_allowed(pd.Timestamp("2025-01-07 21:45", tz="UTC"))    # 16:45 NY
    assert entry_allowed(pd.Timestamp("2025-01-07 23:30", tz="UTC"))
    assert not entry_allowed(pd.Timestamp("2025-01-10 21:10", tz="UTC"))    # Friday 16:10 NY
    tue, wed = pd.Timestamp("2025-01-07 15:00", tz="UTC"), pd.Timestamp("2025-01-08 15:00", tz="UTC")
    assert _nights(tue, wed, 2) == 1
    assert _nights(wed, wed + pd.Timedelta(days=1), 2) == 3


# ---------- statistics ----------

def test_holm_and_summary():
    assert holm([0.01, 0.04, 0.03, 0.5]) == [True, False, False, False]
    assert holm([0.001, 0.012, 0.03]) == [True, True, True]
    s = summary(np.array([1, -1, -1, 2]), pd.Series(pd.date_range("2025-01-06", periods=4, tz="UTC")))
    assert s["mean_r"] == 0.25 and s["max_dd_r"] == 2 and s["max_losing_streak"] == 2
    lo, hi = bootstrap_ci(np.ones(20), np.repeat(["a", "b"], 10))
    assert lo == hi == 1


# ---------- look-ahead ----------

@pytest.mark.parametrize("cut_pos", [500, 1200])
def test_patterns_no_lookahead(cut_pos):
    b = resample_bars(synthetic_m1(seed=5), "M15").drop(columns="complete")
    a = atr(b)
    rf, af = find_consolidations(b, a)
    df = find_displacements(b, a)
    bp = b.iloc[:cut_pos]
    cut = bp.close_time.iloc[-1]
    rp, ap = find_consolidations(bp, atr(bp))
    dp = find_displacements(bp, atr(bp))
    pd.testing.assert_series_equal(ap, af.iloc[:cut_pos])
    pd.testing.assert_frame_equal(dp, df.iloc[:cut_pos])
    done = rp[rp.end_time.notna()].reset_index(drop=True)
    pd.testing.assert_frame_equal(done, rf[rf.end_time <= cut].reset_index(drop=True))
