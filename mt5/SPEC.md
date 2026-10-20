# TDI Divergence System — Deliverable 1: Formal Specification (draft v5-spec-0)

Status: **DRAFT — blocked on Question Q1 (Section 0).** No v5 code is written until Q1 is answered.
Baseline reviewed: `baseline/TDI_Divergence_v4.mq5`, `baseline/TDI_Divergence_EA_v4.mq5`, `baseline/SL_Enforcer_v3.mq5`, and the V10 M15 screenshot (19–20 Oct 2026).

---

## 0. Open questions (must be resolved before coding)

### Q1 — BLOCKING: written rule vs screenshot disagree on which swings are compared

| | Written rule (your prompt) | Screenshot (drawn by your v4 indicator) |
|---|---|---|
| BUY  | price **lower HIGH** + green **higher LOW**  | price **lower LOW** + green **higher LOW** (pink lines join lows) |
| SELL | price **higher LOW** + green **lower HIGH** | price **higher HIGH** + green **lower HIGH** (pink lines join highs) |

The direction is the same in both (BUY = price weakening while green strengthens; SELL = the mirror).
The difference is the **pivot type** on the price side:

- **Option A (same-type pairing — matches screenshot and v4):** price lows vs green lows for BUY, price highs vs green highs for SELL. A price pivot and its green pivot occur within ~0–3 bars of each other, so "match by time" is well defined.
- **Option B (cross-type pairing — matches written text literally):** price highs vs green lows for BUY. These pivots do **not** occur at the same time (at a price high the green line is near its own high). Pairing must then be redefined as: *for each price swing high H_k, use the green swing low located in the pullback immediately before H_k* (between H_(k−1) and H_k). This is codable but is a different strategy from what the screenshot shows.

The prompt instructs that the screenshot/text conflict be raised before choosing. Everything below is written for **Option A**; Option B changes only Sections 4 and 5 (pairing + comparison) and would be specified on request.

### Q2 — non-blocking: red vertical lines
Assumed: left red line ≈ the comparison (latest) pivot; right red line ≈ the latest acceptable confirmation/entry bar. Default `ConfirmBars = 6` fits that window on the screenshot.

### Q3 — non-blocking: v4 extras
v4 filters (trend filter, first-leg OB/OS zone, "extreme of last N bars", pullback size) are kept as **optional, independently switchable** filters with v4 defaults, so v5 reproduces v4 behaviour when configured identically.

---

## 1. Notation

- Chronological bar index `t` (larger = newer). Only **closed** bars are used; the forming bar is never read for signals.
- `O,H,L,C[t]` price; `ATR[t]` = ATR(14) on the same timeframe.
- `G[t]` green line, `R[t]` red line, `Y[t]` yellow line, `UB[t]/LB[t]` cyan bands.
- "Bar `t` closes" = the moment bar `t+1` opens.

## 2. TDI calculation (verified from v4 source)

```
RSI[t] = RSI(RSI_Period=13, PRICE_CLOSE)   (MT5 iRSI, Wilder smoothing)
G[t]   = SMA(RSI, PriceLinePeriod=2)        green, PRIMARY divergence source
R[t]   = SMA(RSI, SignalPeriod=7)           red signal line
Y[t]   = SMA(RSI, BandPeriod=34)            yellow market base
σ[t]   = population StdDev(RSI, 34)
UB/LB  = Y ± BandDev(1.6185) · σ            cyan bands
Levels 32 / 50 / 68
```
v5 adds inputs for MA method (default SMA = v4) and applied price (default Close). `DivergenceSource` input defaults to Green; other sources must be selected explicitly and are labelled on chart.

## 3. Swing (pivot) detection — identical engine for price and green line

For series `X` (H for highs, L for lows, G for green):

