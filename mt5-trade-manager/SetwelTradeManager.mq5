//+------------------------------------------------------------------+
//|                                          SetwelTradeManager.mq5  |
//|  Chart trade manager for MetaTrader 5 (Expert Advisor).          |
//|                                                                  |
//|  - Detects positions you open manually (or from any terminal /   |
//|    mobile app) on the chart symbol and lets you set / move the   |
//|    REAL stop loss and take profit by dragging lines.             |
//|  - Optional trailing stop per position (activation / distance /  |
//|    step). Trailing runs inside this EA: the terminal must stay   |
//|    open and connected (PC or VPS). It is NOT a server-side stop. |
//|  - Never opens or closes trades, never generates signals.        |
//|  - Line style always shows whether the broker has accepted the   |
//|    level: solid = broker confirmed, dashed = draft/unsaved,      |
//|    dotted = sending, orange = rejected (not applied).            |
//+------------------------------------------------------------------+
#property copyright "Setwel"
#property version   "1.00"
#property description "Drag SL/TP lines and trail stops on your existing positions."
#property description "Never opens trades. Solid line = broker confirmed level."

//--- enums ----------------------------------------------------------
enum ENUM_TM_APPLY
  {
   TM_APPLY_ON_RELEASE = 0, // Apply when line is released / Enter pressed
   TM_APPLY_ON_SAVE    = 1  // Keep as draft until Save is clicked
  };

enum ENUM_TM_UNIT
  {
   TM_UNIT_POINTS = 0, // Points (symbol point)
   TM_UNIT_PIPS   = 1, // Pips (10 points on 3/5-digit symbols, else 1 point)
   TM_UNIT_TICKS  = 2, // Ticks (symbol tick size)
   TM_UNIT_PRICE  = 3  // Price units
  };

enum ENUM_TM_MANUAL_SL
  {
   TM_MANUAL_SL_PAUSE    = 0, // Pause trailing
   TM_MANUAL_SL_CONTINUE = 1  // Continue trailing from the new SL
  };

enum ENUM_TM_STATE
  {
   TM_NONE    = 0, // no level at broker, line is only a draft handle
   TM_ACTIVE  = 1, // broker-confirmed level
   TM_EDIT    = 2, // user moved it, not sent yet
   TM_PENDING = 3, // request sent, waiting for confirmation
   TM_FAILED  = 4  // rejected / not applied
  };

//--- inputs ---------------------------------------------------------
input group "Which positions to manage"
input long              InpMagic           = 0;                   // Magic number: 0 = manual trades, -1 = all on this symbol

input group "Editing"
input ENUM_TM_APPLY     InpApplyMode       = TM_APPLY_ON_RELEASE; // When to send SL/TP changes
input ENUM_TM_UNIT      InpUnit            = TM_UNIT_POINTS;      // Unit for distances and trailing inputs
input double            InpDraftSLAtr      = 1.0;                 // Draft SL handle distance (x ATR14) when no SL
input double            InpDraftTPAtr      = 2.0;                 // Draft TP handle distance (x ATR14) when no TP

input group "Trailing stop defaults (editable per position in the panel)"
input bool              InpTrailOn         = false;               // Trailing ON for new positions
input double            InpTrailActivation = 300;                 // Activation distance (in unit above)
input double            InpTrailDistance   = 200;                 // Trailing distance (in unit above)
input double            InpTrailStep       = 50;                  // Trailing step (in unit above)
input ENUM_TM_MANUAL_SL InpManualSLRule    = TM_MANUAL_SL_PAUSE;  // If SL is changed manually while trailing

input group "Optional automatic initial SL/TP (OFF by default)"
input bool              InpAutoInitial     = false;               // Auto-place SL/TP on NEW positions without them
input double            InpAutoSL          = 0;                   // Auto SL distance from entry (unit), 0 = none
input double            InpAutoTP          = 0;                   // Auto TP distance from entry (unit), 0 = none

input group "Safety"
input int               InpMinModifyMs     = 1000;                // Min time between modifications of one position (ms)
input int               InpConfirmTimeoutMs= 8000;                // Mark as failed if not confirmed within (ms)

input group "Display"
input bool              InpHideNativeLevels= true;                // Hide MT5's own trade level lines on this chart
input bool              InpShowOthers      = true;                // Show entry lines of non-selected positions
input bool              InpChartShift      = true;                // Enable chart shift so labels have room
input int               InpPanelX          = 10;                  // Panel X position
input int               InpPanelY          = 25;                  // Panel Y position
input int               InpFontSize        = 8;                   // Font size
input color             InpSLColor         = clrRed;              // SL colour
input color             InpTPColor         = clrLimeGreen;        // TP colour
input color             InpEntryColor      = clrDodgerBlue;       // Entry colour
input color             InpFailColor       = clrOrange;           // Rejected level colour

//--- constants ------------------------------------------------------
#define TM_PFX   "TM_"
#define TM_PANEL "TM_P_"
#define TM_FONT  "Arial"

//--- per-position state ---------------------------------------------
struct TMPos
  {
   ulong             ticket;
   bool              loaded;
   bool              isBuy;
   double            volume;
   double            open;
   double            profit;
   double            bSL, bTP;        // broker-confirmed levels (0 = none)
   double            dSL, dTP;        // draft / proposed / placeholder levels
   int               sSL, sTP;        // ENUM_TM_STATE
   double            sentSL, sentTP;
   ulong             sentMs;
   bool              queued;          // drafts waiting to be sent
   bool              manualSent;      // last SL request came from the user
   string            mSL, mTP;        // per-level messages
   ulong             lastModMs;
   bool              trOn, trPaused;
   double            trAct, trDist, trStep; // price units
   double            trLastSL;        // last SL placed by trailing
   ulong             trBackoffUntil;
   string            trMsg;
   bool              seen;
  };

TMPos  g_pos[];
ulong  g_sel          = 0;
long   g_login        = 0;
int    g_atr          = INVALID_HANDLE;
bool   g_init         = false;
bool   g_mouseDown    = false;
ulong  g_dragGuardTo  = 0;
string g_dragObj      = "";
string g_msg          = "";
color  g_msgClr       = clrSilver;
ulong  g_lastSendMs   = 0;
bool   g_wasConnected = true;
long   g_origLevels   = -1;
long   g_origShift    = -1;
string g_editShown[5];
ulong  g_editShownFor = 0;

//+------------------------------------------------------------------+
//| Symbol helpers (all read live from the broker's symbol spec)     |
//+------------------------------------------------------------------+
ulong  NowMs()   { return GetMicrosecondCount() / 1000; }
double Pt()      { return SymbolInfoDouble(_Symbol, SYMBOL_POINT); }
int    Dg()      { return (int)SymbolInfoInteger(_Symbol, SYMBOL_DIGITS); }
double TickSz()  { double t = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_SIZE); return (t > 0) ? t : Pt(); }
double PipSz()   { int d = Dg(); return (d == 3 || d == 5) ? Pt() * 10.0 : Pt(); }
double Bid()     { return SymbolInfoDouble(_Symbol, SYMBOL_BID); }
double Ask()     { return SymbolInfoDouble(_Symbol, SYMBOL_ASK); }
string Px(double p) { return DoubleToString(p, Dg()); }
string Ccy()     { return AccountInfoString(ACCOUNT_CURRENCY); }

double NormPrice(double p)
  {
   double t = TickSz();
   return NormalizeDouble(MathRound(p / t) * t, Dg());
  }
double FloorTick(double p) { double t = TickSz(); return NormalizeDouble(MathFloor(p / t + 1e-9) * t, Dg()); }
double CeilTick(double p)  { double t = TickSz(); return NormalizeDouble(MathCeil(p / t - 1e-9) * t, Dg()); }
bool   Same(double a, double b) { return MathAbs(a - b) < TickSz() * 0.5; }

double UnitSize()
  {
   switch(InpUnit)
     {
      case TM_UNIT_PIPS:  return PipSz();
      case TM_UNIT_TICKS: return TickSz();
      case TM_UNIT_PRICE: return 1.0;
     }
   return Pt();
  }
string UnitName()
  {
   switch(InpUnit)
     {
      case TM_UNIT_PIPS:  return "pips";
      case TM_UNIT_TICKS: return "ticks";
      case TM_UNIT_PRICE: return "price";
     }
   return "pts";
  }
int UnitDecimals()
  {
   if(InpUnit == TM_UNIT_PRICE)  return Dg();
   if(InpUnit == TM_UNIT_POINTS) return 0;
   return 1;
  }
