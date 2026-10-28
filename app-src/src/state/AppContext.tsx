import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Company } from '../core/types';
import { getActiveCompany, updateCompany } from '../db/repository';
import { LicenceInfo, loadLicence } from '../core/licence';
import { runRecurringInvoices } from '../core/automation';

interface AppContextValue {
  company: Company | null;
  licence: LicenceInfo | null;
  reloadLicence: () => void;
  setCompany: (c: Company | null) => void;
  refreshKey: number;
  bumpRefresh: () => void;
  reloadCompany: () => void;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [company, setCompany] = useState<Company | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [licence, setLicence] = useState<LicenceInfo | null>(null);

  const reloadCompany = useCallback(() => {
    setCompany(getActiveCompany());
  }, []);

  const reloadLicence = useCallback(() => {
    loadLicence()
      .then(setLicence)
      .catch(() => setLicence(null));
  }, []);

  useEffect(() => {
    reloadCompany();
    reloadLicence();
  }, [reloadCompany, reloadLicence]);

  // Automation engine: create repeating invoices that are due, now and every hour while open.
  const companyId = company?.id;
  useEffect(() => {
    if (!companyId) return;
    const tick = () => {
      try {
        if (runRecurringInvoices(companyId).length > 0) setRefreshKey((k) => k + 1);
      } catch (err) {
        console.error('Automation run failed', err);
      }
    };
    tick();
    const timer = setInterval(tick, 60 * 60 * 1000);
    return () => clearInterval(timer);
  }, [companyId]);

  // A paid licence decides the plan. During the trial the customer can try any plan.
  useEffect(() => {
    if (company && licence?.mode === 'licensed' && licence.plan && company.packageTier !== licence.plan) {
      updateCompany(company.id, { packageTier: licence.plan });
      reloadCompany();
    }
  }, [company, licence, reloadCompany]);

  const bumpRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
    reloadCompany();
  }, [reloadCompany]);

  return <AppContext.Provider value={{ company, licence, reloadLicence, setCompany, refreshKey, bumpRefresh, reloadCompany }}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

/** Tier ordering used for feature-gating checks across the app. */
const TIER_ORDER = ['hustler', 'grinder', 'builder', 'enterprise', 'accountant_partner'];

export function tierAtLeast(current: string | undefined, required: string): boolean {
  if (!current) return false;
  const ci = TIER_ORDER.indexOf(current);
  const ri = TIER_ORDER.indexOf(required);
  if (current === 'accountant_partner') return true;
  return ci >= ri;
}
