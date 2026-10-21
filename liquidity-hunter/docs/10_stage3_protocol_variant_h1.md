# Stage 3 protocol — Variant "H1": both models one timeframe higher

**Written and committed before this variant was run.** This is the only new variant planned after Models A and B failed (docs/07, docs/09). It is a new hypothesis, chosen for two reasons stated before testing:

1. On M15, structure flipped too often (CHoCH as frequent as BOS; ~40% of bars TRANSITIONAL).
2. A higher timeframe gives larger stops, so spread and slippage are a smaller share of each trade.

No other parameter changes. If this variant also fails, the research conclusion stands: no edge found. No further variants on this development data.

## What changes (every timeframe role moves up one level)

| Role | Original | Variant H1 |
|---|---|---|
| Setup timeframe (sweeps, structure breaks, displacement, consolidation, order-block zone) | M15 | **H1** |
| Retest confirmation | M5 | **M15** |
| Model A higher-timeframe alignment | H4 | **D1** |
| Model B primary trend | H4 | **D1** |
| Model B intermediate alignment and pullback leg | H1 | **H4** |
| Retest expiry (time) | 6 h | **24 h** (same 24 setup bars) |
| Maximum holding time | 24 h | **96 h**, still closed by Friday 16:50 New York |

Everything counted in bars stays the same (swing 2/2, ATR 14, displacement ≤ 3 bars and 1.5 ATR, reclaim ≤ 3 bars, displacement window 12 bars, consolidation 8 bars, order-block lookback 10 bars). Pools: H1 and H4 swings, H1 equal highs/lows, previous day/week, sessions — swept now on H1 bars. D1 bars are anchored at 00:00 UTC (Deriv server midnight, as on the MT5 chart).

Trade rules, costs, statistics and decision rule: unchanged (docs/06, docs/08). Random baselines are drawn at H1 closes.

## Tests

- Model A family: A vs A0, B vs A, C vs B, D vs C, E vs D (Holm over 5).
- Model B family: B1 vs B0, B2 vs B1, B3 vs B2, B4 vs B3 (Holm over 4).

Running total on the development data after this variant: 18 pre-registered comparisons.

## What a "pass" would mean

A step that passes is only a candidate. It would then be run **once** on the validation year (2025) with all rules frozen. Only if it also holds there would it go to the final 2026 test.
