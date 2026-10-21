//+------------------------------------------------------------------+
//|                                              TDI_SL_Enforcer.mq5 |
//|  Stand-alone Stop-Loss Enforcer for MANUAL trades. Never opens   |
//|  a trade. Attach to ONE chart; it watches every symbol.          |
//|                                                                  |
//|  1) Missing stop loss: after a short grace period it installs    |
//|     one (ATR-based, money-based, or the closer of both), retries |
//|     and then applies the failure policy (close or alert).        |
//|  2) Break-even: SL to entry + BELockR x risk once the trade is   |
//|     BETriggerR x risk in profit.                                 |
//|  3) Trailing stop: from TrailStartR, SL follows price at         |
//|     TrailATR x ATR, in steps.                                    |
//|  Rules: never loosens a stop; respects stop and freeze levels;   |
//|  a stop counts as set only after the server confirms it; the     |
//|  initial risk per ticket is kept in terminal global variables,   |
//|  so break-even / trailing continue after a restart.              |
//+------------------------------------------------------------------+
#property version     "1.00"
#property description "Stop-Loss Enforcer for manual trades: installs missing SL, break-even, trailing. Never opens trades."

#include <Trade\Trade.mqh>

enum ENUM_EMERG_MODE  { EM_ATR=0,     // ATR distance
                        EM_MONEY=1,   // Max loss in % of balance
                        EM_CLOSER=2 };// Closer of both (safest)
enum ENUM_FAIL_POLICY { FAIL_CLOSE=0, // Close the unprotected trade
                        FAIL_ALERT=1 };// Keep it, alert every minute

input group "=== Which trades ==="
input bool            InpAllSymbols     = true;          // Watch all symbols (false = this chart's symbol only)
input bool            InpManageManual   = true;          // Manual trades (magic 0)
input long            InpManageMagic    = -1;            // Also this EA magic number (-1 = none)
input bool            InpManageAllMagics= false;         // Also every EA's trades

input group "=== Missing stop loss ==="
input int              InpGraceSec      = 20;            // Seconds you get to set your own SL first
input ENUM_EMERG_MODE  InpEmergencyMode = EM_CLOSER;
input double           InpEmergencyATR  = 2.0;           // ATR mode: entry -/+ this x ATR
input ENUM_TIMEFRAMES  InpATRTF         = PERIOD_M15;    // ATR timeframe
input double           InpMaxLossPct    = 2.0;           // Money mode: max loss per trade, % of balance
input bool             InpTightenWideSL = false;         // Also tighten an existing SL that risks more than MaxLossPct
input int              InpMaxRetries    = 5;             // Attempts before the failure policy
input int              InpRetrySec      = 5;             // Seconds between attempts
input ENUM_FAIL_POLICY InpFailPolicy    = FAIL_CLOSE;

input group "=== Break-even ==="
input bool            InpUseBE          = true;
input double          InpBETriggerR     = 0.5;           // Move to break-even at this x risk in profit
input double          InpBELockR        = 0.1;           // Lock this x risk beyond entry

input group "=== Trailing stop ==="
input bool            InpUseTrail       = true;
input double          InpTrailStartR    = 1.0;           // Start at this x risk in profit
input double          InpTrailATR       = 1.5;           // Distance, x ATR
input double          InpTrailStepATR   = 0.1;           // Move only when it improves by this x ATR

input group "=== Notifications / log ==="
input bool            InpAlert          = true;
input bool            InpPush           = false;         // Phone push (MetaQuotes ID in Tools > Options)
input bool            InpLogFile        = true;          // MQL5\Files\TDI_SL_Enforcer.csv

#define GV_R "TDISLE_R_"

CTrade trade;

struct SProt   { ulong ticket; datetime firstSeen; int tries; datetime lastTry; datetime lastAlert; string state; };
struct SAtr    { string sym; int handle; };
SProt  g_prot[];
SAtr   g_atr[];
string g_last="";