string FmtDist(double d)  { return DoubleToString(d / UnitSize(), UnitDecimals()) + " " + UnitName(); }
string FmtUnit(double d)  { return DoubleToString(d / UnitSize(), UnitDecimals()); }
string Money(double m)    { return (m >= 0 ? "+" : "") + DoubleToString(m, 2) + " " + Ccy(); }
string LevelStr(double v) { return (v > 0) ? Px(v) : "none"; }

//--- money result in account currency if the position closed at closeP
double MoneyAt(bool isBuy, double vol, double openP, double closeP, bool &ok)
  {
   double prof = 0.0;
   ok = OrderCalcProfit(isBuy ? ORDER_TYPE_BUY : ORDER_TYPE_SELL, _Symbol, vol, openP, closeP, prof);
   if(ok)
      return prof;
   double ts = TickSz();
   double tv = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_VALUE);
   if(ts > 0 && tv > 0)
     {
      ok = true;
      double diff = isBuy ? closeP - openP : openP - closeP;
      return diff / ts * tv * vol;
     }
   return 0.0;
  }

string RetText(uint rc)
  {
   switch(rc)
     {
      case 10004: return "Requote";
      case 10006: return "Request rejected by broker";
      case 10007: return "Request cancelled";
      case 10010: return "Only part of the request completed";
      case 10011: return "Request processing error";
      case 10012: return "Request timed out";
      case 10013: return "Invalid request";
      case 10015: return "Invalid price";
      case 10016: return "Invalid stops (too close to price or wrong side)";
      case 10017: return "Trading disabled";
      case 10018: return "Market closed";
      case 10021: return "No quotes";
      case 10024: return "Too many requests";
      case 10025: return "No changes";
      case 10026: return "Autotrading disabled by server";
      case 10027: return "Algo Trading disabled in terminal";
      case 10028: return "Request locked for processing";
      case 10029: return "Order or position frozen (freeze level)";
      case 10031: return "No connection to trade server";
      case 10036: return "Position already closed";
      case 10044: return "Only closing allowed on this symbol";
     }
   return "Retcode " + IntegerToString(rc);
  }

//--- can this EA send a modification right now?
bool CanTrade(string &why)
  {
   if(!TerminalInfoInteger(TERMINAL_CONNECTED))          { why = "Terminal is disconnected from the broker"; return false; }
   if(!TerminalInfoInteger(TERMINAL_TRADE_ALLOWED))      { why = "Algo Trading button is OFF in the terminal"; return false; }
   if(!MQLInfoInteger(MQL_TRADE_ALLOWED))                { why = "'Allow Algo Trading' is unticked in the EA settings"; return false; }
   if(!AccountInfoInteger(ACCOUNT_TRADE_ALLOWED))        { why = "Trading not allowed on this account (investor login?)"; return false; }
   if(!AccountInfoInteger(ACCOUNT_TRADE_EXPERT))         { why = "Broker does not allow EA trading on this account"; return false; }
   if(SymbolInfoInteger(_Symbol, SYMBOL_TRADE_MODE) == SYMBOL_TRADE_MODE_DISABLED)
                                                         { why = "Trading is disabled for " + _Symbol; return false; }
   return true;
  }

string AccountModeText()
  {
   long m = AccountInfoInteger(ACCOUNT_MARGIN_MODE);
   if(m == ACCOUNT_MARGIN_MODE_RETAIL_HEDGING) return "Hedging";
   if(m == ACCOUNT_MARGIN_MODE_EXCHANGE)       return "Exchange (netting)";
   return "Netting";
  }

//+------------------------------------------------------------------+
//| Trailing settings persistence (terminal global variables)        |
//+------------------------------------------------------------------+
string GVName(ulong ticket, string key) { return "TMEA_" + IntegerToString(g_login) + "_" + (string)ticket + "_" + key; }

void SaveTrail(TMPos &p)
  {
   GlobalVariableSet(GVName(p.ticket, "on"), p.trOn ? 1.0 : 0.0);
   GlobalVariableSet(GVName(p.ticket, "pa"), p.trPaused ? 1.0 : 0.0);
   GlobalVariableSet(GVName(p.ticket, "ac"), p.trAct);
   GlobalVariableSet(GVName(p.ticket, "di"), p.trDist);
   GlobalVariableSet(GVName(p.ticket, "st"), p.trStep);
  }

void LoadTrail(TMPos &p)
  {
   if(!GlobalVariableCheck(GVName(p.ticket, "on")))
      return;
   p.trOn     = GlobalVariableGet(GVName(p.ticket, "on")) > 0.5;
   p.trPaused = GlobalVariableGet(GVName(p.ticket, "pa")) > 0.5;
   double a = GlobalVariableGet(GVName(p.ticket, "ac"));
   double d = GlobalVariableGet(GVName(p.ticket, "di"));
   double s = GlobalVariableGet(GVName(p.ticket, "st"));
   if(a >= 0) p.trAct  = a;
   if(d > 0)  p.trDist = d;
   if(s >= 0) p.trStep = s;
  }

void DeleteTrail(ulong ticket)
  {
   GlobalVariableDel(GVName(ticket, "on"));
   GlobalVariableDel(GVName(ticket, "pa"));
   GlobalVariableDel(GVName(ticket, "ac"));
   GlobalVariableDel(GVName(ticket, "di"));
   GlobalVariableDel(GVName(ticket, "st"));
  }

//+------------------------------------------------------------------+
//| Draft handle placement (only a visual starting point)            |
//+------------------------------------------------------------------+
double PlaceholderDist(bool isSL)
  {
   double d = 0.0;
   if(g_atr != INVALID_HANDLE)
     {
      double buf[];
      if(CopyBuffer(g_atr, 0, 1, 1, buf) == 1 && buf[0] > 0)
         d = buf[0] * (isSL ? InpDraftSLAtr : InpDraftTPAtr);
     }
   if(d <= 0)
      d = Bid() * 0.003 * (isSL ? 1.0 : 2.0);
   double minD = (double)SymbolInfoInteger(_Symbol, SYMBOL_TRADE_STOPS_LEVEL) * Pt() + (Ask() - Bid());
   if(d < minD * 1.5)
      d = minD * 1.5;
   if(d < TickSz() * 5)
      d = TickSz() * 5;
   return d;
  }

double Placeholder(TMPos &p, bool isSL)
  {
   double dist = PlaceholderDist(isSL);
   // buy SL / sell TP sit below entry, buy TP / sell SL above
   double v = (p.isBuy == isSL) ? p.open - dist : p.open + dist;
   if(v <= 0)
      v = TickSz();
   return NormPrice(v);
  }

//+------------------------------------------------------------------+
//| Validation against direction, executable price and broker rules  |
//+------------------------------------------------------------------+
bool Validate(TMPos &p, bool isSL, double price, string &err)
  {
   if(price == 0)
      return true; // removal
   if(price < 0) { err = "Price must be positive"; return false; }
   double bid = Bid(), ask = Ask();
   if(bid <= 0 || ask <= 0) { err = "No current quotes for " + _Symbol; return false; }
   double minD = (double)SymbolInfoInteger(_Symbol, SYMBOL_TRADE_STOPS_LEVEL) * Pt();
   double eps  = TickSz() * 0.5;
   double ref  = p.isBuy ? bid : ask; // price the position closes at
   string nm   = isSL ? "SL" : "TP";
   string dir  = p.isBuy ? "Buy" : "Sell";
   string refN = p.isBuy ? "Bid" : "Ask";
   if(p.isBuy == isSL)
     {
      // level must be below the closing price
      if(price >= ref - eps || ref - price < minD - eps)
        {
         err = StringFormat("%s %s must be below %s %s%s (max %s)", dir, nm, refN, Px(ref),
                            minD > 0 ? " by at least " + FmtDist(minD) + " broker stop level" : "",
                            Px(FloorTick(ref - MathMax(minD, TickSz()))));
         return false;
        }
     }
   else
     {
      if(price <= ref + eps || price - ref < minD - eps)
        {
         err = StringFormat("%s %s must be above %s %s%s (min %s)", dir, nm, refN, Px(ref),
                            minD > 0 ? " by at least " + FmtDist(minD) + " broker stop level" : "",
                            Px(CeilTick(ref + MathMax(minD, TickSz()))));
         return false;
        }
     }
   return true;
  }

