// Suggests what each bank statement line is:
//  - money in  -> the unpaid invoice it pays (same amount, invoice number or customer name in the reference)
//  - money out -> an expense already recorded, a supplier bill it pays, or a new expense
//                 with a suggested category (learnt from earlier choices, then common SA merchants)

import { Bill, Customer, Expense, ExpenseCategory, Invoice } from './types';
import { BankLine, BankRule } from '../db/automationRepo';
import { balanceDue, daysBetween } from './automation';

export type Suggestion =
  | { kind: 'invoice'; invoice: Invoice; confident: boolean }
  | { kind: 'existing_expense'; expense: Expense }
  | { kind: 'bill'; bill: Bill; confident: boolean }
  | { kind: 'new_expense'; categoryId: string; learnt: boolean }
  | { kind: 'none' };

const words = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !/^\d+$/.test(w));

/** The part of a description that identifies who was paid, used to learn categories ("ENGEN QUICKSHOP 123" -> "engen quickshop"). */
export function rulePattern(description: string): string {
  const skip = new Set(['pos', 'purchase', 'debit', 'order', 'card', 'payment', 'fnb', 'absa', 'eft', 'int', 'online', 'app', 'from', 'to', 'the', 'ref', 'trf', 'transfer']);
  return words(description)
    .filter((w) => !skip.has(w))
    .slice(0, 2)
    .join(' ');
}

// Common South African merchants and descriptions -> default category names.
const KEYWORDS: { re: RegExp; category: string }[] = [
  { re: /engen|shell|sasol|caltex|astron|totalenergies|\bbp\b|petrol|fuel|diesel|uber|bolt|e-toll|sanral|toll/i, category: 'Fuel & travel' },
  { re: /telkom|vodacom|\bmtn\b|cell ?c|rain|afrihost|webafrica|vumatel|openserve|airtime|data bundle|mweb|cool ideas/i, category: 'Telephone & internet' },
  { re: /eskom|electric|prepaid elec|city of|municipal|metro|rates|water|city power/i, category: 'Electricity & water' },
  { re: /service fee|bank charge|monthly fee|admin fee|account fee|cash dep fee|transaction fee|\bfees?\b/i, category: 'Bank charges' },
  { re: /outsurance|santam|discovery insure|old mutual|hollard|miway|king price|budget insurance|momentum|sanlam|insurance/i, category: 'Insurance' },
  { re: /\brent\b|rental|lease/i, category: 'Rent' },
  { re: /salary|salaries|wages|payroll/i, category: 'Salaries & wages' },
  { re: /google|facebook|meta |instagram|adwords|advert|marketing|printing|signage/i, category: 'Marketing & advertising' },
  { re: /accountant|accounting|audit|attorney|lawyer|legal|cipc|consult/i, category: 'Accounting & professional fees' },
  { re: /takealot|makro|game store|incredible|office|stationery|waltons|pna/i, category: 'Office supplies' },
  { re: /builders|cashbuild|build it|leroy|hardware|repair|maintenance|plumb/i, category: 'Repairs & maintenance' }
];

export function suggestCategory(description: string, rules: BankRule[], categories: ExpenseCategory[]): { categoryId: string; learnt: boolean } {
  const pattern = rulePattern(description);
  const rule = pattern && rules.find((r) => r.pattern === pattern && categories.some((c) => c.id === r.categoryId));
  if (rule) return { categoryId: rule.categoryId, learnt: true };
  const byName = (name: string) => categories.find((c) => c.name === name)?.id;
  for (const k of KEYWORDS) {
    if (k.re.test(description)) {
      const id = byName(k.category);
      if (id) return { categoryId: id, learnt: false };
    }
  }
  return { categoryId: byName('Other expenses') ?? categories[0]?.id ?? '', learnt: false };
}

export interface MatchContext {
  invoices: Invoice[];
  customers: Customer[];
  expenses: Expense[];
  bills: Bill[];
  categories: ExpenseCategory[];
  rules: BankRule[];
  alreadyMatched: Set<string>; // ids of invoices/expenses/bills another line already points to
}

const near = (a: number, b: number) => Math.abs(a - b) < 0.011;

export function suggest(line: BankLine, ctx: MatchContext): Suggestion {
  const desc = line.description.toLowerCase();
  const descCompact = desc.replace(/[^a-z0-9]/g, '');

  if (line.amount > 0) {
    let best: { inv: Invoice; score: number } | null = null;
    let tie = false;
    for (const inv of ctx.invoices) {
      if (inv.status === 'paid' || inv.status === 'draft' || ctx.alreadyMatched.has(inv.id)) continue;
      const due = balanceDue(inv);
      if (due <= 0) continue;
      const numberInRef = descCompact.includes(inv.invoiceNumber.toLowerCase().replace(/[^a-z0-9]/g, ''));
      const amountMatches = near(due, line.amount);
      if (!amountMatches && !numberInRef) continue;
      if (!amountMatches && line.amount > due + 0.01) continue; // reference matches but it's more than owed
      const customer = ctx.customers.find((c) => c.id === inv.customerId);
      const nameInRef = !!customer && words(customer.name).some((w) => w.length > 3 && desc.includes(w));
      let score = 0;
      if (amountMatches) score += 40;
      if (numberInRef) score += 50;
      if (nameInRef) score += 30;
      if (line.date >= inv.invoiceDate) score += 5;
      if (!best || score > best.score) {
        best = { inv, score };
        tie = false;
      } else if (score === best.score) tie = true;
    }
    if (best && !tie) return { kind: 'invoice', invoice: best.inv, confident: best.score >= 70 };
    if (best && tie && best.score >= 70) return { kind: 'invoice', invoice: best.inv, confident: false };
    return { kind: 'none' };
  }

  const out = Math.abs(line.amount);
  const recorded = ctx.expenses.find(
    (e) => !ctx.alreadyMatched.has(e.id) && near(e.amount, out) && Math.abs(daysBetween(e.expenseDate, line.date)) <= 7
  );
  if (recorded) return { kind: 'existing_expense', expense: recorded };

  const bill = ctx.bills.find((b) => b.status !== 'paid' && !ctx.alreadyMatched.has(b.id) && near(b.total - b.amountPaid, out));
  if (bill) {
    const ref = descCompact.includes(bill.billNumber.toLowerCase().replace(/[^a-z0-9]/g, ''));
    return { kind: 'bill', bill, confident: ref };
  }

  const cat = suggestCategory(line.description, ctx.rules, ctx.categories);
  return { kind: 'new_expense', ...cat };
}
