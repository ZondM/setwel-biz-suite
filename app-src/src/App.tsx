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
import MonthlyReport from './pages/reports/MonthlyReport';
import { tierAtLeast } from './state/AppContext';
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

function ComingSoon({ feature }: { feature: string }) {
  return (
    <div className="text-center py-16 px-6">
      <h3 className="font-display font-bold text-lg text-brand-navy mb-1">{feature} is coming soon</h3>
      <p className="text-sm text-gray-500 max-w-sm mx-auto">We're building it now. It will be included in the Builder plan and up when it's ready.</p>
    </div>
  );
}

function Gate() {
  const { company } = useApp();
  const { isExpired } = useTrialStatus();
  const { unlocked, setUnlocked, pinSet } = usePinGate(company?.id);

  // 1. No company → onboarding
  if (!company) return <Onboarding />;

  // 2. PIN lock (if set, require unlock on first render)
  if (pinSet && !unlocked) {
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
            <Route path="/reports" element={<Reports />} />
            <Route path="/reports/profit-loss" element={<ProfitLoss />} />
            <Route path="/reports/vat201" element={<Vat201 />} />
            <Route path="/reports/aged-debtors" element={<AgedDebtors />} />
            <Route path="/reports/aged-creditors" element={<AgedCreditors />} />
            <Route path="/tax-centre" element={<TaxCentre />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/upgrade" element={<Upgrade />} />
            <Route path="/help" element={<HelpPage />} />
            <Route path="/inventory" element={<ComingSoon feature="Stock" />} />
            <Route path="/payroll" element={<ComingSoon feature="Payroll" />} />
            <Route path="/banking" element={<PlanOnly tier="builder" label="Builder" feature="Bank statement matching"><Banking /></PlanOnly>} />
            <Route path="/reports/monthly" element={<MonthlyReport />} />
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
