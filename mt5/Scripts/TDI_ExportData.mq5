//+------------------------------------------------------------------+
//|                                               TDI_ExportData.mq5 |
//|  Phase 0 data export: M1 bars, raw ticks and contract specs for  |
//|  each symbol, written to MQL5\Files\phase0\.                     |
//|  Run once: Navigator > Scripts > drag onto any chart > OK.       |
//|  Then zip the MQL5\Files\phase0 folder and upload it.            |
//+------------------------------------------------------------------+
#property version     "1.10"
#property description "Exports M1 bars, ticks and contract specs for the Phase 0 randomness tests"
#property script_show_inputs

input string InpSymbols  = "Volatility 10 Index,Volatility 25 Index,Volatility 50 Index,Boom 1000 Index,Crash 1000 Index,Crash 600 Index,Crash 100 Index,XAUUSDmicro"; // Symbols, comma separated (exact Market Watch names)
input int    InpBarDays  = 180;   // Days of M1 bars
input int    InpTickDays = 7;     // Days of raw ticks (0 = no ticks)
input datetime InpFrom    = 0;     // Optional fixed start date for M1 bars (0 = use InpBarDays back from now)
input datetime InpTo      = 0;     // Optional fixed end date for M1 bars (0 = now)

string SafeName(string s) { StringReplace(s," ","_"); StringReplace(s,"/","_"); return(s); }

bool ExportBars(string sym,string dir)
{
   datetime to=(InpTo>0 ? InpTo : TimeCurrent());
   datetime from=(InpFrom>0 ? InpFrom : to-(datetime)InpBarDays*86400);
   MqlRates r[];
   int n=-1;
   for(int a=0;a<20 && n<=0;a++)                 // history may need downloading first
   {
      n=CopyRates(sym,PERIOD_M1,from,to,r);
      if(n<=0) Sleep(1000);
   }
   if(n<=0) { Print(sym,": no M1 bars (error ",GetLastError(),")"); return(false); }
   int f=FileOpen(dir+"\\"+SafeName(sym)+"_M1.csv",FILE_WRITE|FILE_TXT|FILE_ANSI);
   if(f==INVALID_HANDLE) { Print(sym,": cannot write bars"); return(false); }
   FileWriteString(f,"time,open,high,low,close,tick_volume,spread\r\n");
   int dg=(int)SymbolInfoInteger(sym,SYMBOL_DIGITS);
   for(int i=0;i<n;i++)
      FileWriteString(f,IntegerToString((long)r[i].time)+","+DoubleToString(r[i].open,dg)+","+DoubleToString(r[i].high,dg)+","+
                        DoubleToString(r[i].low,dg)+","+DoubleToString(r[i].close,dg)+","+IntegerToString(r[i].tick_volume)+","+
                        IntegerToString(r[i].spread)+"\r\n");
   FileClose(f);
   Print(sym,": ",n," M1 bars from ",TimeToString(r[0].time)," to ",TimeToString(r[n-1].time),
         (InpFrom==0 && n<InpBarDays*1440*0.9 ? "  (fewer than requested: raise Tools > Options > Charts > Max bars in chart)" : ""));
   return(true);
}

bool ExportTicks(string sym,string dir)
{
   if(InpTickDays<=0) return(false);
   ulong to=(ulong)TimeCurrent()*1000, from=to-(ulong)InpTickDays*86400*1000;
   MqlTick t[];
   int n=-1;
   for(int a=0;a<20 && n<=0;a++)
   {
      n=CopyTicksRange(sym,t,COPY_TICKS_ALL,from,to);
      if(n<=0) Sleep(1000);
   }
   if(n<=0) { Print(sym,": no ticks (error ",GetLastError(),")"); return(false); }
   int f=FileOpen(dir+"\\"+SafeName(sym)+"_ticks.csv",FILE_WRITE|FILE_TXT|FILE_ANSI);
   if(f==INVALID_HANDLE) { Print(sym,": cannot write ticks"); return(false); }
   FileWriteString(f,"time_msc,bid,ask\r\n");
   int dg=(int)SymbolInfoInteger(sym,SYMBOL_DIGITS);
   for(int i=0;i<n;i++)
      FileWriteString(f,IntegerToString((long)t[i].time_msc)+","+DoubleToString(t[i].bid,dg)+","+DoubleToString(t[i].ask,dg)+"\r\n");
   FileClose(f);
   Print(sym,": ",n," ticks");
   return(true);
}

