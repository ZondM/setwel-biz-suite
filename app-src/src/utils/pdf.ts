import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Company, Customer, Invoice, Quote } from '../core/types';
import { formatCurrency, formatDate } from '../core/numbering';
import { accountantLine } from '../core/accountant';

// Setwel logo colours: copper accent, slate, gold
const GREEN = [201, 98, 26];
const NAVY = [44, 55, 67];
const GOLD = [227, 165, 72];

function drawHeader(doc: jsPDF, company: Company, docTitle: string, docNumber: string) {
  doc.setFillColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.rect(0, 0, 210, 32, 'F');
  doc.setFillColor(GOLD[0], GOLD[1], GOLD[2]);
  doc.rect(0, 32, 210, 2, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(company.name, 14, 16);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const addrLines = [company.province, company.isVatRegistered ? `VAT No: ${company.vatNumber}` : null].filter(Boolean) as string[];
  doc.text(addrLines.join('  |  '), 14, 23);

  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text(docTitle.toUpperCase(), 196, 16, { align: 'right' });
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`#${docNumber}`, 196, 23, { align: 'right' });
}

function drawPartyDetails(doc: jsPDF, customer: Customer | null, dateLabel: string, dateValue: string, secondLabel: string, secondValue: string) {
  doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('BILL TO', 14, 44);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  let y = 50;
  doc.text(customer?.name ?? 'Walk-in customer', 14, y);
  if (customer?.address) {
    y += 5;
    doc.text(customer.address, 14, y);
  }
  if (customer?.isVatRegistered && customer.vatNumber) {
    y += 5;
    doc.text(`VAT No: ${customer.vatNumber}`, 14, y);
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(dateLabel.toUpperCase(), 140, 44);
  doc.text(secondLabel.toUpperCase(), 140, 54);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(dateValue, 196, 44, { align: 'right' });
  doc.text(secondValue, 196, 54, { align: 'right' });
}

function drawItemsTable(doc: jsPDF, items: { description: string; quantity: number; unitPrice: number; vatApplicable: boolean; lineTotal: number }[], vatRegistered: boolean) {
  const head = vatRegistered ? [['Description', 'Qty', 'Unit price', 'VAT', 'Amount']] : [['Description', 'Qty', 'Unit price', 'Amount']];
  const body = items.map((it) => {
    const row = [it.description, String(it.quantity), formatCurrency(it.unitPrice)];
    if (vatRegistered) row.push(it.vatApplicable ? '15%' : 'Exempt');
    row.push(formatCurrency(it.lineTotal));
    return row;
  });
  autoTable(doc, {
    startY: 72,
    head,
    body,
    theme: 'grid',
    headStyles: { fillColor: NAVY as [number, number, number], textColor: 255, fontSize: 9 },
    bodyStyles: { fontSize: 9, textColor: NAVY as [number, number, number] },
    columnStyles: { 0: { cellWidth: 90 } }
  });
}

function drawTotals(doc: jsPDF, subtotal: number, vatAmount: number, total: number, vatRegistered: boolean) {
  const finalY = (doc as any).lastAutoTable.finalY + 8;
  let y = finalY;
  doc.setFontSize(10);
  doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.text('Subtotal', 150, y);
  doc.text(formatCurrency(subtotal), 196, y, { align: 'right' });
  if (vatRegistered) {
    y += 6;
    doc.text('VAT (15%)', 150, y);
    doc.text(formatCurrency(vatAmount), 196, y, { align: 'right' });
  }
  y += 8;
  doc.setFillColor(GREEN[0], GREEN[1], GREEN[2]);
  doc.rect(140, y - 5, 56, 9, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL', 150, y + 1);
  doc.text(formatCurrency(total), 196, y + 1, { align: 'right' });
  return y + 12;
}

function drawFooter(doc: jsPDF, company: Company, notes: string | undefined, startY: number) {
  doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.setFont('helvetica', 'normal');
  let y = startY;
  if (company.bankName) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('BANKING DETAILS', 14, y);
    doc.setFont('helvetica', 'normal');
    y += 6;
    doc.text(`${company.bankName} | ${company.bankAccountHolder ?? ''}`, 14, y);
    y += 5;
    doc.text(`Acc: ${company.bankAccountNumber ?? ''}  Branch: ${company.bankBranchCode ?? ''}`, 14, y);
    y += 8;
  }
  if (notes) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('NOTES', 14, y);
    doc.setFont('helvetica', 'normal');
    y += 6;
    const split = doc.splitTextToSize(notes, 180);
    doc.text(split, 14, y);
  }
  doc.setFontSize(8);
  const kept = accountantLine(company.id);
  if (kept) {
    doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
    doc.text(kept, 105, 285, { align: 'center' });
  }
  doc.setTextColor(150, 150, 150);
  doc.text('Generated with Setwel Biz Suite', 105, 290, { align: 'center' });
}

export function generateInvoicePdf(company: Company, customer: Customer | null, invoice: Invoice): jsPDF {
  const doc = new jsPDF();
  drawHeader(doc, company, 'Tax Invoice', invoice.invoiceNumber);
  drawPartyDetails(doc, customer, 'Invoice date', formatDate(invoice.invoiceDate), 'Due date', formatDate(invoice.dueDate));
  drawItemsTable(doc, invoice.items, company.isVatRegistered);
  const y = drawTotals(doc, invoice.subtotal, invoice.vatAmount, invoice.total, company.isVatRegistered);
  if (invoice.amountPaid > 0) {
    doc.setFontSize(9);
    doc.setTextColor(GREEN[0], GREEN[1], GREEN[2]);
    doc.text(`Paid to date: ${formatCurrency(invoice.amountPaid)}  |  Balance due: ${formatCurrency(invoice.total - invoice.amountPaid)}`, 14, y);
  }
  drawFooter(doc, company, invoice.notes, y + (invoice.amountPaid > 0 ? 10 : 4));
  return doc;
}

export function generateQuotePdf(company: Company, customer: Customer | null, quote: Quote): jsPDF {
  const doc = new jsPDF();
  drawHeader(doc, company, 'Quotation', quote.quoteNumber);
  drawPartyDetails(doc, customer, 'Quote date', formatDate(quote.quoteDate), 'Valid until', formatDate(quote.validUntil));
  drawItemsTable(doc, quote.items, company.isVatRegistered);
  const y = drawTotals(doc, quote.subtotal, quote.vatAmount, quote.total, company.isVatRegistered);
  drawFooter(doc, company, quote.notes, y + 4);
  return doc;
}
