import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, FileText, Search, Trash2, Repeat, Pause, Play } from 'lucide-react';
import { useApp } from '../state/AppContext';
import { Button, Card, PageHeader, EmptyState, StatusBadge, MoneyText, Select, Tabs } from '../components/common/ui';
import { listRecurring, saveRecurring, deleteRecurring } from '../db/automationRepo';
import { FREQUENCY_LABELS } from '../core/automation';
import { getInvoice } from '../db/repository';
import { listInvoices, listCustomers, deleteInvoice } from '../db/repository';
import { formatDate, todayIso } from '../core/numbering';

export default function Invoices() {
  const { company, refreshKey, bumpRefresh } = useApp();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [tab, setTab] = useState('all');

  const { invoices, customerName } = useMemo(() => {
    if (!company) return { invoices: [], customerName: (_: string) => '' };
    const customers = listCustomers(company.id);
    const map = new Map(customers.map((c) => [c.id, c.name]));
    const today = todayIso();
    const raw = listInvoices(company.id).map((inv) => {
      if (inv.status !== 'paid' && inv.status !== 'draft' && inv.dueDate < today && inv.total - inv.amountPaid > 0 && inv.status !== 'overdue') {
        return { ...inv, status: 'overdue' as const };
      }
      return inv;
    });
    return { invoices: raw, customerName: (id: string) => map.get(id) ?? 'Unknown' };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company, refreshKey]);

  const filtered = invoices.filter((inv) => {
    const matchesSearch = inv.invoiceNumber.toLowerCase().includes(search.toLowerCase()) || customerName(inv.customerId).toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || inv.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  function handleDelete(id: string) {
    if (window.confirm('Delete this invoice? This also removes any recorded payments against it.')) {
      deleteInvoice(id);
      bumpRefresh();
    }
  }

  return (
    <div>
      <PageHeader
        title="Invoices"
        subtitle={`${invoices.length} invoice${invoices.length === 1 ? '' : 's'}`}
        actions={
          <Button onClick={() => navigate('/invoices/new')}>
            <Plus size={16} /> New invoice
          </Button>
        }
      />
      <Tabs
        tabs={[
          { id: 'all', label: 'Invoices' },
          { id: 'repeating', label: 'Repeating' }
        ]}
        active={tab}
        onChange={setTab}
      />
      {tab === 'repeating' ? (
        <RepeatingList companyId={company?.id ?? ''} customerName={customerName} onChange={bumpRefresh} />
      ) : (
      <>
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative max-w-sm flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="w-full rounded-lg border border-gray-300 pl-9 pr-3 py-2.5 text-sm focus:border-brand-green focus:ring-1 focus:ring-brand-green"
            placeholder="Search invoices…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="max-w-[180px]">
          <option value="all">All statuses</option>
          <option value="draft">Draft</option>
          <option value="sent">Sent</option>
          <option value="partial">Partially paid</option>
          <option value="paid">Paid</option>
          <option value="overdue">Overdue</option>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<FileText size={40} />}
          title={invoices.length === 0 ? 'No invoices yet' : 'No matches'}
          description={invoices.length === 0 ? 'Create your first invoice, or convert an accepted quote into one.' : 'Try a different search or filter.'}
          action={invoices.length === 0 ? <Button onClick={() => navigate('/invoices/new')}><Plus size={16} /> New invoice</Button> : undefined}
        />
      ) : (
        <Card padded={false}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100">
                <th className="px-5 py-3">Invoice #</th>
                <th className="px-5 py-3">Customer</th>
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">Due</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Balance due</th>
                <th className="px-5 py-3 text-right">Total</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((inv) => (
                <tr key={inv.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium text-brand-navy cursor-pointer" onClick={() => navigate(`/invoices/${inv.id}`)}>
                    {inv.invoiceNumber}
                  </td>
                  <td className="px-5 py-3 text-gray-600">{customerName(inv.customerId)}</td>
                  <td className="px-5 py-3 text-gray-500">{formatDate(inv.invoiceDate)}</td>
                  <td className="px-5 py-3 text-gray-500">{formatDate(inv.dueDate)}</td>
                  <td className="px-5 py-3">
                    <StatusBadge status={inv.status} />
                  </td>
                  <td className="px-5 py-3 text-right text-gray-600">
                    <MoneyText amount={Math.max(0, inv.total - inv.amountPaid)} />
                  </td>
                  <td className="px-5 py-3 text-right font-semibold text-brand-navy">
                    <MoneyText amount={inv.total} />
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button onClick={() => handleDelete(inv.id)} className="text-gray-400 hover:text-status-overdue">
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      </>
      )}
    </div>
  );
}

function RepeatingList({ companyId, customerName, onChange }: { companyId: string; customerName: (id: string) => string; onChange: () => void }) {
  const navigate = useNavigate();
  const items = companyId ? listRecurring(companyId) : [];
  if (items.length === 0) {
    return (
      <EmptyState
        icon={<Repeat size={40} />}
        title="No repeating invoices"
        description="Open any invoice and press Repeat. Setwel then creates the next one for you every week, month, quarter or year."
      />
    );
  }
  return (
    <Card padded={false}>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100">
            <th className="px-5 py-3">Based on</th>
            <th className="px-5 py-3">Customer</th>
            <th className="px-5 py-3">How often</th>
            <th className="px-5 py-3">Next</th>
            <th className="px-5 py-3 text-right">Amount</th>
            <th className="px-5 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((r) => {
            const src = getInvoice(r.sourceInvoiceId);
            return (
              <tr key={r.id} className="border-b border-gray-100 last:border-0">
                <td className="px-5 py-3 font-medium text-brand-navy cursor-pointer" onClick={() => src && navigate(`/invoices/${src.id}`)}>
                  {src?.invoiceNumber ?? 'Deleted invoice'}
                </td>
                <td className="px-5 py-3 text-gray-600">{src ? customerName(src.customerId) : ''}</td>
                <td className="px-5 py-3 text-gray-600">{FREQUENCY_LABELS[r.frequency]}</td>
                <td className="px-5 py-3 text-gray-600">{r.active ? formatDate(r.nextDate) : 'Paused'}</td>
                <td className="px-5 py-3 text-right font-semibold text-brand-navy">{src && <MoneyText amount={src.total} />}</td>
                <td className="px-5 py-3 text-right whitespace-nowrap">
                  <button
                    title={r.active ? 'Pause' : 'Resume'}
                    onClick={() => {
                      saveRecurring({ ...r, active: !r.active });
                      onChange();
                    }}
                    className="text-gray-400 hover:text-brand-navy mr-3"
                  >
                    {r.active ? <Pause size={15} /> : <Play size={15} />}
                  </button>
                  <button
                    title="Stop repeating"
                    onClick={() => {
                      if (window.confirm('Stop repeating this invoice?')) {
                        deleteRecurring(r.id);
                        onChange();
                      }
                    }}
                    className="text-gray-400 hover:text-status-overdue"
                  >
                    <Trash2 size={15} />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}
