# Setwel Trade Manager (MetaTrader 5 Expert Advisor)

You open trades as usual (on PC, web or mobile). This EA spots each position on the chart's symbol right away. From then on you control its **real** stop loss, take profit and trailing stop by dragging lines on the chart.

It **never opens or closes trades** and gives no signals.

Works with MT5 accounts at Deriv, Exness, XM or any MT5 broker: forex, indices, Deriv synthetic indices, metals, commodities and crypto, as long as your broker offers them.

---

## 1. What the platform allows (and the limits)

| Feature | MT5 support | Notes |
|---|---|---|
| Detect new trades instantly | Yes: `OnTradeTransaction` plus a 250 ms re-sync | Includes trades opened on the mobile app, while the terminal is running. |
| Detect positions already open at start | Yes | Their SL/TP are **not touched**. |
| Change real SL/TP | Yes (`TRADE_ACTION_SLTP`) | The broker can reject a change; the EA then shows it as REJECTED. |
| Trailing stop | Yes, but **client-side** | It runs inside this EA. **If MT5 is closed, the PC sleeps, the internet drops, or the EA is removed, trailing stops.** The SL already set at the broker stays where it is. To trail 24/7, run MT5 on a VPS. MT5 has no server-side trailing stop. |
| Hedging and netting | Both | Hedging: each trade is its own line set. Netting: one position per symbol. If it reverses direction, the EA clears drafts and turns trailing off. |

Other honest limits:
- **One chart = one symbol.** The EA only manages positions on the symbol of the chart it is attached to. Attach it to one chart for each symbol you trade.
- **MT5 cannot be compiled or tested in this repo environment.** The code was written carefully against the MQL5 API but has **not** been compiled yet. If MetaEditor shows any error, send me the error text and I'll fix it.
- Money estimates use MT5's `OrderCalcProfit` (account currency). They **exclude commission and swap** and can differ slightly from the final result because of slippage and spread.
- "Pips" means 10 points on 3- and 5-digit symbols, otherwise 1 point. For indices, synthetics and gold, use **points** or **price** to avoid confusion.
- MT5 itself can already drag SL/TP lines ("Show trade levels"). By default this EA hides those lines on its chart only, so you don't see two sets. They come back when the EA is removed.

---

## 2. Installation

1. In MT5: **File → Open Data Folder**.
2. Copy `SetwelTradeManager.mq5` into `MQL5/Experts/`.
3. In MT5 press **F4** (MetaEditor), open the file, then press **F7** (Compile). You should see `0 errors`.
4. Back in MT5, look in **Navigator → Expert Advisors** and right-click → Refresh if it's not there.
5. Drag **SetwelTradeManager** onto the chart of the symbol you trade.
6. In the window that opens, on the **Common** tab, tick **Allow Algo Trading**. Set inputs (section 3), then click OK.
7. Make sure the **Algo Trading** button in the MT5 toolbar is **green**.
8. Recommended: **Tools → Options → Charts → tick "Select object by single mouse click"** so you can drag lines in one move.

Run one copy per chart. If you trade EURUSD and Volatility 75, use two charts with the EA on each.

---

## 3. Settings guide

