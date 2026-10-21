//+------------------------------------------------------------------+
//| LiquidityHunter.mq5                                              |
//| Chart tool: confirmed swings, BOS/CHoCH, regime, liquidity pools |
//| (previous day/week, sessions, equal highs/lows, H1/H4 swings)    |
//| and sweep / reclaim marks.                                       |
//|                                                                  |
//| Same definitions as the Python research code (spec v0.4).        |
//| Uses CLOSED bars only and recomputes from history on each new    |
//| bar, so nothing already drawn moves (no repaint). Swings appear  |
//| InpSwingRight bars after the swing bar, when they are confirmed. |
//|                                                                  |
//| RESEARCH RESULT: trading these signals showed NO edge on Deriv   |
//| gold 2022-11..2024-12 (docs/07, 09, 11). This is a visual aid,   |
//| not a trading system.                                            |
//+------------------------------------------------------------------+
#property copyright   "Liquidity Hunter project"
#property version     "1.01"
#property description "Swings, BOS/CHoCH, regime, liquidity pools and sweeps on closed bars (no repaint)."
#property description "Visual aid only: these rules showed no trading edge in testing."
#property indicator_chart_window
#property indicator_buffers 0
#property indicator_plots   0

//--- Structure (chart timeframe)
input int    InpSwingLeft       = 2;      // Swing: bars on the left
input int    InpSwingRight      = 2;      // Swing: bars on the right (confirmation delay)
input int    InpAtrPeriod       = 14;     // ATR period
input double InpBreakAtr        = 0.05;   // Break tolerance, x ATR
input int    InpBreakTicks      = 2;      // Break tolerance, minimum ticks
input int    InpMinSwings       = 6;      // Swings needed before a regime is shown
input int    InpRangeN          = 6;      // Range test: last N swings
input double InpRangeAtr        = 3.0;    // Range test: N swings within x ATR
input int    InpBarsBack        = 1500;   // Closed bars to analyse

//--- Liquidity and sweeps
input int    InpLookbackDays    = 10;     // Draw pools known in the last N days
input ENUM_TIMEFRAMES InpSweepTF = PERIOD_M15; // Timeframe for sweep detection
input double InpEqAtr           = 0.10;   // Equal highs/lows tolerance, x ATR(H1)
input int    InpEqTicks         = 3;      // Equal highs/lows tolerance, minimum ticks
input int    InpEqMinBars       = 5;      // Equal highs/lows: min bars apart
input int    InpEqLookback      = 10;     // Equal highs/lows: swings compared
input int    InpSwingPoolAge    = 200;    // H1/H4 swing pools expire after N bars
input double InpSweepMinAtr     = 0.05;   // Sweep: minimum depth, x ATR
input int    InpSweepMinTicks   = 2;      // Sweep: minimum depth, ticks
input double InpSweepMaxAtr     = 1.0;    // Deeper than this = breakout, x ATR
input int    InpReclaimBars     = 3;      // Bars allowed to close back inside

//--- Time
input int    InpServerUtcOffset = 0;      // Broker server time minus UTC, hours (Deriv = 0)

//--- Display
input bool   InpShowSwings      = true;
input bool   InpShowStructure   = true;
input bool   InpShowDayWeek     = true;
input bool   InpShowSessions    = true;
input bool   InpShowEqual       = true;
input bool   InpShowSwingPools  = false;
input bool   InpShowSweeps      = true;
input bool   InpShowPanel       = true;
input color  InpColBull         = clrSeaGreen;
input color  InpColBear         = clrCrimson;
input color  InpColChoch        = clrMediumOrchid;
input color  InpColDay          = clrDodgerBlue;
input color  InpColWeek         = clrNavy;
input color  InpColSession      = clrDarkGoldenrod;
input color  InpColEqual        = clrTeal;
input color  InpColSwingPool    = clrGray;
input color  InpColReclaim      = clrOrangeRed;

//--- Parity export
input bool   InpExportCsv       = false;  // Write swings, events and pools to MQL5\Files

#define PFX "LH_"

struct SwingPt     { int kind; int idx; double price; int known; };
struct StructEvent { int idx; int kind; double level; int swing_idx; double prot; };
struct Pool
  {
   string   id;
   string   type;
   int      side;      // +1 high pool, -1 low pool
   string   tf;
   double   level;
   double   lo;
   double   hi;
   datetime origin;
   datetime known;
   datetime expires;
   string   status;
   string   reason;
   datetime sweep_t;
   double   extreme;
   datetime end_t;
  };

