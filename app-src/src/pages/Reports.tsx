import React from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, FileBarChart, Clock, Users, CalendarDays } from 'lucide-react';
import { Card, PageHeader } from '../components/common/ui';

const REPORTS = [
  { to: '/reports/monthly', icon: CalendarDays, title: 'Monthly report', description: 'Invoiced, received, expenses, profit and who owes you, for any month. Download, WhatsApp or email it.' },
  { to: '/reports/profit-loss', icon: TrendingUp, title: 'Profit & Loss', description: 'Income, cost of sales and expenses for any period, broken down by customer and category.' },
  { to: '/reports/vat201', icon: FileBarChart, title: 'VAT201', description: 'Output VAT, input VAT and the net amount owing or refundable for a SARS VAT period.' },
  { to: '/reports/aged-debtors', icon: Clock, title: 'Aged Debtors', description: 'Who owes you money, and how overdue it is — current, 30, 60, 90+ days.' },
  { to: '/reports/aged-creditors', icon: Users, title: 'Aged Creditors', description: 'What you owe suppliers, and how overdue it is.' }
];

export default function Reports() {
  const navigate = useNavigate();
  return (
    <div>
      <PageHeader title="Reports" subtitle="Everything you need to run the business and stay compliant." />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {REPORTS.map((r) => (
          <Card key={r.to} className="cursor-pointer hover:border-brand-green transition-colors" >
            <div onClick={() => navigate(r.to)} className="flex gap-4">
              <div className="w-11 h-11 rounded-lg bg-brand-green/10 flex items-center justify-center shrink-0">
                <r.icon size={20} className="text-brand-green" />
              </div>
              <div>
                <h3 className="font-display font-bold text-brand-navy mb-1">{r.title}</h3>
                <p className="text-sm text-gray-500">{r.description}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
