//+------------------------------------------------------------------+
//|                                            TDI_Divergence_EA.mq5 |
//|  Trades confirmed signals of TDI_Divergence_Pro (v9.1) and       |
//|  protects every managed position with a Stop-Loss Enforcer,      |
//|  break-even and a trailing stop.                                 |
//|                                                                  |
//|  - signal logic lives ONLY in the indicator (same rules on chart |
//|    and in the EA); the EA reads closed bar 1 once per bar        |
//|  - one decision per signal bar, stored in a terminal global      |
//|    variable -> a restart cannot re-enter the same signal         |
//|  - master switch InpEnableEntries=false stops new trades but     |
//|    keeps protecting open ones                                    |
//|  - Stop-Loss Enforcer: installs a missing SL, retries, then      |
//|    applies the failure policy (close or alert); never loosens   |
//|    a stop; respects stop and freeze levels; a stop counts as     |
//|    set only after the server confirms it                         |
//|  - break-even: SL to entry + BELockR x risk after BETriggerR     |
//|  - trailing: after TrailStartR, SL follows price at TrailATR     |
//|  No martingale, no grid, no averaging.                           |
//|                                                                  |
//|  Install: TDI_Divergence_Pro.ex5 in MQL5\Indicators,             |
//|           this file in MQL5\Experts, compile, attach to ONE      |
//|           chart per symbol, enable Algo Trading.                 |
//+------------------------------------------------------------------+
#property version     "1.10"
#property description "TDI divergence EA + Stop-Loss Enforcer, break-even, trailing stop"
#property tester_indicator "TDI_Divergence_Pro.ex5"

#include <Trade\Trade.mqh>

enum ENUM_LOT_MODE    { LOT_FIXED=0,  // Fixed lots
                        LOT_RISK=1 }; // Risk % of balance
enum ENUM_FAIL_POLICY { FAIL_CLOSE=0, // Close the unprotected position
                        FAIL_ALERT=1 };// Keep it, alert every minute

input group "=== Entries ==="
input bool            InpEnableEntries   = true;              // MASTER SWITCH: false = no new trades (open trades stay protected)
input string          InpIndName         = "TDI_Divergence_Pro"; // Indicator file name in MQL5\Indicators
input ENUM_TIMEFRAMES InpEntryTF         = PERIOD_CURRENT;    // Signal timeframe
input bool            InpAllowBuys       = true;
input bool            InpAllowSells      = true;
input bool            InpTradeDIV        = true;              // Trade DIV signals
input bool            InpTradeCONT       = true;              // Trade CONT (trend pullback) signals
input bool            InpTradeEXH        = false;             // Trade EXH (counter-trend) signals - lost in hindsight stats
input int             InpMaxEntryDelaySec= 120;               // Enter only within N seconds of the new bar
input int             InpMaxSpreadPoints = 0;                 // Max spread in points (0 = off)

input group "=== Confluence (optional) ==="
input ENUM_TIMEFRAMES InpConfTF2         = PERIOD_CURRENT;    // 2nd timeframe must agree (current = off)
input ENUM_TIMEFRAMES InpConfTF3         = PERIOD_CURRENT;    // 3rd timeframe must agree (current = off)
input int             InpConfBars        = 6;                 // same-direction signal within its last N closed bars

input group "=== Indicator settings for the EA copy ==="
input bool            InpIndUseHTF       = true;              // Higher-timeframe trend filter
input bool            InpIndAllowExh     = false;             // Indicator may produce EXH signals
input bool            InpIndUseCont      = true;              // Indicator may produce CONT signals
input bool            InpIndUseDouble    = true;              // Double top/bottom setups
input int             InpIndMaxBars      = 3000;              // Bars the indicator evaluates

