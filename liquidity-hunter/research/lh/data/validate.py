"""Data-integrity checks for bars and ticks (Master Prompt Phase 2.2).

Every check returns findings; nothing is silently fixed. Callers decide what
to drop or repair, and that decision is recorded in the data-quality report.
"""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
import pandas as pd

ERROR = "ERROR"
WARN = "WARN"
INFO = "INFO"


@dataclass
class Finding:
    check: str
    severity: str
    count: int
    detail: str
    examples: list[str] = field(default_factory=list)


@dataclass
class GapPolicy:
    """Which gaps between bars are expected.

    weekend: any gap that spans Saturday (UTC).
    daily_break_max: gaps up to this length are treated as the instrument's
    daily maintenance break (e.g. ~60 min for XAUUSD).
    """

    daily_break_max: pd.Timedelta = pd.Timedelta(minutes=75)
    expected_weekly_open_ny_hours: tuple[int, int] = (16, 19)


def _examples(index: pd.Index, n: int = 5) -> list[str]:
    return [str(x) for x in list(index[:n])]


def check_bars(bars: pd.DataFrame, freq: pd.Timedelta, policy: GapPolicy | None = None) -> list[Finding]:
    policy = policy or GapPolicy()
    f: list[Finding] = []
    idx = bars.index

    f.append(Finding("rows", INFO, len(bars), f"{idx.min()} -> {idx.max()}" if len(bars) else "empty"))
    if len(bars) == 0:
        f.append(Finding("empty", ERROR, 0, "no bars"))
        return f

    dup = idx[idx.duplicated()]
    f.append(Finding("duplicate_timestamps", ERROR if len(dup) else INFO, len(dup), "same bar time appears more than once", _examples(dup)))

    diffs = pd.Series(idx[1:] - idx[:-1], index=idx[1:])
    back = diffs[diffs <= pd.Timedelta(0)]
    f.append(Finding("non_increasing_time", ERROR if len(back) else INFO, len(back), "bar time not strictly increasing", _examples(back.index)))

    off_grid = idx[(idx - idx.normalize()) % freq != pd.Timedelta(0)]
    f.append(Finding("off_grid_timestamps", ERROR if len(off_grid) else INFO, len(off_grid), f"bar time not aligned to {freq}", _examples(off_grid)))

    o, h, l, c = bars["open"], bars["high"], bars["low"], bars["close"]
    nan_rows = bars[["open", "high", "low", "close"]].isna().any(axis=1)
    f.append(Finding("missing_prices", ERROR if nan_rows.any() else INFO, int(nan_rows.sum()), "NaN in OHLC", _examples(idx[nan_rows])))
    nonpos = (bars[["open", "high", "low", "close"]] <= 0).any(axis=1)
    f.append(Finding("non_positive_prices", ERROR if nonpos.any() else INFO, int(nonpos.sum()), "price <= 0", _examples(idx[nonpos])))
    bad = (l > np.minimum(o, c)) | (h < np.maximum(o, c)) | (l > h)
    f.append(Finding("invalid_ohlc", ERROR if bad.any() else INFO, int(bad.sum()), "low <= min(open,close) <= max(open,close) <= high violated", _examples(idx[bad])))
    flat = (h == l)
    f.append(Finding("zero_range_bars", INFO, int(flat.sum()), "high == low (often illiquid minutes)", _examples(idx[flat])))

    if "spread" in bars and bars["spread"].notna().any():
        sp = bars["spread"]
        neg = sp < 0
        f.append(Finding("negative_spread", ERROR if neg.any() else INFO, int(neg.sum()), "spread < 0", _examples(idx[neg])))
        zero = sp == 0
        f.append(Finding("zero_spread", WARN if zero.mean() > 0.01 else INFO, int(zero.sum()), f"{zero.mean():.2%} of bars report spread 0", _examples(idx[zero])))
        q = sp.quantile([0.5, 0.95, 0.999])
        f.append(Finding("spread_points_quantiles", INFO, len(sp), f"median {q[0.5]:g}, p95 {q[0.95]:g}, p99.9 {q[0.999]:g}, max {sp.max():g}"))
    else:
        f.append(Finding("spread_column", WARN, 0, "no spread data in bars; costs must come from ticks or assumptions"))

    gaps = diffs[diffs > freq]
    spans_weekend = _spans_saturday(gaps.index - gaps.to_numpy(), gaps.index)
    daily = (~spans_weekend) & (gaps <= policy.daily_break_max)
    other = gaps[(~spans_weekend) & (~daily)]
    f.append(Finding("gaps_weekend", INFO, int(spans_weekend.sum()), "gaps spanning Saturday (expected)"))
    f.append(Finding("gaps_daily_break", INFO, int(daily.sum()), f"gaps <= {policy.daily_break_max} (expected daily break / thin minutes)"))
    f.append(Finding(
        "gaps_unexplained", WARN if len(other) else INFO, len(other),
        "gaps that are neither weekend nor short daily break (holidays, outages, missing data)",
        [f"{end - d} -> {end} ({d})" for end, d in other.sort_values(ascending=False).head(10).items()],
    ))

    f.extend(check_weekly_open_alignment(idx, policy))
    return f


