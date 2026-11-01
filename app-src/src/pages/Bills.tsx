import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Receipt, Search, Trash2, CheckCircle2 } from 'lucide-react';
import { useApp, usePermissions } from '../state/AppContext';
import { Button, Card, PageHeader, EmptyState, StatusBadge, MoneyText } from '../components/common/ui';
import { listBills, listSuppliers, deleteBill, saveBill } from '../db/repository';
import { formatDate, todayIso } from '../core/numbering';

export default function Bills() {
  const { company, refreshKey, bumpRefresh } = useApp();
  const { canDelete } = usePermissions();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const { bills, supplierName } = useMemo(() => {
    if (!company) return { bills: [], supplierName: (_: string) => '' };
    const suppliers = listSuppliers(company.id);
    const map = new Map(suppliers.map((s) => [s.id, s.name]));
    const today = todayIso();
    const raw = listBills(company.id).map((b) => (b.status !== 'paid' && b.dueDate < today && b.total - b.amountPaid > 0 ? { ...b, status: 'overdue' as const } : b));
    return { bills: raw, supplierName: (id: string) => map.get(id) ?? 'Unknown' };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company, refreshKey]);

  const filtered = bills.filter((b) => b.billNumber.toLowerCase().includes(search.toLowerCase()) || supplierName(b.supplierId).toLowerCase().includes(search.toLowerCase()));

  function handleDelete(id: string) {
    if (window.confirm('Delete this bill?')) {
      deleteBill(id);
      bumpRefresh();
    }
  }
  function markPaid(bill: (typeof bills)[number]) {
    saveBill({ ...bill, amountPaid: bill.total, status: 'paid' });
    bumpRefresh();
  }

  if (!company) return null;

  return (
    <div>
      <PageHeader
        title="Bills"
        subtitle="Supplier invoices you owe — these feed your input VAT and aged creditors report"
        actions={
          <Button onClick={() => navigate('/bills/new')}>
            <Plus size={16} /> Record bill
          </Button>
        }
      />
      <div className="relative mb-4 max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          className="w-full rounded-lg border border-gray-300 pl-9 pr-3 py-2.5 text-sm focus:border-brand-green focus:ring-1 focus:ring-brand-green"
          placeholder="Search bills…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Receipt size={40} />}
          title={bills.length === 0 ? 'No bills recorded' : 'No matches'}
          description={bills.length === 0 ? 'Record supplier invoices here to track what you owe and claim input VAT.' : 'Try a different search term.'}
          action={bills.length === 0 ? <Button onClick={() => navigate('/bills/new')}><Plus size={16} /> Record bill</Button> : undefined}
        />
      ) : (
        <Card padded={false}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100">
                <th className="px-5 py-3">Bill #</th>
                <th className="px-5 py-3">Supplier</th>
                <th className="px-5 py-3">Due</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Total</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((b) => (
                <tr key={b.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium text-brand-navy cursor-pointer" onClick={() => navigate(`/bills/${b.id}`)}>
                    {b.billNumber}
                  </td>
                  <td className="px-5 py-3 text-gray-600">{supplierName(b.supplierId)}</td>
                  <td className="px-5 py-3 text-gray-500">{formatDate(b.dueDate)}</td>
                  <td className="px-5 py-3">
                    <StatusBadge status={b.status} />
                  </td>
                  <td className="px-5 py-3 text-right font-semibold text-brand-navy">
                    <MoneyText amount={b.total} />
                  </td>
                  <td className="px-5 py-3 text-right">
                    {b.status !== 'paid' && (
                      <button onClick={() => markPaid(b)} className="text-gray-400 hover:text-brand-green mr-3" title="Mark as paid">
                        <CheckCircle2 size={15} />
                      </button>
                    )}
                    {canDelete && (<button onClick={() => handleDelete(b.id)} className="text-gray-400 hover:text-status-overdue"><Trash2 size={15} /></button>)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