input group "=== Risk ==="
input ENUM_LOT_MODE   InpLotMode         = LOT_RISK;
input double          InpFixedLots       = 0;                 // Fixed lots (0 = broker minimum)
input double          InpRiskPercent     = 1.0;               // Risk per trade, % of balance
input double          InpMaxLots         = 0;                 // Lot cap (0 = none)
input double          InpSLBufferATR     = 0.3;               // SL = last-leg extreme +/- this x ATR
input double          InpMaxSL_ATR       = 4.0;               // Skip if SL wider than this x ATR
input bool            InpUseTP           = true;              // Use a take profit
input double          InpRR              = 2.0;               // TP = RR x risk
input int             InpMaxPositions    = 1;                 // Max open EA positions (this magic, all symbols)
input int             InpMaxPerDir       = 1;                 // Max per symbol and direction
input long            InpMagic           = 20261020;
input int             InpSlippage        = 50;                // Max slippage, points

input group "=== Stop-Loss Enforcer ==="
input bool             InpManageManual    = false;            // Also protect manual trades (magic 0) on this symbol
input bool             InpManageAllMagics = false;            // Also protect other EAs' trades on this symbol
input double           InpEmergencySL_ATR = 2.0;              // Missing SL -> entry -/+ this x ATR
input int              InpMaxRetries      = 5;                // Attempts before the failure policy
input int              InpRetrySec        = 5;                // Seconds between attempts
input ENUM_FAIL_POLICY InpFailPolicy      = FAIL_CLOSE;

input group "=== Break-even ==="
input bool            InpUseBE           = true;
input double          InpBETriggerR      = 0.5;               // Move to break-even at this x risk in profit
input double          InpBELockR         = 0.1;               // Lock this x risk beyond entry

input group "=== Trailing stop ==="
input bool            InpUseTrail        = true;
input double          InpTrailStartR     = 1.0;               // Start trailing at this x risk in profit
input double          InpTrailATR        = 1.5;               // Trail distance, x ATR
input double          InpTrailStepATR    = 0.1;               // Move only when it improves by this x ATR

input group "=== Notifications / log ==="
input bool            InpAlert           = true;
input bool            InpPush            = false;             // Phone push (MetaQuotes ID in Tools > Options)
input bool            InpLogFile         = true;              // MQL5\Files\TDIEA_<symbol>.csv

#define GV_PREFIX "TDIEA_"

CTrade          trade;
ENUM_TIMEFRAMES g_tf;
int             g_hInd=INVALID_HANDLE, g_hATR=INVALID_HANDLE, g_hConf2=INVALID_HANDLE, g_hConf3=INVALID_HANDLE;
datetime        g_lastBar=0;
string          g_gvLastBar;
string          g_lastMsg="";
MqlParam        g_par[];
int             g_np=0;

struct SProt { ulong ticket; int tries; datetime lastTry; datetime lastAlert; };
SProt g_prot[];

//+------------------------------------------------------------------+
//| Helpers                                                          |
//+------------------------------------------------------------------+
bool IsTester() { return((bool)MQLInfoInteger(MQL_TESTER)); }

void LogLine(string what)
{
   if(!InpLogFile) return;
   string fn="TDIEA_"+_Symbol+".csv";
   bool exists=FileIsExist(fn);
   int f=FileOpen(fn,FILE_READ|FILE_WRITE|FILE_TXT|FILE_ANSI|FILE_SHARE_READ);
   if(f==INVALID_HANDLE) return;
   FileSeek(f,0,SEEK_END);
   if(!exists) FileWriteString(f,"time;symbol;event\r\n");
   FileWriteString(f,TimeToString(TimeCurrent(),TIME_DATE|TIME_SECONDS)+";"+_Symbol+";"+what+"\r\n");
   FileClose(f);
}

void Say(string msg,bool important)
{
   msg="TDI EA "+_Symbol+": "+msg;
   Print(msg);
   LogLine(msg);
   g_lastMsg=msg;
   if(IsTester()) return;
   if(important && InpAlert) Alert(msg);
   if(important && InpPush)  SendNotification(msg);
}

double NormPrice(double p)
{
   double ts=SymbolInfoDouble(_Symbol,SYMBOL_TRADE_TICK_SIZE);
   if(ts>0) p=MathRound(p/ts)*ts;
   return(NormalizeDouble(p,_Digits));
}

int VolDigits(double step)
{
   int d=0; double s=step;
   while(d<8 && MathAbs(s-MathRound(s))>1e-8) { s*=10; d++; }
   return(d);
}

