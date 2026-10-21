//+------------------------------------------------------------------+
//| LiquidityHunterB.mq5  -  Model B (trend continuation) EA         |
//|                                                                  |
//| Rules: docs/08 step B4, frozen. H4 trend, H1 aligned, M15 CHoCH  |
//| pullback (30-79% of the H1 leg), displacement, mandatory M5      |
//| retest of the order-block zone, stop beyond the M15 protected    |
//| level, 2R target, 24 h / Friday time exit.                       |
//|                                                                  |
//| STATUS: UNVALIDATED. In research this exact model showed no edge |
//| (docs/09: +0.05R on 17 trades, 95% CI -0.66R..+0.76R).           |
//| Trades DEMO accounts only unless InpAllowLive = true.            |
//|                                                                  |
//| All signals use closed bars and are recomputed from history on   |
//| each new M5 bar, so a restart rebuilds the same state.           |
//+------------------------------------------------------------------+
#property copyright   "Liquidity Hunter project"
#property version     "1.00"
#property description "Model B trend continuation. UNVALIDATED: no edge shown in research. Demo only by default."

#include <Trade\Trade.mqh>

//--- Account and risk
input bool   InpAllowLive        = false;  // Allow trading on a REAL account (research found no edge)
input long   InpMagic            = 20261022;
input double InpRiskPct          = 0.5;    // Risk per trade, % of equity
input double InpMaxOpenRiskPct   = 2.0;    // Max total open risk, % of equity
input int    InpMaxPositions     = 3;      // Max open positions (this EA)
input double InpDailyLossPct     = 2.0;    // Daily loss limit, % of day-start equity (17:00 New York)
input double InpMaxDrawdownPct   = 10.0;   // Max drawdown from equity high, % (locks entries)
input bool   InpResetDrawdownLock = false; // Set true once to clear a drawdown lock
input int    InpMaxSpreadPoints  = 60;     // Max spread to enter, points
input int    InpDeviationPoints  = 30;     // Max price deviation for market orders, points
input double InpMaxSlipRisk      = 1.5;    // Close if filled risk > x planned risk
//--- Trade rules (frozen research values)
input double InpTargetR          = 2.0;    // Target, R
input int    InpMaxHoldHours     = 24;     // Time exit, hours
input double InpStopBufferAtr    = 0.1;    // Stop buffer, x ATR(M15)
input double InpChaseAtr         = 0.5;    // Skip if entry is beyond the zone edge by > x ATR
input int    InpRetestHours      = 6;      // Retest expiry, hours
input double InpRetrMin          = 0.30;   // Pullback retracement min
input double InpRetrMax          = 0.79;   // Pullback retracement max
//--- Structure (frozen research values)
input int    InpSwingLeft        = 2;
input int    InpSwingRight       = 2;
input int    InpAtrPeriod        = 14;
input double InpBreakAtr         = 0.05;
input int    InpBreakTicks       = 2;
input int    InpMinSwings        = 6;
input int    InpRangeN           = 6;
input double InpRangeAtr         = 3.0;
input double InpDispAtr          = 1.5;
input double InpDispBody         = 0.6;
input double InpDispCloseZone    = 0.25;
input int    InpBarsM15          = 1500;   // History used: M15 bars
input int    InpBarsHTF          = 1000;   // History used: H1 / H4 bars
input int    InpServerUtcOffset  = 0;      // Broker server time minus UTC, hours (Deriv = 0)
input bool   InpLogCsv           = true;   // Write decisions to MQL5\Files\LH_B_log_<symbol>.csv

#define REG_INSUFF 0
#define REG_RANGE  1
#define REG_TRANS  2
#define REG_BULL   3
#define REG_BEAR   4

struct SwingPt     { int kind; int idx; double price; int known; };
struct StructEvent { int idx; int kind; double level; int swing_idx; double prot; };

struct TFData
  {
   MqlRates    r[];
   int         n;
   int         ps;
   double      atr[];
   SwingPt     sw[];
   int         nsw;
   StructEvent ev[];
   int         nev;
   int         trend[];
   int         regime[];
   double      protLow[];
   double      protHigh[];
  };

CTrade   g_trade;
double   g_tick = 0.01;
datetime g_last_m5 = 0;
string   g_gv_hwm, g_gv_day, g_gv_daystart, g_gv_ddlock;

