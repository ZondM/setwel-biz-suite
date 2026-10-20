//+------------------------------------------------------------------+
//|                                           TDI_Divergence_Pro.mq5 |
//|  TDI-led divergence: green RSI Price Line legs vs price swings.  |
//|  Specification: mt5/SPEC.md                                      |
//|                                                                  |
//|  BUY : green makes a HIGHER LOW (leg 1 -> leg 2 / leg 3) while   |
//|        price makes LOWER LOWS (market keeps going deeper).       |
//|  SELL: green makes a LOWER HIGH while price makes HIGHER HIGHS.  |
//|                                                                  |
//|  v9.1: inputs EA needs moved to the top (Quick settings).       |
//|  v9: SERIOUS TREND = higher timeframe (auto: M1-M15 -> H1,        |
//|      M30/H1 -> H4). Against it only a 3+ leg exhaustion with     |
//|      leg-1 TDI >= 70 / <= 30 and a structure break.              |
//|      Outcome statistics (hindsight, testing only) on the panel   |
//|      and in ..._stats.csv - never used to create signals.        |
//|  v8 rules (from your marked charts):                             |
//|   - flat TDI counts: TDI equal within TDITol points while price  |
//|     goes deeper is a divergence                                  |
//|   - double top/bottom counts: price about equal (PriceTolATR)    |
//|     while TDI is clearly lower/higher (DoubleMinTDI points)      |
//|   - one signal per TDI swing: after a signal, the next one in    |
//|     the same direction needs the TDI to reset through 50 first   |
//|   - counter-trend (EXH) must also close beyond the swing between |
//|     the last two legs (proof that price turned)                  |
//|   - with the trend: divergence at any TDI level         (DIV)    |
//|   - no trend: leg-1 TDI must be <= 40 (buy) / >= 60 (sell)        |
//|   - against the trend ONLY at exhaustion                (EXH):   |
//|       leg-1 TDI <= 32 / >= 68 AND 3+ legs,                       |
//|       or 2 legs with leg-1 TDI <= 25 / >= 75                     |
//|     confirmed with the normal (fast) candle rules                |
//|   - with the trend also: pullback where TDI AND price hold a     |
//|     higher low (uptrend) / lower high (downtrend)       (CONT)   |
//|                                                                  |
//|  Non-repainting: only CLOSED bars are evaluated, each bar once,  |
//|  in time order. A published signal is never moved or removed.   |
//|  The arrow sits on the CONFIRMATION bar; entry is allowed from   |
//|  the open of the next bar.                                       |
//|                                                                  |
//|  EA buffers (CopyBuffer index), EMPTY_VALUE = no signal:         |
//|   0 Upper band   1 Lower band   2 Market base  3 Green  4 Red    |
//|   5 Sell arrow   6 Buy arrow                                     |
//|   7 Sell SL ref (highest high of the last leg)                   |
//|   8 Buy SL ref  (lowest low of the last leg)                     |
//|   9 Signal ID   (open time of the last-leg TDI pivot bar)        |
//|  10 Leg count   11 Direction (+1 buy, -1 sell)                   |
//|  12 Kind (1 DIV, 2 EXH counter-trend, 3 CONT)                    |
//|  13 Trend at that closed bar (+1 up, 0 none, -1 down)            |
//|  14 Higher-timeframe trend at that closed bar (+1 / 0 / -1)      |
//+------------------------------------------------------------------+
#property version     "9.10"
#property description "TDI-led divergence (green line vs price). Closed bars only, non-repainting."
#property indicator_separate_window
#property indicator_minimum 0
#property indicator_maximum 100
#property indicator_buffers 22
#property indicator_plots   15

#property indicator_label1  "Upper Band"
#property indicator_type1   DRAW_LINE
#property indicator_color1  clrAqua
#property indicator_label2  "Lower Band"
#property indicator_type2   DRAW_LINE
#property indicator_color2  clrAqua
#property indicator_label3  "Market Base"
#property indicator_type3   DRAW_LINE
#property indicator_color3  clrYellow
#property indicator_width3  2
#property indicator_label4  "RSI Price Line"
#property indicator_type4   DRAW_LINE
#property indicator_color4  clrLime
#property indicator_width4  2
#property indicator_label5  "Signal Line"
#property indicator_type5   DRAW_LINE
#property indicator_color5  clrRed
#property indicator_label6  "Sell Signal"
#property indicator_type6   DRAW_ARROW
#property indicator_color6  clrMagenta
#property indicator_width6  2
#property indicator_label7  "Buy Signal"
#property indicator_type7   DRAW_ARROW
#property indicator_color7  clrDeepSkyBlue
#property indicator_width7  2
#property indicator_label8  "Sell SL ref"
#property indicator_type8   DRAW_NONE
#property indicator_label9  "Buy SL ref"
#property indicator_type9   DRAW_NONE
#property indicator_label10 "Signal ID"
#property indicator_type10  DRAW_NONE
#property indicator_label11 "Legs"
#property indicator_type11  DRAW_NONE
#property indicator_label12 "Direction"
#property indicator_type12  DRAW_NONE
#property indicator_label13 "Kind"
#property indicator_type13  DRAW_NONE
#property indicator_label14 "Trend"
#property indicator_type14  DRAW_NONE
#property indicator_label15 "HTF Trend"
#property indicator_type15  DRAW_NONE

#define PFX "TDV9_"
#define KIND_DIV  1
#define KIND_EXH  2
#define KIND_CONT 3

enum ENUM_DIV_SOURCE
{
   SRC_GREEN = 0,   // Green RSI Price Line (default)
   SRC_RED   = 1,   // Red Signal Line
   SRC_BASE  = 2    // Yellow Market Base Line
};

//--- inputs: the EA passes only the "Quick settings" group (first 11 inputs); keep that order
input group "=== Quick settings (the EA sets these, in this order) ==="
input int    InpMaxBars          = 5000;  // Bars to evaluate
input bool   InpDraw             = true;  // Draw objects on the chart
input bool   InpShowPanel        = true;  // Status panel
input bool   InpAlerts           = true;  // Popup alert on confirmed signal
input bool   InpPush             = false; // Phone push on confirmed signal
input bool   InpLogFile          = true;  // CSV log in MQL5\Files
input bool   InpShowStats        = true;  // Show win/loss per signal kind on the panel + stats CSV
input bool   InpAllowExhaustion  = true;  // Allow counter-trend ONLY at TDI exhaustion
input bool            InpUseHTF        = true;           // Use higher-timeframe trend
input bool   InpUseCont          = true;  // Pullback signals in the trend direction
input bool   InpUseDouble        = true;  // Double top/bottom: price about equal, TDI clearly diverging

input group "=== TDI ==="
input int                InpRSIPeriod      = 13;           // RSI period
input ENUM_APPLIED_PRICE InpPrice          = PRICE_CLOSE;  // RSI applied price
input int                InpGreenPeriod    = 2;            // Green (RSI Price Line) period
input ENUM_MA_METHOD     InpGreenMethod    = MODE_SMA;     // Green MA method
input int                InpRedPeriod      = 7;            // Red (Signal Line) period
input ENUM_MA_METHOD     InpRedMethod      = MODE_SMA;     // Red MA method
input int                InpBasePeriod     = 34;           // Yellow (Market Base) period
input ENUM_MA_METHOD     InpBaseMethod     = MODE_SMA;     // Yellow MA method
input int                InpBandPeriod     = 34;           // Volatility band period
input double             InpBandDev        = 1.6185;       // Volatility band deviation
input ENUM_DIV_SOURCE    InpSource         = SRC_GREEN;    // Divergence source line
input int                InpATRPeriod      = 14;           // ATR period (filters only)

input group "=== Swing engine (TDI legs lead) ==="
input int    InpPivLeft          = 5;     // TDI pivot: bars on the left
input int    InpPivRight         = 2;     // TDI pivot: bars on the right (confirmation delay)
input int    InpPriceSep         = 3;     // Max bars between TDI pivot and its price extreme
input int    InpMinSpan          = 5;     // Min bars leg 1 -> last leg
input int    InpMaxSpan          = 100;   // Max bars leg 1 -> last leg
input int    InpMinLegBars       = 3;     // Min bars between counted legs
input int    InpMinLegs          = 2;     // Min legs (2 = leg 2 can signal)
input int    InpMaxLegs          = 4;     // Max legs (4 = up to leg 4 can signal), max 5
input double InpTDITol           = 2.0;   // TDI "equal" tolerance, points (flat TDI vs deeper price counts)
input double InpPriceTolATR      = 0.5;   //   price may stop this x ATR short of leg 1
input double InpDoubleMinTDI     = 3.0;   //   then TDI must be this many points better than leg 1
input bool   InpStrictTDIRise    = false; // Each leg's TDI beyond the previous leg (false = beyond leg 1)
input int    InpConfirmBars      = 6;     // Bars after the last-leg TDI pivot allowed to confirm
input int    InpMaxSignalsPerSeq = 2;     // Max signals from the same leg 1

