# Liquidity Hunter — Phase 19 First Response

**Spec version:** LH-SPEC v0.1 (draft, not frozen)
**Status:** Planning only. No code written, no data loaded, no tests run, no results exist.
**Date:** 2026-10-21

Everything below is a proposal or a definition. Nothing here is a research result.
Numbers marked **[DEFAULT]** are starting values that need your approval (Section I).

---

## A. Feasibility and assumption audit

### A.1 What is feasible

| Item | Feasible? | Notes |
|---|---|---|
| Detecting swings, BOS/CHoCH, ranges, sweeps, retests from OHLC | Yes | Pure rule-based, can be made non-repainting. |
| Python event-level research on M5/M15/H1/H4 | Yes | Needs clean data per instrument. |
| M1 execution research | Partly | Needs tick or reliable M1 bid/ask data; M1 OHLC alone hides intrabar order of high/low. |
| MQL5 indicator + EA sharing the same rules | Yes | Requires one spec and parity tests. |
| Broker-correct sizing, stops, lockouts, restart recovery | Yes | Standard engineering. |
| Knowing where real stop orders sit | **No** | OHLC cannot show this. "Liquidity pool" will mean "price level where stops are *plausibly* clustered", nothing more. |
| Knowing "institutional intent" | **No** | Not measurable from our data. Will not be used as a feature or label. |
| Real volume / order flow on FX & CFDs | **No / weak** | MT5 FX "volume" is tick count from one broker. Usable only as a documented proxy, off by default. |
| Guaranteed profitability | **No** | Not claimable. The likely outcome of honest testing for many SMC-style rules is "no edge after costs". That is an acceptable result. |

### A.2 Assumptions in the brief that are unproven (treated as hypotheses)

1. Sweeps of equal highs/lows or prior-day levels are followed by reversal more often than chance. — **Unproven.**
2. Displacement after a sweep improves follow-through. — **Unproven.**
3. A mandatory retest improves expectancy (vs. losing trades that never retest). — **Unproven; retest filters also remove the strongest moves.**
4. H4 alignment improves lower-timeframe setups. — **Unproven.**
5. Pyramiding into confirmed continuation improves risk-adjusted return. — **Unproven; usually raises tail risk.**
6. One rule set transfers across FX, gold, crypto, synthetics. — **Assumed false until shown.**

### A.3 Main risks to the project

- **Overfitting:** the full A→H experiment ladder × exits × instruments × timeframes creates hundreds of variants. Multiple-testing correction is mandatory (Section F).
- **Small samples:** a fully filtered setup (sweep + reclaim + displacement + retest + HTF alignment) may fire only a few times per month per symbol. Statistical power may be too low to conclude anything.
- **Cost sensitivity:** M1/M5 entries with tight structural stops make spread a large fraction of risk. Cost modelling decides viability.
- **Research vs. MT5 divergence:** different data feeds, candle timestamps (broker server time) and fill models.

### A.4 Missing information (cannot proceed past Gate 2 without it)

1. Which broker(s) and account type (netting/hedging, raw/standard, commission).
2. Account currency and planned starting balance.
3. Exact instrument list (first batch).
4. Data access: MT5 terminal exports available? Tick history depth? Any paid data source?
5. Broker server timezone and DST policy.
6. Your maximum acceptable drawdown and risk per trade.
7. Intended use: personal account, prop-firm challenge (has its own hard rules), or other.

---

## B. Formal definitions (both models)

All definitions use **closed candles only** unless stated. `ATR(n)` = Wilder ATR on the stated timeframe, computed from closed bars only. `tick` = instrument tick size.

### B.1 Shared primitives

**B.1.1 Swing high/low (confirmed fractal)**
- Bar `i` is a swing high on TF if `High[i] > High[i-k]` for `k=1..L` and `High[i] >= High[i+k]` for `k=1..R`.
- Parameters: `L` **[DEFAULT 2]**, `R` **[DEFAULT 2]**.
- `swing_time = open_time[i]`; `known_time = close_time[i+R]`. The swing may not be used before `known_time`.
- Ties: the left side is strict, the right side allows equality so a flat top produces one swing (the earliest bar).

