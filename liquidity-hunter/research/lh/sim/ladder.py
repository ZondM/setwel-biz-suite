"""Shared ladder-experiment helpers: run a step, random baseline, report table."""
from __future__ import annotations

import numpy as np
import pandas as pd

from ..analysis.stats import bootstrap_ci, bootstrap_diff_p, holm, summary, week_key
from .trades import ExitParams, M1Market, entry_allowed, simulate


def run_step(mk: M1Market, rows: pd.DataFrame, sig_col: str, atr_col: str, stop_col: str,
             chase_atr: float | None = None, buffer_atr_mult: float = 0.1,
             ex: ExitParams = ExitParams()) -> pd.DataFrame:
    """Simulate one trade per row. If chase_atr is set, skip entries more than
    chase_atr * ATR beyond the row's zone_near (status CHASED)."""
    res = []
    for r in rows.itertuples(index=False):
        sig = getattr(r, sig_col)
        a = getattr(r, atr_col)
        if chase_atr is not None:
            i0 = mk.first_bar_at_or_after(sig)
            if i0 < len(mk.o):
                px = mk.o[i0] + (mk.sp[i0] if r.direction > 0 else 0)
                if r.direction * (r.zone_near - px) > chase_atr * a:
                    res.append({"cand_id": r.cand_id, "status": "CHASED"})
                    continue
        t = simulate(mk, sig, int(r.direction), stop_ref=getattr(r, stop_col), buffer_atr=buffer_atr_mult * a, ex=ex)
        t["cand_id"] = r.cand_id
        res.append(t)
    return pd.DataFrame(res)


def random_baseline(mk: M1Market, m15: pd.DataFrame, atr15: pd.Series, trades: pd.DataFrame,
                    atr_by_cand: pd.Series, n_random: int, seed: int,
                    direction_at: np.ndarray | None = None, ex: ExitParams = ExitParams()) -> pd.DataFrame:
    """For each filled trade, n_random entries at random M15 closes (entry-time filter applied),
    stop distance = the trade's risk in ATR units x ATR at the random bar.

    direction_at: optional per-M15-bar direction (+1/-1/0). If given, only bars with a
    non-zero value are eligible and that value sets the direction; otherwise the
    trade's own direction is used.
    """
    rng = np.random.default_rng(seed)
    ok = np.array([entry_allowed(t) for t in m15["close_time"]]) & ~np.isnan(atr15.to_numpy())
    if direction_at is not None:
        ok &= direction_at != 0
    times = m15["close_time"].to_numpy()[ok]
    atrs = atr15.to_numpy()[ok]
    dirs = direction_at[ok] if direction_at is not None else None
    res = []
    for tr in trades.itertuples(index=False):
        dist_atr = tr.risk / atr_by_cand[tr.cand_id]
        for k in rng.integers(0, len(times), n_random):
            d = int(dirs[k]) if dirs is not None else int(tr.direction)
            t = simulate(mk, pd.Timestamp(times[k]), d, stop_distance=dist_atr * atrs[k], ex=ex)
            t["cand_id"] = tr.cand_id
            res.append(t)
    return pd.DataFrame(res)


def ladder_report(filled: dict, trades: dict, candidates: dict, order: list[str],
                  comps: list[tuple[str, str]], baseline: str) -> tuple[list[str], dict]:
    stats, weeks = {}, {}
    for k in order:
        f = filled[k]
        weeks[k] = week_key(f["entry_time"]) if len(f) else np.array([])
        s = summary(f["r"].to_numpy(), f["entry_time"]) if len(f) else {"n": 0}
        s["ci"] = bootstrap_ci(f["r"].to_numpy(), weeks[k], seed=1) if len(f) else (np.nan, np.nan)
        s["candidates"] = candidates.get(k, len(trades[k]))
        s["rejected"] = trades[k]["status"].value_counts().drop("FILLED", errors="ignore").to_dict() if len(trades[k]) else {}
        if len(f):
            s["exit_reasons"] = f["exit_reason"].value_counts().to_dict()
            s["mean_risk_usd"] = f["risk"].mean()
            s["mean_spread_r"] = f["spread_entry_r"].mean()
            s["by_dir"] = f.groupby("direction")["r"].agg(["count", "mean"]).round(3).to_dict("index")
        stats[k] = s
    diffs = [bootstrap_diff_p(filled[a]["r"].to_numpy(), weeks[a], filled[b]["r"].to_numpy(), weeks[b], seed=2)
             if len(filled[a]) and len(filled[b]) else (np.nan, np.nan) for a, b in comps]
    rej = holm([p for _, p in diffs])
    L = ["## Results per step (after spread, slippage and swap)", "",
         "| Step | Candidates | Trades | Mean R | 95% CI | Win rate | Profit factor | Total R | Max DD (R) | Max losing streak |",
         "|---|---|---|---|---|---|---|---|---|---|"]
    for k in order:
        s = stats[k]
        if s["n"] == 0:
            L.append(f"| {k} | {s['candidates']} | 0 | - | - | - | - | - | - | - |")
            continue
        L.append(f"| {k} | {s['candidates']} | {s['n']} | {s['mean_r']:+.3f} | [{s['ci'][0]:+.3f}, {s['ci'][1]:+.3f}] | "
                 f"{s['win_rate']:.1%} | {s['profit_factor']:.2f} | {s['total_r']:+.1f} | {s['max_dd_r']:.1f} | {s['max_losing_streak']} |")
    L += ["", f"{baseline} = random entries (50 per trade of the first real step); its drawdown and streak are not comparable (50x more trades).", "",
          "## Does each added condition improve the result?", "",
          "| Comparison | Difference in mean R | One-sided p | Holm significant (α=0.05) | Verdict |", "|---|---|---|---|---|"]
    for (a, b), (d, p), r in zip(comps, diffs, rej):
        L.append(f"| {a} vs {b} | {d:+.3f} | {p:.3f} | {'yes' if r else 'no'} | {'adds value' if r else 'not shown to add value'} |")
    L += ["", "## Rejections, exits, direction", ""]
    for k in order:
        s = stats[k]
        L.append(f"- **{k}**: rejected {s['rejected']}; exits {s.get('exit_reasons', {})}; "
                 f"mean risk ${s.get('mean_risk_usd', float('nan')):.2f}/oz; entry spread = {s.get('mean_spread_r', float('nan')):.1%} of R; "
                 f"by direction {s.get('by_dir', {})}")
    return L, {"stats": stats, "diffs": diffs, "holm": rej}