input group "=== Filters (each one on/off) ==="
input bool   InpUseTDIProm       = true;  // TDI swing prominence
input double InpTDIProm          = 3.0;   //   min TDI swing size (points)
input bool   InpUseMinPriceDiv   = true;  // Min price divergence (rejects flat tops/bottoms)
input double InpMinPriceDivATR   = 0.25;  //   x ATR between leg 1 and last leg
input bool   InpUseMinTDIDiv     = false; // Min TDI divergence
input double InpMinTDIDiv        = 2.0;   //   TDI points between leg 1 and last leg
input bool   InpUsePullback      = false; // Price pullback between leg 1 and last leg
input double InpPullbackATR      = 1.0;   //   x ATR
input bool   InpUseZone          = false; // Leg-1 TDI in zone
input double InpZoneOS           = 40;    //   buy: leg-1 TDI at or below
input double InpZoneOB           = 60;    //   sell: leg-1 TDI at or above
input bool   InpUseBandLeg1      = false; // Leg-1 TDI outside the volatility band
input bool   InpUseGreenDir      = true;  // Confirm: TDI turning in signal direction
input bool   InpUseRedCross      = true;  // Confirm: green above red (buy) / below (sell)
input bool   InpUseBase          = false; // Confirm: green above yellow (buy) / below (sell)
input bool   InpUseCandleDir     = true;  // Confirm: bullish (buy) / bearish (sell) candle
input bool   InpUseCloseBeyond   = false; // Confirm: close beyond the last-leg candle
input bool   InpUseReset         = true;  // One signal per TDI swing: TDI must cross back through ResetLevel
input double InpResetLevel       = 50;    //   level
input bool   InpUseCooldown      = false; // Cooldown between same-direction signals
input int    InpCooldownBars     = 10;    //   bars

input group "=== Trend filter (no trades against a serious trend) ==="
input bool   InpUseTrendFilter   = true;  // Block divergence against the trend
input int    InpTrendEMA         = 50;    // Trend EMA period (close)
input int    InpTrendSlopeBars   = 10;    // EMA slope measured over N bars
input double InpTrendSlopeATR    = 0.6;   // Slope >= this x ATR = trend
input double InpExhOB            = 68;    //   sell: leg-1 TDI at or above
input double InpExhOS            = 32;    //   buy: leg-1 TDI at or below
input int    InpExhMinLegs       = 3;     //   and at least this many legs...
input double InpExhDeepOB        = 75;    //   ...or fewer legs with leg-1 TDI at or above (sell)
input double InpExhDeepOS        = 25;    //   ...or fewer legs with leg-1 TDI at or below (buy)
input bool   InpExhNeedBand      = false; //   leg-1 TDI also outside the volatility band
input bool   InpExhNeedBase      = false; //   confirm also needs green back through yellow (slower)
input bool   InpExhNeedBreak     = true;  //   confirm needs close beyond the swing between the last two legs
input double InpExhMinTDIDiv     = 0;     //   min TDI divergence points (0 = off)
input int    InpExhConfirmBars   = 12;    //   bars allowed to confirm
input bool   InpUseRangeZone     = true;  // No trend: require leg-1 TDI in zone
input double InpRangeOS          = 40;    //   buy: leg-1 TDI at or below
input double InpRangeOB          = 60;    //   sell: leg-1 TDI at or above

input group "=== Serious trend = higher timeframe ==="
input ENUM_TIMEFRAMES InpHTF           = PERIOD_CURRENT; // HTF (current = auto: M1-M15 -> H1, M30/H1 -> H4, else D1)
input int             InpHTFEMA        = 50;             //   HTF EMA period
input int             InpHTFSlopeBars  = 5;              //   HTF EMA slope over N closed HTF bars
input double          InpHTFSlopeATR   = 0.5;            //   slope >= this x HTF ATR = serious trend
input int             InpHTFExhMinLegs = 3;              //   against HTF trend: min legs
input double          InpHTFExhOB      = 70;             //   against HTF trend: sell leg-1 TDI at or above
input double          InpHTFExhOS      = 30;             //   against HTF trend: buy leg-1 TDI at or below

input group "=== Trend continuation (pullback with the trend) ==="
input double InpContBuyMaxTDI    = 45;    //   buy: last-leg TDI at or below (real TDI pullback)
input double InpContSellMinTDI   = 55;    //   sell: last-leg TDI at or above
input double InpContPullbackATR  = 1.0;   //   price pullback from the swing extreme, x ATR

input group "=== Outcome statistics (hindsight, testing only - never used for signals) ==="
input double InpStatSLBufATR     = 0.3;   //   SL = last-leg extreme +/- this x ATR
input double InpStatRR           = 2.0;   //   TP = this x risk

input group "=== Display / alerts / log ==="
input int    InpDrawBars         = 2000;  // Draw objects only for the last N bars
input bool   InpShowPending      = true;  // Show provisional (not yet confirmed) setups
input bool   InpShowRejects      = false; // Diagnostic: label rejected setups with the reason
input bool   InpShowLegLabels    = true;  // Label L1 / L2 / L3
input bool   InpShowVLines       = false; // Vertical lines at last leg and confirm bar
input bool   InpAlertPending     = false; // Also alert provisional setups
input bool   InpPrintRejects     = false; // Print rejected setups to the Experts log (live)
input color  InpBuyColor         = clrDeepSkyBlue;
input color  InpSellColor        = clrMagenta;
input color  InpPendColor        = clrGray;

//--- buffers
double UB[],LB[],YB[],GB[],RB[],SellA[],BuyA[],SellSL[],BuySL[],SigID[],SigLegs[],SigDir[],SigType[],TrendB[];
double HTFB[];
double RSI[],POS[],NEG[],TRB[],ATRB[],EMAT[],HTFS[];

//--- state
struct SPivot
{
   int    type;    // +1 TDI swing high, -1 TDI swing low
   int    bar;     // TDI pivot bar
   int    pbar;    // bar of the matching price extreme
   double val;     // TDI value at pivot
   double price;   // price extreme (high for highs, low for lows)
   int    sigs;    // signals already published with this pivot as leg 1
};

struct SCand
{
   int    dir;          // +1 buy, -1 sell
   int    kind;         // KIND_DIV / KIND_EXH / KIND_CONT
   int    dbl;          // 1 = double top/bottom (price about equal, TDI diverging)
   int    xIdx;         // index of leg 1 in g_piv
   int    legs;
   int    legBar[6];
   int    legPBar[6];
   double legVal[6];
   double legPrice[6];
   int    created;      // bar on which the setup became known
   int    deadline;     // last bar allowed to confirm
};

SPivot g_piv[];  int g_nPiv=0;
SCand  g_pend[]; int g_nPend=0;
int    g_start=0, g_last=-1, g_rates=0, g_win=-1;
int    g_lastSig[2];
bool   g_live=false;
int    g_cntBuy=0, g_cntSell=0, g_cntRej=0;
string g_lastTxt="Last signal: none";
string g_log[];  int g_nLog=0;

//--- higher timeframe
ENUM_TIMEFRAMES g_htf=PERIOD_H1;
bool     g_useHTF=false;
int      g_hHTFma=INVALID_HANDLE, g_hHTFatr=INVALID_HANDLE, g_hN=0;
double   g_hMA[], g_hATR[];

//--- outcome statistics (hindsight)
struct SSig
{
   int    bar, dir, kind, dbl, legs, res, lastChk;   // res: 0 open, 1 win, -1 loss, -2 invalid
   double v1, vN, slope, hslope, band1, sl, entry, tp;
};
SSig g_sig[]; int g_nSig=0;

//+------------------------------------------------------------------+
int IMax(int a,int b) { return(a>b ? a : b); }
int IMin(int a,int b) { return(a<b ? a : b); }
int DI(int dir)       { return(dir>0 ? 0 : 1); }
string TS(datetime t) { return(TimeToString(t,TIME_DATE|TIME_MINUTES)); }
string TFStr()        { return(StringSubstr(EnumToString((ENUM_TIMEFRAMES)_Period),7)); }

int WarmBars()
{
   return(InpRSIPeriod+IMax(IMax(InpGreenPeriod,InpRedPeriod),IMax(InpBasePeriod,InpBandPeriod))+
          IMax(InpATRPeriod,InpTrendEMA+InpTrendSlopeBars)+2);
}

double Src(int i)
{
   if(InpSource==SRC_RED)  return(RB[i]);
   if(InpSource==SRC_BASE) return(YB[i]);
   return(GB[i]);
}

