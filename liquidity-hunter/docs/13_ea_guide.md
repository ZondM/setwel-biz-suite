# LiquidityHunterB EA — install, test and use

File: `mql5/Experts/LiquidityHunterB.mq5`. **Status: written, not yet compiled.** Send the Errors tab if compiling fails.

> **UNVALIDATED.** This EA implements Model B exactly as pre-registered (docs/08, step B4). In research it showed **no edge**: +0.05R per trade on 17 development trades, 95% CI −0.66R to +0.76R (docs/09). Expect results anywhere between losing and small profit. It refuses to run on a real account unless `InpAllowLive = true`.

## What it does

On every new M5 bar it rebuilds, from closed bars only: H4 regime, H1 structure, M15 structure, displacement and order-block zones, then the M5 retest. It enters **only** on the M5 bar that confirms the retest:

1. H4 regime is a trend (direction d) and H1 structure trend = d.
2. An M15 **CHoCH** in direction d (the pullback turning back).
3. The pullback retraced 30–79% of the H1 leg, and the H1 protected level held.
4. An M15 displacement in direction d that includes the break bar, finishing within 2 bars.
5. Price retests the order-block zone on M5 and closes back out of it (within 6 h).
6. Entry at market. Stop beyond the M15 protected level + max(0.1 × ATR, 1.5 × spread). Target 2R. Time exit after 24 h or Friday 16:50 New York.

Each setup has an ID (`LHB-YYYYMMDD-HHMM`) stored as the order comment, so it is never traded twice, including after a restart.

## Risk controls

| Control | Default |
|---|---|
| Risk per trade | 0.5% of equity; lots rounded **down**; trade skipped if the minimum lot would risk more |
| Total open risk | 2% |
| Max positions | 3 |
| Daily loss lock | 2% from equity at 17:00 New York (resets next trading day) |
| Drawdown lock | 10% from the equity high; stays locked until `InpResetDrawdownLock = true` is set once |
| Max spread | 60 points |
| Missing stop after fill | 2 attempts to set it, otherwise the position is closed (`UNPROTECTED_CLOSE`) |
| Slippage | closed if filled risk > 1.5 × planned |
| Stale prices | no entry if the last tick is older than 2 minutes |
| Real account | blocked unless `InpAllowLive = true` |

Every decision (entry, rejection with reason, exit, lock) is printed in the Experts tab and written to `MQL5\Files\LH_B_log_<symbol>.csv`.

## Install

1. Copy the file from GitHub (branch `claude/inspiring-albattani-8vtyyk`).
2. MetaEditor → **New** → **Expert Advisor (template)** → name `LiquidityHunterB` → Finish. Select all, paste, **F7**.
3. Expect `0 errors`. Otherwise send a screenshot of the full error list (scrolled to the top).

## Test in the Strategy Tester first (recommended)

- Symbol **XAUUSDmicro**, timeframe **M5**, model **"Every tick based on real ticks"** (or "1 minute OHLC").
- Period **2022-11-09 → 2024-12-31** (the research development period), deposit 200 USD, leverage 1:1000.
- Compare with the research trades below. Small differences are expected (the EA uses the last 1,500 M15 bars, the research used all history, so early ATR and structure values can differ slightly; real-tick fills differ from M1 bars). Large differences mean a porting bug: send the tester's trade list and the log file.

### Research trades for the same rules (Python, development period)

| entry_time       | direction   |   entry |    stop |   target | exit_time        | exit_reason   |     r |
|:-----------------|:------------|--------:|--------:|---------:|:-----------------|:--------------|------:|
| 2023-01-16 05:10 | BUY         | 1921.65 | 1916.53 |  1931.88 | 2023-01-16 06:30 | STOP          | -1.02 |
| 2023-03-13 06:55 | BUY         | 1876.48 | 1871.73 |  1885.98 | 2023-03-13 07:04 | STOP          | -1.03 |
| 2023-04-10 12:45 | SELL        | 1998.92 | 2003.22 |  1990.33 | 2023-04-10 12:55 | TARGET        |  2    |
| 2023-04-24 02:40 | SELL        | 1982.36 | 1984.8  |  1977.48 | 2023-04-24 05:07 | TARGET        |  2    |
| 2023-06-15 12:50 | SELL        | 1931.54 | 1937.02 |  1920.58 | 2023-06-15 13:08 | STOP          | -1.01 |
| 2023-10-31 15:05 | BUY         | 1997.9  | 1994.35 |  2004.99 | 2023-10-31 15:12 | STOP          | -1.01 |
| 2023-11-09 08:45 | SELL        | 1949.33 | 1950.64 |  1946.71 | 2023-11-09 09:32 | TARGET        |  2    |
| 2023-11-13 05:40 | SELL        | 1938.61 | 1941.5  |  1932.83 | 2023-11-13 14:48 | TARGET        |  2    |
| 2023-12-01 11:30 | BUY         | 2041.42 | 2039.09 |  2046.08 | 2023-12-01 11:36 | STOP          | -1.03 |
| 2024-01-02 10:25 | BUY         | 2074.74 | 2071.63 |  2080.96 | 2024-01-02 11:34 | STOP          | -1.01 |
| 2024-02-20 18:30 | BUY         | 2028.57 | 2025.49 |  2034.74 | 2024-02-20 19:53 | STOP          | -1.03 |
| 2024-05-22 02:45 | BUY         | 2422.04 | 2419.16 |  2427.8  | 2024-05-22 02:48 | STOP          | -1.03 |
| 2024-07-17 11:00 | BUY         | 2467.94 | 2462.73 |  2478.36 | 2024-07-17 13:09 | TARGET        |  2    |
| 2024-08-22 08:25 | BUY         | 2503.94 | 2499.05 |  2513.72 | 2024-08-22 11:38 | STOP          | -1.03 |
| 2024-09-02 01:15 | SELL        | 2501.91 | 2505.18 |  2495.36 | 2024-09-02 02:06 | TARGET        |  2    |
| 2024-10-17 12:00 | BUY         | 2681.42 | 2676.68 |  2690.91 | 2024-10-17 12:30 | STOP          | -1.02 |
| 2024-11-13 08:45 | SELL        | 2608.94 | 2612.85 |  2601.12 | 2024-11-13 13:30 | STOP          | -1.02 |

With a $200 account, trades whose stop is wider than about $9.60 are skipped (`RISK_MIN_VOL_EXCEEDS`), so the tester may show fewer trades than this list.

## Then demo

Run it on a **Deriv demo** account, XAUUSDmicro, any chart timeframe (logic uses M5/M15/H1/H4 internally). Expect very few trades: about 8 per year.
