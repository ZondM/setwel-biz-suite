// Which plan the customer has actually paid for.
//
// The 30-day trial and the licence key are handled outside the React app:
//  - Desktop: the Electron shell (desktop/licence.js), exposed through window.setwelDesktop.licence()
//  - Phone/browser: website/assets/app-gate.js, which keeps the licence in localStorage
// This file reads whichever one is present so the rest of the app can ask one question:
// "what plan is this, and is it a trial?"

import { PackageTier } from './types';

export type LicenceMode = 'trial' | 'licensed' | 'expired';

export interface LicenceInfo {
  mode: LicenceMode;
  plan?: PackageTier; // set when licensed
  key?: string;
  paidUntil?: string;
  daysLeft?: number; // trial days left
  deviceId: string; // anonymous id, used for trial limits on AI scans and emails
}

const PLANS: PackageTier[] = ['hustler', 'grinder', 'builder', 'enterprise', 'accountant_partner'];
const DAY = 86_400_000;

function storageGet(k: string): string | null {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}

function storageSet(k: string, v: string) {
  try {
    localStorage.setItem(k, v);
  } catch {
    // storage blocked: the id just won't persist
  }
}

function webDeviceId(): string {
  let id = storageGet('setwel_device');
  if (!id) {
    id = 'dev_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    storageSet('setwel_device', id);
  }
  return id;
}

function asPlan(p: unknown): PackageTier | undefined {
  return PLANS.includes(p as PackageTier) ? (p as PackageTier) : undefined;
}

export async function loadLicence(): Promise<LicenceInfo> {
  const desktop = window.setwelDesktop;
  if (desktop?.licence) {
    const s = await desktop.licence();
    return {
      mode: s.mode,
      plan: asPlan(s.licence?.plan),
      key: s.licence?.key,
      paidUntil: s.licence?.paid_until,
      daysLeft: s.daysLeft,
      deviceId: s.deviceId
    };
  }

  // Browser / phone version (see app-gate.js)
  const deviceId = webDeviceId();
  let stored: { key?: string; plan?: string; paid_until?: string } | null = null;
  try {
    stored = JSON.parse(storageGet('setwel_licence') || 'null');
  } catch {
    stored = null;
  }
  if (stored?.paid_until && Date.now() <= Date.parse(stored.paid_until) + 7 * DAY) {
    return { mode: 'licensed', plan: asPlan(stored.plan), key: stored.key, paidUntil: stored.paid_until, deviceId };
  }
  const firstRun = Number(storageGet('setwel_first_run')) || Date.now();
  const daysLeft = Math.max(0, 30 - Math.floor((Date.now() - firstRun) / DAY));
  return { mode: daysLeft > 0 ? 'trial' : 'expired', daysLeft, deviceId };
}

/** Where customers buy or renew. Opens in the system browser on desktop. */
export const PRICING_URL = 'https://setwelbusiness.co.za/pricing.html';

export function buyUrl(plan: PackageTier): string {
  return `https://setwelbusiness.co.za/pay.html?plan=${plan}&billing=monthly`;
}

/** Opens a website link: in the system browser on desktop, in a new tab otherwise. */
export function openExternal(url: string) {
  if (window.setwelDesktop?.openExternal) void window.setwelDesktop.openExternal(url);
  else window.open(url, '_blank', 'noopener');
}