//+------------------------------------------------------------------+
int OnInit()
{
   if(InpRSIPeriod<2 || InpGreenPeriod<1 || InpRedPeriod<1 || InpBasePeriod<1 || InpBandPeriod<2 ||
      InpATRPeriod<1 || InpPivLeft<1 || InpPivRight<1 || InpPriceSep<0 || InpConfirmBars<InpPivRight ||
      InpMinLegs<2 || InpMaxLegs<InpMinLegs || InpMaxLegs>5 || InpMinSpan<1 || InpMaxSpan<=InpMinSpan ||
      InpMinLegBars<1 || InpMaxSignalsPerSeq<1 || InpMaxBars<InpMaxSpan ||
      InpTrendEMA<2 || InpTrendSlopeBars<1 || InpExhConfirmBars<InpPivRight || InpTDITol<0 || InpExhMinLegs<2 ||
      InpPriceTolATR<0 || InpDoubleMinTDI<0)
   {
      Print("TDI Div Pro: invalid inputs (check periods, legs 2..5, ConfirmBars >= PivRight, MaxSpan > MinSpan)");
      return(INIT_PARAMETERS_INCORRECT);
   }

   SetIndexBuffer(0, UB,     INDICATOR_DATA);
   SetIndexBuffer(1, LB,     INDICATOR_DATA);
   SetIndexBuffer(2, YB,     INDICATOR_DATA);
   SetIndexBuffer(3, GB,     INDICATOR_DATA);
   SetIndexBuffer(4, RB,     INDICATOR_DATA);
   SetIndexBuffer(5, SellA,  INDICATOR_DATA);
   SetIndexBuffer(6, BuyA,   INDICATOR_DATA);
   SetIndexBuffer(7, SellSL, INDICATOR_DATA);
   SetIndexBuffer(8, BuySL,  INDICATOR_DATA);
   SetIndexBuffer(9, SigID,  INDICATOR_DATA);
   SetIndexBuffer(10,SigLegs,INDICATOR_DATA);
   SetIndexBuffer(11,SigDir, INDICATOR_DATA);
   SetIndexBuffer(12,SigType,INDICATOR_DATA);
   SetIndexBuffer(13,TrendB, INDICATOR_DATA);
   SetIndexBuffer(14,HTFB,   INDICATOR_DATA);
   SetIndexBuffer(15,RSI,    INDICATOR_CALCULATIONS);
   SetIndexBuffer(16,POS,    INDICATOR_CALCULATIONS);
   SetIndexBuffer(17,NEG,    INDICATOR_CALCULATIONS);
   SetIndexBuffer(18,TRB,    INDICATOR_CALCULATIONS);
   SetIndexBuffer(19,ATRB,   INDICATOR_CALCULATIONS);
   SetIndexBuffer(20,EMAT,   INDICATOR_CALCULATIONS);
   SetIndexBuffer(21,HTFS,   INDICATOR_CALCULATIONS);

   PlotIndexSetInteger(5,PLOT_ARROW,234);
   PlotIndexSetInteger(6,PLOT_ARROW,233);
   PlotIndexSetInteger(5,PLOT_LINE_COLOR,InpSellColor);
   PlotIndexSetInteger(6,PLOT_LINE_COLOR,InpBuyColor);
   for(int p=0;p<15;p++) PlotIndexSetDouble(p,PLOT_EMPTY_VALUE,EMPTY_VALUE);
   for(int p=0;p<5;p++)  PlotIndexSetInteger(p,PLOT_DRAW_BEGIN,WarmBars());

   IndicatorSetString(INDICATOR_SHORTNAME,"TDI Div Pro v9.1");
   IndicatorSetInteger(INDICATOR_DIGITS,2);
   IndicatorSetInteger(INDICATOR_LEVELS,3);
   IndicatorSetDouble(INDICATOR_LEVELVALUE,0,32);
   IndicatorSetDouble(INDICATOR_LEVELVALUE,1,50);
   IndicatorSetDouble(INDICATOR_LEVELVALUE,2,68);
   IndicatorSetInteger(INDICATOR_LEVELCOLOR,clrDimGray);
   IndicatorSetInteger(INDICATOR_LEVELSTYLE,STYLE_DOT);

   g_lastSig[0]=-1000000; g_lastSig[1]=-1000000;

   g_htf=InpHTF;
   if(g_htf==PERIOD_CURRENT)
   {
      int sec=PeriodSeconds(_Period);
      g_htf=(sec<=900 ? PERIOD_H1 : (sec<=3600 ? PERIOD_H4 : PERIOD_D1));
   }
   g_useHTF=(InpUseHTF && PeriodSeconds(g_htf)>PeriodSeconds(_Period));
   if(InpUseHTF && !g_useHTF) Print("TDI Div Pro: HTF must be higher than the chart timeframe - HTF filter off");
   if(g_useHTF)
   {
      g_hHTFma =iMA(_Symbol,g_htf,InpHTFEMA,0,MODE_EMA,PRICE_CLOSE);
      g_hHTFatr=iATR(_Symbol,g_htf,InpATRPeriod);
      if(g_hHTFma==INVALID_HANDLE || g_hHTFatr==INVALID_HANDLE)
      { Print("TDI Div Pro: cannot create HTF handles"); return(INIT_FAILED); }
   }
   return(INIT_SUCCEEDED);
}

void OnDeinit(const int reason)
{
   if(InpDraw) ObjectsDeleteAll(0,PFX);
   if(g_hHTFma!=INVALID_HANDLE)  IndicatorRelease(g_hHTFma);
   if(g_hHTFatr!=INVALID_HANDLE) IndicatorRelease(g_hHTFatr);
}

//+------------------------------------------------------------------+
//| Higher timeframe (serious trend) - closed HTF bars only          |
//+------------------------------------------------------------------+
string HTFName() { return(StringSubstr(EnumToString(g_htf),7)); }

bool LoadHTF()
{
   if(!g_useHTF) return(true);
   int n=IMin(BarsCalculated(g_hHTFma),BarsCalculated(g_hHTFatr));
   if(n<=InpHTFSlopeBars+2) return(false);
   n=IMin(n,20000);
   ArraySetAsSeries(g_hMA,true); ArraySetAsSeries(g_hATR,true);
   if(CopyBuffer(g_hHTFma,0,0,n,g_hMA)<n || CopyBuffer(g_hHTFatr,0,0,n,g_hATR)<n) return(false);
   g_hN=n;
   return(true);
}

// trend of the last HTF bar that was CLOSED when chart bar c opened
int HTFTrendCalc(datetime tc,double &slope)
{
   slope=0;
   if(!g_useHTF || g_hN<=0) return(0);
   int sh=iBarShift(_Symbol,g_htf,tc,false);
   if(sh<0) return(0);
   int j=sh+1, k=j+InpHTFSlopeBars;
   if(k>=g_hN || g_hATR[j]<=0) return(0);
   slope=(g_hMA[j]-g_hMA[k])/g_hATR[j];
   if(slope>= InpHTFSlopeATR) return(1);
   if(slope<=-InpHTFSlopeATR) return(-1);
   return(0);
}

//+------------------------------------------------------------------+
//| TDI calculation                                                  |
//+------------------------------------------------------------------+
double AP(int i,const double &o[],const double &h[],const double &l[],const double &c[])
{
   switch(InpPrice)
   {
      case PRICE_OPEN:     return(o[i]);
      case PRICE_HIGH:     return(h[i]);
      case PRICE_LOW:      return(l[i]);
      case PRICE_MEDIAN:   return((h[i]+l[i])/2.0);
      case PRICE_TYPICAL:  return((h[i]+l[i]+c[i])/3.0);
      case PRICE_WEIGHTED: return((h[i]+l[i]+2.0*c[i])/4.0);
      default:             return(c[i]);
   }
}

double MAAt(const double &src[],const double &dst[],int i,int period,ENUM_MA_METHOD m)
{
   if(i<period-1) return(src[i]);
   if(period==1)  return(src[i]);
   double s=0;
   switch(m)
   {
      case MODE_EMA:
      {
         if(i==period-1) { for(int k=0;k<period;k++) s+=src[i-k]; return(s/period); }
         double a=2.0/(period+1.0);
         return(dst[i-1]+a*(src[i]-dst[i-1]));
      }
      case MODE_SMMA:
      {
         if(i==period-1) { for(int k=0;k<period;k++) s+=src[i-k]; return(s/period); }
         return((dst[i-1]*(period-1)+src[i])/period);
      }
      case MODE_LWMA:
      {
         double w=0;
         for(int k=0;k<period;k++) { double wt=period-k; s+=src[i-k]*wt; w+=wt; }
         return(s/w);
      }
      default:
      {
         for(int k=0;k<period;k++) s+=src[i-k];
         return(s/period);
      }
   }
}