//+------------------------------------------------------------------+
//| Logging                                                          |
//+------------------------------------------------------------------+
void Log(string setup, string evt, string reason, string detail)
  {
   PrintFormat("LH-B %s | %s | %s | %s", setup, evt, reason, detail);
   if(!InpLogCsv) return;
   string fn = "LH_B_log_" + _Symbol + ".csv";
   int h = FileOpen(fn, FILE_READ | FILE_WRITE | FILE_CSV | FILE_ANSI | FILE_SHARE_READ, ',');
   if(h == INVALID_HANDLE) return;
   if(FileSize(h) == 0) FileWrite(h, "server_time", "setup", "event", "reason", "detail");
   FileSeek(h, 0, SEEK_END);
   FileWrite(h, TimeToString(TimeCurrent(), TIME_DATE | TIME_SECONDS), setup, evt, reason, detail);
   FileClose(h);
  }

//+------------------------------------------------------------------+
//| Time helpers (New York, 17:00 trading-day boundary)              |
//+------------------------------------------------------------------+
int NthSundayDay(int year, int month, int nth)
  {
   MqlDateTime d; d.year = year; d.mon = month; d.day = 1; d.hour = 0; d.min = 0; d.sec = 0;
   MqlDateTime x; TimeToStruct(StructToTime(d), x);
   return 1 + (7 - x.day_of_week) % 7 + 7 * (nth - 1);
  }

datetime MakeUtc(int year, int month, int day, int hour)
  {
   MqlDateTime d; d.year = year; d.mon = month; d.day = day; d.hour = hour; d.min = 0; d.sec = 0;
   return StructToTime(d);
  }

int NYOffset(datetime utc)
  {
   MqlDateTime x; TimeToStruct(utc, x);
   datetime s = MakeUtc(x.year, 3, NthSundayDay(x.year, 3, 2), 7);
   datetime e = MakeUtc(x.year, 11, NthSundayDay(x.year, 11, 1), 6);
   return (utc >= s && utc < e) ? -4 : -5;
  }

datetime ToUtc(datetime server) { return server - InpServerUtcOffset * 3600; }

// New York local time as seconds since epoch (for hour/weekday arithmetic).
long NYLocal(datetime server)
  {
   datetime utc = ToUtc(server);
   return (long)utc + NYOffset(utc) * 3600;
  }

long TradingDay(datetime server) { return (NYLocal(server) + 7 * 3600) / 86400; }

int NYMinuteOfDay(datetime server) { return (int)((NYLocal(server) % 86400) / 60); }
int NYWeekday(datetime server)     { return (int)((NYLocal(server) / 86400 + 3) % 7); } // Monday = 0

bool EntryTimeAllowed(datetime server)
  {
   int m = NYMinuteOfDay(server), wd = NYWeekday(server);
   if(m >= 16 * 60 + 30 && m < 18 * 60) return false;   // daily break
   if(wd == 4 && m >= 16 * 60) return false;              // Friday late
   return wd != 5;                                         // Saturday
  }

bool TimeExitDue(datetime server, datetime opened)
  {
   if(server - opened >= InpMaxHoldHours * 3600) return true;
   return NYWeekday(server) == 4 && NYMinuteOfDay(server) >= 16 * 60 + 50;
  }

//+------------------------------------------------------------------+
//| Market structure (identical rules to the research code)          |
//+------------------------------------------------------------------+
void CalcAtr(TFData &d)
  {
   int n = d.n, p = InpAtrPeriod;
   ArrayResize(d.atr, n);
   double tr[];
   ArrayResize(tr, n);
   for(int i = 0; i < n; i++)
     {
      d.atr[i] = EMPTY_VALUE;
      double hl = d.r[i].high - d.r[i].low;
      if(i == 0) { tr[i] = hl; continue; }
      double pc = d.r[i - 1].close;
      tr[i] = MathMax(hl, MathMax(MathAbs(d.r[i].high - pc), MathAbs(d.r[i].low - pc)));
     }
   if(n < p) return;
   double s = 0;
   for(int i = 0; i < p; i++) s += tr[i];
   d.atr[p - 1] = s / p;
   for(int i = p; i < n; i++) d.atr[i] = (d.atr[i - 1] * (p - 1) + tr[i]) / p;
  }

