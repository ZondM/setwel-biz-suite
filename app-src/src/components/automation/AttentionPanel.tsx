import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BellRing, CheckCircle2 } from 'lucide-react';
import { useApp, tierAtLeast } from '../../state/AppContext';
import { Button, Card, Modal } from '../common/ui';
import { listInvoices, listCustomers, listExpenses, listBills, listCategories, getSettings, setSetting, getCustomer } from '../../db/repository';
import { lastReminders, listBankLines } from '../../db/automationRepo';
import { buildAttention, AttentionAction } from '../../core/alerts';
import { Invoice } from '../../core/types';
import { SendModal } from './SendModal';

const LEVEL_STYLE = {
  urgent: 'border-l-4 border-status-overdue',
  soon: 'border-l-4 border-brand-gold',
  info: 'border-l-4 border-brand-navyLight'
};

/** The automation inbox on the dashboard. */
export function AttentionPanel() {
  const { company, refreshKey, bumpRefresh } = useApp();
  const navigate = useNavigate();
  const [sending, setSending] = useState<{ kind: 'invoice' | 'reminder'; invoice: Invoice } | null>(null);
  const [askVatCycle, setAskVatCycle] = useState(false);

  const items = useMemo(() => {
    if (!company) return [];
    const canUseBanking = tierAtLeast(company.packageTier, 'builder');
    return buildAttention({
      company,
      invoices: listInvoices(company.id),
      customers: listCustomers(company.id),
      expenses: listExpenses(company.id),
      bills: listBills(company.id),
      categories: listCategories(company.id),
      reminders: lastReminders(company.id),
      settings: getSettings(company.id),
      bankLinesToReview: canUseBanking ? listBankLines(company.id).filter((l) => l.status === 'new').length : 0,
      canUseBills: tierAtLeast(company.packageTier, 'grinder'),
      canUseBanking
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company, refreshKey]);

  if (!company) return null;

  function run(a: AttentionAction) {
    if (a.type === 'send') setSending({ kind: 'invoice', invoice: a.invoice });
    else if (a.type === 'remind') setSending({ kind: 'reminder', invoice: a.invoice });
    else if (a.type === 'go') {
      if (a.to.startsWith('/reports/monthly')) setSetting(company!.id, `reportSeen:${a.to.split('month=')[1]}`, '1');
      navigate(a.to);
    } else if (a.type === 'vat_category') setAskVatCycle(true);
    else if (a.type === 'done') {
      setSetting(company!.id, a.key, new Date().toISOString());
      bumpRefresh();
    }
  }

  return (
    <Card className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <BellRing size={17} className="text-brand-green" />
        <h2 className="font-display font-bold text-brand-navy">Needs your attention</h2>
        {items.length > 0 && <span className="ml-1 text-xs font-bold bg-brand-green text-white rounded-full px-2 py-0.5">{items.length}</span>}
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-gray-500 flex items-center gap-2">
          <CheckCircle2 size={16} className="text-status-paid" /> All done. Setwel checks again every time you open it.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.slice(0, 12).map((it) => (
            <li key={it.id} className={`flex flex-wrap items-center justify-between gap-3 bg-brand-panel rounded-lg px-3 py-2.5 ${LEVEL_STYLE[it.level]}`}>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-brand-navy">{it.title}</div>
                {it.detail && <div className="text-xs text-gray-500">{it.detail}</div>}
              </div>
              <div className="flex gap-2 shrink-0">
                {it.actions.map((a, i) => (
                  <Button key={a.label} size="sm" variant={i === 0 ? 'primary' : 'secondary'} onClick={() => run(a.action)}>
                    {a.label}
                  </Button>
                ))}
              </div>
            </li>
          ))}
          {items.length > 12 && <li className="text-xs text-gray-400">and {items.length - 12} more</li>}
        </ul>
      )}

      {sending && (
        <SendModal
          open
          kind={sending.kind}
          invoice={sending.invoice}
          customer={getCustomer(sending.invoice.customerId)}
          onClose={() => setSending(null)}
          onSent={bumpRefresh}
        />
      )}

      <Modal open={askVatCycle} onClose={() => setAskVatCycle(false)} title="When do your VAT periods end?">
        <p className="text-sm text-gray-500 mb-4">Look at a VAT201 from SARS, or your VAT registration letter. Two-monthly periods end in either the odd or the even months.</p>
        <div className="flex flex-col gap-2">
          {[
            { v: 'odd', label: 'January, March, May, July, September, November' },
            { v: 'even', label: 'February, April, June, August, October, December' }
          ].map((o) => (
            <Button
              key={o.v}
              variant="secondary"
              onClick={() => {
                setSetting(company.id, 'vatCycle', o.v);
                setAskVatCycle(false);
                bumpRefresh();
              }}
            >
              {o.label}
            </Button>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-3">If you file every month, set "VAT period: monthly" in Settings instead.</p>
      </Modal>
    </Card>
  );
}
