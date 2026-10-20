//+------------------------------------------------------------------+
//|                                              TDI_Divergence.mq5  |
//|  v4 - strict, trend-aware, confirmed divergence, FAST trigger.   |
//|                                                                  |
//|  SPEED: the signal fires on the FIRST closed candle that         |
//|  confirms the divergence (no extra swing-wait bars). The EA      |
//|  trades at the open of the next candle. That is the earliest     |
//|  possible without repainting.                                    |
//|                                                                  |
//|  TREND (major swings, no look-ahead)                             |
//|   Uptrend = HH+HL -> buys. Sell only at TDI extreme (reversal).  |
//|   Downtrend = LH+LL -> sells. Buy only at TDI extreme.           |
//|   Range -> both.                                                 |
//|                                                                  |
//|  SELL (buy = mirror)                                             |
//|   - Last leg = highest high of last ExtremeBars bars             |
//|   - Each leg clearly higher than previous (MinLegExtensionATR)   |
//|   - Real price pullback between legs (MinPullbackATR)            |
//|   - TDI green equal/lower high on each leg + real TDI dip        |
//|   - First leg TDI >= FirstLegOB                                  |
//|   - Confirmation candle: bearish, closes below leg candle low,   |
//|     green below red and falling, no new high before it           |
//|                                                                  |
//|  ShowRejects: grey "x reason" label on every top/bottom that     |
//|  had a price/TDI divergence but failed a rule - use it to tune.  |
//|                                                                  |
//|  Buffers (EA): 0 UpBand 1 LowBand 2 Base 3 Green 4 Red           |
//|   5 Sell 6 Buy 7 Sell SL level 8 Buy SL level 9 Trend            |
//+------------------------------------------------------------------+
#property indicator_separate_window
#property indicator_minimum 0
#property indicator_maximum 100
#property indicator_buffers 12
#property indicator_plots   10

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
#property indicator_color6  clrRed
#property indicator_width6  2
#property indicator_label7  "Buy Signal"
#property indicator_type7   DRAW_ARROW
#property indicator_color7  clrLime
#property indicator_width7  2
#property indicator_label8  "Sell SL"
#property indicator_type8   DRAW_NONE
#property indicator_label9  "Buy SL"
#property indicator_type9   DRAW_NONE
#property indicator_label10 "Trend"
#property indicator_type10  DRAW_NONE

input group "TDI"
input int    RSI_Period         = 13;
input int    PriceLinePeriod    = 2;
input int    SignalPeriod       = 7;
input int    BandPeriod         = 34;
input double BandDev            = 1.6185;

input group "Price pattern"
input int    LeftBars           = 5;     // bars left of a leg swing
input int    RightBars          = 3;     // bars right for OLDER legs (current leg uses the confirmation candle)
input int    MinGap             = 6;     // min bars between legs
input int    MaxLookback        = 80;    // max bars between legs
input double MinLegExtensionATR = 0.5;   // each leg beyond the previous by this x ATR (rejects flat tops/bottoms)
input int    ExtremeBars        = 50;    // last leg = extreme of the last N bars
input double MinPullbackATR     = 1.0;   // price pullback between legs, x ATR

input group "TDI divergence quality"
input double MinTDIDiff         = -1.0;  // -1 = TDI equal (within 1 pt) or lower/higher counts
input double MinTDIRetrace      = 6.0;   // TDI dip between legs
input bool   RequireOB          = true;  // first leg TDI in high zone (sell) / low zone (buy)
input double FirstLegOB         = 60;
input double FirstLegOS         = 40;
input bool   UseBandOB          = false; // first leg TDI must also be outside the volatility band
input int    MinLegs            = 2;     // 2 = trade leg 2,3,4   3 = only leg 3,4
input int    MaxLegs            = 4;

