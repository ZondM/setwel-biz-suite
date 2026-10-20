//+------------------------------------------------------------------+
//|                                           TDI_Divergence_Pro.mq5 |
//|  TDI-led divergence: green RSI Price Line legs vs price swings.  |
//|  Specification: mt5/SPEC.md                                      |
//|                                                                  |
//|  BUY : green makes a HIGHER LOW (leg 1 -> leg 2 / leg 3) while   |
//|        price makes LOWER LOWS (market keeps going deeper).       |
//|  SELL: green makes a LOWER HIGH while price makes HIGHER HIGHS.  |
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
//+------------------------------------------------------------------+
#property version     "5.00"
#property description "TDI-led divergence (green line vs price). Closed bars only, non-repainting."
#property indicator_separate_window
#property indicator_minimum 0
#property indicator_maximum 100
#property indicator_buffers 17
#property indicator_plots   12

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

#define PFX "TDV5_"

enum ENUM_DIV_SOURCE
{
   SRC_GREEN = 0,   // Green RSI Price Line (default)
   SRC_RED   = 1,   // Red Signal Line
   SRC_BASE  = 2    // Yellow Market Base Line
};

//--- inputs (order matters for the EA's iCustom call)
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
input int    InpMaxLegs          = 3;     // Max legs (3 = leg 3 can signal), max 5
input bool   InpStrictTDIRise    = false; // Each leg's TDI beyond the previous leg (false = beyond leg 1)
input int    InpConfirmBars      = 6;     // Bars after the last-leg TDI pivot allowed to confirm
input int    InpMaxSignalsPerSeq = 2;     // Max signals from the same leg 1

input group "=== Filters (each one on/off) ==="
input bool   InpUseTDIProm       = true;  // TDI swing prominence
input double InpTDIProm          = 3.0;   //   min TDI swing size (points)
input bool   InpUseMinPriceDiv   = false; // Min price divergence
input double InpMinPriceDivATR   = 0.2;   //   x ATR between leg 1 and last leg
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
input bool   InpUseCooldown      = false; // Cooldown between same-direction signals
input int    InpCooldownBars     = 10;    //   bars

input group "=== Display / alerts / log ==="
input int    InpMaxBars          = 5000;  // Bars to evaluate
input bool   InpDraw             = true;  // Draw objects on the chart
input int    InpDrawBars         = 2000;  // Draw objects only for the last N bars
input bool   InpShowPending      = true;  // Show provisional (not yet confirmed) setups
input bool   InpShowRejects      = false; // Diagnostic: label rejected setups with the reason
input bool   InpShowLegLabels    = true;  // Label L1 / L2 / L3
input bool   InpShowVLines       = false; // Vertical lines at last leg and confirm bar
input bool   InpShowPanel        = true;  // Status panel
input bool   InpAlerts           = true;  // Popup alert on confirmed signal
input bool   InpPush             = false; // Phone push on confirmed signal
input bool   InpAlertPending     = false; // Also alert provisional setups
input bool   InpLogFile          = true;  // CSV log in MQL5\Files
input bool   InpPrintRejects     = false; // Print rejected setups to the Experts log (live)
input color  InpBuyColor         = clrDeepSkyBlue;
input color  InpSellColor        = clrMagenta;
input color  InpPendColor        = clrGray;

//--- buffers
double UB[],LB[],YB[],GB[],RB[],SellA[],BuyA[],SellSL[],BuySL[],SigID[],SigLegs[],SigDir[];
double RSI[],POS[],NEG[],TRB[],ATRB[];

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

//+------------------------------------------------------------------+
int IMax(int a,int b) { return(a>b ? a : b); }
int IMin(int a,int b) { return(a<b ? a : b); }
int DI(int dir)       { return(dir>0 ? 0 : 1); }
string TS(datetime t) { return(TimeToString(t,TIME_DATE|TIME_MINUTES)); }
string TFStr()        { return(StringSubstr(EnumToString((ENUM_TIMEFRAMES)_Period),7)); }

