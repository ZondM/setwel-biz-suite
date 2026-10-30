import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, FileText, Wallet, AlertTriangle, TrendingUp, Clock, Zap } from 'lucide-react';
import { useApp, usePermissions } from '../state/AppContext';
import { Button, Card, PageHeader, StatCard, MoneyText, StatusBadge } from '../components/common/ui';
import { listInvoices, listExpenses, listCustomers, listCategories } from '../db/repository';
import { buildFinancialSummary } from '../core/financialEngine';
import { formatCurrency, formatDate, ownerFirstName, todayIso } from '../core/numbering';
import { useTrialStatus } from '../components/common/SecurityGates';
import { AttentionPanel } from '../components/automation/AttentionPanel';

const TIPS = [
  'Keep every receipt — even small cash purchases add up to real deductions at tax time.',
  'A VAT invoice must show your VAT number, a sequential invoice number, and VAT shown separately.',
  'Send quotes within 24 hours of a site visit — quick quotes win more jobs.',
  'Set aside your VAT money in a separate "SARS" savings pocket so it is never spent by accident.',
  'Invoices overdue by more than 90 days are much harder to collect — follow up early.',
  'Provisional tax is due twice a year if you earn business income outside a normal salary.'
];

export default function Dashboard() {
  const { company, refreshKey } = useApp();
  const { canSeeFinancials } = usePermissions();
  const navigate = useNavigate();
  const [tipIndex] = useState(() => Math.floor(Math.random() * TIPS.length));

  const data = useMemo(() => {
    if (!company) return null;
    const invoices = listInvoices(company.id);
    const expenses = listExpenses(company.id);
    const categories = listCategories(company.id);
    const costOfSalesIds = new Set(categories.filter((c) => c.type === 'cost_of_sales').map((c) => c.id));
    const paidInvoices = invoices.filter((i) => i.status === 'paid');
    const summary = buildFinancialSummary({
      paidInvoices,
      expenses,
      costOfSalesCategoryIds: costOfSalesIds,
      businessType: company.businessType,
      isVatRegistered: company.isVatRegistered
    });
    const today = todayIso();
    const overdue = invoices.filter((i) => i.status !== 'paid' && i.status !== 'draft' && i.dueDate < today && i.total - i.amountPaid > 0);
    const recentInvoices = [...invoices].sort((a, b) => (a.invoiceDate < b.invoiceDate ? 1 : -1)).slice(0, 5);
    const customers = listCustomers(company.id);
    const customerName = (id: string) => customers.find((c) => c.id === id)?.name ?? 'Unknown customer';

    // last 6 months income vs expense, by paid invoice / expense date
    const months: { label: string; income: number; expense: number }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleDateString('en-ZA', { month: 'short' });
      const monthStart = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
      const nextMonth = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      const monthEnd = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-01`;
      const income = paidInvoices.filter((inv) => inv.invoiceDate >= monthStart && inv.invoiceDate < monthEnd).reduce((s, inv) => s + inv.total, 0);
      const expense = expenses.filter((e) => e.expenseDate >= monthStart && e.expenseDate < monthEnd).reduce((s, e) => s + e.amount, 0);
      months.push({ label, income, expense });
    }

    return { summary, overdue, recentInvoices, customerName, months };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company, refreshKey]);


  // ── Trial banner ──────────────────────────────────────────────────────────
  const { isTrial, daysLeft, pct, isExpired } = useTrialStatus();
  const trialInfo = { isTrial, daysLeft, pct, isExpired };

  if (!company || !data) return null;
  const { summary, overdue, recentInvoices, customerName, months } = data;
  const maxMonthValue = Math.max(1, ...months.flatMap((m) => [m.income, m.expense]));

  return (
    <div>

      {canSeeFinancials && trialInfo && trialInfo.isTrial && (
        <div className={`rounded-xl p-4 mb-5 flex items-center justify-between gap-4 ${trialInfo.isExpired ? 'bg-red-50 border border-red-200' : 'bg-amber-50 border border-brand-gold/40'}`}>
          <div className="flex items-center gap-3 min-w-0">
            <Clock size={18} className={trialInfo.isExpired ? 'text-red-500 shrink-0' : 'text-brand-gold shrink-0'} />
            <div className="min-w-0">
              <p className={`font-semibold text-sm ${trialInfo.isExpired ? 'text-red-700' : 'text-brand-navy'}`}>
                {trialInfo.isExpired
                  ? 'Your 30-day free trial has ended'
                  : `${trialInfo.daysLeft} day${trialInfo.daysLeft === 1 ? '' : 's'} left in your free trial`}
              </p>
              <div className="mt-1.5 h-1.5 w-48 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${trialInfo.isExpired ? 'bg-red-500' : 'bg-brand-gold'}`}
                  style={{ width: `${trialInfo.pct}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {trialInfo.isExpired
                  ? 'Upgrade to keep access to your data and continue managing your business.'
                  : 'Choose a plan before your trial ends and nothing changes: your data stays exactly where it is.'}
              </p>
            </div>
          </div>
          <a href="#/upgrade" className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 bg-brand-gold text-brand-navy text-sm font-bold rounded-lg hover:brightness-95 transition-all whitespace-nowrap">
            <Zap size={14} /> Choose a plan
          </a>
        </div>
      )}

      <PageHeader
        title={welcomeTitle(company.name)}
        subtitle="Here's how your business is doing right now."
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => navigate('/expenses')}>
              <Wallet size={16} /> Record expense
            </Button>
            <Button size="sm" onClick={() => navigate('/quotes/new')}>
              <Plus size={16} /> New quote
            </Button>
            <Button variant="gold" size="sm" onClick={() => navigate('/invoices/new')}>
              <FileText size={16} /> New invoice
            </Button>
          </>
        }
      />

      <AttentionPanel />

      {canSeeFinancials && (
      <>
      <div className="bg-brand-navy rounded-xl p-6 mb-6 text-white">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-bold text-lg">Your money, at a glance</h2>
          <TrendingUp size={20} className="text-brand-gold" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
          <Ledger label="Income (excl. VAT)" value={summary.totalIncomeExclVat} />
          <Ledger label="Cost of sales" value={summary.costOfSales} negative />
          <Ledger label="Gross profit" value={summary.grossProfit} highlight />
          <Ledger label="Operating expenses" value={summary.operatingExpenses} negative />
          <Ledger label="Net profit" value={summary.netProfit} highlight gold />
          <Ledger label="Output VAT" value={summary.outputVat} />
          <Ledger label="Input VAT" value={summary.inputVat} negative />
          <Ledger label={summary.netVatOwing >= 0 ? 'VAT owing to SARS' : 'VAT refund due'} value={Math.abs(summary.netVatOwing)} />
        </div>
        <div className="grid grid-cols-2 gap-5 mt-5 pt-5 border-t border-white/10">
          <Ledger label="Estimated income tax" value={summary.estimatedIncomeTax} />
          <Ledger label="Estimated take-home" value={summary.estimatedTakeHome} highlight gold />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <StatCard label="Gross profit margin" value={`${summary.grossProfitMargin}%`} tone="good" />
        <StatCard label="Net profit margin" value={`${summary.netProfitMargin}%`} tone={summary.netProfit >= 0 ? 'good' : 'bad'} />
        <StatCard label="Overdue invoices" value={String(overdue.length)} sublabel={formatCurrency(overdue.reduce((s, i) => s + (i.total - i.amountPaid), 0))} tone={overdue.length > 0 ? 'bad' : 'default'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <h3 className="font-display font-bold text-brand-navy mb-4">Income vs expenses — last 6 months</h3>
          <div className="flex items-end gap-4 h-48">
            {months.map((m) => (
              <div key={m.label} className="flex-1 flex flex-col items-center gap-1">
                <div className="flex items-end gap-1 h-40 w-full justify-center">
                  <div className="w-3 bg-brand-green rounded-t" style={{ height: `${(m.income / maxMonthValue) * 100}%` }} title={formatCurrency(m.income)} />
                  <div className="w-3 bg-brand-gold rounded-t" style={{ height: `${(m.expense / maxMonthValue) * 100}%` }} title={formatCurrency(m.expense)} />
                </div>
                <span className="text-xs text-gray-400">{m.label}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-brand-green inline-block" /> Income
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-brand-gold inline-block" /> Expenses
            </span>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={16} className="text-brand-gold" />
            <h3 className="font-display font-bold text-brand-navy">Tip of the day</h3>
          </div>
          <p className="text-sm text-gray-600">{TIPS[tipIndex]}</p>
        </Card>
      </div>

      </>
      )}

      <Card className="mt-4">
        <h3 className="font-display font-bold text-brand-navy mb-3">Recent invoices</h3>
        {recentInvoices.length === 0 ? (
          <p className="text-sm text-gray-400">No invoices yet. Create your first one to see it here.</p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {recentInvoices.map((inv) => (
                <tr key={inv.id} className="border-b border-gray-100 last:border-0 cursor-pointer hover:bg-gray-50" onClick={() => navigate(`/invoices/${inv.id}`)}>
                  <td className="py-2.5 font-medium text-brand-navy">{inv.invoiceNumber}</td>
                  <td className="py-2.5 text-gray-500">{customerName(inv.customerId)}</td>
                  <td className="py-2.5 text-gray-500">{formatDate(inv.invoiceDate)}</td>
                  <td className="py-2.5">
                    <StatusBadge status={inv.status} />
                  </td>
                  <td className="py-2.5 text-right font-semibold text-brand-navy">
                    <MoneyText amount={inv.total} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

function Ledger({ label, value, negative, highlight, gold }: { label: string; value: number; negative?: boolean; highlight?: boolean; gold?: boolean }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-white/50 mb-0.5">{label}</div>
      <div className={`font-display font-bold ${highlight ? 'text-lg' : 'text-base'} ${gold ? 'text-brand-gold' : 'text-white'}`}>
        {negative ? '-' : ''}
        {formatCurrency(value)}
      </div>
    </div>
  );
}

function welcomeTitle(businessName: string): string {
  const who = ownerFirstName(businessName);
  return who ? `Welcome back, ${who}` : 'Welcome back';
}