| Input | Default | Meaning |
|---|---|---|
| Magic number | `0` | `0` = only trades you open by hand. `-1` = every position on this symbol, including other EAs' trades (watch for conflicts). Any other number = only that EA's trades. |
| When to send SL/TP changes | On release | **On release**: the change goes to the broker when you let go of the line or press Enter in a price box. **Save**: the line stays a draft until you click **Save**. |
| Unit | **Money** | Unit for lock, trailing and auto inputs: money (account currency, worked out from each trade's lot size), points, pips, ticks or price. Money means the same thing on every symbol. |
| Draft SL / TP handle distance | 1× / 2× ATR(14) | Where the dashed "not set" handles appear when a trade has no SL/TP. **Visual only, nothing is sent.** |
| Lock/trail ON for new positions | **true** | Every newly detected trade starts with profit lock and trailing on. It only ever tightens the SL. |
| Lock when profit reaches | 1.00 | Once the trade is this much in profit, the SL moves to entry + the lock amount. `0` = off. |
| Lock amount | 0.30 | Profit kept by the lock (for example, SL moved to lock +$0.30). |
| Trail activation | 2.00 | Profit needed before trailing starts. |
| Trail distance | 1.00 | How far the SL stays behind price (Bid for buys, Ask for sells). If this is closer than the broker allows, the SL is held at the closest allowed level instead of waiting. |
| Trail step | 0.20 | The minimum improvement needed before the SL is moved again. This limits requests. |
| If SL changed manually while trailing | Pause | **Pause**: trailing stops until you click TRAIL to resume. **Continue**: it keeps trailing from your new SL, only ever tightening it. |
| Auto SL/TP mode | Off | For new trades with no SL/TP: **Fixed** distance, **ATR**(14) × multiplier, **Swing** (recent low for buys / high for sells, plus a buffer), or **Money** (fixed max loss). TP = SL distance × R:R. In Save mode the levels appear as drafts until you press Save; otherwise they are sent at once. |
| Fixed SL / TP | 0 / 0 | Fixed mode distances. TP `0` = use R:R. |
| ATR multiplier | 1.5 | ATR mode (also the fallback for Swing). |
| Swing bars / buffer | 20 / 0.2×ATR | Swing mode look-back and extra room. |
| Money risk | 2.00 | Money mode: the max loss if the SL is hit (before slippage). |
| Auto R:R | 2.0 | TP distance = SL distance × this. |
| Min time between modifications | 500 ms | Rate limit per position. |
| Confirmation timeout | 8000 ms | If the broker hasn't confirmed by then, the level shows as failed. |
| Hide native trade levels | true | Hides MT5's own SL/TP lines on this chart while the EA runs. |
| Show other positions | true | Shows a faint grey entry line for positions that aren't selected. |
| Panel position | Bottom left | Bottom left or top left. You can also switch it any time with the **To top / To bottom** button on the panel (remembered per chart). |
| Panel X/Y | 10 / 25 | Offset from the left edge and from the top or bottom edge. |
| Font, colours | — | Look and feel. |

Lock and trailing values can also be changed **per position** in the panel (Act / Dist / Step and Lock boxes). They are saved in MT5 global variables, so they survive a restart.

Defaults are in money, so $1.00 means the same on every symbol and lot size. With a points/pips unit, a point is very different on each symbol, so set the values for each chart.

---

## 4. Using it

### Line states (always tell you what the broker has)

| Look | State | Meaning |
|---|---|---|
| Solid, thick (red SL / green TP) | **ACTIVE** | The broker has confirmed this level. Your trade is protected here. |
| Dashed | **DRAFT** / **UNSAVED** | Not at the broker. Either a handle for a level you haven't set, or a change you haven't sent. |
| Dotted | **SENDING** | Request sent, waiting for confirmation. |
| Orange, dash-dot | **REJECTED - NOT APPLIED** | The broker or a check refused it. The panel shows the reason and the broker's real level. Drag again, or press Cancel / Revert. |
| Blue | Entry | Entry price, volume and live P/L. |

If the EA is removed or MT5 closes, **all its lines are deleted**, so no line is left that only looks like protection.

### Panel
- `<` `>`: switch between positions. You can also click another position's grey entry line. Each position keeps its own drafts and trailing settings.
- **SL / TP price boxes**: type a price and press Enter. Type `0` to remove the level. **X** also removes it.
- Below each box: distance from entry, the estimated money lost or locked in (SL) or won (TP), and the R:R.
- **LOCK/TRAIL** button: OFF → ON. When PAUSED, one click resumes. Clicking while ON turns it OFF. It controls the profit lock and trailing together.
- **Auto SL/TP** button: proposes SL/TP for the selected trade with the chosen auto mode (ATR if the mode is Off). It replaces the current levels: in on-release mode they are sent at once, in Save mode press Save.
- Lock/trail status line: Armed (waiting for profit), Locked / Trailing (with the money the SL locks in), waiting, INACTIVE (disconnected / Algo Trading off), REJECTED.
- **Fast spikes (Crash/Boom):** a broker SL is filled at the next available price. A sudden spike can jump past the SL, so the result can be worse than the money shown (slippage). No EA can prevent this.
- **Save / Cancel** (Save mode) or **Revert draft** (on-release mode).
- Top status: LIVE / DISCONNECTED / CANNOT MODIFY (with the reason) / no quotes (market may be closed).

### Checks done before sending
- Direction: a buy's SL must be below Bid and its TP above. A sell's SL must be above Ask and its TP below.
- The broker's **stop level** (minimum distance) and **freeze level**.
- Rounding to the symbol's **tick size** and digits, read live from the broker.
- Connection, Algo Trading, account and symbol trade permissions.
- During a drag, the label shows the proposed price, distance and money, plus `INVALID: …` if it would be refused.

---

## 5. Demo-account testing checklist

Use a **demo** account first (Deriv, Exness and XM all offer MT5 demos). Tick each item:

**Detection**
- [ ] Attach the EA with no trades open: the panel says "No managed positions".
- [ ] Open a BUY by hand: within about 1 second, a blue entry line, a dashed red "SL DRAFT" and a dashed green "TP DRAFT" appear. The panel shows the ticket, volume and P/L.
- [ ] Open a SELL: it's detected and selected automatically. `<` `>` switch between them.
- [ ] Open a trade from the **mobile app**: it's detected.
- [ ] With trades already open (some with SL/TP), remove and re-attach the EA: the existing SL/TP show as solid ACTIVE lines at the **same** prices, unchanged.

**Drag SL/TP (on-release mode)**
- [ ] Drag the BUY's SL draft below price and release: it shows dotted SENDING, then solid ACTIVE. MT5's Trade tab shows the same SL.
- [ ] While dragging, the label shows price, distance and money live.
- [ ] Drag the TP above price: it becomes ACTIVE and R:R appears.
- [ ] Drag a BUY's SL **above** Bid and release: it turns orange REJECTED/Not sent with the reason. The Trade tab SL is unchanged.
- [ ] Type a price in the SL box and press Enter: it's applied. Type `0`: the SL is removed.
- [ ] Repeat with the SELL (SL above, TP below).

**Save mode**
- [ ] Set mode = Save. Drag the SL: the line shows UNSAVED and the Trade tab is unchanged. Click Save: it becomes ACTIVE.
- [ ] Drag again, then click Cancel: the line goes back to the broker level.

**Multiple positions**
- [ ] With 2+ positions, change the SL on #1 and check that #2's SL/TP in the Trade tab are untouched.
- [ ] Turn trailing on for #1 only: #2 doesn't trail.

**Trailing**
- [ ] Use small values on a fast symbol (for example a Deriv volatility index, or EURUSD with Act 50 / Dist 30 / Step 10 points). Turn TRAIL ON: it shows "Armed".
- [ ] When profit passes the activation distance, the SL moves to price − distance (buy). The Trade tab matches.
- [ ] When price pulls back, the SL **does not move back**.
- [ ] SELL: the SL only ever moves down.
- [ ] Drag the SL by hand while trailing (rule = Pause): it shows PAUSED. Click TRAIL to resume.
- [ ] Rule = Continue: after a manual drag, trailing continues from the new SL.
- [ ] Change the SL in MT5's own order window: the EA line moves there with "Changed outside this EA".

**Failures / reliability**
- [ ] Turn the Algo Trading button OFF: the status shows CANNOT MODIFY, trailing shows INACTIVE, and a drag shows "Not sent".
- [ ] Disconnect the internet: the status shows DISCONNECTED. Reconnect: "Reconnected - re-synced".
- [ ] Market closed (for example forex at the weekend): a drag shows REJECTED "Market closed". Nothing is shown as applied.
- [ ] Close a position: its lines disappear and the panel says it closed.
- [ ] Restart MT5: positions, SL/TP and trailing settings come back correctly.

**Instruments (different tick sizes / digits)**
- [ ] 5-digit forex (EURUSD), 3-digit (USDJPY), gold (2 digits), an index (US30 / NAS100), a Deriv synthetic (Volatility 75, Boom/Crash, Step Index), and crypto if your broker offers it.
- [ ] For each one: the dragged prices snap to valid ticks, distances look right in your unit, and money estimates match MT5's own profit display at that price.
- [ ] Broker symbol suffixes (for example `EURUSDm` at Exness, `EURUSD#` at XM) work, because the EA reads the chart's real symbol.
