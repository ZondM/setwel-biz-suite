import React, { useMemo } from 'react';
import { Bell, Menu, ChevronDown, Plus, Check, LogOut } from 'lucide-react';
import { useApp, usePermissions } from '../../state/AppContext';
import { listUsers } from '../../db/enterpriseRepo';
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
  const { company, companies, refreshKey, switchCompany, setAddingBusiness, user, setUser } = useApp();
  const { multiBusiness, isPartner, isOwner } = usePermissions();
  const [open, setOpen] = React.useState(false);
  const hasLogins = !!company && listUsers(company.id).length > 0;
  const canSwitch = companies.length > 1 || (multiBusiness && isOwner);

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
      <div className="min-w-0 flex-1 relative">
        {canSwitch ? (
          <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-1.5 max-w-full text-left" aria-haspopup="menu">
            <span className="font-display font-bold text-brand-navy text-base truncate">{company.name}</span>
            <ChevronDown size={16} className="text-gray-400 shrink-0" />
          </button>
        ) : (
          <div className="font-display font-bold text-brand-navy text-base truncate">{company.name}</div>
        )}
        <div className="text-xs text-gray-400 truncate">
          {isPartner ? `Client file · ${companies.length} client${companies.length === 1 ? '' : 's'}` : `Financial year starts ${monthNames[fyMonth - 1]}`}
          {hasLogins && user ? ` · Signed in: ${user.name}` : ''}
        </div>
        {open && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
            <div className="absolute left-0 top-full mt-2 z-40 w-72 max-w-[85vw] bg-white rounded-xl border border-gray-200 shadow-xl py-2" role="menu">
              <div className="px-4 pb-1 text-[11px] uppercase tracking-wide text-gray-400">{isPartner ? 'Your clients' : 'Your businesses'}</div>
              <div className="max-h-72 overflow-y-auto">
                {companies.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      setOpen(false);
                      if (c.id !== company.id) switchCompany(c.id);
                    }}
                    className="w-full flex items-center justify-between gap-2 px-4 py-2 text-sm text-left hover:bg-brand-panel"
                  >
                    <span className="truncate text-brand-navy">{c.name}</span>
                    {c.id === company.id && <Check size={15} className="text-brand-green shrink-0" />}
                  </button>
                ))}
              </div>
              {multiBusiness && isOwner && (
                <button
                  onClick={() => {
                    setOpen(false);
                    setAddingBusiness(true);
                  }}
                  className="w-full flex items-center gap-2 px-4 py-2 mt-1 border-t border-gray-100 text-sm font-semibold text-brand-green hover:bg-brand-panel"
                >
                  <Plus size={15} /> {isPartner ? 'Add a client' : 'Add a business or branch'}
                </button>
              )}
            </div>
          </>
        )}
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
        {hasLogins && user ? (
          <button onClick={() => setUser(null)} title="Sign out" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-brand-navy">
            <span className="w-8 h-8 rounded-full bg-brand-green text-white flex items-center justify-center text-xs font-bold">{user.name.slice(0, 2).toUpperCase()}</span>
            <LogOut size={15} className="hidden sm:block" />
          </button>
        ) : (
          <div className="w-8 h-8 rounded-full bg-brand-green text-white flex items-center justify-center text-xs font-bold">{company.name.slice(0, 2).toUpperCase()}</div>
        )}
      </div>
    </header>
  );
}
