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

## 2026-10-21 — Deriv XAUUSD contract spec received

File: `spec/broker_specs/LH_spec_Deriv_BVI_Ltd._XAUUSD.csv` (DerivBVI-Server-02).

| Finding | Consequence |
|---|---|
| Server time = UTC (offset 0) | Simple conversion. Winter data will confirm there is no DST shift. |
| 1.00 lot = 100 oz; $1 gold move = $100 per lot; min 0.01 lot = $1 per $1 move | At 0.5% risk, the smallest trade risks $1 per $1 of stop. With a $1,000 balance ($5 risk), any stop wider than $5.00 must be rejected. **Account balance needed** to know how many setups are tradable. |
| Stop level 20 points ($0.20), freeze level 3 points | Very tight structural stops below $0.20 + spread are rejected. |
| Spread floating, 29 points ($0.29) at export | Real spread statistics will come from tick data. |
| Fill policy FOK only | EA must send orders with FOK filling. |
| Swap: long -$45, short +$20 per lot per night, triple on Wednesday | Included in the cost model for trades held past rollover. Longs held overnight are costly. |
| Daily break ~20:59–22:05 UTC; Friday close 20:45 UTC | Data checks treat this as expected. No entries are allowed in the 30 min before the break (default). |
| **Server history starts 2022-11-09** | Only ~4 years of data. The 2018 start date in the plan is impossible on Deriv. |

### Data periods revised (Deriv XAUUSD)

| Segment | Period | Length |
|---|---|---|
| Development | 2022-11-09 → 2024-12-31 | ~26 months |
| Validation | 2025-01-01 → 2025-12-31 | 12 months |
| Final out-of-sample (opened once) | 2026-01-01 → 2026-09-30 | 9 months |

Risk: 9 months OOS may give fewer than the 100 trades required by acceptance criterion F.2-1. If so, the result is reported as "insufficient evidence", and demo forward testing extends the OOS sample. Gold trended unusually strongly in 2025–2026, so validation and OOS may not resemble development.

## 2026-10-21 — Account balance: $200

0.5% risk = **$1.00 per trade**. On Deriv XAUUSD the smallest trade (0.01 lot) loses $1 per $1 of price move, plus ~$0.29 spread.

| Stop distance (gold) | Risk at 0.01 lot incl. spread | % of $200 |
|---|---|---|
| $0.70 | ~$1.00 | 0.5% |
| $2.00 | ~$2.30 | 1.2% |
| $5.00 | ~$5.30 | 2.7% |
| $10.00 | ~$10.30 | 5.2% |

The trade-size calculation would reject every XAUUSD trade with a stop wider than about $0.70. At that stop width, spread is ~30–40% of the risk. **XAUUSD cannot be traded live at 0.5% risk with $200 on Deriv.**

Research is not affected: results are measured in R (multiples of risk) and do not depend on balance. The constraint applies only to the live EA.

Options put to the user (decision pending):
1. Research now; run demo and live with a larger balance later. **(Recommended)**
2. Use a cent account (smaller contract), if your broker offers one on MT5, so 0.5% risk is possible.
3. Trade EURUSD live first: 0.01 lot = ~$0.10 per pip, so $1 risk allows a ~10-pip stop.
4. Raise risk per trade. Not recommended: at 2.5–5% per trade, the 10% drawdown limit is hit after 2–4 losses.

## Gate status

| Gate | Status |
|---|---|
| 1 Research specification | Definitions drafted (v0.2). Not frozen. |
| 2 Data integrity | Tooling built and unit-tested on synthetic data. **No real data received yet.** |
| 3–9 | Not started |
