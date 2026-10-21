//+------------------------------------------------------------------+
//| LH_ExportSymbolSpec.mq5                                          |
//| Writes contract specifications, trading sessions and the broker  |
//| server's UTC offset to MQL5/Files/LH_spec_<broker>_<symbol>.csv  |
//| Read-only: places no orders.                                     |
//+------------------------------------------------------------------+
#property copyright "Liquidity Hunter project"
#property version   "1.00"
#property script_show_inputs

input string InpSymbols = "XAUUSD,EURUSD";   // Symbols, comma-separated, exactly as in Market Watch

void W(const int h, const string key, const string value)
  {
   FileWrite(h, key, value);
  }

string D(const double v)
  {
   return DoubleToString(v, 10);
  }

string I(const long v)
  {
   return IntegerToString(v);
  }

void ExportSymbol(const string sym)
  {
   if(!SymbolSelect(sym, true))
     {
      PrintFormat("LH: symbol %s not found (check exact name, e.g. a suffix like 'm')", sym);
      return;
     }
   string company = AccountInfoString(ACCOUNT_COMPANY);
   StringReplace(company, " ", "_");
   string name = "LH_spec_" + company + "_" + sym + ".csv";
   int h = FileOpen(name, FILE_WRITE | FILE_CSV | FILE_ANSI, ',');
   if(h == INVALID_HANDLE)
     {
      PrintFormat("LH: cannot open %s, error %d", name, GetLastError());
      return;
     }

   W(h, "key", "value");
   W(h, "export_time_gmt", TimeToString(TimeGMT(), TIME_DATE | TIME_SECONDS));
   W(h, "export_time_server", TimeToString(TimeTradeServer(), TIME_DATE | TIME_SECONDS));
   W(h, "server_minus_gmt_seconds", I((long)(TimeTradeServer() - TimeGMT())));
   W(h, "account_company", AccountInfoString(ACCOUNT_COMPANY));
   W(h, "account_server", AccountInfoString(ACCOUNT_SERVER));
   W(h, "account_currency", AccountInfoString(ACCOUNT_CURRENCY));
   W(h, "account_margin_mode", EnumToString((ENUM_ACCOUNT_MARGIN_MODE)AccountInfoInteger(ACCOUNT_MARGIN_MODE)));
   W(h, "account_leverage", I(AccountInfoInteger(ACCOUNT_LEVERAGE)));

   W(h, "symbol", sym);
   W(h, "description", SymbolInfoString(sym, SYMBOL_DESCRIPTION));
   W(h, "currency_base", SymbolInfoString(sym, SYMBOL_CURRENCY_BASE));
   W(h, "currency_profit", SymbolInfoString(sym, SYMBOL_CURRENCY_PROFIT));
   W(h, "currency_margin", SymbolInfoString(sym, SYMBOL_CURRENCY_MARGIN));
   W(h, "digits", I(SymbolInfoInteger(sym, SYMBOL_DIGITS)));
   W(h, "point", D(SymbolInfoDouble(sym, SYMBOL_POINT)));
   W(h, "tick_size", D(SymbolInfoDouble(sym, SYMBOL_TRADE_TICK_SIZE)));
   W(h, "tick_value", D(SymbolInfoDouble(sym, SYMBOL_TRADE_TICK_VALUE)));
   W(h, "tick_value_profit", D(SymbolInfoDouble(sym, SYMBOL_TRADE_TICK_VALUE_PROFIT)));
   W(h, "tick_value_loss", D(SymbolInfoDouble(sym, SYMBOL_TRADE_TICK_VALUE_LOSS)));
   W(h, "contract_size", D(SymbolInfoDouble(sym, SYMBOL_TRADE_CONTRACT_SIZE)));
   W(h, "volume_min", D(SymbolInfoDouble(sym, SYMBOL_VOLUME_MIN)));
   W(h, "volume_max", D(SymbolInfoDouble(sym, SYMBOL_VOLUME_MAX)));
   W(h, "volume_step", D(SymbolInfoDouble(sym, SYMBOL_VOLUME_STEP)));
   W(h, "volume_limit", D(SymbolInfoDouble(sym, SYMBOL_VOLUME_LIMIT)));
   W(h, "stops_level_points", I(SymbolInfoInteger(sym, SYMBOL_TRADE_STOPS_LEVEL)));
   W(h, "freeze_level_points", I(SymbolInfoInteger(sym, SYMBOL_TRADE_FREEZE_LEVEL)));
   W(h, "spread_now_points", I(SymbolInfoInteger(sym, SYMBOL_SPREAD)));
   W(h, "spread_float", I(SymbolInfoInteger(sym, SYMBOL_SPREAD_FLOAT)));
   W(h, "calc_mode", EnumToString((ENUM_SYMBOL_CALC_MODE)SymbolInfoInteger(sym, SYMBOL_TRADE_CALC_MODE)));
   W(h, "trade_mode", EnumToString((ENUM_SYMBOL_TRADE_MODE)SymbolInfoInteger(sym, SYMBOL_TRADE_MODE)));
   W(h, "execution_mode", EnumToString((ENUM_SYMBOL_TRADE_EXECUTION)SymbolInfoInteger(sym, SYMBOL_TRADE_EXEMODE)));
   W(h, "filling_mode_flags", I(SymbolInfoInteger(sym, SYMBOL_FILLING_MODE)));
   W(h, "order_mode_flags", I(SymbolInfoInteger(sym, SYMBOL_ORDER_MODE)));
   W(h, "swap_mode", EnumToString((ENUM_SYMBOL_SWAP_MODE)SymbolInfoInteger(sym, SYMBOL_SWAP_MODE)));
   W(h, "swap_long", D(SymbolInfoDouble(sym, SYMBOL_SWAP_LONG)));
   W(h, "swap_short", D(SymbolInfoDouble(sym, SYMBOL_SWAP_SHORT)));
   W(h, "swap_rollover3days", EnumToString((ENUM_DAY_OF_WEEK)SymbolInfoInteger(sym, SYMBOL_SWAP_ROLLOVER3DAYS)));
   W(h, "margin_initial", D(SymbolInfoDouble(sym, SYMBOL_MARGIN_INITIAL)));

   // Trading sessions in server time, per weekday (seconds after midnight)
   for(int day = SUNDAY; day <= SATURDAY; day++)
     {
      datetime from, to;
      for(uint s = 0; SymbolInfoSessionTrade(sym, (ENUM_DAY_OF_WEEK)day, s, from, to); s++)
         W(h, StringFormat("session_trade_%s_%u", EnumToString((ENUM_DAY_OF_WEEK)day), s),
           I((long)from) + "-" + I((long)to));   // seconds after server midnight; 86400 = end of day
     }

   // Oldest data available in this terminal
   W(h, "first_m1_bar_server_time", TimeToString((datetime)SeriesInfoInteger(sym, PERIOD_M1, SERIES_FIRSTDATE), TIME_DATE | TIME_SECONDS));
   W(h, "server_first_date", TimeToString((datetime)SeriesInfoInteger(sym, PERIOD_M1, SERIES_SERVER_FIRSTDATE), TIME_DATE | TIME_SECONDS));

   FileClose(h);
   PrintFormat("LH: wrote MQL5\\Files\\%s", name);
  }

void OnStart()
  {
   string parts[];
   int n = StringSplit(InpSymbols, ',', parts);
   for(int i = 0; i < n; i++)
     {
      string sym = parts[i];
      StringTrimLeft(sym);
      StringTrimRight(sym);
      if(sym != "")
         ExportSymbol(sym);
     }
  }
