import React, { useMemo, useState } from 'react';
import { History as HistoryIcon } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import { Card, PageHeader, Select, EmptyState } from '../../components/common/ui';
import { listChanges } from '../../db/enterpriseRepo';

const ACTION_LABEL: Record<string, string> = { created: 'Created', changed: 'Changed', deleted: 'Deleted', payment: 'Payment', imported: 'Imported' };
const ACTION_STYLE: Record<string, string> = {
  created: 'bg-green-100 text-status-paid',
  changed: 'bg-blue-100 text-status-sent',
  deleted: 'bg-red-100 text-status-overdue',
  payment: 'bg-amber-100 text-status-partial',
  imported: 'bg-gray-100 text-gray-600'
};

export default function History() {
  const { company, refreshKey } = useApp();
  const [who, setWho] = useState('all');
  const [what, setWhat] = useState('all');
  const changes = useMemo(() => (company ? listChanges(company.id, 1000) : []), [company, refreshKey]);
  if (!company) return null;
  const people = [...new Set(changes.map((c) => c.userName))];
  const shown = changes.filter((c) => (who === 'all' || c.userName === who) && (what === 'all' || c.action === what));

  return (
    <div>
      <PageHeader title="Change history" subtitle="Who created, changed or deleted what, and when. The last 1,000 changes." />
      <div className="flex flex-wrap gap-3 mb-4">
        <Select value={who} onChange={(e) => setWho(e.target.value)} className="max-w-[220px]">
          <option value="all">Everyone</option>
          {people.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </Select>
        <Select value={what} onChange={(e) => setWhat(e.target.value)} className="max-w-[200px]">
          <option value="all">All changes</option>
          {Object.entries(ACTION_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Select>
      </div>
      {shown.length === 0 ? (
        <EmptyState icon={<HistoryIcon size={40} />} title="Nothing recorded yet" description="Changes to invoices, payments, expenses, bills, quotes, customers and suppliers appear here." />
      ) : (
        <Card padded={false}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100">
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">Who</th>
                <th className="px-4 py-3">What</th>
                <th className="px-4 py-3">Details</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((c) => (
                <tr key={c.id} className="border-b border-gray-100 last:border-0">
                  <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">
                    {new Date(c.at).toLocaleString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-4 py-2.5 text-brand-navy">{c.userName}</td>
                  <td className="px-4 py-2.5">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${ACTION_STYLE[c.action] ?? ''}`}>{ACTION_LABEL[c.action] ?? c.action}</span>
                  </td>
                  <td className="px-4 py-2.5 text-gray-600">{c.summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
