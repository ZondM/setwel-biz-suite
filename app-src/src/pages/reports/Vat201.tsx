import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Printer } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import { Button, Card, PageHeader, Field, Input, HelpTip } from '../../components/common/ui';
import { listInvoices, listExpenses, listBills } from '../../db/repository';
import { calculateVat201 } from '../../core/financialEngine';
import { formatCurrency, todayIso } from '../../core/numbering';
import { exportToCsv } from '../../utils/csv';

function startOfBiMonth() {
  const now = new Date();
  const month = now.getMonth(); // 0-indexed
  const periodStartMonth = month % 2 === 0 ? month : month - 1;
  return `${now.getFullYear()}-${String(periodStartMonth + 1).padStart(2, '0')}-01`;
}

export default function Vat201() {
  const { company } = useApp();
  const navigate = useNavigate();
  const [periodStart, setPeriodStart] = useState(startOfBiMonth());
  const [periodEnd, setPeriodEnd] = useState(todayIso());

  const result = useMemo(() => {
    if (!company) return null;
    const invoices = listInvoices(company.id);
    const expenses = listExpenses(company.id);
    const bills = listBills(company.id);
    return calculateVat201(invoices, expenses, bills, periodStart, periodEnd);
  }, [company, periodStart, periodEnd]);

  if (!company || !result) return null;

  if (!company.isVatRegistered) {
    return (
      <div>
        <button onClick={() => navigate('/reports')} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-brand-navy mb-4">
          <ArrowLeft size={15} /> Back to reports
        </button>
        <Card>
          <p className="text-gray-600">
            This business isn't marked as VAT registered, so there's no VAT201 to file. Once your turnover approaches R1,000,000 in a rolling 12-month period, SARS requires you to register. You can update your VAT
            status any time in Settings.
          </p>
        </Card>
      </div>
    );
  }

  function handleExport() {
    if (!result) return;
    exportToCsv(`vat201-${periodStart}-to-${periodEnd}`, ['Field', 'Amount (ZAR)'], [
      ['Total sales excl. VAT (Field 1/4)', result.totalSalesExclVat.toFixed(2)],
      ['Output VAT (Field 4)', result.outputVat.toFixed(2)],
      ['Total purchases excl. VAT', result.totalPurchasesExclVat.toFixed(2)],
      ['Input VAT (Field 15/18)', result.inputVat.toFixed(2)],
      [result.netVat >= 0 ? 'Amount owing to SARS (Field 21)' : 'Refund due from SARS (Field 21)', Math.abs(result.netVat).toFixed(2)]
    ]);
  }

  return (
    <div>
      <button onClick={() => navigate('/reports')} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-brand-navy mb-4 no-print">
        <ArrowLeft size={15} /> Back to reports
      </button>
      <PageHeader
        title="VAT201"
        subtitle={`VAT number: ${company.vatNumber || 'not set'}`}
        actions={
          <div className="no-print flex gap-2">
            <Button variant="secondary" size="sm" onClick={handleExport}>
              <Download size={15} /> Export CSV
            </Button>
            <Button variant="secondary" size="sm" onClick={() => window.print()}>
              <Printer size={15} /> Print
            </Button>
          </div>
        }
      />
      <Card className="mb-5 no-print">
        <div className="flex gap-4 items-end">
          <Field label="Period start">
            <Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
          </Field>
          <Field label="Period end">
            <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
          </Field>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Most small businesses file VAT bi-monthly. Match these dates to your SARS-allocated VAT period before you copy the figures across to eFiling.
        </p>
      </Card>

      <Card>
        <h3 className="font-display font-bold text-brand-navy mb-4">Copy these figures into your SARS VAT201 return</h3>
        <Line label="Total sales (excl. VAT)" amount={result.totalSalesExclVat} fieldHint="VAT201 Field 1 / 4" />
        <Line label="Output VAT charged to customers" amount={result.outputVat} bold fieldHint="VAT201 Field 4" />
        <Line label="Total purchases & expenses (excl. VAT)" amount={result.totalPurchasesExclVat} fieldHint="VAT201 Field 14 / 15" />
        <Line label="Input VAT claimed on purchases" amount={result.inputVat} bold fieldHint="VAT201 Field 15 / 18" />
        <div className={`flex justify-between items-center mt-4 pt-4 border-t border-gray-200 ${result.netVat >= 0 ? 'text-status-overdue' : 'text-brand-green'}`}>
          <span className="font-display font-bold">{result.netVat >= 0 ? 'Amount owing to SARS' : 'Refund due from SARS'}</span>
          <span className="font-display font-bold text-xl">{formatCurrency(Math.abs(result.netVat))}</span>
        </div>
      </Card>

      <Card className="mt-4 bg-amber-50 border-amber-200">
        <p className="text-sm text-amber-800">
          This is calculated from the invoices, expenses and bills recorded in this app. Always reconcile against your bank statement before submitting, and remember this app does not yet
          file directly with SARS eFiling — export this report and enter the figures on the eFiling website, or upload the CSV if your tax practitioner asks for it.
        </p>
      </Card>
    </div>
  );
}

function Line({ label, amount, bold, fieldHint }: { label: string; amount: number; bold?: boolean; fieldHint: string }) {
  return (
    <div className="flex justify-between py-2 border-b border-gray-50 last:border-0">
      <span className={`text-brand-navy ${bold ? 'font-semibold' : ''}`}>
        {label}
        <HelpTip text={fieldHint} />
      </span>
      <span className={`text-brand-navy ${bold ? 'font-semibold' : ''}`}>{formatCurrency(amount)}</span>
    </div>
  );
}
