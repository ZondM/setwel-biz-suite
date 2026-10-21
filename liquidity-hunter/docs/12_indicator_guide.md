# Liquidity Hunter indicator — install and use

File: `mql5/Indicators/LiquidityHunter.mq5`. **Status: written, not yet compiled** (MT5 cannot run in the research environment). Compile errors, if any, will be fixed from the error text.

**What it is:** a chart tool that draws the same swings, BOS/CHoCH, regime, liquidity pools and sweeps as the Python research code.
**What it is not:** a trading system. Trading these signals showed **no edge** on Deriv gold 2022–2024 (docs/07, 09, 11). It places no orders.

## Install

1. Open the file on GitHub (branch `claude/inspiring-albattani-8vtyyk`, path above) and copy all of it.
2. MT5 → **F4** (MetaEditor) → **New** → **Custom Indicator** → name `LiquidityHunter` → Next → Finish.
3. Delete all template text, paste, press **F7**. Expect `0 errors`. If not, send the Errors tab text.
4. MT5 → **Ctrl+N** → **Indicators** → drag **LiquidityHunter** onto an XAUUSDmicro chart (M15 recommended).

## What you see

| Item | Meaning |
|---|---|
| Small blue dots at highs/lows | Confirmed swings (shown 2 bars after the swing, when it becomes known) |
| Dashed line + "BOS up/down" (green/red) | Close beyond the last swing in the trend direction |
| Dashed line + "CHoCH" (purple) | Close beyond the last swing against the trend |
| Dotted lines PDH/PDL (blue), PWH/PWL (navy) | Previous trading-day / week high and low (17:00 New York day) |
| Dotted lines ASIA/LONDON/NEWYORK _H/_L (gold) | Session high and low |
| Dotted lines EQH/EQL (teal) | Equal highs / lows on H1 |
| Orange arrow | Pool swept and closed back inside within 3 M15 bars |
| Panel (top left) | Regime on H4, H1 and the chart timeframe; ATR |

Hover over a line or arrow to see its details (pool id, status, confirmation time).

## No repaint

Everything is computed from **closed** bars and recomputed from history on each new bar. Lines and marks that have been drawn do not move. Swings and pools appear only once they are confirmed, so they show up a few bars late by design.

## Parity check (optional)

Set **InpExportCsv = true**. The indicator writes `MQL5\Files\LH_export_<symbol>_<timeframe>.csv`. Sending that file allows a line-by-line comparison with the Python code on the same bars. Small differences in the first ~100 bars are expected (ATR start-up window).

## Settings

Defaults match the research spec v0.4. Server time offset is 0 for Deriv; set it if you use another broker (e.g. +2/+3 for many EET servers — that would also need DST handling, not built in).
