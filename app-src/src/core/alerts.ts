// "Needs your attention": everything the automation engine wants the owner to look at,
// in one list. Invoices to send, customers to remind, bills due, VAT and provisional
// tax deadlines, the monthly report, and bank lines to review.

import { Bill, Company, Customer, Expense, ExpenseCategory, Invoice } from './types';
import { balanceDue, daysBetween, needsReminder } from './automation';
import { buildFinancialSummary, calculateVat201, checkVatRegistrationWarning, estimateProvisionalTax, round2 } from './financialEngine';
import { formatCurrency, formatDate, todayIso } from './numbering';
import { ReminderLog } from '../db/automationRepo';
import { BudgetLine, Forecast } from './planning';

export type AttentionAction =
  | { type: 'send'; invoice: Invoice }
  | { type: 'remind'; invoice: Invoice }
  | { type: 'go'; to: string }
  | { type: 'vat_category' }
  | { type: 'done'; key: string }; // "I've done this" for tax deadlines

export interface AttentionItem {
  id: string;
  level: 'urgent' | 'soon' | 'info';
  title: string;
  detail?: string;
  actions: { label: string; action: AttentionAction }[];
}

export interface AttentionInput {
  company: Company;
  invoices: Invoice[];
  customers: Customer[];
  expenses: Expense[];
  bills: Bill[];
  categories: ExpenseCategory[];
  reminders: Map<string, ReminderLog>;
  settings: Record<string, string>;
  bankLinesToReview: number;
  canUseBills: boolean;
  canUseBanking: boolean;
  budgets?: BudgetLine[]; // Enterprise+: this month's budget lines
  forecast?: Forecast | null; // Enterprise+: cash-flow forecast, if a bank balance was entered
  today?: string;
}

// ---------- dates ----------

function lastDayOfMonth(y: number, m: number): string {
  const d = new Date(Date.UTC(y, m, 0)); // m is 1-12; day 0 of next month
  return d.toISOString().slice(0, 10);
}