input group "Trend filter (market structure)"
input bool   UseTrendFilter       = true;
input int    StructureBars        = 20;   // bars each side for a MAJOR swing
input int    StructureLookback    = 400;
input bool   AllowCounterTrend    = true; // reversal against trend only at TDI extreme
input double CounterTrendOB       = 75;
input double CounterTrendOS       = 25;
input bool   CounterTrendNeedBand = true; // counter-trend also needs TDI outside the band

input group "Confirmation"
input int    ConfirmBars        = 6;     // candles after the leg allowed to confirm
input bool   RequireSignalCross = true;  // green below red & falling (sell) / above & rising (buy)
input bool   RequireCloseBeyond = true;  // close beyond the leg candle
input bool   RequireCandleDir   = true;  // confirmation candle bearish (sell) / bullish (buy)

input group "Display / alerts"
input int    MaxBars            = 5000;
input bool   DrawOnChart        = true;
input bool   UseAlerts          = true;
input bool   UsePush            = true;  // phone push (set MetaQuotes ID in Tools > Options > Notifications)
input bool   ShowRejects        = true;  // grey label with the reason a divergence was rejected
input color  BearColor          = clrBlue;
input color  BullColor          = clrBlue;

double UpB[],DnB[],Base[],PL[],Sig[],SellBuf[],BuyBuf[],SellSL[],BuySL[],TrendBuf[],RSIBuf[],ATRBuf[];
int    hRSI=INVALID_HANDLE, hATR=INVALID_HANDLE;
string Pref="TDIDIV_";
datetime lastAlertBar=0;

//+------------------------------------------------------------------+
int OnInit()
{
   SetIndexBuffer(0,UpB,INDICATOR_DATA);
   SetIndexBuffer(1,DnB,INDICATOR_DATA);
   SetIndexBuffer(2,Base,INDICATOR_DATA);
   SetIndexBuffer(3,PL,INDICATOR_DATA);
   SetIndexBuffer(4,Sig,INDICATOR_DATA);
   SetIndexBuffer(5,SellBuf,INDICATOR_DATA);
   SetIndexBuffer(6,BuyBuf,INDICATOR_DATA);
   SetIndexBuffer(7,SellSL,INDICATOR_DATA);
   SetIndexBuffer(8,BuySL,INDICATOR_DATA);
   SetIndexBuffer(9,TrendBuf,INDICATOR_DATA);
   SetIndexBuffer(10,RSIBuf,INDICATOR_CALCULATIONS);
   SetIndexBuffer(11,ATRBuf,INDICATOR_CALCULATIONS);

   ArraySetAsSeries(UpB,true);    ArraySetAsSeries(DnB,true);    ArraySetAsSeries(Base,true);
   ArraySetAsSeries(PL,true);     ArraySetAsSeries(Sig,true);    ArraySetAsSeries(SellBuf,true);
   ArraySetAsSeries(BuyBuf,true); ArraySetAsSeries(SellSL,true); ArraySetAsSeries(BuySL,true);
   ArraySetAsSeries(TrendBuf,true);ArraySetAsSeries(RSIBuf,true);ArraySetAsSeries(ATRBuf,true);

   PlotIndexSetInteger(5,PLOT_ARROW,234);
   PlotIndexSetInteger(6,PLOT_ARROW,233);
   for(int p=5;p<=9;p++) PlotIndexSetDouble(p,PLOT_EMPTY_VALUE,EMPTY_VALUE);
   for(int p=0;p<5;p++)  PlotIndexSetInteger(p,PLOT_DRAW_BEGIN,BandPeriod+RSI_Period);

   IndicatorSetString(INDICATOR_SHORTNAME,"TDI Div v4");
   IndicatorSetInteger(INDICATOR_DIGITS,2);
   IndicatorSetInteger(INDICATOR_LEVELS,3);
   IndicatorSetDouble(INDICATOR_LEVELVALUE,0,32);
   IndicatorSetDouble(INDICATOR_LEVELVALUE,1,50);
   IndicatorSetDouble(INDICATOR_LEVELVALUE,2,68);
   IndicatorSetInteger(INDICATOR_LEVELCOLOR,clrDimGray);
   IndicatorSetInteger(INDICATOR_LEVELSTYLE,STYLE_DOT);

   hRSI=iRSI(_Symbol,_Period,RSI_Period,PRICE_CLOSE);
   hATR=iATR(_Symbol,_Period,14);
   if(hRSI==INVALID_HANDLE || hATR==INVALID_HANDLE) return(INIT_FAILED);
   return(INIT_SUCCEEDED);
}