void FindSwings(TFData &d)
  {
   ArrayResize(d.sw, 0);
   d.nsw = 0;
   for(int i = InpSwingLeft; i < d.n - InpSwingRight; i++)
     {
      bool isH = true, isL = true;
      for(int k = 1; k <= InpSwingLeft; k++)
        {
         if(!(d.r[i].high > d.r[i - k].high)) isH = false;
         if(!(d.r[i].low  < d.r[i - k].low))  isL = false;
        }
      for(int k = 1; k <= InpSwingRight; k++)
        {
         if(!(d.r[i].high >= d.r[i + k].high)) isH = false;
         if(!(d.r[i].low  <= d.r[i + k].low))  isL = false;
        }
      if(isH) { ArrayResize(d.sw, d.nsw + 1); d.sw[d.nsw].kind = 1;  d.sw[d.nsw].idx = i; d.sw[d.nsw].price = d.r[i].high; d.sw[d.nsw].known = i + InpSwingRight; d.nsw++; }
      if(isL) { ArrayResize(d.sw, d.nsw + 1); d.sw[d.nsw].kind = -1; d.sw[d.nsw].idx = i; d.sw[d.nsw].price = d.r[i].low;  d.sw[d.nsw].known = i + InpSwingRight; d.nsw++; }
     }
  }

// kind: 1 BOS_UP, 2 CHOCH_UP, -1 BOS_DOWN, -2 CHOCH_DOWN. Fills per-bar trend/regime/protected arrays.
void RunStructure(TFData &d)
  {
   int n = d.n;
   ArrayResize(d.ev, 0);  d.nev = 0;
   ArrayResize(d.trend, n); ArrayResize(d.regime, n);
   ArrayResize(d.protLow, n); ArrayResize(d.protHigh, n);
   int trend = 0, last_kind = 0, p = 0, seen = 0, rhi = 0, rli = 0;
   bool hasH = false, hasL = false;
   double rh = 0, rl = 0, pLow = EMPTY_VALUE, pHigh = EMPTY_VALUE;
   double recent[];
   ArrayResize(recent, 0);
   for(int t = 0; t < n; t++)
     {
      while(p < d.nsw && d.sw[p].known == t)
        {
         seen++;
         int m = ArraySize(recent);
         if(m < InpRangeN) { ArrayResize(recent, m + 1); recent[m] = d.sw[p].price; }
         else { for(int j = 1; j < m; j++) recent[j - 1] = recent[j]; recent[m - 1] = d.sw[p].price; }
         if(d.sw[p].kind == 1) { hasH = true; rh = d.sw[p].price; rhi = d.sw[p].idx; }
         else                  { hasL = true; rl = d.sw[p].price; rli = d.sw[p].idx; }
         p++;
        }
      double pa = (t >= 1) ? d.atr[t - 1] : EMPTY_VALUE;
      if(pa != EMPTY_VALUE)
        {
         double tol = MathMax(InpBreakAtr * pa, InpBreakTicks * g_tick);
         int kind = 0, swi = 0;
         double level = 0, prot = 0;
         if(hasH && d.r[t].close > rh + tol)
           {
            kind = (trend == -1) ? 2 : 1; level = rh; swi = rhi;
            prot = d.r[swi].low;
            for(int j = swi; j <= t; j++) prot = MathMin(prot, d.r[j].low);
            trend = 1; hasH = false; pLow = prot; pHigh = EMPTY_VALUE;
           }
         else if(hasL && d.r[t].close < rl - tol)
           {
            kind = (trend == 1) ? -2 : -1; level = rl; swi = rli;
            prot = d.r[swi].high;
            for(int j = swi; j <= t; j++) prot = MathMax(prot, d.r[j].high);
            trend = -1; hasL = false; pHigh = prot; pLow = EMPTY_VALUE;
           }
         if(kind != 0)
           {
            ArrayResize(d.ev, d.nev + 1);
            d.ev[d.nev].idx = t; d.ev[d.nev].kind = kind; d.ev[d.nev].level = level;
            d.ev[d.nev].swing_idx = swi; d.ev[d.nev].prot = prot;
            d.nev++;
            last_kind = kind;
           }
        }
      int reg;
      if(d.atr[t] == EMPTY_VALUE || seen < InpMinSwings) reg = REG_INSUFF;
      else if(ArraySize(recent) == InpRangeN && recent[ArrayMaximum(recent)] - recent[ArrayMinimum(recent)] <= InpRangeAtr * d.atr[t]) reg = REG_RANGE;
      else if(trend == 0 || MathAbs(last_kind) == 2) reg = REG_TRANS;
      else reg = (trend == 1) ? REG_BULL : REG_BEAR;
      d.trend[t] = trend; d.regime[t] = reg; d.protLow[t] = pLow; d.protHigh[t] = pHigh;
     }
  }