double   g_tick = 0.01;
datetime g_last_chart_bar = 0;
datetime g_last_sweep_bar = 0;
string   g_regime_chart = "", g_regime_h1 = "", g_regime_h4 = "";
Pool     g_pools[];
int      g_npools = 0;

//+------------------------------------------------------------------+
//| Time helpers: server time <-> UTC <-> New York                   |
//+------------------------------------------------------------------+
int NthSundayDay(int year, int month, int n)
  {
   MqlDateTime d; d.year = year; d.mon = month; d.day = 1; d.hour = 0; d.min = 0; d.sec = 0;
   datetime t = StructToTime(d);
   MqlDateTime x; TimeToStruct(t, x);
   int first = 1 + (7 - x.day_of_week) % 7;
   return first + 7 * (n - 1);
  }

datetime MakeUtc(int year, int month, int day, int hour)
  {
   MqlDateTime d; d.year = year; d.mon = month; d.day = day; d.hour = hour; d.min = 0; d.sec = 0;
   return StructToTime(d);
  }

// New York offset from UTC in hours (-4 summer, -5 winter), US rules since 2007.
int NYOffset(datetime utc)
  {
   MqlDateTime x; TimeToStruct(utc, x);
   datetime start = MakeUtc(x.year, 3, NthSundayDay(x.year, 3, 2), 7);   // 02:00 EST
   datetime end   = MakeUtc(x.year, 11, NthSundayDay(x.year, 11, 1), 6); // 02:00 EDT
   return (utc >= start && utc < end) ? -4 : -5;
  }

datetime ToUtc(datetime server)    { return server - InpServerUtcOffset * 3600; }
datetime ToServer(datetime utc)    { return utc + InpServerUtcOffset * 3600; }

// Trading day number (17:00 New York boundary), labelled by the date on which it ends.
long TradingDay(datetime server)
  {
   datetime utc = ToUtc(server);
   long ny = (long)utc + NYOffset(utc) * 3600;
   return (ny + 7 * 3600) / 86400;
  }

// Server time at which trading day d starts (17:00 New York of the previous date).
datetime DayStart(long d)
  {
   long guess = d * 86400 - 7 * 3600 + 5 * 3600;
   int off = NYOffset((datetime)guess);
   return ToServer((datetime)(d * 86400 - 7 * 3600 - off * 3600));
  }

int  Weekday(long d)        { return (int)((d + 3) % 7); }   // Monday = 0
long NextWeekday(long d)    { long n = d + 1; while(Weekday(n) >= 5) n++; return n; }

//+------------------------------------------------------------------+
//| Data and indicators                                              |
//+------------------------------------------------------------------+
int LoadClosed(ENUM_TIMEFRAMES tf, int count, MqlRates &r[])
  {
   ArraySetAsSeries(r, false);
   return CopyRates(_Symbol, tf, 1, count, r);
  }

void CalcAtr(const MqlRates &r[], int n, int p, double &a[])
  {
   ArrayResize(a, n);
   double tr[];
   ArrayResize(tr, n);
   for(int i = 0; i < n; i++)
     {
      a[i] = EMPTY_VALUE;
      double hl = r[i].high - r[i].low;
      if(i == 0) { tr[i] = hl; continue; }
      double pc = r[i - 1].close;
      tr[i] = MathMax(hl, MathMax(MathAbs(r[i].high - pc), MathAbs(r[i].low - pc)));
     }
   if(n < p) return;
   double s = 0;
   for(int i = 0; i < p; i++) s += tr[i];
   a[p - 1] = s / p;
   for(int i = p; i < n; i++) a[i] = (a[i - 1] * (p - 1) + tr[i]) / p;
  }

int FindSwings(const MqlRates &r[], int n, SwingPt &sw[])
  {
   ArrayResize(sw, 0);
   int cnt = 0;
   for(int i = InpSwingLeft; i < n - InpSwingRight; i++)
     {
      bool isH = true, isL = true;
      for(int k = 1; k <= InpSwingLeft; k++)
        {
         if(!(r[i].high > r[i - k].high)) isH = false;
         if(!(r[i].low  < r[i - k].low))  isL = false;
        }
      for(int k = 1; k <= InpSwingRight; k++)
        {
         if(!(r[i].high >= r[i + k].high)) isH = false;
         if(!(r[i].low  <= r[i + k].low))  isL = false;
        }
      if(isH) { ArrayResize(sw, cnt + 1); sw[cnt].kind = 1;  sw[cnt].idx = i; sw[cnt].price = r[i].high; sw[cnt].known = i + InpSwingRight; cnt++; }
      if(isL) { ArrayResize(sw, cnt + 1); sw[cnt].kind = -1; sw[cnt].idx = i; sw[cnt].price = r[i].low;  sw[cnt].known = i + InpSwingRight; cnt++; }
     }
   return cnt;
  }

