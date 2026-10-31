import React, { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Circle, Download, Upload, BookOpen } from 'lucide-react';
import { useApp, tierAtLeast } from '../state/AppContext';
import { Button, Card, PageHeader, Input } from '../components/common/ui';
import { listCustomers, listSuppliers, listInvoices, listBills, getSettings, setSetting } from '../db/repository';
import { listUsers } from '../db/enterpriseRepo';
import { listRecurring } from '../db/automationRepo';
import { getAccountant } from '../core/accountant';
import { ImportKind, runImport, templateCsv, TEMPLATES, OPENING_NOTE, ImportResult } from '../core/setupImport';
import { saveOrDownloadFile } from '../db/storageAdapter';
import { openExternal, manualUrl } from '../core/licence';
import { formatCurrency, todayIso } from '../core/numbering';

interface Step {
  id: string;
  title: string;
  detail: string;
  done: boolean;
  action?: React.ReactNode;
  optional?: boolean;
}

/**
 * Getting a business ready to run on Setwel. Owners can work through it themselves;
 * Setwel partner accountants use it when they set a business up.
 */
export default function Setup() {
  const { company, refreshKey, bumpRefresh, licence } = useApp();
  const navigate = useNavigate();
  const [result, setResult] = useState<{ kind: ImportKind; r?: ImportResult; error?: string } | null>(null);
  const inputs = { customers: useRef<HTMLInputElement>(null), suppliers: useRef<HTMLInputElement>(null), opening_debtors: useRef<HTMLInputElement>(null), opening_creditors: useRef<HTMLInputElement>(null) };
  const [balance, setBalance] = useState('');

  const data = useMemo(() => {
    if (!company) return null;
    const settings = getSettings(company.id);
    const invoices = listInvoices(company.id);
    const bills = listBills(company.id);
    return {
      settings,
      customers: listCustomers(company.id).length,
      suppliers: listSuppliers(company.id).length,
      openingDebtors: invoices.filter((i) => i.notes === OPENING_NOTE),
      openingBills: bills.filter((b) => b.items[0]?.description.startsWith('Opening balance')),
      realInvoices: invoices.filter((i) => i.notes !== OPENING_NOTE && i.status !== 'draft').length,
      recurring: listRecurring(company.id).length,
      users: listUsers(company.id).length,
      accountant: getAccountant(company.id)
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company, refreshKey]);
  if (!company || !data) return null;

  const tier = company.packageTier;
  const grinder = tierAtLeast(tier, 'grinder');
  const enterprise = tierAtLeast(tier, 'enterprise');

  async function template(kind: ImportKind) {
    await saveOrDownloadFile(TEMPLATES[kind].file, templateCsv(kind), 'text/csv');
  }

  async function upload(kind: ImportKind, e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try {
      const r = runImport(company!.id, kind, await f.text());
      setResult({ kind, r });
      bumpRefresh();
    } catch (err: any) {
      setResult({ kind, error: err.message });
    }
  }

  const importButtons = (kind: ImportKind, label: string) => (
    <div className="flex flex-wrap gap-2">
      <input ref={inputs[kind]} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => upload(kind, e)} />
      <Button size="sm" variant="secondary" onClick={() => template(kind)}>
        <Download size={14} /> Template
      </Button>
      <Button size="sm" onClick={() => inputs[kind].current?.click()}>
        <Upload size={14} /> {label}
      </Button>
    </div>
  );

  const s = data.settings;
  const steps: Step[] = [
    {
      id: 'details',
      title: 'Business details',
      detail: 'Name, business type, province and financial year. These decide your tax estimates.',
      done: !!company.province && !!company.businessType,
      action: <Button size="sm" variant="secondary" onClick={() => navigate('/settings')}>Open settings</Button>
    },
    {
      id: 'vat',
      title: 'VAT registration',
      detail: company.isVatRegistered
        ? 'VAT number and the months your VAT periods end, so Setwel can warn before each VAT201.'
        : 'Not VAT registered. Setwel warns you when sales get close to the R1 million threshold.',
      done: !company.isVatRegistered || (!!company.vatNumber && (company.vatPeriod === 'monthly' || !!s.vatCycle)),
      action: <Button size="sm" variant="secondary" onClick={() => navigate('/settings')}>Set VAT</Button>
    },
    {
      id: 'bank',
      title: 'Banking details and logo',
      detail: 'Printed on invoices and reminders so customers can pay by EFT.',
      done: !!company.bankAccountNumber,
      action: <Button size="sm" variant="secondary" onClick={() => navigate('/settings')}>Add banking details</Button>
    },
    {
      id: 'customers',
      title: 'Customers',
      detail: `Type them in, or load a spreadsheet. ${data.customers} in Setwel now.`,
      done: data.customers > 0,
      action: importButtons('customers', 'Load customers')
    },
    ...(grinder
      ? [
          {
            id: 'suppliers',
            title: 'Suppliers',
            detail: `Who you buy from. ${data.suppliers} in Setwel now.`,
            done: data.suppliers > 0,
            action: importButtons('suppliers', 'Load suppliers'),
            optional: true
          }
        ]
      : []),
    {
      id: 'opening_debtors',
      title: 'What customers owe you today',
      detail: data.openingDebtors.length
        ? `${data.openingDebtors.length} opening balances loaded, ${formatCurrency(data.openingDebtors.reduce((t, i) => t + i.total - i.amountPaid, 0))} still owed.`
        : 'Unpaid invoices from before you started with Setwel, so reminders and "who owes you" are right from day one.',
      done: data.openingDebtors.length > 0,
      action: importButtons('opening_debtors', 'Load balances'),
      optional: true
    },
    ...(grinder
      ? [
          {
            id: 'opening_creditors',
            title: 'Supplier bills you still have to pay',
            detail: data.openingBills.length ? `${data.openingBills.length} unpaid bills loaded.` : 'Unpaid supplier bills from before Setwel, so bill reminders and cash flow are right.',
            done: data.openingBills.length > 0,
            action: importButtons('opening_creditors', 'Load bills'),
            optional: true
          }
        ]
      : []),
    ...(enterprise
      ? [
          {
            id: 'cash',
            title: 'Bank balance today',
            detail: s.cashBalance !== undefined ? `Set to ${formatCurrency(Number(s.cashBalance))}. Used by the cash-flow forecast.` : 'Starting point for the cash-flow forecast.',
            done: s.cashBalance !== undefined,
            action: (
              <div className="flex gap-2">
                <Input type="number" placeholder="R" value={balance} onChange={(e) => setBalance(e.target.value)} className="max-w-[140px]" />
                <Button
                  size="sm"
                  onClick={() => {
                    setSetting(company.id, 'cashBalance', String(Number(balance) || 0));
                    setSetting(company.id, 'cashBalanceDate', todayIso());
                    bumpRefresh();
                  }}
                >
                  Save
                </Button>
              </div>
            )
          },
          {
            id: 'staff',
            title: 'Staff logins',
            detail: data.users ? `${data.users} logins set up.` : 'Give each staff member their own PIN, if more than one person uses Setwel.',
            done: data.users > 0,
            action: <Button size="sm" variant="secondary" onClick={() => navigate('/settings')}>Set up logins</Button>,
            optional: true
          }
        ]
      : []),
    {
      id: 'repeat',
      title: 'Repeating invoices',
      detail: 'Rent, retainers, school fees? Open the invoice and press Repeat. Setwel makes the next one for you.',
      done: data.recurring > 0,
      action: <Button size="sm" variant="secondary" onClick={() => navigate('/invoices')}>Open invoices</Button>,
      optional: true
    },
    {
      id: 'accountant',
      title: 'Your accountant',
      detail: data.accountant.firm || data.accountant.name ? `${data.accountant.firm || data.accountant.name}.` : 'Who to send your books to each month.',
      done: !!(data.accountant.firm || data.accountant.name),
      action: <Button size="sm" variant="secondary" onClick={() => navigate('/settings')}>Add accountant</Button>,
      optional: true
    },
    {
      id: 'first',
      title: 'Send your first invoice',
      detail: 'Make an invoice and send it on WhatsApp or email.',
      done: data.realInvoices > 0,
      action: <Button size="sm" onClick={() => navigate('/invoices/new')}>New invoice</Button>
    }
  ];

  const required = steps.filter((st) => !st.optional);
  const done = steps.filter((st) => st.done).length;
  const pct = Math.round((done / steps.length) * 100);

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Setup checklist"
        subtitle={`Get ${company.name} ready on Setwel. ${done} of ${steps.length} done.`}
        actions={
          <Button variant="secondary" size="sm" onClick={() => openExternal(manualUrl(licence))}>
            <BookOpen size={15} /> Training manual
          </Button>
        }
      />
      <div className="h-2 rounded-full bg-gray-200 overflow-hidden mb-6">
        <div className="h-full bg-brand-green" style={{ width: `${pct}%` }} />
      </div>
      {required.every((st) => st.done) && <div className="mb-4 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-status-paid font-semibold">The essentials are done. {company.name} is ready to run on Setwel.</div>}

      {result && (
        <div className={`mb-4 rounded-lg px-4 py-3 text-sm ${result.error ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-amber-50 border border-brand-gold/40 text-brand-navy'}`}>
          {result.error ?? (
            <>
              <strong>{result.r!.added} added.</strong>
              {result.r!.createdNames.length > 0 && ` New ${result.kind === 'opening_debtors' ? 'customers' : 'suppliers'} created: ${result.r!.createdNames.slice(0, 8).join(', ')}${result.r!.createdNames.length > 8 ? '…' : ''}.`}
              {result.r!.skipped.length > 0 && (
                <ul className="mt-1 text-xs text-gray-600 list-disc pl-5">
                  {result.r!.skipped.slice(0, 10).map((sk) => (
                    <li key={sk.row}>
                      Row {sk.row} skipped: {sk.reason}
                    </li>
                  ))}
                  {result.r!.skipped.length > 10 && <li>and {result.r!.skipped.length - 10} more</li>}
                </ul>
              )}
            </>
          )}
        </div>
      )}

      <div className="space-y-3">
        {steps.map((st) => (
          <Card key={st.id}>
            <div className="flex flex-wrap items-start gap-3 justify-between">
              <div className="flex gap-3 min-w-0 flex-1">
                {st.done ? <CheckCircle2 className="text-status-paid shrink-0 mt-0.5" size={20} /> : <Circle className="text-gray-300 shrink-0 mt-0.5" size={20} />}
                <div className="min-w-0">
                  <div className="font-semibold text-brand-navy">
                    {st.title} {st.optional && <span className="text-xs font-normal text-gray-400">(if it applies)</span>}
                  </div>
                  <div className="text-sm text-gray-500">{st.detail}</div>
                </div>
              </div>
              <div className="shrink-0">{st.action}</div>
            </div>
          </Card>
        ))}
      </div>
      <p className="text-xs text-gray-400 mt-4">
        Spreadsheets: download the template, fill in one row per line in Excel or Google Sheets, save as CSV, then load it. Opening balances are loaded as unpaid
        invoices and bills without VAT, dated on their original dates, and are left out of VAT201 figures.
      </p>
    </div>
  );
}
