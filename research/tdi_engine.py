"""Python reference port of TDI_Divergence_Pro v9.2 signal logic (mt5/Indicators/TDI_Divergence_Pro.mq5).

Same rules, same order of evaluation, closed bars only, each bar processed once.
Bars are chronological numpy arrays (index 0 = oldest). The last array element is treated as the
forming bar and is never evaluated, exactly like the indicator.
"""
import math
from dataclasses import dataclass, field

import numpy as np

DIV, EXH, CONT = 1, 2, 3
KIND_NAME = {DIV: "DIV", EXH: "EXH", CONT: "CONT"}

DEFAULTS = dict(
    # TDI
    rsi_period=13, green=2, red=7, base=34, band=34, band_dev=1.6185, atr_period=14,
    # swing engine
    piv_left=5, piv_right=2, price_sep=3, min_span=5, max_span=100, min_leg_bars=3,
    min_legs=2, max_legs=4, tdi_tol=2.0, use_double=True, price_tol_atr=0.5, double_min_tdi=3.0,
    strict_tdi_rise=False, confirm_bars=6, max_signals_per_seq=2,
    # filters
    use_tdi_prom=True, tdi_prom=3.0, use_min_price_div=True, min_price_div_atr=0.25,
    use_min_tdi_div=False, min_tdi_div=2.0, use_pullback=False, pullback_atr=1.0,
    use_zone=False, zone_os=40, zone_ob=60, use_band_leg1=False,
    use_green_dir=True, use_red_cross=True, use_base=False, use_candle_dir=True, use_close_beyond=False,
    use_reset=True, reset_level=50.0, use_cooldown=False, cooldown_bars=10,
    # trend filter
    use_trend_filter=True, trend_ema=50, trend_slope_bars=10, trend_slope_atr=0.6,
    allow_exhaustion=False, exh_ob=68, exh_os=32, exh_min_legs=3, exh_deep_ob=75, exh_deep_os=25,
    exh_need_band=False, exh_need_base=False, exh_need_break=True, exh_min_tdi_div=0.0, exh_confirm_bars=12,
    use_range_zone=True, range_os=40, range_ob=60,
    # higher timeframe
    use_htf=True, htf_ema=50, htf_slope_bars=5, htf_slope_atr=0.5, htf_exh_min_legs=3, htf_exh_ob=70, htf_exh_os=30,
    # continuation
    use_cont=True, cont_buy_max_tdi=45, cont_sell_min_tdi=55, cont_pullback_atr=1.0,
)


# ------------------------------------------------------------------ indicator lines
def _ma(src, period, method="sma", prev=None):
    n = len(src)
    out = np.empty(n)
    if method == "sma":
        cs = np.cumsum(np.r_[0.0, src])
        for i in range(n):
            out[i] = src[i] if (i < period - 1 or period == 1) else (cs[i + 1] - cs[i + 1 - period]) / period
        return out
    if method == "ema":
        a = 2.0 / (period + 1.0)
        for i in range(n):
            if i < period - 1 or period == 1:
                out[i] = src[i]
            elif i == period - 1:
                out[i] = src[i - period + 1:i + 1].mean()
            else:
                out[i] = out[i - 1] + a * (src[i] - out[i - 1])
        return out
    raise ValueError(method)


def rsi_wilder(price, n):
    m = len(price)
    pos = np.zeros(m); neg = np.zeros(m); rsi = np.full(m, 50.0)
    d = np.diff(price, prepend=price[0])
    if m > n:
        pos[n] = np.clip(d[1:n + 1], 0, None).sum() / n
        neg[n] = np.clip(-d[1:n + 1], 0, None).sum() / n
        for i in range(n + 1, m):
            pos[i] = (pos[i - 1] * (n - 1) + max(d[i], 0.0)) / n
            neg[i] = (neg[i - 1] * (n - 1) + max(-d[i], 0.0)) / n
        for i in range(n, m):
            rsi[i] = 100.0 - 100.0 / (1.0 + pos[i] / neg[i]) if neg[i] != 0 else (100.0 if pos[i] != 0 else 50.0)
    return rsi


