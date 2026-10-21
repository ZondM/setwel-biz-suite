# Data-quality summary — Deriv XAUUSD / XAUUSDmicro M1 bars

**Received:** 2026-10-21. **Code:** `lh.data` at the commit that adds this file.
**Files** (stored in `data/raw/`; the user's file names said "TICKS_2026-09", but the content is **M1 bars** for the full history):

| Stored as | Inner CSV | Zip sha256 |
|---|---|---|
| `deriv_XAUUSD_M1_2022-11-09_2026-10-21.zip` | `deriv_XAUUSD_TICKS_2026-09.csv` | `9a99f345…63f6` |
| `deriv_XAUUSDmicro_M1_2022-11-09_2026-10-21.zip` | `deriv_XAUUSDmicro_TICKS_2026-09.csv` | `a3c0c4d0…ac19` |

Full check tables: `data/reports/deriv_XAUUSD_data_quality.md`, `data/reports/deriv_XAUUSDmicro_data_quality.md`.

## Result: PASS (no ERROR findings)

| Check | Result |
|---|---|
| Period | 2022-11-09 15:05 → 2026-10-21 20:53/20:58 UTC, ~1.39 M bars each |
| Duplicates, ordering, OHLC validity, missing prices | 0 problems |
| Timezone | Server = UTC confirmed. All 206 weekly opens fall at 18:xx New York time in both summer and winter, so DST is handled consistently. The daily break follows New York time (≈21:00–22:00 UTC in summer, 22:00–23:00 UTC in winter). |
| Weekend gaps | 206, expected |
| Short gaps (≤ 75 min) | 843: daily break and thin minutes |
| Other gaps | 31, **all US holidays** (early closes / closed days: MLK, Presidents', Memorial, Juneteenth, July 4, Labor Day, Thanksgiving, Christmas, New Year) plus 13–14 Mar 2023 (2-hour break during the US/EU DST mismatch week). **No unexplained outages.** |
| Zero-range bars | 504 (thin minutes near the daily break), kept |
| Zero spread | 5.8% of bars report spread 0 (WARN). Bar spread is not a reliable cost measure; see below. |

## XAUUSD vs XAUUSDmicro

- Same 1,393,276 timestamps (micro has 5 extra bars only because it was exported a few minutes later).
- OHLC identical in 99.87% of bars. Differences occur only in **June–July 2025** (1,815 bars: micro bid ~$0.03–0.04 lower, spread ~5 points wider) plus 3 bars in Aug 2025 and the bar still forming at export.
- **Conclusion:** both symbols use the same price feed. Research uses **XAUUSDmicro** bars (the live symbol); the result would be practically identical on XAUUSD.

## Spread (points; 1 point = $0.01)

| Year | Median | p95 | Max |
|---|---|---|---|
| 2022 | 5 | 18 | 114 |
| 2023 | 5 | 16 | 511 |
| 2024 | 7 | 15 | 533 |
| 2025 | 12 | 17 | 2002 |
| 2026 | 15 | 28 | 1284 |

Spreads tripled from 2022 to 2026. The cost model must use the spread of each period, not a single average.

**Limitation:** the spread stored in MT5 bars is not the spread at every moment of the minute (it may be the lowest value in the bar), so these figures may **understate** real trading costs. Tick data (bid/ask) is still needed to measure costs properly. Until then, the research will add a pessimistic spread assumption and report it.

## Other notes

- Gold went from ~$1,715 to ~$4,140 in this period. All thresholds are in ATR units so they scale with price and volatility.
- Ticks were not received. Requested: one recent month of XAUUSDmicro ticks (Ticks tab, not Bars).
