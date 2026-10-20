//+------------------------------------------------------------------+
//|                                           TDI_Divergence_EA.mq5  |
//|  v4 - trades confirmed divergence signals from TDI_Divergence v4 |
//|  immediately at the open of the next candle.                     |
//|  - waits until the indicator has calculated the new candle       |
//|    (prevents missed signals from indicator lag)                  |
//|  - one trade per signal, never enters late (MaxEntryDelaySec)    |
//|  - SL beyond the leg extreme (+ ATR buffer), TP = RR x risk      |
//|  - alerts + phone push on every trade and every skipped signal   |
//|  - warns when Algo Trading is off                                |
//|  Built for Deriv Volatility 25 / Volatility 50.                  |
//|  Requires TDI_Divergence.ex5 (v4) in MQL5\Indicators.            |
//+------------------------------------------------------------------+
#include <Trade\Trade.mqh>

input group "General"
input string          IndName          = "TDI_Divergence";
input ENUM_TIMEFRAMES EntryTF          = PERIOD_CURRENT;
input string          AllowedSymbols   = "Volatility 25 Index,Volatility 50 Index"; // empty = any
input bool            AllowSells       = true;
input bool            AllowBuys        = true;
input int             MaxEntryDelaySec = 180;   // enter only within this many seconds of candle open

input group "Higher timeframe trend (optional)"
input bool            UseHTFTrend      = false;
input ENUM_TIMEFRAMES TrendTF          = PERIOD_H4;

input group "Risk"
input double FixedLots        = 0.5;    // used when RiskPercent = 0 (raised to broker minimum)
input double RiskPercent      = 0.0;    // >0 = lot size from % of balance
input double SL_BufferATR     = 0.3;    // SL = leg extreme + this x ATR
input double MaxSL_ATR        = 4.0;    // skip if SL wider than this x ATR
input double RR               = 2.0;    // TP = RR x risk
input int    MaxSpreadPoints  = 0;      // 0 = off
input bool   UseBreakeven     = true;
input double BE_AtRR          = 1.0;
input int    MaxOpenTrades    = 1;
input long   Magic            = 20261017;
input int    SlippagePoints   = 50;

input group "Notifications"
input bool   AlertOnTrade     = true;
input bool   PushOnTrade      = true;   // needs MetaQuotes ID in Tools > Options > Notifications

input group "Indicator settings (must match indicator)"
input int    RSI_Period           = 13;
input int    PriceLinePeriod      = 2;
input int    SignalPeriod         = 7;
input int    BandPeriod           = 34;
input double BandDev              = 1.6185;
input int    LeftBars             = 5;
input int    RightBars            = 3;
input int    MinGap               = 6;
input int    MaxLookback          = 80;
input double MinLegExtensionATR   = 0.5;
input int    ExtremeBars          = 50;
input double MinPullbackATR       = 1.0;
input double MinTDIDiff           = -1.0;
input double MinTDIRetrace        = 6.0;
input bool   RequireOB            = true;
input double FirstLegOB           = 60;
input double FirstLegOS           = 40;
input bool   UseBandOB            = false;
input int    MinLegs              = 2;
input int    MaxLegs              = 4;
input bool   UseTrendFilter       = true;
input int    StructureBars        = 20;
input int    StructureLookback    = 400;
input bool   AllowCounterTrend    = true;
input double CounterTrendOB       = 75;
input double CounterTrendOS       = 25;
input bool   CounterTrendNeedBand = true;
input int    ConfirmBars          = 6;
input bool   RequireSignalCross   = true;
input bool   RequireCloseBeyond   = true;
input bool   RequireCandleDir     = true;
input int    MaxBars              = 3000;

CTrade   trade;
int      hEntry=INVALID_HANDLE, hTrend=INVALID_HANDLE, hATR=INVALID_HANDLE;
datetime lastSignalBar=0;
datetime lastWarn=0;

//+------------------------------------------------------------------+
int MakeHandle(ENUM_TIMEFRAMES tf)
{
   return(iCustom(_Symbol,tf,IndName,
          RSI_Period,PriceLinePeriod,SignalPeriod,BandPeriod,BandDev,
          LeftBars,RightBars,MinGap,MaxLookback,MinLegExtensionATR,ExtremeBars,MinPullbackATR,
          MinTDIDiff,MinTDIRetrace,RequireOB,FirstLegOB,FirstLegOS,UseBandOB,MinLegs,MaxLegs,
          UseTrendFilter,StructureBars,StructureLookback,AllowCounterTrend,CounterTrendOB,CounterTrendOS,CounterTrendNeedBand,
          ConfirmBars,RequireSignalCross,RequireCloseBeyond,RequireCandleDir,
          MaxBars,false,false,false,false,clrBlue,clrBlue));   // Draw, Alerts, Push, Rejects off for EA copy
}

