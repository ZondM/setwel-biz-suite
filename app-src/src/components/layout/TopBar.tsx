import React, { useMemo } from 'react';
import { Bell, Menu } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import { listInvoices } from '../../db/repository';
import { todayIso } from '../../core/numbering';

const TIER_LABELS: Record<string, string> = {
  hustler: 'HUSTLER',
  grinder: 'GRINDER',
  builder: 'BUILDER',
  enterprise: 'ENTERPRISE',
  accountant_partner: 'ACCOUNTANT PARTNER'
};

export function TopBar({ onMenu }: { onMenu?: () => void }) {
  const { company, refreshKey } = useApp();

  const overdueCount = useMemo(() => {
    if (!company) return 0;
    const today = todayIso();
    return listInvoices(company.id).filter((i) => i.status !== 'paid' && i.status !== 'draft' && i.dueDate < today && i.total - i.amountPaid > 0).length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company, refreshKey]);

  if (!company) return null;

  const fyMonth = company.financialYearStartMonth;
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between gap-3 px-4 md:px-6 shrink-0 no-print">
      <button onClick={onMenu} className="md:hidden text-brand-navy -ml-1 p-1" aria-label="Open menu">
        <Menu size={22} />
      </button>
      <div className="min-w-0 flex-1">
        <div className="font-display font-bold text-brand-navy text-base truncate">{company.name}</div>
        <div className="text-xs text-gray-400">Financial year starts {monthNames[fyMonth - 1]}</div>
      </div>
      <div className="flex items-center gap-3 md:gap-4">
        <span className="hidden sm:inline px-2.5 py-1 rounded-md bg-brand-navy text-brand-gold text-xs font-bold tracking-wide">{TIER_LABELS[company.packageTier]}</span>
        <div className="relative">
          <Bell size={19} className="text-gray-500" />
          {overdueCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 bg-status-overdue text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
              {overdueCount}
            </span>
          )}
        </div>
        <div className="w-8 h-8 rounded-full bg-brand-green text-white flex items-center justify-center text-xs font-bold">
          {company.name.slice(0, 2).toUpperCase()}
        </div>
      </div>
    </header>
  );
}
