// The monthly business report: what came in, what went out, profit, VAT and who owes you.

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Company } from './types';
import { query } from '../db/database';
import { listInvoices, listExpenses, listCategories, listCustomers } from '../db/repository';
import { balanceDue } from './automation';
import { round2 } from './financialEngine';
import { formatCurrency } from './numbering';
import { getPractice, accountantLine } from './accountant';

export interface MonthFigures {
  month: string; // YYYY-MM
  label: string; // "October 2026"
  invoicedExclVat: number;
  invoiceCount: number;
  received: number; // payments received this month
  expensesExclVat: number;
  profit: number;
  vatOutput: number;
  vatInput: number;
  topExpenses: { name: string; amount: number }[];
  topCustomers: { name: string; amount: number }[];
}

export interface MonthlyReport {
  current: MonthFigures;
  previous: MonthFigures;
  owedTotal: number;
  owedTop: { name: string; amount: number; overdue: boolean }[];
}

export function monthLabel(month: string) {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-ZA', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

export function previousMonth(month: string) {
  const [y, m] = month.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
}

export function figures(companyId: string, month: string): MonthFigures {
  const inMonth = (d: string) => d.slice(0, 7) === month;
  const invoices = listInvoices(companyId).filter((i) => i.status !== 'draft' && inMonth(i.invoiceDate));
  const expenses = listExpenses(companyId).filter((e) => inMonth(e.expenseDate));
  const categories = new Map(listCategories(companyId).map((c) => [c.id, c.name]));
  const customers = new Map(listCustomers(companyId).map((c) => [c.id, c.name]));
  const payments = query<{ amount: number }>(
    "SELECT amount FROM payments WHERE company_id = :cid AND substr(payment_date, 1, 7) = :m",
    { ':cid': companyId, ':m': month }
  );

  const byCat = new Map<string, number>();
  let expensesExclVat = 0;
  let vatInput = 0;
  for (const e of expenses) {
    const excl = e.vatApplicable ? e.amount - e.vatAmount : e.amount;
    expensesExclVat += excl;
    if (e.vatApplicable) vatInput += e.vatAmount;
    const name = categories.get(e.categoryId) ?? 'Other';
    byCat.set(name, (byCat.get(name) ?? 0) + excl);
  }
  const byCustomer = new Map<string, number>();
  for (const i of invoices) {
    const name = customers.get(i.customerId) ?? 'Unknown';
    byCustomer.set(name, (byCustomer.get(name) ?? 0) + i.subtotal);
  }
  const top = (m: Map<string, number>) =>
    [...m.entries()]
      .map(([name, amount]) => ({ name, amount: round2(amount) }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

  const invoicedExclVat = round2(invoices.reduce((s, i) => s + i.subtotal, 0));
  expensesExclVat = round2(expensesExclVat);
  return {
    month,
    label: monthLabel(month),
    invoicedExclVat,
    invoiceCount: invoices.length,
    received: round2(payments.reduce((s, p) => s + p.amount, 0)),
    expensesExclVat,
    profit: round2(invoicedExclVat - expensesExclVat),
    vatOutput: round2(invoices.reduce((s, i) => s + i.vatAmount, 0)),
    vatInput: round2(vatInput),
    topExpenses: top(byCat),
    topCustomers: top(byCustomer)
  };
}

export function buildMonthlyReport(companyId: string, month: string): MonthlyReport {
  const customers = new Map(listCustomers(companyId).map((c) => [c.id, c.name]));
  const today = new Date().toISOString().slice(0, 10);
  const owedBy = new Map<string, { amount: number; overdue: boolean }>();
  for (const inv of listInvoices(companyId)) {
    if (inv.status === 'paid' || inv.status === 'draft') continue;
    const due = balanceDue(inv);
    if (due <= 0) continue;
    const name = customers.get(inv.customerId) ?? 'Unknown';
    const cur = owedBy.get(name) ?? { amount: 0, overdue: false };
    owedBy.set(name, { amount: cur.amount + due, overdue: cur.overdue || inv.dueDate < today });
  }
  const owedTop = [...owedBy.entries()]
    .map(([name, v]) => ({ name, amount: round2(v.amount), overdue: v.overdue }))
    .sort((a, b) => b.amount - a.amount);
  return {
    current: figures(companyId, month),
    previous: figures(companyId, previousMonth(month)),
    owedTotal: round2(owedTop.reduce((s, o) => s + o.amount, 0)),
    owedTop: owedTop.slice(0, 5)
  };
}

export function changeText(now: number, before: number): string {
  if (before === 0) return now === 0 ? 'same as last month' : 'new this month';
  const pct = Math.round(((now - before) / Math.abs(before)) * 100);
  return pct === 0 ? 'same as last month' : `${pct > 0 ? 'up' : 'down'} ${Math.abs(pct)}% on last month`;
}

/** Short version for WhatsApp. */
export function reportText(company: Company, r: MonthlyReport): string {
  const c = r.current;
  const lines = [
    `${company.name}: ${c.label}`,
    `Invoiced: ${formatCurrency(c.invoicedExclVat)} excl. VAT (${changeText(c.invoicedExclVat, r.previous.invoicedExclVat)})`,
    `Money received: ${formatCurrency(c.received)}`,
    `Expenses: ${formatCurrency(c.expensesExclVat)} excl. VAT (${changeText(c.expensesExclVat, r.previous.expensesExclVat)})`,
    `Profit: ${formatCurrency(c.profit)}`,
    company.isVatRegistered ? `VAT for the month (estimate): ${formatCurrency(c.vatOutput - c.vatInput)}` : '',
    `Customers owe you: ${formatCurrency(r.owedTotal)}`
  ];
  return lines.filter(Boolean).join('\n');
}

const SLATE: [number, number, number] = [44, 55, 67];
const GOLD: [number, number, number] = [227, 165, 72];

export function reportPdf(company: Company, r: MonthlyReport): jsPDF {
  const doc = new jsPDF();
  const c = r.current;
  doc.setFillColor(...SLATE);
  doc.rect(0, 0, 210, 30, 'F');
  doc.setFillColor(...GOLD);
  doc.rect(0, 30, 210, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(company.name, 14, 15);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Monthly report: ${c.label}`, 14, 23);
  // Accountant Partner: the practice's name and logo on reports it prepares
  const practice = company.packageTier === 'accountant_partner' ? getPractice() : null;
  if (practice && (practice.firm || practice.name)) {
    doc.setFontSize(9);
    doc.text(`Prepared by ${practice.firm || practice.name}`, 196, 23, { align: 'right' });
    if (practice.logo) {
      try {
        doc.addImage(practice.logo, 170, 5, 26, 12, undefined, 'FAST');
      } catch {
        // unsupported image: name only
      }
    }
  }

  const summary: [string, string, string][] = [
    ['Invoiced (excl. VAT)', formatCurrency(c.invoicedExclVat), changeText(c.invoicedExclVat, r.previous.invoicedExclVat)],
    ['Money received', formatCurrency(c.received), changeText(c.received, r.previous.received)],
    ['Expenses (excl. VAT)', formatCurrency(c.expensesExclVat), changeText(c.expensesExclVat, r.previous.expensesExclVat)],
    ['Profit (invoiced minus expenses)', formatCurrency(c.profit), changeText(c.profit, r.previous.profit)]
  ];
  if (company.isVatRegistered) summary.push(['VAT for the month (estimate)', formatCurrency(c.vatOutput - c.vatInput), '']);
  summary.push(['Customers owe you (today)', formatCurrency(r.owedTotal), '']);

  autoTable(doc, {
    startY: 40,
    head: [['', 'Amount', 'Compared with last month']],
    body: summary,
    headStyles: { fillColor: SLATE },
    styles: { fontSize: 10 }
  });
  const section = (title: string, rows: { name: string; amount: number }[]) => {
    if (!rows.length) return;
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 8,
      head: [[title, 'Amount']],
      body: rows.map((x) => [x.name, formatCurrency(x.amount)]),
      headStyles: { fillColor: GOLD, textColor: SLATE },
      styles: { fontSize: 10 }
    });
  };
  section('Biggest expenses', c.topExpenses);
  section('Top customers (invoiced)', c.topCustomers);
  section('Who owes you', r.owedTop);
  doc.setFontSize(8);
  const kept = accountantLine(company.id);
  if (kept) {
    doc.setTextColor(...SLATE);
    doc.text(kept, 105, 285, { align: 'center' });
  }
  doc.setTextColor(150, 150, 150);
  doc.text('Figures from your Setwel records. Estimates only; confirm tax amounts with your accountant. Generated with Setwel Biz Suite.', 105, 290, { align: 'center' });
  return doc;
}
