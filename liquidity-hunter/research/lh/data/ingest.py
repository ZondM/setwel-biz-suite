"""Read MetaTrader 5 history exports (bars and ticks) into normalised DataFrames.

Supported input: files produced by MT5 "View -> Symbols -> Bars/Ticks -> Export".
These are tab- or comma-separated, often UTF-16 encoded, with headers such as
<DATE> <TIME> <OPEN> ... Timestamps are broker server time; they are converted
to UTC using an explicit server offset that the caller must supply (verified with
mql5/Scripts/LH_ExportSymbolSpec.mq5). Nothing here guesses the timezone.
"""
from __future__ import annotations

import codecs
import hashlib
import io
from dataclasses import dataclass
from pathlib import Path
from zoneinfo import ZoneInfo

import numpy as np
import pandas as pd

BAR_COLUMNS = ["open", "high", "low", "close", "tick_volume", "real_volume", "spread"]
TICK_COLUMNS = ["bid", "ask", "last", "volume", "flags"]

# MT5 tick flags (MqlTick.flags)
TICK_FLAG_BID = 2
TICK_FLAG_ASK = 4


@dataclass(frozen=True)
class ServerTime:
    """How broker server time maps to UTC.

    Use either a fixed offset in hours (e.g. 0 for a GMT+0 server) or an IANA
    zone name when the server follows daylight saving (e.g. "Europe/Athens").
    """

    fixed_offset_hours: float | None = None
    iana_zone: str | None = None

    def __post_init__(self) -> None:
        if (self.fixed_offset_hours is None) == (self.iana_zone is None):
            raise ValueError("Specify exactly one of fixed_offset_hours or iana_zone")

    def to_utc(self, naive_server_times: pd.Series) -> pd.Series:
        if self.fixed_offset_hours is not None:
            shifted = naive_server_times - pd.Timedelta(hours=self.fixed_offset_hours)
            return shifted.dt.tz_localize("UTC")
        localized = naive_server_times.dt.tz_localize(
            ZoneInfo(self.iana_zone), ambiguous="raise", nonexistent="raise"
        )
        return localized.dt.tz_convert("UTC")


def file_sha256(path: str | Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def _decode(raw: bytes) -> str:
    if raw.startswith(codecs.BOM_UTF16_LE) or raw.startswith(codecs.BOM_UTF16_BE):
        return raw.decode("utf-16")
    if raw.startswith(codecs.BOM_UTF8):
        return raw.decode("utf-8-sig")
    # UTF-16 without BOM: every second byte of ASCII text is NUL.
    if len(raw) >= 4 and raw[1] == 0 and raw[3] == 0:
        return raw.decode("utf-16-le")
    return raw.decode("utf-8")


def _read_table(path: str | Path) -> pd.DataFrame:
    text = _decode(Path(path).read_bytes())
    first_line = text.split("\n", 1)[0]
    sep = "\t" if "\t" in first_line else ","
    df = pd.read_csv(io.StringIO(text), sep=sep, dtype=str, keep_default_na=False)
    df.columns = [c.strip().strip("<>").strip().lower() for c in df.columns]
    return df


def _parse_server_time(df: pd.DataFrame) -> pd.Series:
    if "date" in df.columns and "time" in df.columns:
        stamp = df["date"].str.strip() + " " + df["time"].str.strip()
    elif "date" in df.columns:
        stamp = df["date"].str.strip()
    else:
        raise ValueError(f"No <DATE> column found; columns are {list(df.columns)}")
    stamp = stamp.str.replace(".", "-", n=2, regex=False)
    return pd.to_datetime(stamp, format="mixed")


def _to_float(s: pd.Series) -> pd.Series:
    return pd.to_numeric(s.str.strip().replace("", np.nan), errors="raise")


def read_mt5_bars(path: str | Path, server_time: ServerTime) -> pd.DataFrame:
    """Return bars indexed by UTC bar-open time.

    Columns: open, high, low, close, tick_volume, real_volume, spread (points).
    Rows keep their file order; validation (not this function) reports
    duplicates or ordering problems.
    """
    raw = _read_table(path)
    out = pd.DataFrame(index=raw.index)
    out["time"] = server_time.to_utc(_parse_server_time(raw))
    rename = {"tickvol": "tick_volume", "vol": "real_volume"}
    for src in raw.columns:
        dst = rename.get(src, src)
        if dst in BAR_COLUMNS:
            out[dst] = _to_float(raw[src])
    missing = {"open", "high", "low", "close"} - set(out.columns)
    if missing:
        raise ValueError(f"Bar file is missing columns: {sorted(missing)}")
    for col in BAR_COLUMNS:
        if col not in out.columns:
            out[col] = np.nan
    return out.set_index("time")[BAR_COLUMNS]


def read_mt5_ticks(path: str | Path, server_time: ServerTime) -> pd.DataFrame:
    """Return ticks indexed by UTC time with forward-filled bid/ask.

    MT5 tick exports leave BID or ASK empty when that side did not change on
    the tick. Both sides are forward-filled; rows before the first complete
    quote are dropped. `raw_bid_present`/`raw_ask_present` keep what the file
    actually contained.
    """
    raw = _read_table(path)
    out = pd.DataFrame(index=raw.index)
    out["time"] = server_time.to_utc(_parse_server_time(raw))
    for col in TICK_COLUMNS:
        out[col] = _to_float(raw[col]) if col in raw.columns else np.nan
    out["raw_bid_present"] = out["bid"].notna()
    out["raw_ask_present"] = out["ask"].notna()
    out[["bid", "ask"]] = out[["bid", "ask"]].ffill()
    out = out[out["bid"].notna() & out["ask"].notna()]
    return out.set_index("time")
