import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Company } from '../core/types';
import { getActiveCompany, getMetaValue, listCompanies, setActiveCompany, setTierForAll } from '../db/repository';
import { LicenceInfo, loadLicence } from '../core/licence';
import { runRecurringInvoices } from '../core/automation';
import { AppUser, listUsers, setAuditUser } from '../db/enterpriseRepo';
import { isStaffDevice, syncNow, syncRole } from '../core/sync';

interface AppContextValue {
  company: Company | null;
  companies: Company[];
  licence: LicenceInfo | null;
  reloadLicence: () => void;
  setCompany: (c: Company | null) => void;
  switchCompany: (id: string) => void;
  refreshKey: number;
  bumpRefresh: () => void;
  reloadCompany: () => void;
  // Staff logins: who is signed in to the open business (null = nobody yet)
  user: AppUser | null;
  setUser: (u: AppUser | null) => void;
  // Adding another business / client file (shows the setup screens again)
  addingBusiness: boolean;
  setAddingBusiness: (v: boolean) => void;
  // Online sync: restart after connecting; syncTick changes after every sync (for status displays)
  restartSync: () => void;
  syncTick: number;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

/** When a business has no staff logins, the person using it is the owner. */
const OWNER: AppUser = { id: 'owner', companyId: '', name: 'Owner', role: 'owner' };

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [company, setCompanyState] = useState<Company | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [licence, setLicence] = useState<LicenceInfo | null>(null);
  const [user, setUserState] = useState<AppUser | null>(null);
  const [addingBusiness, setAddingBusiness] = useState(false);
  const [syncKey, setSyncKey] = useState(0);
  const restartSync = useCallback(() => setSyncKey((k) => k + 1), []);

  const reloadCompany = useCallback(() => {
    setCompanyState(getActiveCompany());
    setCompanies(listCompanies());
  }, []);

  const setUser = useCallback((u: AppUser | null) => {
    setUserState(u);
    setAuditUser(u?.name ?? 'Owner');
  }, []);

  const setCompany = useCallback(
    (c: Company | null) => {
      if (c) setActiveCompany(c.id);
      setCompanyState(c);
      setCompanies(listCompanies());
    },
    []
  );

  const switchCompany = useCallback(
    (id: string) => {
      setActiveCompany(id);
      setUser(null); // each business has its own logins
      reloadCompany();
      setRefreshKey((k) => k + 1);
    },
    [reloadCompany, setUser]
  );

  const reloadLicence = useCallback(() => {
    loadLicence()
      .then(setLicence)
      .catch(() => setLicence(null));
  }, []);

  useEffect(() => {
    reloadCompany();
    reloadLicence();
  }, [reloadCompany, reloadLicence]);

  // No staff logins for this business: the owner is signed in automatically.
  const companyId = company?.id;
  useEffect(() => {
    // On a staff laptop the change history records the laptop's name instead
    if (companyId && !user && listUsers(companyId).length === 0) setUser({ ...OWNER, companyId, name: isStaffDevice() ? getMetaValue('syncName') || 'Staff laptop' : OWNER.name });
  }, [companyId, user, setUser]);

  // Automation engine: create repeating invoices that are due, now and every hour while open.
  useEffect(() => {
    if (!companyId || isStaffDevice()) return; // repeating invoices are made on the owner's laptop only
    const tick = () => {
      try {
        setAuditUser('Setwel (automatic)');
        const made = runRecurringInvoices(companyId).length;
        setAuditUser(user?.name ?? 'Owner');
        if (made > 0) setRefreshKey((k) => k + 1);
      } catch (err) {
        console.error('Automation run failed', err);
      }
    };
    tick();
    const timer = setInterval(tick, 60 * 60 * 1000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  // A paid licence decides the plan, for every business in this install.
  // During the trial the customer can try any plan.
  useEffect(() => {
    if (company && licence?.mode === 'licensed' && licence.plan && companies.some((c) => c.packageTier !== licence.plan)) {
      setTierForAll(licence.plan);
      reloadCompany();
    }
  }, [company, companies, licence, reloadCompany]);

  const bumpRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
    reloadCompany();
  }, [reloadCompany]);

  // Online sync (owner and staff laptops): every 30 seconds, when the app comes back into view
  // and when the internet comes back. New records from other laptops refresh the screens.
  const [syncTick, setSyncTick] = useState(0);
  useEffect(() => {
    if (!licence || !syncRole()) return;
    let stopped = false;
    const go = () => {
      if (stopped || !navigator.onLine) return;
      syncNow(licence)
        .then((n) => {
          if (n > 0 && !stopped) bumpRefresh();
        })
        .catch(() => {
          /* shown in Settings, retried on the next tick */
        })
        .finally(() => setSyncTick((t) => t + 1));
    };
    go();
    const timer = setInterval(go, 30 * 1000);
    const onFocus = () => document.visibilityState === 'visible' && go();
    window.addEventListener('online', go);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      stopped = true;
      clearInterval(timer);
      window.removeEventListener('online', go);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [licence, bumpRefresh, syncKey]);

  return (
    <AppContext.Provider
      value={{
        company,
        companies,
        licence,
        reloadLicence,
        setCompany,
        switchCompany,
        refreshKey,
        bumpRefresh,
        reloadCompany,
        user,
        setUser,
        addingBusiness,
        setAddingBusiness,
        restartSync,
        syncTick
      }}
    >
      {children}
    </AppContext.Provider>
  );
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

/** What the signed-in person may do. Staff can sell and capture, but not delete or see the books. */
export function usePermissions() {
  const { user, company } = useApp();
  // A staff laptop (online sync) only does quotes, invoices and customers for one business
  const staffDevice = isStaffDevice();
  const isOwner = (!user || user.role === 'owner') && !staffDevice;
  const tier = company?.packageTier;
  return {
    isOwner,
    staffDevice,
    canDelete: isOwner,
    canSeeFinancials: isOwner,
    canManageSettings: isOwner,
    multiBusiness: tierAtLeast(tier, 'enterprise') && !staffDevice,
    isPartner: tier === 'accountant_partner'
  };
}