void CalcTDI(int from,int total,const double &o[],const double &h[],const double &l[],const double &c[])
{
   int n=InpRSIPeriod;
   for(int i=from;i<total;i++)
   {
      //--- RSI (Wilder smoothing, same as MT5 iRSI)
      if(i<n) { POS[i]=0.0; NEG[i]=0.0; }
      else if(i==n)
      {
         double su=0,sd=0;
         for(int k=1;k<=n;k++)
         {
            double d=AP(k,o,h,l,c)-AP(k-1,o,h,l,c);
            if(d>0) su+=d; else sd-=d;
         }
         POS[i]=su/n; NEG[i]=sd/n;
      }
      else
      {
         double d=AP(i,o,h,l,c)-AP(i-1,o,h,l,c);
         POS[i]=(POS[i-1]*(n-1)+(d>0 ? d : 0.0))/n;
         NEG[i]=(NEG[i-1]*(n-1)+(d<0 ? -d : 0.0))/n;
      }
      if(i<n) RSI[i]=50.0;
      else if(NEG[i]!=0.0) RSI[i]=100.0-100.0/(1.0+POS[i]/NEG[i]);
      else RSI[i]=(POS[i]!=0.0 ? 100.0 : 50.0);

      //--- TDI lines
      GB[i]=MAAt(RSI,GB,i,InpGreenPeriod,InpGreenMethod);
      RB[i]=MAAt(RSI,RB,i,InpRedPeriod,InpRedMethod);
      YB[i]=MAAt(RSI,YB,i,InpBasePeriod,InpBaseMethod);
      if(i>=InpBandPeriod-1)
      {
         double s=0,v=0;
         for(int k=0;k<InpBandPeriod;k++) s+=RSI[i-k];
         double mean=s/InpBandPeriod;
         for(int k=0;k<InpBandPeriod;k++) v+=(RSI[i-k]-mean)*(RSI[i-k]-mean);
         double sd=MathSqrt(v/InpBandPeriod);
         UB[i]=mean+InpBandDev*sd;
         LB[i]=mean-InpBandDev*sd;
      }
      else { UB[i]=RSI[i]; LB[i]=RSI[i]; }

      //--- ATR (simple average of true range, same as MT5 iATR)
      TRB[i]=(i==0) ? h[i]-l[i] : MathMax(h[i],c[i-1])-MathMin(l[i],c[i-1]);
      int p=IMin(InpATRPeriod,i+1);
      double st=0;
      for(int k=0;k<p;k++) st+=TRB[i-k];
      ATRB[i]=st/p;

      //--- trend EMA on close
      EMAT[i]=MAAt(c,EMAT,i,InpTrendEMA,MODE_EMA);

      //--- signal buffers of bars not yet evaluated are always empty
      if(i>g_last)
      {
         SellA[i]=EMPTY_VALUE; BuyA[i]=EMPTY_VALUE; SellSL[i]=EMPTY_VALUE; BuySL[i]=EMPTY_VALUE;
         SigID[i]=EMPTY_VALUE; SigLegs[i]=EMPTY_VALUE; SigDir[i]=EMPTY_VALUE;
         SigType[i]=EMPTY_VALUE; TrendB[i]=EMPTY_VALUE; HTFB[i]=EMPTY_VALUE;
      }
   }
}

//+------------------------------------------------------------------+
//| Trend (closed bar c only)                                        |
//+------------------------------------------------------------------+
double TrendSlope(int c)
{
   if(c-InpTrendSlopeBars<0 || ATRB[c]<=0) return(0);
   return((EMAT[c]-EMAT[c-InpTrendSlopeBars])/ATRB[c]);
}

int TrendAt(int c)
{
   double s=TrendSlope(c);
   if(s>= InpTrendSlopeATR) return(1);
   if(s<=-InpTrendSlopeATR) return(-1);
   return(0);
}

string TrendName(int tr) { return(tr>0 ? "UP" : (tr<0 ? "DOWN" : "NONE")); }
string KindName(int k)   { return(k==KIND_EXH ? "EXH" : (k==KIND_CONT ? "CONT" : "DIV")); }

// "" = leg 1 is a true TDI exhaustion extreme, otherwise the reason
string ExhaustionMiss(const SCand &cd)
{
   double v=cd.legVal[0];
   int    b=cd.legBar[0];
   if(cd.dir>0 && v>InpExhOS) return(StringFormat("leg-1 TDI %.1f > %.0f",v,InpExhOS));
   if(cd.dir<0 && v<InpExhOB) return(StringFormat("leg-1 TDI %.1f < %.0f",v,InpExhOB));
   if(cd.legs<InpExhMinLegs)
   {
      if(cd.dir>0 && v>InpExhDeepOS) return(StringFormat("%d legs needs leg-1 TDI <= %.0f (%.1f)",cd.legs,InpExhDeepOS,v));
      if(cd.dir<0 && v<InpExhDeepOB) return(StringFormat("%d legs needs leg-1 TDI >= %.0f (%.1f)",cd.legs,InpExhDeepOB,v));
   }
   if(InpExhNeedBand && (cd.dir>0 ? v>LB[b] : v<UB[b])) return("leg-1 TDI inside the band");
   if(InpExhMinTDIDiv>0 && (cd.legVal[cd.legs-1]-v)*cd.dir<InpExhMinTDIDiv)
      return(StringFormat("TDI divergence %.1f < %.1f",(cd.legVal[cd.legs-1]-v)*cd.dir,InpExhMinTDIDiv));
   return("");
}

// "" = allowed against the higher-timeframe trend, otherwise the reason
string HTFExhMiss(const SCand &cd)
{
   double v=cd.legVal[0];
   if(cd.legs<InpHTFExhMinLegs) return(StringFormat("%d legs < %d",cd.legs,InpHTFExhMinLegs));
   if(cd.dir>0 && v>InpHTFExhOS) return(StringFormat("leg-1 TDI %.1f > %.0f",v,InpHTFExhOS));
   if(cd.dir<0 && v<InpHTFExhOB) return(StringFormat("leg-1 TDI %.1f < %.0f",v,InpHTFExhOB));
   return("");
}

//+------------------------------------------------------------------+
//| Swing engine                                                     |
//+------------------------------------------------------------------+
// +1 TDI swing high, -1 TDI swing low, 0 none. Uses bars q-Left .. q+Right only.
int PivotType(int q)
{
   double v=Src(q);
   bool isH=true, isL=true;
   for(int k=1;k<=InpPivLeft;k++)
   {
      double s=Src(q-k);
      if(!(v>s)) isH=false;
      if(!(v<s)) isL=false;
   }
   for(int k=1;k<=InpPivRight;k++)
   {
      double s=Src(q+k);
      if(!(v>=s)) isH=false;
      if(!(v<=s)) isL=false;
   }
   if(isH) return(1);
   if(isL) return(-1);
   return(0);
}

// TDI must have moved at least InpTDIProm points since the previous pivot of the same type
bool Prominent(int type,int q)
{
   if(!InpUseTDIProm) return(true);
   int from=IMax(g_start,q-InpMaxSpan);
   for(int k=g_nPiv-1;k>=0;k--)
      if(g_piv[k].type==type) { from=IMax(from,g_piv[k].bar); break; }
   double v=Src(q), ext=v;
   for(int k=from;k<q;k++)
   {
      double s=Src(k);
      if(type<0 && s>ext) ext=s;
      if(type>0 && s<ext) ext=s;
   }
   return(MathAbs(ext-v)>=InpTDIProm);
}

// price extreme within InpPriceSep bars of the TDI pivot, never beyond the current bar c
int PriceMatch(int type,int q,int c,const double &h[],const double &l[])
{
   int a=IMax(0,q-InpPriceSep), b=IMin(c,q+InpPriceSep), best=q;
   for(int k=a;k<=b;k++)
   {
      if(type>0 && h[k]>h[best]) best=k;
      if(type<0 && l[k]<l[best]) best=k;
   }
   return(best);
}

int AddPivot(int type,int bar,int pbar,double val,double price)
{
   ArrayResize(g_piv,g_nPiv+1,1024);
   g_piv[g_nPiv].type=type;   g_piv[g_nPiv].bar=bar;     g_piv[g_nPiv].pbar=pbar;
   g_piv[g_nPiv].val=val;     g_piv[g_nPiv].price=price; g_piv[g_nPiv].sigs=0;
   g_nPiv++;
   return(g_nPiv-1);
}

// no price beyond 'price' between bars from..to (buy: no lower low, sell: no higher high)
bool PriceDeepest(int dir,double price,int from,int to,const double &h[],const double &l[])
{
   for(int k=from;k<=to;k++)
   {
      if(dir>0 && l[k]<price) return(false);
      if(dir<0 && h[k]>price) return(false);
   }
   return(true);
}

// TDI never went beyond 'val' after bar 'from' up to bar 'to' (buy: never lower, sell: never higher)
bool TDIExtreme(int dir,double val,int from,int to)
{
   for(int k=from+1;k<=to;k++)
      if((Src(k)-val)*dir<0) return(false);
   return(true);
}

void SetLeg(SCand &cd,int n,const SPivot &p)
{
   cd.legBar[n]=p.bar; cd.legPBar[n]=p.pbar; cd.legVal[n]=p.val; cd.legPrice[n]=p.price;
}

string CandId(const SCand &cd,const datetime &t[])
{
   return((cd.dir>0 ? "B" : "S")+IntegerToString((long)t[cd.legBar[cd.legs-1]]));
}

