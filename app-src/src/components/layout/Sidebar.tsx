import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Factory,
  FileText,
  Receipt,
  Wallet,
  Package,
  Banknote,
  Landmark,
  BarChart3,
  Calculator,
  Settings as SettingsIcon,
  HelpCircle,
  ArrowUpCircle,
  Lock,
  ChevronLeft,
  ChevronRight,
  FileStack
} from 'lucide-react';
import { useApp, tierAtLeast } from '../../state/AppContext';

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
  requiredTier?: string;
}

export function Sidebar({ mobileOpen = false, onClose }: { mobileOpen?: boolean; onClose?: () => void }) {
  const { company } = useApp();
  const [desktopCollapsed, setCollapsed] = useState(false);
  const collapsed = desktopCollapsed && !mobileOpen;
  const tier = company?.packageTier;

  const items: NavItem[] = [
    { to: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
    { to: '/customers', label: 'Customers', icon: <Users size={18} /> },
    { to: '/suppliers', label: 'Suppliers', icon: <Factory size={18} />, requiredTier: 'grinder' },
    { to: '/quotes', label: 'Quotes', icon: <FileStack size={18} /> },
    { to: '/invoices', label: 'Invoices', icon: <FileText size={18} /> },
    { to: '/bills', label: 'Bills', icon: <Receipt size={18} />, requiredTier: 'grinder' },
    { to: '/expenses', label: 'Expenses', icon: <Wallet size={18} /> },
    { to: '/banking', label: 'Bank matching', icon: <Landmark size={18} />, requiredTier: 'builder' },
    { to: '/inventory', label: 'Stock (soon)', icon: <Package size={18} /> },
    { to: '/payroll', label: 'Payroll (soon)', icon: <Banknote size={18} /> }
  ];

  const reportItems: NavItem[] = [
    { to: '/reports', label: 'Reports', icon: <BarChart3 size={18} /> },
    { to: '/tax-centre', label: 'Tax centre', icon: <Calculator size={18} /> }
  ];

  const bottomItems: NavItem[] = [
    { to: '/settings', label: 'Settings', icon: <SettingsIcon size={18} /> },
    { to: '/help', label: 'Help & Support', icon: <HelpCircle size={18} /> },
    { to: '/upgrade', label: 'Upgrade Plan', icon: <ArrowUpCircle size={18} /> }
  ];

  const renderItem = (item: NavItem) => {
    const locked = item.requiredTier ? !tierAtLeast(tier, item.requiredTier) : false;
    if (locked) {
      return (
        <NavLink
          key={item.to}
          to="/upgrade"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors text-sm"
          title={`Upgrade to ${item.requiredTier} to unlock ${item.label}`}
        >
          {item.icon}
          {!collapsed && <span className="flex-1">{item.label}</span>}
          {!collapsed && <Lock size={13} />}
        </NavLink>
      );
    }
    return (
      <NavLink
        key={item.to}
        to={item.to}
        className={({ isActive }) =>
          `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
            isActive ? 'bg-brand-green text-white font-semibold' : 'text-white/70 hover:text-white hover:bg-white/5'
          }`
        }
      >
        {item.icon}
        {!collapsed && <span>{item.label}</span>}
      </NavLink>
    );
  };

  return (
    <>
    {mobileOpen && <div className="fixed inset-0 bg-black/40 z-30 md:hidden no-print" onClick={onClose} />}
    <aside
      className={`bg-brand-navy h-screen flex flex-col shrink-0 transition-all no-print
        fixed inset-y-0 left-0 z-40 w-64 md:static md:z-auto ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0
        ${collapsed ? 'md:w-[68px]' : 'md:w-64'}`}
    >
      <div className="flex items-center gap-2 px-4 py-5">
        <img src="./setwel-logo.png" alt="" className="w-8 h-8 rounded-lg shrink-0 bg-white object-contain" />
        {!collapsed && (
          <div className="leading-tight">
            <div className="font-display font-bold text-white text-sm">Setwel</div>
            <div className="text-[10px] text-brand-gold">Biz Suite</div>
          </div>
        )}
      </div>

      <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
        {items.map(renderItem)}
        <div className="h-px bg-white/10 my-2" />
        {reportItems.map(renderItem)}
      </nav>

      <div className="px-3 pb-3 space-y-1 border-t border-white/10 pt-3">
        {bottomItems.map(renderItem)}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="w-full hidden md:flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-white/40 hover:text-white hover:bg-white/5 text-xs"
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>
    </aside>
    </>
  );
}