void OnDeinit(const int reason)
{
   if(DrawOnChart) ObjectsDeleteAll(0,Pref);
   if(hRSI!=INVALID_HANDLE) IndicatorRelease(hRSI);
   if(hATR!=INVALID_HANDLE) IndicatorRelease(hATR);
}

//+------------------------------------------------------------------+
//| Swings (series arrays: 0 = newest)                               |
//+------------------------------------------------------------------+
bool PivotHigh(int i,int left,int right,int total,const double &h[])
{
   if(i-right<1 || i+left>=total) return(false);
   for(int k=i-right;k<=i+left;k++)
   {
      if(k==i) continue;
      if(k<i && h[k]>=h[i]) return(false);
      if(k>i && h[k]> h[i]) return(false);
   }
   return(true);
}

bool PivotLow(int i,int left,int right,int total,const double &l[])
{
   if(i-right<1 || i+left>=total) return(false);
   for(int k=i-right;k<=i+left;k++)
   {
      if(k==i) continue;
      if(k<i && l[k]<=l[i]) return(false);
      if(k>i && l[k]< l[i]) return(false);
   }
   return(true);
}

double TDIHigh(int i)
{
   double v=PL[i];
   if(i-1>=0 && PL[i-1]>v) v=PL[i-1];
   if(PL[i+1]>v) v=PL[i+1];
   return(v);
}
double TDILow(int i)
{
   double v=PL[i];
   if(i-1>=0 && PL[i-1]<v) v=PL[i-1];
   if(PL[i+1]<v) v=PL[i+1];
   return(v);
}

int FindPrevHigh(int from,int total,const double &h[])
{
   for(int k=from+MinGap;k<=from+MaxLookback && k+LeftBars<total;k++)
   {
      if(!PivotHigh(k,LeftBars,RightBars,total,h)) continue;
      double lim=MathMin(h[from],h[k]);
      bool ok=true;
      for(int m=from+1;m<k;m++) if(h[m]>lim) { ok=false; break; }
      if(ok) return(k);
   }
   return(-1);
}

int FindPrevLow(int from,int total,const double &l[])
{
   for(int k=from+MinGap;k<=from+MaxLookback && k+LeftBars<total;k++)
   {
      if(!PivotLow(k,LeftBars,RightBars,total,l)) continue;
      double lim=MathMax(l[from],l[k]);
      bool ok=true;
      for(int m=from+1;m<k;m++) if(l[m]<lim) { ok=false; break; }
      if(ok) return(k);
   }
   return(-1);
}

//+------------------------------------------------------------------+
//| Leg pair quality: "" = OK, otherwise the reason                  |
//+------------------------------------------------------------------+
string BearWhy(int nw,int od,const double &h[],const double &l[])
{
   double atr=ATRBuf[nw]; if(atr<=0) return("no ATR");
   double ext=(h[nw]-h[od])/atr;
   if(ext<MinLegExtensionATR) return(StringFormat("leg %.2f<%.2f ATR",ext,MinLegExtensionATR));
   double tNew=TDIHigh(nw), tOld=TDIHigh(od);
   if(tNew>tOld-MinTDIDiff) return(StringFormat("TDI %.1f>%.1f",tNew,tOld));
   double lowMid=DBL_MAX, tdiMid=DBL_MAX;
   for(int m=nw+1;m<od;m++) { if(l[m]<lowMid) lowMid=l[m]; if(PL[m]<tdiMid) tdiMid=PL[m]; }
   double pb=(h[od]-lowMid)/atr;
   if(pb<MinPullbackATR) return(StringFormat("pullback %.2f<%.2f ATR",pb,MinPullbackATR));
   if(tdiMid>tNew-MinTDIRetrace) return(StringFormat("TDI dip %.1f<%.1f",tNew-tdiMid,MinTDIRetrace));
   return("");
}

