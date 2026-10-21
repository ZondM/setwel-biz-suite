# How to export data from MT5 (Deriv)

No coding needed. Do this in the Deriv MT5 terminal on Windows (or the desktop app). Repeat for EURUSD.

## Step 1 — Symbol specification (5 minutes)

1. Copy `mql5/Scripts/LH_ExportSymbolSpec.mq5` into your terminal: **File → Open Data Folder → MQL5 → Scripts**, paste it there.
2. In MT5, open **Navigator** (Ctrl+N) → right-click **Scripts** → **Refresh**.
3. Double-click **LH_ExportSymbolSpec**. In the input box, type the symbol names exactly as shown in Market Watch (e.g. `XAUUSD,EURUSD`). Click OK.
4. The **Experts** tab at the bottom shows `LH: wrote MQL5\Files\LH_spec_...csv`. Get the file from **File → Open Data Folder → MQL5 → Files**.
5. If it fails to compile, send me the error text from the **Errors** tab in MetaEditor. (I could not compile it here because MT5 does not run in this environment.)

This file tells us tick value, lot limits, stop level, swaps, sessions and the server's time offset from UTC.

## Step 2 — M1 bars (as much history as available)

1. **View → Symbols** (Ctrl+U) → select the symbol → **Bars** tab.
2. Timeframe **M1**. Start date: as early as possible (e.g. 2018-01-01). End: today.
3. Click **Request**. Wait until it stops loading. Note the first date it actually shows.
4. Click **Export Bars** → save as `deriv_XAUUSD_M1_<from>_<to>.csv`.

## Step 3 — Ticks (newest period first)

Tick files are large. Export **one month per file**.

1. Same window → **Ticks** tab → choose a one-month date range → **Request** → **Export Ticks**.
2. Name: `deriv_XAUUSD_TICKS_2026-09.csv`.
3. Start with the latest 12 months. Older months later if history exists.

## Step 4 — Send the files

- Zip each file. GitHub's website accepts files up to **25 MB** each. If a monthly tick zip is larger, split it into two half-months.
- Upload to the repo folder `liquidity-hunter/data/raw/` (GitHub → Add file → Upload files, on branch `claude/inspiring-albattani-8vtyyk`), or attach them here if your app allows it.
- Do not edit the files in Excel: it changes date formats and decimals.

## What happens next

I run the data-quality report on each file. It checks for duplicates, broken candles, gaps, bad spreads, crossed bid/ask and whether the time conversion to UTC is correct. Failures are reported to you, not hidden.