bool FreezeOK(TMPos &p, string &err)
  {
   double fz = (double)SymbolInfoInteger(_Symbol, SYMBOL_TRADE_FREEZE_LEVEL) * Pt();
   if(fz <= 0)
      return true;
   double ref = p.isBuy ? Bid() : Ask();
   if((p.bSL > 0 && MathAbs(ref - p.bSL) <= fz) || (p.bTP > 0 && MathAbs(ref - p.bTP) <= fz))
     {
      err = "Price is inside the broker freeze level (" + FmtDist(fz) + ") of the current SL/TP; broker forbids changes now";
      return false;
     }
   return true;
  }

//+------------------------------------------------------------------+
//| Position list                                                    |
//+------------------------------------------------------------------+
int FindIdx(ulong t)
  {
   for(int i = 0; i < ArraySize(g_pos); i++)
      if(g_pos[i].ticket == t)
         return i;
   return -1;
  }
int Sel() { return (g_sel == 0) ? -1 : FindIdx(g_sel); }

int AddPos(ulong t)
  {
   int n = ArraySize(g_pos);
   ArrayResize(g_pos, n + 1);
   g_pos[n].ticket = t;
   g_pos[n].loaded = false;
   g_pos[n].isBuy = true;
   g_pos[n].volume = 0; g_pos[n].open = 0; g_pos[n].profit = 0;
   g_pos[n].bSL = 0; g_pos[n].bTP = 0; g_pos[n].dSL = 0; g_pos[n].dTP = 0;
   g_pos[n].sSL = TM_NONE; g_pos[n].sTP = TM_NONE;
   g_pos[n].sentSL = 0; g_pos[n].sentTP = 0; g_pos[n].sentMs = 0;
   g_pos[n].queued = false; g_pos[n].manualSent = false;
   g_pos[n].mSL = ""; g_pos[n].mTP = "";
   g_pos[n].lastModMs = 0;
   g_pos[n].trOn = InpTrailOn; g_pos[n].trPaused = false;
   g_pos[n].trAct  = MathMax(0.0, InpTrailActivation) * UnitSize();
   g_pos[n].trDist = MathMax(TickSz(), InpTrailDistance * UnitSize());
   g_pos[n].trStep = MathMax(0.0, InpTrailStep) * UnitSize();
   g_pos[n].trLastSL = 0; g_pos[n].trBackoffUntil = 0; g_pos[n].trMsg = "";
   g_pos[n].seen = true;
   LoadTrail(g_pos[n]);
   return n;
  }

void RemovePos(int i)
  {
   ulong t = g_pos[i].ticket;
   ObjectsDeleteAll(0, TM_PFX + (string)t + "_");
   DeleteTrail(t);
   int n = ArraySize(g_pos);
   for(int j = i; j < n - 1; j++)
      g_pos[j] = g_pos[j + 1];
   ArrayResize(g_pos, n - 1);
   if(g_sel == t)
      g_sel = 0;
   SetMsg("Position #" + (string)t + " closed - its controls were removed", clrSilver);
   Print("TradeManager: position #", t, " closed, controls removed");
  }

void SetMsg(string m, color c) { g_msg = m; g_msgClr = c; }

//--- trailing rule when SL was changed by the user (here or elsewhere)
void OnManualSLChange(TMPos &p)
  {
   if(!p.trOn || p.trPaused)
      return;
   if(InpManualSLRule == TM_MANUAL_SL_PAUSE)
     {
      p.trPaused = true;
      p.trMsg = "";
      SaveTrail(p);
      SetMsg("Trailing PAUSED on #" + (string)p.ticket + " because SL was changed manually", clrOrange);
     }
   else
      SetMsg("Trailing continues on #" + (string)p.ticket + " from the new SL", clrSilver);
  }

//--- compare a freshly read broker level with our state
void Reconcile(TMPos &p, bool isSL, double now, double &b, double &d, int &s, double &sent, string &m)
  {
   bool changed = !Same(now, b);
   b = now;
   if(s == TM_PENDING)
     {
      if(Same(now, sent))
        {
         s = (now > 0) ? TM_ACTIVE : TM_NONE;
         d = (now > 0) ? now : Placeholder(p, isSL);
         m = "Confirmed by broker";
         if(isSL && p.manualSent)
            OnManualSLChange(p);
        }
      else if(NowMs() - p.sentMs > (ulong)InpConfirmTimeoutMs)
        {
         s = TM_FAILED;
         m = "Not confirmed by broker in time - broker level is " + LevelStr(now);
        }
      return;
     }
   if(!changed)
     {
      if(s == TM_NONE && d <= 0)
         d = Placeholder(p, isSL);
      return;
     }
   bool byTrail = isSL && p.trLastSL > 0 && Same(now, p.trLastSL);
   if(s == TM_ACTIVE || s == TM_NONE)
     {
      s = (now > 0) ? TM_ACTIVE : TM_NONE;
      d = (now > 0) ? now : Placeholder(p, isSL);
      if(!byTrail)
         m = "Changed outside this EA: " + LevelStr(now);
     }
   else
      m = "Broker level changed elsewhere to " + LevelStr(now) + " (your draft is kept)";
   if(isSL && !byTrail)
      OnManualSLChange(p);
  }

//--- read the position from the terminal; false if it no longer exists
bool ReadBroker(TMPos &p)
  {
   if(!PositionSelectByTicket(p.ticket))
      return false;
   bool isBuy = (PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY);
   if(p.loaded && isBuy != p.isBuy)
     {
      // netting account: position reversed direction
      p.sSL = TM_NONE; p.sTP = TM_NONE; p.dSL = 0; p.dTP = 0; p.queued = false;
      p.trOn = false; p.trPaused = false; SaveTrail(p);
      SetMsg("#" + (string)p.ticket + " reversed direction: drafts cleared, trailing OFF", clrOrange);
     }
   p.isBuy  = isBuy;
   p.volume = PositionGetDouble(POSITION_VOLUME);
   p.open   = PositionGetDouble(POSITION_PRICE_OPEN);
   p.profit = PositionGetDouble(POSITION_PROFIT) + PositionGetDouble(POSITION_SWAP);
   double sl = PositionGetDouble(POSITION_SL);
   double tp = PositionGetDouble(POSITION_TP);
   if(!p.loaded)
     {
      p.bSL = sl; p.bTP = tp;
      p.sSL = (sl > 0) ? TM_ACTIVE : TM_NONE;
      p.sTP = (tp > 0) ? TM_ACTIVE : TM_NONE;
      p.dSL = (sl > 0) ? sl : Placeholder(p, true);
      p.dTP = (tp > 0) ? tp : Placeholder(p, false);
      p.loaded = true;
      return true;
     }
   Reconcile(p, true,  sl, p.bSL, p.dSL, p.sSL, p.sentSL, p.mSL);
   Reconcile(p, false, tp, p.bTP, p.dTP, p.sTP, p.sentTP, p.mTP);
   return true;
  }

bool Manage()
  {
   if(PositionGetString(POSITION_SYMBOL) != _Symbol)
      return false;
   if(InpMagic >= 0 && PositionGetInteger(POSITION_MAGIC) != InpMagic)
      return false;
   return true;
  }

void Sync()
  {
   for(int i = 0; i < ArraySize(g_pos); i++)
      g_pos[i].seen = false;
   int total = PositionsTotal();
   for(int i = 0; i < total; i++)
     {
      ulong t = PositionGetTicket(i);
      if(t == 0 || !Manage())
         continue;
      int k = FindIdx(t);
      bool isNew = (k < 0);
      if(isNew)
         k = AddPos(t);
      if(!ReadBroker(g_pos[k]))
         continue;
      g_pos[k].seen = true;
      if(isNew && g_init)
        {
         g_sel = t;
         SetMsg("New " + (g_pos[k].isBuy ? "BUY" : "SELL") + " #" + (string)t + " detected and selected", clrDeepSkyBlue);
         if(InpAutoInitial)
            AutoInitial(g_pos[k]);
        }
     }
   for(int i = ArraySize(g_pos) - 1; i >= 0; i--)
      if(!g_pos[i].seen)
         RemovePos(i);
   if(Sel() < 0 && ArraySize(g_pos) > 0)
      g_sel = g_pos[ArraySize(g_pos) - 1].ticket;
  }

