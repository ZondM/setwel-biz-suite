// Month-end pack: one ZIP for the accountant with the month's records as spreadsheets
// (CSV opens in Excel) and the monthly report as a PDF.

import JSZip from 'jszip';
import { Company } from './types';
import { query } from '../db/database';
import { listInvoices, listExpenses, listBills, listCategories, listCustomers, listSuppliers } from '../db/repository';
import { calculateVat201, round2 } from './financialEngine';
import { buildMonthlyReport, reportPdf } from './monthlyReport';
import { balanceDue } from './automation';

function csv(headers: string[], rows: (string | number | undefined)[][]): string {
  const cell = (v: unknown) => {
    const s = String(v ?? '');
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '﻿' + [headers, ...rows].map((r) => r.map(cell).join(',')).join('\r\n'); // BOM so Excel reads R and accents correctly
}

export async function buildMonthEndPack(company: Company, month: string): Promise<{ filename: string; bytes: Uint8Array }> {
  const inMonth = (d: string) => d.slice(0, 7) === month;
  const customers = new Map(listCustomers(company.id).map((c) => [c.id, c.name]));
  const suppliers = new Map(listSuppliers(company.id).map((s) => [s.id, s.name]));
  const categories = new Map(listCategories(company.id).map((c) => [c.id, c.name]));
  const allInvoices = listInvoices(company.id);
  const invoices = allInvoices.filter((i) => i.status !== 'draft' && inMonth(i.invoiceDate));
  const expenses = listExpenses(company.id).filter((e) => inMonth(e.expenseDate));
  const bills = listBills(company.id).filter((b) => inMonth(b.billDate));
  const payments = query<any>(
    'SELECT p.*, i.invoice_number FROM payments p LEFT JOIN invoices i ON i.id = p.invoice_id WHERE p.company_id = :cid AND substr(p.payment_date, 1, 7) = :m ORDER BY p.payment_date',
    { ':cid': company.id, ':m': month }
  );

  const zip = new JSZip();
  const folder = zip.folder(`${company.name} ${month}`)!;

  folder.file(
    'Invoices.csv',
    csv(
      ['Date', 'Invoice number', 'Customer', 'Excl. VAT', 'VAT', 'Total', 'Paid', 'Balance', 'Status', 'Due date'],
      invoices.map((i) => [i.invoiceDate, i.invoiceNumber, customers.get(i.customerId) ?? '', i.subtotal, i.vatAmount, i.total, i.amountPaid, balanceDue(i), i.status, i.dueDate])
    )
  );
  folder.file(
    'Payments received.csv',
    csv(['Date', 'Invoice number', 'Amount', 'Method', 'Reference'], payments.map((p) => [p.payment_date, p.invoice_number ?? '', p.amount, p.method, p.reference ?? '']))
  );
  folder.file(
    'Expenses.csv',
    csv(
      ['Date', 'Description', 'Category', 'Supplier', 'Total', 'VAT', 'Excl. VAT', 'Receipt photo'],
      expenses.map((e) => [
        e.expenseDate,
        e.description,
        categories.get(e.categoryId) ?? '',
        e.supplierId ? suppliers.get(e.supplierId) ?? '' : '',
        e.amount,
        e.vatApplicable ? e.vatAmount : 0,
        round2(e.vatApplicable ? e.amount - e.vatAmount : e.amount),
        e.receiptPhoto ? 'yes' : ''
      ])
    )
  );
  folder.file(
    'Supplier bills.csv',
    csv(
      ['Date', 'Bill number', 'Supplier', 'Excl. VAT', 'VAT', 'Total', 'Paid', 'Status', 'Due date'],
      bills.map((b) => [b.billDate, b.billNumber, suppliers.get(b.supplierId) ?? '', b.subtotal, b.vatAmount, b.total, b.amountPaid, b.status, b.dueDate])
    )
  );
  const owing = allInvoices.filter((i) => i.status !== 'paid' && i.status !== 'draft' && balanceDue(i) > 0);
  folder.file(
    'Who owes money (today).csv',
    csv(['Invoice number', 'Customer', 'Invoice date', 'Due date', 'Balance'], owing.map((i) => [i.invoiceNumber, customers.get(i.customerId) ?? '', i.invoiceDate, i.dueDate, balanceDue(i)]))
  );

  const [y, m] = month.split('-').map(Number);
  const end = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  const vat = calculateVat201(allInvoices, listExpenses(company.id), listBills(company.id), `${month}-01`, end);
  folder.file(
    'VAT for the month.csv',
    csv(['', 'Amount'], [
      ['Sales excl. VAT', vat.totalSalesExclVat],
      ['Output VAT', vat.outputVat],
      ['Purchases excl. VAT', vat.totalPurchasesExclVat],
      ['Input VAT', vat.inputVat],
      [vat.netVat >= 0 ? 'VAT payable' : 'VAT refundable', Math.abs(vat.netVat)]
    ])
  );

  const report = buildMonthlyReport(company.id, month);
  folder.file('Monthly report.pdf', reportPdf(company, report).output('arraybuffer'));
  folder.file(
    'Read me.txt',
    `Month-end pack for ${company.name}, ${month}.\r\nMade with Setwel Biz Suite on ${new Date().toLocaleString('en-ZA')}.\r\nAmounts in rand. CSV files open in Excel or Google Sheets.\r\nVAT figures are for this calendar month only; the VAT201 covers the full VAT period.\r\n`
  );

  const bytes = await zip.generateAsync({ type: 'uint8array' });
  return { filename: `${company.name} month-end ${month}.zip`.replace(/[\\/:*?"<>|]/g, ''), bytes };
}