string BullWhy(int nw,int od,const double &h[],const double &l[])
{
   double atr=ATRBuf[nw]; if(atr<=0) return("no ATR");
   double ext=(l[od]-l[nw])/atr;
   if(ext<MinLegExtensionATR) return(StringFormat("leg %.2f<%.2f ATR",ext,MinLegExtensionATR));
   double tNew=TDILow(nw), tOld=TDILow(od);
   if(tNew<tOld+MinTDIDiff) return(StringFormat("TDI %.1f<%.1f",tNew,tOld));
   double highMid=-DBL_MAX, tdiMid=-DBL_MAX;
   for(int m=nw+1;m<od;m++) { if(h[m]>highMid) highMid=h[m]; if(PL[m]>tdiMid) tdiMid=PL[m]; }
   double pb=(highMid-l[od])/atr;
   if(pb<MinPullbackATR) return(StringFormat("pullback %.2f<%.2f ATR",pb,MinPullbackATR));
   if(tdiMid<tNew+MinTDIRetrace) return(StringFormat("TDI dip %.1f<%.1f",tdiMid-tNew,MinTDIRetrace));
   return("");
}

//+------------------------------------------------------------------+
//| Trend at bar sb: +1 up, -1 down, 0 range / broken                |
//+------------------------------------------------------------------+
int TrendAt(int sb,int total,const double &h[],const double &l[],const double &cl[])
{
   int hI[2], lI[2], nh=0, nl=0;
   for(int p=sb+StructureBars+1; p+StructureBars<total && p<=sb+StructureLookback && (nh<2 || nl<2); p++)
   {
      if(nh<2 && PivotHigh(p,StructureBars,StructureBars,total,h)) hI[nh++]=p;
      if(nl<2 && PivotLow (p,StructureBars,StructureBars,total,l)) lI[nl++]=p;
   }
   if(nh<2 || nl<2) return(0);
   bool up=(h[hI[0]]>h[hI[1]] && l[lI[0]]>l[lI[1]]);
   bool dn=(h[hI[0]]<h[hI[1]] && l[lI[0]]<l[lI[1]]);
   int m;
   if(up) for(m=sb;m<lI[0];m++) if(cl[m]<l[lI[0]]) { up=false; break; }
   if(dn) for(m=sb;m<hI[0];m++) if(cl[m]>h[hI[0]]) { dn=false; break; }
   return(up? 1 : (dn? -1 : 0));
}

//+------------------------------------------------------------------+
//| Price turn: first closed candle closing beyond the leg candle    |
//| with no new extreme before it. -1 = not turned / broken          |
//+------------------------------------------------------------------+
int TurnBear(int i,const double &h[],const double &l[],const double &cl[])
{
   for(int c=i-1;c>=1 && c>=i-ConfirmBars;c--)
   {
      if(h[c]>h[i]) return(-1);
      if(cl[c]<l[i]) return(c);
   }
   return(-1);
}
int TurnBull(int i,const double &h[],const double &l[],const double &cl[])
{
   for(int c=i-1;c>=1 && c>=i-ConfirmBars;c--)
   {
      if(l[c]<l[i]) return(-1);
      if(cl[c]>h[i]) return(c);
   }
   return(-1);
}