def atr_sma(h, l, c, p):
    tr = np.empty(len(c))
    tr[0] = h[0] - l[0]
    tr[1:] = np.maximum(h[1:], c[:-1]) - np.minimum(l[1:], c[:-1])
    cs = np.cumsum(np.r_[0.0, tr])
    out = np.empty(len(c))
    for i in range(len(c)):
        k = min(p, i + 1)
        out[i] = (cs[i + 1] - cs[i + 1 - k]) / k
    return out


def lines(o, h, l, c, P):
    rsi = rsi_wilder(c, P["rsi_period"])
    g = _ma(rsi, P["green"]); r = _ma(rsi, P["red"]); y = _ma(rsi, P["base"])
    bp = P["band"]
    ub = rsi.copy(); lb = rsi.copy()
    for i in range(bp - 1, len(rsi)):
        w = rsi[i - bp + 1:i + 1]
        mu = w.mean(); sd = math.sqrt(((w - mu) ** 2).mean())
        ub[i] = mu + P["band_dev"] * sd; lb[i] = mu - P["band_dev"] * sd
    atr = atr_sma(h, l, c, P["atr_period"])
    ema = _ma(c, P["trend_ema"], "ema")
    return dict(rsi=rsi, g=g, r=r, y=y, ub=ub, lb=lb, atr=atr, ema=ema)


def htf_trend_for(tf_time, htf_df, P, tf_seconds):
    """Trend of the last HTF bar that was CLOSED when the chart bar opened (iBarShift(t)+1)."""
    if htf_df is None:
        return np.zeros(len(tf_time), int), np.zeros(len(tf_time))
    ht = htf_df["time"].to_numpy()
    hema = _ma(htf_df["close"].to_numpy(), P["htf_ema"], "ema")
    hatr = atr_sma(htf_df["high"].to_numpy(), htf_df["low"].to_numpy(), htf_df["close"].to_numpy(), P["atr_period"])
    idx = np.searchsorted(ht, tf_time, side="right") - 1        # HTF bar containing t (chronological)
    j = idx - 1                                                 # previous, closed HTF bar
    k = j - P["htf_slope_bars"]
    trend = np.zeros(len(tf_time), int); slope = np.zeros(len(tf_time))
    ok = (k >= 0) & (j >= 0)
    jj, kk = j[ok], k[ok]
    s = (hema[jj] - hema[kk]) / np.where(hatr[jj] > 0, hatr[jj], np.nan)
    s = np.nan_to_num(s)
    slope[ok] = s
    trend[ok] = np.where(s >= P["htf_slope_atr"], 1, np.where(s <= -P["htf_slope_atr"], -1, 0))
    return trend, slope


# ------------------------------------------------------------------ engine
@dataclass
class Cand:
    dir: int
    kind: int
    x_idx: int
    legs_bar: list
    legs_pbar: list
    legs_val: list
    legs_price: list
    created: int
    deadline: int
    dbl: int = 0

    @property
    def legs(self):
        return len(self.legs_bar)


