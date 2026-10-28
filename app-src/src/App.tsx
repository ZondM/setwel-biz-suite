import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useApp } from './state/AppContext';
import { Layout } from './components/layout/Layout';
import Onboarding from './pages/Onboarding';
import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import Suppliers from './pages/Suppliers';
import Quotes from './pages/Quotes';
import QuoteEditor from './pages/QuoteEditor';
import Invoices from './pages/Invoices';
import InvoiceEditor from './pages/InvoiceEditor';
import InvoiceView from './pages/InvoiceView';
import Expenses from './pages/Expenses';
import Bills from './pages/Bills';
import BillEditor from './pages/BillEditor';
import Reports from './pages/Reports';
import ProfitLoss from './pages/reports/ProfitLoss';
import Vat201 from './pages/reports/Vat201';
import AgedDebtors from './pages/reports/AgedDebtors';
import AgedCreditors from './pages/reports/AgedCreditors';
import TaxCentre from './pages/TaxCentre';
import SettingsPage from './pages/Settings';
import Upgrade from './pages/Upgrade';
import HelpPage from './pages/Help';
import LockedFeature from './pages/LockedFeature';
import Banking from './pages/Banking';
import Budgets from './pages/enterprise/Budgets';
import CashFlow from './pages/enterprise/CashFlow';
import History from './pages/enterprise/History';
import CombinedReport from './pages/enterprise/CombinedReport';
import Practice from './pages/enterprise/Practice';
import BusinessFiles from './pages/BusinessFiles';
import Setup from './pages/Setup';
import MonthlyReport from './pages/reports/MonthlyReport';
import { tierAtLeast, usePermissions } from './state/AppContext';
import { StaffLogin } from './components/enterprise/StaffLogin';
import { listUsers } from './db/enterpriseRepo';
import {
  PinLockScreen,
  TrialExpiredScreen,
  useTrialStatus,
  usePinGate,
  CopyrightFooter
} from './components/common/SecurityGates';

/** Shows a page only on plans that include it. */
function PlanOnly({ tier, label, feature, children }: { tier: string; label: string; feature: string; children: React.ReactNode }) {
  const { company } = useApp();
  return tierAtLeast(company?.packageTier, tier) ? <>{children}</> : <LockedFeature feature={feature} requiredTier={label} />;
}

/** Pages only the owner may open when staff logins are used. */
function OwnerOnly({ children }: { children: React.ReactNode }) {
  const { isOwner } = usePermissions();
  return isOwner ? (
    <>{children}</>
  ) : (
    <div className="text-center py-16 px-6">
      <h3 className="font-display font-bold text-lg text-brand-navy mb-1">Only the owner can open this</h3>
      <p className="text-sm text-gray-500">Ask the business owner if you need it.</p>
    </div>
  );
}

function ComingSoon({ feature }: { feature: string }) {
  return (
    <div className="text-center py-16 px-6">
      <h3 className="font-display font-bold text-lg text-brand-navy mb-1">{feature} is coming soon</h3>
      <p className="text-sm text-gray-500 max-w-sm mx-auto">We're building it now. It will be included in the Builder plan and up when it's ready.</p>
    </div>
  );
}

function Gate() {
  const { company, user, addingBusiness } = useApp();
  const { isExpired } = useTrialStatus();
  const { unlocked, setUnlocked, pinSet } = usePinGate(company?.id);

  // 1. No company → onboarding; adding another business → the same screens
  if (!company) return <Onboarding />;
  if (addingBusiness) return <Onboarding mode="add" />;

  // 2a. Staff logins: pick your name and enter your PIN
  const hasLogins = listUsers(company.id).length > 0;
  if (hasLogins && !user) return <StaffLogin />;

  // 2b. Simple app PIN (if set, require unlock on first render)
  if (!hasLogins && pinSet && !unlocked) {
    return <PinLockScreen companyId={company.id} onUnlock={() => setUnlocked(true)} />;
  }

  // 3. Trial expired hard gate
  if (isExpired) return <TrialExpiredScreen />;

  // 4. Normal app
  return (
    <div className="flex flex-col min-h-screen">
      <div className="flex-1">
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/suppliers" element={<Suppliers />} />
            <Route path="/quotes" element={<Quotes />} />
            <Route path="/quotes/new" element={<QuoteEditor />} />
            <Route path="/quotes/:id" element={<QuoteEditor />} />
            <Route path="/invoices" element={<Invoices />} />
            <Route path="/invoices/new" element={<InvoiceEditor />} />
            <Route path="/invoices/:id/edit" element={<InvoiceEditor />} />
            <Route path="/invoices/:id" element={<InvoiceView />} />
            <Route path="/expenses" element={<Expenses />} />
            <Route path="/bills" element={<Bills />} />
            <Route path="/bills/new" element={<BillEditor />} />
            <Route path="/bills/:id" element={<BillEditor />} />
            <Route path="/reports" element={<OwnerOnly><Reports /></OwnerOnly>} />
            <Route path="/reports/profit-loss" element={<OwnerOnly><ProfitLoss /></OwnerOnly>} />
            <Route path="/reports/vat201" element={<OwnerOnly><Vat201 /></OwnerOnly>} />
            <Route path="/reports/aged-debtors" element={<OwnerOnly><AgedDebtors /></OwnerOnly>} />
            <Route path="/reports/aged-creditors" element={<OwnerOnly><AgedCreditors /></OwnerOnly>} />
            <Route path="/tax-centre" element={<OwnerOnly><TaxCentre /></OwnerOnly>} />
            <Route path="/settings" element={<OwnerOnly><SettingsPage /></OwnerOnly>} />
            <Route path="/upgrade" element={<OwnerOnly><Upgrade /></OwnerOnly>} />
            <Route path="/help" element={<HelpPage />} />
            <Route path="/inventory" element={<ComingSoon feature="Stock" />} />
            <Route path="/payroll" element={<ComingSoon feature="Payroll" />} />
            <Route path="/banking" element={<OwnerOnly><PlanOnly tier="builder" label="Builder" feature="Bank statement matching"><Banking /></PlanOnly></OwnerOnly>} />
            <Route path="/practice" element={<OwnerOnly><PlanOnly tier="accountant_partner" label="Accountant Partner" feature="Practice dashboard"><Practice /></PlanOnly></OwnerOnly>} />
            <Route path="/setup" element={<OwnerOnly><Setup /></OwnerOnly>} />
            <Route path="/files" element={<OwnerOnly><BusinessFiles /></OwnerOnly>} />
            <Route path="/budgets" element={<OwnerOnly><PlanOnly tier="enterprise" label="Enterprise" feature="Budgets"><Budgets /></PlanOnly></OwnerOnly>} />
            <Route path="/cashflow" element={<OwnerOnly><PlanOnly tier="enterprise" label="Enterprise" feature="Cash-flow forecast"><CashFlow /></PlanOnly></OwnerOnly>} />
            <Route path="/history" element={<OwnerOnly><PlanOnly tier="enterprise" label="Enterprise" feature="Change history"><History /></PlanOnly></OwnerOnly>} />
            <Route path="/reports/combined" element={<OwnerOnly><PlanOnly tier="enterprise" label="Enterprise" feature="Combined report"><CombinedReport /></PlanOnly></OwnerOnly>} />
            <Route path="/reports/monthly" element={<OwnerOnly><MonthlyReport /></OwnerOnly>} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Routes>
      </div>
      <CopyrightFooter />
    </div>
  );
}

export default function App() {
  return (
    <HashRouter>
      <AppProvider>
        <Gate />
      </AppProvider>
    </HashRouter>
  );
}
