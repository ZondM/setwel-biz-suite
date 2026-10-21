# Data-quality report — XAUUSDmicro (deriv)

Generated 2026-10-21T21:01:07Z. Server time mapping: ServerTime(fixed_offset_hours=0.0, iana_zone=None).

## Bars (M1)

File `deriv_XAUUSDmicro_TICKS_2026-09.csv`, sha256 `383e32c9c02dce3f584d50623a3e07d02a5f84d841cd8c12237faa2018f5c6e0`

| Check | Severity | Count | Detail |
|---|---|---|---|
| rows | INFO | 1393281 | 2022-11-09 15:05:00+00:00 -> 2026-10-21 20:58:00+00:00 |
| duplicate_timestamps | INFO | 0 | same bar time appears more than once |
| non_increasing_time | INFO | 0 | bar time not strictly increasing |
| off_grid_timestamps | INFO | 0 | bar time not aligned to 0 days 00:01:00 |
| missing_prices | INFO | 0 | NaN in OHLC |
| non_positive_prices | INFO | 0 | price <= 0 |
| invalid_ohlc | INFO | 0 | low <= min(open,close) <= max(open,close) <= high violated |
| zero_range_bars | INFO | 504 | high == low (often illiquid minutes)<br>e.g. 2022-11-14 21:11:00+00:00; 2022-11-16 23:18:00+00:00; 2022-11-18 21:14:00+00:00; 2022-11-21 23:07:00+00:00; 2022-11-22 21:13:00+00:00 |
| negative_spread | INFO | 0 | spread < 0 |
| zero_spread | WARN | 80287 | 5.76% of bars report spread 0<br>e.g. 2023-03-16 15:08:00+00:00; 2023-04-25 14:02:00+00:00; 2023-04-25 14:03:00+00:00; 2023-05-03 22:00:00+00:00; 2023-06-02 08:36:00+00:00 |
| spread_points_quantiles | INFO | 1393281 | median 10, p95 17, p99.9 58, max 2002 |
| gaps_weekend | INFO | 206 | gaps spanning Saturday (expected) |
| gaps_daily_break | INFO | 843 | gaps <= 0 days 01:15:00 (expected daily break / thin minutes) |
| gaps_unexplained | WARN | 31 | gaps that are neither weekend nor short daily break (holidays, outages, missing data)<br>e.g. 2024-12-24 18:30:00+00:00 -> 2024-12-25 23:01:00+00:00 (1 days 04:31:00); 2025-12-24 18:44:00+00:00 -> 2025-12-25 23:01:00+00:00 (1 days 04:17:00); 2025-12-31 21:58:00+00:00 -> 2026-01-01 23:01:00+00:00 (1 days 01:03:00); 2024-12-31 21:58:00+00:00 -> 2025-01-01 23:01:00+00:00 (1 days 01:03:00); 2026-09-07 18:29:00+00:00 -> 2026-09-08 00:00:00+00:00 (0 days 05:31:00) |
| weekly_open_alignment | INFO | 0 | 206 weekly opens; NY-hour distribution {18: 203, 19: 3}; 0 outside 16:00-19:59 NY (check server offset / DST, or holidays) |

## Result

**PASS** — no ERROR findings. Review WARN items.