def run(o, h, l, c, times, htf_trend, P=None):
    P = dict(DEFAULTS, **(P or {}))
    L = lines(o, h, l, c, P)
    S = L["g"]; G = L["g"]; R = L["r"]; Y = L["y"]; UB = L["ub"]; LB = L["lb"]; ATR = L["atr"]; EMA = L["ema"]
    n = len(c)
    warm = P["rsi_period"] + max(P["green"], P["red"], P["base"], P["band"]) + max(P["atr_period"], P["trend_ema"] + P["trend_slope_bars"]) + 2
    start = warm + P["piv_left"] + 1
    piv = []                 # dicts: type, bar, pbar, val, price, sigs
    pend = []
    last_sig = {1: -10**9, -1: -10**9}
    sig_bar_taken = set()
    signals = []

    def slope(cb):
        if cb - P["trend_slope_bars"] < 0 or ATR[cb] <= 0:
            return 0.0
        return (EMA[cb] - EMA[cb - P["trend_slope_bars"]]) / ATR[cb]

    def trend_at(cb):
        s = slope(cb)
        return 1 if s >= P["trend_slope_atr"] else (-1 if s <= -P["trend_slope_atr"] else 0)

    def pivot_type(q):
        v = S[q]
        left = S[q - P["piv_left"]:q]; right = S[q + 1:q + 1 + P["piv_right"]]
        if (v > left).all() and (v >= right).all():
            return 1
        if (v < left).all() and (v <= right).all():
            return -1
        return 0

    def prominent(t, q):
        if not P["use_tdi_prom"]:
            return True
        frm = max(start, q - P["max_span"])
        for p in reversed(piv):
            if p["type"] == t:
                frm = max(frm, p["bar"]); break
        v = S[q]
        seg = S[frm:q]
        ext = v if len(seg) == 0 else (max(v, seg.max()) if t < 0 else min(v, seg.min()))
        return abs(ext - v) >= P["tdi_prom"]

    def price_match(t, q, cb):
        a = max(0, q - P["price_sep"]); b = min(cb, q + P["price_sep"]); best = q
        for k in range(a, b + 1):
            if t > 0 and h[k] > h[best]: best = k
            if t < 0 and l[k] < l[best]: best = k
        return best

    def price_deepest(d, price, frm, to):
        if frm > to: return True
        return not ((l[frm:to + 1] < price).any() if d > 0 else (h[frm:to + 1] > price).any())

    def tdi_extreme(d, val, frm, to):
        seg = S[frm + 1:to + 1]
        return not (((seg - val) * d) < 0).any()

    def exh_miss(cd):
        v = cd.legs_val[0]; b = cd.legs_bar[0]
        if cd.dir > 0 and v > P["exh_os"]: return "leg1"
        if cd.dir < 0 and v < P["exh_ob"]: return "leg1"
        if cd.legs < P["exh_min_legs"]:
            if cd.dir > 0 and v > P["exh_deep_os"]: return "deep"
            if cd.dir < 0 and v < P["exh_deep_ob"]: return "deep"
        if P["exh_need_band"] and (v > LB[b] if cd.dir > 0 else v < UB[b]): return "band"
        if P["exh_min_tdi_div"] > 0 and (cd.legs_val[-1] - v) * cd.dir < P["exh_min_tdi_div"]: return "div"
        return ""

    def htf_exh_miss(cd):
        v = cd.legs_val[0]
        if cd.legs < P["htf_exh_min_legs"]: return "legs"
        if cd.dir > 0 and v > P["htf_exh_os"]: return "leg1"
        if cd.dir < 0 and v < P["htf_exh_ob"]: return "leg1"
        return ""

    def htf(cb):
        return int(htf_trend[cb]) if P["use_htf"] else 0

    def build_candidate(d, n_idx, cb):
        ptype = -d
        N = piv[n_idx]
        best = -1
        for k in range(n_idx - 1, -1, -1):
            X = piv[k]
            if X["type"] != ptype: continue
            span = N["bar"] - X["bar"]
            if span > P["max_span"]: break
            if span < P["min_span"]: continue
            deeper = (X["price"] - N["price"]) * d
            gain = (N["val"] - X["val"]) * d
            atrn = ATR[N["pbar"]]
            classic = deeper > 0 and (not P["use_min_price_div"] or deeper >= P["min_price_div_atr"] * atrn) and gain >= -P["tdi_tol"]
            dbl = (not classic) and P["use_double"] and deeper > -P["price_tol_atr"] * atrn and gain >= P["double_min_tdi"]
            if not classic and not dbl: continue
            if not price_deepest(d, N["price"], X["pbar"] + 1, cb): continue
            if not tdi_extreme(d, X["val"] - d * P["tdi_tol"], X["bar"], cb): continue
            if best < 0 or (X["val"] - piv[best]["val"]) * d <= 0: best = k
        if best < 0:
            return False
        B = piv[best]
        cd = Cand(d, DIV, best, [B["bar"]], [B["pbar"]], [B["val"]], [B["price"]], cb, N["bar"] + P["confirm_bars"],
                  0 if (B["price"] - N["price"]) * d > 0 else 1)
        for k in range(best + 1, n_idx):
            M = piv[k]
            if M["type"] != ptype or cd.legs >= 5: continue
            if M["bar"] - cd.legs_bar[-1] < P["min_leg_bars"]: continue
            if (cd.legs_price[-1] - M["price"]) * d <= 0: continue
            if (M["price"] - N["price"]) * d <= 0: continue
            ref = cd.legs_val[-1] if P["strict_tdi_rise"] else cd.legs_val[0]
            if (M["val"] - ref) * d < -P["tdi_tol"]: continue
            cd.legs_bar.append(M["bar"]); cd.legs_pbar.append(M["pbar"]); cd.legs_val.append(M["val"]); cd.legs_price.append(M["price"])
        while cd.legs > 1 and (N["bar"] - cd.legs_bar[-1] < P["min_leg_bars"] or
                               (P["strict_tdi_rise"] and (N["val"] - cd.legs_val[-1]) * d < -P["tdi_tol"])):
            for a in (cd.legs_bar, cd.legs_pbar, cd.legs_val, cd.legs_price): a.pop()
        cd.legs_bar.append(N["bar"]); cd.legs_pbar.append(N["pbar"]); cd.legs_val.append(N["val"]); cd.legs_price.append(N["price"])

        why = ""
        if cd.legs < P["min_legs"]: why = "legs<min"
        elif cd.legs > P["max_legs"]: why = "legs>max"
        elif P["use_min_tdi_div"] and (N["val"] - cd.legs_val[0]) * d < P["min_tdi_div"]: why = "tdi div"
        elif P["use_zone"] and (cd.legs_val[0] > P["zone_os"] if d > 0 else cd.legs_val[0] < P["zone_ob"]): why = "zone"
        elif P["use_band_leg1"] and (cd.legs_val[0] > LB[cd.legs_bar[0]] if d > 0 else cd.legs_val[0] < UB[cd.legs_bar[0]]): why = "band"
        elif P["use_pullback"]:
            seg = slice(cd.legs_pbar[0], N["pbar"] + 1)
            pb = max(0.0, ((h[seg] - cd.legs_price[0]) if d > 0 else (cd.legs_price[0] - l[seg])).max())
            if pb < P["pullback_atr"] * ATR[N["pbar"]]: why = "pullback"
        if why == "" and B["sigs"] >= P["max_signals_per_seq"]: why = "seq limit"
        tr = trend_at(cb)
        if why == "" and P["use_trend_filter"] and tr == -d:
            if not P["allow_exhaustion"]: why = "against trend"
            elif exh_miss(cd): why = "against trend (exh)"
            else: cd.kind = EXH; cd.deadline = N["bar"] + P["exh_confirm_bars"]
        if why == "" and P["use_trend_filter"] and tr == 0 and P["use_range_zone"] and \
                (cd.legs_val[0] > P["range_os"] if d > 0 else cd.legs_val[0] < P["range_ob"]):
            why = "range zone"
        if why == "" and htf(cb) == -d:
            if htf_exh_miss(cd): why = "against htf"
            else: cd.kind = EXH; cd.deadline = N["bar"] + P["exh_confirm_bars"]
        if why == "":
            pend.append(cd)
        return True

    def build_cont(d, n_idx, cb):
        if not P["use_cont"] or trend_at(cb) != d: return
        if htf(cb) == -d: return
        N = piv[n_idx]
        if (N["val"] > P["cont_buy_max_tdi"]) if d > 0 else (N["val"] < P["cont_sell_min_tdi"]): return
        x = -1
        for k in range(n_idx - 1, -1, -1):
            if piv[k]["type"] != -d: continue
            span = N["bar"] - piv[k]["bar"]
            if span > P["max_span"]: break
            if span < P["min_span"]: continue
            x = k; break
        if x < 0: return
        X = piv[x]
        if (N["val"] - X["val"]) * d <= 0: return
        if (N["price"] - X["price"]) * d <= 0: return
        if not price_deepest(d, N["price"], N["pbar"], cb): return
        seg = slice(X["pbar"], N["pbar"] + 1)
        pb = max(0.0, ((h[seg] - N["price"]) if d > 0 else (N["price"] - l[seg])).max())
        if pb < P["cont_pullback_atr"] * ATR[N["pbar"]]: return
        if X["sigs"] >= P["max_signals_per_seq"]: return
        pend.append(Cand(d, CONT, x, [X["bar"], N["bar"]], [X["pbar"], N["pbar"]], [X["val"], N["val"]],
                         [X["price"], N["price"]], cb, N["bar"] + P["confirm_bars"]))

    def reset_ok(d, cb):
        last = last_sig[d]
        if not P["use_reset"] or last < 0: return True
        return bool((((S[last + 1:cb + 1] - P["reset_level"]) * d) > 0).any())

    def confirm_miss(cd, cb, need_base, need_break):
        d = cd.dir
        if need_break and cd.legs >= 2:
            a, b = cd.legs_pbar[-2], cd.legs_pbar[-1]
            lvl = h[a:b + 1].max() if d > 0 else l[a:b + 1].min()
            if (c[cb] <= lvl) if d > 0 else (c[cb] >= lvl): return "break"
        if P["use_green_dir"] and (S[cb] - S[cb - 1]) * d <= 0: return "dir"
        if P["use_red_cross"] and (G[cb] - R[cb]) * d <= 0: return "red"
        if (P["use_base"] or need_base) and (G[cb] - Y[cb]) * d <= 0: return "base"
        if P["use_candle_dir"] and (c[cb] - o[cb]) * d <= 0: return "candle"
        if P["use_close_beyond"]:
            pb = cd.legs_pbar[-1]
            if (c[cb] <= h[pb]) if d > 0 else (c[cb] >= l[pb]): return "close"
        return ""

    def check_pending(cb):
        for i in range(len(pend) - 1, -1, -1):
            cd0 = pend[i]
            cd = Cand(cd0.dir, cd0.kind, cd0.x_idx, cd0.legs_bar, cd0.legs_pbar, cd0.legs_val, cd0.legs_price,
                      cd0.created, cd0.deadline, cd0.dbl)            # local copy (kind changes are not stored)
            d = cd.dir
            why = ""; confirm = False
            if cb > cd.created:
                if (l[cb] < cd.legs_price[-1]) if d > 0 else (h[cb] > cd.legs_price[-1]): why = "new extreme"
                elif (S[cb] - cd.legs_val[0]) * d < -(0.0 if cd.kind == CONT else P["tdi_tol"]): why = "tdi broke"
            need_base = need_break = False
            if why == "" and P["use_trend_filter"]:
                tr = trend_at(cb)
                if cd.kind == CONT and tr != d: why = "trend gone"
                elif cd.kind != CONT and tr == -d:
                    if cd.kind == EXH or (P["allow_exhaustion"] and exh_miss(cd) == ""):
                        cd.kind = EXH
                    else:
                        why = "trend turned"
            if why == "" and htf(cb) == -d:
                if cd.kind == CONT: why = "htf against"
                elif htf_exh_miss(cd): why = "against htf"
                else: cd.kind = EXH
            if cd.kind == EXH:
                need_base = P["exh_need_base"]; need_break = P["exh_need_break"]
            if why == "":
                miss = confirm_miss(cd, cb, need_base, need_break)
                if miss == "":
                    if P["use_cooldown"] and cb - last_sig[d] < P["cooldown_bars"]: why = "cooldown"
                    elif cb in sig_bar_taken: why = "bar taken"
                    elif not reset_ok(d, cb): why = "reset"
                    elif piv[cd.x_idx]["sigs"] >= P["max_signals_per_seq"]: why = "seq limit"
                    else: confirm = True
                elif cb >= cd.deadline or (cd.kind != EXH and cb >= cd.legs_bar[-1] + P["confirm_bars"]):
                    why = "no confirm"
                else:
                    continue
            pend.pop(i)
            if confirm:
                sig_bar_taken.add(cb)
                piv[cd.x_idx]["sigs"] += 1
                last_sig[d] = cb
                signals.append(dict(bar=cb, time=int(times[cb]), dir=d, kind=cd.kind, legs=cd.legs, dbl=cd.dbl,
                                    sl_ref=cd.legs_price[-1], atr=ATR[cb], leg1_tdi=cd.legs_val[0], last_tdi=cd.legs_val[-1],
                                    signal_id=int(times[cd.legs_bar[-1]]), tf_slope=slope(cb), htf=htf(cb)))

    last_closed = n - 2
    for cb in range(start, last_closed + 1):
        q = cb - P["piv_right"]
        if q - P["piv_left"] >= start:
            t = pivot_type(q)
            if t != 0 and prominent(t, q):
                pb = price_match(t, q, cb)
                piv.append(dict(type=t, bar=q, pbar=pb, val=S[q], price=h[pb] if t > 0 else l[pb], sigs=0))
                d = -1 if t > 0 else 1
                if not build_candidate(d, len(piv) - 1, cb):
                    build_cont(d, len(piv) - 1, cb)
        check_pending(cb)
    return signals, L
