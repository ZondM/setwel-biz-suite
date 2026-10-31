import React, { useMemo, useState } from 'react';
import { PiggyBank } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import { Card, PageHeader, Input, MoneyText } from '../../components/common/ui';
import { listCategories, listExpenses, listBills } from '../../db/repository';
import { listBudgets, setBudget } from '../../db/enterpriseRepo';
import { budgetLines } from '../../core/planning';
import { formatCurrency } from '../../core/numbering';
import { monthLabel } from '../../core/monthlyReport';

const BAR = { none: 'bg-gray-200', ok: 'bg-status-paid', warn: 'bg-brand-gold', over: 'bg-status-overdue' };

export default function Budgets() {
  const { company, refreshKey, bumpRefresh } = useApp();
  const thisMonth = new Date().toISOString().slice(0, 7);
  const [month, setMonth] = useState(thisMonth);

  const lines = useMemo(() => {
    if (!company) return [];
    return budgetLines(listCategories(company.id), listExpenses(company.id), listBills(company.id), listBudgets(company.id), month);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company, refreshKey, month]);
  if (!company) return null;

  const budgeted = lines.filter((l) => l.budget > 0);
  const totalBudget = budgeted.reduce((s, l) => s + l.budget, 0);
  const totalSpent = budgeted.reduce((s, l) => s + l.spent, 0);
  const unbudgetedSpend = lines.filter((l) => l.budget === 0).reduce((s, l) => s + l.spent, 0);

  return (
    <div>
      <PageHeader
        title="Budgets"
        subtitle="Set a monthly limit per expense category. Setwel warns you on the dashboard at 80% and when you go over."
        actions={<Input type="month" value={month} max={thisMonth} onChange={(e) => e.target.value && setMonth(e.target.value)} className="max-w-[170px]" />}
      />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card>
          <div className="text-xs uppercase tracking-wide text-gray-500">Budgeted for {monthLabel(month)}</div>
          <div className="font-display text-2xl font-bold text-brand-navy">{formatCurrency(totalBudget)}</div>
        </Card>
        <Card>
          <div className="text-xs uppercase tracking-wide text-gray-500">Spent in budgeted categories</div>
          <div className={`font-display text-2xl font-bold ${totalSpent > totalBudget && totalBudget > 0 ? 'text-status-overdue' : 'text-brand-navy'}`}>{formatCurrency(totalSpent)}</div>
        </Card>
        <Card>
          <div className="text-xs uppercase tracking-wide text-gray-500">Spent with no budget set</div>
          <div className="font-display text-2xl font-bold text-brand-navy">{formatCurrency(unbudgetedSpend)}</div>
        </Card>
      </div>
      <Card padded={false}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100">
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3 w-40">Monthly budget (R)</th>
              <th className="px-4 py-3 text-right">Spent</th>
              <th className="px-4 py-3 w-1/3">Progress</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.category.id} className="border-b border-gray-100 last:border-0">
                <td className="px-4 py-3 text-brand-navy">{l.category.name}</td>
                <td className="px-4 py-2">
                  <Input
                    type="number"
                    min={0}
                    step="50"
                    defaultValue={l.budget || ''}
                    placeholder="No budget"
                    onBlur={(e) => {
                      const v = Number(e.target.value);
                      if (v !== l.budget) {
                        setBudget(company.id, l.category.id, v);
                        bumpRefresh();
                      }
                    }}
                  />
                </td>
                <td className="px-4 py-3 text-right font-semibold">
                  <MoneyText amount={l.spent} />
                </td>
                <td className="px-4 py-3">
                  {l.budget > 0 ? (
                    <div>
                      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                        <div className={`h-full ${BAR[l.status]}`} style={{ width: `${Math.min(100, l.pct)}%` }} />
                      </div>
                      <div className={`text-xs mt-1 ${l.status === 'over' ? 'text-status-overdue font-semibold' : 'text-gray-500'}`}>
                        {l.pct}% {l.status === 'over' ? `, ${formatCurrency(l.spent - l.budget)} over` : `, ${formatCurrency(l.budget - l.spent)} left`}
                      </div>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400">No budget</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <p className="text-xs text-gray-400 mt-3 flex items-center gap-1">
        <PiggyBank size={13} /> Amounts exclude VAT. A budget applies every month until you change it.
      </p>
    </div>
  );
}