double ATRNow()
{
   double a[];
   if(CopyBuffer(g_hATR,0,1,1,a)<1 || a[0]<=0) return(0);
   return(a[0]);
}

//--- indicator parameters: only the "Quick settings" group (first 11 inputs of
//--- TDI_Divergence_Pro), everything else stays at the indicator defaults.
//--- (MT5 accepts at most 64 parameters here.)
void PS(string v) { ArrayResize(g_par,g_np+1); g_par[g_np].type=TYPE_STRING; g_par[g_np].string_value=v;        g_np++; }
void PI(long v)   { ArrayResize(g_par,g_np+1); g_par[g_np].type=TYPE_INT;    g_par[g_np].integer_value=v;       g_np++; }
void PB(bool v)   { ArrayResize(g_par,g_np+1); g_par[g_np].type=TYPE_BOOL;   g_par[g_np].integer_value=(v?1:0); g_np++; }

void BuildParams()
{
   ArrayResize(g_par,0); g_np=0;
   PS(InpIndName);
   PI(InpIndMaxBars);   // InpMaxBars
   PB(false);           // InpDraw
   PB(false);           // InpShowPanel
   PB(false);           // InpAlerts
   PB(false);           // InpPush
   PB(false);           // InpLogFile
   PB(false);           // InpShowStats
   PB(InpIndAllowExh);  // InpAllowExhaustion
   PB(InpIndUseHTF);    // InpUseHTF
   PB(InpIndUseCont);   // InpUseCont
   PB(InpIndUseDouble); // InpUseDouble
}

int MakeInd(ENUM_TIMEFRAMES tf)
{
   BuildParams();
   return(IndicatorCreate(_Symbol,tf,IND_CUSTOM,g_np,g_par));
}

//+------------------------------------------------------------------+
int OnInit()
{
   if(InpRiskPercent<=0 && InpLotMode==LOT_RISK) { Alert("TDI EA: RiskPercent must be > 0"); return(INIT_PARAMETERS_INCORRECT); }
   if(InpRR<=0 || InpSLBufferATR<0 || InpMaxSL_ATR<=0 || InpEmergencySL_ATR<=0 || InpMaxRetries<1 ||
      InpBETriggerR<=0 || InpBELockR<0 || InpBELockR>=InpBETriggerR || InpTrailATR<=0 || InpTrailStartR<=0)
   { Alert("TDI EA: invalid risk / protection inputs (BELockR must be below BETriggerR)"); return(INIT_PARAMETERS_INCORRECT); }

   g_tf=(InpEntryTF==PERIOD_CURRENT ? (ENUM_TIMEFRAMES)_Period : InpEntryTF);
   g_hInd=MakeInd(g_tf);
   g_hATR=iATR(_Symbol,g_tf,14);
   if(InpConfTF2!=PERIOD_CURRENT && InpConfTF2!=g_tf) g_hConf2=MakeInd(InpConfTF2);
   if(InpConfTF3!=PERIOD_CURRENT && InpConfTF3!=g_tf) g_hConf3=MakeInd(InpConfTF3);
   if(g_hInd==INVALID_HANDLE || g_hATR==INVALID_HANDLE ||
      (InpConfTF2!=PERIOD_CURRENT && InpConfTF2!=g_tf && g_hConf2==INVALID_HANDLE) ||
      (InpConfTF3!=PERIOD_CURRENT && InpConfTF3!=g_tf && g_hConf3==INVALID_HANDLE))
   {
      string m=StringFormat("TDI EA: cannot load indicator '%s' (error %d). Put TDI_Divergence_Pro.mq5 (v9.1) in MQL5\\Indicators and compile it.",
                            InpIndName,GetLastError());
      Print(m); Alert(m);
      return(INIT_FAILED);
   }

   trade.SetExpertMagicNumber(InpMagic);
   trade.SetDeviationInPoints(InpSlippage);
   trade.SetTypeFillingBySymbol(_Symbol);
   trade.SetMarginMode();

   g_gvLastBar=GV_PREFIX+"LAST_"+IntegerToString(InpMagic)+"_"+_Symbol+"_"+EnumToString(g_tf);
   if(GlobalVariableCheck(g_gvLastBar)) g_lastBar=(datetime)(long)GlobalVariableGet(g_gvLastBar);

   EventSetTimer(2);
   string acc=(AccountInfoInteger(ACCOUNT_MARGIN_MODE)==ACCOUNT_MARGIN_MODE_RETAIL_HEDGING ? "hedging" : "netting");
   Say(StringFormat("started on %s, %s account, entries %s, min lot %.2f, step %.2f, stops level %d pts, freeze level %d pts",
                    EnumToString(g_tf),acc,InpEnableEntries ? "ON" : "OFF",
                    SymbolInfoDouble(_Symbol,SYMBOL_VOLUME_MIN),SymbolInfoDouble(_Symbol,SYMBOL_VOLUME_STEP),
                    (int)SymbolInfoInteger(_Symbol,SYMBOL_TRADE_STOPS_LEVEL),(int)SymbolInfoInteger(_Symbol,SYMBOL_TRADE_FREEZE_LEVEL)),false);
   Protect();
   return(INIT_SUCCEEDED);
}