bool LoadTF(ENUM_TIMEFRAMES tf, int count, TFData &d)
  {
   ArraySetAsSeries(d.r, false);
   d.n = CopyRates(_Symbol, tf, 1, count, d.r);   // closed bars only, oldest first
   d.ps = PeriodSeconds(tf);
   if(d.n <= InpSwingLeft + InpSwingRight + InpAtrPeriod + 2) return false;
   CalcAtr(d);
   FindSwings(d);
   RunStructure(d);
   return true;
  }

// Index of the last bar whose close time <= t, or -1.
int StateIdx(const TFData &d, datetime t)
  {
   int lo = 0, hi = d.n - 1, ans = -1;
   while(lo <= hi)
     {
      int mid = (lo + hi) / 2;
      if(d.r[mid].time + d.ps <= t) { ans = mid; lo = mid + 1; }
      else hi = mid - 1;
     }
   return ans;
  }

// Displacement ending at bar t in direction dir; returns number of bars (0 = none).
int DisplacementBars(const TFData &d, int t, int dir)
  {
   double rng = d.r[t].high - d.r[t].low;
   if(rng <= 0) return 0;
   double pos = (dir == 1) ? (d.r[t].close - d.r[t].low) / rng : (d.r[t].high - d.r[t].close) / rng;
   if(pos < 1 - InpDispCloseZone) return 0;
   for(int k = 1; k <= 3; k++)
     {
      int s = t - k + 1;
      if(s < 1) return 0;
      double rs = d.r[s].high - d.r[s].low;
      double body = MathAbs(d.r[s].close - d.r[s].open);
      int sg = (d.r[s].close > d.r[s].open) ? 1 : (d.r[s].close < d.r[s].open ? -1 : 0);
      if(sg != dir || rs <= 0 || body < InpDispBody * rs) return 0;
      double ref = d.atr[s - 1];
      if(ref == EMPTY_VALUE) return 0;
      if(dir * (d.r[t].close - d.r[s].open) >= InpDispAtr * ref) return k;
     }
   return 0;
  }

// The displacement in the research code takes the first direction that qualifies (+1 checked first).
int DisplacementDir(const TFData &d, int t, int &bars)
  {
   bars = DisplacementBars(d, t, 1);
   if(bars > 0) return 1;
   bars = DisplacementBars(d, t, -1);
   if(bars > 0) return -1;
   return 0;
  }

//+------------------------------------------------------------------+
//| Model B setup search                                             |
//+------------------------------------------------------------------+
struct Setup
  {
   string   id;
   int      dir;
   double   prot;
   double   atr;
   double   zNear;
   double   zFar;
   datetime confirm_close;   // close time of the M5 bar that confirmed the retest
  };

// Retest on M5 from 'start'. Returns 1 confirmed (sets confirm_close), 0 still waiting, -1 failed.
int RunRetest(int dir, double zNear, double zFar, double stop, datetime start, double ref_entry, double ref_risk,
              datetime &confirm_close, string &why)
  {
   MqlRates m[];
   ArraySetAsSeries(m, false);
   datetime end = start + InpRetestHours * 3600;
   int n = CopyRates(_Symbol, PERIOD_M5, start, TimeCurrent(), m);
   if(n <= 0) { why = "NO_M5_DATA"; return 0; }
   double missed = ref_entry + dir * ref_risk;
   bool touched = false;
   int ps = PeriodSeconds(PERIOD_M5);
   datetime last_closed = iTime(_Symbol, PERIOD_M5, 0);
   for(int i = 0; i < n; i++)
     {
      if(m[i].time < start) continue;
      if(m[i].time >= end) { why = "EXPIRED"; return -1; }
      if(m[i].time >= last_closed) break;            // forming bar: not closed yet
      bool stop_hit = (dir < 0) ? m[i].high >= stop : m[i].low <= stop;
      bool miss     = (dir < 0) ? m[i].low <= missed : m[i].high >= missed;
      bool touch    = (dir < 0) ? m[i].high >= zNear : m[i].low <= zNear;
      bool farc     = (dir < 0) ? m[i].close > zFar : m[i].close < zFar;
      bool back     = (dir < 0) ? m[i].close < zNear : m[i].close > zNear;
      if(stop_hit) { why = "INVALID_STOP"; return -1; }
      if(!touched && miss) { why = "MISSED_NO_RETEST"; return -1; }
      if(touch) touched = true;
      if(touched)
        {
         if(farc) { why = "INVALID_FAR_CLOSE"; return -1; }
         if(back) { confirm_close = m[i].time + ps; why = "CONFIRMED"; return 1; }
        }
     }
   if(TimeCurrent() >= end) { why = "EXPIRED"; return -1; }
   why = "WAITING";
   return 0;
  }

