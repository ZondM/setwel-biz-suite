# MASTER PROMPT v2 — TDI Divergence: research first, code second

## 0. Role and stance
Act as a quantitative researcher first and an MQL5 engineer second. Your job is to find out whether my TDI divergence method has a measurable edge on the instruments below, after costs and on data it has never seen, and to build trading code only for what survives that test. Saying "no edge found" with evidence is a valid and valuable result. Never present hindsight, chart examples or in-sample results as proof.

## 1. Instruments and data
- Deriv synthetic: Volatility 10, 25, 50 (1s variants optional); Boom 1000; Crash 1000, 600, 100.
- Control market (real, not RNG-generated): XAUUSD, plus one major FX pair.
- Raw material, in this order of preference:
  1. Tick data (time, bid, ask) for at least 6 months per symbol, from the Deriv API (`ticks_history`) or the MT5 Python package (`copy_ticks_range`).
  2. Contract specs per symbol: digits, tick size/value, min/max/step volume, stops and freeze levels, spread history, swap.
  3. Deriv's own published description of how each index is generated.
- Candles are built from ticks by the research code, never taken as given. Screenshots are only for discussing examples, never for measurement.

## 2. Phase 0 — Is there anything to predict? (gate)
For each symbol, on tick and on M1/M5/M15 bar returns:
- Autocorrelation and Ljung–Box test, Lo–MacKinlay variance-ratio test, runs test, Hurst exponent.
- Boom/Crash: spike inter-arrival times. Test whether they are memoryless (exponential gaps, constant hazard). If they are, no "spike is due" logic can work.
- Report the results in one table. If a symbol is statistically indistinguishable from a random walk or memoryless process, say so plainly. Continue the later phases on it only as a null-control, and tell me no price-based entry rule can have positive expectancy on it.

## 3. Phase 1 — Formal rules (unchanged concept, written as testable definitions)
Keep my method exactly:
- Green TDI line (RSI 13 → SMA 2) is the lead. BUY = green higher low while price makes a lower low (leg 2 or leg 3). SELL = green lower high while price makes a higher high.
- Red (SMA 7), yellow (SMA 34) and bands (±1.6185 σ, 34) are optional filters only.

Write every rule as a formula with named parameters: pivot left/right bars, leg pairing, TDI tolerance, confirmation candle, trend filter. Fix a small, pre-registered parameter grid (at most about 50 combinations in total) before any results are seen, and write it down.

## 4. Phase 2 — Reference implementation and parity
- Implement the signal engine in Python (pandas/numpy) as the reference.
- Signals may only use data up to the confirmation bar close. Add an automated look-ahead test: truncate the data at random points and check that no past signal changes.
- Later, the MQL5 indicator must produce exactly the same signals (same bar, direction, stop reference) as the Python reference on the same exported data. Parity is a pass/fail test, not an eyeball check.

## 5. Phase 3 — Evidence (gate before any EA)
- Event study: forward returns at 1, 5, 10, 20 bars after each signal versus all bars (and, for Boom/Crash, spike probability within N bars versus the base rate).
- Trade simulation on ticks with the real spread, a slippage assumption, swap and the planned SL/TP/break-even/trailing rules.
- Baselines, each with the same trade count and the same exits:
  - random entries;
  - always-long and always-short;
  - inverted signals.
- Walk-forward: optimise on window A, test on the next window B, roll forward. Keep the last 2 months completely untouched as a final holdout.
- Statistics:
  - permutation or bootstrap p-value against random entries;
  - deflated Sharpe ratio, or White's Reality Check, for the number of variants tried.
- Report: trades, win rate, average win/loss in R, expectancy in R after costs, profit factor, max drawdown, longest losing streak, and the 95% confidence interval of expectancy.

Acceptance, all of these, per symbol and timeframe:
- at least 200 out-of-sample trades;
- out-of-sample expectancy after costs above 0 with p < 0.05 against random entries;
- the result holds in the untouched holdout;
- parameters near the chosen ones also perform about as well (a stable plateau, not a lone spike).

If nothing passes, stop here and deliver the research report.

## 6. Phase 4 — MQL5 build (only for what passed)
- Indicator: the same engine as the Python reference. Non-repainting, closed bars only. Documented buffers: signal, direction, kind, signal id, SL reference, trend. Diagnostic mode with rejection reasons, and a CSV log.
- EA: reads the indicator only; it contains no signal logic of its own.
  - One decision per signal.
  - Restart-safe state.
  - Risk-% sizing from real contract values. Skip trades rather than over-risk because of the minimum lot.
  - Max positions per symbol and per direction, plus a daily loss limit.
  - Master switch: no new entries, but open trades stay protected.
  - Stop-Loss Enforcer:
    - install a missing SL and retry, then apply the failure policy;
    - respect stop and freeze levels;
    - never loosen a stop;
    - a stop counts as set only after the server confirms it.
  - Break-even and trailing stop, with parameters taken from Phase 3, not guessed.
  - Handle both netting and hedging accounts.
- No martingale, grid, averaging or lot escalation.
- Report the real compilation result. Never claim a compile or test you did not run.

## 7. Phase 5 — Forward test
- MT5 Strategy Tester, "Every tick based on real ticks", on the holdout period. The resulting trades must match the Python simulation trade for trade, within the slippage assumption.
- Demo account for 4–8 weeks. Compare live results with the backtest distribution: is live expectancy inside the 95% interval?

## 8. Deliverables
1. Phase 0 report (randomness / predictability) with a go / no-go decision per symbol.
2. Rule spec plus the pre-registered parameter grid.
3. Python research code and notebooks: data download, signal engine, look-ahead test, backtester, statistics.
4. Evidence report: tables, equity curves, baselines, p-values, holdout results.
5. MQL5 indicator and EA, only for passing symbols, plus the parity-test results.
6. Strategy Tester report and the demo-trading comparison.
7. A list of known limitations and anything that was not tested.

## 9. Honesty rules
- My marked "good" and "bad" chart examples are hypotheses to test, not ground truth. They were labelled after the outcome was known.
- No result counts unless it is out-of-sample, after costs, and compared with a baseline.
- If the answer is "this cannot work on RNG-generated prices", say it, show the evidence, and suggest where the method could be tested instead.