// full confirmation: first closed candle meeting all rules
int ConfirmBear(int i,const double &op[],const double &h[],const double &l[],const double &cl[])
{
   for(int c=i-1;c>=1 && c>=i-ConfirmBars;c--)
   {
      if(h[c]>h[i]) return(-1);
      bool ok=true;
      if(RequireSignalCross && !(PL[c]<Sig[c] && PL[c]<PL[c+1])) ok=false;
      if(RequireCloseBeyond && !(cl[c]<l[i]))                     ok=false;
      if(RequireCandleDir   && !(cl[c]<op[c]))                    ok=false;
      if(ok) return(c);
   }
   return(-1);
}
int ConfirmBull(int i,const double &op[],const double &h[],const double &l[],const double &cl[])
{
   for(int c=i-1;c>=1 && c>=i-ConfirmBars;c--)
   {
      if(l[c]<l[i]) return(-1);
      bool ok=true;
      if(RequireSignalCross && !(PL[c]>Sig[c] && PL[c]>PL[c+1])) ok=false;
      if(RequireCloseBeyond && !(cl[c]>h[i]))                     ok=false;
      if(RequireCandleDir   && !(cl[c]>op[c]))                    ok=false;
      if(ok) return(c);
   }
   return(-1);
}

//+------------------------------------------------------------------+
//| Drawing                                                          |
//+------------------------------------------------------------------+
void DrawLine(string name,int win,datetime t1,double p1,datetime t2,double p2,color c)
{
   if(win<0) return;
   if(ObjectFind(0,name)<0) ObjectCreate(0,name,OBJ_TREND,win,t1,p1,t2,p2);
   ObjectSetInteger(0,name,OBJPROP_COLOR,c);
   ObjectSetInteger(0,name,OBJPROP_WIDTH,3);
   ObjectSetInteger(0,name,OBJPROP_RAY_RIGHT,false);
   ObjectSetInteger(0,name,OBJPROP_SELECTABLE,false);
}

void DrawArrow(string name,datetime t,double p,int code,color c,ENUM_ARROW_ANCHOR anchor)
{
   if(ObjectFind(0,name)<0) ObjectCreate(0,name,OBJ_ARROW,0,t,p);
   ObjectSetInteger(0,name,OBJPROP_ARROWCODE,code);
   ObjectSetInteger(0,name,OBJPROP_COLOR,c);
   ObjectSetInteger(0,name,OBJPROP_WIDTH,3);
   ObjectSetInteger(0,name,OBJPROP_ANCHOR,anchor);
   ObjectSetInteger(0,name,OBJPROP_SELECTABLE,false);
}

void DrawText(string name,datetime t,double p,string txt,color c,ENUM_ANCHOR_POINT anchor,int size=9)
{
   if(ObjectFind(0,name)<0) ObjectCreate(0,name,OBJ_TEXT,0,t,p);
   ObjectSetString(0,name,OBJPROP_TEXT,txt);
   ObjectSetInteger(0,name,OBJPROP_COLOR,c);
   ObjectSetInteger(0,name,OBJPROP_FONTSIZE,size);
   ObjectSetInteger(0,name,OBJPROP_ANCHOR,anchor);
   ObjectSetInteger(0,name,OBJPROP_SELECTABLE,false);
}

void DrawTrendLabel(int trend)
{
   string name=Pref+"TRENDLBL";
   if(ObjectFind(0,name)<0)
   {
      ObjectCreate(0,name,OBJ_LABEL,0,0,0);
      ObjectSetInteger(0,name,OBJPROP_CORNER,CORNER_RIGHT_UPPER);
      ObjectSetInteger(0,name,OBJPROP_ANCHOR,ANCHOR_RIGHT_UPPER);
      ObjectSetInteger(0,name,OBJPROP_XDISTANCE,80);
      ObjectSetInteger(0,name,OBJPROP_YDISTANCE,20);
      ObjectSetInteger(0,name,OBJPROP_FONTSIZE,11);
      ObjectSetInteger(0,name,OBJPROP_SELECTABLE,false);
   }
   string txt= trend==1 ? "TREND: UP - buys (sell only at TDI extreme)"
             : (trend==-1 ? "TREND: DOWN - sells (buy only at TDI extreme)" : "TREND: RANGE - both");
   if(!AllowCounterTrend) txt= trend==1 ? "TREND: UP - buys only" : (trend==-1 ? "TREND: DOWN - sells only" : "TREND: RANGE - both");
   color c= trend==1 ? clrLime : (trend==-1 ? clrRed : clrSilver);
   ObjectSetString(0,name,OBJPROP_TEXT,txt);
   ObjectSetInteger(0,name,OBJPROP_COLOR,c);
}

