# TDI Divergence System — Deliverable 1: Formal Specification (v5)

Status: **APPROVED rules (Option A, TDI-led).** Implemented in `Indicators/TDI_Divergence_Pro.mq5`.
The v4 files in `baseline/` are reference only; v5 is written from this spec, not from them.

---

## 0. Decisions

- **Q1 → Option A.** Same-type swings: BUY = green higher LOW vs price lower LOW; SELL = green lower HIGH vs price higher HIGH.
- **TDI leads.** Swings are found on the green line first. Each green swing is then given its price extreme (the candle low/high within `PriceSep` bars). Leg 1 is the deepest green swing; later legs go deeper in price while green stays above (buy) / below (sell) leg 1. Leg 2 or leg 3 can produce the signal.
- **Optional extras off by default.** Only the core rule + confirmation candle are on; all other filters are switches (Section 8).

## 1. Notation

- Chronological bar index `t` (larger = newer). Only **closed** bars are used; the forming bar is never read for signals.
- `O,H,L,C[t]` price; `ATR[t]` = ATR(14) on the same timeframe.
- `G[t]` green line, `R[t]` red line, `Y[t]` yellow line, `UB[t]/LB[t]` cyan bands.
- "Bar `t` closes" = the moment bar `t+1` opens.

## 2. TDI calculation (standard TDI)

```
RSI[t] = RSI(RSI_Period=13, PRICE_CLOSE)   (MT5 iRSI, Wilder smoothing)
G[t]   = SMA(RSI, PriceLinePeriod=2)        green, PRIMARY divergence source
R[t]   = SMA(RSI, SignalPeriod=7)           red signal line
Y[t]   = SMA(RSI, BandPeriod=34)            yellow market base
σ[t]   = population StdDev(RSI, 34)
UB/LB  = Y ± BandDev(1.6185) · σ            cyan bands
Levels 32 / 50 / 68
```
v5 adds inputs for MA method (default SMA) and applied price (default Close). `DivergenceSource` input defaults to Green; other sources must be selected explicitly and are labelled on chart.

## 3. TDI swing detection (the legs)

On the source line `S` (green by default), with `Lb = PivLeft = 5`, `Rb = PivRight = 2`:
```
TDI swing low  at q:  S[q] <  S[q-k] for k=1..Lb   and   S[q] <= S[q+k] for k=1..Rb
TDI swing high at q:  S[q] >  S[q-k] for k=1..Lb   and   S[q] >= S[q+k] for k=1..Rb
```
- Known at the close of bar `q+Rb` (2-bar delay, no future data).
- Prominence (on, 3.0 pts): since the previous swing of the same type, the TDI must have moved ≥ 3 points away from this swing's value. Removes tiny wiggles.
- Price of the leg: lowest low (swing low) / highest high (swing high) in bars `q-PriceSep … min(q+PriceSep, now)`, `PriceSep = 3`.

## 4. Leg 1 (reference) — BUY shown, SELL is the exact mirror

When a new TDI swing low **N** is confirmed at bar `c`, search earlier TDI swing lows **X** with `MinSpan(5) ≤ N.bar − X.bar ≤ MaxSpan(100)` that satisfy all of:
```
price(X) > price(N)                 price went deeper (lower low)
S(N)     > S(X)                     TDI higher low
no low  < price(N) from X to c      N is the deepest price since leg 1
no S    < S(X)     after X to c     leg 1 is the deepest TDI since leg 1
```
If several X qualify, leg 1 = the one with the lowest TDI (ties → older). None → no setup.

## 5. Legs 2 / 3

Between leg 1 and N, each further TDI swing low M is counted as a leg if: ≥ `MinLegBars(3)` after the previous counted leg, price(M) lower than the previous counted leg and higher than N, and S(M) > S(leg 1) (or > previous leg when `StrictTDIRise = true`). N is the last leg.
Signal allowed when `MinLegs(2) ≤ legs ≤ MaxLegs(3)`. At most `MaxSignalsPerSeq(2)` signals per leg 1 (so leg 2 and a later leg 3 can each signal once).

SELL: highs instead of lows, price higher highs, TDI lower highs.

## 6. Confirmation and signal timing

From the bar the setup becomes known (`N.bar+2`) up to `N.bar + ConfirmBars(6)`, on each closed bar `c`:
- **Invalidate** (after the first bar): price makes a new extreme beyond N, or TDI goes beyond leg 1.
- **Confirm** at the first `c` where all enabled checks pass (BUY; SELL mirrored):
  - `UseGreenDir` (on): `S[c] > S[c−1]`
  - `UseRedCross` (on): `G[c] > R[c]`
  - `UseCandleDir` (on): `C[c] > O[c]`
  - `UseBase` (off): `G[c] > Y[c]`
  - `UseCloseBeyond` (off): `C[c] > H[` last-leg price bar `]`
- Not confirmed by the deadline → rejected with the missing condition as reason.

Recorded per signal (CSV `MQL5\Files\TDIDivPro_<symbol>_<tf>.csv`):
signal id (open time of the last-leg TDI swing), every leg's TDI time/value and price time/value, confirm bar, entry-from time, reason for rejects.
Arrow is drawn on bar `c`. Divergence lines are drawn back to pivot bars, labelled with the confirm time so no one mistakes it for an earlier entry.

## 7. Non-repainting guarantee

