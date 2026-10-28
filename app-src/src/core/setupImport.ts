// Loading a business into Setwel from spreadsheets: customers, suppliers, and opening
// balances (what customers already owed and what bills were unpaid on the start date).
// Used by the Setup checklist, usually by a Setwel partner accountant during setup.

import { parseCsv, parseAmount, parseDate } from './bankImport';
import { listCustomers, listSuppliers, saveCustomer, saveSupplier, saveInvoice, saveBill, getSetting, getNextInvoiceNumber, getNextBillNumber } from '../db/repository';
import { transaction } from '../db/database';
import { addDays, todayIso, uid } from './numbering';

/** Marks invoices/bills that are balances brought forward, not new sales or purchases. */
export const OPENING_NOTE = 'Opening balance loaded during setup';

export type ImportKind = 'customers' | 'suppliers' | 'opening_debtors' | 'opening_creditors';

export const TEMPLATES: Record<ImportKind, { file: string; headers: string[]; example: string[] }> = {
  customers: { file: 'Setwel customers.csv', headers: ['Name', 'Email', 'Phone', 'Address', 'VAT number'], example: ['Dlamini Family Trust', 'sipho@example.com', '082 345 6712', '14 Vilakazi Street, Soweto', ''] },
  suppliers: { file: 'Setwel suppliers.csv', headers: ['Name', 'Email', 'Phone', 'Address', 'VAT number'], example: ['City Electrical Wholesalers', 'sales@example.co.za', '011 444 2200', '', '4220098871'] },
  opening_debtors: {
    file: 'Setwel what customers owe.csv',
    headers: ['Customer', 'Invoice number', 'Invoice date', 'Due date', 'Amount owing'],
    example: ['Dlamini Family Trust', 'OLD-1043', '2026-09-15', '2026-10-15', '3450.00']
  },
  opening_creditors: {
    file: 'Setwel unpaid supplier bills.csv',
    headers: ['Supplier', 'Bill number', 'Bill date', 'Due date', 'Amount owing'],
    example: ['City Electrical Wholesalers', 'INV-88812', '2026-09-28', '2026-10-28', '6120.00']
  }
};

export function templateCsv(kind: ImportKind): string {
  const t = TEMPLATES[kind];
  const cell = (v: string) => (/[",]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return '﻿' + [t.headers, t.example].map((r) => r.map(cell).join(',')).join('\r\n');
}

export interface ImportResult {
  added: number;
  skipped: { row: number; reason: string }[];
  createdNames: string[]; // customers/suppliers created along the way
}

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

/** Finds each column by its heading, so the columns may be in any order. */
function headerIndex(header: string[], names: RegExp[]): number[] {
  return names.map((re) => header.findIndex((h) => re.test(h.trim())));
}

export function runImport(companyId: string, kind: ImportKind, text: string): ImportResult {
  const rows = parseCsv(text.replace(/^﻿/, ''));
  if (rows.length < 2) throw new Error('The file has no rows. Use the template and fill in one row per line.');
  const header = rows[0];
  const result: ImportResult = { added: 0, skipped: [], createdNames: [] };

  transaction(() => {
    if (kind === 'customers' || kind === 'suppliers') {
      const [iName, iEmail, iPhone, iAddr, iVat] = headerIndex(header, [/name/i, /mail/i, /phone|cell|tel/i, /address/i, /vat/i]);
      if (iName < 0) throw new Error('The file needs a "Name" column. Download the template to see the layout.');
      const existing = new Set((kind === 'customers' ? listCustomers(companyId) : listSuppliers(companyId)).map((c) => norm(c.name)));
      rows.slice(1).forEach((r, i) => {
        const name = (r[iName] ?? '').trim();
        if (!name) return result.skipped.push({ row: i + 2, reason: 'No name' });
        if (existing.has(norm(name))) return result.skipped.push({ row: i + 2, reason: `${name} is already in Setwel` });
        const vat = iVat >= 0 ? (r[iVat] ?? '').replace(/\D/g, '') : '';
        const base = {
          companyId,
          name,
          email: iEmail >= 0 ? r[iEmail] || undefined : undefined,
          phone: iPhone >= 0 ? r[iPhone] || undefined : undefined,
          address: iAddr >= 0 ? r[iAddr] || undefined : undefined,
          vatNumber: vat || undefined
        };
        if (kind === 'customers') saveCustomer({ ...base, isVatRegistered: !!vat });
        else saveSupplier(base);
        existing.add(norm(name));
        result.added++;
      });
      return;
    }

    // Opening balances: one open invoice / bill per row, with no line detail
    const isDebtors = kind === 'opening_debtors';
    const [iWho, iNum, iDate, iDue, iAmt] = headerIndex(header, [isDebtors ? /customer|name/i : /supplier|name/i, /number|no\b|ref/i, /^(invoice |bill )?date/i, /due/i, /amount|owing|balance/i]);
    if (iWho < 0 || iAmt < 0) throw new Error(`The file needs "${isDebtors ? 'Customer' : 'Supplier'}" and "Amount owing" columns. Download the template to see the layout.`);
    const people = new Map((isDebtors ? listCustomers(companyId) : listSuppliers(companyId)).map((p) => [norm(p.name), p.id]));
    const terms = Number(getSetting(companyId, 'defaultPaymentTermsDays')) || 30;
    rows.slice(1).forEach((r, i) => {
      const who = (r[iWho] ?? '').trim();
      const amount = parseAmount(r[iAmt] ?? '');
      if (!who) return result.skipped.push({ row: i + 2, reason: 'No name' });
      if (amount === null || amount <= 0) return result.skipped.push({ row: i + 2, reason: 'Amount missing or not a number' });
      const date = (iDate >= 0 && parseDate(r[iDate] ?? '')) || todayIso();
      const due = (iDue >= 0 && parseDate(r[iDue] ?? '')) || addDays(date, terms);
      let personId = people.get(norm(who));
      if (!personId) {
        personId = isDebtors ? saveCustomer({ companyId, name: who, isVatRegistered: false }).id : saveSupplier({ companyId, name: who }).id;
        people.set(norm(who), personId);
        result.createdNames.push(who);
      }
      const ref = iNum >= 0 ? (r[iNum] ?? '').trim() : '';
      // Balance brought forward: one line, no VAT (the VAT was already accounted for when the original invoice was issued)
      const item = { id: uid('li_'), description: `Opening balance${ref ? ` (${ref})` : ''}`, quantity: 1, unitPrice: amount, vatApplicable: false, lineTotal: amount };
      if (isDebtors) {
        saveInvoice({
          id: uid('inv_'),
          companyId,
          customerId: personId,
          invoiceNumber: ref || getNextInvoiceNumber(companyId, 'OB'),
          invoiceDate: date,
          dueDate: due,
          status: 'sent',
          items: [item],
          subtotal: amount,
          vatAmount: 0,
          total: amount,
          amountPaid: 0,
          notes: OPENING_NOTE,
          customerVatRegistered: false
        });
      } else {
        saveBill({
          id: uid('bill_'),
          companyId,
          supplierId: personId,
          billNumber: ref || getNextBillNumber(companyId, 'OB'),
          billDate: date,
          dueDate: due,
          status: 'sent',
          items: [item],
          subtotal: amount,
          vatAmount: 0,
          total: amount,
          amountPaid: 0
        });
      }
      result.added++;
    });
  });
  return result;
}