void ExportSpec(string sym,string dir)
{
   int f=FileOpen(dir+"\\"+SafeName(sym)+"_spec.csv",FILE_WRITE|FILE_TXT|FILE_ANSI);
   if(f==INVALID_HANDLE) return;
   FileWriteString(f,"key,value\r\n");
   FileWriteString(f,"symbol,"+sym+"\r\n");
   FileWriteString(f,"description,"+SymbolInfoString(sym,SYMBOL_DESCRIPTION)+"\r\n");
   FileWriteString(f,"digits,"+IntegerToString(SymbolInfoInteger(sym,SYMBOL_DIGITS))+"\r\n");
   FileWriteString(f,"point,"+DoubleToString(SymbolInfoDouble(sym,SYMBOL_POINT),10)+"\r\n");
   FileWriteString(f,"tick_size,"+DoubleToString(SymbolInfoDouble(sym,SYMBOL_TRADE_TICK_SIZE),10)+"\r\n");
   FileWriteString(f,"tick_value,"+DoubleToString(SymbolInfoDouble(sym,SYMBOL_TRADE_TICK_VALUE),10)+"\r\n");
   FileWriteString(f,"contract_size,"+DoubleToString(SymbolInfoDouble(sym,SYMBOL_TRADE_CONTRACT_SIZE),4)+"\r\n");
   FileWriteString(f,"volume_min,"+DoubleToString(SymbolInfoDouble(sym,SYMBOL_VOLUME_MIN),4)+"\r\n");
   FileWriteString(f,"volume_step,"+DoubleToString(SymbolInfoDouble(sym,SYMBOL_VOLUME_STEP),4)+"\r\n");
   FileWriteString(f,"volume_max,"+DoubleToString(SymbolInfoDouble(sym,SYMBOL_VOLUME_MAX),4)+"\r\n");
   FileWriteString(f,"stops_level,"+IntegerToString(SymbolInfoInteger(sym,SYMBOL_TRADE_STOPS_LEVEL))+"\r\n");
   FileWriteString(f,"freeze_level,"+IntegerToString(SymbolInfoInteger(sym,SYMBOL_TRADE_FREEZE_LEVEL))+"\r\n");
   FileWriteString(f,"spread_points,"+IntegerToString(SymbolInfoInteger(sym,SYMBOL_SPREAD))+"\r\n");
   FileWriteString(f,"swap_long,"+DoubleToString(SymbolInfoDouble(sym,SYMBOL_SWAP_LONG),4)+"\r\n");
   FileWriteString(f,"swap_short,"+DoubleToString(SymbolInfoDouble(sym,SYMBOL_SWAP_SHORT),4)+"\r\n");
   FileClose(f);
}

void OnStart()
{
   string dir="phase0";
   FolderCreate(dir);
   string parts[];
   int n=StringSplit(InpSymbols,',',parts);
   int ok=0;
   for(int i=0;i<n;i++)
   {
      string sym=parts[i];
      StringTrimLeft(sym); StringTrimRight(sym);
      if(sym=="") continue;
      if(!SymbolSelect(sym,true)) { Print(sym,": not found in Market Watch - check the exact name"); continue; }
      bool b=ExportBars(sym,dir);
      bool t=ExportTicks(sym,dir);
      ExportSpec(sym,dir);
      if(b || t) ok++;
   }
   string m=StringFormat("Phase 0 export finished: %d of %d symbols. Files in MQL5\\Files\\phase0 (File > Open Data Folder). Zip that folder and upload it.",ok,n);
   Print(m);
   Alert(m);
}
//+------------------------------------------------------------------+
