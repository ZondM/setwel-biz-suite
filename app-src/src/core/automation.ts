// The automation engine. Runs inside the app each time it opens (and every hour while
// it stays open): creates repeating invoices that are due and works out which unpaid
// invoices need a reminder. Messages are prepared here; the customer sends them with one tap.

import { Company, Customer, Invoice } from './types';
import { addDays, formatCurrency, formatDate, todayIso, uid } from './numbering';
import { getInvoice, getNextInvoiceNumber, getSetting, saveInvoice } from '../db/repository';
import { Frequency, listRecurring, saveRecurring, ReminderLog } from '../db/automationRepo';

// ---------- Dates ----------

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((Date.parse(toIso) - Date.parse(fromIso)) / 86_400_000);
}

/** Moves a date on by one period, keeping month-end dates sensible (31 Jan + 1 month = 28/29 Feb). */
export function advanceDate(iso: string, frequency: Frequency): string {
  if (frequency === 'weekly') return addDays(iso, 7);
  const months = frequency === 'monthly' ? 1 : frequency === 'quarterly' ? 3 : 12;
  const [y, m, d] = iso.split('-').map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
}

export const FREQUENCY_LABELS: Record<Frequency, string> = {
  weekly: 'Every week',
  monthly: 'Every month',
  quarterly: 'Every 3 months',
  yearly: 'Every year'
};

// ---------- Repeating invoices ----------

/**
 * Creates every repeating invoice that has come due (catching up if the app wasn't
 * opened for a while, up to 24 at a time). New invoices are saved as drafts so the
 * owner checks them before sending; they appear under "Needs your attention".
 */
export function runRecurringInvoices(companyId: string, today = todayIso()): Invoice[] {
  const created: Invoice[] = [];
  const prefix = getSetting(companyId, 'invoicePrefix') || 'INV';
  for (const rec of listRecurring(companyId)) {
    if (!rec.active || rec.nextDate > today) continue;
    const source = getInvoice(rec.sourceInvoiceId);
    if (!source) {
      saveRecurring({ ...rec, active: false });
      continue;
    }
    const termsDays = Math.max(0, daysBetween(source.invoiceDate, source.dueDate));
    let next = rec.nextDate;
    let guard = 0;
    while (next <= today && (!rec.endDate || next <= rec.endDate) && guard < 24) {
      const inv = saveInvoice({
        ...source,
        id: uid('inv_'),
        quoteId: undefined,
        invoiceNumber: getNextInvoiceNumber(companyId, prefix),
        invoiceDate: next,
        dueDate: addDays(next, termsDays),
        status: 'draft',
        amountPaid: 0,
        items: source.items.map((it) => ({ ...it, id: uid('li_') }))
      });
      created.push(inv);
      next = advanceDate(next, rec.frequency);
      guard++;
    }
    const finished = !!rec.endDate && next > rec.endDate;
    saveRecurring({ ...rec, nextDate: next, lastRun: today, active: rec.active && !finished });
  }
  return created;
}

// ---------- Reminders ----------

export function balanceDue(inv: Invoice): number {
  return Math.max(0, Math.round((inv.total - inv.amountPaid) * 100) / 100);
}

export function isOverdue(inv: Invoice, today = todayIso()): boolean {
  return inv.status !== 'paid' && inv.status !== 'draft' && inv.dueDate < today && balanceDue(inv) > 0;
}

/** An overdue invoice needs a reminder if none was sent yet, or the last one was a week or more ago. */
export function needsReminder(inv: Invoice, last: ReminderLog | undefined, today = todayIso()): boolean {
  if (!isOverdue(inv, today)) return false;
  if (!last) return true;
  return daysBetween(last.sentAt.slice(0, 10), today) >= 7;
}

// ---------- Messages ----------

function paymentDetails(company: Company, inv: Invoice): string {
  if (!company.bankAccountNumber) return '';
  const parts = [
    company.bankName,
    company.bankAccountHolder && `Account name: ${company.bankAccountHolder}`,
    `Account number: ${company.bankAccountNumber}`,
    company.bankBranchCode && `Branch code: ${company.bankBranchCode}`,
    `Reference: ${inv.invoiceNumber}`
  ].filter(Boolean);
  return `\n\nBanking details for EFT:\n${parts.join('\n')}`;
}

export function invoiceMessage(company: Company, customer: Customer | null, inv: Invoice): { subject: string; body: string } {
  const name = customer?.name ? ` ${customer.name}` : '';
  return {
    subject: `Invoice ${inv.invoiceNumber} from ${company.name}`,
    body:
      `Hi${name},\n\nPlease find invoice ${inv.invoiceNumber} for ${formatCurrency(inv.total)}, due ${formatDate(inv.dueDate)}.` +
      paymentDetails(company, inv) +
      `\n\nThank you for your business.\n${company.name}`
  };
}

/** Polite first, firmer as the invoice gets older. */
export function reminderMessage(company: Company, customer: Customer | null, inv: Invoice, today = todayIso()): { subject: string; body: string } {
  const name = customer?.name ? ` ${customer.name}` : '';
  const days = daysBetween(inv.dueDate, today);
  const amount = formatCurrency(balanceDue(inv));
  let line: string;
  if (days <= 14) {
    line = `This is a friendly reminder that invoice ${inv.invoiceNumber} for ${amount} was due on ${formatDate(inv.dueDate)}. If you've already paid, thank you, and please ignore this message.`;
  } else if (days <= 44) {
    line = `Invoice ${inv.invoiceNumber} for ${amount} is now ${days} days overdue (due ${formatDate(inv.dueDate)}). Please arrange payment this week, or let us know if there is a problem.`;
  } else {
    line = `Invoice ${inv.invoiceNumber} for ${amount} is ${days} days overdue. Please settle it urgently or contact us today to agree a payment plan.`;
  }
  return {
    subject: `Payment reminder: invoice ${inv.invoiceNumber} from ${company.name}`,
    body: `Hi${name},\n\n${line}` + paymentDetails(company, inv) + `\n\nKind regards,\n${company.name}`
  };
}

/** WhatsApp link. SA numbers starting with 0 are converted to +27. */
export function whatsappUrl(phone: string | undefined, text: string): string {
  let digits = (phone ?? '').replace(/[^0-9]/g, '');
  if (digits.startsWith('0')) digits = '27' + digits.slice(1);
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