void AutoInitial(TMPos &p)
  {
   double u = UnitSize();
   if(InpAutoSL > 0 && p.bSL == 0)
     {
      p.dSL = NormPrice(p.isBuy ? p.open - InpAutoSL * u : p.open + InpAutoSL * u);
      p.sSL = TM_EDIT; p.mSL = "Auto initial SL (setting)"; p.queued = true;
     }
   if(InpAutoTP > 0 && p.bTP == 0)
     {
      p.dTP = NormPrice(p.isBuy ? p.open + InpAutoTP * u : p.open - InpAutoTP * u);
      p.sTP = TM_EDIT; p.mTP = "Auto initial TP (setting)"; p.queued = true;
     }
  }

//+------------------------------------------------------------------+
//| Sending modifications                                            |
//+------------------------------------------------------------------+
bool SendSLTP(TMPos &p, double sl, double tp, string &err)
  {
   MqlTradeRequest rq;
   MqlTradeResult  rs;
   ZeroMemory(rq);
   ZeroMemory(rs);
   rq.action   = TRADE_ACTION_SLTP;
   rq.position = p.ticket;
   rq.symbol   = _Symbol;
   rq.sl       = sl;
   rq.tp       = tp;
   if(PositionSelectByTicket(p.ticket))
      rq.magic = (ulong)PositionGetInteger(POSITION_MAGIC);
   ResetLastError();
   bool ok = OrderSend(rq, rs);
   p.lastModMs  = NowMs();
   g_lastSendMs = p.lastModMs;
   uint rc = rs.retcode;
   if(ok && (rc == TRADE_RETCODE_DONE || rc == TRADE_RETCODE_PLACED))
      return true;
   if(rc == 10025) // no changes: already at that level
      return true;
   err = (rc != 0) ? RetText(rc) : "OrderSend error " + IntegerToString(GetLastError());
   if(rs.comment != "")
      err += " (" + rs.comment + ")";
   return false;
  }

void FailLevels(TMPos &p, bool sl, bool tp, string why)
  {
   if(sl) { p.sSL = TM_FAILED; p.mSL = why; }
   if(tp) { p.sTP = TM_FAILED; p.mTP = why; }
   SetMsg("#" + (string)p.ticket + ": " + why, InpFailColor);
   Print("TradeManager #", p.ticket, ": ", why);
  }

//--- send the user's drafts (state TM_EDIT) when the rate limit allows
void ApplyQueued(TMPos &p)
  {
   if(!p.queued)
      return;
   ulong now = NowMs();
   if(now - p.lastModMs < (ulong)InpMinModifyMs || now - g_lastSendMs < 200)
      return; // stays queued, retried by the timer
   p.queued = false;
   bool doSL = (p.sSL == TM_EDIT), doTP = (p.sTP == TM_EDIT);
   if(!doSL && !doTP)
      return;
   string e;
   if(!CanTrade(e))           { FailLevels(p, doSL, doTP, "Not sent: " + e); return; }
   if(!PositionSelectByTicket(p.ticket)) { FailLevels(p, doSL, doTP, "Not sent: position no longer exists"); return; }
   if(doSL && !Validate(p, true, p.dSL, e))  { FailLevels(p, true, false, "Not sent: " + e); doSL = false; }
   if(doTP && !Validate(p, false, p.dTP, e)) { FailLevels(p, false, true, "Not sent: " + e); doTP = false; }
   if(!doSL && !doTP)
      return;
   if(!FreezeOK(p, e))        { FailLevels(p, doSL, doTP, "Not sent: " + e); return; }

   double sl = doSL ? p.dSL : p.bSL;
   double tp = doTP ? p.dTP : p.bTP;
   if(doSL) { p.sSL = TM_PENDING; p.sentSL = sl; p.mSL = "Sending..."; }
   if(doTP) { p.sTP = TM_PENDING; p.sentTP = tp; p.mTP = "Sending..."; }
   p.manualSent = doSL;
   p.sentMs = now;
   Refresh();

   string err;
   if(!SendSLTP(p, sl, tp, err))
     {
      FailLevels(p, doSL, doTP, "REJECTED: " + err);
      return;
     }
   ReadBroker(p); // confirms from the position's actual values
   if(p.sSL != TM_PENDING && p.sTP != TM_PENDING && (doSL || doTP))
      SetMsg("#" + (string)p.ticket + ": broker confirmed SL " + LevelStr(p.bSL) + "  TP " + LevelStr(p.bTP), clrLimeGreen);
  }

//+------------------------------------------------------------------+
//| Trailing stop (client-side: runs only while this EA runs)        |
//+------------------------------------------------------------------+
void Trail(TMPos &p)
  {
   if(!p.trOn || p.trPaused)
      return;
   string why;
   if(!CanTrade(why))                 { p.trMsg = "INACTIVE: " + why; return; }
   if(p.sSL == TM_EDIT || p.sSL == TM_PENDING) { p.trMsg = "Waiting: SL draft is unsaved/sending"; return; }
   ulong now = NowMs();
   if(now < p.trBackoffUntil)         return;
   double bid = Bid(), ask = Ask();
   if(bid <= 0 || ask <= 0)           { p.trMsg = "Waiting: no quotes"; return; }

   double favour = p.isBuy ? bid - p.open : p.open - ask;
   if(favour < p.trAct)
     {
      p.trMsg = "Armed: starts after +" + FmtDist(p.trAct) + " (now " + (favour >= 0 ? "+" : "") + FmtDist(favour) + ")";
      return;
     }
   double cand = p.isBuy ? FloorTick(bid - p.trDist) : CeilTick(ask + p.trDist);
   double cur  = p.bSL;
   double need = MathMax(p.trStep, TickSz() * 0.5);
   bool better = (cur == 0) || (p.isBuy ? cand >= cur + need : cand <= cur - need);
   if(!better)
     {
      p.trMsg = "Trailing: SL " + LevelStr(cur) + " (next move needs " + FmtDist(p.trStep) + " step)";
      return;
     }
   // never loosen: strictly tighter than the current SL
   if(cur > 0 && (p.isBuy ? cand <= cur : cand >= cur))
      return;
   string e;
   if(!Validate(p, true, cand, e))    { p.trMsg = "Waiting: " + e; return; }
   if(!FreezeOK(p, e))                { p.trMsg = "Waiting: " + e; return; }
   if(now - p.lastModMs < (ulong)InpMinModifyMs || now - g_lastSendMs < 200)
      return;

   string err;
   if(SendSLTP(p, cand, p.bTP, err))
     {
      p.trLastSL = cand;
      bool hadFailed = (p.sSL == TM_FAILED);
      ReadBroker(p);
      if(Same(p.bSL, cand))
        {
         if(hadFailed)
           {
            p.sSL = TM_ACTIVE; p.dSL = p.bSL;
            p.mSL = "Rejected draft discarded: trailing moved the SL";
           }
         p.trMsg = "Moved SL to " + Px(cand) + " (broker confirmed)";
        }
      else
         p.trMsg = "Sent SL " + Px(cand) + ", waiting for confirmation";
     }
   else
     {
      p.trMsg = "REJECTED: " + err;
      p.trBackoffUntil = now + ((StringFind(err, "Market closed") >= 0) ? 30000 : 5000);
      Print("TradeManager #", p.ticket, " trailing rejected: ", err);
     }
  }

//+------------------------------------------------------------------+
//| Chart objects                                                    |
//+------------------------------------------------------------------+
string LName(ulong t, string k) { return TM_PFX + (string)t + "_" + k; }

datetime LabelTime()
  {
   datetime t = iTime(_Symbol, PERIOD_CURRENT, 0);
   if(t == 0)
      t = TimeCurrent();
   return t + PeriodSeconds() * 2;
  }

bool LineFrozen(string name, bool draggable)
  {
   // do not move a line under the user's mouse (during and right after a drag)
   if(!draggable)
      return false;
   return g_mouseDown || NowMs() < g_dragGuardTo;
  }

void DrawHLine(string name, double price, color c, ENUM_LINE_STYLE st, int width, bool draggable, string tip)
  {
   if(ObjectFind(0, name) < 0)
     {
      ObjectCreate(0, name, OBJ_HLINE, 0, 0, price);
      ObjectSetInteger(0, name, OBJPROP_SELECTABLE, draggable);
      ObjectSetInteger(0, name, OBJPROP_SELECTED, draggable);
      ObjectSetInteger(0, name, OBJPROP_HIDDEN, true);
      ObjectSetInteger(0, name, OBJPROP_BACK, false);
      ObjectSetInteger(0, name, OBJPROP_ZORDER, 10);
     }
   else if(!LineFrozen(name, draggable))
      ObjectSetDouble(0, name, OBJPROP_PRICE, 0, price);
   ObjectSetInteger(0, name, OBJPROP_COLOR, c);
   ObjectSetInteger(0, name, OBJPROP_STYLE, st);
   ObjectSetInteger(0, name, OBJPROP_WIDTH, width);
   ObjectSetString(0, name, OBJPROP_TOOLTIP, tip);
  }