// Evaluate recent M15 breaks; return true and fill s if a setup confirmed on the bar that just closed.
bool FindEntry(TFData &m15, TFData &h1, TFData &h4, Setup &s)
  {
   datetime now_m5_close = iTime(_Symbol, PERIOD_M5, 0);         // close time of the last closed M5 bar
   datetime oldest = now_m5_close - (InpRetestHours + 2) * 3600;
   for(int e = m15.nev - 1; e >= 0; e--)
     {
      int t = m15.ev[e].idx;
      datetime sig = m15.r[t].time + m15.ps;
      if(sig < oldest) break;
      int ev_dir = (m15.ev[e].kind > 0) ? 1 : -1;
      string id = "LHB-" + TimeToString(m15.r[t].time, TIME_DATE | TIME_MINUTES);
      StringReplace(id, ".", ""); StringReplace(id, ":", ""); StringReplace(id, " ", "-");

      int k4 = StateIdx(h4, sig), k1 = StateIdx(h1, sig);
      if(k4 < 0 || k1 < 0) continue;
      int d = (h4.regime[k4] == REG_BULL) ? 1 : (h4.regime[k4] == REG_BEAR ? -1 : 0);
      if(d == 0 || ev_dir != d || h1.trend[k1] != d) continue;
      if(MathAbs(m15.ev[e].kind) != 2) continue;                  // pullback CHoCH

      // pullback depth vs the H1 leg
      int ke = -1;
      for(int q = h1.nev - 1; q >= 0; q--)
         if(h1.r[h1.ev[q].idx].time + h1.ps <= sig && ((h1.ev[q].kind > 0) ? 1 : -1) == d) { ke = q; break; }
      if(ke < 0) continue;
      datetime leg_open = h1.r[h1.ev[ke].idx].time;
      int leg_start = -1;
      for(int i = 0; i < m15.n; i++) if(m15.r[i].time >= leg_open) { leg_start = i; break; }
      if(leg_start < 0 || leg_start >= t) continue;
      double leg_end = (d > 0) ? h1.protLow[k1] : h1.protHigh[k1];
      if(leg_end == EMPTY_VALUE) continue;
      int j = leg_start;
      for(int i = leg_start; i < t; i++)
         if((d > 0 && m15.r[i].high > m15.r[j].high) || (d < 0 && m15.r[i].low < m15.r[j].low)) j = i;
      double ext = (d > 0) ? m15.r[j].high : m15.r[j].low;
      double pb = (d > 0) ? m15.r[j].low : m15.r[j].high;
      for(int i = j; i <= t; i++) pb = (d > 0) ? MathMin(pb, m15.r[i].low) : MathMax(pb, m15.r[i].high);
      double size = (d > 0) ? ext - leg_end : leg_end - ext;
      double amt  = (d > 0) ? ext - pb : pb - ext;
      bool intact = (d > 0) ? pb > leg_end : pb < leg_end;
      if(size <= 0 || !intact) continue;
      double retr = amt / size;
      if(retr < InpRetrMin || retr > InpRetrMax) continue;

      // displacement including the break bar, ending at t..t+2
      double prot = m15.ev[e].prot;
      int u = -1, dk = 0;
      for(int v = t; v <= t + 2 && v < m15.n; v++)
        {
         if(v > t && ((d > 0 && m15.r[v].low <= prot) || (d < 0 && m15.r[v].high >= prot))) break;
         int bars;
         int dd = DisplacementDir(m15, v, bars);
         if(dd == d && v - bars + 1 <= t) { u = v; dk = bars; break; }
        }
      if(u < 0) continue;

      // order-block zone before the displacement
      int sidx = u - dk + 1, zi = -1;
      for(int i = sidx - 1; i >= MathMax(sidx - 10, 0); i--)
         if((d < 0 && m15.r[i].close > m15.r[i].open) || (d > 0 && m15.r[i].close < m15.r[i].open)) { zi = i; break; }
      if(zi < 0) continue;
      double zNear = m15.r[zi].open;
      double zFar  = (d < 0) ? m15.r[zi].high : m15.r[zi].low;
      double atr_u = m15.atr[u];
      double stop_est = prot - d * InpStopBufferAtr * atr_u;
      double ref_risk = d * (m15.r[u].close - stop_est);
      if(ref_risk <= 0) continue;

      datetime cc = 0;
      string why = "";
      int rt = RunRetest(d, zNear, zFar, stop_est, m15.r[u].time + m15.ps, m15.r[u].close, ref_risk, cc, why);
      if(rt == 1 && cc == now_m5_close)
        {
         s.id = id; s.dir = d; s.prot = prot; s.atr = atr_u; s.zNear = zNear; s.zFar = zFar; s.confirm_close = cc;
         return true;
        }
     }
   return false;
  }

