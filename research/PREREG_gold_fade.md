# Pre-registration — "fade the big candle" on gold (XAUUSDmicro)

Registered 2026-10-21 BEFORE any mean-reversion rule was run on any gold data.
Basis: Phase 0 (Apr–Oct 2026) found negative autocorrelation and variance ratios < 1 on M1–M15 (gold bounces back slightly).

## Rule family
- Bars: M5 or M15 built from M1 bid candles. ATR = simple average true range, 14 bars.
- Signal at the close of bar t: move z = (close[t] − close[t−1]) / ATR[t−1].
  z ≥ +k → SELL, z ≤ −k → BUY (fade the move). Entry at the open of bar t+1 (ask for buys, bid for sells) + 0.05 slippage.
- Exit: after H bars at that bar's open (market, + 0.05 slippage), or earlier at a protective stop 2 × ATR[t] from entry
  (checked on M1, stop first, fills at the worse of stop or candle open − 0.05). One position at a time. Swap −45/+20 points per night, triple Wednesday.
- R = result / stop distance.

## Grid (12 settings, fixed now)
TF {M5, M15} × k {1.5, 2.0, 2.5} × H {3, 6} bars.

## Procedure
1. Choose the setting with the highest mean R on the DEVELOPMENT data 2026-04-24 – 2026-10-21 (needs ≥ 200 trades).
2. Run that one setting ONCE on the TEST data 2025-10-01 – 2026-04-24.

## Pass (all required)
- Test: ≥ 200 trades, mean R after costs > 0, one-sided p < 0.05 vs 400 sets of random entries (same count, buy/sell mix, exits).
- Development: deflated Sharpe probability > 0.95 for 12 trials.
No change to rule, grid, data split or criteria after any result is seen.