void DrawText(string name, double price, string text, color c)
  {
   if(ObjectFind(0, name) < 0)
     {
      ObjectCreate(0, name, OBJ_TEXT, 0, LabelTime(), price);
      ObjectSetInteger(0, name, OBJPROP_SELECTABLE, false);
      ObjectSetInteger(0, name, OBJPROP_HIDDEN, true);
      ObjectSetInteger(0, name, OBJPROP_ANCHOR, ANCHOR_LEFT_LOWER);
      ObjectSetString(0, name, OBJPROP_FONT, TM_FONT);
      ObjectSetInteger(0, name, OBJPROP_FONTSIZE, InpFontSize);
     }
   ObjectSetInteger(0, name, OBJPROP_TIME, 0, LabelTime());
   ObjectSetDouble(0, name, OBJPROP_PRICE, 0, price);
   ObjectSetString(0, name, OBJPROP_TEXT, text);
   ObjectSetInteger(0, name, OBJPROP_COLOR, c);
  }

void Del(string name) { if(ObjectFind(0, name) >= 0) ObjectDelete(0, name); }

//--- price the line shows for a level
double Shown(TMPos &p, bool isSL)
  {
   int    s = isSL ? p.sSL : p.sTP;
   double b = isSL ? p.bSL : p.bTP;
   double d = isSL ? p.dSL : p.dTP;
   if(s == TM_ACTIVE) return b;
   if(s == TM_NONE)   return d;
   return (d > 0) ? d : b; // removal request shows the broker line
  }

bool IsRemoval(TMPos &p, bool isSL)
  {
   int s = isSL ? p.sSL : p.sTP;
   double d = isSL ? p.dSL : p.dTP;
   return (s == TM_EDIT || s == TM_PENDING || s == TM_FAILED) && d == 0;
  }

string StateText(TMPos &p, bool isSL)
  {
   int s = isSL ? p.sSL : p.sTP;
   switch(s)
     {
      case TM_NONE:    return "DRAFT - not set at broker";
      case TM_ACTIVE:  return "ACTIVE - broker confirmed";
      case TM_EDIT:    return p.queued ? "QUEUED - sending" : (InpApplyMode == TM_APPLY_ON_SAVE ? "UNSAVED - press Save" : "UNSAVED");
      case TM_PENDING: return "SENDING - not confirmed yet";
      case TM_FAILED:  return "REJECTED - NOT APPLIED";
     }
   return "";
  }

color StateColor(TMPos &p, bool isSL)
  {
   int s = isSL ? p.sSL : p.sTP;
   if(s == TM_ACTIVE) return clrLimeGreen;
   if(s == TM_FAILED) return InpFailColor;
   if(s == TM_PENDING) return clrYellow;
   if(s == TM_EDIT)   return clrGold;
   return clrSilver;
  }

string ValuePart(TMPos &p, bool isSL, double price)
  {
   bool ok;
   double m = MoneyAt(p.isBuy, p.volume, p.open, price, ok);
   string s = Px(price) + " | " + FmtDist(MathAbs(price - p.open)) + " from entry";
   if(!ok)
      return s + " | money n/a";
   if(isSL)
      return s + " | " + (m < 0 ? "risk " : "locks ") + Money(m);
   return s + " | " + (m >= 0 ? "profit " : "loss ") + Money(m);
  }

//--- reward:risk using levels that are real or proposed (not draft handles)
string RRText(TMPos &p)
  {
   if(p.sSL == TM_NONE || p.sTP == TM_NONE || IsRemoval(p, true) || IsRemoval(p, false))
      return "";
   double sl = Shown(p, true), tp = Shown(p, false);
   if(sl <= 0 || tp <= 0)
      return "";
   bool ok1, ok2;
   double ms = MoneyAt(p.isBuy, p.volume, p.open, sl, ok1);
   double mt = MoneyAt(p.isBuy, p.volume, p.open, tp, ok2);
   if(!ok1 || !ok2)
      return "";
   if(ms >= 0)
      return "SL locks profit (no risk)";
   return "R:R 1:" + DoubleToString(mt / -ms, 2);
  }

string LevelLabel(TMPos &p, bool isSL, double price)
  {
   string nm = isSL ? "SL" : "TP";
   if(IsRemoval(p, isSL))
      return nm + " REMOVE: " + StateText(p, isSL);
   return nm + " " + StateText(p, isSL) + "  " + ValuePart(p, isSL, price);
  }

void DrawLevel(TMPos &p, bool isSL)
  {
   string ln = LName(p.ticket, isSL ? "SL" : "TP");
   string lb = ln + "L";
   double price = Shown(p, isSL);
   if(price <= 0)
     {
      Del(ln); Del(lb);
      return;
     }
   int s = isSL ? p.sSL : p.sTP;
   color c = isSL ? InpSLColor : InpTPColor;
   ENUM_LINE_STYLE st = STYLE_DASH;
   int w = 1;
   if(s == TM_ACTIVE)  { st = STYLE_SOLID; w = 2; }
   if(s == TM_PENDING) { st = STYLE_DOT; }
   if(s == TM_FAILED)  { st = STYLE_DASHDOT; c = InpFailColor; }
   string txt = LevelLabel(p, isSL, price);
   DrawHLine(ln, price, c, st, w, true, txt);
   if(!(LineFrozen(ln, true) && g_dragObj == ln))
      DrawText(lb, price, txt, c);
  }

void DrawPos(TMPos &p, bool selected)
  {
   string e = LName(p.ticket, "E");
   string dir = p.isBuy ? "BUY" : "SELL";
   if(!selected)
     {
      Del(LName(p.ticket, "SL")); Del(LName(p.ticket, "SLL"));
      Del(LName(p.ticket, "TP")); Del(LName(p.ticket, "TPL"));
      if(!InpShowOthers)
        {
         Del(e); Del(e + "L");
         return;
        }
      string t2 = "#" + (string)p.ticket + " " + dir + " " + DoubleToString(p.volume, 2) + " (select with < > in panel)";
      DrawHLine(e, p.open, clrGray, STYLE_DOT, 1, false, t2);
      DrawText(e + "L", p.open, t2, clrGray);
      return;
     }
   string txt = dir + " " + DoubleToString(p.volume, 2) + " #" + (string)p.ticket + " @ " + Px(p.open) + "  P/L " + Money(p.profit);
   DrawHLine(e, p.open, InpEntryColor, STYLE_SOLID, 1, false, txt);
   DrawText(e + "L", p.open, txt, InpEntryColor);
   DrawLevel(p, true);
   DrawLevel(p, false);
  }

//--- live label while the user drags a line
void ShowPreview(string ln, double price)
  {
   int k = Sel();
   if(k < 0)
      return;
   bool isSL = (ln == LName(g_pos[k].ticket, "SL"));
   price = NormPrice(price);
   string nm = isSL ? "SL" : "TP";
   string txt = nm + " -> " + ValuePart(g_pos[k], isSL, price) +
                (InpApplyMode == TM_APPLY_ON_RELEASE ? "  (release to send)" : "  (release, then Save)");
   string e;
   if(!Validate(g_pos[k], isSL, price, e))
      txt += "  INVALID: " + e;
   DrawText(ln + "L", price, txt, isSL ? InpSLColor : InpTPColor);
   ChartRedraw();
  }

//--- which of our draggable lines is near the mouse y
string HitTest(int y)
  {
   int k = Sel();
   if(k < 0)
      return "";
   string names[2];
   names[0] = LName(g_pos[k].ticket, "SL");
   names[1] = LName(g_pos[k].ticket, "TP");
   string best = "";
   int bestD = 9;
   for(int i = 0; i < 2; i++)
     {
      if(ObjectFind(0, names[i]) < 0 || !ObjectGetInteger(0, names[i], OBJPROP_SELECTED))
         continue;
      int x = 0, yy = 0;
      if(!ChartTimePriceToXY(0, 0, TimeCurrent(), ObjectGetDouble(0, names[i], OBJPROP_PRICE, 0), x, yy))
         continue;
      int dd = MathAbs(yy - y);
      if(dd < bestD) { bestD = dd; best = names[i]; }
     }
   return best;
  }