//+------------------------------------------------------------------+
//| Risk and account protection                                      |
//+------------------------------------------------------------------+
bool AlreadyTraded(string id)
  {
   for(int i = PositionsTotal() - 1; i >= 0; i--)
      if(PositionGetSymbol(i) == _Symbol && PositionGetInteger(POSITION_MAGIC) == InpMagic && PositionGetString(POSITION_COMMENT) == id)
         return true;
   if(!HistorySelect(TimeCurrent() - 7 * 86400, TimeCurrent() + 60)) return false;
   for(int i = HistoryDealsTotal() - 1; i >= 0; i--)
     {
      ulong tk = HistoryDealGetTicket(i);
      if(HistoryDealGetInteger(tk, DEAL_MAGIC) == InpMagic && HistoryDealGetString(tk, DEAL_COMMENT) == id) return true;
     }
   return false;
  }

double MoneyPerPriceUnit(double lots)
  {
   double tv = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_VALUE_LOSS);
   if(tv <= 0) tv = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_VALUE);
   return lots * tv / g_tick;
  }

double OpenRiskMoney(int &count)
  {
   double total = 0;
   count = 0;
   for(int i = PositionsTotal() - 1; i >= 0; i--)
     {
      if(PositionGetSymbol(i) != _Symbol || PositionGetInteger(POSITION_MAGIC) != InpMagic) continue;
      count++;
      double sl = PositionGetDouble(POSITION_SL), op = PositionGetDouble(POSITION_PRICE_OPEN);
      double vol = PositionGetDouble(POSITION_VOLUME);
      bool buy = PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY;
      double dist = (sl > 0) ? (buy ? op - sl : sl - op) : op * 0.02;   // missing SL counted as a large risk
      if(dist > 0) total += dist * MoneyPerPriceUnit(vol);
     }
   return total;
  }

// Returns "" if entries are allowed, otherwise a reason code.
string AccountLock()
  {
   double eq = AccountInfoDouble(ACCOUNT_EQUITY);
   if(InpResetDrawdownLock) { GlobalVariableDel(g_gv_ddlock); GlobalVariableSet(g_gv_hwm, eq); }
   double hwm = GlobalVariableCheck(g_gv_hwm) ? GlobalVariableGet(g_gv_hwm) : 0;
   if(eq > hwm) { hwm = eq; GlobalVariableSet(g_gv_hwm, hwm); }
   if(GlobalVariableCheck(g_gv_ddlock)) return "DRAWDOWN_LOCK";
   if(eq < hwm * (1 - InpMaxDrawdownPct / 100))
     {
      GlobalVariableSet(g_gv_ddlock, 1);
      Log("-", "LOCK", "DRAWDOWN_LOCK", StringFormat("equity %.2f hwm %.2f", eq, hwm));
      return "DRAWDOWN_LOCK";
     }
   double day = (double)TradingDay(TimeTradeServer());
   if(!GlobalVariableCheck(g_gv_day) || GlobalVariableGet(g_gv_day) != day)
     {
      GlobalVariableSet(g_gv_day, day);
      GlobalVariableSet(g_gv_daystart, eq);
     }
   double ds = GlobalVariableGet(g_gv_daystart);
   if(eq < ds * (1 - InpDailyLossPct / 100)) return "DAILY_LOSS_LOCK";
   return "";
  }