int WarmBars()
{
   return(InpRSIPeriod+IMax(IMax(InpGreenPeriod,InpRedPeriod),IMax(InpBasePeriod,InpBandPeriod))+InpATRPeriod+2);
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
      InpMinLegBars<1 || InpMaxSignalsPerSeq<1 || InpMaxBars<InpMaxSpan)
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
   SetIndexBuffer(12,RSI,    INDICATOR_CALCULATIONS);
   SetIndexBuffer(13,POS,    INDICATOR_CALCULATIONS);
   SetIndexBuffer(14,NEG,    INDICATOR_CALCULATIONS);
   SetIndexBuffer(15,TRB,    INDICATOR_CALCULATIONS);
   SetIndexBuffer(16,ATRB,   INDICATOR_CALCULATIONS);

   PlotIndexSetInteger(5,PLOT_ARROW,234);
   PlotIndexSetInteger(6,PLOT_ARROW,233);
   PlotIndexSetInteger(5,PLOT_LINE_COLOR,InpSellColor);
   PlotIndexSetInteger(6,PLOT_LINE_COLOR,InpBuyColor);
   for(int p=0;p<12;p++) PlotIndexSetDouble(p,PLOT_EMPTY_VALUE,EMPTY_VALUE);
   for(int p=0;p<5;p++)  PlotIndexSetInteger(p,PLOT_DRAW_BEGIN,WarmBars());

   IndicatorSetString(INDICATOR_SHORTNAME,"TDI Div Pro v5");
   IndicatorSetInteger(INDICATOR_DIGITS,2);
   IndicatorSetInteger(INDICATOR_LEVELS,3);
   IndicatorSetDouble(INDICATOR_LEVELVALUE,0,32);
   IndicatorSetDouble(INDICATOR_LEVELVALUE,1,50);
   IndicatorSetDouble(INDICATOR_LEVELVALUE,2,68);
   IndicatorSetInteger(INDICATOR_LEVELCOLOR,clrDimGray);
   IndicatorSetInteger(INDICATOR_LEVELSTYLE,STYLE_DOT);

   g_lastSig[0]=-1000000; g_lastSig[1]=-1000000;
   return(INIT_SUCCEEDED);
}

void OnDeinit(const int reason)
{
   if(InpDraw) ObjectsDeleteAll(0,PFX);
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

      //--- signal buffers of bars not yet evaluated are always empty
      if(i>g_last)
      {
         SellA[i]=EMPTY_VALUE; BuyA[i]=EMPTY_VALUE; SellSL[i]=EMPTY_VALUE; BuySL[i]=EMPTY_VALUE;
         SigID[i]=EMPTY_VALUE; SigLegs[i]=EMPTY_VALUE; SigDir[i]=EMPTY_VALUE;
      }
   }
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
void BuildCandidate(int dir,int nIdx,int c,const datetime &t[],const double &h[],const double &l[])
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
      if((g_piv[k].price-N.price)*dir<=0) continue;            // price: last leg must be deeper than leg 1
      if((N.val-g_piv[k].val)*dir<=0)     continue;            // TDI: last leg must hold above (buy) / below (sell) leg 1
      if(!PriceDeepest(dir,N.price,g_piv[k].pbar,c,h,l)) continue; // last leg is the deepest price since leg 1
      if(!TDIExtreme(dir,g_piv[k].val,g_piv[k].bar,c))   continue; // leg 1 is the deepest TDI since leg 1
      if(best<0 || (g_piv[k].val-g_piv[best].val)*dir<=0) best=k;  // deepest TDI leg 1, ties -> older
   }
   if(best<0) return;                                         // no divergence

   SCand cd;
   ZeroMemory(cd);
   cd.dir=dir; cd.xIdx=best; cd.created=c; cd.deadline=N.bar+InpConfirmBars;
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
      if((g_piv[k].val-ref)*dir<=0)               continue;
      SetLeg(cd,cd.legs,g_piv[k]);
      cd.legs++;
   }
   while(cd.legs>1 && (N.bar-cd.legBar[cd.legs-1]<InpMinLegBars ||
         (InpStrictTDIRise && (N.val-cd.legVal[cd.legs-1])*dir<=0)))
      cd.legs--;
   SetLeg(cd,cd.legs,N);
   cd.legs++;

   //--- structural filters
   string why="";
   if(cd.legs<InpMinLegs)
      why=StringFormat("legs %d < min %d",cd.legs,InpMinLegs);
   else if(cd.legs>InpMaxLegs)
      why=StringFormat("legs %d > max %d",cd.legs,InpMaxLegs);
   else if(InpUseMinPriceDiv && MathAbs(cd.legPrice[0]-N.price)<InpMinPriceDivATR*ATRB[N.pbar])
      why=StringFormat("price divergence %.2f ATR < %.2f",MathAbs(cd.legPrice[0]-N.price)/MathMax(ATRB[N.pbar],_Point),InpMinPriceDivATR);
   else if(InpUseMinTDIDiv && MathAbs(N.val-cd.legVal[0])<InpMinTDIDiv)
      why=StringFormat("TDI divergence %.1f < %.1f",MathAbs(N.val-cd.legVal[0]),InpMinTDIDiv);
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

   if(why!="") { Reject(cd,c,why,t,h,l); return; }

   ArrayResize(g_pend,g_nPend+1,16);
   g_pend[g_nPend]=cd;
   g_nPend++;
   LogEvent("PENDING",cd,c,"",t);
   if(InpShowPending && CanDraw(c)) DrawSetup(cd,c,t,h,l,true);
   if(g_live && InpAlertPending)
      Notify(StringFormat("%s %s %s setup forming (L%d) - waiting for confirmation",_Symbol,TFStr(),cd.dir>0?"BUY":"SELL",cd.legs));
}

