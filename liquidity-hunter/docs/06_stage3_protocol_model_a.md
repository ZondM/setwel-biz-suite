# Stage 3 protocol — Model A (liquidity reversal) baseline ladder

**Written and committed before any trade simulation was run.** Changing these rules after seeing results would make the results meaningless. Any later change gets a new protocol version and is reported as such.

Spec version: **v0.4** (v0.3 + the pattern definitions below).

## Data

- Deriv XAUUSDmicro M1 bars, **development period only: 2022-11-09 → 2024-12-31**.
- Validation (2025) and final test (2026) stay closed.
- Setup timeframe M15, retest confirmation M5, trade path simulated on M1.

## Pattern definitions added in v0.4

**Consolidation (M15):** 8-bar window; width (max high − min low) ≤ 2.5 × ATR (ATR of the bar before the window); ≥ 60% of bars overlap the previous bar by ≥ 50% of their own range. Valid at the close of the 8th bar. Each later bar extends it while the close stays within the boundaries ± break tolerance and width stays ≤ limit. Ends on a close beyond a boundary (break, with direction) or when the width exceeds the limit (invalid).

**Displacement (M15):** 1–3 consecutive bars in one direction ending at bar t, where: net move (close of t − open of first bar) ≥ 1.5 × ATR (previous bar); every bar's body ≥ 60% of its range; bar t closes in the outer 25% of its range.

**Retest zone (order block):** the last opposite-coloured M15 candle within 10 bars before the displacement started. Short setup: zone = [open, high] of the last bullish candle. Long: [low, open] of the last bearish candle. Near edge = the edge price returns to first.

**Retest on M5** (bars opening after the zone is known):
- Touch: an M5 bar trades into the zone.
- Hold: after a touch, an M5 bar closes back outside the zone on the trade side, without any M5 close beyond the far edge.
- Invalid: an M5 close beyond the far edge, or price reaches the stop level.
- Expiry: 6 hours (24 M15 bars) after the zone is known.
- Missed: price reaches 1R in the trade direction (measured from the displacement close) before any touch.
- Chased: entry price more than 0.5 × ATR(M15) beyond the near edge → skip.

## Ladder (each step adds one condition to the previous step)

| Step | Signal | Entry |
|---|---|---|
| **A0** | Random baseline: for each step-A trade, 50 random M15 closes in the dev period (same entry-time filter), same direction, same stop distance in ATR units, same exit rules | next M1 open |
| **A** | Pool swept and reclaimed (B.1.5) on M15; trade against the sweep | next M1 open after the reclaim bar closes |
| **B** | A + H4 alignment: allowed if the H4 regime agrees with the trade direction, **or** the pool is H4-origin (H4 swing, EQH/EQL, PDH/PDL, PWH/PWL) | as A |
| **C** | B + displacement in the trade direction that also makes a BOS or CHoCH in that direction on M15, completed within 12 M15 bars after the reclaim | next M1 open after the displacement bar closes |
| **D** | C + mandatory retest of the order-block zone (hold confirmed on M5) | next M1 open after the M5 hold bar closes |
| **E** | D + an active M15 consolidation within the 8 bars before the sweep | as D |

Pools used: H1 and H4 swings, H1 equal highs/lows, previous day/week high/low, Asia/London/New York session high/low. If several pools are swept on the same bar in the same direction, one trade is taken (priority: PW > PD > EQ > SWING H4 > SWING H1 > SESSION).

## Trade rules (identical for every step)

- **Stop:** beyond the sweep extreme + buffer, buffer = max(0.1 × ATR(M15), 1.5 × spread at entry).
- **Target:** fixed 2R (exit models are compared later, in experiment G).
- **Time exit:** after 24 hours, or Friday 16:50 New York time, at the M1 close.
- **No entries:** 16:30–18:00 New York time (daily break), and after 16:00 New York on Fridays.
- **Fills:** bars are bid prices. Longs buy at bid + spread and exit at bid; shorts sell at bid and exit at bid + spread. Spread = M1 bar spread + 2 points (docs/04).
- **Stop exits** fill one extra spread worse. If stop and target are both inside the same M1 bar, the **stop** is assumed hit first.
- **Swap:** −$0.45 per oz per night long, +$0.20 short, triple on Wednesday, at 17:00 New York.
- **Result per trade in R**, where 1R = distance from the entry fill to the stop.
- Overlapping trades are allowed (each setup is evaluated on its own). Portfolio rules come later.

## Statistics

Per step: number of trades, mean R (expectancy after costs), 95% confidence interval by **weekly block bootstrap** (5,000 resamples), profit factor, win rate, maximum drawdown in R, longest losing streak.

**Comparisons** (5): A vs A0, B vs A, C vs B, D vs C, E vs D. Test: bootstrap of the difference in mean R; one-sided p-value; **Holm correction** across the 5 tests at α = 0.05.

**Decision rule:** a condition "adds value" only if its step improves mean R over the previous step after Holm correction. Otherwise it is reported as **not shown to add value**. The decision is not reversed by trying other parameters on the same data.

These are development results. They decide which variants go to validation (2025). They are not evidence of a working strategy.