// BOS / CHoCH and regime, bar by bar (kind: 1 BOS_UP, 2 CHOCH_UP, -1 BOS_DOWN, -2 CHOCH_DOWN).
string RunStructure(const MqlRates &r[], int n, const SwingPt &sw[], int nsw, const double &a[], StructEvent &ev[])
  {
   ArrayResize(ev, 0);
   int nev = 0, trend = 0, last_kind = 0, p = 0, seen = 0;
   bool hasH = false, hasL = false;
   double rh = 0, rl = 0;
   int rhi = 0, rli = 0;
   double recent[];
   ArrayResize(recent, 0);
   string regime = "INSUFFICIENT_DATA";
   for(int t = 0; t < n; t++)
     {
      while(p < nsw && sw[p].known == t)
        {
         seen++;
         int m = ArraySize(recent);
         if(m < InpRangeN) { ArrayResize(recent, m + 1); recent[m] = sw[p].price; }
         else { for(int j = 1; j < m; j++) recent[j - 1] = recent[j]; recent[m - 1] = sw[p].price; }
         if(sw[p].kind == 1) { hasH = true; rh = sw[p].price; rhi = sw[p].idx; }
         else                { hasL = true; rl = sw[p].price; rli = sw[p].idx; }
         p++;
        }
      double pa = (t >= 1) ? a[t - 1] : EMPTY_VALUE;
      if(pa != EMPTY_VALUE)
        {
         double tol = MathMax(InpBreakAtr * pa, InpBreakTicks * g_tick);
         int kind = 0, swi = 0;
         double level = 0, prot = 0;
         if(hasH && r[t].close > rh + tol)
           {
            kind = (trend == -1) ? 2 : 1; level = rh; swi = rhi;
            prot = r[swi].low;
            for(int j = swi; j <= t; j++) prot = MathMin(prot, r[j].low);
            trend = 1; hasH = false;
           }
         else if(hasL && r[t].close < rl - tol)
           {
            kind = (trend == 1) ? -2 : -1; level = rl; swi = rli;
            prot = r[swi].high;
            for(int j = swi; j <= t; j++) prot = MathMax(prot, r[j].high);
            trend = -1; hasL = false;
           }
         if(kind != 0)
           {
            ArrayResize(ev, nev + 1);
            ev[nev].idx = t; ev[nev].kind = kind; ev[nev].level = level; ev[nev].swing_idx = swi; ev[nev].prot = prot;
            nev++;
            last_kind = kind;
           }
        }
      if(a[t] == EMPTY_VALUE || seen < InpMinSwings)
         regime = "INSUFFICIENT_DATA";
      else if(ArraySize(recent) == InpRangeN && recent[ArrayMaximum(recent)] - recent[ArrayMinimum(recent)] <= InpRangeAtr * a[t])
         regime = "RANGE";
      else if(trend == 0 || MathAbs(last_kind) == 2)
         regime = "TRANSITIONAL";
      else
         regime = (trend == 1) ? "BULL_TREND" : "BEAR_TREND";
     }
   return regime;
  }

string RegimeOf(ENUM_TIMEFRAMES tf)
  {
   MqlRates r[];
   int n = LoadClosed(tf, InpBarsBack, r);
   if(n <= InpSwingLeft + InpSwingRight) return "NO DATA";
   double a[];
   CalcAtr(r, n, InpAtrPeriod, a);
   SwingPt sw[];
   int nsw = FindSwings(r, n, sw);
   StructEvent ev[];
   return RunStructure(r, n, sw, nsw, a, ev);
  }

//+------------------------------------------------------------------+
//| Pools                                                            |
//+------------------------------------------------------------------+
void AddPool(string id, string type, int side, string tf, double level, double lo, double hi,
             datetime origin, datetime known, datetime expires)
  {
   ArrayResize(g_pools, g_npools + 1);
   g_pools[g_npools].id = id;     g_pools[g_npools].type = type;   g_pools[g_npools].side = side;
   g_pools[g_npools].tf = tf;     g_pools[g_npools].level = level; g_pools[g_npools].lo = lo;
   g_pools[g_npools].hi = hi;     g_pools[g_npools].origin = origin;
   g_pools[g_npools].known = known; g_pools[g_npools].expires = expires;
   g_pools[g_npools].status = "ACTIVE"; g_pools[g_npools].reason = "";
   g_pools[g_npools].sweep_t = 0; g_pools[g_npools].extreme = 0; g_pools[g_npools].end_t = 0;
   g_npools++;
  }

