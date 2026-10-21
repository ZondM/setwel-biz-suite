# Stage 3 results — Model B (trend continuation), development period

Protocol: docs/08. Code commit: `9a9baed`. Data: `deriv_XAUUSDmicro_M1_2022-11-09_2026-10-21.zip`, 2022-11-09 to 2025-01-01. Instrument: Deriv XAUUSDmicro. Exit: stop at M15 protected level + buffer, 2R target, 24 h max.

## Results per step (after spread, slippage and swap)

| Step | Candidates | Trades | Mean R | 95% CI | Win rate | Profit factor | Total R | Max DD (R) | Max losing streak |
|---|---|---|---|---|---|---|---|---|---|
| B0 | 39750 | 39731 | +0.030 | [-0.066, +0.120] | 37.2% | 1.05 | +1196.3 | 1189.3 | 244 |
| B1 | 822 | 795 | -0.015 | [-0.161, +0.119] | 35.5% | 0.98 | -12.1 | 52.9 | 24 |
| B2 | 155 | 152 | +0.028 | [-0.210, +0.274] | 36.8% | 1.04 | +4.3 | 15.5 | 10 |
| B3 | 49 | 48 | +0.028 | [-0.337, +0.386] | 37.5% | 1.04 | +1.3 | 9.3 | 8 |
| B4 | 17 | 17 | +0.046 | [-0.663, +0.756] | 35.3% | 1.07 | +0.8 | 4.1 | 4 |

B0 = random entries (50 per trade of the first real step); its drawdown and streak are not comparable (50x more trades).

## Does each added condition improve the result?

| Comparison | Difference in mean R | One-sided p | Holm significant (α=0.05) | Verdict |
|---|---|---|---|---|
| B1 vs B0 | -0.045 | 0.704 | no | not shown to add value |
| B2 vs B1 | +0.043 | 0.371 | no | not shown to add value |
| B3 vs B2 | -0.000 | 0.504 | no | not shown to add value |
| B4 vs B3 | +0.018 | 0.494 | no | not shown to add value |

## Rejections, exits, direction

- **B0**: rejected {'TIME_FILTER': 19}; exits {'STOP': 23345, 'TARGET': 12039, 'TIME': 4319, 'END_OF_DATA': 28}; mean risk $6.02/oz; entry spread = 2.0% of R; by direction {-1.0: {'count': 15845, 'mean': -0.006}, 1.0: {'count': 23886, 'mean': 0.054}}
- **B1**: rejected {'TIME_FILTER': 27}; exits {'STOP': 477, 'TARGET': 226, 'TIME': 92}; mean risk $6.09/oz; entry spread = 2.0% of R; by direction {-1.0: {'count': 286, 'mean': 0.034}, 1.0: {'count': 509, 'mean': -0.043}}
- **B2**: rejected {'TIME_FILTER': 3}; exits {'STOP': 95, 'TARGET': 47, 'TIME': 10}; mean risk $6.38/oz; entry spread = 2.0% of R; by direction {-1.0: {'count': 55, 'mean': -0.043}, 1.0: {'count': 97, 'mean': 0.069}}
- **B3**: rejected {'TIME_FILTER': 1}; exits {'STOP': 30, 'TARGET': 13, 'TIME': 5}; mean risk $8.21/oz; entry spread = 1.3% of R; by direction {-1.0: {'count': 18, 'mean': -0.174}, 1.0: {'count': 30, 'mean': 0.149}}
- **B4**: rejected {}; exits {'STOP': 11, 'TARGET': 6}; mean risk $3.72/oz; entry spread = 2.2% of R; by direction {-1: {'count': 7, 'mean': 1.139}, 1: {'count': 10, 'mean': -0.72}}

## Why candidates failed each condition (all M15 breaks)

- B1: {'H4_NOT_TRENDING': 2123, 'M15_AGAINST_H4': 1124, 'H1_NOT_ALIGNED': 448}
- B2: {'H4_NOT_TRENDING': 2123, 'M15_AGAINST_H4': 1124, 'NOT_A_PULLBACK_CHOCH': 522, 'H1_NOT_ALIGNED': 448, 'RETRACEMENT_OUT_OF_RANGE': 96, 'H1_LEG_BROKEN': 49}
- B3: {'H4_NOT_TRENDING': 2123, 'M15_AGAINST_H4': 1124, 'NOT_A_PULLBACK_CHOCH': 522, 'H1_NOT_ALIGNED': 448, 'RETRACEMENT_OUT_OF_RANGE': 96, 'NO_DISPLACEMENT': 96, 'H1_LEG_BROKEN': 49, 'STOP_TRADED': 10}
- B4: {'H4_NOT_TRENDING': 2123, 'M15_AGAINST_H4': 1124, 'NOT_A_PULLBACK_CHOCH': 522, 'H1_NOT_ALIGNED': 448, 'RETRACEMENT_OUT_OF_RANGE': 96, 'NO_DISPLACEMENT': 96, 'H1_LEG_BROKEN': 49, 'MISSED_NO_RETEST': 18, 'STOP_TRADED': 10, 'INVALID_STOP': 6, 'EXPIRED': 6, 'INVALID_FAR_CLOSE': 2}
- Retracement of B1 CHoCH candidates: median 0.62, p10 0.28, p90 1.10

## Additional checks (descriptive, not part of the pre-registered tests)

- **B0 (random entries in the H4 trend direction) averaged +0.03R**, mostly from longs (+0.05R) during gold's 2023–2024 rise. Its confidence interval includes zero.
- **B1 (the trend-aligned M15 break) did slightly worse than random trend entries** (−0.015R vs +0.030R). The structure break adds nothing to simply trading the H4 trend.
- Pullback, displacement and retest each changed the average by less than 0.05R, with ever smaller samples (152 → 48 → 17 trades). None is distinguishable from zero.
- B4's direction split (shorts +1.14R on 7 trades, longs −0.72R on 10) is noise at this sample size.
- Stops are wide: about $6/oz on average (B1–B3). With the $200 account, many of these trades would exceed the $9.60 maximum stop.

## Conclusion (development data)

**Model B, as specified, shows no evidence of an edge on Deriv gold, 2022-11 → 2024-12.** No added condition passed the pre-registered test. No Model B variant moves to validation.

## Both models together

Across the 9 pre-registered comparisons (5 for Model A, 4 for Model B), none was significant. Neither the reversal nor the continuation idea, in the form specified, beat random entries after realistic costs on 26 months of Deriv gold data. Validation (2025) and final-test (2026) data remain unopened.
