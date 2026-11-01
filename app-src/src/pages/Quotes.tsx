import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, FileStack, Search, Trash2, ArrowRightCircle, Download } from 'lucide-react';
import { useApp, usePermissions } from '../state/AppContext';
import { Button, Card, PageHeader, EmptyState, StatusBadge, MoneyText, Select } from '../components/common/ui';
import { listQuotes, listCustomers, deleteQuote } from '../db/repository';
import { formatDate } from '../core/numbering';
import { generateQuotePdf } from '../utils/pdf';
import { saveOrDownloadFile } from '../db/storageAdapter';
import { Quote } from '../core/types';

export default function Quotes() {
  const { company, refreshKey, bumpRefresh } = useApp();
  const { canDelete } = usePermissions();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const { quotes, customerName } = useMemo(() => {
    if (!company) return { quotes: [], customerName: (_: string) => '' };
    const customers = listCustomers(company.id);
    const map = new Map(customers.map((c) => [c.id, c.name]));
    return { quotes: listQuotes(company.id), customerName: (id: string) => map.get(id) ?? 'Unknown' };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company, refreshKey]);

  const filtered = quotes.filter((q) => {
    const matchesSearch = q.quoteNumber.toLowerCase().includes(search.toLowerCase()) || customerName(q.customerId).toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || q.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  async function handleDownload(q: Quote) {
    const customer = listCustomers(company!.id).find((c) => c.id === q.customerId) ?? null;
    const bytes = new Uint8Array(await generateQuotePdf(company!, customer, q).output('blob').arrayBuffer());
    await saveOrDownloadFile(`${q.quoteNumber}.pdf`, bytes, 'application/pdf');
  }

  function handleDelete(id: string) {
    if (window.confirm('Delete this quote?')) {
      deleteQuote(id);
      bumpRefresh();
    }
  }

  return (
    <div>
      <PageHeader
        title="Quotes"
        subtitle={`${quotes.length} quote${quotes.length === 1 ? '' : 's'}`}
        actions={
          <Button onClick={() => navigate('/quotes/new')}>
            <Plus size={16} /> New quote
          </Button>
        }
      />
      <div className="flex gap-3 mb-4">
        <div className="relative max-w-sm flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="w-full rounded-lg border border-gray-300 pl-9 pr-3 py-2.5 text-sm focus:border-brand-green focus:ring-1 focus:ring-brand-green"
            placeholder="Search quotes…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="max-w-[180px]">
          <option value="all">All statuses</option>
          <option value="draft">Draft</option>
          <option value="sent">Sent</option>
          <option value="accepted">Accepted</option>
          <option value="declined">Declined</option>
          <option value="converted">Converted</option>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<FileStack size={40} />}
          title={quotes.length === 0 ? 'No quotes yet' : 'No matches'}
          description={quotes.length === 0 ? 'Create a quote, send it to a customer, then convert it to an invoice with one click once accepted.' : 'Try a different search or filter.'}
          action={quotes.length === 0 ? <Button onClick={() => navigate('/quotes/new')}><Plus size={16} /> New quote</Button> : undefined}
        />
      ) : (
        <Card padded={false}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100">
                <th className="px-5 py-3">Quote #</th>
                <th className="px-5 py-3">Customer</th>
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">Valid until</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Total</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((q) => (
                <tr key={q.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium text-brand-navy cursor-pointer" onClick={() => navigate(`/quotes/${q.id}`)}>
                    {q.quoteNumber}
                  </td>
                  <td className="px-5 py-3 text-gray-600">{customerName(q.customerId)}</td>
                  <td className="px-5 py-3 text-gray-500">{formatDate(q.quoteDate)}</td>
                  <td className="px-5 py-3 text-gray-500">{formatDate(q.validUntil)}</td>
                  <td className="px-5 py-3">
                    <StatusBadge status={q.status} />
                  </td>
                  <td className="px-5 py-3 text-right font-semibold text-brand-navy">
                    <MoneyText amount={q.total} />
                  </td>
                  <td className="px-5 py-3 text-right whitespace-nowrap">
                    <button onClick={() => handleDownload(q)} className="text-gray-400 hover:text-brand-navy mr-3" title="Download PDF" aria-label={`Download ${q.quoteNumber} as PDF`}>
                      <Download size={16} />
                    </button>
                    {q.status !== 'converted' && (
                      <button onClick={() => navigate(`/quotes/${q.id}`)} className="text-gray-400 hover:text-brand-green mr-3" title="Convert to invoice">
                        <ArrowRightCircle size={16} />
                      </button>
                    )}
                    {canDelete && (<button onClick={() => handleDelete(q.id)} className="text-gray-400 hover:text-status-overdue"><Trash2 size={15} /></button>)}
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
