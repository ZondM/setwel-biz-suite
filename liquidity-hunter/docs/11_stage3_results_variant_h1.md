# Stage 3 results — Variant H1 (both models one timeframe higher), development period

Protocol: docs/10 (committed before the run). Reason-code names in the tables keep the original labels: 'H4' = context/trend timeframe (here D1), 'H1' = alignment timeframe (here H4), 'M15' = setup timeframe (here H1).

---

### Stage 3 results — Model A ladder, variant `h1` (development period)

Protocol: docs/10. Code commit: `7dc4204`. Data: `deriv_XAUUSDmicro_M1_2022-11-09_2026-10-21.zip`, 2022-11-09 to 2025-01-01. Timeframes: setup H1, confirm M15, context D1. Instrument: Deriv XAUUSDmicro. Exit: stop at sweep extreme + buffer, 2R target, 4 days 00:00:00 max.

### Results per step (after spread, slippage and swap)

| Step | Candidates | Trades | Mean R | 95% CI | Win rate | Profit factor | Total R | Max DD (R) | Max losing streak |
|---|---|---|---|---|---|---|---|---|---|
| A0 | 72850 | 72729 | -0.053 | [-0.068, -0.038] | 33.2% | 0.92 | -3819.9 | 3838.7 | 36 |
| A | 1482 | 1457 | -0.084 | [-0.151, -0.019] | 32.6% | 0.88 | -122.4 | 128.8 | 19 |
| B | 698 | 692 | -0.097 | [-0.191, -0.004] | 32.2% | 0.86 | -67.4 | 84.2 | 12 |
| C | 55 | 55 | +0.032 | [-0.249, +0.328] | 40.0% | 1.06 | +1.8 | 5.9 | 6 |
| D | 17 | 17 | -0.183 | [-0.746, +0.358] | 35.3% | 0.72 | -3.1 | 5.3 | 5 |
| E | 15 | 15 | -0.146 | [-0.787, +0.439] | 33.3% | 0.78 | -2.2 | 5.1 | 5 |

A0 = random entries (50 per trade of the first real step); its drawdown and streak are not comparable (50x more trades).

### Does each added condition improve the result?

| Comparison | Difference in mean R | One-sided p | Holm significant (α=0.05) | Verdict |
|---|---|---|---|---|
| A vs A0 | -0.032 | 0.814 | no | not shown to add value |
| B vs A | -0.013 | 0.591 | no | not shown to add value |
| C vs B | +0.130 | 0.206 | no | not shown to add value |
| D vs C | -0.216 | 0.758 | no | not shown to add value |
| E vs D | +0.038 | 0.467 | no | not shown to add value |

### Rejections, exits, direction

- **A0**: rejected {'TIME_FILTER': 121}; exits {'STOP': 47437, 'TARGET': 22393, 'TIME': 2856, 'END_OF_DATA': 43}; mean risk $4.40/oz; entry spread = 2.9% of R; by direction {-1.0: {'count': 35844, 'mean': -0.105}, 1.0: {'count': 36885, 'mean': -0.001}}
- **A**: rejected {'TIME_FILTER': 25}; exits {'STOP': 966, 'TARGET': 437, 'TIME': 53, 'END_OF_DATA': 1}; mean risk $4.32/oz; entry spread = 2.8% of R; by direction {-1.0: {'count': 718, 'mean': -0.152}, 1.0: {'count': 739, 'mean': -0.018}}
- **B**: rejected {'TIME_FILTER': 6}; exits {'STOP': 461, 'TARGET': 206, 'TIME': 25}; mean risk $4.64/oz; entry spread = 2.6% of R; by direction {-1.0: {'count': 296, 'mean': -0.152}, 1.0: {'count': 396, 'mean': -0.056}}
- **C**: rejected {}; exits {'STOP': 24, 'TIME': 21, 'TARGET': 10}; mean risk $20.05/oz; entry spread = 0.4% of R; by direction {-1: {'count': 22, 'mean': -0.159}, 1: {'count': 33, 'mean': 0.159}}
- **D**: rejected {}; exits {'STOP': 11, 'TARGET': 4, 'TIME': 2}; mean risk $10.46/oz; entry spread = 0.9% of R; by direction {-1: {'count': 7, 'mean': -0.854}, 1: {'count': 10, 'mean': 0.286}}
- **E**: rejected {}; exits {'STOP': 10, 'TARGET': 4, 'TIME': 1}; mean risk $9.58/oz; entry spread = 0.9% of R; by direction {-1: {'count': 6, 'mean': -1.01}, 1: {'count': 9, 'mean': 0.43}}

### Why candidates failed each condition (all reclaimed sweeps)

- B: {'COUNTER_H4_NON_H4_POOL': 784}
- C: {'SWEEP_EXTREME_RETAKEN': 1095, 'NO_DISPLACEMENT': 270}
- D: {'SWEEP_EXTREME_RETAKEN': 1095, 'NO_DISPLACEMENT': 270, 'EXPIRED': 31, 'MISSED_NO_RETEST': 21, 'INVALID_STOP': 14, 'INVALID_FAR_CLOSE': 8, 'NO_DATA': 1}

---

### Stage 3 results — Model B ladder, variant `h1` (development period)

Protocol: docs/10. Code commit: `7dc4204`. Data: `deriv_XAUUSDmicro_M1_2022-11-09_2026-10-21.zip`, 2022-11-09 to 2025-01-01. Timeframes: setup H1, confirm M15, alignment H4, trend D1. Instrument: Deriv XAUUSDmicro. Exit: stop at H1 protected level + buffer, 2R target, 4 days 00:00:00 max.

### Results per step (after spread, slippage and swap)

