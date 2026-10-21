import numpy as np
import pandas as pd
import pytest

from lh.data.ingest import ServerTime, read_mt5_bars, read_mt5_ticks
from lh.data.resample import resample_bars
from lh.data.validate import ERROR, check_bars, check_ticks, compare_ticks_to_bars

M1 = pd.Timedelta(minutes=1)


def synthetic_m1(start="2025-01-05 22:00", end="2025-01-24 21:59", seed=0) -> pd.DataFrame:
    """Random-walk M1 bars, trading Sun 22:00 UTC -> Fri 21:59 UTC (winter: 17:00 New York)."""
    idx = pd.date_range(start, end, freq="1min", tz="UTC")
    wd, minute_of_day = idx.dayofweek, idx.hour * 60 + idx.minute
    open_mask = ~((wd == 5) | ((wd == 4) & (minute_of_day >= 22 * 60)) | ((wd == 6) & (minute_of_day < 22 * 60)))
    idx = idx[open_mask]
    rng = np.random.default_rng(seed)
    close = 2650 + np.cumsum(rng.normal(0, 0.3, len(idx)))
    open_ = np.r_[close[0], close[:-1]]
    high = np.maximum(open_, close) + rng.uniform(0, 0.2, len(idx))
    low = np.minimum(open_, close) - rng.uniform(0, 0.2, len(idx))
    return pd.DataFrame({
        "open": open_, "high": high, "low": low, "close": close,
        "tick_volume": rng.integers(1, 50, len(idx)).astype(float),
        "real_volume": 0.0, "spread": rng.integers(10, 30, len(idx)).astype(float),
    }, index=idx)


def write_mt5_bars(df: pd.DataFrame, path, server_offset_h=0, encoding="utf-16", sep="\t"):
    t = df.index.tz_convert(None) + pd.Timedelta(hours=server_offset_h)
    lines = [sep.join(["<DATE>", "<TIME>", "<OPEN>", "<HIGH>", "<LOW>", "<CLOSE>", "<TICKVOL>", "<VOL>", "<SPREAD>"])]
    for ts, r in zip(t, df.itertuples()):
        lines.append(sep.join([ts.strftime("%Y.%m.%d"), ts.strftime("%H:%M:%S"),
                               f"{r.open:.2f}", f"{r.high:.2f}", f"{r.low:.2f}", f"{r.close:.2f}",
                               str(int(r.tick_volume)), "0", str(int(r.spread))]))
    path.write_text("\n".join(lines) + "\n", encoding=encoding)


@pytest.mark.parametrize("encoding,sep", [("utf-16", "\t"), ("utf-8", ","), ("utf-8-sig", "\t")])
def test_read_bars_roundtrip(tmp_path, encoding, sep):
    df = synthetic_m1().iloc[:500]
    p = tmp_path / "bars.csv"
    write_mt5_bars(df, p, server_offset_h=2, encoding=encoding, sep=sep)
    got = read_mt5_bars(p, ServerTime(fixed_offset_hours=2))
    assert got.index.equals(df.index)
    np.testing.assert_allclose(got["close"].to_numpy(), df["close"].round(2).to_numpy())
    assert got["spread"].iloc[0] == df["spread"].iloc[0]


def test_iana_server_time_handles_dst():
    naive = pd.Series(pd.to_datetime(["2025-01-10 12:00", "2025-07-10 12:00"]))
    utc = ServerTime(iana_zone="Europe/Athens").to_utc(naive)
    assert list(utc.dt.hour) == [10, 9]  # EET +2 in winter, EEST +3 in summer


def test_server_time_requires_exactly_one():
    with pytest.raises(ValueError):
        ServerTime()
    with pytest.raises(ValueError):
        ServerTime(fixed_offset_hours=0, iana_zone="UTC")


