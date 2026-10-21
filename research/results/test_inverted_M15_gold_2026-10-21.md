# Pre-registered test — inverted M15 TDI divergence on gold

Registered in `PREREG_inverted_M15.md` (commit 55e0acb) before the test data was exported.
Test data: XAUUSDmicro M1, 2025-10-01 00:00 – 2026-04-24 00:00 (197,097 candles), entirely before the discovery window.
Test code unchanged since registration.

| | trades | win % | mean R after costs | random-entry mean R | one-sided p | result |
|---|---|---|---|---|---|---|
| Inverted M15 (the hypothesis) | 56 | 30.4 | **−0.092** | +0.012 | 0.706 | **FAIL** |

The +0.434R seen in the discovery window did not repeat: it was chance.

## Extra check: the original method on the same new period (rules fixed in PHASE1_3_gold.md)

| TF | exits | trades | win % | mean R (95% CI) | random | p |
|---|---|---|---|---|---|---|
| M5 | SL/TP 2R | 164 | 37.8 | +0.131 (−0.093 .. +0.354) | −0.020 | 0.102 |
| M5 | EA BE + trail | 212 | 68.9 | +0.064 (−0.054 .. +0.183) | — | — |
| M15 | SL/TP 2R | 56 | 35.7 | +0.063 (−0.316 .. +0.442) | +0.044 | 0.504 |
| M15 | EA BE + trail | 65 | 58.5 | −0.129 (−0.337 .. +0.079) | — | — |
| M30 | SL/TP 2R | 21 | 33.3 | −0.010 (−0.626 .. +0.606) | +0.058 | 0.608 |
| M30 | EA BE + trail | 27 | 59.3 | −0.234 (−0.519 .. +0.050) | — | — |

None significant. M5 was −0.133R in Apr–Oct 2026 and +0.131R in Oct 2025–Apr 2026: across both periods (312 trades)
about 0R per trade. The sign flipping between periods is what noise looks like.