//+------------------------------------------------------------------+
//| Execution                                                        |
//+------------------------------------------------------------------+
// After a fill: make sure the stop exists; check slippage.
void VerifyProtection(string id, double planned_risk)
  {
   for(int i = PositionsTotal() - 1; i >= 0; i--)
     {
      ulong tk = PositionGetTicket(i);
      if(tk == 0 || PositionGetInteger(POSITION_MAGIC) != InpMagic || PositionGetString(POSITION_COMMENT) != id) continue;
      double sl = PositionGetDouble(POSITION_SL), tp = PositionGetDouble(POSITION_TP), op = PositionGetDouble(POSITION_PRICE_OPEN);
      bool buy = PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY;
      if(sl <= 0)
        {
         double want = buy ? op - planned_risk : op + planned_risk;
         bool fixed = false;
         for(int a = 0; a < 2 && !fixed; a++) fixed = g_trade.PositionModify(tk, NormalizeDouble(want, _Digits), tp);
         if(!fixed)
           {
            g_trade.PositionClose(tk);
            Log(id, "EMERGENCY", "UNPROTECTED_CLOSE", "stop could not be set; position closed");
            return;
           }
         Log(id, "PROTECT", "SL_SET_AFTER_FILL", "");
         sl = want;
        }
      double filled_risk = buy ? op - sl : sl - op;
      if(filled_risk > InpMaxSlipRisk * planned_risk)
        {
         g_trade.PositionClose(tk);
         Log(id, "EXIT", "SLIP_EXCESS", StringFormat("filled risk %.2f planned %.2f", filled_risk, planned_risk));
        }
      return;
     }
  }

void TryEnter(const Setup &s)
  {
   if(AlreadyTraded(s.id)) return;
   string lock = AccountLock();
   if(lock != "") { Log(s.id, "REJECT", lock, ""); return; }
   datetime now = TimeTradeServer();
   if(!EntryTimeAllowed(now)) { Log(s.id, "REJECT", "TIME_FILTER", ""); return; }
   MqlTick tk;
   if(!SymbolInfoTick(_Symbol, tk) || now - tk.time > 120) { Log(s.id, "REJECT", "STALE_DATA", ""); return; }
   double spread = tk.ask - tk.bid;
   if(spread / _Point > InpMaxSpreadPoints) { Log(s.id, "REJECT", "SPREAD_HIGH", DoubleToString(spread / _Point, 0)); return; }

   int d = s.dir;
   double entry = (d > 0) ? tk.ask : tk.bid;
   if(d * (s.zNear - entry) > InpChaseAtr * s.atr) { Log(s.id, "REJECT", "CHASED", ""); return; }
   double stop = s.prot - d * MathMax(InpStopBufferAtr * s.atr, 1.5 * spread);
   double risk = d * (entry - stop);
   if(risk <= 0) { Log(s.id, "REJECT", "STOP_BEYOND_ENTRY", ""); return; }
   long stops_level = SymbolInfoInteger(_Symbol, SYMBOL_TRADE_STOPS_LEVEL);
   if(risk < stops_level * _Point + spread) { Log(s.id, "REJECT", "STOP_TOO_TIGHT", ""); return; }
   double target = entry + d * InpTargetR * risk;
   stop = NormalizeDouble(stop, _Digits);
   target = NormalizeDouble(target, _Digits);

   double eq = AccountInfoDouble(ACCOUNT_EQUITY);
   double risk_money = eq * InpRiskPct / 100;
   double per_lot = MoneyPerPriceUnit(1.0) * (risk + spread);
   double vmin = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN), vmax = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MAX);
   double vstep = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_STEP);
   double lots = MathFloor(risk_money / per_lot / vstep) * vstep;
   lots = NormalizeDouble(MathMin(lots, vmax), 8);
   if(lots < vmin) { Log(s.id, "REJECT", "RISK_MIN_VOL_EXCEEDS", StringFormat("need %.4f lots, min %.2f", risk_money / per_lot, vmin)); return; }

   int count;
   double open_risk = OpenRiskMoney(count);
   if(count >= InpMaxPositions) { Log(s.id, "REJECT", "MAX_POSITIONS", ""); return; }
   if(open_risk + lots * per_lot > eq * InpMaxOpenRiskPct / 100) { Log(s.id, "REJECT", "MAX_OPEN_RISK", ""); return; }

   bool ok = (d > 0) ? g_trade.Buy(lots, _Symbol, 0, stop, target, s.id) : g_trade.Sell(lots, _Symbol, 0, stop, target, s.id);
   uint rc = g_trade.ResultRetcode();
   if(!ok || (rc != TRADE_RETCODE_DONE && rc != TRADE_RETCODE_PLACED))
     {
      Log(s.id, "ORDER_FAIL", "ORD_REJECT", StringFormat("retcode %u %s", rc, g_trade.ResultRetcodeDescription()));
      return;
     }
   Log(s.id, "ENTRY", d > 0 ? "BUY" : "SELL",
       StringFormat("lots %.2f price %.2f sl %.2f tp %.2f risk %.2f planned_money %.2f", lots, g_trade.ResultPrice(), stop, target, risk, lots * per_lot));
   VerifyProtection(s.id, risk);
  }

