import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Briefcase, Plus, Download, FileUp } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import { Button, Card, PageHeader, Tabs, EmptyState, Input } from '../../components/common/ui';
import { listInvoices, listExpenses, listBills, getSettings } from '../../db/repository';
import { query } from '../../db/database';
import { balanceDue } from '../../core/automation';
import { latestVatPeriod, nextProvisionalDeadline } from '../../core/alerts';
import { calculateVat201, round2 } from '../../core/financialEngine';
import { formatCurrency, formatDate, todayIso } from '../../core/numbering';
import { exportToCsv } from '../../utils/csv';
import { Company } from '../../core/types';

function vatCycleFor(c: Company): 'monthly' | 'odd' | 'even' | null {
  if (!c.isVatRegistered) return null;
  if (c.vatPeriod === 'monthly') return 'monthly';
  const s = getSettings(c.id).vatCycle;
  return s === 'odd' || s === 'even' ? s : null;
}

/** When anything in a client's books was last changed (or imported). */
function lastActivity(companyId: string): string | null {
  const r = query<any>('SELECT MAX(at) AS at FROM audit_log WHERE company_id = :id', { ':id': companyId })[0];
  return r?.at ?? null;
}

/** Accountant Partner: every client on one screen. */
export default function Practice() {
  const { companies, switchCompany, setAddingBusiness, refreshKey } = useApp();
  const navigate = useNavigate();
  const [tab, setTab] = useState('clients');
  const today = todayIso();
  const [vatMonth, setVatMonth] = useState(today.slice(0, 7));

  const rows = useMemo(
    () =>
      companies.map((c) => {
        const invoices = listInvoices(c.id);
        const open = invoices.filter((i) => i.status !== 'paid' && i.status !== 'draft');
        const owed = round2(open.reduce((s, i) => s + balanceDue(i), 0));
        const overdue = round2(open.filter((i) => i.dueDate < today).reduce((s, i) => s + balanceDue(i), 0));
        const cycle = vatCycleFor(c);
        let vat: { label: string; deadline: string; amount: number } | null = null;
        if (cycle) {
          const p = latestVatPeriod(cycle, today);
          const v = calculateVat201(invoices, listExpenses(c.id), listBills(c.id), p.start, p.end);
          vat = { label: p.label, deadline: p.deadline, amount: v.netVat };
        }
        const prov = c.businessType === 'npo' ? null : nextProvisionalDeadline(today);
        return { c, owed, overdue, cycle, vat, prov, last: lastActivity(c.id) };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [companies, refreshKey]
  );

  // Bulk VAT: for each VAT client, the VAT period that ends in (or most recently before) the chosen month
  const vatRows = useMemo(() => {
    const [y, m] = vatMonth.split('-').map(Number);
    const ref = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10); // first day of the following month
    return companies
      .map((c) => {
        const cycle = vatCycleFor(c);
        if (!c.isVatRegistered) return null;
        if (!cycle) return { c, missing: true as const };
        const p = latestVatPeriod(cycle, ref);
        const v = calculateVat201(listInvoices(c.id), listExpenses(c.id), listBills(c.id), p.start, p.end);
        return { c, missing: false as const, p, v };
      })
      .filter(Boolean) as ({ c: Company; missing: true } | { c: Company; missing: false; p: ReturnType<typeof latestVatPeriod>; v: ReturnType<typeof calculateVat201> })[];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companies, vatMonth, refreshKey]);

  function open(id: string, to = '/dashboard') {
    switchCompany(id);
    navigate(to);
  }

  function exportVat() {
    void exportToCsv(
      `VAT summary ${vatMonth}`,
      ['Client', 'VAT number', 'Period', 'Due', 'Sales excl. VAT', 'Output VAT', 'Purchases excl. VAT', 'Input VAT', 'Payable (+) / refund (-)'],
      vatRows.map((r) =>
        r.missing
          ? [r.c.name, r.c.vatNumber ?? '', 'Set VAT period end months in Settings', '', '', '', '', '', '']
          : [r.c.name, r.c.vatNumber ?? '', r.p.label, r.p.deadline, r.v.totalSalesExclVat, r.v.outputVat, r.v.totalPurchasesExclVat, r.v.inputVat, r.v.netVat]
      )
    );
  }

  const daysTo = (d: string) => Math.round((Date.parse(d) - Date.parse(today)) / 86_400_000);
  const dueStyle = (d: string) => (daysTo(d) < 0 ? 'text-status-overdue font-semibold' : daysTo(d) <= 7 ? 'text-amber-700 font-semibold' : 'text-gray-600');

  return (
    <div>
      <PageHeader
        title="Practice dashboard"
        subtitle={`${companies.length} client${companies.length === 1 ? '' : 's'}. Deadlines, money owed and how up to date each file is.`}
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => navigate('/files')}>
              <FileUp size={15} /> Import a client file
            </Button>
            <Button size="sm" onClick={() => setAddingBusiness(true)}>
              <Plus size={15} /> Add a client
            </Button>
          </>
        }
      />
      <Tabs
        tabs={[
          { id: 'clients', label: 'All clients' },
          { id: 'vat', label: 'VAT summary' }
        ]}
        active={tab}
        onChange={setTab}
      />
      {companies.length === 0 ? (
        <EmptyState icon={<Briefcase size={40} />} title="No clients yet" description="Add a client, or import a file a client sent you." />
      ) : tab === 'clients' ? (
        <Card padded={false}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100">
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">VAT201</th>
                <th className="px-4 py-3">Provisional tax</th>
                <th className="px-4 py-3 text-right">Owed to client</th>
                <th className="px-4 py-3">Last updated</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.c.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 cursor-pointer" onClick={() => open(r.c.id)}>
                  <td className="px-4 py-3 font-medium text-brand-navy">{r.c.name}</td>
                  <td className="px-4 py-3">
                    {!r.c.isVatRegistered ? (
                      <span className="text-gray-400">Not registered</span>
                    ) : !r.vat ? (
                      <button onClick={(e) => { e.stopPropagation(); open(r.c.id, '/settings'); }} className="text-amber-700 underline text-xs">
                        Set VAT period
                      </button>
                    ) : (
                      <span className={dueStyle(r.vat.deadline)}>
                        {r.vat.label}: due {formatDate(r.vat.deadline)}
                        <span className="block text-xs font-normal text-gray-500">{r.vat.amount >= 0 ? 'Pay' : 'Refund'} {formatCurrency(Math.abs(r.vat.amount))}</span>
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">{r.prov ? <span className={dueStyle(r.prov.date)}>{formatDate(r.prov.date)}</span> : <span className="text-gray-400">—</span>}</td>
                  <td className="px-4 py-3 text-right">
                    {formatCurrency(r.owed)}
                    {r.overdue > 0 && <span className="block text-xs text-status-overdue">{formatCurrency(r.overdue)} overdue</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{r.last ? formatDate(r.last.slice(0, 10)) : 'No changes yet'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <span className="text-sm text-gray-600">VAT periods ending in or before</span>
            <Input type="month" value={vatMonth} onChange={(e) => e.target.value && setVatMonth(e.target.value)} className="max-w-[170px]" />
            <Button variant="secondary" size="sm" onClick={exportVat}>
              <Download size={15} /> Spreadsheet
            </Button>
          </div>
          <Card padded={false}>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100">
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Period</th>
                  <th className="px-4 py-3">Due</th>
                  <th className="px-4 py-3 text-right">Output VAT</th>
                  <th className="px-4 py-3 text-right">Input VAT</th>
                  <th className="px-4 py-3 text-right">Pay / refund</th>
                </tr>
              </thead>
              <tbody>
                {vatRows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-gray-400">None of your clients are VAT registered.</td>
                  </tr>
                )}
                {vatRows.map((r) =>
                  r.missing ? (
                    <tr key={r.c.id} className="border-b border-gray-100">
                      <td className="px-4 py-3 font-medium text-brand-navy">{r.c.name}</td>
                      <td colSpan={5} className="px-4 py-3 text-amber-700 text-xs">Set which months the VAT periods end in (Settings, Company).</td>
                    </tr>
                  ) : (
                    <tr key={r.c.id} className="border-b border-gray-100">
                      <td className="px-4 py-3 font-medium text-brand-navy">{r.c.name}</td>
                      <td className="px-4 py-3 text-gray-600">{r.p.label}</td>
                      <td className={`px-4 py-3 ${dueStyle(r.p.deadline)}`}>{formatDate(r.p.deadline)}</td>
                      <td className="px-4 py-3 text-right">{formatCurrency(r.v.outputVat)}</td>
                      <td className="px-4 py-3 text-right">{formatCurrency(r.v.inputVat)}</td>
                      <td className={`px-4 py-3 text-right font-semibold ${r.v.netVat < 0 ? 'text-status-paid' : ''}`}>{formatCurrency(r.v.netVat)}</td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </Card>
          <p className="text-xs text-gray-400 mt-3">Based on each client's Setwel records as last imported. eFiling deadlines are the last business day of the month after the period; check for public holidays.</p>
        </>
      )}
    </div>
  );
}