//+------------------------------------------------------------------+
void LogLine(string what)
{
   if(!InpLogFile) return;
   string fn="TDI_SL_Enforcer.csv";
   bool ex=FileIsExist(fn);
   int f=FileOpen(fn,FILE_READ|FILE_WRITE|FILE_TXT|FILE_ANSI|FILE_SHARE_READ);
   if(f==INVALID_HANDLE) return;
   FileSeek(f,0,SEEK_END);
   if(!ex) FileWriteString(f,"time;event\r\n");
   FileWriteString(f,TimeToString(TimeCurrent(),TIME_DATE|TIME_SECONDS)+";"+what+"\r\n");
   FileClose(f);
}

void Say(string msg,bool important)
{
   msg="SL Enforcer: "+msg;
   Print(msg); LogLine(msg); g_last=msg;
   if(MQLInfoInteger(MQL_TESTER)) return;
   if(important && InpAlert) Alert(msg);
   if(important && InpPush)  SendNotification(msg);
}

double NormPrice(string sym,double p)
{
   double ts=SymbolInfoDouble(sym,SYMBOL_TRADE_TICK_SIZE);
   if(ts>0) p=MathRound(p/ts)*ts;
   return(NormalizeDouble(p,(int)SymbolInfoInteger(sym,SYMBOL_DIGITS)));
}

double ATRof(string sym)
{
   int n=ArraySize(g_atr), h=INVALID_HANDLE;
   for(int i=0;i<n;i++) if(g_atr[i].sym==sym) { h=g_atr[i].handle; break; }
   if(h==INVALID_HANDLE)
   {
      h=iATR(sym,InpATRTF,14);
      if(h==INVALID_HANDLE) return(0);
      ArrayResize(g_atr,n+1); g_atr[n].sym=sym; g_atr[n].handle=h;
   }
   double a[];
   if(CopyBuffer(h,0,1,1,a)<1 || a[0]<=0) return(0);
   return(a[0]);
}

// price distance at which 'lots' lose InpMaxLossPct of balance (0 = cannot calculate)
double MoneyDist(string sym,int dir,double lots,double open)
{
   double p=0, bal=AccountInfoDouble(ACCOUNT_BALANCE);
   if(bal<=0 || lots<=0) return(0);
   if(!OrderCalcProfit(dir>0 ? ORDER_TYPE_BUY : ORDER_TYPE_SELL,sym,lots,open,open-dir*1.0,p) || p==0) return(0);
   return(bal*InpMaxLossPct/100.0/MathAbs(p));                 // loss is linear in the price move
}

double EmergencyDist(string sym,int dir,double lots,double open,double atr)
{
   double da=(atr>0 ? InpEmergencyATR*atr : 0), dm=MoneyDist(sym,dir,lots,open);
   if(InpEmergencyMode==EM_ATR)   return(da>0 ? da : dm);
   if(InpEmergencyMode==EM_MONEY) return(dm>0 ? dm : da);
   if(da>0 && dm>0) return(MathMin(da,dm));
   return(MathMax(da,dm));
}

bool Managed()
{
   if(!InpAllSymbols && PositionGetString(POSITION_SYMBOL)!=_Symbol) return(false);
   long mg=PositionGetInteger(POSITION_MAGIC);
   if(mg==0) return(InpManageManual);
   if(InpManageAllMagics) return(true);
   return(InpManageMagic>=0 && mg==InpManageMagic);
}

int ProtIdx(ulong tk)
{
   int n=ArraySize(g_prot);
   for(int i=0;i<n;i++) if(g_prot[i].ticket==tk) return(i);
   ArrayResize(g_prot,n+1);
   g_prot[n].ticket=tk; g_prot[n].firstSeen=TimeCurrent(); g_prot[n].tries=0;
   g_prot[n].lastTry=0; g_prot[n].lastAlert=0; g_prot[n].state="new";
   return(n);
}