**B.1.2 Structure states (per TF)**
- Sequence of confirmed swings → labels HH/HL/LH/LL vs. the previous swing of the same type.
- **BOS (bullish):** in a bullish structure, a bar **closes** above the last confirmed swing high by ≥ `max(b_atr·ATR, b_ticks·tick)` **[DEFAULT b_atr=0.05, b_ticks=2]**.
- **CHoCH (bullish):** in a bearish structure, a bar closes above the last confirmed *lower high* by the same tolerance.
- Mirror for bearish.
- **Structural failure:** close beyond the protected swing (the swing low that created the last bullish BOS, or mirror).

**B.1.3 Regime (per TF, primarily H4)**
- `BULL_TREND`: last BOS bullish AND last two confirmed swings are HH and HL AND protected low intact.
- `BEAR_TREND`: mirror.
- `RANGE`: an active Consolidation (B.1.6) exists on that TF, or the last N=6 swings stay inside a band ≤ `r_atr·ATR` **[DEFAULT 3.0]**.
- `TRANSITIONAL`: a CHoCH printed and no BOS has yet confirmed the new direction.
- `INSUFFICIENT_DATA`: fewer than `min_swings` **[DEFAULT 6]** confirmed swings or ATR warm-up incomplete.
- Each state transition is logged with its triggering bar.

**B.1.4 Liquidity pools**
| Type | Definition |
|---|---|
| `EQH`/`EQL` | ≥2 confirmed swing highs (lows) within `eq_tol = max(0.1·ATR, 3 ticks)` **[DEFAULT]**, separated by ≥ `eq_min_bars` **[DEFAULT 5]** bars, not breached between them. Level = max (min) of the members. |
| `SWING` | Any confirmed swing high/low on H1/H4. |
| `PDH/PDL` | Previous trading day high/low. Day boundary = configurable, **[DEFAULT 17:00 New York]**. |
| `PWH/PWL` | Previous week high/low, same boundary. |
| `SESSION` | High/low of configured session windows (Asia, London, NY) **[DEFAULT times in New York time, DST-aware]**. |
| `RANGE_EXT` | Upper/lower boundary of an active consolidation (external range liquidity). |
| `RANGE_INT` | Swings formed *inside* an active range (internal liquidity). |

Zone record fields: `id, tf, type, created_known_time, price_lo, price_hi, status{ACTIVE, SWEPT, RECLAIMED, BROKEN, EXPIRED}, age_bars, sweep_time, reclaim_time, retire_reason`. Zones are never deleted; they are retired with a reason. Max age **[DEFAULT 200 bars of origin TF]**.

**B.1.5 Sweep and reclaim (bearish sweep of a high; mirror for lows)**
- **Interaction:** `High > level`.
- **Sweep:** `High ≥ level + s_min` where `s_min = max(0.05·ATR, 2 ticks)`, AND `High ≤ level + s_max` with `s_max = 1.0·ATR` **[DEFAULT]** (deeper = treated as breakout, not sweep).
- **Reclaim:** within `rc_bars` **[DEFAULT 3]** bars of the sweep bar (sweep bar included), a bar **closes** back below `level`.
- **Breakout (not a sweep):** a close ≥ `level + b_tol` before a reclaim → pool status `BROKEN`.
- Recorded: sweep depth (ATR units), bars to reclaim, reclaim close distance.

**B.1.6 Consolidation**
- Window of `n` bars, `n_min ≤ n` **[DEFAULT n_min = 8]**.
- Range width `W = maxHigh − minLow ≤ c_atr · ATR(14)` measured at window start **[DEFAULT c_atr = 2.5]**.
- Overlap: ≥ `ov` **[DEFAULT 60%]** of bars overlap the previous bar's range by ≥50%.
- Valid on close of bar `n_min` meeting both; expands while new bars keep `W` within limit; **breaks** on a close beyond a boundary by `b_tol`; **invalid** if `W` exceeds limit without a close break (re-starts).