void Notify(string msg)
{
   if(UseAlerts) Alert(msg);
   if(UsePush)   SendNotification(msg);
}

//+------------------------------------------------------------------+
int OnCalculate(const int rates_total,const int prev_calculated,
                const datetime &time[],const double &open[],const double &high[],
                const double &low[],const double &close[],const long &tick_volume[],
                const long &volume[],const int &spread[])
{
   ArraySetAsSeries(time,true);  ArraySetAsSeries(open,true);
   ArraySetAsSeries(high,true);  ArraySetAsSeries(low,true);
   ArraySetAsSeries(close,true);

   int need=(MaxLegs+1)*(MaxLookback+LeftBars)+BandPeriod+RSI_Period+ExtremeBars+StructureLookback+2*StructureBars+20;
   if(rates_total<need) return(0);
   if(BarsCalculated(hRSI)<rates_total || BarsCalculated(hATR)<rates_total) return(0);

   int toCopy=(prev_calculated==0)? rates_total : rates_total-prev_calculated+1;
   if(toCopy>rates_total) toCopy=rates_total;
   if(CopyBuffer(hRSI,0,0,toCopy,RSIBuf)<=0) return(0);
   if(CopyBuffer(hATR,0,0,toCopy,ATRBuf)<=0) return(0);

   int limit=(prev_calculated==0)? rates_total-1 : rates_total-prev_calculated;
   int i,k;

   //--- TDI lines
   int mlimit=rates_total-BandPeriod-RSI_Period-2;
   if(prev_calculated>0 && limit<mlimit) mlimit=limit;
   for(i=mlimit;i>=0;i--)
   {
      double s=0;
      for(k=0;k<PriceLinePeriod;k++) s+=RSIBuf[i+k];
      PL[i]=s/PriceLinePeriod;
      s=0;
      for(k=0;k<SignalPeriod;k++) s+=RSIBuf[i+k];
      Sig[i]=s/SignalPeriod;
      s=0;
      for(k=0;k<BandPeriod;k++) s+=RSIBuf[i+k];
      double mean=s/BandPeriod, var=0;
      for(k=0;k<BandPeriod;k++) var+=MathPow(RSIBuf[i+k]-mean,2);
      double sd=MathSqrt(var/BandPeriod);
      Base[i]=mean; UpB[i]=mean+BandDev*sd; DnB[i]=mean-BandDev*sd;
   }

   //--- signal buffers
   int maxStart=rates_total-need;
   int dlimit;
   if(prev_calculated==0)
   {
      ArrayInitialize(SellBuf,EMPTY_VALUE); ArrayInitialize(BuyBuf,EMPTY_VALUE);
      ArrayInitialize(SellSL,EMPTY_VALUE);  ArrayInitialize(BuySL,EMPTY_VALUE);
      ArrayInitialize(TrendBuf,EMPTY_VALUE);
      dlimit=MathMin(maxStart,MaxBars);
      int tl=MathMin(300,maxStart);
      for(i=tl;i>=1;i--) TrendBuf[i]=TrendAt(i,rates_total,high,low,close);
   }
   else
   {
      for(i=0;i<=limit && i<rates_total;i++)
      { SellBuf[i]=EMPTY_VALUE; BuyBuf[i]=EMPTY_VALUE; SellSL[i]=EMPTY_VALUE; BuySL[i]=EMPTY_VALUE; TrendBuf[i]=EMPTY_VALUE; }
      if(limit==0) return(rates_total);                 // same candle: nothing new closed
      for(i=MathMin(limit,maxStart);i>=1;i--) TrendBuf[i]=TrendAt(i,rates_total,high,low,close);
      dlimit=MathMin(limit+ConfirmBars+1,maxStart);
   }
   if(DrawOnChart && TrendBuf[1]!=EMPTY_VALUE) DrawTrendLabel((int)TrendBuf[1]);

   int win=DrawOnChart? ChartWindowFind() : -1;
   bool live=(prev_calculated>0);
   int leg[];
   ArrayResize(leg,MaxLegs);

   for(i=dlimit;i>=2;i--)
   {
      //================= SELL =================
      if(PivotHigh(i,LeftBars,0,rates_total,high))
      {
         bool extreme=true;
         for(k=i+1;k<i+ExtremeBars;k++) if(high[k]>=high[i]) { extreme=false; break; }
         int turn=extreme? TurnBear(i,high,low,close) : -1;      // price actually turned down
         int j=(turn>0)? FindPrevHigh(i,rates_total,high) : -1;
         if(j>0 && high[i]>high[j] && TDIHigh(i)<=TDIHigh(j)+1.0) // raw divergence exists
         {
            string why="";
            int legs=1, cur=i; leg[0]=i;
            while(legs<MaxLegs)
            {
               int p=(legs==1)? j : FindPrevHigh(cur,rates_total,high);
               if(p<0) break;
               string w=BearWhy(cur,p,high,low);
               if(w!="") { if(legs==1) why=w; break; }
               leg[legs++]=p; cur=p;
            }
            int oldest=leg[legs-1];
            double tO=TDIHigh(oldest);
            int c=-1, tr=0;
            if(why=="" && legs<MinLegs)                                   why="legs "+IntegerToString(legs)+"<"+IntegerToString(MinLegs);
            if(why=="" && RequireOB && tO<FirstLegOB)                     why=StringFormat("TDI leg1 %.1f<%.0f",tO,FirstLegOB);
            if(why=="" && RequireOB && UseBandOB && tO<UpB[oldest])       why="TDI leg1 inside band";
            if(why=="") { c=ConfirmBear(i,open,high,low,close); if(c<0) why="no confirm candle"; }
            if(why=="" && UseTrendFilter)
            {
               tr=TrendAt(c,rates_total,high,low,close);
               bool ctOK=AllowCounterTrend && tO>=CounterTrendOB && (!CounterTrendNeedBand || tO>=UpB[oldest]);
               if(tr==1 && !ctOK) why="trend UP";
            }

            string id=IntegerToString((long)time[i]);
            if(why=="")
            {
               int sb=c;
               if(sb>=1 && (!live || sb<=limit))
               {
                  SellBuf[sb]=MathMin(PL[sb]+6,98);
                  SellSL[sb]=high[i];
                  if(DrawOnChart)
                  {
                     ObjectDelete(0,Pref+"SR_"+id);
                     for(int n=0;n<legs-1;n++)
                     {
                        int a=leg[n+1], b=leg[n];
                        DrawLine(Pref+"SP"+IntegerToString(n)+"_"+id,0,time[a],high[a],time[b],high[b],BearColor);
                        DrawLine(Pref+"ST"+IntegerToString(n)+"_"+id,win,time[a],TDIHigh(a),time[b],TDIHigh(b),BearColor);
                     }
                     DrawArrow(Pref+"SA_"+id,time[sb],high[sb],234,clrRed,ANCHOR_BOTTOM);
                     DrawText(Pref+"SX_"+id,time[i],high[i],"SELL L"+IntegerToString(legs),clrWhite,ANCHOR_LOWER);
                  }
                  if(live && sb==1 && lastAlertBar!=time[0])
                  {
                     lastAlertBar=time[0];
                     Notify(_Symbol+" "+EnumToString(_Period)+" CONFIRMED SELL divergence L"+IntegerToString(legs)+
                            "  SL above "+DoubleToString(high[i],_Digits));
                  }
               }
            }
            else if(DrawOnChart && ShowRejects)
               DrawText(Pref+"SR_"+id,time[i],high[i],"x "+why,clrGray,ANCHOR_LOWER,8);
         }
      }

      //================= BUY =================
      if(PivotLow(i,LeftBars,0,rates_total,low))
      {
         bool extreme=true;
         for(k=i+1;k<i+ExtremeBars;k++) if(low[k]<=low[i]) { extreme=false; break; }
         int turn=extreme? TurnBull(i,high,low,close) : -1;
         int j=(turn>0)? FindPrevLow(i,rates_total,low) : -1;
         if(j>0 && low[i]<low[j] && TDILow(i)>=TDILow(j)-1.0)
         {
            string why="";
            int legs=1, cur=i; leg[0]=i;
            while(legs<MaxLegs)
            {
               int p=(legs==1)? j : FindPrevLow(cur,rates_total,low);
               if(p<0) break;
               string w=BullWhy(cur,p,high,low);
               if(w!="") { if(legs==1) why=w; break; }
               leg[legs++]=p; cur=p;
            }
            int oldest=leg[legs-1];
            double tO=TDILow(oldest);
            int c=-1, tr=0;
            if(why=="" && legs<MinLegs)                                   why="legs "+IntegerToString(legs)+"<"+IntegerToString(MinLegs);
            if(why=="" && RequireOB && tO>FirstLegOS)                     why=StringFormat("TDI leg1 %.1f>%.0f",tO,FirstLegOS);
            if(why=="" && RequireOB && UseBandOB && tO>DnB[oldest])       why="TDI leg1 inside band";
            if(why=="") { c=ConfirmBull(i,open,high,low,close); if(c<0) why="no confirm candle"; }
            if(why=="" && UseTrendFilter)
            {
               tr=TrendAt(c,rates_total,high,low,close);
               bool ctOK=AllowCounterTrend && tO<=CounterTrendOS && (!CounterTrendNeedBand || tO<=DnB[oldest]);
               if(tr==-1 && !ctOK) why="trend DOWN";
            }

            string id=IntegerToString((long)time[i]);
            if(why=="")
            {
               int sb=c;
               if(sb>=1 && (!live || sb<=limit))
               {
                  BuyBuf[sb]=MathMax(PL[sb]-6,2);
                  BuySL[sb]=low[i];
                  if(DrawOnChart)
                  {
                     ObjectDelete(0,Pref+"BR_"+id);
                     for(int n=0;n<legs-1;n++)
                     {
                        int a=leg[n+1], b=leg[n];
                        DrawLine(Pref+"BP"+IntegerToString(n)+"_"+id,0,time[a],low[a],time[b],low[b],BullColor);
                        DrawLine(Pref+"BT"+IntegerToString(n)+"_"+id,win,time[a],TDILow(a),time[b],TDILow(b),BullColor);
                     }
                     DrawArrow(Pref+"BA_"+id,time[sb],low[sb],233,clrLime,ANCHOR_TOP);
                     DrawText(Pref+"BX_"+id,time[i],low[i],"BUY L"+IntegerToString(legs),clrWhite,ANCHOR_UPPER);
                  }
                  if(live && sb==1 && lastAlertBar!=time[0])
                  {
                     lastAlertBar=time[0];
                     Notify(_Symbol+" "+EnumToString(_Period)+" CONFIRMED BUY divergence L"+IntegerToString(legs)+
                            "  SL below "+DoubleToString(low[i],_Digits));
                  }
               }
            }
            else if(DrawOnChart && ShowRejects)
               DrawText(Pref+"BR_"+id,time[i],low[i],"x "+why,clrGray,ANCHOR_UPPER,8);
         }
      }
   }
   return(rates_total);
}
//+------------------------------------------------------------------+