double GetR(ulong tk,double open,double sl,int dir,double emerg)
{
   string n=GV_R+IntegerToString((long)tk);
   if(GlobalVariableCheck(n)) return(GlobalVariableGet(n));
   double r=0;
   if(sl>0 && (open-sl)*dir>0) r=(open-sl)*dir;     // stop on the loss side: that is the risk
   else if(sl==0)              r=emerg;             // no stop yet: the emergency distance
   else                        return(emerg);       // stop already in profit: unknown, do not store
   if(r>0) GlobalVariableSet(n,r);
   return(r);
}

//+------------------------------------------------------------------+
//| Stop change with broker checks; true only when the server        |
//| confirms the new stop                                            |
//+------------------------------------------------------------------+
bool SetStop(ulong tk,string sym,int dir,double newSL,double oldSL,double tp,string why)
{
   double cur=(dir>0 ? SymbolInfoDouble(sym,SYMBOL_BID) : SymbolInfoDouble(sym,SYMBOL_ASK));
   double pt=SymbolInfoDouble(sym,SYMBOL_POINT);
   double stops =SymbolInfoInteger(sym,SYMBOL_TRADE_STOPS_LEVEL)*pt;
   double freeze=SymbolInfoInteger(sym,SYMBOL_TRADE_FREEZE_LEVEL)*pt;
   int    dg=(int)SymbolInfoInteger(sym,SYMBOL_DIGITS);

   newSL=NormPrice(sym,newSL);
   if(oldSL>0 && (newSL-oldSL)*dir<=0) return(false);                  // never loosen
   if((cur-newSL)*dir<=stops)
   {
      newSL=NormPrice(sym,cur-dir*(stops+pt));
      if(oldSL>0 && (newSL-oldSL)*dir<=0) return(false);
      if((cur-newSL)*dir<=0) return(false);
   }
   if(freeze>0 && oldSL>0 && MathAbs(cur-oldSL)<=freeze) return(false); // frozen: retry later
   if(freeze>0 && tp>0 && MathAbs(cur-tp)<=freeze) return(false);

   if(!trade.PositionModify(tk,newSL,tp) || trade.ResultRetcode()!=TRADE_RETCODE_DONE)
   {
      Say(StringFormat("%s %s #%I64u FAILED: %d %s",why,sym,tk,trade.ResultRetcode(),trade.ResultRetcodeDescription()),false);
      return(false);
   }
   if(!PositionSelectByTicket(tk)) return(false);
   double ts=SymbolInfoDouble(sym,SYMBOL_TRADE_TICK_SIZE);
   if(MathAbs(PositionGetDouble(POSITION_SL)-newSL)>MathMax(ts,pt)/2.0)
   {
      Say(StringFormat("%s %s #%I64u not confirmed (server SL %s)",why,sym,tk,DoubleToString(PositionGetDouble(POSITION_SL),dg)),false);
      return(false);
   }
   Say(StringFormat("%s %s #%I64u: SL %s -> %s (confirmed by server)",why,sym,tk,
                    oldSL>0 ? DoubleToString(oldSL,dg) : "none",DoubleToString(newSL,dg)),why=="SL INSTALLED");
   return(true);
}

