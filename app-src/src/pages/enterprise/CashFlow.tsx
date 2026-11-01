import React, { useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import { Button, Card, PageHeader, Input, Field } from '../../components/common/ui';
import { listInvoices, listBills, listExpenses, getSettings, setSetting } from '../../db/repository';
import { listRecurring } from '../../db/automationRepo';
import { buildForecast } from '../../core/planning';
import { formatCurrency, formatDate, todayIso } from '../../core/numbering';

export default function CashFlow() {
  const { company, refreshKey, bumpRefresh } = useApp();
  const settings = company ? getSettings(company.id) : {};
  const [balance, setBalance] = useState(settings.cashBalance ?? '');
  const [open, setOpen] = useState<string | null>(null);

  const forecast = useMemo(() => {
    if (!company || settings.cashBalance === undefined) return null;
    return buildForecast({
      opening: Number(settings.cashBalance) || 0,
      openingDate: settings.cashBalanceDate,
      invoices: listInvoices(company.id),
      bills: listBills(company.id),
      expenses: listExpenses(company.id),
      recurring: listRecurring(company.id)
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company, refreshKey, settings.cashBalance]);
  if (!company) return null;

  function saveBalance() {
    setSetting(company!.id, 'cashBalance', String(Number(balance) || 0));
    setSetting(company!.id, 'cashBalanceDate', todayIso());
    bumpRefresh();
  }

  return (
    <div>
      <PageHeader title="Cash-flow forecast" subtitle="Where your bank balance is heading over the next 13 weeks." />
      <Card className="mb-5">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Money in the bank today (R)" hint={settings.cashBalanceDate ? `Last updated ${formatDate(settings.cashBalanceDate)}. Update it whenever you check your bank.` : 'Check your banking app and enter the balance.'}>
            <Input type="number" step="0.01" value={balance} onChange={(e) => setBalance(e.target.value)} className="max-w-[220px]" />
          </Field>
          <div className="mb-4">
            <Button onClick={saveBalance}>Update forecast</Button>
          </div>
        </div>
      </Card>

      {!forecast ? (
        <p className="text-sm text-gray-500">Enter your bank balance above to see the forecast.</p>
      ) : (
        <>
          {forecast.lowest.week && forecast.lowest.amount < 0 ? (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800 flex gap-2">
              <AlertTriangle size={18} className="shrink-0" />
              <span>
                Your balance could drop to <strong>{formatCurrency(forecast.lowest.amount)}</strong> in the week of {formatDate(forecast.lowest.week.start)}. Chase
                overdue invoices now, or move bill payments if you can.
              </span>
            </div>
          ) : (
            <div className="mb-4 rounded-lg bg-amber-50 border border-brand-gold/40 px-4 py-3 text-sm text-brand-navy">
              Lowest expected balance: <strong>{formatCurrency(forecast.lowest.amount)}</strong>
              {forecast.lowest.week ? ` (week of ${formatDate(forecast.lowest.week.start)})` : ''}.
            </div>
          )}
          <Card padded={false}>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100">
                  <th className="px-4 py-3">Week</th>
                  <th className="px-4 py-3 text-right">Money in</th>
                  <th className="px-4 py-3 text-right">Money out</th>
                  <th className="px-4 py-3 text-right">Balance at end</th>
                </tr>
              </thead>
              <tbody>
                {forecast.weeks.map((w) => (
                  <React.Fragment key={w.start}>
                    <tr className="border-b border-gray-100 cursor-pointer hover:bg-gray-50" onClick={() => setOpen(open === w.start ? null : w.start)}>
                      <td className="px-4 py-3 text-brand-navy whitespace-nowrap">
                        {open === w.start ? <ChevronDown size={14} className="inline" /> : <ChevronRight size={14} className="inline" />} {formatDate(w.start)}
                      </td>
                      <td className="px-4 py-3 text-right text-status-paid">{w.moneyIn ? formatCurrency(w.moneyIn) : '—'}</td>
                      <td className="px-4 py-3 text-right">{w.moneyOut ? formatCurrency(w.moneyOut) : '—'}</td>
                      <td className={`px-4 py-3 text-right font-semibold ${w.closing < 0 ? 'text-status-overdue' : 'text-brand-navy'}`}>{formatCurrency(w.closing)}</td>
                    </tr>
                    {open === w.start && (
                      <tr className="bg-brand-panel">
                        <td colSpan={4} className="px-8 py-2">
                          {w.details.length === 0 ? (
                            <span className="text-xs text-gray-500">Nothing expected this week.</span>
                          ) : (
                            <ul className="text-xs text-gray-600 space-y-0.5">
                              {w.details.map((d, i) => (
                                <li key={i} className="flex justify-between max-w-md">
                                  <span>{d.label}</span>
                                  <span className={d.amount > 0 ? 'text-status-paid' : ''}>{formatCurrency(d.amount)}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </Card>
          <p className="text-xs text-gray-400 mt-3">
            Money in: unpaid invoices on their due dates (overdue ones counted this week) and repeating invoices. Money out: unpaid supplier bills, plus everyday
            spending of {formatCurrency(forecast.averageWeeklySpend)} a week (your average over the last 3 months). It's an estimate: customers may pay late.
          </p>
        </>
      )}
    </div>
  );
}
