# TDI Divergence System (MT5) — build status

| Step | File | Status |
|---|---|---|
| 1. Indicator | `Indicators/TDI_Divergence_Pro.mq5` | **written, NOT compiled yet** — please compile and test |
| 2. Stop-Loss Enforcer | — | next, after step 1 passes |
| 3. EA | — | after step 2 |

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