**B.1.7 Displacement**
- A sequence of 1–3 consecutive same-direction bars where:
  - total net move (close−open of the sequence) ≥ `d_atr · ATR` **[DEFAULT 1.5]**,
  - each bar body/range ≥ `d_body` **[DEFAULT 0.6]**,
  - last bar closes in the outer `d_close` **[DEFAULT 25%]** of its range,
  - AND the sequence produces a BOS/CHoCH on the setup TF (or closes beyond a range boundary).
- Optional imbalance flag: a fair-value gap (bar1.high < bar3.low for bullish) — recorded, not required by default.

**B.1.8 Retest zone and retest state**
- **Zone creation:** the origin of the displacement: from the open of the last opposite-coloured bar before displacement to that bar's extreme **[DEFAULT "order-block" style]**; alternative modes for testing: FVG zone, broken-level ± `0.1·ATR`.
- **Touch:** a closed execution-TF bar whose low (bullish) trades into the zone.
- **Hold confirmation (closed candle, execution TF):** after touch, a bar closes back outside the zone in trade direction AND does not close beyond the zone's far edge.
- **Invalidation:** any close beyond the far edge, OR the setup's structural stop level traded, OR expiry.
- **Expiry:** `rt_max` **[DEFAULT 24 bars of M15 = 6 h]**.
- **Max entry distance:** entry ≤ `0.5 · ATR(M15)` from the zone's near edge; else skip ("chased").
- **No retest:** if price reaches 1R in the trade direction before any touch, the setup is cancelled ("missed — no retest").

### B.2 Model A — Liquidity Reversal (state machine)

```
IDLE → POOL_ACTIVE → SWEPT → RECLAIMED → DISPLACED → ZONE_SET → TOUCHED → CONFIRMED → ARMED → (ENTERED | REJECTED)
            any state → INVALIDATED / EXPIRED (with reason code)
```
1. **Pool:** H1 or H4 pool (types from B.1.4), status ACTIVE.
2. **HTF context:** H4 regime recorded. Model A allows counter-H4 trades only if pool is H4-origin (`SWING`, `PDH/PDL`, `PWH/PWL`, `EQH/EQL`) **[DEFAULT]**; this is a test variable (experiment B).
3. **Sweep** (B.1.5) on M15 or higher.
4. **Reclaim** (B.1.5).
5. **Displacement + CHoCH** on M15 in reversal direction within `disp_window` **[DEFAULT 12 M15 bars]** after reclaim.
6. **Zone** (B.1.8).
7–8. **Retest + hold** on M5 (execution TF).
9. **Entry:** next execution-TF bar open after confirmation (market order) **[DEFAULT]**. **Stop:** beyond sweep extreme + `stop_buf = max(0.1·ATR(M15), spread·1.5)`. **Target:** see Section F exits; default = nearest opposing H1 pool, minimum net R:R ≥ 1.5 after costs, else reject.
10. **Risk/execution checks** (Section E).

### B.3 Model B — Trend Continuation (state machine)

```
IDLE → H4_TREND → H1_ALIGNED → PULLBACK → DISPLACED_BOS → ZONE_SET → TOUCHED → CONFIRMED → ARMED → (ENTERED | REJECTED)
```
1. **H4 direction:** `BULL_TREND` or `BEAR_TREND` only.
2. **H1 alignment:** H1 regime same direction OR `TRANSITIONAL` returning toward H4 direction (H1 CHoCH back in H4 direction).
3. **Pullback:** counter-move on M15 that (a) retraces 30–79% **[DEFAULT]** of the last H1 impulse leg, AND (b) does not break the H1 protected swing. Optional sub-conditions recorded: internal-liquidity sweep inside pullback, consolidation during pullback.
4. **Displacement + BOS** on M15 in H4 direction.
5–7. Zone, retest, hold — identical to B.1.8.
8. **Stop:** beyond pullback extreme + buffer. **Target:** default next external H1/H4 pool in trend direction, min net R:R ≥ 1.5.
- **Healthy pullback vs. invalidation:** healthy = H1 protected swing intact; invalid = H1 close beyond protected swing → H4/H1 regime re-evaluated, model B disarmed.