void OnDeinit(const int reason)
{
   EventKillTimer();
   if(g_hInd!=INVALID_HANDLE)   IndicatorRelease(g_hInd);
   if(g_hATR!=INVALID_HANDLE)   IndicatorRelease(g_hATR);
   if(g_hConf2!=INVALID_HANDLE) IndicatorRelease(g_hConf2);
   if(g_hConf3!=INVALID_HANDLE) IndicatorRelease(g_hConf3);
   Comment("");
}

void OnTick()  { Protect(); CheckEntry(); ShowStatus(); }
void OnTimer() { Protect(); CleanupGV(); }

//+------------------------------------------------------------------+
//| Positions                                                        |
//+------------------------------------------------------------------+
// selected position: is it ours to protect?
bool Managed()
{
   if(PositionGetString(POSITION_SYMBOL)!=_Symbol) return(false);
   long mg=PositionGetInteger(POSITION_MAGIC);
   if(mg==InpMagic) return(true);
   if(mg==0 && InpManageManual) return(true);
   if(mg!=0 && InpManageAllMagics) return(true);
   return(false);
}

int CountEA(int dir,bool thisSymbolOnly)
{
   int n=0;
   for(int i=PositionsTotal()-1;i>=0;i--)
   {
      if(PositionGetTicket(i)==0) continue;
      if(PositionGetInteger(POSITION_MAGIC)!=InpMagic) continue;
      if(thisSymbolOnly && PositionGetString(POSITION_SYMBOL)!=_Symbol) continue;
      int d=(PositionGetInteger(POSITION_TYPE)==POSITION_TYPE_BUY ? 1 : -1);
      if(dir!=0 && d!=dir) continue;
      n++;
   }
   return(n);
}

bool OppositeOnNetting(int dir)
{
   if(AccountInfoInteger(ACCOUNT_MARGIN_MODE)==ACCOUNT_MARGIN_MODE_RETAIL_HEDGING) return(false);
   if(!PositionSelect(_Symbol)) return(false);
   int d=(PositionGetInteger(POSITION_TYPE)==POSITION_TYPE_BUY ? 1 : -1);
   return(d!=dir);
}

//--- initial risk distance per ticket (needed for break-even / trailing after a restart)
string GVR(ulong tk) { return(GV_PREFIX+"R_"+IntegerToString((long)tk)); }

double GetR(ulong tk,double open,double sl,int dir,double atr)
{
   if(GlobalVariableCheck(GVR(tk))) return(GlobalVariableGet(GVR(tk)));
   double r;
   if(sl>0 && (open-sl)*dir>0) r=(open-sl)*dir;            // stop still on the loss side
   else if(sl==0)              r=InpEmergencySL_ATR*atr;   // no stop yet
   else                        r=atr;                      // stop already in profit: R unknown, use ATR
   if(r>0) GlobalVariableSet(GVR(tk),r);
   return(r);
}

