# TDI Divergence System (MT5) — build status

| Step | File | Status |
|---|---|---|
| 1. Indicator | `Indicators/TDI_Divergence_Pro.mq5` | v8 compiled 0 errors (your MT5). **v9 (HTF serious trend + outcome stats) written, not compiled yet** |
| 2+3. EA with Stop-Loss Enforcer, break-even, trailing | `Experts/TDI_Divergence_EA.mq5` | **written, NOT compiled yet** |

Rules: `SPEC.md`. Old v4 files in `baseline/` are reference only.

## Install (indicator)
1. MT5 → File → Open Data Folder → `MQL5\Indicators` → copy `TDI_Divergence_Pro.mq5` there.
2. Open MetaEditor (F4), open the file, press **Compile** (F7).
3. Send me the full Errors/Warnings list if there is anything in it.
4. In MT5 Navigator → Indicators → drag `TDI_Divergence_Pro` onto V10 / V25 / V50, M5 / M15 / M30.

## What you will see
- Subwindow: TDI (green, red, yellow, cyan) + blue ▲ buy / magenta ▼ sell arrows on the **confirm** bar.
- Main chart: lines joining the legs on price and on the TDI, labels L1 / L2 / L3, arrow on the confirm candle (hover it: legs, confirm time, entry time, SL reference).
- Grey dotted lines = setup still pending (not a signal yet).
- Panel bottom-left: last signal, pending setup, "forming" (price already beyond leg 1 while TDI holds), counts.
- Log: `MQL5\Files\TDIDivPro_<symbol>_<tf>.csv` — every signal and every rejected setup with the reason.

## Test checklist (step 1)
1. Compiles with 0 errors.
2. Your 19 Oct V10 M15 chart: does it mark the buy and sell you circled? Note where the arrow lands vs your red lines.
3. Turn on `InpShowRejects` → grey "x reason" labels show why other setups were refused.
4. Repaint test: note the arrows, leave the chart running a few hours, then right-click → Refresh (or change timeframe and back). Arrows that existed must still be in the same place.
5. Same on V25 and V50, M5 / M15 / M30.
6. Send me: screenshots + the CSV log for anything wrong (missed setup, wrong setup, arrow too late).

No test results exist yet. Nothing here is proven profitable.

## Install (EA)
1. Indicator v9 compiled in `MQL5\Indicators` (the EA loads it by name `TDI_Divergence_Pro`).
2. Copy `TDI_Divergence_EA.mq5` to `MQL5\Experts`, open in MetaEditor, Compile.
3. Strategy Tester first (Every tick based on real ticks), then a DEMO account. One chart per symbol, Algo Trading ON.

## EA test checklist
1. Tester: each trade's entry bar = an indicator arrow bar + 1 (open of the next bar).
2. Every position has an SL immediately; Journal shows "confirmed by server" for BE / trailing moves.
3. Open a manual trade without SL with `InpManageManual=true`: SL installed within ~5 s, or closed after retries (policy CLOSE).
4. Restart the terminal with an open trade: no duplicate entry; BE / trailing continue.
5. V10, V25, V50 separately (lot minimums differ; the EA skips instead of over-risking).

## Boom / Crash indicator — `Indicators/TDI_BoomCrash_Pro.mq5` (v1, not compiled yet)
Same TDI-led divergence rules, adapted:
- Spike candles (close-to-close move in the spike direction > 4 x the normal move) are marked with an orange dot and removed from the RSI, so the TDI reads the drift between spikes.
- Mode auto-detects from the symbol name: Boom = BUY signals only, Crash = SELL signals only (spike side). Drift-side signals: `InpTradeDriftSide`.
- Spike-side signals ignore the trend / HTF filters (the drift always runs the other way).
- Panel bottom line: how often a spike came within 10 bars after a signal vs after any bar. If the two numbers are about equal, the signal does not time spikes.
- The EA can trade it: set the EA input `InpIndName = TDI_BoomCrash_Pro`.

## Stop-Loss Enforcer for manual trades — `Experts/TDI_SL_Enforcer.mq5` (v1, not compiled yet)
Attach to ONE chart (Algo Trading ON). It never opens trades. Watches all symbols.
- Trade without SL → after 20 s grace it installs one: the closer of 2 x ATR(M15) or a 2% of balance loss. 5 retries, then closes the trade (or alerts only).
- Break-even at 0.5R (locks 0.1R), trailing from 1R at 1.5 x ATR. Never loosens a stop; respects stop/freeze levels; counts a stop only when the server confirms it.
- Restart-safe (initial risk per ticket stored in terminal global variables). Log: MQL5\Files\TDI_SL_Enforcer.csv.
Test on a DEMO first: open a trade without SL and watch the panel count down and install it.