void SwingPools(ENUM_TIMEFRAMES tf, string tfname)
  {
   MqlRates r[];
   int n = LoadClosed(tf, InpBarsBack, r);
   if(n <= InpSwingLeft + InpSwingRight) return;
   SwingPt sw[];
   int nsw = FindSwings(r, n, sw);
   int ps = PeriodSeconds(tf);
   for(int i = 0; i < nsw; i++)
     {
      datetime t = r[sw[i].idx].time;
      AddPool(StringFormat("SWING-%s-%s-%s", tfname, sw[i].kind == 1 ? "H" : "L", TimeToString(t)), "SWING",
              sw[i].kind, tfname, sw[i].price, sw[i].price, sw[i].price, t,
              r[sw[i].known].time + ps, t + InpSwingPoolAge * ps);
     }
  }

void EqualPools()
  {
   MqlRates r[];
   int n = LoadClosed(PERIOD_H1, InpBarsBack, r);
   if(n <= InpSwingLeft + InpSwingRight) return;
   double a[];
   CalcAtr(r, n, InpAtrPeriod, a);
   SwingPt sw[];
   int nsw = FindSwings(r, n, sw);
   int ps = PeriodSeconds(PERIOD_H1);
   int first_new = g_npools;
   for(int pass = 0; pass < 2; pass++)
     {
      int kind = (pass == 0) ? 1 : -1;
      int hist[];
      int nh = 0;
      ArrayResize(hist, 0);
      for(int i = 0; i < nsw; i++)
        {
         if(sw[i].kind != kind) continue;
         double ak = a[sw[i].known];
         if(ak == EMPTY_VALUE) { ArrayResize(hist, nh + 1); hist[nh++] = i; continue; }
         double tol = MathMax(InpEqAtr * ak, InpEqTicks * g_tick);
         int lo_k = MathMax(0, nh - InpEqLookback);
         for(int q = nh - 1; q >= lo_k; q--)
           {
            int j = hist[q];
            if(MathAbs(sw[j].price - sw[i].price) > tol || sw[i].idx - sw[j].idx < InpEqMinBars) continue;
            double outer = (kind == 1) ? MathMax(sw[j].price, sw[i].price) : MathMin(sw[j].price, sw[i].price);
            bool breached = false;
            for(int b = sw[j].idx + 1; b < sw[i].idx; b++)
              {
               if(kind == 1 && r[b].high > outer) { breached = true; break; }
               if(kind == -1 && r[b].low < outer) { breached = true; break; }
              }
            if(breached) continue;
            datetime known = r[sw[i].known].time + ps;
            bool dup = false;
            for(int k = first_new; k < g_npools; k++)
               if(g_pools[k].side == kind && MathAbs(g_pools[k].level - outer) <= tol && g_pools[k].expires > known) { dup = true; break; }
            if(!dup)
               AddPool(StringFormat("EQ%s-H1-%s", kind == 1 ? "H" : "L", TimeToString(r[sw[i].idx].time)),
                       kind == 1 ? "EQH" : "EQL", kind, "H1", outer,
                       MathMin(sw[j].price, sw[i].price), MathMax(sw[j].price, sw[i].price),
                       r[sw[j].idx].time, known, r[sw[i].idx].time + InpSwingPoolAge * ps);
            break;
           }
         ArrayResize(hist, nh + 1);
         hist[nh++] = i;
        }
     }
  }