Covered:
1. A signal on bar `c` uses only bars `≤ c`.
2. Once written, a signal (bar, direction, SL level, ID) is never moved, removed or flipped during normal live operation.
3. Full recalculation on the same history with the same inputs reproduces the same signals (deterministic).
4. One signal per `SignalID`; ticks inside a bar cannot create or remove signals.

Not covered (documented limitations): changed inputs, broker history revisions/gaps, terminal history reload, and the inherent delay of `Rb`/confirmation bars.
Provisional setups are shown in a separate colour and are never exposed in the EA signal buffers.

## 8. Filters (each independently on/off; every rejection is logged with its reason)

| Filter | Formula | v5 default |
|---|---|---|
| TDI swing prominence | Section 3 | on, 3.0 pts |
| Min price divergence | `abs(price(L1) − price(N)) ≥ k·ATR` | off, 0.2 |
| Min TDI divergence | `abs(S(N) − S(L1)) ≥ x` | off, 2.0 |
| Min / max bars leg 1 → last leg | Section 4 | 5 / 100 |
| Max TDI swing → price extreme separation | Section 3 | 3 bars |
| Price pullback between legs | max rally from leg-1 low ≥ k·ATR | off, 1.0 |
| Leg-1 zone | BUY `S(L1) ≤ 40`, SELL `≥ 60` | off |
| Leg-1 outside band | BUY `S(L1) ≤ LB`, SELL `≥ UB` | off |
| TDI turning / green vs red / candle | Section 6 | on |
| Green vs base / close beyond | Section 6 | off |
| Cooldown | no same-direction signal within N bars | off, 10 |
| Signals per leg 1 | ≤ MaxSignalsPerSeq | 2 |
| Duplicate prevention | one evaluation per closed bar; unique signal id | always on |

No filter set removes all false signals; effect is measured in testing (Deliverable 4).

## 8b. Trend filter and signal kinds (v7, from your marked charts)

Trend on each closed bar `c`: `slope = (EMA50[c] − EMA50[c−10]) / ATR14[c]`. UP if `slope ≥ +0.6`, DOWN if `≤ −0.6`, else NONE.
TDI "equal" tolerance `TDITol = 2.0`: TDI flat (within 2 points) while price goes deeper counts as divergence (your V10 M5 missed 2 and 3).

| Kind | When | Rule |
|---|---|---|
| **DIV** | with the trend | any TDI level (V50 18 Oct, V25 17 Oct pullback buys) |
| **DIV** | no trend | leg-1 TDI ≤ 40 (buy) / ≥ 60 (sell) |
| **EXH** | against the trend | leg-1 TDI ≤ 32 / ≥ 68 **and** ≥ 3 legs, or 2 legs with leg-1 TDI ≤ 25 / ≥ 75. Normal fast confirmation (no yellow-line wait) |
| **CONT** | with the trend | TDI and price both higher low (buy) / lower high (sell) after ≥ 1 ATR pullback, TDI ≤ 45 / ≥ 55 |

Known misses against your marks (from screenshots, not measured): V10 M15 15 Oct 3-leg flat buy (TDI about 30) in a grinding downtrend still qualifies as EXH; V10 M15 11 Oct 2-leg buy with TDI about 18 qualifies as deep EXH.

## 9. Multi-timeframe

- A confirmed signal on TF X is "active" for `ActiveBars_X` bars after its confirm bar.
- Mode A: execution TF only. Mode B/C: 2 or 3 enabled TFs must each have an active same-direction signal. Mode D: HTF trend buffer (last **closed** HTF bar only) must not oppose.
- HTF values are read only at HTF shift ≥ 1 (closed bars). Log per TF: agreed / disagreed / none.

## 10. Indicator → EA interface (buffers)

| # | Buffer | Content |
|---|---|---|
| 0–4 | UB, LB, Y, G, R | TDI lines |
| 5 / 6 | Sell / Buy | arrow value on confirm bar, else EMPTY |
| 7 / 8 | SellSL / BuySL | price extreme of the last leg |
| 9 | SignalID | open time of last-leg TDI swing (datetime as double) |
| 10 | LegCount | 2…5 |
| 11 | Direction | +1 buy / −1 sell |
| 12 | Kind | 1 DIV, 2 EXH, 3 CONT |
| 13 | Trend | +1 / 0 / −1 on that closed bar |

EA reads bar 1 only, after `BarsCalculated == Bars`, and stores processed SignalIDs in a terminal GlobalVariable so a restart cannot re-enter the same signal. EA contains **no** divergence logic of its own.

## 11. Assumptions

1. Option A, TDI-led (confirmed by you).
2. TDI formula = standard Dean Malone TDI; screenshot levels 32/50/68 and line values match it.
3. V10/V25/V50 contract specs differ; EA reads them at runtime, nothing hard-coded.
4. Break-even = entry ± offset; does not guarantee zero net loss (spread/slippage/gaps).

## 12. Notes from the baseline review (to fix in v5)

- v4 EA re-entry protection is in memory only (`lastSignalBar`) → not restart-safe.
- v4 EA break-even modifies without checking stop/freeze levels and ignores the result code.
- v4 EA `CalcLots` can raise lots to broker minimum silently when `RiskPercent = 0`.
- SL_Enforcer v3 is a separate EA (watches all symbols/magics, voice countdown, closes losing trades with no SL). v5 Stop-Loss Enforcer will be a module inside the EA plus an optional standalone, with explicit `ManageManualTrades` permission.
- Nothing has been compiled in this environment (no MetaEditor available here); compile status will only be reported from your MT5.