def test_read_ticks_forward_fills_missing_side(tmp_path):
    p = tmp_path / "ticks.csv"
    p.write_text(
        "<DATE>\t<TIME>\t<BID>\t<ASK>\t<LAST>\t<VOLUME>\t<FLAGS>\n"
        "2025.01.06\t00:00:00.100\t\t2650.30\t\t\t4\n"
        "2025.01.06\t00:00:00.200\t2650.10\t2650.30\t\t\t6\n"
        "2025.01.06\t00:00:00.350\t2650.15\t\t\t\t2\n"
        "2025.01.06\t00:00:01.000\t\t2650.40\t\t\t4\n",
        encoding="utf-16",
    )
    t = read_mt5_ticks(p, ServerTime(fixed_offset_hours=0))
    assert len(t) == 3  # first row has no bid yet
    assert list(t["bid"]) == [2650.10, 2650.15, 2650.15]
    assert list(t["ask"]) == [2650.30, 2650.30, 2650.40]
    assert list(t["raw_bid_present"]) == [True, True, False]
    assert t.index[0] == pd.Timestamp("2025-01-06 00:00:00.200", tz="UTC")


def _by_check(findings):
    return {f.check: f for f in findings}


def test_clean_bars_have_no_errors():
    f = _by_check(check_bars(synthetic_m1(), M1))
    assert not [x for x in f.values() if x.severity == ERROR]
    assert f["gaps_weekend"].count == 2
    assert f["gaps_unexplained"].count == 0
    assert f["weekly_open_alignment"].count == 0


def test_detects_bad_bars():
    df = synthetic_m1().iloc[:1000].copy()
    df.iloc[10, df.columns.get_loc("high")] = df["low"].iloc[10] - 1  # invalid OHLC
    df = pd.concat([df, df.iloc[[20]]]).sort_index()  # duplicate
    df = df.drop(df.index[300:420])  # 2-hour hole mid-week
    f = _by_check(check_bars(df, M1))
    assert f["invalid_ohlc"].count == 1
    assert f["duplicate_timestamps"].count == 1
    assert f["gaps_unexplained"].count == 1


def test_wrong_server_offset_is_detected(tmp_path):
    p = tmp_path / "bars.csv"
    write_mt5_bars(synthetic_m1(), p, server_offset_h=2)
    wrong = read_mt5_bars(p, ServerTime(fixed_offset_hours=-3))  # 5 hours off
    f = _by_check(check_bars(wrong, M1))
    assert f["weekly_open_alignment"].severity == ERROR


def test_tick_checks_and_tick_bar_comparison():
    idx = pd.date_range("2025-01-06 00:00", periods=600, freq="1s", tz="UTC")
    bid = 2650 + np.cumsum(np.random.default_rng(1).normal(0, 0.05, len(idx)))
    ticks = pd.DataFrame({"bid": bid, "ask": bid + 0.2}, index=idx)
    ticks.iloc[50, 0] = ticks.iloc[50, 1] + 1  # crossed quote
    f = _by_check(check_ticks(ticks))
    assert f["crossed_quotes"].count == 1

    bars = ticks["bid"].resample("1min").ohlc()
    assert compare_ticks_to_bars(ticks, bars, M1, tol=1e-9)[0].count == 0
    bars.iloc[3, 1] += 5
    assert compare_ticks_to_bars(ticks, bars, M1, tol=1e-9)[0].count == 1


def test_resample_values_and_close_time():
    m1 = synthetic_m1()
    h4 = resample_bars(m1, "H4")
    first = h4.index[0]
    src = m1.loc[first:first + pd.Timedelta(hours=4) - M1]
    row = h4.iloc[0]
    assert first == pd.Timestamp("2025-01-05 20:00", tz="UTC")  # grid anchored at UTC midnight
    assert row["open"] == src["open"].iloc[0] and row["close"] == src["close"].iloc[-1]
    assert row["high"] == src["high"].max() and row["low"] == src["low"].min()
    assert row["close_time"] == first + pd.Timedelta(hours=4)
    assert row["n_src"] == 120  # market opens 22:00, so only 2 hours of this bar trade


def test_resample_has_no_lookahead():
    """Truncation test: completed bars must not change when later data is removed."""
    m1 = synthetic_m1()
    full = resample_bars(m1, "H1")
    for cut in [m1.index[1000], m1.index[5000], m1.index[-3]]:
        part = resample_bars(m1.loc[:cut], "H1")
        done = part[part["complete"]]
        pd.testing.assert_frame_equal(done, full.loc[done.index, done.columns], check_freq=False)
        assert not part["complete"].iloc[-1] or part["close_time"].iloc[-1] <= cut + M1
