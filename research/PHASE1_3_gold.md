# Phases 1–3 on gold — pre-registration (written and committed BEFORE any gold backtest was run)

## Phase 1 — rules under test
Exactly the indicator `TDI_Divergence_Pro` v9.2 defaults (ported 1:1 to `research/tdi_engine.py`):
- TDI: RSI 13 (close, Wilder), green SMA 2, red SMA 7, yellow SMA 34, bands SMA 34 ± 1.6185 σ.
- Legs: TDI pivots 5 left / 2 right, prominence 3 pts, price extreme within 3 bars, span 5–100 bars, 2–4 legs,
  TDI tolerance 2 pts, double top/bottom (price within 0.5 ATR, TDI ≥ 3 pts better), price beyond leg 1 by ≥ 0.25 ATR.
- Confirmation within 6 bars: TDI turning, green beyond red, candle in signal direction. One signal per TDI swing (reset through 50).
- Trend: EMA50 slope over 10 bars ≥ 0.6 ATR; against it rejected; no trend → leg-1 TDI ≤ 40 / ≥ 60.
- Higher timeframe (H1 for M5/M15, H4 for M30) EMA50 slope over 5 closed bars ≥ 0.5 ATR; against it only EXH.
- CONT pullback signals with the trend. EXH signals are excluded from trading (as in the EA).

## Trade rules (as the EA)
Entry at the next bar open (ask for buys, bid for sells) + 0.05 slippage. SL = last-leg extreme ∓ 0.3 ATR, skip if > 4 ATR
or inside the stops level. TP = 2R. One position at a time. Exits checked on M1 bid/ask, stop first when both are touched
in one minute, stop fills at the worse of stop or candle open, minus 0.05 slippage. Swap −45 / +20 points per night, triple on
Wednesday. Secondary: EA exits (break-even at 0.5R locking 0.1R, trailing from 1R at 1.5 ATR).

## Tests
1. Look-ahead: re-run on 6 random truncations; any changed past signal = fail.
2. Primary: defaults on M5, M15, M30 over the whole 180 days (never fitted to gold, so all out-of-sample).
   Baseline: 400 sets of random entries with the same trade count, buy/sell mix and stop sizes in ATR.
3. Grid (36): TF {M5,M15,M30} × pivot-left {3,5,8} × HTF filter {on,off} × RR {1.5,2.0}, chosen on the development period
   2026-04-24 – 2026-08-20; walk-forward (choose on 2 months, test the next month, 2 folds); holdout 2026-08-21 – end, opened once.

## Pass
- Primary: ≥ 200 trades, mean R > 0 after costs, p < 0.05 vs random entries.
- Grid: holdout mean R > 0 with p < 0.05, deflated Sharpe > 0.95 for 36 trials, neighbouring pivot settings also > 0.
