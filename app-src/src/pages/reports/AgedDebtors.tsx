import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Printer } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import { Button, Card, PageHeader, MoneyText } from '../../components/common/ui';
import { listInvoices, listCustomers } from '../../db/repository';
import { todayIso } from '../../core/numbering';
import { exportToCsv } from '../../utils/csv';

export default function AgedDebtors() {
  const { company } = useApp();
  const navigate = useNavigate();

  const result = useMemo(() => {
    if (!company) return null;
    const invoices = listInvoices(company.id).filter((i) => i.status !== 'draft' && i.total - i.amountPaid > 0.005);
    const customers = listCustomers(company.id);
    const customerMap = new Map(customers.map((c) => [c.id, c.name]));
    const today = todayIso();

    const byCustomer = new Map<string, { current: number; d30: number; d60: number; d90: number; total: number }>();
    for (const inv of invoices) {
      const outstanding = inv.total - inv.amountPaid;
      const days = Math.floor((new Date(today).getTime() - new Date(inv.dueDate).getTime()) / (1000 * 60 * 60 * 24));
      const bucket = byCustomer.get(inv.customerId) ?? { current: 0, d30: 0, d60: 0, d90: 0, total: 0 };
      if (days <= 0) bucket.current += outstanding;
      else if (days <= 30) bucket.d30 += outstanding;
      else if (days <= 60) bucket.d60 += outstanding;
      else bucket.d90 += outstanding;
      bucket.total += outstanding;
      byCustomer.set(inv.customerId, bucket);
    }

    const rows = Array.from(byCustomer.entries())
      .map(([id, b]) => ({ name: customerMap.get(id) ?? 'Unknown', ...b }))
      .sort((a, b) => b.total - a.total);

    const totals = rows.reduce(
      (acc, r) => ({ current: acc.current + r.current, d30: acc.d30 + r.d30, d60: acc.d60 + r.d60, d90: acc.d90 + r.d90, total: acc.total + r.total }),
      { current: 0, d30: 0, d60: 0, d90: 0, total: 0 }
    );

    return { rows, totals };
  }, [company]);

  if (!company || !result) return null;

  function handleExport() {
    exportToCsv('aged-debtors', ['Customer', 'Current', '1-30 days', '31-60 days', '61-90+ days', 'Total'], [
      ...result!.rows.map((r) => [r.name, r.current.toFixed(2), r.d30.toFixed(2), r.d60.toFixed(2), r.d90.toFixed(2), r.total.toFixed(2)]),
      ['Total', result!.totals.current.toFixed(2), result!.totals.d30.toFixed(2), result!.totals.d60.toFixed(2), result!.totals.d90.toFixed(2), result!.totals.total.toFixed(2)]
    ]);
  }

  return (
    <div>
      <button onClick={() => navigate('/reports')} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-brand-navy mb-4 no-print">
        <ArrowLeft size={15} /> Back to reports
      </button>
      <PageHeader
        title="Aged Debtors"
        subtitle="Outstanding customer balances by how overdue they are"
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
      <Card padded={false}>
        {result!.rows.length === 0 ? (
          <p className="text-sm text-gray-400 p-5">Nobody owes you money right now — nice work.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100">
                <th className="px-5 py-3">Customer</th>
                <th className="px-5 py-3 text-right">Current</th>
                <th className="px-5 py-3 text-right">1-30 days</th>
                <th className="px-5 py-3 text-right">31-60 days</th>
                <th className="px-5 py-3 text-right">61-90+ days</th>
                <th className="px-5 py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {result!.rows.map((r) => (
                <tr key={r.name} className="border-b border-gray-100 last:border-0">
                  <td className="px-5 py-3 font-medium text-brand-navy">{r.name}</td>
                  <td className="px-5 py-3 text-right"><MoneyText amount={r.current} /></td>
                  <td className="px-5 py-3 text-right"><MoneyText amount={r.d30} /></td>
                  <td className="px-5 py-3 text-right text-amber-600"><MoneyText amount={r.d60} /></td>
                  <td className="px-5 py-3 text-right text-status-overdue font-semibold"><MoneyText amount={r.d90} /></td>
                  <td className="px-5 py-3 text-right font-semibold text-brand-navy"><MoneyText amount={r.total} /></td>
                </tr>
              ))}
              <tr className="bg-gray-50 font-semibold">
                <td className="px-5 py-3 text-brand-navy">Total</td>
                <td className="px-5 py-3 text-right"><MoneyText amount={result!.totals.current} /></td>
                <td className="px-5 py-3 text-right"><MoneyText amount={result!.totals.d30} /></td>
                <td className="px-5 py-3 text-right"><MoneyText amount={result!.totals.d60} /></td>
                <td className="px-5 py-3 text-right"><MoneyText amount={result!.totals.d90} /></td>
                <td className="px-5 py-3 text-right"><MoneyText amount={result!.totals.total} /></td>
              </tr>
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