**Swing high at bar p** with left `Lb` and right `Rb` bars:
```
X[p] >  X[p−k]  for k = 1..Lb        (strict on the left)
X[p] >= X[p+k]  for k = 1..Rb        (ties on the right do not cancel)
```
Swing low: same with inequalities reversed. (Tie rule is v4's.)

- **Confirmation time** of a pivot = close of bar `p+Rb`. Before that it is *provisional* and may never be used for a confirmed signal.
- **Prominence filter (optional):**
  price high: `H[p] − min(L between previous opposite pivot and p) ≥ MinProminenceATR · ATR[p]`
  green high: `G[p] − min(G over same span) ≥ MinTDIProminence` (points). Lows mirrored.
- **Alternation:** pivots are kept as an alternating high/low sequence. If two same-type pivots confirm with no opposite pivot between, the more extreme is kept. This edits only the *pivot list*; a signal already confirmed is frozen (Section 7) and never re-evaluated.
- **Current (comparison) leg:** v4 uses `Rb = 0` for the newest leg and lets the confirmation candle (Section 6) act as the right-side confirmation. Kept as default (`FastTrigger = true`). With `FastTrigger = false`, the newest leg needs the full `Rb` bars as well (slower, stricter).

## 4. Pivot pairing (Option A)

Each price pivot `P` (time `tP`) is paired with the green pivot `Q` of the **same type** that satisfies:
```
|tQ − tP| ≤ MaxPivotSep        (default 1 bar = v4's TDIHigh/TDILow window)
```
If several qualify, the one with the most extreme green value is used. No qualifying green pivot → pair rejected, reason `no TDI pivot within N bars`.
Record per pair: `tP, price value, tQ, green value`.

## 5. Divergence comparison and legs

Let `P1` (reference) be older, `P2` (comparison) newer, same type.

**SELL (Option A):**
```
H[P2] − H[P1] ≥ MinPriceDivATR · ATR[P2]      price higher high       (v4: MinLegExtensionATR 0.5)
G[Q1] − G[Q2] ≥ MinTDIDiv                     green lower high         (v4: −1.0 → "equal within 1 pt" allowed)
MinGap ≤ tP2 − tP1 ≤ MaxGap                   spacing                  (v4: 6 … 80)
no bar strictly between P1 and P2 has H > min(H[P1],H[P2])             (P1 is the true previous leg)
optional: price pullback between legs ≥ MinPullbackATR · ATR            (v4: 1.0)
optional: green dip between legs      ≥ MinTDIRetrace points            (v4: 6.0)
```
**BUY:** exact mirror on lows (`L[P2] < L[P1]`, `G[Q2] > G[Q1]`).

**Legs:** starting from P2, walk back through previous same-type pivots while each adjacent pair still satisfies the rules.
`Legs = 2` → P1,P2; `Legs = 3` → P0,P1,P2 (two consecutive divergences). Signal allowed when `MinLegs ≤ Legs ≤ MaxLegs` (v4 defaults 2…4). The **first** leg (oldest) is the reference leg; its values drive the OB/OS filter.

## 6. Confirmation and signal timing

After P2, scan closed bars `c = tP2+1 … tP2+ConfirmBars`:
- **Invalidate** if a bar makes a new extreme beyond P2 (`H[c] > H[P2]` for SELL) before confirming → reason `new high before confirm`.
- **Confirm** at the first `c` where all enabled checks pass (v4 rules):
  - `RequireCloseBeyond`: `C[c] < L[P2]` (SELL) / `C[c] > H[P2]` (BUY)
  - `RequireCandleDir`: `C[c] < O[c]` (SELL) / `C[c] > O[c]` (BUY)
  - `RequireSignalCross`: `G[c] < R[c] and G[c] < G[c−1]` (SELL), mirrored for BUY
- None within `ConfirmBars` → reason `no confirm candle`; candidate expires.

Recorded per signal:
`SignalID = Symbol|TF|Dir|tP2`, pivot times/values for all legs, `ConfirmTime = close of c`, `EarliestEntry = open of c+1`, filters passed, `LegCount`.
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

| Filter | Formula | v4 default |
|---|---|---|
| Swing prominence | Section 3 | off (new) |
| Min price divergence | `ΔH ≥ k·ATR` | 0.5 ATR |
| Min TDI divergence | `ΔG ≥ x` | −1.0 |
| Min / max bars between pivots | Section 5 | 6 / 80 |
| Max price/TDI pivot separation | Section 4 | 1 |
| First-leg zone | SELL: `G[Q_first] ≥ FirstLegOB`; BUY: `≤ FirstLegOS` | on, 60 / 40 |
| First-leg outside band | SELL `G ≥ UB`, BUY `G ≤ LB` | off |
| Extreme of last N bars | `H[P2] = max(H, N bars)` | on, 50 |
| Green direction / red cross | Section 6 | on |
| Market base filter | SELL `G[c] < Y[c]`; BUY `G[c] > Y[c]` | off (new) |
| Candle confirmation | Section 6 | on |
| Trend filter (major swings, `StructureBars` 20) | uptrend HH+HL blocks sells unless counter-trend extreme (`G ≥ 75` and above band) | on |
| Cooldown | no new signal same dir within `CooldownBars` | off (new) |
| Duplicate prevention | unique `SignalID` | always on |

No filter set removes all false signals; effect is measured in testing (Deliverable 4).

## 9. Multi-timeframe

- A confirmed signal on TF X is "active" for `ActiveBars_X` bars after its confirm bar.
- Mode A: execution TF only. Mode B/C: 2 or 3 enabled TFs must each have an active same-direction signal. Mode D: HTF trend buffer (last **closed** HTF bar only) must not oppose.
- HTF values are read only at HTF shift ≥ 1 (closed bars). Log per TF: agreed / disagreed / none.

## 10. Indicator → EA interface (planned buffers)

| # | Buffer | Content |
|---|---|---|
| 0–4 | UB, LB, Y, G, R | TDI lines |
| 5 / 6 | Sell / Buy | arrow value on confirm bar, else EMPTY |
| 7 / 8 | SellSL / BuySL | leg extreme (P2) |
| 9 | Trend | +1 / 0 / −1 |
| 10 | SignalID | `tP2` as double (datetime) on confirm bar |
| 11 | LegCount | 2…4 |

EA reads bar 1 only, after `BarsCalculated == Bars`, and stores processed SignalIDs in a terminal GlobalVariable so a restart cannot re-enter the same signal. EA contains **no** divergence logic of its own.

## 11. Assumptions

1. Option A (pending Q1).
2. TDI formula = v4 (standard Dean Malone TDI); screenshot levels 32/50/68 and line values match it.
3. V10/V25/V50 contract specs differ; EA reads them at runtime, nothing hard-coded.
4. Break-even = entry ± offset; does not guarantee zero net loss (spread/slippage/gaps).

## 12. Notes from the baseline review (to fix in v5)

- v4 EA re-entry protection is in memory only (`lastSignalBar`) → not restart-safe.
- v4 EA break-even modifies without checking stop/freeze levels and ignores the result code.
- v4 EA `CalcLots` can raise lots to broker minimum silently when `RiskPercent = 0`.
- SL_Enforcer v3 is a separate EA (watches all symbols/magics, voice countdown, closes losing trades with no SL). v5 Stop-Loss Enforcer will be a module inside the EA plus an optional standalone, with explicit `ManageManualTrades` permission.
- Nothing has been compiled in this environment (no MetaEditor available here); compile status will only be reported from your MT5.