### B.4 Separation rules
- Each model has its own parameter file, state machine instance, setup ID namespace (`A-…`, `B-…`), event table, report and OOS set.
- A Model A invalidation never creates a Model B setup. Model B must start from `IDLE`.
- If both models arm in opposite directions on the same symbol: **both rejected** (`CONFLICT_AB`) **[DEFAULT]**.

### B.5 Timeframe conflict rules
| Situation | Action |
|---|---|
| H4 `INSUFFICIENT_DATA` | No trades on symbol. |
| H4 `TRANSITIONAL` or `RANGE` | Model B disabled; Model A allowed only on range-boundary pools. |
| H1 opposes H4 (both trending) | Model B disabled; Model A allowed (that is the reversal case). |
| Execution TF signal opposes H4 trend | Allowed only for Model A per B.2 step 2. |
| Higher-TF candle not closed | Only the last *closed* HTF candle is used. HTF bar `t` is visible to LTF only after `close_time(t)` ≤ LTF decision time. |

---

## C. Python research architecture and data pipeline

### C.1 Layout (proposed)
```
liquidity-hunter/
  spec/            lh_spec.yaml (single source of truth: params, reason codes, enums)
  research/
    lh/
      data/        ingest.py, validate.py, calendar.py, instruments.py
      mtf/         resample.py, align.py (HTF visibility by close_time)
      structure/   swings.py, bos_choch.py, regime.py
      liquidity/   pools.py, sweep.py
      patterns/    consolidation.py, displacement.py, retest.py
      models/      model_a.py, model_b.py (state machines)
      sim/         fills.py, costs.py, sizing.py, portfolio.py, exits.py
      analysis/    metrics.py, stats.py, robustness.py, reports.py
    tests/         unit + look-ahead tests per module
    notebooks/     inspection only, never the source of results
  mql5/            (Phase 14+)
  docs/
  data/            (git-ignored; hashes + manifests committed)
```
- Python 3.12, pandas, NumPy, SciPy, statsmodels, pyarrow (Parquet), pytest, hypothesis (property tests), matplotlib. Pinned in `requirements.lock`.
- **Custom event-driven simulator** **[DEFAULT]**, because generic frameworks don't model bid/ask stops, MT5 volume steps, or our state machines correctly. vectorbt/backtrader only as a cross-check if useful.

### C.2 Data pipeline
1. **Ingest** MT5 exports (bars with spread column; ticks with bid/ask) → raw Parquet, SHA-256 hashed, manifest recorded.
2. **Validate** (fails loudly, writes report):
   - duplicate / missing timestamps vs. trading calendar,
   - `low ≤ min(open,close) ≤ max(open,close) ≤ high`,
   - monotonic time, gap list, weekend/holiday handling,
   - server-time → UTC conversion with DST check,
   - zero/negative/absurd spreads, bid > ask,
   - contract-spec snapshot (tick size/value, volume min/max/step, stops level, freeze level).