void CleanupGV()
{
   for(int i=GlobalVariablesTotal()-1;i>=0;i--)
   {
      string n=GlobalVariableName(i);
      if(StringFind(n,GV_PREFIX+"R_")!=0) continue;
      ulong tk=(ulong)StringToInteger(StringSubstr(n,StringLen(GV_PREFIX+"R_")));
      if(!PositionSelectByTicket(tk)) GlobalVariableDel(n);
   }
}

int ProtIdx(ulong tk)
{
   int n=ArraySize(g_prot);
   for(int i=0;i<n;i++) if(g_prot[i].ticket==tk) return(i);
   ArrayResize(g_prot,n+1);
   g_prot[n].ticket=tk; g_prot[n].tries=0; g_prot[n].lastTry=0; g_prot[n].lastAlert=0;
   return(n);
}

//+------------------------------------------------------------------+
//| Stop modification with broker checks; true only when the server |
//| confirms the new stop                                            |
//+------------------------------------------------------------------+
bool SetStop(ulong tk,int dir,double newSL,double oldSL,double tp,string why)
{
   double bid=SymbolInfoDouble(_Symbol,SYMBOL_BID), ask=SymbolInfoDouble(_Symbol,SYMBOL_ASK);
   double cur=(dir>0 ? bid : ask);
   double pt=SymbolInfoDouble(_Symbol,SYMBOL_POINT);
   double stops =SymbolInfoInteger(_Symbol,SYMBOL_TRADE_STOPS_LEVEL)*pt;
   double freeze=SymbolInfoInteger(_Symbol,SYMBOL_TRADE_FREEZE_LEVEL)*pt;

   newSL=NormPrice(newSL);
   if(oldSL>0 && (newSL-oldSL)*dir<=0) return(false);                       // never loosen
   if((cur-newSL)*dir<=stops)                                               // too close to price
   {
      newSL=NormPrice(cur-dir*(stops+pt));
      if(oldSL>0 && (newSL-oldSL)*dir<=0) return(false);
      if((cur-newSL)*dir<=0) return(false);
   }
   if(freeze>0 && oldSL>0 && MathAbs(cur-oldSL)<=freeze) return(false);     // frozen, retry later
   if(freeze>0 && tp>0 && MathAbs(cur-tp)<=freeze) return(false);

   if(!trade.PositionModify(tk,newSL,tp) || trade.ResultRetcode()!=TRADE_RETCODE_DONE)
   {
      Say(StringFormat("%s FAILED for #%I64u: %d %s",why,tk,trade.ResultRetcode(),trade.ResultRetcodeDescription()),false);
      return(false);
   }
   if(!PositionSelectByTicket(tk)) return(false);
   double ts=SymbolInfoDouble(_Symbol,SYMBOL_TRADE_TICK_SIZE);
   if(MathAbs(PositionGetDouble(POSITION_SL)-newSL)>MathMax(ts,pt)/2.0)
   {
      Say(StringFormat("%s for #%I64u not confirmed (server SL %s)",why,tk,DoubleToString(PositionGetDouble(POSITION_SL),_Digits)),false);
      return(false);
   }
   Say(StringFormat("%s #%I64u: SL %s -> %s (confirmed by server)",why,tk,
                    oldSL>0 ? DoubleToString(oldSL,_Digits) : "none",DoubleToString(newSL,_Digits)),false);
   return(true);
}

//+------------------------------------------------------------------+
//| Stop-Loss Enforcer + break-even + trailing                       |
//+------------------------------------------------------------------+
void Protect()
{
   double atr=ATRNow();
   if(atr<=0) return;
   for(int i=PositionsTotal()-1;i>=0;i--)
   {
      ulong tk=PositionGetTicket(i);
      if(tk==0 || !Managed()) continue;
      ProtectOne(tk,atr);
   }
}

