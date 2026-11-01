// Budgets and the cash-flow forecast (Enterprise and Accountant Partner).

import { Bill, Expense, ExpenseCategory, Invoice } from './types';
import { RecurringInvoice } from '../db/automationRepo';
import { advanceDate, balanceDue } from './automation';
import { addDays, todayIso } from './numbering';
import { round2 } from './financialEngine';

// ---------- Budgets ----------

export interface BudgetLine {
  category: ExpenseCategory;
  budget: number;
  spent: number; // this month, excl. VAT
  pct: number; // spent / budget * 100, 0 when no budget
  status: 'none' | 'ok' | 'warn' | 'over';
}

/** Spend per category for a month (YYYY-MM), excluding VAT like the profit and loss. */
export function budgetLines(categories: ExpenseCategory[], expenses: Expense[], bills: Bill[], budgets: Map<string, number>, month: string): BudgetLine[] {
  const spent = new Map<string, number>();
  for (const e of expenses) {
    if (e.expenseDate.slice(0, 7) !== month) continue;
    const excl = e.vatApplicable ? e.amount - e.vatAmount : e.amount;
    spent.set(e.categoryId, (spent.get(e.categoryId) ?? 0) + excl);
  }
  return categories.map((category) => {
    const budget = budgets.get(category.id) ?? 0;
    const s = round2(spent.get(category.id) ?? 0);
    const pct = budget > 0 ? Math.round((s / budget) * 100) : 0;
    const status = budget <= 0 ? 'none' : pct >= 100 ? 'over' : pct >= 80 ? 'warn' : 'ok';
    return { category, budget, spent: s, pct, status };
  });
}

// ---------- Cash-flow forecast ----------

export interface ForecastWeek {
  start: string; // Monday-based week start (YYYY-MM-DD)
  end: string;
  moneyIn: number;
  moneyOut: number;
  closing: number; // expected bank balance at the end of the week
  details: { label: string; amount: number }[];
}

export interface Forecast {
  opening: number;
  openingDate: string;
  weeks: ForecastWeek[];
  lowest: { amount: number; week: ForecastWeek | null };
  averageWeeklySpend: number;
}

/**
 * Next 13 weeks, starting with the bank balance the owner enters. Money in: unpaid
 * invoices on their due dates (already overdue = this week) and repeating invoices.
 * Money out: unpaid supplier bills on their due dates, plus everyday spending at the
 * weekly average of the last 3 months of recorded expenses.
 */
export function buildForecast(input: {
  opening: number;
  openingDate?: string;
  invoices: Invoice[];
  bills: Bill[];
  expenses: Expense[];
  recurring: RecurringInvoice[];
  today?: string;
}): Forecast {
  const today = input.today ?? todayIso();
  const weeks: ForecastWeek[] = Array.from({ length: 13 }, (_, i) => {
    const start = addDays(today, i * 7);
    return { start, end: addDays(start, 6), moneyIn: 0, moneyOut: 0, closing: 0, details: [] };
  });
  const weekFor = (date: string) => {
    if (date < today) return weeks[0];
    return weeks.find((w) => date >= w.start && date <= w.end) ?? null;
  };
  const add = (date: string, amount: number, label: string) => {
    const w = weekFor(date);
    if (!w || amount === 0) return;
    if (amount > 0) w.moneyIn += amount;
    else w.moneyOut += -amount;
    w.details.push({ label, amount: round2(amount) });
  };

  for (const inv of input.invoices) {
    if (inv.status === 'paid' || inv.status === 'draft') continue;
    const due = balanceDue(inv);
    if (due > 0) add(inv.dueDate, due, `Invoice ${inv.invoiceNumber}${inv.dueDate < today ? ' (overdue)' : ''}`);
  }

  const horizon = weeks[weeks.length - 1].end;
  const byId = new Map(input.invoices.map((i) => [i.id, i]));
  for (const r of input.recurring) {
    if (!r.active) continue;
    const src = byId.get(r.sourceInvoiceId);
    if (!src) continue;
    const terms = Math.max(0, Math.round((Date.parse(src.dueDate) - Date.parse(src.invoiceDate)) / 86_400_000));
    let d = r.nextDate;
    let guard = 0;
    while (d <= horizon && (!r.endDate || d <= r.endDate) && guard < 60) {
      add(addDays(d, terms), src.total, `Repeating invoice (${src.invoiceNumber})`);
      d = advanceDate(d, r.frequency);
      guard++;
    }
  }

  for (const b of input.bills) {
    if (b.status === 'paid') continue;
    const due = round2(b.total - b.amountPaid);
    if (due > 0) add(b.dueDate, -due, `Bill ${b.billNumber}${b.dueDate < today ? ' (overdue)' : ''}`);
  }

  // Everyday spending: weekly average of the last 90 days of expenses
  const since = addDays(today, -90);
  const recent = input.expenses.filter((e) => e.expenseDate >= since && e.expenseDate <= today).reduce((s, e) => s + e.amount, 0);
  const averageWeeklySpend = round2((recent / 90) * 7);
  if (averageWeeklySpend > 0) {
    for (const w of weeks) {
      w.moneyOut += averageWeeklySpend;
      w.details.push({ label: 'Everyday spending (average)', amount: -averageWeeklySpend });
    }
  }

  let balance = input.opening;
  let lowest: Forecast['lowest'] = { amount: input.opening, week: null };
  for (const w of weeks) {
    w.moneyIn = round2(w.moneyIn);
    w.moneyOut = round2(w.moneyOut);
    balance = round2(balance + w.moneyIn - w.moneyOut);
    w.closing = balance;
    if (balance < lowest.amount) lowest = { amount: balance, week: w };
  }
  return { opening: input.opening, openingDate: input.openingDate ?? today, weeks, lowest, averageWeeklySpend };
}
