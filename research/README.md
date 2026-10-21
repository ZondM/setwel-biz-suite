# Phase 0 — is there anything to predict?

1. In MT5: copy `mt5/Scripts/TDI_ExportData.mq5` to `MQL5\Scripts`, compile, drag it onto any chart, check the symbol names, OK.
2. Zip `MQL5\Files\phase0` (File > Open Data Folder) and upload it to the session.
3. Run: `python3 research/phase0.py <unzipped folder>` → `phase0_report.md`.

Validation: `python3 research/make_synthetic.py <dir> && python3 research/phase0.py <dir>` builds four fake symbols
(random walk, momentum AR(1)=0.15, Boom-like memoryless spikes, Crash-like spikes that arrive on a schedule).
Expected and observed verdicts: random walk → no predictability; momentum → structure; memoryless Boom → no predictability;
scheduled Crash → spike timing not memoryless.

Needs: numpy, pandas, scipy, statsmodels.