// Previous day / week high-low and session high-low, from H1 bars (sessions are hour-aligned).
void PeriodAndSessionPools()
  {
   MqlRates r[];
   int n = LoadClosed(PERIOD_H1, InpBarsBack, r);
   if(n < 2) return;
   int ps = PeriodSeconds(PERIOD_H1);
   datetime data_start = r[0].time, data_end = r[n - 1].time + ps;
   // --- days and weeks
   for(int pass = 0; pass < 2; pass++)
     {
      bool week = (pass == 1);
      int i = 0;
      while(i < n)
        {
         long d0 = TradingDay(r[i].time);
         long key = week ? d0 - Weekday(d0) : d0;
         double hi = r[i].high, lo = r[i].low;
         datetime hi_t = r[i].time, lo_t = r[i].time;
         int j = i + 1;
         while(j < n)
           {
            long dj = TradingDay(r[j].time);
            long kj = week ? dj - Weekday(dj) : dj;
            if(kj != key) break;
            if(r[j].high > hi) { hi = r[j].high; hi_t = r[j].time; }
            if(r[j].low < lo)  { lo = r[j].low;  lo_t = r[j].time; }
            j++;
           }
         long last_day = week ? key + 4 : key;
         datetime start = DayStart(key), end = DayStart(last_day + 1);
         if(start >= data_start && end <= data_end)
           {
            datetime nxt = week ? DayStart(last_day + 8) : DayStart(NextWeekday(last_day) + 1);
            string nm = week ? "PW" : "PD";
            string lbl = TimeToString((datetime)(key * 86400), TIME_DATE);
            AddPool(nm + "H-" + lbl, nm + "H", 1, week ? "W" : "D", hi, hi, hi, hi_t, end, nxt);
            AddPool(nm + "L-" + lbl, nm + "L", -1, week ? "W" : "D", lo, lo, lo, lo_t, end, nxt);
           }
         i = j;
        }
     }
   // --- sessions (minutes after the 17:00 New York day start)
   string names[3] = {"ASIA", "LONDON", "NEWYORK"};
   int    m0[3]    = {60, 540, 900};
   int    m1[3]    = {540, 900, 1380};
   long dfirst = TradingDay(r[0].time), dlast = TradingDay(r[n - 1].time);
   for(long d = dfirst; d <= dlast; d++)
     {
      datetime ds = DayStart(d);
      for(int s = 0; s < 3; s++)
        {
         datetime b = ds + m0[s] * 60, e = ds + m1[s] * 60;
         if(b < data_start || e > data_end) continue;
         double hi = -DBL_MAX, lo = DBL_MAX;
         datetime hi_t = 0, lo_t = 0;
         for(int i = 0; i < n; i++)
           {
            if(r[i].time < b || r[i].time >= e) continue;
            if(r[i].high > hi) { hi = r[i].high; hi_t = r[i].time; }
            if(r[i].low < lo)  { lo = r[i].low;  lo_t = r[i].time; }
           }
         if(hi_t == 0) continue;
         string lbl = TimeToString((datetime)(d * 86400), TIME_DATE);
         AddPool(names[s] + "H-" + lbl, names[s] + "_H", 1, "SESSION", hi, hi, hi, hi_t, e, e + 86400);
         AddPool(names[s] + "L-" + lbl, names[s] + "_L", -1, "SESSION", lo, lo, lo, lo_t, e, e + 86400);
        }
     }
  }

// Sweep / reclaim / breakout per pool on InpSweepTF closed bars (same rules as lh/liquidity/sweep.py).
void DetectSweeps()
  {
   MqlRates r[];
   int n = LoadClosed(InpSweepTF, InpBarsBack * 4, r);
   if(n < 2) return;
   double a[];
   CalcAtr(r, n, InpAtrPeriod, a);
   int ps = PeriodSeconds(InpSweepTF);
   datetime data_end = r[n - 1].time + ps;
   for(int k = 0; k < g_npools; k++)
     {
      double sgn = g_pools[k].side;
      double level = g_pools[k].level;
      int i = 0;
      while(i < n && r[i].time < g_pools[k].known) i++;
      int sweep_i = -1;
      double extreme = 0;
      bool done = false;
      for(; i < n && !done; i++)
        {
         if(r[i].time >= g_pools[k].expires && sweep_i < 0) break;
         if(i < 1 || a[i - 1] == EMPTY_VALUE) continue;
         double pa = a[i - 1];
         double s_min = MathMax(InpSweepMinAtr * pa, InpSweepMinTicks * g_tick);
         double s_max = InpSweepMaxAtr * pa;
         double b_tol = MathMax(InpBreakAtr * pa, InpBreakTicks * g_tick);
         double ext = (sgn > 0) ? r[i].high : r[i].low;
         double pen = sgn * (ext - level);
         double cb = sgn * (r[i].close - level);
         datetime ct = r[i].time + ps;
         if(sweep_i < 0)
           {
            if(pen >= s_min) { sweep_i = i; extreme = ext; g_pools[k].sweep_t = r[i].time; }
            else if(cb >= b_tol) { g_pools[k].status = "BROKEN"; g_pools[k].reason = "close_through"; g_pools[k].end_t = ct; done = true; continue; }
            else continue;
           }
         else if(sgn * (ext - extreme) > 0)
            extreme = ext;
         g_pools[k].extreme = extreme;
         if(sgn * (extreme - level) > s_max) { g_pools[k].status = "BROKEN"; g_pools[k].reason = "too_deep"; g_pools[k].end_t = ct; done = true; }
         else if(cb < 0)                      { g_pools[k].status = "RECLAIMED"; g_pools[k].end_t = ct; done = true; }
         else if(cb >= b_tol)                 { g_pools[k].status = "BROKEN"; g_pools[k].reason = "close_through"; g_pools[k].end_t = ct; done = true; }
         else if(i - sweep_i + 1 >= InpReclaimBars) { g_pools[k].status = "NO_RECLAIM"; g_pools[k].end_t = ct; done = true; }
        }
      if(!done && sweep_i < 0 && data_end >= g_pools[k].expires)
        {
         g_pools[k].status = "EXPIRED";
         g_pools[k].end_t = g_pools[k].expires;
        }
     }
  }