//+------------------------------------------------------------------+
void ProtectOne(ulong tk)
{
   string sym =PositionGetString(POSITION_SYMBOL);
   int    dir =(PositionGetInteger(POSITION_TYPE)==POSITION_TYPE_BUY ? 1 : -1);
   double open=PositionGetDouble(POSITION_PRICE_OPEN);
   double sl  =PositionGetDouble(POSITION_SL);
   double tp  =PositionGetDouble(POSITION_TP);
   double lots=PositionGetDouble(POSITION_VOLUME);
   double cur =(dir>0 ? SymbolInfoDouble(sym,SYMBOL_BID) : SymbolInfoDouble(sym,SYMBOL_ASK));
   double atr =ATRof(sym);
   int    pi  =ProtIdx(tk);
   double emerg=EmergencyDist(sym,dir,lots,open,atr);
   if(emerg<=0) { g_prot[pi].state="waiting for ATR / prices"; return; }
   double R=GetR(tk,open,sl,dir,emerg);
   int    dg=(int)SymbolInfoInteger(sym,SYMBOL_DIGITS);

   //--- 1) missing stop loss
   if(sl==0)
   {
      int left=InpGraceSec-(int)(TimeCurrent()-g_prot[pi].firstSeen);
      if(left>0) { g_prot[pi].state=StringFormat("NO SL - installing in %d s",left); return; }
      if(TimeCurrent()-g_prot[pi].lastTry<InpRetrySec) return;
      g_prot[pi].lastTry=TimeCurrent();
      double want=open-dir*emerg;
      bool possible=((cur-want)*dir>0);
      bool ok=(possible && SetStop(tk,sym,dir,want,0,tp,"SL INSTALLED"));
      if(ok) { g_prot[pi].tries=0; g_prot[pi].state="SL installed"; return; }
      g_prot[pi].tries++;
      g_prot[pi].state=StringFormat("NO SL - attempt %d/%d failed",g_prot[pi].tries,InpMaxRetries);
      if(possible && g_prot[pi].tries<InpMaxRetries) return;
      if(InpFailPolicy==FAIL_CLOSE)
      {
         trade.SetTypeFillingBySymbol(sym);
         if(trade.PositionClose(tk) && trade.ResultRetcode()==TRADE_RETCODE_DONE)
            Say(StringFormat("%s #%I64u CLOSED: %s",sym,tk,possible ? "stop could not be installed" : "price already beyond the emergency stop level"),true);
         else
            Say(StringFormat("%s #%I64u UNPROTECTED and close FAILED: %d %s",sym,tk,trade.ResultRetcode(),trade.ResultRetcodeDescription()),true);
      }
      else if(TimeCurrent()-g_prot[pi].lastAlert>=60)
      {
         g_prot[pi].lastAlert=TimeCurrent();
         Say(StringFormat("%s #%I64u has NO STOP LOSS - act now",sym,tk),true);
      }
      return;
   }

   //--- optional: an existing stop that risks more than MaxLossPct is tightened
   double best=sl; string why="";
   if(InpTightenWideSL && (open-sl)*dir>0)
   {
      double dm=MoneyDist(sym,dir,lots,open);
      if(dm>0 && (open-sl)*dir>dm*1.001) { best=open-dir*dm; why="SL TIGHTENED TO MAX LOSS"; }
   }

   //--- 2) break-even and 3) trailing (only ever tighten)
   double prof=(cur-open)*dir;
   if(InpUseBE && R>0 && prof>=InpBETriggerR*R)
   {
      double be=open+dir*InpBELockR*R;
      if((be-best)*dir>0) { best=be; why="BREAK-EVEN"; }
   }
   if(InpUseTrail && R>0 && atr>0 && prof>=InpTrailStartR*R)
   {
      double tr=cur-dir*InpTrailATR*atr;
      if((tr-best)*dir>0 && (tr-sl)*dir>=InpTrailStepATR*atr) { best=tr; why="TRAILING"; }
   }
   if((sl-open)*dir>=0) g_prot[pi].state="SL in profit "+DoubleToString(sl,dg);
   else                 g_prot[pi].state="protected, SL "+DoubleToString(sl,dg);
   if(why=="" || (best-sl)*dir<=0) return;
   if(TimeCurrent()-g_prot[pi].lastTry<1) return;
   g_prot[pi].lastTry=TimeCurrent();
   SetStop(tk,sym,dir,best,sl,tp,why);
}

void Protect()
{
   for(int i=PositionsTotal()-1;i>=0;i--)
   {
      ulong tk=PositionGetTicket(i);
      if(tk==0 || !Managed()) continue;
      ProtectOne(tk);
   }
}

