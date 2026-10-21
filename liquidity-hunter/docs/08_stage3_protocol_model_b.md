# Stage 3 protocol — Model B (trend continuation) baseline ladder

**Written and committed before any Model B simulation was run.** Spec v0.4 definitions (docs/05, docs/06) apply unchanged. Model B is evaluated independently of Model A: a failed Model A setup never becomes a Model B trade.

## Data

Same as Model A: Deriv XAUUSDmicro, **development period 2022-11-09 → 2024-12-31 only**. Setup M15, retest M5, trade path M1.

## Definitions

Let d = +1 (long) when the H4 regime is BULL_TREND, d = −1 (short) when BEAR_TREND, read from the last closed H4 bar at signal time.

- **H1 alignment:** the last closed H1 bar's structure trend equals d (its most recent BOS/CHoCH was in direction d).
- **M15 break:** an M15 BOS or CHoCH in direction d (docs/05). Each such event is one candidate.
- **Pullback** (at the M15 break bar t):
  1. The M15 break is a **CHoCH**: M15 structure had turned against the trend and is now turning back.
  2. **Depth:** H1 leg low = H1 protected level at signal time (long case; mirror for short). Leg high = highest M15 high from the open of the last H1 break bar up to bar t−1. Pullback low = lowest M15 low between the leg high and bar t. Retracement = (leg high − pullback low) / (leg high − leg low) must be **between 0.30 and 0.79**, and the pullback low must stay above the leg low (H1 structure intact).
- **Displacement:** an M15 displacement (docs/06 definition) in direction d whose bars include the break bar t, ending at t, t+1 or t+2. Entry signal = close of the displacement's last bar.
- **Retest:** identical to Model A (order-block zone before the displacement, M5 hold, 6 h expiry, missed/chased rules).
- **Stop:** beyond the M15 protected level of the break (lowest low from the broken swing to the break bar, for longs) + buffer max(0.1 × ATR(M15), 1.5 × spread).

## Ladder

| Step | Signal | Entry |
|---|---|---|
| **B0** | Random baseline: for each B1 trade, 50 random M15 closes in the dev period **while the H4 regime is a trend**, direction = H4 trend at that time, same stop distance in ATR units | next M1 open |
| **B1** | H4 trend + H1 alignment + M15 break in direction d | next M1 open after the break bar closes |
| **B2** | B1 + pullback (CHoCH + 30–79% retracement, H1 leg intact) | as B1 |
| **B3** | B2 + displacement | next M1 open after the displacement's last bar closes |
| **B4** | B3 + mandatory retest | next M1 open after the M5 hold bar closes |

B0 asks: does the setup beat simply trading in the H4 trend direction at random times?

## Trade rules and statistics

Identical to docs/06: 2R target, 24 h / Friday time exit, same entry-time filter, spread + 2 points, extra spread on stops, stop first on same-bar conflicts, swap, results in R.

Comparisons (4): B1 vs B0, B2 vs B1, B3 vs B2, B4 vs B3. Weekly block bootstrap, one-sided p, **Holm correction across these 4 tests**, α = 0.05. Same decision rule: a condition adds value only if it passes; otherwise "not shown to add value", and no re-tuning on the same data.

Note on multiple testing: together with Model A this is 9 pre-registered comparisons on the development data. Both families are reported in full.

## Code change before the run

The trade-running and random-baseline functions move from `scripts/stage3_model_a.py` into a shared module so both models use identical code. The Model A run is repeated after the move; its results must be unchanged. Any difference is reported.
