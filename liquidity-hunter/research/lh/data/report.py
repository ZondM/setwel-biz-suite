"""Command-line data-quality report.

Example:
    python -m lh.data.report --instrument XAUUSD --broker deriv \
        --server-utc-offset 0 --bars ../data/raw/deriv_XAUUSD_M1.csv \
        --ticks ../data/raw/deriv_XAUUSD_TICKS_2025-01.csv --out ../data/reports

Writes a Markdown report and Parquet copies of the parsed data. Exit code 1 if
any ERROR-level finding exists (Gate 2 not passed for that file).
"""
from __future__ import annotations

import argparse
import sys
from datetime import datetime, timezone
from pathlib import Path

from .ingest import ServerTime, file_sha256, read_mt5_bars, read_mt5_ticks
from .resample import TIMEFRAMES
from .validate import Finding, check_bars, check_ticks, compare_ticks_to_bars, has_errors


def _table(findings: list[Finding]) -> str:
    rows = ["| Check | Severity | Count | Detail |", "|---|---|---|---|"]
    for x in findings:
        detail = x.detail.replace("|", "/")
        if x.examples:
            detail += "<br>e.g. " + "; ".join(x.examples[:5])
        rows.append(f"| {x.check} | {x.severity} | {x.count} | {detail} |")
    return "\n".join(rows)


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--instrument", required=True)
    p.add_argument("--broker", required=True)
    tz = p.add_mutually_exclusive_group(required=True)
    tz.add_argument("--server-utc-offset", type=float, help="fixed server offset in hours, e.g. 0")
    tz.add_argument("--server-tz", help="IANA zone if the server follows DST, e.g. Europe/Athens")
    p.add_argument("--bars", type=Path, help="MT5 bar export (any timeframe)")
    p.add_argument("--bars-tf", default="M1", choices=list(TIMEFRAMES))
    p.add_argument("--ticks", type=Path, help="MT5 tick export")
    p.add_argument("--bar-tick-tol", type=float, default=None, help="price tolerance for ticks-vs-bars check (default: none, skip)")
    p.add_argument("--out", type=Path, required=True)
    a = p.parse_args(argv)

    st = ServerTime(fixed_offset_hours=a.server_utc_offset) if a.server_tz is None else ServerTime(iana_zone=a.server_tz)
    a.out.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    lines = [
        f"# Data-quality report — {a.instrument} ({a.broker})",
        "",
        f"Generated {stamp}. Server time mapping: {st}.",
        "",
    ]
    failed = False
    bars = ticks = None

    if a.bars:
        bars = read_mt5_bars(a.bars, st)
        fb = check_bars(bars, TIMEFRAMES[a.bars_tf])
        failed |= has_errors(fb)
        bars.to_parquet(a.out / f"{a.broker}_{a.instrument}_{a.bars_tf}.parquet")
        lines += [f"## Bars ({a.bars_tf})", "", f"File `{a.bars.name}`, sha256 `{file_sha256(a.bars)}`", "", _table(fb), ""]

    if a.ticks:
        ticks = read_mt5_ticks(a.ticks, st)
        ft = check_ticks(ticks)
        failed |= has_errors(ft)
        ticks.to_parquet(a.out / f"{a.broker}_{a.instrument}_ticks_{a.ticks.stem}.parquet")
        lines += ["## Ticks", "", f"File `{a.ticks.name}`, sha256 `{file_sha256(a.ticks)}`", "", _table(ft), ""]

    if bars is not None and ticks is not None and a.bar_tick_tol is not None:
        fc = compare_ticks_to_bars(ticks, bars, TIMEFRAMES[a.bars_tf], a.bar_tick_tol)
        failed |= has_errors(fc)
        lines += ["## Ticks vs bars", "", _table(fc), ""]

    lines += ["## Result", "", "**FAIL** — ERROR findings present; fix or document before use." if failed else "**PASS** — no ERROR findings. Review WARN items."]
    report = a.out / f"{a.broker}_{a.instrument}_data_quality.md"
    report.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(report)
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