//+------------------------------------------------------------------+
//| Confirmation                                                     |
//+------------------------------------------------------------------+
string ConfirmMiss(const SCand &cd,int c,const double &o[],const double &h[],const double &l[],const double &cl[])
{
   int d=cd.dir;
   if(InpUseGreenDir  && (Src(c)-Src(c-1))*d<=0) return("TDI not turning");
   if(InpUseRedCross  && (GB[c]-RB[c])*d<=0)     return(d>0 ? "green below red" : "green above red");
   if(InpUseBase      && (GB[c]-YB[c])*d<=0)     return(d>0 ? "green below base" : "green above base");
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
         else if((Src(c)-cd.legVal[0])*d<0)
            why="TDI broke the leg-1 level";
      }
      if(why=="")
      {
         string miss=ConfirmMiss(cd,c,o,h,l,cl);
         if(miss=="")
         {
            if(InpUseCooldown && c-g_lastSig[DI(d)]<InpCooldownBars) why="cooldown";
            else if(SigDir[c]!=EMPTY_VALUE)                          why="another signal on this bar";
            else if(g_piv[cd.xIdx].sigs>=InpMaxSignalsPerSeq)        why="signal limit for this leg 1 reached";
            else confirm=true;
         }
         else if(c>=cd.deadline)
            why="not confirmed within "+IntegerToString(InpConfirmBars)+" bars ("+miss+")";
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
   g_piv[cd.xIdx].sigs++;
   g_lastSig[DI(d)]=c;

   string side=(d>0 ? "BUY" : "SELL");
   g_lastTxt=StringFormat("Last: %s L%d confirmed %s, entry from %s",side,cd.legs,TS(t[c]),TS(t[c]+PeriodSeconds()));
   LogEvent("SIGNAL",cd,c,"",t);

   string id=CandId(cd,t);
   if(InpDraw) ObjectsDeleteAll(0,PFX+"P_"+id);
   if(CanDraw(c)) DrawSetup(cd,c,t,h,l,false);

   if(g_live)
   {
      string msg=StringFormat("%s %s CONFIRMED %s divergence L%d | SL ref %s | entry from %s",
                              _Symbol,TFStr(),side,cd.legs,DoubleToString(cd.legPrice[li],_Digits),TS(t[c]+PeriodSeconds()));
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
      Print(StringFormat("%s %s %s rejected: %s",_Symbol,TFStr(),cd.dir>0?"BUY":"SELL",why));
}

//+------------------------------------------------------------------+
//| One closed bar, processed exactly once, in time order            |
//+------------------------------------------------------------------+
void ProcessBar(int c,const datetime &t[],const double &o[],const double &h[],const double &l[],const double &cl[])
{
   int q=c-InpPivRight;
   if(q-InpPivLeft>=g_start)
   {
      int type=PivotType(q);
      if(type!=0 && Prominent(type,q))
      {
         int pb =PriceMatch(type,q,c,h,l);
         int idx=AddPivot(type,q,pb,Src(q),type>0 ? h[pb] : l[pb]);
         BuildCandidate(type>0 ? -1 : 1,idx,c,t,h,l);
      }
   }
   CheckPending(c,t,o,h,l,cl);
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
   string line=kind+";"+(cd.dir>0 ? "BUY" : "SELL")+";"+IntegerToString((long)t[cd.legBar[cd.legs-1]])+";"+
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
      FileWriteString(f,"event;direction;signal_id;legs;legs_detail;event_bar;entry_from;reason\r\n");
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
         ObjText(base+"LB"+IntegerToString(n),0,t[cd.legPBar[n]],cd.legPrice[n],"L"+IntegerToString(n+1),col,an,8,"");
   if(pending) return;

   int    li  =cd.legs-1;
   string side=(cd.dir>0 ? "BUY" : "SELL");
   string tip =StringFormat("%s L%d | confirmed on bar %s (closed %s) | entry from %s | SL ref %s | %s",
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
      ObjectSetInteger(0,n,OBJPROP_YDISTANCE,20+(4-i)*16);
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
   PanelLine(0,StringFormat("TDI Div Pro v5 | %s %s | closed bars only",_Symbol,TFStr()),clrSilver);
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
   for(int c=g_last+1;c<=lastClosed;c++) ProcessBar(c,time,open,high,low,close);
   if(lastClosed>g_last) g_last=lastClosed;

   if(!g_live) { g_live=true; FlushLog(); }      // history done; from now on events are live
   if(InpDraw && InpShowPanel) UpdatePanel(time,high,low);
   if(InpDraw) ChartRedraw();
   return(rates_total);
}
//+------------------------------------------------------------------+
