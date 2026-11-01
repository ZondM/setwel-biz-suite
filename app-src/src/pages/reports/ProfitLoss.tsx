import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Printer } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import { Button, Card, PageHeader, Field, Input } from '../../components/common/ui';
import { listInvoices, listExpenses, listCategories, listCustomers } from '../../db/repository';
import { formatCurrency, todayIso } from '../../core/numbering';
import { exportToCsv } from '../../utils/csv';

function startOfMonth(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

export default function ProfitLoss() {
  const { company } = useApp();
  const navigate = useNavigate();
  const [periodStart, setPeriodStart] = useState(startOfMonth());
  const [periodEnd, setPeriodEnd] = useState(todayIso());

  const result = useMemo(() => {
    if (!company) return null;
    const invoices = listInvoices(company.id).filter((i) => i.status === 'paid' && i.invoiceDate >= periodStart && i.invoiceDate <= periodEnd);
    const expenses = listExpenses(company.id).filter((e) => e.expenseDate >= periodStart && e.expenseDate <= periodEnd);
    const categories = listCategories(company.id);
    const customers = listCustomers(company.id);
    const customerMap = new Map(customers.map((c) => [c.id, c.name]));
    const categoryMap = new Map(categories.map((c) => [c.id, c]));

    const incomeByCustomer = new Map<string, number>();
    for (const inv of invoices) {
      incomeByCustomer.set(inv.customerId, (incomeByCustomer.get(inv.customerId) ?? 0) + inv.subtotal);
    }
    const totalIncome = invoices.reduce((s, i) => s + i.subtotal, 0);

    let costOfSales = 0;
    const expensesByCategory = new Map<string, number>();
    for (const exp of expenses) {
      const exclAmount = exp.vatApplicable ? exp.amount - exp.vatAmount : exp.amount;
      const cat = categoryMap.get(exp.categoryId);
      if (cat?.type === 'cost_of_sales') {
        costOfSales += exclAmount;
      } else {
        expensesByCategory.set(exp.categoryId, (expensesByCategory.get(exp.categoryId) ?? 0) + exclAmount);
      }
    }
    const grossProfit = totalIncome - costOfSales;
    const totalOperatingExpenses = Array.from(expensesByCategory.values()).reduce((a, b) => a + b, 0);
    const netProfit = grossProfit - totalOperatingExpenses;

    return {
      incomeRows: Array.from(incomeByCustomer.entries()).map(([id, amount]) => ({ name: customerMap.get(id) ?? 'Unknown', amount })),
      totalIncome,
      costOfSales,
      grossProfit,
      expenseRows: Array.from(expensesByCategory.entries()).map(([id, amount]) => ({ name: categoryMap.get(id)?.name ?? 'Other', amount })),
      totalOperatingExpenses,
      netProfit
    };
  }, [company, periodStart, periodEnd]);

  if (!company || !result) return null;

  function handleExport() {
    exportToCsv(`profit-loss-${periodStart}-to-${periodEnd}`, ['Line', 'Amount (ZAR)'], [
      ...result!.incomeRows.map((r) => [`Income: ${r.name}`, r.amount.toFixed(2)]),
      ['Total income', result!.totalIncome.toFixed(2)],
      ['Cost of sales', result!.costOfSales.toFixed(2)],
      ['Gross profit', result!.grossProfit.toFixed(2)],
      ...result!.expenseRows.map((r) => [`Expense: ${r.name}`, r.amount.toFixed(2)]),
      ['Total operating expenses', result!.totalOperatingExpenses.toFixed(2)],
      ['Net profit', result!.netProfit.toFixed(2)]
    ]);
  }

  return (
    <div>
      <button onClick={() => navigate('/reports')} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-brand-navy mb-4 no-print">
        <ArrowLeft size={15} /> Back to reports
      </button>
      <PageHeader
        title="Profit & Loss"
        subtitle="Based on paid invoices and recorded expenses for the period below"
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
          <Field label="From">
            <Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
          </Field>
          <Field label="To">
            <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
          </Field>
        </div>
      </Card>

      <Card>
        <Section title="Income">
          {result!.incomeRows.length === 0 ? <Row name="No income in this period" amount={0} muted /> : result!.incomeRows.map((r) => <Row key={r.name} name={r.name} amount={r.amount} />)}
          <Row name="Total income" amount={result!.totalIncome} bold />
        </Section>
        <Section title="Cost of sales">
          <Row name="Total cost of sales" amount={result!.costOfSales} bold />
        </Section>
        <Row name="Gross profit" amount={result!.grossProfit} bold highlight />
        <Section title="Operating expenses">
          {result!.expenseRows.length === 0 ? <Row name="No expenses in this period" amount={0} muted /> : result!.expenseRows.map((r) => <Row key={r.name} name={r.name} amount={r.amount} />)}
          <Row name="Total operating expenses" amount={result!.totalOperatingExpenses} bold />
        </Section>
        <Row name="Net profit" amount={result!.netProfit} bold highlight large />
      </Card>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-2">
      <h4 className="text-xs font-bold uppercase tracking-wide text-gray-400 mt-4 mb-2">{title}</h4>
      {children}
    </div>
  );
}

function Row({ name, amount, bold, highlight, large, muted }: { name: string; amount: number; bold?: boolean; highlight?: boolean; large?: boolean; muted?: boolean }) {
  return (
    <div className={`flex justify-between py-1.5 ${highlight ? 'border-t border-gray-200 mt-1 pt-2.5' : ''} ${muted ? 'text-gray-400' : 'text-brand-navy'}`}>
      <span className={bold ? 'font-semibold' : ''}>{name}</span>
      <span className={`${bold ? 'font-semibold' : ''} ${large ? 'font-display text-lg' : ''}`}>{formatCurrency(amount)}</span>
    </div>
  );
}