//+------------------------------------------------------------------+
//| A new TDI pivot N appeared: look for leg 1 and count the legs    |
//+------------------------------------------------------------------+
bool BuildCandidate(int dir,int nIdx,int c,const datetime &t[],const double &h[],const double &l[])
{
   int    ptype=-dir;                 // buy uses TDI lows, sell uses TDI highs
   SPivot N=g_piv[nIdx];
   int    best=-1;

   for(int k=nIdx-1;k>=0;k--)
   {
      if(g_piv[k].type!=ptype) continue;
      int span=N.bar-g_piv[k].bar;
      if(span>InpMaxSpan) break;
      if(span<InpMinSpan) continue;
      double deeper =(g_piv[k].price-N.price)*dir;             // > 0: last leg is beyond leg 1 in price
      double tdiGain=(N.val-g_piv[k].val)*dir;                 // > 0: TDI holds better than leg 1
      double atrN   =ATRB[N.pbar];
      bool classic=(deeper>0 && (!InpUseMinPriceDiv || deeper>=InpMinPriceDivATR*atrN) && tdiGain>=-InpTDITol);
      bool dbl    =(!classic && InpUseDouble && deeper>-InpPriceTolATR*atrN && tdiGain>=InpDoubleMinTDI);
      if(!classic && !dbl) continue;
      if(!PriceDeepest(dir,N.price,g_piv[k].pbar+1,c,h,l)) continue; // last leg is the deepest price after leg 1
      if(!TDIExtreme(dir,g_piv[k].val-dir*InpTDITol,g_piv[k].bar,c)) continue; // TDI never clearly beyond leg 1 since
      if(best<0 || (g_piv[k].val-g_piv[best].val)*dir<=0) best=k;  // deepest TDI leg 1, ties -> older
   }
   if(best<0) return(false);                                  // no divergence

   SCand cd;
   ZeroMemory(cd);
   cd.dir=dir; cd.kind=KIND_DIV; cd.xIdx=best; cd.created=c; cd.deadline=N.bar+InpConfirmBars;
   cd.dbl=((g_piv[best].price-N.price)*dir>0 ? 0 : 1);
   SetLeg(cd,0,g_piv[best]);
   cd.legs=1;

   //--- intermediate legs: each deeper in price, TDI still beyond leg 1 (or previous leg if strict)
   for(int k=best+1;k<nIdx;k++)
   {
      if(g_piv[k].type!=ptype || cd.legs>=5) continue;
      int li=cd.legs-1;
      if(g_piv[k].bar-cd.legBar[li]<InpMinLegBars) continue;
      if((cd.legPrice[li]-g_piv[k].price)*dir<=0) continue;
      if((g_piv[k].price-N.price)*dir<=0)         continue;
      double ref=InpStrictTDIRise ? cd.legVal[li] : cd.legVal[0];
      if((g_piv[k].val-ref)*dir<-InpTDITol)       continue;
      SetLeg(cd,cd.legs,g_piv[k]);
      cd.legs++;
   }
   while(cd.legs>1 && (N.bar-cd.legBar[cd.legs-1]<InpMinLegBars ||
         (InpStrictTDIRise && (N.val-cd.legVal[cd.legs-1])*dir<-InpTDITol)))
      cd.legs--;
   SetLeg(cd,cd.legs,N);
   cd.legs++;

   //--- structural filters
   string why="";
   if(cd.legs<InpMinLegs)
      why=StringFormat("legs %d < min %d",cd.legs,InpMinLegs);
   else if(cd.legs>InpMaxLegs)
      why=StringFormat("legs %d > max %d",cd.legs,InpMaxLegs);
   else if(InpUseMinTDIDiv && (N.val-cd.legVal[0])*dir<InpMinTDIDiv)
      why=StringFormat("TDI divergence %.1f < %.1f",(N.val-cd.legVal[0])*dir,InpMinTDIDiv);
   else if(InpUseZone && (dir>0 ? cd.legVal[0]>InpZoneOS : cd.legVal[0]<InpZoneOB))
      why=StringFormat("leg-1 TDI %.1f not in zone",cd.legVal[0]);
   else if(InpUseBandLeg1 && (dir>0 ? cd.legVal[0]>LB[cd.legBar[0]] : cd.legVal[0]<UB[cd.legBar[0]]))
      why="leg-1 TDI inside the band";
   else if(InpUsePullback)
   {
      double pb=0;
      for(int k=cd.legPBar[0];k<=N.pbar;k++)
      {
         double m=(dir>0) ? h[k]-cd.legPrice[0] : cd.legPrice[0]-l[k];
         if(m>pb) pb=m;
      }
      if(pb<InpPullbackATR*ATRB[N.pbar])
         why=StringFormat("pullback %.2f ATR < %.2f",pb/MathMax(ATRB[N.pbar],_Point),InpPullbackATR);
   }
   if(why=="" && g_piv[best].sigs>=InpMaxSignalsPerSeq)
      why="signal limit for this leg 1 reached";

   //--- trend: against the trend only as an exhaustion reversal
   int tr=TrendAt(c);
   if(why=="" && InpUseTrendFilter && tr==-dir)
   {
      string ex=ExhaustionMiss(cd);
      if(!InpAllowExhaustion)  why="against trend "+TrendName(tr);
      else if(ex!="")          why="against trend "+TrendName(tr)+" ("+ex+")";
      else { cd.kind=KIND_EXH; cd.deadline=N.bar+InpExhConfirmBars; }
   }
   if(why=="" && InpUseTrendFilter && tr==0 && InpUseRangeZone &&
      (dir>0 ? cd.legVal[0]>InpRangeOS : cd.legVal[0]<InpRangeOB))
      why=StringFormat("no trend: leg-1 TDI %.1f not in %s zone",cd.legVal[0],dir>0 ? "buy" : "sell");
   if(why=="" && g_useHTF && (int)HTFB[c]==-dir)
   {
      string m=HTFExhMiss(cd);
      if(m!="") why="against "+HTFName()+" trend "+TrendName((int)HTFB[c])+" ("+m+")";
      else { cd.kind=KIND_EXH; cd.deadline=N.bar+InpExhConfirmBars; }
   }

   if(why!="") { Reject(cd,c,why,t,h,l); return(true); }
   AddPending(cd,c,t,h,l);
   return(true);
}

//+------------------------------------------------------------------+
//| Trend continuation: in an uptrend the TDI AND price both make a  |
//| higher low after a real pullback (mirror for downtrend)          |
//+------------------------------------------------------------------+
void BuildCont(int dir,int nIdx,int c,const datetime &t[],const double &h[],const double &l[])
{
   if(!InpUseCont || TrendAt(c)!=dir) return;
   if(g_useHTF && (int)HTFB[c]==-dir) return;
   SPivot N=g_piv[nIdx];
   if(dir>0 ? N.val>InpContBuyMaxTDI : N.val<InpContSellMinTDI) return;   // TDI did not pull back

   int x=-1;
   for(int k=nIdx-1;k>=0;k--)
   {
      if(g_piv[k].type!=-dir) continue;
      int span=N.bar-g_piv[k].bar;
      if(span>InpMaxSpan) break;
      if(span<InpMinSpan) continue;
      x=k; break;                                       // the previous TDI swing of the same type
   }
   if(x<0) return;
   SPivot X=g_piv[x];
   if((N.val-X.val)*dir<=0)     return;                 // TDI higher low (buy) / lower high (sell)
   if((N.price-X.price)*dir<=0) return;                 // price holds: higher low (buy) / lower high (sell)
   if(!PriceDeepest(dir,N.price,N.pbar,c,h,l)) return;  // no deeper price since the last leg

   double pb=0;                                         // pullback from the swing extreme to the last leg
   for(int k=X.pbar;k<=N.pbar;k++)
   {
      double m=(dir>0) ? h[k]-N.price : N.price-l[k];
      if(m>pb) pb=m;
   }
   if(pb<InpContPullbackATR*ATRB[N.pbar]) return;

   SCand cd;
   ZeroMemory(cd);
   cd.dir=dir; cd.kind=KIND_CONT; cd.xIdx=x; cd.created=c; cd.deadline=N.bar+InpConfirmBars;
   SetLeg(cd,0,X);
   SetLeg(cd,1,N);
   cd.legs=2;
   if(g_piv[x].sigs>=InpMaxSignalsPerSeq) { Reject(cd,c,"signal limit for this leg 1 reached",t,h,l); return; }
   AddPending(cd,c,t,h,l);
}

void AddPending(const SCand &cd,int c,const datetime &t[],const double &h[],const double &l[])
{
   ArrayResize(g_pend,g_nPend+1,16);
   g_pend[g_nPend]=cd;
   g_nPend++;
   LogEvent("PENDING",cd,c,"",t);
   if(InpShowPending && CanDraw(c)) DrawSetup(cd,c,t,h,l,true);
   if(g_live && InpAlertPending)
      Notify(StringFormat("%s %s %s %s setup (L%d) - waiting for confirmation",_Symbol,TFStr(),cd.dir>0?"BUY":"SELL",KindName(cd.kind),cd.legs));
}

//+------------------------------------------------------------------+
//| Confirmation                                                     |
//+------------------------------------------------------------------+
// one signal per TDI swing: since the previous same-direction signal the TDI crossed back through the reset level
bool ResetOK(int d,int c)
{
   int last=g_lastSig[DI(d)];
   if(!InpUseReset || last<0) return(true);
   for(int k=last+1;k<=c;k++)
      if((Src(k)-InpResetLevel)*d>0) return(true);
   return(false);
}