bool SymbolAllowed()
{
   if(StringLen(AllowedSymbols)==0) return(true);
   string parts[];
   int n=StringSplit(AllowedSymbols,',',parts);
   string sym=_Symbol; StringToLower(sym);
   for(int i=0;i<n;i++)
   {
      string s=parts[i];
      StringTrimLeft(s); StringTrimRight(s); StringToLower(s);
      if(s!="" && StringFind(sym,s)>=0) return(true);
   }
   return(false);
}

void Say(string msg,bool push)
{
   Print(msg);
   if(AlertOnTrade) Alert(msg);
   if(push && PushOnTrade) SendNotification(msg);
}

int OnInit()
{
   if(!SymbolAllowed())
   {
      Alert("TDI EA: not allowed on ",_Symbol,". Allowed: ",AllowedSymbols);
      return(INIT_FAILED);
   }
   hEntry=MakeHandle(EntryTF);
   hATR=iATR(_Symbol,EntryTF,14);
   if(UseHTFTrend) hTrend=MakeHandle(TrendTF);
   if(hEntry==INVALID_HANDLE || hATR==INVALID_HANDLE || (UseHTFTrend && hTrend==INVALID_HANDLE))
   {
      Alert("TDI EA: cannot load ",IndName," - compile TDI_Divergence v4 in MQL5\\Indicators first");
      return(INIT_FAILED);
   }
   trade.SetExpertMagicNumber(Magic);
   trade.SetDeviationInPoints(SlippagePoints);
   trade.SetTypeFillingBySymbol(_Symbol);
   Print("TDI EA v4 started on ",_Symbol," ",EnumToString((ENUM_TIMEFRAMES)Period()));
   return(INIT_SUCCEEDED);
}

void OnDeinit(const int reason)
{
   if(hEntry!=INVALID_HANDLE) IndicatorRelease(hEntry);
   if(hATR!=INVALID_HANDLE)   IndicatorRelease(hATR);
   if(hTrend!=INVALID_HANDLE) IndicatorRelease(hTrend);
}

//+------------------------------------------------------------------+
int OpenTrades()
{
   int n=0;
   for(int i=PositionsTotal()-1;i>=0;i--)
   {
      if(PositionGetTicket(i)==0) continue;
      if(PositionGetString(POSITION_SYMBOL)==_Symbol && PositionGetInteger(POSITION_MAGIC)==Magic) n++;
   }
   return(n);
}

double CalcLots(double slDist)
{
   double step=SymbolInfoDouble(_Symbol,SYMBOL_VOLUME_STEP);
   double mn=SymbolInfoDouble(_Symbol,SYMBOL_VOLUME_MIN);
   double mx=SymbolInfoDouble(_Symbol,SYMBOL_VOLUME_MAX);
   double lots=FixedLots;
   if(RiskPercent>0)
   {
      double tv=SymbolInfoDouble(_Symbol,SYMBOL_TRADE_TICK_VALUE);
      double ts=SymbolInfoDouble(_Symbol,SYMBOL_TRADE_TICK_SIZE);
      if(tv<=0 || ts<=0 || slDist<=0) return(-1);
      lots=AccountInfoDouble(ACCOUNT_BALANCE)*RiskPercent/100.0/(slDist/ts*tv);
      if(step>0) lots=MathFloor(lots/step)*step;
      if(lots<mn) return(-2);
   }
   else if(step>0) lots=MathFloor(lots/step)*step;
   return(MathMax(mn,MathMin(mx,lots)));
}

void Open(bool sell,double legExtreme,double atr)
{
   string side=sell? "SELL" : "BUY";
   double bid=SymbolInfoDouble(_Symbol,SYMBOL_BID);
   double ask=SymbolInfoDouble(_Symbol,SYMBOL_ASK);
   double price=sell? bid : ask;
   double sl=sell? legExtreme+SL_BufferATR*atr : legExtreme-SL_BufferATR*atr;
   double dist=sell? sl-price : price-sl;

   if(dist<=0)            { Say("TDI EA: "+side+" signal skipped - price already beyond the leg",false); return; }
   if(dist>MaxSL_ATR*atr) { Say("TDI EA: "+side+" signal skipped - SL too wide ("+DoubleToString(dist/atr,1)+" ATR)",true); return; }
   double minDist=SymbolInfoInteger(_Symbol,SYMBOL_TRADE_STOPS_LEVEL)*_Point;
   if(dist<=minDist)      { Say("TDI EA: "+side+" signal skipped - SL inside broker stop level",false); return; }

   double lots=CalcLots(dist);
   if(lots==-2) { Say("TDI EA: "+side+" signal skipped - minimum lot risks more than "+DoubleToString(RiskPercent,1)+"%",true); return; }
   if(lots<=0)  { Say("TDI EA: "+side+" signal skipped - lot size error",false); return; }

   double tp=sell? price-RR*dist : price+RR*dist;
   sl=NormalizeDouble(sl,_Digits);
   tp=NormalizeDouble(tp,_Digits);
   bool ok=sell? trade.Sell(lots,_Symbol,0,sl,tp,"TDI Div v4")
               : trade.Buy (lots,_Symbol,0,sl,tp,"TDI Div v4");
   if(ok && (trade.ResultRetcode()==TRADE_RETCODE_DONE || trade.ResultRetcode()==TRADE_RETCODE_PLACED))
      Say(StringFormat("TDI EA: %s %s %.2f lots @ %s  SL %s  TP %s",side,_Symbol,lots,
          DoubleToString(trade.ResultPrice(),_Digits),DoubleToString(sl,_Digits),DoubleToString(tp,_Digits)),true);
   else
      Say("TDI EA: "+side+" ORDER FAILED "+IntegerToString(trade.ResultRetcode())+" "+trade.ResultRetcodeDescription(),true);
}