//+------------------------------------------------------------------+
//| Panel                                                            |
//+------------------------------------------------------------------+
void PLabel(string id, int x, int y, string text, color c)
  {
   string n = TM_PANEL + id;
   if(ObjectFind(0, n) < 0)
     {
      ObjectCreate(0, n, OBJ_LABEL, 0, 0, 0);
      ObjectSetInteger(0, n, OBJPROP_CORNER, CORNER_LEFT_UPPER);
      ObjectSetInteger(0, n, OBJPROP_SELECTABLE, false);
      ObjectSetInteger(0, n, OBJPROP_HIDDEN, true);
      ObjectSetString(0, n, OBJPROP_FONT, TM_FONT);
      ObjectSetInteger(0, n, OBJPROP_FONTSIZE, InpFontSize);
      ObjectSetInteger(0, n, OBJPROP_ZORDER, 100);
     }
   ObjectSetInteger(0, n, OBJPROP_XDISTANCE, x);
   ObjectSetInteger(0, n, OBJPROP_YDISTANCE, y);
   ObjectSetString(0, n, OBJPROP_TEXT, text);
   ObjectSetInteger(0, n, OBJPROP_COLOR, c);
  }

void PButton(string id, int x, int y, int w, int h, string text, color bg)
  {
   string n = TM_PANEL + id;
   if(ObjectFind(0, n) < 0)
     {
      ObjectCreate(0, n, OBJ_BUTTON, 0, 0, 0);
      ObjectSetInteger(0, n, OBJPROP_CORNER, CORNER_LEFT_UPPER);
      ObjectSetInteger(0, n, OBJPROP_SELECTABLE, false);
      ObjectSetInteger(0, n, OBJPROP_HIDDEN, true);
      ObjectSetString(0, n, OBJPROP_FONT, TM_FONT);
      ObjectSetInteger(0, n, OBJPROP_FONTSIZE, InpFontSize);
      ObjectSetInteger(0, n, OBJPROP_COLOR, clrWhite);
      ObjectSetInteger(0, n, OBJPROP_ZORDER, 101);
     }
   ObjectSetInteger(0, n, OBJPROP_XDISTANCE, x);
   ObjectSetInteger(0, n, OBJPROP_YDISTANCE, y);
   ObjectSetInteger(0, n, OBJPROP_XSIZE, w);
   ObjectSetInteger(0, n, OBJPROP_YSIZE, h);
   ObjectSetString(0, n, OBJPROP_TEXT, text);
   ObjectSetInteger(0, n, OBJPROP_BGCOLOR, bg);
  }

void PEdit(string id, int x, int y, int w, int h)
  {
   string n = TM_PANEL + id;
   if(ObjectFind(0, n) >= 0)
      return;
   ObjectCreate(0, n, OBJ_EDIT, 0, 0, 0);
   ObjectSetInteger(0, n, OBJPROP_CORNER, CORNER_LEFT_UPPER);
   ObjectSetInteger(0, n, OBJPROP_SELECTABLE, false);
   ObjectSetInteger(0, n, OBJPROP_HIDDEN, true);
   ObjectSetInteger(0, n, OBJPROP_XDISTANCE, x);
   ObjectSetInteger(0, n, OBJPROP_YDISTANCE, y);
   ObjectSetInteger(0, n, OBJPROP_XSIZE, w);
   ObjectSetInteger(0, n, OBJPROP_YSIZE, h);
   ObjectSetString(0, n, OBJPROP_FONT, TM_FONT);
   ObjectSetInteger(0, n, OBJPROP_FONTSIZE, InpFontSize);
   ObjectSetInteger(0, n, OBJPROP_COLOR, clrBlack);
   ObjectSetInteger(0, n, OBJPROP_BGCOLOR, clrWhite);
   ObjectSetInteger(0, n, OBJPROP_ZORDER, 101);
  }

//--- update an edit field only when our value changes (so typing is not overwritten)
void SetEdit(int idx, string id, string text, ulong ticket)
  {
   if(g_editShownFor != ticket)
     {
      for(int i = 0; i < 5; i++)
         g_editShown[i] = "~unset~";
      g_editShownFor = ticket;
     }
   if(g_editShown[idx] == text)
      return;
   ObjectSetString(0, TM_PANEL + id, OBJPROP_TEXT, text);
   g_editShown[idx] = text;
  }

string Trim(string s) { StringTrimLeft(s); StringTrimRight(s); return s; }

void StatusLine(string &txt, color &c)
  {
   string why;
   if(!TerminalInfoInteger(TERMINAL_CONNECTED)) { txt = "DISCONNECTED - nothing can be sent, trailing inactive"; c = clrRed; return; }
   if(!CanTrade(why))                           { txt = "CANNOT MODIFY: " + why; c = clrOrange; return; }
   datetime last = (datetime)SymbolInfoInteger(_Symbol, SYMBOL_TIME);
   if(last > 0 && TimeCurrent() - last > 300)    { txt = "LIVE, but no quotes for 5+ min (market may be closed)"; c = clrOrange; return; }
   txt = "LIVE - connected, changes can be sent"; c = clrLimeGreen;
  }

