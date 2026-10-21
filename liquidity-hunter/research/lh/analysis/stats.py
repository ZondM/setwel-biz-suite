"""Trade statistics with weekly block bootstrap and Holm correction (docs/06)."""
from __future__ import annotations

import numpy as np
import pandas as pd


def week_key(times: pd.Series) -> np.ndarray:
    t = pd.DatetimeIndex(times).tz_convert("UTC").tz_localize(None)
    return t.to_period("W-SUN").astype(str).to_numpy()


def summary(r: np.ndarray, times: pd.Series | None = None) -> dict:
    r = np.asarray(r, dtype=float)
    if len(r) == 0:
        return {"n": 0}
    order = np.argsort(pd.DatetimeIndex(times).asi8) if times is not None else np.arange(len(r))
    eq = np.cumsum(r[order])
    dd = float((np.maximum.accumulate(np.r_[0, eq])[1:] - eq).max())
    streak = best = 0
    for x in r[order]:
        streak = streak + 1 if x < 0 else 0
        best = max(best, streak)
    wins, losses = r[r > 0].sum(), -r[r < 0].sum()
    return {"n": len(r), "mean_r": r.mean(), "win_rate": (r > 0).mean(),
            "profit_factor": wins / losses if losses > 0 else np.inf,
            "total_r": r.sum(), "max_dd_r": dd, "max_losing_streak": best}


def _block_means(r: np.ndarray, weeks: np.ndarray, n_boot: int, rng: np.random.Generator) -> np.ndarray:
    uw, inv = np.unique(weeks, return_inverse=True)
    sums = np.bincount(inv, weights=r, minlength=len(uw))
    cnts = np.bincount(inv, minlength=len(uw))
    pick = rng.integers(0, len(uw), size=(n_boot, len(uw)))
    s, c = sums[pick].sum(axis=1), cnts[pick].sum(axis=1)
    return s / np.maximum(c, 1)


def bootstrap_ci(r, weeks, n_boot=5000, seed=0, alpha=0.05) -> tuple[float, float]:
    if len(r) == 0:
        return (np.nan, np.nan)
    m = _block_means(np.asarray(r, float), np.asarray(weeks), n_boot, np.random.default_rng(seed))
    return float(np.quantile(m, alpha / 2)), float(np.quantile(m, 1 - alpha / 2))


def bootstrap_diff_p(r_new, w_new, r_old, w_old, n_boot=5000, seed=0) -> tuple[float, float]:
    """One-sided p-value for H1: mean(new) > mean(old). Returns (diff, p)."""
    if len(r_new) == 0 or len(r_old) == 0:
        return (np.nan, np.nan)
    rng = np.random.default_rng(seed)
    a = _block_means(np.asarray(r_new, float), np.asarray(w_new), n_boot, rng)
    b = _block_means(np.asarray(r_old, float), np.asarray(w_old), n_boot, rng)
    diff = float(np.mean(r_new) - np.mean(r_old))
    return diff, float(np.mean((a - b) <= 0))


def holm(pvals: list[float], alpha: float = 0.05) -> list[bool]:
    """Holm step-down; returns reject flags in the original order. NaN never rejects."""
    idx = [i for i in np.argsort(pvals) if not np.isnan(pvals[i])]
    m = len(idx)
    reject = [False] * len(pvals)
    for k, i in enumerate(idx):
        if pvals[i] <= alpha / (m - k):
            reject[i] = True
        else:
            break
    return reject