//+------------------------------------------------------------------+
//| Drawing                                                          |
//+------------------------------------------------------------------+
void Seg(string name, datetime t1, datetime t2, double price, color c, ENUM_LINE_STYLE st, int w, string tip)
  {
   ObjectCreate(0, name, OBJ_TREND, 0, t1, price, t2, price);
   ObjectSetInteger(0, name, OBJPROP_COLOR, c);
   ObjectSetInteger(0, name, OBJPROP_STYLE, st);
   ObjectSetInteger(0, name, OBJPROP_WIDTH, w);
   ObjectSetInteger(0, name, OBJPROP_RAY_RIGHT, false);
   ObjectSetInteger(0, name, OBJPROP_SELECTABLE, false);
   ObjectSetInteger(0, name, OBJPROP_BACK, true);
   ObjectSetString(0, name, OBJPROP_TOOLTIP, tip);
  }

void Txt(string name, datetime t, double price, string text, color c, ENUM_ANCHOR_POINT anchor)
  {
   ObjectCreate(0, name, OBJ_TEXT, 0, t, price);
   ObjectSetString(0, name, OBJPROP_TEXT, text);
   ObjectSetInteger(0, name, OBJPROP_COLOR, c);
   ObjectSetInteger(0, name, OBJPROP_FONTSIZE, 7);
   ObjectSetInteger(0, name, OBJPROP_ANCHOR, anchor);
   ObjectSetInteger(0, name, OBJPROP_SELECTABLE, false);
  }

void Arrow(string name, datetime t, double price, int code, color c, ENUM_ARROW_ANCHOR anchor, string tip)
  {
   ObjectCreate(0, name, OBJ_ARROW, 0, t, price);
   ObjectSetInteger(0, name, OBJPROP_ARROWCODE, code);
   ObjectSetInteger(0, name, OBJPROP_COLOR, c);
   ObjectSetInteger(0, name, OBJPROP_ANCHOR, anchor);
   ObjectSetInteger(0, name, OBJPROP_WIDTH, 1);
   ObjectSetInteger(0, name, OBJPROP_SELECTABLE, false);
   ObjectSetString(0, name, OBJPROP_TOOLTIP, tip);
  }

void PanelLine(int row, string text, color c)
  {
   string name = PFX + "panel_" + IntegerToString(row);
   ObjectCreate(0, name, OBJ_LABEL, 0, 0, 0);
   ObjectSetInteger(0, name, OBJPROP_CORNER, CORNER_LEFT_UPPER);
   ObjectSetInteger(0, name, OBJPROP_XDISTANCE, 10);
   ObjectSetInteger(0, name, OBJPROP_YDISTANCE, 20 + row * 15);
   ObjectSetInteger(0, name, OBJPROP_FONTSIZE, 9);
   ObjectSetInteger(0, name, OBJPROP_COLOR, c);
   ObjectSetString(0, name, OBJPROP_FONT, "Consolas");
   ObjectSetString(0, name, OBJPROP_TEXT, text);
   ObjectSetInteger(0, name, OBJPROP_SELECTABLE, false);
  }

color RegimeColor(string reg)
  {
   if(reg == "BULL_TREND") return InpColBull;
   if(reg == "BEAR_TREND") return InpColBear;
   return clrDimGray;
  }

color PoolColor(const Pool &p)
  {
   if(p.type == "PDH" || p.type == "PDL") return InpColDay;
   if(p.type == "PWH" || p.type == "PWL") return InpColWeek;
   if(p.tf == "SESSION") return InpColSession;
   if(p.type == "EQH" || p.type == "EQL") return InpColEqual;
   return InpColSwingPool;
  }

