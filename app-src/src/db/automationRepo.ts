// Storage for the automation features: repeating invoices, reminders sent,
// imported bank statement lines and the categories Setwel has learnt for them.
import { run, query, queryOne } from './database';
import { uid } from '../core/numbering';

const nowIso = () => new Date().toISOString();

// ---------- Repeating invoices ----------

export type Frequency = 'weekly' | 'monthly' | 'quarterly' | 'yearly';

export interface RecurringInvoice {
  id: string;
  companyId: string;
  sourceInvoiceId: string;
  frequency: Frequency;
  nextDate: string;
  endDate?: string;
  active: boolean;
  lastRun?: string;
}

function rowToRecurring(r: any): RecurringInvoice {
  return {
    id: r.id,
    companyId: r.company_id,
    sourceInvoiceId: r.source_invoice_id,
    frequency: r.frequency,
    nextDate: r.next_date,
    endDate: r.end_date ?? undefined,
    active: !!r.active,
    lastRun: r.last_run ?? undefined
  };
}

export function listRecurring(companyId: string): RecurringInvoice[] {
  return query<any>('SELECT * FROM recurring_invoices WHERE company_id = :cid ORDER BY next_date ASC', { ':cid': companyId }).map(rowToRecurring);
}

export function getRecurringForInvoice(invoiceId: string): RecurringInvoice | null {
  const r = queryOne<any>('SELECT * FROM recurring_invoices WHERE source_invoice_id = :id', { ':id': invoiceId });
  return r ? rowToRecurring(r) : null;
}

export function saveRecurring(r: Omit<RecurringInvoice, 'id'> & { id?: string }): RecurringInvoice {
  const id = r.id ?? uid('rec_');
  const params = {
    ':id': id,
    ':cid': r.companyId,
    ':src': r.sourceInvoiceId,
    ':freq': r.frequency,
    ':next': r.nextDate,
    ':end': r.endDate ?? null,
    ':active': r.active ? 1 : 0,
    ':last': r.lastRun ?? null
  };
  if (r.id && queryOne('SELECT id FROM recurring_invoices WHERE id = :id', { ':id': r.id })) {
    run('UPDATE recurring_invoices SET frequency=:freq, next_date=:next, end_date=:end, active=:active, last_run=:last, source_invoice_id=:src WHERE id=:id', params);
  } else {
    run(
      'INSERT INTO recurring_invoices (id, company_id, source_invoice_id, frequency, next_date, end_date, active, last_run, created_at) VALUES (:id,:cid,:src,:freq,:next,:end,:active,:last,:created)',
      { ...params, ':created': nowIso() }
    );
  }
  return rowToRecurring(queryOne('SELECT * FROM recurring_invoices WHERE id = :id', { ':id': id }));
}

export function deleteRecurring(id: string) {
  run('DELETE FROM recurring_invoices WHERE id = :id', { ':id': id });
}

// ---------- Reminders ----------

export interface ReminderLog {
  invoiceId: string;
  channel: 'whatsapp' | 'email';
  sentAt: string;
}

export function logReminder(companyId: string, invoiceId: string, channel: 'whatsapp' | 'email') {
  run('INSERT INTO reminders (id, company_id, invoice_id, channel, sent_at) VALUES (:id,:cid,:inv,:ch,:at)', {
    ':id': uid('rem_'),
    ':cid': companyId,
    ':inv': invoiceId,
    ':ch': channel,
    ':at': nowIso()
  });
}

/** Most recent reminder per invoice. */
export function lastReminders(companyId: string): Map<string, ReminderLog> {
  const rows = query<any>('SELECT invoice_id, channel, MAX(sent_at) AS sent_at FROM reminders WHERE company_id = :cid GROUP BY invoice_id', { ':cid': companyId });
  return new Map(rows.map((r) => [r.invoice_id, { invoiceId: r.invoice_id, channel: r.channel, sentAt: r.sent_at }]));
}

// ---------- Bank statement lines ----------

export type BankLineStatus = 'new' | 'matched' | 'ignored';

export interface BankLine {
  id: string;
  companyId: string;
  date: string;
  description: string;
  amount: number; // money in is positive, money out is negative
  fingerprint: string;
  status: BankLineStatus;
  matchType?: 'invoice' | 'expense' | 'bill';
  matchId?: string;
  importedAt: string;
}

function rowToBankLine(r: any): BankLine {
  return {
    id: r.id,
    companyId: r.company_id,
    date: r.line_date,
    description: r.description,
    amount: r.amount,
    fingerprint: r.fingerprint,
    status: r.status,
    matchType: r.match_type ?? undefined,
    matchId: r.match_id ?? undefined,
    importedAt: r.imported_at
  };
}

export function listBankLines(companyId: string): BankLine[] {
  return query<any>('SELECT * FROM bank_lines WHERE company_id = :cid ORDER BY line_date DESC, rowid DESC', { ':cid': companyId }).map(rowToBankLine);
}

/** Adds lines that aren't already stored. Returns how many were new. */
export function addBankLines(companyId: string, lines: { date: string; description: string; amount: number; fingerprint: string }[]): number {
  let added = 0;
  for (const l of lines) {
    if (queryOne('SELECT id FROM bank_lines WHERE company_id = :cid AND fingerprint = :fp', { ':cid': companyId, ':fp': l.fingerprint })) continue;
    run(
      'INSERT INTO bank_lines (id, company_id, line_date, description, amount, fingerprint, status, imported_at) VALUES (:id,:cid,:d,:desc,:amt,:fp,\'new\',:at)',
      { ':id': uid('bl_'), ':cid': companyId, ':d': l.date, ':desc': l.description, ':amt': l.amount, ':fp': l.fingerprint, ':at': nowIso() }
    );
    added++;
  }
  return added;
}

export function setBankLineStatus(id: string, status: BankLineStatus, matchType?: BankLine['matchType'], matchId?: string) {
  run('UPDATE bank_lines SET status=:s, match_type=:t, match_id=:m WHERE id=:id', { ':id': id, ':s': status, ':t': matchType ?? null, ':m': matchId ?? null });
}

export function clearBankLines(companyId: string) {
  run('DELETE FROM bank_lines WHERE company_id = :cid', { ':cid': companyId });
}

// ---------- Learnt categories for bank lines ----------

export interface BankRule {
  pattern: string;
  categoryId: string;
}

export function listBankRules(companyId: string): BankRule[] {
  return query<any>('SELECT pattern, category_id FROM bank_rules WHERE company_id = :cid', { ':cid': companyId }).map((r) => ({ pattern: r.pattern, categoryId: r.category_id }));
}

export function saveBankRule(companyId: string, pattern: string, categoryId: string) {
  run('DELETE FROM bank_rules WHERE company_id = :cid AND pattern = :p', { ':cid': companyId, ':p': pattern });
  run('INSERT INTO bank_rules (id, company_id, pattern, category_id, created_at) VALUES (:id,:cid,:p,:c,:at)', {
    ':id': uid('br_'),
    ':cid': companyId,
    ':p': pattern,
    ':c': categoryId,
    ':at': nowIso()
  });
}