string ConfirmMiss(const SCand &cd,int c,bool needBase,bool needBreak,const double &o[],const double &h[],const double &l[],const double &cl[])
{
   int d=cd.dir;
   if(needBreak && cd.legs>=2)
   {
      int a=cd.legPBar[cd.legs-2], b=cd.legPBar[cd.legs-1];
      double lvl=(d>0) ? -DBL_MAX : DBL_MAX;
      for(int k=a;k<=b;k++) { if(d>0 && h[k]>lvl) lvl=h[k]; if(d<0 && l[k]<lvl) lvl=l[k]; }
      if(d>0 ? cl[c]<=lvl : cl[c]>=lvl) return("no close beyond the swing between the last legs");
   }
   if(InpUseGreenDir  && (Src(c)-Src(c-1))*d<=0) return("TDI not turning");
   if(InpUseRedCross  && (GB[c]-RB[c])*d<=0)     return(d>0 ? "green below red" : "green above red");
   if((InpUseBase || needBase) && (GB[c]-YB[c])*d<=0) return(d>0 ? "green below base" : "green above base");
   if(InpUseCandleDir && (cl[c]-o[c])*d<=0)      return(d>0 ? "candle not bullish" : "candle not bearish");
   if(InpUseCloseBeyond)
   {
      int pb=cd.legPBar[cd.legs-1];
      if(d>0 ? cl[c]<=h[pb] : cl[c]>=l[pb])      return("close not beyond the leg candle");
   }
   return("");
}

void RemovePending(int i)
{
   for(int j=i;j<g_nPend-1;j++) g_pend[j]=g_pend[j+1];
   g_nPend--;
   ArrayResize(g_pend,g_nPend,16);
}

void CheckPending(int c,const datetime &t[],const double &o[],const double &h[],const double &l[],const double &cl[])
{
   for(int i=g_nPend-1;i>=0;i--)
   {
      SCand cd=g_pend[i];
      int   d=cd.dir, li=cd.legs-1;
      string why="";
      bool  confirm=false;

      if(c>cd.created)
      {
         if(d>0 ? l[c]<cd.legPrice[li] : h[c]>cd.legPrice[li])
            why="price made a new extreme before confirmation";
         else if((Src(c)-cd.legVal[0])*d<-(cd.kind==KIND_CONT ? 0.0 : InpTDITol))
            why="TDI broke the leg-1 level";
      }
      //--- trend on the decision bar
      bool needBase=false, needBreak=false;
      if(why=="" && InpUseTrendFilter)
      {
         int tr=TrendAt(c);
         if(cd.kind==KIND_CONT && tr!=d)
            why="trend no longer "+TrendName(d);
         else if(cd.kind!=KIND_CONT && tr==-d)
         {
            if(cd.kind==KIND_EXH || (InpAllowExhaustion && ExhaustionMiss(cd)==""))
            { cd.kind=KIND_EXH; needBase=InpExhNeedBase; needBreak=InpExhNeedBreak; }
            else why="trend turned "+TrendName(tr);
         }
      }
      if(why=="" && g_useHTF && (int)HTFB[c]==-d)
      {
         if(cd.kind==KIND_CONT) why=HTFName()+" trend against";
         else
         {
            string m=HTFExhMiss(cd);
            if(m!="") why="against "+HTFName()+" trend ("+m+")";
            else cd.kind=KIND_EXH;
         }
      }
      if(cd.kind==KIND_EXH) { needBase=InpExhNeedBase; needBreak=InpExhNeedBreak; }
      if(why=="")
      {
         string miss=ConfirmMiss(cd,c,needBase,needBreak,o,h,l,cl);
         if(miss=="")
         {
            if(InpUseCooldown && c-g_lastSig[DI(d)]<InpCooldownBars) why="cooldown";
            else if(SigDir[c]!=EMPTY_VALUE)                          why="another signal on this bar";
            else if(!ResetOK(d,c))                                   why="TDI has not reset through "+DoubleToString(InpResetLevel,0)+" since the last signal";
            else if(g_piv[cd.xIdx].sigs>=InpMaxSignalsPerSeq)        why="signal limit for this leg 1 reached";
            else confirm=true;
         }
         else if(c>=cd.deadline || (cd.kind!=KIND_EXH && c>=cd.legBar[li]+InpConfirmBars))
            why="not confirmed within "+IntegerToString(cd.deadline-cd.legBar[li])+" bars ("+miss+")";
         else
            continue;                                   // still waiting
      }
      RemovePending(i);
      if(confirm) Publish(cd,c,t,h,l);
      else        Reject(cd,c,why,t,h,l);
   }
}

void Publish(const SCand &cd,int c,const datetime &t[],const double &h[],const double &l[])
{
   int d=cd.dir, li=cd.legs-1;
   if(d>0) { BuyA[c]=MathMax(GB[c]-8.0,2.0);  BuySL[c]=cd.legPrice[li];  g_cntBuy++;  }
   else    { SellA[c]=MathMin(GB[c]+8.0,98.0); SellSL[c]=cd.legPrice[li]; g_cntSell++; }
   SigID[c]=(double)(long)t[cd.legBar[li]];
   SigLegs[c]=cd.legs;
   SigDir[c]=d;
   SigType[c]=cd.kind;
   g_piv[cd.xIdx].sigs++;
   g_lastSig[DI(d)]=c;
   AddStat(cd,c);

   string side=(d>0 ? "BUY" : "SELL");
   g_lastTxt=StringFormat("Last: %s %s L%d confirmed %s, entry from %s",side,KindName(cd.kind),cd.legs,TS(t[c]),TS(t[c]+PeriodSeconds()));
   LogEvent("SIGNAL",cd,c,"",t);

   string id=CandId(cd,t);
   if(InpDraw) ObjectsDeleteAll(0,PFX+"P_"+id);
   if(CanDraw(c)) DrawSetup(cd,c,t,h,l,false);

   if(g_live)
   {
      string msg=StringFormat("%s %s CONFIRMED %s %s L%d | SL ref %s | entry from %s",
                              _Symbol,TFStr(),side,KindName(cd.kind),cd.legs,DoubleToString(cd.legPrice[li],_Digits),TS(t[c]+PeriodSeconds()));
      Print(msg);
      Notify(msg);
   }
}

void Reject(const SCand &cd,int c,string why,const datetime &t[],const double &h[],const double &l[])
{
   g_cntRej++;
   LogEvent("REJECT",cd,c,why,t);
   string id=CandId(cd,t);
   if(InpDraw) ObjectsDeleteAll(0,PFX+"P_"+id);
   if(InpShowRejects && CanDraw(c))
   {
      int li=cd.legs-1;
      ObjText(PFX+"R_"+id,0,t[cd.legPBar[li]],cd.legPrice[li],"x "+why,clrGray,
              cd.dir>0 ? ANCHOR_UPPER : ANCHOR_LOWER,7,LegDetail(cd,t));
   }
   if(g_live && InpPrintRejects)
      Print(StringFormat("%s %s %s %s rejected: %s",_Symbol,TFStr(),cd.dir>0?"BUY":"SELL",KindName(cd.kind),why));
}

//+------------------------------------------------------------------+
//| One closed bar, processed exactly once, in time order            |
//+------------------------------------------------------------------+
void ProcessBar(int c,const datetime &t[],const double &o[],const double &h[],const double &l[],const double &cl[])
{
   double hs=0;
   HTFB[c]=HTFTrendCalc(t[c],hs);
   HTFS[c]=hs;
   int q=c-InpPivRight;
   if(q-InpPivLeft>=g_start)
   {
      int type=PivotType(q);
      if(type!=0 && Prominent(type,q))
      {
         int pb =PriceMatch(type,q,c,h,l);
         int idx=AddPivot(type,q,pb,Src(q),type>0 ? h[pb] : l[pb]);
         int dir=(type>0 ? -1 : 1);
         if(!BuildCandidate(dir,idx,c,t,h,l)) BuildCont(dir,idx,c,t,h,l);
      }
   }
   CheckPending(c,t,o,h,l,cl);
   TrendB[c]=TrendAt(c);
}

//+------------------------------------------------------------------+
//| Outcome statistics (hindsight only, for testing)                 |
//+------------------------------------------------------------------+
void AddStat(const SCand &cd,int c)
{
   ArrayResize(g_sig,g_nSig+1,256);
   int i=g_nSig++, d=cd.dir, b0=cd.legBar[0];
   g_sig[i].bar=c; g_sig[i].dir=d; g_sig[i].kind=cd.kind; g_sig[i].dbl=cd.dbl; g_sig[i].legs=cd.legs;
   g_sig[i].res=0; g_sig[i].lastChk=c; g_sig[i].entry=0; g_sig[i].tp=0;
   g_sig[i].v1=cd.legVal[0]; g_sig[i].vN=cd.legVal[cd.legs-1];
   g_sig[i].slope=TrendSlope(c); g_sig[i].hslope=HTFS[c];
   g_sig[i].band1=(d>0 ? LB[b0]-cd.legVal[0] : cd.legVal[0]-UB[b0]);   // > 0 = outside the band
   g_sig[i].sl=cd.legPrice[cd.legs-1]-d*InpStatSLBufATR*ATRB[c];
}