void Cleanup()
{
   //--- forget closed tickets
   for(int i=ArraySize(g_prot)-1;i>=0;i--)
      if(!PositionSelectByTicket(g_prot[i].ticket))
      {
         int n=ArraySize(g_prot);
         for(int j=i;j<n-1;j++)
         {
            g_prot[j].ticket=g_prot[j+1].ticket;   g_prot[j].firstSeen=g_prot[j+1].firstSeen;
            g_prot[j].tries=g_prot[j+1].tries;     g_prot[j].lastTry=g_prot[j+1].lastTry;
            g_prot[j].lastAlert=g_prot[j+1].lastAlert; g_prot[j].state=g_prot[j+1].state;
         }
         ArrayResize(g_prot,n-1);
      }
   for(int i=GlobalVariablesTotal()-1;i>=0;i--)
   {
      string n=GlobalVariableName(i);
      if(StringFind(n,GV_R)!=0) continue;
      if(!PositionSelectByTicket((ulong)StringToInteger(StringSubstr(n,StringLen(GV_R))))) GlobalVariableDel(n);
   }
}

void Panel()
{
   if(MQLInfoInteger(MQL_TESTER)) return;
   string s=StringFormat("SL ENFORCER | %s | manual %s | grace %d s | emergency %s | BE %.1fR | trail %.1fR @ %.1f ATR | fail: %s\n",
                         InpAllSymbols ? "all symbols" : _Symbol,InpManageManual ? "ON" : "off",InpGraceSec,
                         InpEmergencyMode==EM_ATR ? StringFormat("%.1f ATR",InpEmergencyATR) :
                         (InpEmergencyMode==EM_MONEY ? StringFormat("%.1f%% balance",InpMaxLossPct) :
                          StringFormat("closer of %.1f ATR / %.1f%%",InpEmergencyATR,InpMaxLossPct)),
                         InpBETriggerR,InpTrailStartR,InpTrailATR,InpFailPolicy==FAIL_CLOSE ? "close" : "alert");
   int shown=0;
   for(int i=0;i<ArraySize(g_prot) && shown<12;i++)
   {
      if(!PositionSelectByTicket(g_prot[i].ticket)) continue;
      s+=StringFormat("%s #%I64u %s %.2f: %s\n",PositionGetString(POSITION_SYMBOL),g_prot[i].ticket,
                      PositionGetInteger(POSITION_TYPE)==POSITION_TYPE_BUY ? "BUY" : "SELL",
                      PositionGetDouble(POSITION_VOLUME),g_prot[i].state);
      shown++;
   }
   if(shown==0) s+="no managed positions\n";
   Comment(s+g_last);
}

//+------------------------------------------------------------------+
int OnInit()
{
   if(InpEmergencyATR<=0 || InpMaxLossPct<=0 || InpMaxRetries<1 || InpRetrySec<1 || InpGraceSec<0 ||
      InpBETriggerR<=0 || InpBELockR<0 || InpBELockR>=InpBETriggerR || InpTrailATR<=0 || InpTrailStartR<=0)
   { Alert("SL Enforcer: invalid inputs (BELockR must be below BETriggerR)"); return(INIT_PARAMETERS_INCORRECT); }
   trade.SetDeviationInPoints(100);
   trade.SetMarginMode();
   EventSetTimer(1);
   Say(StringFormat("started: %s, manual trades %s, magic %I64d, all magics %s",
                    InpAllSymbols ? "all symbols" : _Symbol,InpManageManual ? "on" : "off",InpManageMagic,
                    InpManageAllMagics ? "on" : "off"),false);
   if(!TerminalInfoInteger(TERMINAL_TRADE_ALLOWED) || !MQLInfoInteger(MQL_TRADE_ALLOWED))
      Say("ALGO TRADING IS OFF - the enforcer cannot change stops until you turn it on",true);
   Protect();
   return(INIT_SUCCEEDED);
}

void OnDeinit(const int reason)
{
   EventKillTimer();
   for(int i=0;i<ArraySize(g_atr);i++) IndicatorRelease(g_atr[i].handle);
   Comment("");
}

void OnTick()  { Protect(); Panel(); }
void OnTimer() { Protect(); Cleanup(); Panel(); }
//+------------------------------------------------------------------+
