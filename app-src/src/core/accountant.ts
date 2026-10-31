// Accountant details.
//  - Practice: the accountant's own firm (Accountant Partner installs), kept once per install.
//  - A business's accountant: kept with each business, so it travels inside the business's
//    file when the accountant sends it back to the client.

import { getMetaValue, setMeta, getSettings, setSetting } from '../db/repository';

export interface PracticeDetails {
  firm: string;
  name: string;
  email: string;
  phone: string;
  logo?: string; // data URL
}

export function getPractice(): PracticeDetails {
  try {
    return { firm: '', name: '', email: '', phone: '', ...JSON.parse(getMetaValue('practice') || '{}') };
  } catch {
    return { firm: '', name: '', email: '', phone: '' };
  }
}

export function setPractice(p: PracticeDetails) {
  setMeta('practice', JSON.stringify(p));
}

export interface BusinessAccountant {
  firm: string;
  name: string;
  email: string;
  phone: string;
  onInvoices: boolean; // show "Books kept with <firm>" on invoices
}

export function getAccountant(companyId: string): BusinessAccountant {
  const s = getSettings(companyId);
  return {
    firm: s.accountantFirm ?? '',
    name: s.accountantName ?? '',
    email: s.accountantEmail ?? '',
    phone: s.accountantPhone ?? '',
    onInvoices: s.accountantOnInvoices === '1'
  };
}

export function setAccountant(companyId: string, a: BusinessAccountant) {
  setSetting(companyId, 'accountantFirm', a.firm.trim());
  setSetting(companyId, 'accountantName', a.name.trim());
  setSetting(companyId, 'accountantEmail', a.email.trim());
  setSetting(companyId, 'accountantPhone', a.phone.trim());
  setSetting(companyId, 'accountantOnInvoices', a.onInvoices ? '1' : '0');
}

/** A partner's new client file starts with the partner's firm as the accountant. */
export function applyPracticeToClient(companyId: string) {
  const p = getPractice();
  if (!p.firm && !p.name) return;
  setAccountant(companyId, { firm: p.firm, name: p.name, email: p.email, phone: p.phone, onInvoices: true });
}

/** Line printed at the bottom of invoices and reports, or '' if none. */
export function accountantLine(companyId: string): string {
  const a = getAccountant(companyId);
  if (!a.onInvoices || !(a.firm || a.name)) return '';
  return `Books kept with ${a.firm || a.name}${a.phone ? `, ${a.phone}` : ''}${a.email ? `, ${a.email}` : ''}`;
}
