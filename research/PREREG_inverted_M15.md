# Pre-registration — "inverted M15 TDI divergence" on gold (XAUUSDmicro)

Registered 2026-10-21, BEFORE any test data was exported. Found as a side result in
`results/phase1_3_gold_2026-10-21.md` (55 trades, mean +0.434R) — one of ~12 unplanned comparisons, so it is a
hypothesis, not evidence.

## Discovery window (excluded from the test)
2026-04-24 12:23 – 2026-10-21 12:22 (server time). Any trade entered inside this window is ignored.

## Rule (frozen)
- Signals: indicator v9.2 defaults (`research/tdi_engine.py` DEFAULTS), M15, H1 trend filter, DIV kind only.
- Trade the OPPOSITE direction: signal BUY → SELL, signal SELL → BUY, entry at the next M15 bar open (+0.05 slippage, real spread).
- Stop distance = the distance the normal trade would have used (last-leg extreme ∓ 0.3 ATR to the normal entry),
  placed on the other side; skip if > 4 ATR or inside the stops level. Target = 2 × stop distance. One position at a time.
- Exits on M1 bid/ask, stop first when both are touched in one minute; swap −45 / +20 points per night, triple Wednesday.

## Pass (all required)
1. At least 30 trades outside the discovery window.
2. Mean R after costs > 0.
3. One-sided p < 0.05 against 1,000 sets of random entries with the same count, buy/sell mix and stop sizes in ATR.

Fewer than 30 trades = "not enough data yet" — collect more, do not judge.
No change to the rule, the settings or the pass criteria after the test data is seen.