3. **Normalise** to UTC; build M1→M5/M15/H1/H4 from the same source to guarantee consistency (and compare to broker's native HTF bars).
4. **Features** computed bar-by-bar with an explicit `available_at` column.
5. **Look-ahead tests:** for every feature, recompute on data truncated at time `t` and assert identical value at `t` (truncation test). Mandatory per module.

### C.3 Event dataset
One row per candidate setup at every state it reached, including failures. Columns as listed in brief §8.2, plus `spec_version, git_sha, param_hash, data_hash, state_reached, reason_code`. MFE/MAE measured in R and ATR from bid/ask path.

### C.4 Execution simulation
- Bid/ask aware: longs fill at ask, stops on bid; shorts mirror.
- When only M1 bars exist: intrabar order resolved **pessimistically** (stop assumed hit before target in the same bar) **[DEFAULT]**; tick data used when available.
- Slippage: market entries + stop exits add `slip` ticks **[DEFAULT: instrument-specific, from MT5 demo measurements; until then 1× median spread]**.
- Commission and swap per instrument registry.

---

## D. Multi-market validation methodology

1. **Instrument registry** (`instruments.yaml`): market type, broker, symbol, tick size/value, contract size, volume limits, trading hours, typical/peak spread, commission, swap, data source, data quality grade.
2. **Proposed first batch [DEFAULT, needs approval]:** EURUSD, GBPUSD, USDJPY, XAUUSD. Add one index CFD (e.g. US500) and BTCUSD only after the first batch is through Gate 3. Synthetic indices excluded initially (broker-generated, no external validation of the process).
3. **Per-instrument pipeline:** validate data → Model A experiments → Model B experiments → costs → OOS → robustness → pass/fail report. Results never pooled to hide a failing instrument. Pooled stats may be shown *alongside* per-instrument ones, never instead.
4. **Parameter policy:** one shared parameter set in ATR units is the default. Instrument-specific values allowed only if (a) pre-registered as a test, (b) chosen on development data only, (c) still pass OOS, and (d) counted in the multiple-testing correction.
5. **Data periods [DEFAULT, depends on data available]:**
   - Development: 2018-01 → 2022-12
   - Validation: 2023-01 → 2024-12
   - Final out-of-sample (touched once, after freeze): 2025-01 → 2026-06
   - Demo forward: after Gate 8 prep, minimum 3 months / 50 trades, whichever is later.

---

## E. Risk model and failure handling

### E.1 Stop and sizing
- Stop = structural invalidation + buffer (B.2/B.3). Never widened after entry.
- `risk_money = equity × risk_pct` **[DEFAULT equity-based, risk_pct 0.5%]**.
- `loss_per_lot = |entry − stop| / tick_size × tick_value_in_account_ccy + commission_per_lot_roundtrip + est_spread_slip_cost`.
- `lots = floor_to_step(risk_money / loss_per_lot)`; clamp to `volume_max`; if `< volume_min` → reject `RISK_MIN_VOL_EXCEEDS`.
- Cross-currency tick value via live conversion rate (`SYMBOL_TRADE_TICK_VALUE_LOSS` in MT5).
- Reject if stop distance < broker `STOPS_LEVEL` + spread.

### E.2 Portfolio / account limits **[all DEFAULT]**
| Limit | Value | Basis |
|---|---|---|
| Risk per trade | 0.5% | equity at entry |
| Total open risk | 2.0% | sum of (entry→stop) risk of all open positions; positions at break-even still count spread+slippage risk to the stop, and gap risk is noted |
| Daily loss | 2.0% | realised + floating vs. equity at daily reset (17:00 NY); commissions included; hit → no new entries until reset |
| Max drawdown | 10% | from equity high-water mark; hit → all entries disabled until manual reset |
| Max open positions | 3 | all symbols |
| Max add-ons per base trade | 0 (pyramiding off until justified) | |
| Correlated group exposure | 1.0% | groups e.g. USD-majors, metals |
| Max spread | 2× median spread for that hour | per instrument |
| Max slippage | 0.2R | entry rejected/closed per E.3 |
| Min net R:R | 1.5 | after costs |
| Session filter | configurable, default all sessions except 30 min around daily rollover | |

### E.3 Failure responses
| Event | Response | Reason code |
|---|---|---|
| Order rejected | Log retcode; retry once only if retcode is transient (requote/price changed), with fresh validation; else abandon setup | `ORD_REJECT` |
| SL rejected / missing after fill | Retry SL placement up to 2× within 2 s; if still unprotected → close position at market; lock symbol entries | `UNPROTECTED_CLOSE` |
| SL modify fails | Keep existing SL (never leave none); retry next tick; alert | `SL_MOD_FAIL` |
| Partial fill | Recompute risk on filled volume; keep SL; do not top up | `PARTIAL_FILL` |
| Unexpected position size | Reconcile; if larger than intended → reduce to intended; lock entries | `SIZE_MISMATCH` |
| Disconnect / restart | On init: rebuild state from open positions + persisted setup file (setup IDs in order comment/magic); no new entries until reconciliation completes | `RECOVERY` |
| Stale data (no tick > N s in session) | Block entries | `STALE_FEED` |
| Spread > max | Block entries | `SPREAD_HIGH` |
| Slippage > max | If SL still valid, keep; if risk now > 1.5× planned, close | `SLIP_EXCESS` |
| Invalid broker params | Disable symbol | `BAD_SYMBOL_PARAMS` |

Stops are broker-side. A stop order does not guarantee its price; gaps and slippage are modelled and reported.

---

## F. Baseline experiments and predeclared acceptance criteria

### F.1 Experiment ladder (per model, per instrument, per direction)
| ID | Rule set | Baseline compared against |
|---|---|---|
| A0 | Random entries, same session/frequency, same stop/target logic | — (null) |
| A | Sweep + reclaim, enter on reclaim close | A0; and "level touch without reclaim" |
| B | A + H4 alignment rule | A |
| C | B + displacement + CHoCH | B |
| D | C + mandatory retest | C (enter at displacement close, no retest) |
| E | D + consolidation requirement | D |
| F | Model B ladder (trend-only entries → + pullback → + BOS → + retest) | trend-only random entries |
| G | Exits: fixed 2R, opposing pool, structural target, partial 50% at 1R + trail, time exit | best entry set, exit-only variation |
| H | Pyramiding 0 / 1 / 2 add-ons | best frozen configuration |

Each step must improve **net expectancy (R, after costs)** over its predecessor with the test in F.3, or the added condition is dropped and that is reported.

### F.2 Acceptance criteria (per instrument, per model, on final OOS) **[DEFAULT, to be frozen before any OOS run]**
1. ≥ 100 OOS trades (else: "insufficient evidence", not "pass").
2. Net expectancy > 0.10R after all costs, with 95% bootstrap CI lower bound > 0.
3. Profit factor ≥ 1.25.
4. Max drawdown at 0.5% risk ≤ 10%.
5. Max losing streak within the 95th percentile of Monte Carlo resamples of development trades.
6. Expectancy remains > 0 when costs are increased by 50%.
7. Parameter neighbourhood: ±20% on each main parameter keeps expectancy > 0 in ≥ 70% of neighbours (development data only).
8. Walk-forward (rolling 24 m train / 6 m test) efficiency ≥ 50%.
9. Beats its predecessor baseline per F.3.

### F.3 Statistics
- Block bootstrap (block = 1 week) on trade R for CIs, to respect serial dependence.
- Overlapping trades: metrics on daily portfolio R series as well as per-trade.
- Multiple testing: count every configuration tried; apply Holm-Bonferroni across the ladder, and report Deflated Sharpe Ratio for the final selection.
- All tried configurations logged in an experiment registry (git SHA, params, data hash, result) — including failures.
- The final OOS segment is opened **once**. If a model fails, it is reported as failed; further tuning requires a new, later OOS period (e.g. demo forward data).

---

## G. Proposed MQL5 architecture

```
MQL5/
  Include/LiquidityHunter/
    LH_Spec.mqh          constants + reason codes generated from lh_spec.yaml
    LH_Data.mqh          closed-bar access, HTF sync (iTime/CopyRates, close-time gating)
    LH_Structure.mqh     swings, BOS/CHoCH, regime
    LH_Liquidity.mqh     pools, sweep/reclaim
    LH_Patterns.mqh      consolidation, displacement, retest zones
    LH_ModelA.mqh        state machine
    LH_ModelB.mqh        state machine
    LH_Risk.mqh          sizing, limits, lockouts
    LH_Execution.mqh     CTrade wrapper, SL enforcement, retries, partial fills
    LH_Persistence.mqh   setup/state file in MQL5/Files, restart recovery
    LH_Logger.mqh        CSV/JSON structured logs with reason codes
  Indicators/LiquidityHunter.mq5   draws state; calls same Include modules
  Experts/LiquidityHunterEA.mq5    OnInit recovery → OnTick (new-bar gate) → models → risk → execution
```
- Indicator and EA include identical modules (no `iCustom` signal coupling), so logic is shared at source level.
- New-bar processing only; intrabar used solely for stop/limit monitoring and risk checks.
- Magic number per model; order comment carries setup ID.
- Netting accounts: pyramiding becomes volume additions to one position with a single SL → add-on logic must account for that; documented as a separate tested mode. Hedging: separate tickets.
- Parity test: Python and MQL5 both output a signal CSV for the same data; diff must be empty or every difference explained.

---

## H. Independent testing plan

1. **Unit tests** per module (Python pytest; MQL5 test scripts on fixed synthetic bars).
2. **Look-ahead / truncation tests** (C.2 step 5) for every feature and signal.
3. **Golden datasets:** hand-labelled charts (≥ 50 examples per event type) checked against engine output.
4. **Repaint test (MT5):** run indicator live on demo, snapshot signals each bar, compare with historical recalculation — must be identical.
5. **Python ↔ MT5 parity:** signals, entries, stops, sizes on the same period.
6. **Fault-injection in Strategy Tester / demo:** rejected orders, missing SL, restart mid-trade, spread spikes, disconnect.
7. **Independent reviewer:** a person or team not involved in writing the code, given spec, code, configs, data manifests and reproduction steps. **Note: I (Claude) cannot be the independent reviewer of my own work, and no independent review has happened.** You will need to arrange one, or the project stays classified "not independently validated".

---

## I. Decisions requiring your approval

| # | Decision | Recommended default | Consequence |
|---|---|---|---|
| 1 | Repository | Move to a dedicated repo (e.g. `liquidity-hunter`) | This repo is a business-suite project; mixing is messy. Draft placed here only because it is the assigned branch. |
| 2 | Broker / account type | You choose; prefer a raw-spread ECN with hedging account and MT5 tick history | Determines costs, data and netting vs. hedging logic. |
| 3 | First instruments | EURUSD, GBPUSD, USDJPY, XAUUSD | More instruments = more tests = stricter multiple-testing penalty. |
| 4 | Execution TF | M5 first; M15 and M1 later as separate tests | M1 needs tick data and is most cost-sensitive. |
| 5 | Risk per trade | 0.5% | Higher risk inflates drawdown; prop-firm rules may require less. |
| 6 | Daily loss / max DD | 2% / 10% | Tighter limits reduce ruin risk and trade count. |
| 7 | Day boundary | 17:00 New York | Affects PDH/PDL and daily-loss reset. |
| 8 | Counter-H4 reversals (Model A) | Allowed only at H4-origin pools | Disallowing reduces trades; allowing raises risk. Tested either way. |
| 9 | Retest zone type | Order-block style, FVG and broken-level as test variants | Each variant counts toward multiple testing. |
| 10 | Entry order type | Market at next bar open after confirmation | Limit orders improve price but miss trades; tested later. |
| 11 | Pyramiding | Off | Enabled only if experiment H passes. |
| 12 | Acceptance criteria (F.2) | As written | Must be frozen *before* OOS run; changing later invalidates the OOS. |
| 13 | Data periods (D.5) | As written | Depends on actual data depth available. |
| 14 | Volume as a feature | Off | MT5 tick volume is a weak proxy. |

---

## J. Staged roadmap

| Stage | Output | Gate |
|---|---|---|
| 0 | Approve Section I; freeze LH-SPEC v1.0 | Gate 1 |
| 1 | Data ingestion + validation + data-quality report per instrument | Gate 2 |
| 2 | Structure, liquidity, pattern modules with truncation tests + golden sets | Gate 4 (research side) |
| 3 | Event datasets + simulator + cost model; experiments A0→E, F | Gate 3 |
| 4 | Exit study (G), pyramiding study (H) on development/validation data | — |
| 5 | Risk engine tests (sizing, limits, failures) in Python | Gate 5 (spec side) |
| 6 | Freeze rules; single OOS run; walk-forward; robustness; per-instrument reports | Gate 7 |
| 7 | MQL5 indicator + EA; compile; unit + parity + repaint tests | Gates 4, 5, 6 |
| 8 | MT5 Strategy Tester (real ticks), reconciliation with Python | Gate 8 (historical) |
| 9 | Demo forward test, frozen rules, ≥ 3 months | Gate 8 (forward) |
| 10 | Independent review, defect list, final acceptance report, limitations | Gate 9 |

If Stage 3 or 6 shows no edge after costs, the honest outcome is to stop or re-hypothesise, not to proceed to MQL5 with a failing model.

**Next action needed from you:** answers to Section A.4 and Section I.