bool PoolShown(const Pool &p)
  {
   if(p.type == "PDH" || p.type == "PDL" || p.type == "PWH" || p.type == "PWL") return InpShowDayWeek;
   if(p.tf == "SESSION") return InpShowSessions;
   if(p.type == "EQH" || p.type == "EQL") return InpShowEqual;
   return InpShowSwingPools;
  }

void ExportCsv(const MqlRates &r[], int n, const SwingPt &sw[], int nsw, const StructEvent &ev[])
  {
   string tfs = EnumToString(_Period);
   int ps = PeriodSeconds(_Period);
   int h = FileOpen("LH_export_" + _Symbol + "_" + tfs + ".csv", FILE_WRITE | FILE_CSV | FILE_ANSI, ',');
   if(h == INVALID_HANDLE) { Print("LH: export failed ", GetLastError()); return; }
   FileWrite(h, "record", "kind", "time", "known_time", "price", "extra", "status", "reason", "sweep_time", "end_time");
   for(int i = 0; i < nsw; i++)
      FileWrite(h, "SWING", sw[i].kind == 1 ? "H" : "L", TimeToString(r[sw[i].idx].time, TIME_DATE | TIME_MINUTES),
                TimeToString(r[sw[i].known].time + ps, TIME_DATE | TIME_MINUTES), DoubleToString(sw[i].price, _Digits), "", "", "", "", "");
   for(int e = 0; e < ArraySize(ev); e++)
     {
      string k = ev[e].kind == 1 ? "BOS_UP" : ev[e].kind == 2 ? "CHOCH_UP" : ev[e].kind == -1 ? "BOS_DOWN" : "CHOCH_DOWN";
      FileWrite(h, "EVENT", k, TimeToString(r[ev[e].idx].time, TIME_DATE | TIME_MINUTES), "",
                DoubleToString(ev[e].level, _Digits), DoubleToString(ev[e].prot, _Digits), "", "", "", "");
     }
   for(int k = 0; k < g_npools; k++)
      FileWrite(h, "POOL", g_pools[k].id, TimeToString(g_pools[k].origin, TIME_DATE | TIME_MINUTES),
                TimeToString(g_pools[k].known, TIME_DATE | TIME_MINUTES), DoubleToString(g_pools[k].level, _Digits),
                TimeToString(g_pools[k].expires, TIME_DATE | TIME_MINUTES), g_pools[k].status, g_pools[k].reason,
                g_pools[k].sweep_t > 0 ? TimeToString(g_pools[k].sweep_t, TIME_DATE | TIME_MINUTES) : "",
                g_pools[k].end_t > 0 ? TimeToString(g_pools[k].end_t, TIME_DATE | TIME_MINUTES) : "");
   FileClose(h);
   Print("LH: exported to MQL5\\Files\\LH_export_", _Symbol, "_", tfs, ".csv");
  }