void ManagePositions()
  {
   datetime now = TimeTradeServer();
   for(int i = PositionsTotal() - 1; i >= 0; i--)
     {
      ulong tk = PositionGetTicket(i);
      if(tk == 0 || PositionGetString(POSITION_SYMBOL) != _Symbol || PositionGetInteger(POSITION_MAGIC) != InpMagic) continue;
      string id = PositionGetString(POSITION_COMMENT);
      if(PositionGetDouble(POSITION_SL) <= 0)
        {
         if(g_trade.PositionClose(tk)) Log(id, "EMERGENCY", "UNPROTECTED_CLOSE", "position found without stop");
         continue;
        }
      if(TimeExitDue(now, (datetime)PositionGetInteger(POSITION_TIME)))
        {
         if(g_trade.PositionClose(tk)) Log(id, "EXIT", "TIME", "");
         else Log(id, "EXIT_FAIL", "TIME_CLOSE_FAILED", StringFormat("retcode %u", g_trade.ResultRetcode()));
        }
     }
  }

//+------------------------------------------------------------------+
int OnInit()
  {
   if(!InpAllowLive && AccountInfoInteger(ACCOUNT_TRADE_MODE) == ACCOUNT_TRADE_MODE_REAL)
     {
      Alert("LiquidityHunterB: real account detected and InpAllowLive = false. This model showed NO edge in research. EA stopped.");
      return INIT_FAILED;
     }
   if(AccountInfoInteger(ACCOUNT_MARGIN_MODE) != ACCOUNT_MARGIN_MODE_RETAIL_HEDGING)
      Print("LH-B: account is not hedging; behaviour was designed for hedging accounts.");
   g_tick = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_SIZE);
   if(g_tick <= 0) g_tick = _Point;
   g_trade.SetExpertMagicNumber(InpMagic);
   g_trade.SetDeviationInPoints(InpDeviationPoints);
   g_trade.SetTypeFillingBySymbol(_Symbol);
   string base = "LHB_" + _Symbol + "_" + IntegerToString(InpMagic) + "_";
   g_gv_hwm = base + "hwm"; g_gv_day = base + "day"; g_gv_daystart = base + "daystart"; g_gv_ddlock = base + "ddlock";
   g_last_m5 = 0;
   Log("-", "INIT", "UNVALIDATED_MODEL", StringFormat("account %I64d mode %s", AccountInfoInteger(ACCOUNT_LOGIN),
       AccountInfoInteger(ACCOUNT_TRADE_MODE) == ACCOUNT_TRADE_MODE_REAL ? "REAL" : "DEMO/CONTEST"));
   return INIT_SUCCEEDED;
  }

void OnTick()
  {
   ManagePositions();
   datetime m5 = iTime(_Symbol, PERIOD_M5, 0);
   if(m5 == 0 || m5 == g_last_m5) return;
   TFData m15, h1, h4;
   if(!LoadTF(PERIOD_M15, InpBarsM15, m15) || !LoadTF(PERIOD_H1, InpBarsHTF, h1) || !LoadTF(PERIOD_H4, InpBarsHTF, h4))
      return;   // history not ready; retry on the next tick
   g_last_m5 = m5;
   Setup s;
   if(FindEntry(m15, h1, h4, s)) TryEnter(s);
  }
//+------------------------------------------------------------------+