void ProtectOne(ulong tk,double atr)
{
   int    dir =(PositionGetInteger(POSITION_TYPE)==POSITION_TYPE_BUY ? 1 : -1);
   double open=PositionGetDouble(POSITION_PRICE_OPEN);
   double sl  =PositionGetDouble(POSITION_SL);
   double tp  =PositionGetDouble(POSITION_TP);
   double cur =(dir>0 ? SymbolInfoDouble(_Symbol,SYMBOL_BID) : SymbolInfoDouble(_Symbol,SYMBOL_ASK));
   double R   =GetR(tk,open,sl,dir,atr);
   int    pi  =ProtIdx(tk);

   //--- 1) missing stop loss
   if(sl==0)
   {
      if(TimeCurrent()-g_prot[pi].lastTry<InpRetrySec) return;
      g_prot[pi].lastTry=TimeCurrent();
      double want=open-dir*InpEmergencySL_ATR*atr;
      bool ok=false;
      if((cur-want)*dir>0) ok=SetStop(tk,dir,want,0,tp,"SL ENFORCER install");
      else Say(StringFormat("#%I64u has no SL and price is already beyond the emergency level",tk),true);
      if(ok) { g_prot[pi].tries=0; return; }
      g_prot[pi].tries++;
      if(g_prot[pi].tries<InpMaxRetries && (cur-want)*dir>0) return;
      if(InpFailPolicy==FAIL_CLOSE)
      {
         if(trade.PositionClose(tk) && trade.ResultRetcode()==TRADE_RETCODE_DONE)
            Say(StringFormat("#%I64u CLOSED by SL Enforcer: stop could not be installed",tk),true);
         else
            Say(StringFormat("#%I64u UNPROTECTED and close FAILED: %d %s",tk,trade.ResultRetcode(),trade.ResultRetcodeDescription()),true);
      }
      else if(TimeCurrent()-g_prot[pi].lastAlert>=60)
      {
         g_prot[pi].lastAlert=TimeCurrent();
         Say(StringFormat("#%I64u is UNPROTECTED (no stop loss) - act now",tk),true);
      }
      return;
   }
   if(R<=0) return;

   //--- 2) break-even and 3) trailing (only ever tighten)
   double prof =(cur-open)*dir;
   double best =sl;
   string why  ="";
   if(InpUseBE && prof>=InpBETriggerR*R)
   {
      double be=open+dir*InpBELockR*R;
      if((be-best)*dir>0) { best=be; why="BREAK-EVEN"; }
   }
   if(InpUseTrail && prof>=InpTrailStartR*R)
   {
      double tr=cur-dir*InpTrailATR*atr;
      if((tr-best)*dir>0 && (tr-sl)*dir>=InpTrailStepATR*atr) { best=tr; why="TRAILING"; }
   }
   if(why=="" || (best-sl)*dir<=0) return;
   if(TimeCurrent()-g_prot[pi].lastTry<1) return;       // at most one modify per second per position
   g_prot[pi].lastTry=TimeCurrent();
   SetStop(tk,dir,best,sl,tp,why);
}

//+------------------------------------------------------------------+
//| Entries                                                          |
//+------------------------------------------------------------------+
bool Buf(int h,int buf,int shift,double &v)
{
   double a[];
   if(CopyBuffer(h,buf,shift,1,a)<1) return(false);
   v=a[0];
   return(true);
}

// same-direction signal on a confirmation timeframe within its last N closed bars
bool ConfOK(int h,int dir)
{
   if(h==INVALID_HANDLE) return(true);
   double a[];
   int n=CopyBuffer(h,11,1,InpConfBars,a);
   if(n<1) return(false);
   for(int i=0;i<n;i++) if(a[i]!=EMPTY_VALUE && (int)a[i]==dir) return(true);
   return(false);
}

double CalcLots(int dir,double price,double dist,string &why)
{
   double vmin=SymbolInfoDouble(_Symbol,SYMBOL_VOLUME_MIN);
   double vmax=SymbolInfoDouble(_Symbol,SYMBOL_VOLUME_MAX);
   double step=SymbolInfoDouble(_Symbol,SYMBOL_VOLUME_STEP);
   if(step<=0) step=vmin;
   double lots;
   if(InpLotMode==LOT_FIXED)
   {
      lots=(InpFixedLots<=0 ? vmin : InpFixedLots);
      if(lots<vmin) { why=StringFormat("fixed lots %.2f below broker minimum %.2f",lots,vmin); return(0); }
   }
   else
   {
      double loss1=0;
      if(!OrderCalcProfit(dir>0 ? ORDER_TYPE_BUY : ORDER_TYPE_SELL,_Symbol,1.0,price,price-dir*dist,loss1) || loss1==0)
      { why="cannot calculate risk per lot"; return(0); }
      double money=AccountInfoDouble(ACCOUNT_BALANCE)*InpRiskPercent/100.0;
      lots=money/MathAbs(loss1);
   }
   lots=MathFloor(lots/step+1e-9)*step;
   if(InpMaxLots>0 && lots>InpMaxLots) lots=MathFloor(InpMaxLots/step+1e-9)*step;
   if(lots>vmax) lots=vmax;
   if(lots<vmin)
   {
      why=StringFormat("minimum lot %.2f would risk more than %.2f%% (lot needed %.3f)",vmin,InpRiskPercent,lots);
      return(0);
   }
   return(NormalizeDouble(lots,VolDigits(step)));
}