/** Last weekday of a month (public holidays are not taken into account). */
export function lastBusinessDay(y: number, m: number): string {
  const d = new Date(Date.UTC(y, m, 0));
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

const monthName = (m: number) => new Date(Date.UTC(2000, m - 1, 1)).toLocaleDateString('en-ZA', { month: 'long', timeZone: 'UTC' });

/**
 * The VAT period that most recently ended before today, and its eFiling deadline
 * (last business day of the following month).
 * cycle: 'monthly', or for two-monthly vendors 'odd' (periods end Jan, Mar, May...) / 'even' (Feb, Apr, Jun...).
 */
export function latestVatPeriod(cycle: 'monthly' | 'odd' | 'even', today: string) {
  let y = Number(today.slice(0, 4));
  let m = Number(today.slice(5, 7)) - 1; // the period ending last month at the latest
  if (m === 0) {
    m = 12;
    y--;
  }
  if (cycle !== 'monthly') {
    const wantOdd = cycle === 'odd';
    if ((m % 2 === 1) !== wantOdd) {
      m--;
      if (m === 0) {
        m = 12;
        y--;
      }
    }
  }
  const months = cycle === 'monthly' ? 1 : 2;
  let sy = y;
  let sm = m - months + 1;
  if (sm <= 0) {
    sm += 12;
    sy--;
  }
  const start = `${sy}-${String(sm).padStart(2, '0')}-01`;
  const end = lastDayOfMonth(y, m);
  const dy = m === 12 ? y + 1 : y;
  const dm = m === 12 ? 1 : m + 1;
  return { start, end, deadline: lastBusinessDay(dy, dm), label: months === 1 ? `${monthName(m)} ${y}` : `${monthName(sm)} to ${monthName(m)} ${y}` };
}

/** SA provisional tax deadlines for a February year-end: 31 August and the last day of February. */
export function nextProvisionalDeadline(today: string): { date: string; which: 'first' | 'second' } {
  const y = Number(today.slice(0, 4));
  const candidates = [
    { date: `${y}-08-31`, which: 'first' as const },
    { date: lastDayOfMonth(y, 2), which: 'second' as const },
    { date: lastDayOfMonth(y + 1, 2), which: 'second' as const }
  ].filter((c) => c.date >= today);
  candidates.sort((a, b) => (a.date < b.date ? -1 : 1));
  return candidates[0];
}

// ---------- the list ----------

export function buildAttention(input: AttentionInput): AttentionItem[] {
  const today = input.today ?? todayIso();
  const { company, invoices, customers, settings } = input;
  const items: AttentionItem[] = [];
  const name = (id: string) => customers.find((c) => c.id === id)?.name ?? 'customer';

  // Invoices waiting to be sent (repeating invoices land here as drafts)
  for (const inv of invoices.filter((i) => i.status === 'draft' && i.invoiceDate <= today)) {
    items.push({
      id: `send-${inv.id}`,
      level: 'soon',
      title: `Invoice ${inv.invoiceNumber} for ${name(inv.customerId)} is ready to send`,
      detail: `${formatCurrency(inv.total)}, dated ${formatDate(inv.invoiceDate)}`,
      actions: [{ label: 'Send', action: { type: 'send', invoice: inv } }]
    });
  }

  // Customers to remind (overdue, and no reminder in the last 7 days)
  for (const inv of invoices.filter((i) => needsReminder(i, input.reminders.get(i.id), today))) {
    const days = daysBetween(inv.dueDate, today);
    const last = input.reminders.get(inv.id);
    items.push({
      id: `remind-${inv.id}`,
      level: days > 30 ? 'urgent' : 'soon',
      title: `${name(inv.customerId)} owes ${formatCurrency(balanceDue(inv))} (${inv.invoiceNumber})`,
      detail: `${days} day${days === 1 ? '' : 's'} overdue${last ? `. Last reminder ${formatDate(last.sentAt.slice(0, 10))}` : '. No reminder sent yet'}`,
      actions: [{ label: 'Send reminder', action: { type: 'remind', invoice: inv } }]
    });
  }

  // Supplier bills due within a week
  if (input.canUseBills) {
    const due = input.bills.filter((b) => b.status !== 'paid' && b.total - b.amountPaid > 0 && daysBetween(today, b.dueDate) <= 7);
    if (due.length) {
      const total = round2(due.reduce((s, b) => s + b.total - b.amountPaid, 0));
      const late = due.some((b) => b.dueDate < today);
      items.push({
        id: 'bills-due',
        level: late ? 'urgent' : 'soon',
        title: `${due.length} supplier bill${due.length === 1 ? '' : 's'} ${late ? 'overdue or ' : ''}due this week`,
        detail: `${formatCurrency(total)} to pay`,
        actions: [{ label: 'View bills', action: { type: 'go', to: '/bills' } }]
      });
    }
  }

  // VAT201
  if (company.isVatRegistered) {
    const cycle = company.vatPeriod === 'monthly' ? 'monthly' : (settings['vatCycle'] as 'odd' | 'even' | undefined);
    if (!cycle) {
      items.push({
        id: 'vat-cycle',
        level: 'info',
        title: 'Tell Setwel when your VAT periods end',
        detail: 'Then Setwel can remind you before each VAT201 is due, with the amount worked out.',
        actions: [{ label: 'Set it now', action: { type: 'vat_category' } }]
      });
    } else {
      const p = latestVatPeriod(cycle, today);
      const doneKey = `vatDone:${p.end}`;
      const daysLeft = daysBetween(today, p.deadline);
      if (!settings[doneKey] && daysLeft <= 21 && daysLeft >= -30) {
        const vat = calculateVat201(invoices, input.expenses, input.bills, p.start, p.end);
        items.push({
          id: `vat-${p.end}`,
          level: daysLeft < 0 ? 'urgent' : daysLeft <= 7 ? 'urgent' : 'soon',
          title: daysLeft < 0 ? `VAT201 for ${p.label} was due ${formatDate(p.deadline)}` : `VAT201 for ${p.label} is due ${formatDate(p.deadline)}`,
          detail: `${vat.netVat >= 0 ? 'Estimated VAT to pay' : 'Estimated VAT refund'}: ${formatCurrency(Math.abs(vat.netVat))}. eFiling deadline; check for public holidays.`,
          actions: [
            { label: 'Open VAT201', action: { type: 'go', to: '/reports/vat201' } },
            { label: "I've submitted it", action: { type: 'done', key: doneKey } }
          ]
        });
      }
    }
  } else {
    const yearAgo = new Date(Date.parse(today) - 365 * 86_400_000).toISOString().slice(0, 10);
    const turnover = invoices.filter((i) => i.status !== 'draft' && i.invoiceDate >= yearAgo).reduce((s, i) => s + i.subtotal, 0);
    const warn = checkVatRegistrationWarning(turnover);
    if (warn.shouldWarn) {
      items.push({
        id: 'vat-threshold',
        level: warn.percentOfThreshold >= 100 ? 'urgent' : 'info',
        title: `Your sales in the last 12 months are ${warn.percentOfThreshold}% of the R1 million VAT threshold`,
        detail: 'Above R1 million you must register for VAT. Speak to your accountant about timing.',
        actions: [{ label: 'Tax centre', action: { type: 'go', to: '/tax-centre' } }]
      });
    }
  }

  // Provisional tax (businesses that earn income outside a salary; not NPOs)
  if (company.businessType !== 'npo') {
    const next = nextProvisionalDeadline(today);
    const daysLeft = daysBetween(today, next.date);
    const doneKey = `provDone:${next.date}`;
    if (daysLeft <= 30 && !settings[doneKey]) {
      const costOfSalesIds = new Set(input.categories.filter((c) => c.type === 'cost_of_sales').map((c) => c.id));
      const yearAgo = new Date(Date.parse(today) - 365 * 86_400_000).toISOString().slice(0, 10);
      const summary = buildFinancialSummary({
        paidInvoices: invoices.filter((i) => i.status === 'paid' && i.invoiceDate >= yearAgo),
        expenses: input.expenses.filter((e) => e.expenseDate >= yearAgo),
        costOfSalesCategoryIds: costOfSalesIds,
        businessType: company.businessType,
        isVatRegistered: company.isVatRegistered
      });
      const est = estimateProvisionalTax(Math.max(0, summary.netProfit), company.businessType, company.ownerAgeBand);
      items.push({
        id: `prov-${next.date}`,
        level: daysLeft <= 7 ? 'urgent' : 'soon',
        title: `${next.which === 'first' ? 'First' : 'Second'} provisional tax payment due ${formatDate(next.date)}`,
        detail: `Rough estimate from your last 12 months: ${formatCurrency(next.which === 'first' ? est.firstPeriodPayment : est.secondPeriodPayment)}. Confirm with your accountant.`,
        actions: [
          { label: 'Tax centre', action: { type: 'go', to: '/tax-centre' } },
          { label: "I've paid it", action: { type: 'done', key: doneKey } }
        ]
      });
    }
  }

  // Budgets (Enterprise+)
  for (const b of input.budgets ?? []) {
    if (b.status !== 'warn' && b.status !== 'over') continue;
    items.push({
      id: `budget-${b.category.id}`,
      level: b.status === 'over' ? 'urgent' : 'soon',
      title: b.status === 'over' ? `Over budget on ${b.category.name}` : `${b.pct}% of the ${b.category.name} budget used`,
      detail: `${formatCurrency(b.spent)} spent of ${formatCurrency(b.budget)} this month`,
      actions: [{ label: 'Budgets', action: { type: 'go', to: '/budgets' } }]
    });
  }

  // Cash-flow warning (Enterprise+): balance expected to go below zero within 4 weeks
  const low = input.forecast?.weeks.slice(0, 4).find((w) => w.closing < 0);
  if (low) {
    items.push({
      id: 'cashflow-low',
      level: 'urgent',
      title: `Cash may run short in the week of ${formatDate(low.start)}`,
      detail: `Expected bank balance ${formatCurrency(low.closing)}. Chase overdue invoices now.`,
      actions: [{ label: 'Cash-flow forecast', action: { type: 'go', to: '/cashflow' } }]
    });
  }

  // Bank lines to review
  if (input.canUseBanking && input.bankLinesToReview > 0) {
    items.push({
      id: 'bank-review',
      level: 'info',
      title: `${input.bankLinesToReview} bank transaction${input.bankLinesToReview === 1 ? '' : 's'} to review`,
      actions: [{ label: 'Review', action: { type: 'go', to: '/banking' } }]
    });
  }

  // Monthly report, first 10 days of each month
  const day = Number(today.slice(8, 10));
  if (day <= 10) {
    const d = new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 2, 1));
    const month = d.toISOString().slice(0, 7);
    if (!settings[`reportSeen:${month}`]) {
      items.push({
        id: `report-${month}`,
        level: 'info',
        title: `Your ${monthName(d.getUTCMonth() + 1)} report is ready`,
        detail: 'Money in, money out, profit and who owes you, for last month.',
        actions: [{ label: 'Open report', action: { type: 'go', to: `/reports/monthly?month=${month}` } }]
      });
    }
  }

  const order = { urgent: 0, soon: 1, info: 2 };
  return items.sort((a, b) => order[a.level] - order[b.level]);
}