void ManageBreakeven()
{
   if(!UseBreakeven) return;
   for(int i=PositionsTotal()-1;i>=0;i--)
   {
      ulong t=PositionGetTicket(i);
      if(t==0) continue;
      if(PositionGetString(POSITION_SYMBOL)!=_Symbol || PositionGetInteger(POSITION_MAGIC)!=Magic) continue;
      double op=PositionGetDouble(POSITION_PRICE_OPEN);
      double sl=PositionGetDouble(POSITION_SL);
      double tp=PositionGetDouble(POSITION_TP);
      bool buy=(PositionGetInteger(POSITION_TYPE)==POSITION_TYPE_BUY);
      if(sl==0) continue;
      double risk=buy? op-sl : sl-op;
      if(risk<=0) continue;
      double cur=buy? SymbolInfoDouble(_Symbol,SYMBOL_BID) : SymbolInfoDouble(_Symbol,SYMBOL_ASK);
      double gain=buy? cur-op : op-cur;
      if(gain>=BE_AtRR*risk) trade.PositionModify(t,NormalizeDouble(op,_Digits),tp);
   }
}

//+------------------------------------------------------------------+
void OnTick()
{
   ManageBreakeven();

   datetime bar0=iTime(_Symbol,EntryTF,0);
   datetime sigBar=iTime(_Symbol,EntryTF,1);
   if(bar0==0 || sigBar==0 || sigBar==lastSignalBar) return;     // this candle already handled

   // indicator must have calculated the new candle, otherwise wait for the next tick
   if(BarsCalculated(hEntry)<Bars(_Symbol,EntryTF)) return;

   double s[],b[],ssl[],bsl[],atr[];
   if(CopyBuffer(hEntry,5,1,1,s)<1   || CopyBuffer(hEntry,6,1,1,b)<1 ||
      CopyBuffer(hEntry,7,1,1,ssl)<1 || CopyBuffer(hEntry,8,1,1,bsl)<1 ||
      CopyBuffer(hATR,0,1,1,atr)<1) return;

   bool sellSig=(s[0]!=EMPTY_VALUE && ssl[0]!=EMPTY_VALUE);
   bool buySig =(b[0]!=EMPTY_VALUE && bsl[0]!=EMPTY_VALUE);
   if(!sellSig && !buySig)
   {
      // keep checking during the first seconds of the candle (indicator can lag a tick)
      if(TimeCurrent()-bar0 > MaxEntryDelaySec) lastSignalBar=sigBar;
      return;
   }
   lastSignalBar=sigBar;                                         // one decision per signal
   string side=sellSig? "SELL" : "BUY";

   if(TimeCurrent()-bar0 > MaxEntryDelaySec)
   { Say("TDI EA: "+side+" signal too old, not entering late",true); return; }

   if(!TerminalInfoInteger(TERMINAL_TRADE_ALLOWED) || !MQLInfoInteger(MQL_TRADE_ALLOWED))
   { Say("TDI EA: "+side+" signal on "+_Symbol+" but ALGO TRADING IS OFF - no trade",true); return; }

   if(OpenTrades()>=MaxOpenTrades)
   { Say("TDI EA: "+side+" signal skipped - max open trades reached",true); return; }

   if(MaxSpreadPoints>0 && SymbolInfoInteger(_Symbol,SYMBOL_SPREAD)>MaxSpreadPoints)
   { Say("TDI EA: "+side+" signal skipped - spread too wide",true); return; }

   if(UseHTFTrend)
   {
      double tr[];
      if(CopyBuffer(hTrend,9,1,1,tr)==1 && tr[0]!=EMPTY_VALUE)
      {
         if(sellSig && (int)tr[0]==1)  { Say("TDI EA: SELL skipped - "+EnumToString(TrendTF)+" trend UP",true);  return; }
         if(buySig  && (int)tr[0]==-1) { Say("TDI EA: BUY skipped - "+EnumToString(TrendTF)+" trend DOWN",true); return; }
      }
   }

   if(sellSig && AllowSells) { Open(true, ssl[0],atr[0]); return; }
   if(buySig  && AllowBuys)  { Open(false,bsl[0],atr[0]); return; }
}
//+------------------------------------------------------------------+
