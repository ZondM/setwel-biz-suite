# Phase 0 report — is there anything to predict?

Per-test significance level 0.01. Every row is a separate symbol and timeframe.

## Summary

| Symbol | Verdict |
|---|---|
| XAUUSDmicro | Statistically detectable structure (M1, M5, M15), but too small to beat the spread — no tradable edge expected. |

## XAUUSDmicro

Broker description: *Gold vs US Dollar micro (1 lot=1 unit)*

M1 bars: 174,599 from 2026-04-24 12:23:00 to 2026-10-21 12:22:00

| TF | n | lag-1 autocorr (95% band) | Ljung-Box p | VR(2) p | VR(5) p | VR(10) p | runs p | Hurst | best edge/bar vs spread |
|---|---|---|---|---|---|---|---|---|---|
| M1 | 174,598 | -0.0223 (±0.0047) | <0.0001 | 0.978 / <0.0001 | 0.958 / 0.0002 | 0.948 / 0.0016 | <0.0001 | 0.490 | 0.024695 vs 0.27 |
| M5 | 34,944 | -0.0174 (±0.0105) | 0.0026 | 0.983 / 0.0530 | 0.974 / 0.1629 | 0.965 / 0.2114 | <0.0001 | 0.496 | 0.043087 vs 0.27 |
| M15 | 11,692 | -0.0265 (±0.0181) | 0.0041 | 0.974 / 0.0681 | 0.952 / 0.1226 | 0.964 / 0.4378 | 0.0049 | 0.492 | 0.11511 vs 0.27 |

Ticks: 2,720,474. Tick-to-tick lag-1 autocorrelation: -0.0276 (95% band ±0.0012).

**Verdict:** Statistically detectable structure (M1, M5, M15), but too small to beat the spread — no tradable edge expected.
