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

## 2026-10-21 — Deriv XAUUSDmicro spec received

File: `spec/broker_specs/LH_spec_Deriv_BVI_Ltd._XAUUSDmicro.csv`. 1 lot = 1 oz (XAUUSD: 100 oz). Min 0.1 lot, step 0.1.

Smallest trade = **$0.10 per $1 move**, 10x smaller than XAUUSD's smallest trade.

| Stop distance | Volume for $1 risk (rounded down) | Actual risk | % of $200 |
|---|---|---|---|
| $2 | 0.4 | ~$0.96 | 0.48% |
| $5 | 0.1 | ~$0.54 | 0.27% |
| $9.50 | 0.1 | ~$0.99 | 0.50% |
| > ~$9.60 | below 0.1 → rejected | — | — |

(Risk includes the 40-point spread seen at export.) Rounding to 0.1-lot steps often puts actual risk below 0.5%. It is never above.

**Decision:** live execution candidate = `XAUUSDmicro` on Deriv. This makes 0.5% risk on $200 workable for stops up to about $9.60.

Checks still needed:
1. **Same price feed?** Research uses XAUUSD history (longer in the terminal). One overlapping month of ticks from both symbols will be compared. If the prices differ, research must use XAUUSDmicro data.
2. **Spread:** 40 points on micro vs 29 on XAUUSD, but the two snapshots were taken at different times close to the daily break. Tick data decides.

## 2026-10-21 — Scope and costs

| Topic | Decision | Source |
|---|---|---|
| Instruments | **Gold only (Deriv XAUUSDmicro)** for now; EURUSD deferred | User |
| Commission | **$0** on Deriv XAUUSDmicro (spread-only) | User |

## 2026-10-21 — After the research result

| Decision | Source |
|---|---|
| Test one pre-registered variant (H1), then build the indicator only (no EA) | User ("option 2 then 3") |
| Variant H1 failed (docs/11). EA development stays blocked by Gate 3. The indicator is built as a **visual chart tool with no claim of edge**. | Result |

## 2026-10-22 — Project reclassified as UNVALIDATED; Model B EA to be built

| Decision | Source |
|---|---|
| Build the Model B EA despite Gate 3 failing | User ("finalize the EA") |
| Strategy rules are **not** changed after seeing results (that would be fitting to the data). The EA implements Model B exactly as pre-registered (docs/08, step B4: H4 trend, H1 aligned, M15 CHoCH pullback 30–79%, displacement, mandatory M5 retest, 2R target) | Research discipline |
| Per Master Prompt Phase 17, the project is **explicitly reclassified as unvalidated**: no evidence of edge (docs/09: B4 = +0.05R on 17 dev trades, CI −0.66 to +0.76) | Phase 17 |
| EA trades **demo accounts only by default** (input `InpAllowLive=false`). Live trading requires the user to change that input knowingly | Risk control |

## Gate status

| Gate | Status |
|---|---|
| 1 Research specification | Spec v0.4: all pattern definitions implemented (docs/05, docs/06). |
| 2 Data integrity | **PASS for Deriv XAUUSDmicro**: M1 bars 2022-11 → 2026-10 (docs/03), ticks Sep 2026 (docs/04). Cost model set. Commission still to confirm. EURUSD not received. |
| 4 Signal integrity (research side) | Look-ahead tests pass for structure, liquidity, patterns and Model B decisions (docs/05, tests). |
| 3 Baseline evidence | **FAILED on development data:** Model A (docs/07), Model B (docs/09) and variant H1 of both (docs/11) show no edge; 0 of 18 pre-registered comparisons significant. No further variants. Validation/OOS data unopened. |
| 5–9 | Not started |
