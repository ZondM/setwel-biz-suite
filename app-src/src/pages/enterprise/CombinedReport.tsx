import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Download } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import { Button, Card, PageHeader, Input } from '../../components/common/ui';
import { figures, monthLabel } from '../../core/monthlyReport';
import { listInvoices } from '../../db/repository';
import { balanceDue } from '../../core/automation';
import { formatCurrency } from '../../core/numbering';
import { round2 } from '../../core/financialEngine';
import { exportToCsv } from '../../utils/csv';

/** All businesses in this install, side by side, with totals. */
export default function CombinedReport() {
  const { companies, refreshKey } = useApp();
  const navigate = useNavigate();
  const thisMonth = new Date().toISOString().slice(0, 7);
  const [month, setMonth] = useState(thisMonth);

  const rows = useMemo(
    () =>
      companies.map((c) => {
        const f = figures(c.id, month);
        const owed = round2(listInvoices(c.id).filter((i) => i.status !== 'paid' && i.status !== 'draft').reduce((s, i) => s + balanceDue(i), 0));
        return { name: c.name, ...f, owed };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [companies, month, refreshKey]
  );
  const total = (k: 'invoicedExclVat' | 'received' | 'expensesExclVat' | 'profit' | 'owed') => round2(rows.reduce((s, r) => s + r[k], 0));

  function download() {
    void exportToCsv(
      `Combined report ${month}`,
      ['Business', 'Invoiced excl. VAT', 'Received', 'Expenses excl. VAT', 'Profit', 'Owed to the business today'],
      [
        ...rows.map((r) => [r.name, r.invoicedExclVat, r.received, r.expensesExclVat, r.profit, r.owed]),
        ['TOTAL', total('invoicedExclVat'), total('received'), total('expensesExclVat'), total('profit'), total('owed')]
      ]
    );
  }

  return (
    <div>
      <button onClick={() => navigate('/reports')} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-brand-navy mb-4">
        <ArrowLeft size={15} /> Back to reports
      </button>
      <PageHeader
        title={`All businesses: ${monthLabel(month)}`}
        subtitle={`${companies.length} business${companies.length === 1 ? '' : 'es'} in this app, side by side.`}
        actions={
          <>
            <Input type="month" value={month} max={thisMonth} onChange={(e) => e.target.value && setMonth(e.target.value)} className="max-w-[170px]" />
            <Button variant="secondary" size="sm" onClick={download}>
              <Download size={15} /> Spreadsheet
            </Button>
          </>
        }
      />
      <Card padded={false}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100">
              <th className="px-4 py-3">Business</th>
              <th className="px-4 py-3 text-right">Invoiced</th>
              <th className="px-4 py-3 text-right">Received</th>
              <th className="px-4 py-3 text-right">Expenses</th>
              <th className="px-4 py-3 text-right">Profit</th>
              <th className="px-4 py-3 text-right">Owed to you</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name} className="border-b border-gray-100">
                <td className="px-4 py-3 text-brand-navy font-medium">{r.name}</td>
                <td className="px-4 py-3 text-right">{formatCurrency(r.invoicedExclVat)}</td>
                <td className="px-4 py-3 text-right">{formatCurrency(r.received)}</td>
                <td className="px-4 py-3 text-right">{formatCurrency(r.expensesExclVat)}</td>
                <td className={`px-4 py-3 text-right font-semibold ${r.profit < 0 ? 'text-status-overdue' : ''}`}>{formatCurrency(r.profit)}</td>
                <td className="px-4 py-3 text-right">{formatCurrency(r.owed)}</td>
              </tr>
            ))}
            <tr className="bg-brand-panel font-bold text-brand-navy">
              <td className="px-4 py-3">Total</td>
              <td className="px-4 py-3 text-right">{formatCurrency(total('invoicedExclVat'))}</td>
              <td className="px-4 py-3 text-right">{formatCurrency(total('received'))}</td>
              <td className="px-4 py-3 text-right">{formatCurrency(total('expensesExclVat'))}</td>
              <td className="px-4 py-3 text-right">{formatCurrency(total('profit'))}</td>
              <td className="px-4 py-3 text-right">{formatCurrency(total('owed'))}</td>
            </tr>
          </tbody>
        </table>
      </Card>
      <p className="text-xs text-gray-400 mt-3">Amounts exclude VAT except "Received" and "Owed". Money moved between your own businesses is counted in each one.</p>
    </div>
  );
}
