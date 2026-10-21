# Stage 3 results — Model A (liquidity reversal), development period

Protocol: docs/06 (committed before this run). Code: first run on the working tree over `e41ec85` (code committed as `b34e1c4`); re-run after the refactor at `9a9baed` with identical results. Data: `deriv_XAUUSDmicro_M1_2022-11-09_2026-10-21.zip`, 2022-11-09 to 2025-01-01. Instrument: Deriv XAUUSDmicro. Exit: stop at sweep extreme + buffer, 2R target, 24 h max.

## Results per step (after spread, slippage and swap)

| Step | Candidates | Trades | Mean R | 95% CI | Win rate | Profit factor | Total R | Max DD (R) | Max losing streak |
|---|---|---|---|---|---|---|---|---|---|
| A0 | 79000 | 78720 | -0.100 | [-0.114, -0.087] | 32.0% | 0.86 | -7910.6 | 7915.5 | 32 |
| A | 1597 | 1580 | -0.088 | [-0.159, -0.013] | 32.2% | 0.88 | -138.3 | 153.4 | 18 |
| B | 749 | 743 | -0.067 | [-0.173, +0.044] | 32.8% | 0.90 | -49.7 | 71.8 | 13 |
| C | 51 | 51 | +0.027 | [-0.343, +0.393] | 37.3% | 1.04 | +1.4 | 9.9 | 9 |
| D | 17 | 17 | +0.227 | [-0.475, +0.941] | 41.2% | 1.38 | +3.9 | 5.1 | 5 |
| E | 16 | 16 | +0.115 | [-0.558, +0.868] | 37.5% | 1.18 | +1.8 | 5.1 | 5 |

A0 = random entries (50 per step-A trade); its Max DD / streak figures are not comparable because it has 50x more trades.

## Does each added condition improve the result?

| Comparison | Difference in mean R | One-sided p | Holm significant (α=0.05) | Verdict |
|---|---|---|---|---|
| A vs A0 | +0.013 | 0.366 | no | not shown to add value |
| B vs A | +0.021 | 0.381 | no | not shown to add value |
| C vs B | +0.093 | 0.324 | no | not shown to add value |
| D vs C | +0.201 | 0.313 | no | not shown to add value |
| E vs D | -0.112 | 0.586 | no | not shown to add value |

## Rejections and exits

- **A0**: rejected {'STOP_TOO_TIGHT': 256, 'TIME_FILTER': 24}; exits {'STOP': 52724, 'TARGET': 23970, 'TIME': 1998, 'END_OF_DATA': 28}; mean risk $2.40/oz; entry spread = 5.8% of R
- **A**: rejected {'TIME_FILTER': 13, 'STOP_TOO_TIGHT': 3, 'STOP_BEYOND_ENTRY': 1}; exits {'STOP': 1066, 'TARGET': 490, 'TIME': 23, 'END_OF_DATA': 1}; mean risk $2.43/oz; entry spread = 5.5% of R
- **B**: rejected {'TIME_FILTER': 4, 'STOP_TOO_TIGHT': 1, 'STOP_BEYOND_ENTRY': 1}; exits {'STOP': 497, 'TARGET': 233, 'TIME': 13}; mean risk $2.63/oz; entry spread = 5.3% of R
- **C**: rejected {}; exits {'STOP': 28, 'TARGET': 14, 'TIME': 9}; mean risk $11.34/oz; entry spread = 0.8% of R
- **D**: rejected {}; exits {'STOP': 9, 'TARGET': 7, 'TIME': 1}; mean risk $5.49/oz; entry spread = 2.0% of R
- **E**: rejected {}; exits {'STOP': 9, 'TARGET': 6, 'TIME': 1}; mean risk $5.06/oz; entry spread = 2.1% of R

## Why candidates failed each condition (all reclaimed sweeps)

- B: {'COUNTER_H4_NON_H4_POOL': 848}
- C: {'SWEEP_EXTREME_RETAKEN': 1178, 'NO_DISPLACEMENT': 310}
- D: {'SWEEP_EXTREME_RETAKEN': 1178, 'NO_DISPLACEMENT': 310, 'MISSED_NO_RETEST': 25, 'EXPIRED': 20, 'INVALID_STOP': 14, 'INVALID_FAR_CLOSE': 8}

## Additional checks (descriptive, not part of the pre-registered tests)

- Before costs, step A averages about **+0.02R** per trade. Spread and slippage cost about 0.11R. In other words: no meaningful edge even before costs.
- Step A is no better than random entries (A0) with the same stop size and exits.
- Steps C–E look positive, but with **51, 17 and 16 trades in 26 months** the confidence intervals run from about −0.5R to +0.9R. They cannot be told apart from zero.
- In C and D, longs did better than shorts (D: +0.70R on 7 longs vs −0.10R on 10 shorts). Gold rose strongly in 2023–2024, so this is most likely the trend, not the setup. Not tested further: it would be a new hypothesis picked after seeing the data.
- 74% of reclaimed sweeps were followed by price going back beyond the sweep extreme within 3 hours, before any displacement. That is the main reason so few setups reach step C.
- The consolidation filter (E) barely filters: 75% of all sweeps had an "active consolidation" in the 8 bars before. The v0.4 definition (8 bars within 2.5 ATR) is too loose to be a meaningful condition. Noted, not changed.
- 3 of the 17 step-D trades had stops wider than $9.60. They could not be taken on the $200 account at 0.5% risk.

## Conclusion (development data)

**Model A, as specified, shows no evidence of an edge on Deriv gold, 2022-11 → 2024-12.** No added condition passed the pre-registered test. Under the protocol, no Model A variant moves to validation (2025).

This is a result, not a failure of the project. It does **not** prove the idea can never work. It shows that these exact rules, on this data, did not beat random entries after costs, and that the full setup is too rare on M15 to judge.

Any new version (for example a different setup timeframe or swing size) is a **new hypothesis**: it needs its own written protocol before it is run, and it adds to the multiple-testing count.