bool UpdateStats(int lastClosed,const double &o[],const double &h[],const double &l[])
{
   bool changed=false;
   for(int i=0;i<g_nSig;i++)
   {
      if(g_sig[i].res!=0) continue;
      int b=g_sig[i].bar, d=g_sig[i].dir;
      if(b+1>g_rates-1) continue;
      if(g_sig[i].entry==0)
      {
         g_sig[i].entry=o[b+1];
         double risk=(g_sig[i].entry-g_sig[i].sl)*d;
         if(risk<=0) { g_sig[i].res=-2; changed=true; continue; }
         g_sig[i].tp=g_sig[i].entry+d*InpStatRR*risk;
         g_sig[i].lastChk=b;
      }
      for(int k=g_sig[i].lastChk+1;k<=lastClosed;k++)
      {
         g_sig[i].lastChk=k;
         if(d>0 ? l[k]<=g_sig[i].sl : h[k]>=g_sig[i].sl) { g_sig[i].res=-1; changed=true; break; }  // SL first (conservative)
         if(d>0 ? h[k]>=g_sig[i].tp : l[k]<=g_sig[i].tp) { g_sig[i].res=1;  changed=true; break; }
      }
   }
   return(changed);
}

string StatsText()
{
   int w[4]={0,0,0,0}, lo[4]={0,0,0,0}, op=0;
   for(int i=0;i<g_nSig;i++)
   {
      int k=g_sig[i].kind;
      if(k<1 || k>3) continue;
      if(g_sig[i].res==1) w[k]++; else if(g_sig[i].res==-1) lo[k]++; else if(g_sig[i].res==0) op++;
   }
   return(StringFormat("Hindsight 1:%.1f  DIV %dW/%dL  EXH %dW/%dL  CONT %dW/%dL  open %d",
                       InpStatRR,w[1],lo[1],w[2],lo[2],w[3],lo[3],op));
}

void WriteStats(const datetime &t[])
{
   if(!InpLogFile || !InpShowStats) return;
   int f=FileOpen("TDIDivPro_"+_Symbol+"_"+TFStr()+"_stats.csv",FILE_WRITE|FILE_TXT|FILE_ANSI|FILE_SHARE_READ);
   if(f==INVALID_HANDLE) return;
   FileWriteString(f,"confirm_bar;direction;kind;double;legs;leg1_tdi;last_tdi;tf_slope_atr;htf_slope_atr;leg1_outside_band;entry;sl;tp;result\r\n");
   for(int i=0;i<g_nSig;i++)
   {
      string res=(g_sig[i].res==1 ? "WIN" : (g_sig[i].res==-1 ? "LOSS" : (g_sig[i].res==-2 ? "INVALID" : "OPEN")));
      FileWriteString(f,TS(t[g_sig[i].bar])+";"+(g_sig[i].dir>0 ? "BUY" : "SELL")+";"+KindName(g_sig[i].kind)+";"+
                      IntegerToString(g_sig[i].dbl)+";"+IntegerToString(g_sig[i].legs)+";"+
                      DoubleToString(g_sig[i].v1,2)+";"+DoubleToString(g_sig[i].vN,2)+";"+
                      DoubleToString(g_sig[i].slope,2)+";"+DoubleToString(g_sig[i].hslope,2)+";"+
                      DoubleToString(g_sig[i].band1,2)+";"+DoubleToString(g_sig[i].entry,_Digits)+";"+
                      DoubleToString(g_sig[i].sl,_Digits)+";"+DoubleToString(g_sig[i].tp,_Digits)+";"+res+"\r\n");
   }
   FileClose(f);
}

//+------------------------------------------------------------------+
//| Log                                                              |
//+------------------------------------------------------------------+
string LogFile() { return("TDIDivPro_"+_Symbol+"_"+TFStr()+".csv"); }

string LegDetail(const SCand &cd,const datetime &t[])
{
   string s="";
   for(int n=0;n<cd.legs;n++)
      s+=StringFormat("%sL%d TDI %s=%.2f price %s=%s",n>0 ? " | " : "",n+1,
                      TS(t[cd.legBar[n]]),cd.legVal[n],TS(t[cd.legPBar[n]]),DoubleToString(cd.legPrice[n],_Digits));
   return(s);
}

void AppendLine(string line)
{
   int f=FileOpen(LogFile(),FILE_READ|FILE_WRITE|FILE_TXT|FILE_ANSI|FILE_SHARE_READ);
   if(f==INVALID_HANDLE) { Print("TDI Div Pro: cannot open log ",LogFile()," err ",GetLastError()); return; }
   FileSeek(f,0,SEEK_END);
   FileWriteString(f,line+"\r\n");
   FileClose(f);
}

void LogEvent(string kind,const SCand &cd,int c,string reason,const datetime &t[])
{
   if(!InpLogFile) return;
   string line=kind+";"+(cd.dir>0 ? "BUY" : "SELL")+";"+KindName(cd.kind)+";"+TrendName(TrendAt(c))+";"+
               IntegerToString((long)t[cd.legBar[cd.legs-1]])+";"+
               IntegerToString(cd.legs)+";"+LegDetail(cd,t)+";"+TS(t[c])+";"+TS(t[c]+PeriodSeconds())+";"+reason;
   if(g_live) { AppendLine(line); return; }
   ArrayResize(g_log,g_nLog+1,1024);
   g_log[g_nLog++]=line;
}

void FlushLog()
{
   if(!InpLogFile) return;
   int f=FileOpen(LogFile(),FILE_WRITE|FILE_TXT|FILE_ANSI|FILE_SHARE_READ);
   if(f!=INVALID_HANDLE)
   {
      FileWriteString(f,"event;direction;kind;trend;signal_id;legs;legs_detail;event_bar;entry_from;reason\r\n");
      for(int i=0;i<g_nLog;i++) FileWriteString(f,g_log[i]+"\r\n");
      FileClose(f);
   }
   else Print("TDI Div Pro: cannot write log ",LogFile()," err ",GetLastError());
   ArrayResize(g_log,0); g_nLog=0;
}

//+------------------------------------------------------------------+
//| Drawing                                                          |
//+------------------------------------------------------------------+
bool CanDraw(int c) { return(InpDraw && c>=g_rates-1-InpDrawBars); }

void ObjLine(string n,int win,datetime t1,double p1,datetime t2,double p2,color col,ENUM_LINE_STYLE st,int w)
{
   if(win<0) return;
   if(ObjectFind(0,n)<0) { if(!ObjectCreate(0,n,OBJ_TREND,win,t1,p1,t2,p2)) return; }
   else { ObjectMove(0,n,0,t1,p1); ObjectMove(0,n,1,t2,p2); }
   ObjectSetInteger(0,n,OBJPROP_COLOR,col);
   ObjectSetInteger(0,n,OBJPROP_STYLE,st);
   ObjectSetInteger(0,n,OBJPROP_WIDTH,w);
   ObjectSetInteger(0,n,OBJPROP_RAY_RIGHT,false);
   ObjectSetInteger(0,n,OBJPROP_SELECTABLE,false);
   ObjectSetInteger(0,n,OBJPROP_HIDDEN,true);
}

void ObjText(string n,int win,datetime t,double p,string txt,color col,ENUM_ANCHOR_POINT anchor,int size,string tip)
{
   if(win<0) return;
   if(ObjectFind(0,n)<0) { if(!ObjectCreate(0,n,OBJ_TEXT,win,t,p)) return; }
   else ObjectMove(0,n,0,t,p);
   ObjectSetString(0,n,OBJPROP_TEXT,txt);
   ObjectSetString(0,n,OBJPROP_TOOLTIP,tip);
   ObjectSetInteger(0,n,OBJPROP_COLOR,col);
   ObjectSetInteger(0,n,OBJPROP_FONTSIZE,size);
   ObjectSetInteger(0,n,OBJPROP_ANCHOR,anchor);
   ObjectSetInteger(0,n,OBJPROP_SELECTABLE,false);
   ObjectSetInteger(0,n,OBJPROP_HIDDEN,true);
}

void ObjArrow(string n,datetime t,double p,int code,color col,ENUM_ARROW_ANCHOR anchor,string tip)
{
   if(ObjectFind(0,n)<0) { if(!ObjectCreate(0,n,OBJ_ARROW,0,t,p)) return; }
   else ObjectMove(0,n,0,t,p);
   ObjectSetInteger(0,n,OBJPROP_ARROWCODE,code);
   ObjectSetInteger(0,n,OBJPROP_COLOR,col);
   ObjectSetInteger(0,n,OBJPROP_WIDTH,3);
   ObjectSetInteger(0,n,OBJPROP_ANCHOR,anchor);
   ObjectSetString(0,n,OBJPROP_TOOLTIP,tip);
   ObjectSetInteger(0,n,OBJPROP_SELECTABLE,false);
   ObjectSetInteger(0,n,OBJPROP_HIDDEN,true);
}

void ObjVLine(string n,datetime t,color col)
{
   if(ObjectFind(0,n)<0) { if(!ObjectCreate(0,n,OBJ_VLINE,0,t,0)) return; }
   ObjectSetInteger(0,n,OBJPROP_COLOR,col);
   ObjectSetInteger(0,n,OBJPROP_STYLE,STYLE_DOT);
   ObjectSetInteger(0,n,OBJPROP_BACK,true);
   ObjectSetInteger(0,n,OBJPROP_SELECTABLE,false);
   ObjectSetInteger(0,n,OBJPROP_HIDDEN,true);
}