void RefreshPanel(int k)
  {
   int x = InpPanelX, y = InpPanelY, dy = 19, W = 470;
   string bg = TM_PANEL + "BG";
   if(ObjectFind(0, bg) < 0)
     {
      ObjectCreate(0, bg, OBJ_RECTANGLE_LABEL, 0, 0, 0);
      ObjectSetInteger(0, bg, OBJPROP_CORNER, CORNER_LEFT_UPPER);
      ObjectSetInteger(0, bg, OBJPROP_SELECTABLE, false);
      ObjectSetInteger(0, bg, OBJPROP_HIDDEN, true);
      ObjectSetInteger(0, bg, OBJPROP_BGCOLOR, C'24,26,34');
      ObjectSetInteger(0, bg, OBJPROP_BORDER_TYPE, BORDER_FLAT);
      ObjectSetInteger(0, bg, OBJPROP_COLOR, C'70,74,90');
      ObjectSetInteger(0, bg, OBJPROP_ZORDER, 99);
     }
   ObjectSetInteger(0, bg, OBJPROP_XDISTANCE, x - 5);
   ObjectSetInteger(0, bg, OBJPROP_YDISTANCE, y - 4);
   ObjectSetInteger(0, bg, OBJPROP_XSIZE, W);
   ObjectSetInteger(0, bg, OBJPROP_YSIZE, dy * 12 + 8);

   string st; color sc;
   StatusLine(st, sc);
   PLabel("T0", x, y, "TRADE MANAGER  " + _Symbol + "  [" + AccountModeText() + "]  " +
          (InpApplyMode == TM_APPLY_ON_SAVE ? "Mode: Save" : "Mode: on release"), clrWhite);
   PLabel("T1", x, y + dy, st, sc);

   int n = ArraySize(g_pos);
   PButton("PREV", x, y + dy * 2, 22, 17, "<", C'60,64,80');
   PButton("NEXT", x + W - 32, y + dy * 2, 22, 17, ">", C'60,64,80');
   PEdit("ESL", x + 28, y + dy * 4, 95, 17);
   PEdit("ETP", x + 28, y + dy * 6, 95, 17);
   PButton("XSL", x + 127, y + dy * 4, 20, 17, "X", C'90,40,40');
   PButton("XTP", x + 127, y + dy * 6, 20, 17, "X", C'90,40,40');
   PEdit("EACT", x + 150, y + dy * 8, 55, 17);
   PEdit("EDIST", x + 245, y + dy * 8, 55, 17);
   PEdit("ESTEP", x + 340, y + dy * 8, 55, 17);
   PLabel("SLN", x, y + dy * 4 + 1, "SL", InpSLColor);
   PLabel("TPN", x, y + dy * 6 + 1, "TP", InpTPColor);
   PLabel("LACT", x + 122, y + dy * 8 + 1, "Act", clrSilver);
   PLabel("LDIST", x + 212, y + dy * 8 + 1, "Dist", clrSilver);
   PLabel("LSTEP", x + 305, y + dy * 8 + 1, "Step", clrSilver);
   PLabel("LUNIT", x + 400, y + dy * 8 + 1, UnitName(), clrSilver);

   int bx = x;
   if(InpApplyMode == TM_APPLY_ON_SAVE)
     {
      PButton("SAVE", bx, y + dy * 10, 90, 17, "Save", C'30,110,60');
      bx += 96;
     }
   PButton("CANCEL", bx, y + dy * 10, 110, 17, InpApplyMode == TM_APPLY_ON_SAVE ? "Cancel" : "Revert draft", C'90,60,30');

   if(k < 0)
     {
      PLabel("POS", x + 28, y + dy * 2 + 1, "No managed positions on " + _Symbol + (InpMagic == 0 ? " (manual trades)" : ""), clrSilver);
      PLabel("DET", x, y + dy * 3, "Open a trade as usual - it will be detected automatically.", clrSilver);
      PLabel("SLS", x + 152, y + dy * 4 + 1, "", clrSilver);
      PLabel("SLI", x + 28, y + dy * 5, "", clrSilver);
      PLabel("TPS", x + 152, y + dy * 6 + 1, "", clrSilver);
      PLabel("TPI", x + 28, y + dy * 7, "", clrSilver);
      PButton("TRAIL", x, y + dy * 8, 115, 17, "TRAIL: -", C'60,64,80');
      PLabel("TRS", x, y + dy * 9, "", clrSilver);
      SetEdit(0, "ESL", "", 0); SetEdit(1, "ETP", "", 0);
      SetEdit(2, "EACT", "", 0); SetEdit(3, "EDIST", "", 0); SetEdit(4, "ESTEP", "", 0);
     }
   else
     {
      int idx = k;
      string dir = g_pos[idx].isBuy ? "BUY" : "SELL";
      PLabel("POS", x + 28, y + dy * 2 + 1, StringFormat("%d/%d  #%s  %s %s @ %s", idx + 1, n, (string)g_pos[idx].ticket,
             dir, DoubleToString(g_pos[idx].volume, 2), Px(g_pos[idx].open)), g_pos[idx].isBuy ? clrDeepSkyBlue : clrTomato);
      PLabel("DET", x, y + dy * 3, "P/L " + Money(g_pos[idx].profit) + "   Bid " + Px(Bid()) + "  Ask " + Px(Ask()) +
             "   tick " + DoubleToString(TickSz(), Dg()), g_pos[idx].profit >= 0 ? clrLimeGreen : clrTomato);

      PLabel("SLS", x + 152, y + dy * 4 + 1, StateText(g_pos[idx], true) + (g_pos[idx].mSL != "" ? " - " + g_pos[idx].mSL : ""), StateColor(g_pos[idx], true));
      PLabel("TPS", x + 152, y + dy * 6 + 1, StateText(g_pos[idx], false) + (g_pos[idx].mTP != "" ? " - " + g_pos[idx].mTP : ""), StateColor(g_pos[idx], false));
      double sl = Shown(g_pos[idx], true), tp = Shown(g_pos[idx], false);
      PLabel("SLI", x + 28, y + dy * 5, IsRemoval(g_pos[idx], true) ? "Remove SL requested" : (sl > 0 ? ValuePart(g_pos[idx], true, sl) : ""), clrSilver);
      string rr = RRText(g_pos[idx]);
      PLabel("TPI", x + 28, y + dy * 7, (IsRemoval(g_pos[idx], false) ? "Remove TP requested" : (tp > 0 ? ValuePart(g_pos[idx], false, tp) : "")) +
             (rr != "" ? "   " + rr : ""), clrSilver);

      // edit fields: empty when the level is only a draft handle
      string esl = (g_pos[idx].sSL == TM_NONE) ? "" : (IsRemoval(g_pos[idx], true) ? "0" : Px(sl));
      string etp = (g_pos[idx].sTP == TM_NONE) ? "" : (IsRemoval(g_pos[idx], false) ? "0" : Px(tp));
      SetEdit(0, "ESL", esl, g_pos[idx].ticket);
      SetEdit(1, "ETP", etp, g_pos[idx].ticket);
      SetEdit(2, "EACT", FmtUnit(g_pos[idx].trAct), g_pos[idx].ticket);
      SetEdit(3, "EDIST", FmtUnit(g_pos[idx].trDist), g_pos[idx].ticket);
      SetEdit(4, "ESTEP", FmtUnit(g_pos[idx].trStep), g_pos[idx].ticket);

      string bt; color bc; string ts; color tc = clrSilver;
      if(!g_pos[idx].trOn)          { bt = "TRAIL: OFF"; bc = C'60,64,80'; ts = "Trailing OFF"; }
      else if(g_pos[idx].trPaused)  { bt = "TRAIL: PAUSED"; bc = C'150,90,20'; ts = "PAUSED (SL changed manually) - click TRAIL to resume"; tc = clrOrange; }
      else
        {
         bt = "TRAIL: ON"; bc = C'30,110,60';
         ts = (g_pos[idx].trMsg != "" ? g_pos[idx].trMsg : "ON") + "  [runs in this terminal only]";
         if(StringFind(g_pos[idx].trMsg, "INACTIVE") == 0 || StringFind(g_pos[idx].trMsg, "REJECTED") == 0)
            tc = clrOrange;
        }
      PButton("TRAIL", x, y + dy * 8, 115, 17, bt, bc);
      PLabel("TRS", x, y + dy * 9, ts, tc);
     }
   string m1 = g_msg, m2 = "";
   if(StringLen(m1) > 85)
     {
      m2 = StringSubstr(m1, 85);
      m1 = StringSubstr(m1, 0, 85);
     }
   PLabel("MSG1", x, y + dy * 11 - 6, m1, g_msgClr);
   PLabel("MSG2", x, y + dy * 11 + 7, m2, g_msgClr);
  }

void Refresh()
  {
   int k = Sel();
   for(int i = 0; i < ArraySize(g_pos); i++)
      DrawPos(g_pos[i], i == k);
   RefreshPanel(k);
   ChartRedraw();
  }

//+------------------------------------------------------------------+
//| User actions                                                     |
//+------------------------------------------------------------------+
void SetDraft(TMPos &p, bool isSL, double price, string source)
  {
   int s = isSL ? p.sSL : p.sTP;
   if(s == TM_PENDING)
     {
      SetMsg("Wait - previous request for this level is still being confirmed", clrOrange);
      return;
     }
   string e, m = "";
   if(!Validate(p, isSL, price, e))
      m = "Warning: " + e;
   if(isSL) { p.dSL = price; p.sSL = TM_EDIT; p.mSL = m; }
   else     { p.dTP = price; p.sTP = TM_EDIT; p.mTP = m; }
   if(InpApplyMode == TM_APPLY_ON_RELEASE)
     {
      p.queued = true;
      ApplyQueued(p);
     }
   else
      SetMsg((isSL ? "SL" : "TP") + " draft " + (price > 0 ? Px(price) : "REMOVE") + " from " + source + " - press Save to send", clrGold);
  }

void CancelDrafts(TMPos &p)
  {
   if(p.sSL == TM_EDIT || p.sSL == TM_FAILED)
     {
      p.sSL = (p.bSL > 0) ? TM_ACTIVE : TM_NONE;
      p.dSL = (p.bSL > 0) ? p.bSL : Placeholder(p, true);
      p.mSL = "";
     }
   if(p.sTP == TM_EDIT || p.sTP == TM_FAILED)
     {
      p.sTP = (p.bTP > 0) ? TM_ACTIVE : TM_NONE;
      p.dTP = (p.bTP > 0) ? p.bTP : Placeholder(p, false);
      p.mTP = "";
     }
   p.queued = false;
   SetMsg("Drafts discarded - lines show broker levels again", clrSilver);
  }

void HandleDrag(string name)
  {
   g_dragObj = "";
   int k = Sel();
   if(k < 0)
      return;
   ulong t = g_pos[k].ticket;
   bool isSL = (name == LName(t, "SL"));
   bool isTP = (name == LName(t, "TP"));
   if(!isSL && !isTP)
      return;
   g_dragGuardTo = 0;
   double price = NormPrice(ObjectGetDouble(0, name, OBJPROP_PRICE, 0));
   if(price <= 0)
      return;
   SetDraft(g_pos[k], isSL, price, "drag");
   Refresh();
  }

