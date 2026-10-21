# Decisions Log

Spec version after this log: **LH-SPEC v0.2** (not frozen).

## 2026-10-21 — User answers to Phase 19 questions

| Topic | Decision | Source |
|---|---|---|
| Brokers | Exness and Deriv | User |
| Research data | Deriv XAUUSD (M1 bars + ticks, MT5 exports) | User |
| Account type | Hedging | User |
| Account currency | USD | User |
| Instruments | XAUUSD, EURUSD | User |
| Risk per trade | 0.5% of equity | User |
| Max drawdown | 10% from equity high-water mark | User |
| Use | Personal account (no prop-firm rules) | User |

### Implications

1. **Research results will apply to Deriv only.** Spreads, commissions, swaps, server time and price feed differ between Deriv and Exness. A model validated on Deriv data is *not* validated for Exness. Exness needs its own data and cost check (at minimum tick data covering the OOS period) before the EA trades there.
2. **Hedging account:** each pyramid add-on is a separate ticket with its own stop. Netting mode is out of scope unless requested.
3. **Only two instruments:** fewer tests → smaller multiple-testing penalty. Each is still reported separately.
4. **XAUUSD is the main instrument.** Gold's price level and volatility changed a lot from 2018 to 2026, so all thresholds stay in ATR units, never fixed dollars.
5. **Personal account:** the 2% daily loss and 10% drawdown limits are our own risk policy, not external rules.

## Defaults adopted (not answered; can be changed before spec freeze)

| # | Item | Adopted default |
|---|---|---|
| 1 | Repository | Stay in `setwel-biz-suite/liquidity-hunter/` for now; a dedicated repo is still recommended |
| 4 | Execution timeframe | M5 first; M15 and M1 tested later and separately |
| 6 | Daily loss limit | 2% |
| 7 | Day boundary | 17:00 New York |
| 8 | Counter-H4 reversals | Only at H4-origin pools |
| 9 | Retest zone | Order-block style (FVG, broken-level as variants) |
| 10 | Entry order | Market at next bar open after confirmation |
| 11 | Pyramiding | Off until experiment H passes |
| 12 | Acceptance criteria | As in Phase 19 doc, Section F.2 |
| 13 | Data periods | As in Section D.5, adjusted to the history actually supplied |
| 14 | Volume feature | Off |

## Still open

1. Which broker will the EA actually trade on first: Deriv, Exness, or both?
2. Will EURUSD data also come from Deriv?
3. Exness account type (Standard / Raw Spread / Zero / Pro), because it decides costs.
4. Commission per lot on each account (from the broker's fee page).

## Gate status

| Gate | Status |
|---|---|
| 1 Research specification | Definitions drafted (v0.2). Not frozen. |
| 2 Data integrity | Tooling built and unit-tested on synthetic data. **No real data received yet.** |
| 3–9 | Not started |