| Step | Candidates | Trades | Mean R | 95% CI | Win rate | Profit factor | Total R | Max DD (R) | Max losing streak |
|---|---|---|---|---|---|---|---|---|---|
| B0 | 8000 | 7989 | -0.123 | [-0.258, +0.015] | 33.4% | 0.80 | -984.8 | 1163.2 | 171 |
| B1 | 164 | 160 | -0.084 | [-0.354, +0.176] | 34.4% | 0.87 | -13.5 | 35.0 | 13 |
| B2 | 39 | 38 | -0.065 | [-0.436, +0.296] | 34.2% | 0.89 | -2.5 | 10.2 | 10 |
| B3 | 15 | 15 | -0.064 | [-0.673, +0.633] | 40.0% | 0.89 | -1.0 | 6.0 | 6 |
| B4 | 4 | 4 | -1.016 | [-1.034, -1.005] | 0.0% | 0.00 | -4.1 | 4.1 | 4 |

B0 = random entries (50 per trade of the first real step); its drawdown and streak are not comparable (50x more trades).

### Does each added condition improve the result?

| Comparison | Difference in mean R | One-sided p | Holm significant (α=0.05) | Verdict |
|---|---|---|---|---|
| B1 vs B0 | +0.039 | 0.413 | no | not shown to add value |
| B2 vs B1 | +0.019 | 0.473 | no | not shown to add value |
| B3 vs B2 | +0.001 | 0.505 | no | not shown to add value |
| B4 vs B3 | -0.951 | 1.000 | no | not shown to add value |

### Rejections, exits, direction

- **B0**: rejected {'TIME_FILTER': 11}; exits {'STOP': 4670, 'TARGET': 1800, 'TIME': 1519}; mean risk $13.05/oz; entry spread = 0.8% of R; by direction {-1.0: {'count': 2247, 'mean': -0.162}, 1.0: {'count': 5742, 'mean': -0.108}}
- **B1**: rejected {'TIME_FILTER': 4}; exits {'STOP': 97, 'TARGET': 37, 'TIME': 26}; mean risk $13.05/oz; entry spread = 0.9% of R; by direction {-1.0: {'count': 46, 'mean': -0.031}, 1.0: {'count': 114, 'mean': -0.106}}
- **B2**: rejected {'TIME_FILTER': 1}; exits {'STOP': 21, 'TARGET': 9, 'TIME': 8}; mean risk $13.39/oz; entry spread = 0.8% of R; by direction {-1.0: {'count': 12, 'mean': -0.125}, 1.0: {'count': 26, 'mean': -0.038}}
- **B3**: rejected {}; exits {'STOP': 8, 'TARGET': 4, 'TIME': 3}; mean risk $15.31/oz; entry spread = 0.6% of R; by direction {-1: {'count': 5, 'mean': -0.191}, 1: {'count': 10, 'mean': -0.001}}
- **B4**: rejected {}; exits {'STOP': 4}; mean risk $8.69/oz; entry spread = 0.7% of R; by direction {-1: {'count': 1, 'mean': -1.004}, 1: {'count': 3, 'mean': -1.019}}

### Why candidates failed each condition (all M15 breaks)

- B1: {'H4_NOT_TRENDING': 631, 'M15_AGAINST_H4': 270, 'H1_NOT_ALIGNED': 115}
- B2: {'H4_NOT_TRENDING': 631, 'M15_AGAINST_H4': 270, 'H1_NOT_ALIGNED': 115, 'NOT_A_PULLBACK_CHOCH': 96, 'RETRACEMENT_OUT_OF_RANGE': 18, 'H1_LEG_BROKEN': 11}
- B3: {'H4_NOT_TRENDING': 631, 'M15_AGAINST_H4': 270, 'H1_NOT_ALIGNED': 115, 'NOT_A_PULLBACK_CHOCH': 96, 'NO_DISPLACEMENT': 22, 'RETRACEMENT_OUT_OF_RANGE': 18, 'H1_LEG_BROKEN': 11, 'STOP_TRADED': 2}
- B4: {'H4_NOT_TRENDING': 631, 'M15_AGAINST_H4': 270, 'H1_NOT_ALIGNED': 115, 'NOT_A_PULLBACK_CHOCH': 96, 'NO_DISPLACEMENT': 22, 'RETRACEMENT_OUT_OF_RANGE': 18, 'H1_LEG_BROKEN': 11, 'INVALID_STOP': 4, 'MISSED_NO_RETEST': 4, 'EXPIRED': 3, 'STOP_TRADED': 2}
- Retracement of B1 CHoCH candidates: median 0.66, p10 0.38, p90 1.02

---

## Summary

| Model | Best-looking step | Trades | Mean R | 95% CI | Any step significant? |
|---|---|---|---|---|---|
| A (reversal) on H1 | C | 55 | +0.03 | −0.25 to +0.33 | No (0 of 5) |
| B (continuation) on H1 | B2/B3 | 38 / 15 | −0.07 / −0.06 | wide, includes 0 | No (0 of 4) |

- Moving up one timeframe made spread a much smaller share of risk (0.4–3% of R instead of 2–6%), as intended. Results did **not** improve: step A is now slightly **worse** than random entries, and Model B is negative at every step.
- Samples at the final steps are tiny (A-D: 17, B4: 4 trades in 26 months).

## Conclusion

**Variant H1 fails on development data. 0 of 9 comparisons significant (18 of 18 across all pre-registered tests).**

As stated in the protocol, the research conclusion now stands: **the liquidity-hunter rules, as specified, show no edge on Deriv gold 2022-11 → 2024-12, at either M15 or H1.** No further variants will be tested on this development data. The 2025 and 2026 data remain unopened.