void HandleEdit(string name)
  {
   int k = Sel();
   if(k < 0)
      return;
   string id = StringSubstr(name, StringLen(TM_PANEL));
   string txt = Trim(ObjectGetString(0, name, OBJPROP_TEXT));
   if(id == "ESL" || id == "ETP")
     {
      bool isSL = (id == "ESL");
      if(txt == "")
        {
         g_editShown[isSL ? 0 : 1] = "~unset~"; // restore the field on next refresh
         Refresh();
         return;
        }
      double v = StringToDouble(txt);
      if(v < 0 || (v == 0 && txt != "0"))
        {
         SetMsg("Invalid price '" + txt + "' (type 0 to remove the level)", InpFailColor);
         g_editShown[isSL ? 0 : 1] = "~unset~";
         Refresh();
         return;
        }
      SetDraft(g_pos[k], isSL, v > 0 ? NormPrice(v) : 0, "price field");
      Refresh();
      return;
     }
   if(id == "EACT" || id == "EDIST" || id == "ESTEP")
     {
      double v = StringToDouble(txt) * UnitSize();
      if(v < 0 || (id == "EDIST" && v < TickSz()))
        {
         SetMsg("Invalid trailing value '" + txt + "'", InpFailColor);
        }
      else
        {
         if(id == "EACT")  g_pos[k].trAct  = v;
         if(id == "EDIST") g_pos[k].trDist = v;
         if(id == "ESTEP") g_pos[k].trStep = v;
         SaveTrail(g_pos[k]);
         SetMsg("Trailing settings saved for #" + (string)g_pos[k].ticket, clrSilver);
        }
      for(int i = 2; i < 5; i++)
         g_editShown[i] = "~unset~";
      Refresh();
     }
  }

void HandleClick(string name)
  {
   // clicking another position's entry line selects it
   if(StringFind(name, TM_PFX) == 0 && StringFind(name, TM_PANEL) != 0)
     {
      int us = StringFind(name, "_", StringLen(TM_PFX));
      if(us > 0 && StringSubstr(name, us) == "_E")
        {
         ulong t = (ulong)StringToInteger(StringSubstr(name, StringLen(TM_PFX), us - StringLen(TM_PFX)));
         if(FindIdx(t) >= 0 && t != g_sel)
           {
            g_sel = t;
            SetMsg("Selected #" + (string)t, clrSilver);
            Refresh();
           }
        }
      return;
     }
   if(StringFind(name, TM_PANEL) != 0)
      return;
   string id = StringSubstr(name, StringLen(TM_PANEL));
   if(ObjectGetInteger(0, name, OBJPROP_TYPE) == OBJ_BUTTON)
      ObjectSetInteger(0, name, OBJPROP_STATE, false);
   int n = ArraySize(g_pos);
   int k = Sel();
   if((id == "PREV" || id == "NEXT") && n > 0)
     {
      int j = (k < 0) ? 0 : k + (id == "NEXT" ? 1 : -1);
      if(j < 0)  j = n - 1;
      if(j >= n) j = 0;
      g_sel = g_pos[j].ticket;
     }
   else if(k >= 0)
     {
      if(id == "SAVE")
        {
         if(g_pos[k].sSL == TM_EDIT || g_pos[k].sTP == TM_EDIT)
           {
            g_pos[k].queued = true;
            ApplyQueued(g_pos[k]);
            if(g_pos[k].queued)
               SetMsg("Queued - will send in under " + IntegerToString(InpMinModifyMs) + " ms (rate limit)", clrGold);
           }
         else
            SetMsg("Nothing to save", clrSilver);
        }
      else if(id == "CANCEL")
         CancelDrafts(g_pos[k]);
      else if(id == "XSL")
         SetDraft(g_pos[k], true, 0, "X button");
      else if(id == "XTP")
         SetDraft(g_pos[k], false, 0, "X button");
      else if(id == "TRAIL")
        {
         if(!g_pos[k].trOn)
           {
            g_pos[k].trOn = true; g_pos[k].trPaused = false; g_pos[k].trMsg = "";
            SetMsg("Trailing ON for #" + (string)g_pos[k].ticket + " - works only while this terminal + EA run and are connected", clrGold);
           }
         else if(g_pos[k].trPaused)
           {
            g_pos[k].trPaused = false; g_pos[k].trMsg = "";
            SetMsg("Trailing resumed for #" + (string)g_pos[k].ticket, clrGold);
           }
         else
           {
            g_pos[k].trOn = false;
            SetMsg("Trailing OFF for #" + (string)g_pos[k].ticket + " (current SL kept)", clrSilver);
           }
         SaveTrail(g_pos[k]);
        }
     }
   Refresh();
  }

//+------------------------------------------------------------------+
//| Event handlers                                                   |
//+------------------------------------------------------------------+
int OnInit()
  {
   g_login = AccountInfoInteger(ACCOUNT_LOGIN);
   g_atr = iATR(_Symbol, PERIOD_CURRENT, 14);
   if(InpHideNativeLevels)
     {
      g_origLevels = ChartGetInteger(0, CHART_SHOW_TRADE_LEVELS);
      ChartSetInteger(0, CHART_SHOW_TRADE_LEVELS, false);
     }
   if(InpChartShift)
     {
      g_origShift = ChartGetInteger(0, CHART_SHIFT);
      ChartSetInteger(0, CHART_SHIFT, true);
     }
   ChartSetInteger(0, CHART_EVENT_MOUSE_MOVE, true);
   for(int i = 0; i < 5; i++)
      g_editShown[i] = "~unset~";
   g_wasConnected = (bool)TerminalInfoInteger(TERMINAL_CONNECTED);
   Sync();                 // existing positions: shown as they are, nothing changed
   g_init = true;
   SetMsg(IntegerToString(ArraySize(g_pos)) + " existing position(s) found on " + _Symbol + ". SL/TP left unchanged.", clrSilver);
   EventSetMillisecondTimer(250);
   Refresh();
   return INIT_SUCCEEDED;
  }

void OnDeinit(const int reason)
  {
   EventKillTimer();
   ObjectsDeleteAll(0, TM_PFX); // no lines remain that could look like protection
   if(g_origLevels >= 0)
      ChartSetInteger(0, CHART_SHOW_TRADE_LEVELS, g_origLevels != 0);
   if(g_origShift >= 0)
      ChartSetInteger(0, CHART_SHIFT, g_origShift != 0);
   if(g_atr != INVALID_HANDLE)
      IndicatorRelease(g_atr);
   ChartRedraw();
  }

void Work()
  {
   for(int i = 0; i < ArraySize(g_pos); i++)
     {
      ApplyQueued(g_pos[i]);
      Trail(g_pos[i]);
     }
  }

void OnTick()
  {
   Work();
  }

void OnTimer()
  {
   bool c = (bool)TerminalInfoInteger(TERMINAL_CONNECTED);
   if(c && !g_wasConnected)
     {
      SetMsg("Reconnected - positions and levels re-synced with the broker", clrLimeGreen);
      Print("TradeManager: reconnected, re-syncing");
     }
   if(!c && g_wasConnected)
     {
      SetMsg("DISCONNECTED - changes cannot be sent, trailing is not running", clrRed);
      Print("TradeManager: disconnected");
     }
   g_wasConnected = c;
   Sync();
   Work();
   Refresh();
  }

void OnTradeTransaction(const MqlTradeTransaction &trans, const MqlTradeRequest &request, const MqlTradeResult &result)
  {
   Sync();
   Refresh();
  }

void OnChartEvent(const int id, const long &lparam, const double &dparam, const string &sparam)
  {
   if(id == CHARTEVENT_MOUSE_MOVE)
     {
      bool down = ((StringToInteger(sparam) & 1) == 1);
      int  mx = (int)lparam, my = (int)dparam;
      if(down && !g_mouseDown)
         g_dragObj = HitTest(my);
      if(!down && g_mouseDown)
         g_dragGuardTo = NowMs() + 700; // let the drag event arrive before any redraw
      g_mouseDown = down;
      if(down && g_dragObj != "")
        {
         int sw = 0; datetime t = 0; double pr = 0;
         if(ChartXYToTimePrice(0, mx, my, sw, t, pr) && sw == 0 && pr > 0)
            ShowPreview(g_dragObj, pr);
        }
      return;
     }
   if(id == CHARTEVENT_OBJECT_DRAG)    { HandleDrag(sparam);  return; }
   if(id == CHARTEVENT_OBJECT_ENDEDIT) { HandleEdit(sparam);  return; }
   if(id == CHARTEVENT_OBJECT_CLICK)   { HandleClick(sparam); return; }
   if(id == CHARTEVENT_CHART_CHANGE)   Refresh();
  }
//+------------------------------------------------------------------+
