# Tick data — Deriv XAUUSDmicro, September 2026

**Files** (`data/raw/`): `deriv_XAUUSDmicro_TICKS_2026-09_w1..w4.zip` (sha256 prefixes 3c9a7c0b, 605a2ce2, d68dc2f5, 14c0c2b2).
**Ticks:** 9,388,472. Bid/ask format, server time = UTC.

## Integrity: PASS

| Check | Result |
|---|---|
| Time order, duplicates, crossed quotes (bid > ask), zero/negative prices | 0 problems |
| Ticks vs M1 bars | **100%** of 24,507 overlapping minutes match the bar file (bid OHLC within $0.005). Bars are built from bid. Bar and tick data are consistent. |
| "Price spikes" (WARN, 9,647) | Statistical flag only. Largest moves are US data releases at 12:30 UTC (e.g. +$10.46 in one tick on 3 Sep), which are real. No bad prints found. |

## Coverage gap (export quirk)

Each weekly file starts at **22:05 UTC on the "From" date**, so that day's main session is missing:
1, 8, 16 and 24 September (about 18% of the month's minutes). The other ~82% is complete.
**For future exports: set "From" one day earlier** than the first day needed.

## Spread (points; 1 point = $0.01)

| Statistic | Value |
|---|---|
| Median | 15 ($0.15) |
| 75th / 95th / 99th percentile | 17 / 21 / 50 |
| Max | 897 ($8.97) |

By UTC hour (median / p95):
- 06:00–19:59 (London + New York): **15 / 15–17**
- 12:00–13:59 (US data releases): median 15, **p95 50**
- 00:00–05:59 (Asia): 17 / 18
- 20:00–20:59 and 22:00–22:59 (around the daily break): **30–46 / 58**

## Bar spread vs real spread

- The spread stored in each M1 bar equals the **lowest** tick spread in that minute (99.996% of minutes).
- Spread at the first tick of a minute (what a market entry at bar open pays) minus bar spread: median 0, p75 +2, p95 +4, p99 +15 points; mean +1.2.

## Cost model adopted for research (Deriv XAUUSDmicro)

| Item | Rule |
|---|---|
| Base spread at entry/exit | bar spread **+ 2 points** (covers ~90% of minutes) |
| Stress test | bar spread + 4 points, and + 15 points |
| Stop-loss exit slippage | +1× median spread beyond the stop (pessimistic until demo fills are measured) |
| Entry filter | no new entries 20:00–23:00 UTC (daily break), as already planned |
| Commission | $0 (confirmed by user) |
| Swap | from spec file, applied per night held |

Limitation: one month of ticks. Spreads changed a lot over 2022–2026 (bar medians 5 → 15 points), so the "+2 points" adjustment is measured on 2026 only and is assumed for earlier years.
