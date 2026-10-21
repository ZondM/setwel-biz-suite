"""Stage 3 — Model A ladder on the development period (protocol: docs/06).

Usage: python scripts/stage3_model_a.py <m1 bars .zip/.csv> <out_dir>
"""
import subprocess
import sys
from pathlib import Path

import pandas as pd

from lh.models.model_a import ModelAParams, build_candidates
from lh.pipeline import build_base, load_m1
from lh.sim.ladder import ladder_report, random_baseline, run_step
from lh.sim.trades import M1Market

DEV_START, DEV_END = "2022-11-09", "2025-01-01"
N_RANDOM = 50
SEED = 20261021


def build(m1: pd.DataFrame):
    base = build_base(m1)
    tf, st = base["tf"], base["st"]
    cands = build_candidates(tf["M15"], st["M15"]["atr"], st["M15"]["events"], base["disp"], base["range_active"],
                             st["H4"]["state"], base["sweeps"], tf["M5"], ModelAParams())
    return tf, st, cands


def main():
    src, out = Path(sys.argv[1]), Path(sys.argv[2])
    out.mkdir(parents=True, exist_ok=True)
    m1 = load_m1(src, out, DEV_START, DEV_END)
    tf, st, cands = build(m1)
    mk = M1Market(m1)
    cands.to_parquet(out / "model_a_candidates.parquet")

    sel = {
        "A": cands,
        "B": cands[cands.pass_B],
        "C": cands[cands.pass_B & cands.pass_C],
        "D": cands[cands.pass_B & cands.pass_C & cands.pass_D],
        "E": cands[cands.pass_B & cands.pass_C & cands.pass_D & cands.range_before_sweep],
    }
    chase = ModelAParams().retest.max_entry_atr
    spec = {"A": ("sig_A", "atr_A", None), "B": ("sig_A", "atr_A", None), "C": ("sig_C", "atr_C", None),
            "D": ("sig_D", "atr_C", chase), "E": ("sig_D", "atr_C", chase)}
    trades = {k: run_step(mk, sel[k], spec[k][0], spec[k][1], "sweep_extreme", chase_atr=spec[k][2]) for k in sel}
    filled = {k: v[v.status == "FILLED"].copy() for k, v in trades.items()}
    trades["A0"] = random_baseline(mk, tf["M15"], st["M15"]["atr"], filled["A"], cands.set_index("cand_id")["atr_A"],
                                   N_RANDOM, SEED)
    filled["A0"] = trades["A0"][trades["A0"].status == "FILLED"].copy()
    for k, v in trades.items():
        v.to_parquet(out / f"model_a_trades_{k}.parquet")

    order = ["A0", "A", "B", "C", "D", "E"]
    comps = [("A", "A0"), ("B", "A"), ("C", "B"), ("D", "C"), ("E", "D")]
    body, _ = ladder_report(filled, trades, {k: len(v) for k, v in sel.items()}, order, comps, "A0")
    sha = subprocess.run(["git", "rev-parse", "--short", "HEAD"], capture_output=True, text=True).stdout.strip()
    L = ["# Stage 3 results — Model A ladder (development period)", "",
         f"Protocol: docs/06. Code commit: `{sha}`. Data: `{src.name}`, {DEV_START} to {DEV_END}. "
         "Instrument: Deriv XAUUSDmicro. Exit: stop at sweep extreme + buffer, 2R target, 24 h max.", ""] + body
    reasons = {c: cands[f"reason_{c}"].value_counts(dropna=True).to_dict() for c in ("B", "C", "D")}
    L += ["", "## Why candidates failed each condition (all reclaimed sweeps)", ""]
    for c, v in reasons.items():
        L.append(f"- {c}: {v}")
    (out / "stage3_model_a_results.md").write_text("\n".join(L) + "\n")
    print("\n".join(L))


if __name__ == "__main__":
    main()