def _spans_saturday(start: pd.DatetimeIndex, end: pd.DatetimeIndex) -> pd.Series:
    """True where the calendar days from start to end (UTC) include a Saturday."""
    days_between = (end.normalize() - start.normalize()).days
    days_to_saturday = (5 - start.dayofweek) % 7
    return pd.Series(days_between >= days_to_saturday, index=end, dtype=bool)


def check_weekly_open_alignment(idx: pd.DatetimeIndex, policy: GapPolicy) -> list[Finding]:
    """Timezone/DST sanity check.

    FX and gold reopen around 17:00 New York time on Sunday. If server time was
    converted to UTC correctly, the first bar after each weekend gap should sit
    near that hour in New York time all year round. A wrong offset or a missed
    DST rule shows up as weeks outside the expected window.
    """
    if len(idx) < 2:
        return []
    diffs = pd.Series(idx[1:] - idx[:-1], index=idx[1:])
    week_opens = diffs[diffs >= pd.Timedelta(hours=36)].index
    if len(week_opens) == 0:
        return [Finding("weekly_open_alignment", WARN, 0, "no weekend gaps found; cannot check timezone")]
    ny = week_opens.tz_convert("America/New_York")
    lo, hi = policy.expected_weekly_open_ny_hours
    outside = week_opens[(ny.hour < lo) | (ny.hour > hi)]
    hours = pd.Series(ny.hour).value_counts().sort_index()
    return [Finding(
        "weekly_open_alignment", ERROR if len(outside) > 0.1 * len(week_opens) else (WARN if len(outside) else INFO),
        len(outside),
        f"{len(week_opens)} weekly opens; NY-hour distribution {hours.to_dict()}; "
        f"{len(outside)} outside {lo}:00-{hi}:59 NY (check server offset / DST, or holidays)",
        _examples(outside),
    )]


def check_ticks(ticks: pd.DataFrame, spike_mad_k: float = 20.0) -> list[Finding]:
    f: list[Finding] = []
    idx = ticks.index
    f.append(Finding("rows", INFO, len(ticks), f"{idx.min()} -> {idx.max()}" if len(ticks) else "empty"))
    if len(ticks) == 0:
        f.append(Finding("empty", ERROR, 0, "no ticks"))
        return f

    back = idx[1:][(idx[1:] - idx[:-1]) < pd.Timedelta(0)]
    f.append(Finding("time_goes_backwards", ERROR if len(back) else INFO, len(back), "tick time decreases", _examples(back)))

    exact_dup = ticks.reset_index().duplicated().to_numpy()
    f.append(Finding("duplicate_rows", WARN if exact_dup.any() else INFO, int(exact_dup.sum()), "identical consecutive rows (time, prices, flags)"))

    crossed = ticks["bid"] > ticks["ask"]
    f.append(Finding("crossed_quotes", ERROR if crossed.any() else INFO, int(crossed.sum()), "bid > ask", _examples(idx[crossed])))
    locked = ticks["bid"] == ticks["ask"]
    f.append(Finding("zero_spread_ticks", WARN if locked.mean() > 0.01 else INFO, int(locked.sum()), f"{locked.mean():.2%} of ticks bid == ask"))
    nonpos = (ticks[["bid", "ask"]] <= 0).any(axis=1)
    f.append(Finding("non_positive_prices", ERROR if nonpos.any() else INFO, int(nonpos.sum()), "bid or ask <= 0", _examples(idx[nonpos])))

    spread = ticks["ask"] - ticks["bid"]
    q = spread.quantile([0.5, 0.95, 0.999])
    f.append(Finding("spread_price_quantiles", INFO, len(spread), f"median {q[0.5]:g}, p95 {q[0.95]:g}, p99.9 {q[0.999]:g}, max {spread.max():g}"))

    mid = (ticks["bid"] + ticks["ask"]) / 2
    r = np.log(mid).diff().dropna()
    if len(r) > 10:
        mad = (r - r.median()).abs().median()
        if mad > 0:
            spikes = r[(r - r.median()).abs() > spike_mad_k * mad]
            f.append(Finding("price_spikes", WARN if len(spikes) else INFO, len(spikes), f"|log return| > {spike_mad_k} x MAD; inspect before use", _examples(spikes.index)))
    return f


def compare_ticks_to_bars(ticks: pd.DataFrame, bars: pd.DataFrame, freq: pd.Timedelta, tol: float) -> list[Finding]:
    """Rebuild bid bars from ticks and compare with the broker's bar export.

    MT5 bars are built from bid prices. A high mismatch rate means the two files
    are not from the same feed, or the time conversion differs between them.
    """
    rebuilt = ticks["bid"].resample(freq, label="left", closed="left").ohlc().dropna()
    common = rebuilt.index.intersection(bars.index)
    if len(common) == 0:
        return [Finding("ticks_vs_bars", WARN, 0, "no overlapping period")]
    a, b = rebuilt.loc[common], bars.loc[common, ["open", "high", "low", "close"]]
    mism = ((a - b).abs() > tol).any(axis=1)
    rate = mism.mean()
    return [Finding(
        "ticks_vs_bars", ERROR if rate > 0.05 else (WARN if rate > 0.005 else INFO), int(mism.sum()),
        f"{rate:.2%} of {len(common)} overlapping bars differ by more than {tol:g}",
        _examples(common[mism.to_numpy()]),
    )]


def has_errors(findings: list[Finding]) -> bool:
    return any(x.severity == ERROR for x in findings)
