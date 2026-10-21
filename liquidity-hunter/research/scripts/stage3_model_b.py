"""Stage 3 — Model B ladder on the development period (protocol: docs/08).

Usage: python scripts/stage3_model_b.py <m1 bars .zip/.csv> <out_dir>
"""
import subprocess
import sys
from pathlib import Path

from lh.models.model_b import ModelBParams, build_candidates, regime_direction
from lh.pipeline import build_base, load_m1
from lh.sim.ladder import ladder_report, random_baseline, run_step
from lh.sim.trades import M1Market

DEV_START, DEV_END = "2022-11-09", "2025-01-01"
N_RANDOM = 50
SEED = 20261022


def main():
    src, out = Path(sys.argv[1]), Path(sys.argv[2])
    out.mkdir(parents=True, exist_ok=True)
    m1 = load_m1(src, out, DEV_START, DEV_END)
    base = build_base(m1)
    tf, st = base["tf"], base["st"]
    cands = build_candidates(tf["M15"], st["M15"]["atr"], st["M15"]["events"], base["disp"],
                             st["H4"]["state"], st["H1"]["state"], st["H1"]["events"], tf["M5"], ModelBParams())
    cands.to_parquet(out / "model_b_candidates.parquet")
    mk = M1Market(m1)

    sel = {"B1": cands[cands.pass_B1], "B2": cands[cands.pass_B2], "B3": cands[cands.pass_B3], "B4": cands[cands.pass_B4]}
    chase = ModelBParams().retest.max_entry_atr
    spec = {"B1": ("sig_B1", "atr_B1", None), "B2": ("sig_B1", "atr_B1", None),
            "B3": ("sig_B3", "atr_B3", None), "B4": ("sig_B4", "atr_B3", chase)}
    trades = {k: run_step(mk, sel[k], spec[k][0], spec[k][1], "stop_ref", chase_atr=spec[k][2]) for k in sel}
    filled = {k: v[v.status == "FILLED"].copy() for k, v in trades.items()}
    h4_dir = regime_direction(st["H4"]["state"], tf["M15"]["close_time"])
    trades["B0"] = random_baseline(mk, tf["M15"], st["M15"]["atr"], filled["B1"], cands.set_index("cand_id")["atr_B1"],
                                   N_RANDOM, SEED, direction_at=h4_dir)
    filled["B0"] = trades["B0"][trades["B0"].status == "FILLED"].copy()
    for k, v in trades.items():
        v.to_parquet(out / f"model_b_trades_{k}.parquet")

    order = ["B0", "B1", "B2", "B3", "B4"]
    comps = [("B1", "B0"), ("B2", "B1"), ("B3", "B2"), ("B4", "B3")]
    body, _ = ladder_report(filled, trades, {k: len(v) for k, v in sel.items()}, order, comps, "B0")
    sha = subprocess.run(["git", "rev-parse", "--short", "HEAD"], capture_output=True, text=True).stdout.strip()
    L = ["# Stage 3 results — Model B ladder (development period)", "",
         f"Protocol: docs/08. Code commit: `{sha}`. Data: `{src.name}`, {DEV_START} to {DEV_END}. "
         "Instrument: Deriv XAUUSDmicro. Exit: stop at M15 protected level + buffer, 2R target, 24 h max.", ""] + body
    L += ["", "## Why candidates failed each condition (all M15 breaks)", ""]
    for c in ("B1", "B2", "B3", "B4"):
        L.append(f"- {c}: {cands[f'reason_{c}'].value_counts(dropna=True).to_dict()}")
    if "retracement" in cands:
        r = cands.loc[cands.pass_B1 & cands.m15_kind.str.startswith("CHOCH"), "retracement"].dropna()
        L.append(f"- Retracement of B1 CHoCH candidates: median {r.median():.2f}, p10 {r.quantile(.1):.2f}, p90 {r.quantile(.9):.2f}")
    (out / "stage3_model_b_results.md").write_text("\n".join(L) + "\n")
    print("\n".join(L))


if __name__ == "__main__":
    main()