void CheckEntry()
{
   datetime bar0=iTime(_Symbol,g_tf,0), bar1=iTime(_Symbol,g_tf,1);
   if(bar0==0 || bar1==0 || bar1<=g_lastBar) return;
   if(BarsCalculated(g_hInd)<Bars(_Symbol,g_tf)) return;          // indicator has not finished the new bar

   double dirv,kind,sid,ssl,bsl,legs;
   if(!Buf(g_hInd,11,1,dirv) || !Buf(g_hInd,12,1,kind) || !Buf(g_hInd,9,1,sid) ||
      !Buf(g_hInd,7,1,ssl)   || !Buf(g_hInd,8,1,bsl)   || !Buf(g_hInd,10,1,legs)) return;

   g_lastBar=bar1;                                                // one decision per closed bar
   GlobalVariableSet(g_gvLastBar,(double)(long)bar1);
   if(dirv==EMPTY_VALUE) return;

   int    dir =(int)dirv;
   int    k   =(int)kind;
   string side=(dir>0 ? "BUY" : "SELL");
   string kn  =(k==2 ? "EXH" : (k==3 ? "CONT" : "DIV"));
   string tag =StringFormat("%s %s L%d (signal id %s)",side,kn,(int)legs,TimeToString((datetime)(long)sid,TIME_DATE|TIME_MINUTES));

   if(!InpEnableEntries)                                  { Say(tag+" ignored - entries switched OFF",false); return; }
   if(dir>0 && !InpAllowBuys)                             { Say(tag+" ignored - buys disabled",false); return; }
   if(dir<0 && !InpAllowSells)                            { Say(tag+" ignored - sells disabled",false); return; }
   if((k==1 && !InpTradeDIV) || (k==2 && !InpTradeEXH) || (k==3 && !InpTradeCONT))
                                                          { Say(tag+" ignored - kind disabled",false); return; }
   if(TimeCurrent()-bar0>InpMaxEntryDelaySec)             { Say(tag+" skipped - too late after bar open",true); return; }
   if(!TerminalInfoInteger(TERMINAL_TRADE_ALLOWED) || !MQLInfoInteger(MQL_TRADE_ALLOWED))
                                                          { Say(tag+" skipped - ALGO TRADING IS OFF",true); return; }
   long tm=SymbolInfoInteger(_Symbol,SYMBOL_TRADE_MODE);
   if(tm==SYMBOL_TRADE_MODE_DISABLED || tm==SYMBOL_TRADE_MODE_CLOSEONLY ||
      (dir>0 && tm==SYMBOL_TRADE_MODE_SHORTONLY) || (dir<0 && tm==SYMBOL_TRADE_MODE_LONGONLY))
                                                          { Say(tag+" skipped - symbol trade mode does not allow it",true); return; }
   if(InpMaxSpreadPoints>0 && SymbolInfoInteger(_Symbol,SYMBOL_SPREAD)>InpMaxSpreadPoints)
                                                          { Say(tag+" skipped - spread too wide",true); return; }
   if(CountEA(0,false)>=InpMaxPositions)                  { Say(tag+" skipped - max open positions",false); return; }
   if(CountEA(dir,true)>=InpMaxPerDir)                    { Say(tag+" skipped - max positions this direction",false); return; }
   if(OppositeOnNetting(dir))                             { Say(tag+" skipped - netting account holds the opposite position",true); return; }
   if(!ConfOK(g_hConf2,dir) || !ConfOK(g_hConf3,dir))     { Say(tag+" skipped - confluence timeframe did not agree",false); return; }

   double atr=ATRNow();
   if(atr<=0)                                             { Say(tag+" skipped - no ATR",false); return; }
   double price=(dir>0 ? SymbolInfoDouble(_Symbol,SYMBOL_ASK) : SymbolInfoDouble(_Symbol,SYMBOL_BID));
   double ext  =(dir>0 ? bsl : ssl);
   if(ext==EMPTY_VALUE || ext<=0)                         { Say(tag+" skipped - no SL reference",false); return; }
   double sl   =NormPrice(ext-dir*InpSLBufferATR*atr);
   double dist =(price-sl)*dir;
   double pt   =SymbolInfoDouble(_Symbol,SYMBOL_POINT);
   double stops=SymbolInfoInteger(_Symbol,SYMBOL_TRADE_STOPS_LEVEL)*pt;
   if(dist<=0)                                            { Say(tag+" skipped - price already beyond the stop level",true); return; }
   if(dist>InpMaxSL_ATR*atr)                              { Say(tag+StringFormat(" skipped - SL too wide (%.1f ATR)",dist/atr),true); return; }
   if(dist<=stops)                                        { Say(tag+" skipped - SL inside broker stop level",true); return; }
   double tp=(InpUseTP ? NormPrice(price+dir*InpRR*dist) : 0);

   string why="";
   double lots=CalcLots(dir,price,dist,why);
   if(lots<=0)                                            { Say(tag+" skipped - "+why,true); return; }
   double margin=0;
   if(OrderCalcMargin(dir>0 ? ORDER_TYPE_BUY : ORDER_TYPE_SELL,_Symbol,lots,price,margin) &&
      margin>AccountInfoDouble(ACCOUNT_MARGIN_FREE))      { Say(tag+" skipped - not enough free margin",true); return; }

   bool ok=(dir>0 ? trade.Buy(lots,_Symbol,0,sl,tp,"TDI "+kn) : trade.Sell(lots,_Symbol,0,sl,tp,"TDI "+kn));
   uint rc=trade.ResultRetcode();
   if(!ok || (rc!=TRADE_RETCODE_DONE && rc!=TRADE_RETCODE_PLACED && rc!=TRADE_RETCODE_DONE_PARTIAL))
   { Say(StringFormat("%s ORDER FAILED: %d %s",tag,rc,trade.ResultRetcodeDescription()),true); return; }

   //--- remember the initial risk for break-even / trailing (survives restarts)
   ulong pos=0, deal=trade.ResultDeal();
   if(deal>0 && HistoryDealSelect(deal)) pos=(ulong)HistoryDealGetInteger(deal,DEAL_POSITION_ID);
   if(pos==0) pos=trade.ResultOrder();
   double fill=(trade.ResultPrice()>0 ? trade.ResultPrice() : price);
   if(pos>0) GlobalVariableSet(GVR(pos),MathAbs(fill-sl));

   Say(StringFormat("%s OPENED #%I64u %.2f lots @ %s  SL %s  TP %s  risk %.2f%%",tag,pos,lots,
                    DoubleToString(fill,_Digits),DoubleToString(sl,_Digits),tp>0 ? DoubleToString(tp,_Digits) : "none",
                    InpLotMode==LOT_RISK ? InpRiskPercent : 0.0),true);
   Protect();                                                     // install the stop immediately if the broker dropped it
}

void ShowStatus()
{
   if(IsTester()) return;
   Comment(StringFormat("TDI Divergence EA | %s %s | entries %s | EA positions %d\nBE at %.1fR (lock %.2fR) | trail from %.1fR at %.1f ATR | SL enforcer %s\n%s",
                        _Symbol,EnumToString(g_tf),InpEnableEntries ? "ON" : "OFF",CountEA(0,true),
                        InpBETriggerR,InpBELockR,InpTrailStartR,InpTrailATR,
                        InpFailPolicy==FAIL_CLOSE ? "closes unprotected trades" : "alerts only",g_lastMsg));
}
//+------------------------------------------------------------------+
