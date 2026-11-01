import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, FileBarChart, Clock, Users, CalendarDays, Layers, Package, Lock } from 'lucide-react';
import { Button, Card, PageHeader, Modal, Input } from '../components/common/ui';
import { useApp, tierAtLeast } from '../state/AppContext';
import { buildMonthEndPack } from '../core/monthEndPack';
import { saveOrDownloadFile } from '../db/storageAdapter';
import { previousMonth } from '../core/monthlyReport';

const REPORTS = [
  { to: '/reports/monthly', icon: CalendarDays, title: 'Monthly report', description: 'Invoiced, received, expenses, profit and who owes you, for any month. Download, WhatsApp or email it.' },
  { to: '/reports/profit-loss', icon: TrendingUp, title: 'Profit & Loss', description: 'Income, cost of sales and expenses for any period, broken down by customer and category.' },
  { to: '/reports/vat201', icon: FileBarChart, title: 'VAT201', description: 'Output VAT, input VAT and the net amount owing or refundable for a VAT period.' },
  { to: '/reports/aged-debtors', icon: Clock, title: 'Aged Debtors', description: 'Who owes you money, and how overdue it is — current, 30, 60, 90+ days.' },
  { to: '/reports/aged-creditors', icon: Users, title: 'Aged Creditors', description: 'What you owe suppliers, and how overdue it is.' }
];

export default function Reports() {
  const navigate = useNavigate();
  const { company, companies } = useApp();
  const enterprise = tierAtLeast(company?.packageTier, 'enterprise');
  const [packOpen, setPackOpen] = useState(false);
  const [month, setMonth] = useState(previousMonth(new Date().toISOString().slice(0, 7)));
  const [busy, setBusy] = useState(false);

  async function makePack() {
    if (!company) return;
    setBusy(true);
    try {
      const { filename, bytes } = await buildMonthEndPack(company, month);
      await saveOrDownloadFile(filename, bytes, 'application/zip');
      setPackOpen(false);
    } finally {
      setBusy(false);
    }
  }

  const card = (icon: any, title: string, description: string, onClick: () => void, locked = false) => {
    const Icon = icon;
    return (
      <Card key={title} className="cursor-pointer hover:border-brand-green transition-colors">
        <div onClick={onClick} className="flex gap-4">
          <div className="w-11 h-11 rounded-lg bg-brand-green/10 flex items-center justify-center shrink-0">
            <Icon size={20} className="text-brand-green" />
          </div>
          <div>
            <h3 className="font-display font-bold text-brand-navy mb-1 flex items-center gap-1.5">
              {title} {locked && <Lock size={13} className="text-gray-400" />}
            </h3>
            <p className="text-sm text-gray-500">{description}</p>
          </div>
        </div>
      </Card>
    );
  };

  return (
    <div>
      <PageHeader title="Reports" subtitle="Everything you need to run the business and stay compliant." />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {REPORTS.map((r) => card(r.icon, r.title, r.description, () => navigate(r.to)))}
        {card(
          Package,
          'Month-end pack for your accountant',
          "One ZIP with the month's invoices, payments, expenses, bills, VAT and the monthly report. Enterprise plan.",
          () => (enterprise ? setPackOpen(true) : navigate('/upgrade')),
          !enterprise
        )}
        {card(
          Layers,
          'All businesses together',
          `Every business in this app side by side, with totals. Enterprise plan${companies.length > 1 ? '' : '; add a business from the top bar first'}.`,
          () => navigate(enterprise ? '/reports/combined' : '/upgrade'),
          !enterprise
        )}
      </div>
      <Modal
        open={packOpen}
        onClose={() => setPackOpen(false)}
        title="Month-end pack"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPackOpen(false)}>Cancel</Button>
            <Button onClick={makePack} disabled={busy}>{busy ? 'Making…' : 'Download ZIP'}</Button>
          </>
        }
      >
        <p className="text-sm text-gray-500 mb-3">Choose the month. Send the ZIP to your accountant by email or WhatsApp.</p>
        <Input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} />
      </Modal>
    </div>
  );
}