void DrawSetup(const SCand &cd,int c,const datetime &t[],const double &h[],const double &l[],bool pending)
{
   string id  =CandId(cd,t);
   string base=PFX+(pending ? "P_" : "C_")+id+"_";
   color  col =pending ? InpPendColor : (cd.dir>0 ? InpBuyColor : InpSellColor);
   ENUM_LINE_STYLE st=pending ? STYLE_DOT : STYLE_SOLID;
   ENUM_ANCHOR_POINT an=(cd.dir>0 ? ANCHOR_UPPER : ANCHOR_LOWER);

   for(int n=0;n<cd.legs-1;n++)
   {
      ObjLine(base+"PL"+IntegerToString(n),0,t[cd.legPBar[n]],cd.legPrice[n],t[cd.legPBar[n+1]],cd.legPrice[n+1],col,st,2);
      ObjLine(base+"TL"+IntegerToString(n),g_win,t[cd.legBar[n]],cd.legVal[n],t[cd.legBar[n+1]],cd.legVal[n+1],col,st,2);
   }
   if(InpShowLegLabels)
      for(int n=0;n<cd.legs;n++)
         ObjText(base+"LB"+IntegerToString(n),0,t[cd.legPBar[n]],cd.legPrice[n],
                 "L"+IntegerToString(n+1)+(n==cd.legs-1 && cd.kind!=KIND_DIV ? " "+KindName(cd.kind) : "")+
                 (n==cd.legs-1 && cd.dbl==1 ? (cd.dir>0 ? " DB" : " DT") : ""),col,an,8,"");
   if(pending) return;

   int    li  =cd.legs-1;
   string side=(cd.dir>0 ? "BUY" : "SELL");
   string tip =StringFormat("%s "+KindName(cd.kind)+" L%d | confirmed on bar %s (closed %s) | entry from %s | SL ref %s | %s",
                           side,cd.legs,TS(t[c]),TS(t[c]+PeriodSeconds()),TS(t[c]+PeriodSeconds()),
                           DoubleToString(cd.legPrice[li],_Digits),LegDetail(cd,t));
   if(cd.dir>0) ObjArrow(base+"AR",t[c],l[c],233,col,ANCHOR_TOP,tip);
   else         ObjArrow(base+"AR",t[c],h[c],234,col,ANCHOR_BOTTOM,tip);
   if(InpShowVLines)
   {
      ObjVLine(base+"V1",t[cd.legPBar[li]],clrRed);
      ObjVLine(base+"V2",t[c],clrRed);
   }
}

//+------------------------------------------------------------------+
//| Status panel                                                     |
//+------------------------------------------------------------------+
void PanelLine(int i,string txt,color col)
{
   string n=PFX+"PNL"+IntegerToString(i);
   if(ObjectFind(0,n)<0)
   {
      ObjectCreate(0,n,OBJ_LABEL,0,0,0);
      ObjectSetInteger(0,n,OBJPROP_CORNER,CORNER_LEFT_LOWER);
      ObjectSetInteger(0,n,OBJPROP_ANCHOR,ANCHOR_LEFT_LOWER);
      ObjectSetInteger(0,n,OBJPROP_XDISTANCE,10);
      ObjectSetInteger(0,n,OBJPROP_YDISTANCE,20+(6-i)*16);
      ObjectSetInteger(0,n,OBJPROP_FONTSIZE,9);
      ObjectSetString(0,n,OBJPROP_FONT,"Consolas");
      ObjectSetInteger(0,n,OBJPROP_SELECTABLE,false);
      ObjectSetInteger(0,n,OBJPROP_HIDDEN,true);
   }
   ObjectSetString(0,n,OBJPROP_TEXT,txt);
   ObjectSetInteger(0,n,OBJPROP_COLOR,col);
}

// informational only: price already beyond a leg 1 while TDI holds (setup in formation)
string Forming(int dir,int lc,const datetime &t[],const double &h[],const double &l[])
{
   int ptype=-dir, best=-1;
   for(int k=g_nPiv-1;k>=0;k--)
   {
      if(g_piv[k].type!=ptype) continue;
      if(lc-g_piv[k].bar>InpMaxSpan) break;
      if(!TDIExtreme(dir,g_piv[k].val,g_piv[k].bar,lc)) continue;
      if(best<0 || (g_piv[k].val-g_piv[best].val)*dir<=0) best=k;
   }
   if(best<0 || (Src(lc)-g_piv[best].val)*dir<=0) return("");
   bool beyond=false;
   for(int k=g_piv[best].pbar+1;k<=lc && !beyond;k++)
      if(dir>0 ? l[k]<g_piv[best].price : h[k]>g_piv[best].price) beyond=true;
   if(!beyond) return("");
   return(StringFormat("%s forming vs L1 %s (TDI %.1f)",dir>0 ? "BUY" : "SELL",TS(t[g_piv[best].bar]),g_piv[best].val));
}

void UpdatePanel(const datetime &t[],const double &h[],const double &l[])
{
   int lc=g_rates-2;
   PanelLine(0,StringFormat("TDI Div Pro v9.1 | %s %s | closed bars only",_Symbol,TFStr()),clrSilver);
   int tr=TrendAt(lc);
   string tt=StringFormat("Trend: %s (EMA%d slope %+.2f ATR)",TrendName(tr),InpTrendEMA,TrendSlope(lc));
   if(InpUseTrendFilter && tr!=0)
      tt+=(tr>0 ? " - buys; sells only at exhaustion" : " - sells; buys only at exhaustion");
   if(g_useHTF && lc>=0 && HTFB[lc]!=EMPTY_VALUE)
      tt+=StringFormat(" | %s %s (%+.2f)",HTFName(),TrendName((int)HTFB[lc]),HTFS[lc]);
   PanelLine(5,tt,tr>0 ? clrLime : (tr<0 ? clrTomato : clrSilver));
   if(InpShowStats) PanelLine(6,StatsText(),clrSilver);
   PanelLine(1,g_lastTxt,clrWhite);
   string p="Pending: none";
   if(g_nPend>0)
   {
      SCand cd=g_pend[g_nPend-1];
      p=StringFormat("Pending: %s L%d, confirm by %s",cd.dir>0 ? "BUY" : "SELL",cd.legs,
                     TS(t[cd.legBar[cd.legs-1]]+InpConfirmBars*PeriodSeconds()));
   }
   PanelLine(2,p,g_nPend>0 ? clrGold : clrSilver);
   string f=Forming(1,lc,t,h,l), f2=Forming(-1,lc,t,h,l);
   if(f!="" && f2!="") f=f+" / "+f2; else if(f2!="") f=f2;
   PanelLine(3,f=="" ? "Forming: none" : "Forming: "+f,clrSilver);
   PanelLine(4,StringFormat("History: %d buy, %d sell, %d rejected",g_cntBuy,g_cntSell,g_cntRej),clrSilver);
}

void Notify(string msg)
{
   if(InpAlerts) Alert(msg);
   if(InpPush)   SendNotification(msg);
}

//+------------------------------------------------------------------+
void ResetState()
{
   ArrayResize(g_piv,0);  g_nPiv=0;
   ArrayResize(g_pend,0); g_nPend=0;
   ArrayResize(g_log,0);  g_nLog=0;
   g_last=-1; g_live=false;
   g_cntBuy=0; g_cntSell=0; g_cntRej=0;
   g_lastSig[0]=-1000000; g_lastSig[1]=-1000000;
   g_lastTxt="Last signal: none";
   ArrayResize(g_sig,0); g_nSig=0;
   if(InpDraw) ObjectsDeleteAll(0,PFX);
}

int OnCalculate(const int rates_total,const int prev_calculated,
                const datetime &time[],const double &open[],const double &high[],
                const double &low[],const double &close[],const long &tick_volume[],
                const long &volume[],const int &spread[])
{
   ArraySetAsSeries(time,false); ArraySetAsSeries(open,false); ArraySetAsSeries(high,false);
   ArraySetAsSeries(low,false);  ArraySetAsSeries(close,false);

   int warm=WarmBars();
   if(rates_total<warm+InpPivLeft+InpMaxSpan+InpPivRight+5) return(0);   // not enough history yet

   bool full=(prev_calculated<=0 || prev_calculated>rates_total);
   if(full) ResetState();
   g_rates=rates_total;
   if(InpDraw && g_win<0) g_win=ChartWindowFind();

   CalcTDI(full ? 0 : prev_calculated-1,rates_total,open,high,low,close);

   if(full) g_start=IMax(warm+InpPivLeft+1,rates_total-1-InpMaxBars);
   if(g_last<g_start-1) g_last=g_start-1;

   int lastClosed=rates_total-2;                 // the forming bar is never evaluated
   if(lastClosed>g_last && !LoadHTF())           // HTF history not ready yet: try again on the next tick
      return(full ? 0 : prev_calculated);
   bool newBars=(lastClosed>g_last);
   for(int c=g_last+1;c<=lastClosed;c++) ProcessBar(c,time,open,high,low,close);
   if(lastClosed>g_last) g_last=lastClosed;
   if(InpShowStats && newBars && (UpdateStats(lastClosed,open,high,low) || full)) WriteStats(time);

   if(!g_live) { g_live=true; FlushLog(); }      // history done; from now on events are live
   if(InpDraw && InpShowPanel) UpdatePanel(time,high,low);
   if(InpDraw) ChartRedraw();
   return(rates_total);
}
//+------------------------------------------------------------------+