//+------------------------------------------------------------------+
//| Main computation                                                 |
//+------------------------------------------------------------------+
bool Recompute()
  {
   MqlRates r[];
   int n = LoadClosed(_Period, InpBarsBack, r);
   if(n <= InpSwingLeft + InpSwingRight + InpAtrPeriod) return false;
   ObjectsDeleteAll(0, PFX);
   int ps = PeriodSeconds(_Period);

   double a[];
   CalcAtr(r, n, InpAtrPeriod, a);
   SwingPt sw[];
   int nsw = FindSwings(r, n, sw);
   StructEvent ev[];
   g_regime_chart = RunStructure(r, n, sw, nsw, a, ev);
   g_regime_h1 = RegimeOf(PERIOD_H1);
   g_regime_h4 = RegimeOf(PERIOD_H4);

   if(InpShowSwings)
      for(int i = 0; i < nsw; i++)
        {
         string nm = PFX + "sw_" + IntegerToString(i);
         if(sw[i].kind == 1) Arrow(nm, r[sw[i].idx].time, sw[i].price, 159, clrSteelBlue, ANCHOR_BOTTOM, "Swing high (confirmed " + TimeToString(r[sw[i].known].time + ps) + ")");
         else                Arrow(nm, r[sw[i].idx].time, sw[i].price, 159, clrSteelBlue, ANCHOR_TOP, "Swing low (confirmed " + TimeToString(r[sw[i].known].time + ps) + ")");
        }
   if(InpShowStructure)
      for(int e = 0; e < ArraySize(ev); e++)
        {
         bool choch = MathAbs(ev[e].kind) == 2;
         bool up = ev[e].kind > 0;
         color c = choch ? InpColChoch : (up ? InpColBull : InpColBear);
         string lbl = (choch ? "CHoCH" : "BOS") + (up ? " up" : " down");
         string nm = PFX + "ev_" + IntegerToString(e);
         Seg(nm, r[ev[e].swing_idx].time, r[ev[e].idx].time, ev[e].level, c, STYLE_DASH, 1, lbl);
         Txt(nm + "_t", r[ev[e].idx].time, ev[e].level, lbl, c, up ? ANCHOR_LEFT_LOWER : ANCHOR_LEFT_UPPER);
        }

   g_npools = 0;
   ArrayResize(g_pools, 0);
   PeriodAndSessionPools();
   EqualPools();
   SwingPools(PERIOD_H1, "H1");
   SwingPools(PERIOD_H4, "H4");
   DetectSweeps();

   datetime now = r[n - 1].time + ps;
   datetime since = now - InpLookbackDays * 86400;
   for(int k = 0; k < g_npools; k++)
     {
      if(g_pools[k].known < since || !PoolShown(g_pools[k])) continue;
      datetime t2 = g_pools[k].end_t > 0 ? g_pools[k].end_t : (now < g_pools[k].expires ? now : g_pools[k].expires);
      if(g_pools[k].sweep_t > 0 && g_pools[k].status != "ACTIVE") t2 = g_pools[k].sweep_t;
      if(t2 <= g_pools[k].known) t2 = g_pools[k].known + ps;
      color c = PoolColor(g_pools[k]);
      string nm = PFX + "pool_" + IntegerToString(k);
      string tip = g_pools[k].id + "  " + g_pools[k].status + (g_pools[k].reason != "" ? " (" + g_pools[k].reason + ")" : "");
      Seg(nm, g_pools[k].known, t2, g_pools[k].level, c, STYLE_DOT, 1, tip);
      Txt(nm + "_t", t2, g_pools[k].level, " " + g_pools[k].type, c, ANCHOR_LEFT);
      if(InpShowSweeps && g_pools[k].status == "RECLAIMED")
         Arrow(nm + "_rc", g_pools[k].sweep_t, g_pools[k].extreme, g_pools[k].side > 0 ? 234 : 233, InpColReclaim,
               g_pools[k].side > 0 ? ANCHOR_BOTTOM : ANCHOR_TOP, "Swept and reclaimed: " + g_pools[k].id);
     }

   if(InpShowPanel)
     {
      PanelLine(0, "Liquidity Hunter  (visual aid - no tested edge)", clrDimGray);
      PanelLine(1, "H4    : " + g_regime_h4, RegimeColor(g_regime_h4));
      PanelLine(2, "H1    : " + g_regime_h1, RegimeColor(g_regime_h1));
      PanelLine(3, StringFormat("Chart : %s", g_regime_chart), RegimeColor(g_regime_chart));
      PanelLine(4, StringFormat("ATR(%d) chart: %s", InpAtrPeriod, DoubleToString(a[n - 1], _Digits)), clrDimGray);
     }

   if(InpExportCsv) ExportCsv(r, n, sw, nsw, ev);
   ChartRedraw();
   return true;
  }

//+------------------------------------------------------------------+
int OnInit()
  {
   g_tick = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_SIZE);
   if(g_tick <= 0) g_tick = _Point;
   g_last_chart_bar = 0;
   g_last_sweep_bar = 0;
   return INIT_SUCCEEDED;
  }

void OnDeinit(const int reason)
  {
   ObjectsDeleteAll(0, PFX);
   ChartRedraw();
  }

int OnCalculate(const int rates_total, const int prev_calculated, const datetime &time[],
                const double &open[], const double &high[], const double &low[], const double &close[],
                const long &tick_volume[], const long &volume[], const int &spread[])
  {
   datetime cb = iTime(_Symbol, _Period, 0);
   datetime sb = iTime(_Symbol, InpSweepTF, 0);
   if(cb == 0 || sb == 0) return 0;
   if(cb == g_last_chart_bar && sb == g_last_sweep_bar && prev_calculated > 0) return rates_total;
   if(!Recompute()) return 0;   // history not ready yet: try again on the next tick
   g_last_chart_bar = cb;
   g_last_sweep_bar = sb;
   return rates_total;
  }
//+------------------------------------------------------------------+
