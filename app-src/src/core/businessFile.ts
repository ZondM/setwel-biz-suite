// A business file (.setwel): one business's complete books in a single file.
// Used to send books to an accountant and back, and as a backup.
// Importing a file for a business that is already in this app replaces that business's
// records with the file's; any other business is left alone.

import { query, run, transaction } from '../db/database';
import { COMPANY_TABLES, getCompany, listCompanies, setActiveCompany } from '../db/repository';
import { logChange } from '../db/enterpriseRepo';

export const FILE_FORMAT = 'setwel-business-file';
export const FILE_VERSION = 1;

// Settings that belong to one install, not to the business (they don't travel in the file).
const LOCAL_SETTINGS = new Set(['appPin', 'cashBalance', 'cashBalanceDate']);

export interface BusinessFile {
  format: typeof FILE_FORMAT;
  version: number;
  exportedAt: string;
  exportedBy: string; // e.g. "Thabo's Electrical Services" or the accountant's firm
  company: Record<string, unknown>;
  tables: Record<string, Record<string, unknown>[]>;
  withPhotos: boolean;
}

export function exportBusiness(companyId: string, opts: { withPhotos: boolean; exportedBy: string }): BusinessFile {
  const company = query<any>('SELECT * FROM companies WHERE id = :id', { ':id': companyId })[0];
  if (!company) throw new Error('Business not found');
  const tables: BusinessFile['tables'] = {};
  for (const t of COMPANY_TABLES) {
    if (t === 'users') continue; // staff PINs stay on the device they were made on
    let rows = query<any>(`SELECT * FROM ${t} WHERE company_id = :id`, { ':id': companyId });
    if (t === 'settings') rows = rows.filter((r) => !LOCAL_SETTINGS.has(r.key));
    if (t === 'expenses' && !opts.withPhotos) rows = rows.map((r) => ({ ...r, receipt_photo: null }));
    tables[t] = rows;
  }
  return {
    format: FILE_FORMAT,
    version: FILE_VERSION,
    exportedAt: new Date().toISOString(),
    exportedBy: opts.exportedBy,
    company,
    tables,
    withPhotos: opts.withPhotos
  };
}

export function businessFileBytes(file: BusinessFile): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(file));
}

export function fileName(file: BusinessFile): string {
  const name = String(file.company.name ?? 'business').replace(/[\\/:*?"<>|]/g, '').slice(0, 60);
  return `${name} ${file.exportedAt.slice(0, 10)}.setwel`;
}

export function parseBusinessFile(text: string): BusinessFile {
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("That isn't a Setwel business file.");
  }
  if (data?.format !== FILE_FORMAT || typeof data.company?.id !== 'string' || typeof data.tables !== 'object') {
    throw new Error("That isn't a Setwel business file.");
  }
  if (data.version > FILE_VERSION) throw new Error('This file was made with a newer Setwel. Please update Setwel first.');
  return data as BusinessFile;
}

export interface ImportPreview {
  name: string;
  exportedAt: string;
  exportedBy: string;
  existing: boolean; // this business is already in the app
  counts: { invoices: number; expenses: number; customers: number };
}

export function previewImport(file: BusinessFile): ImportPreview {
  return {
    name: String(file.company.name ?? ''),
    exportedAt: file.exportedAt,
    exportedBy: file.exportedBy,
    existing: !!getCompany(String(file.company.id)),
    counts: {
      invoices: file.tables.invoices?.length ?? 0,
      expenses: file.tables.expenses?.length ?? 0,
      customers: file.tables.customers?.length ?? 0
    }
  };
}

/** Only real column names are written, so a tampered file can't inject SQL through keys. */
function columnsOf(table: string): Set<string> {
  return new Set(query<any>(`PRAGMA table_info(${table})`).map((c) => c.name));
}

function insertRow(table: string, row: Record<string, unknown>, allowed: Set<string>) {
  const keys = Object.keys(row).filter((k) => allowed.has(k));
  if (!keys.length) return;
  const params: Record<string, unknown> = {};
  keys.forEach((k, i) => (params[`:p${i}`] = row[k] ?? null));
  run(`INSERT OR REPLACE INTO ${table} (${keys.join(', ')}) VALUES (${keys.map((_, i) => `:p${i}`).join(', ')})`, params as any);
}

export function importBusiness(file: BusinessFile, opts: { keepPhotos: boolean }) {
  const id = String(file.company.id);
  const tier = (listCompanies()[0]?.packageTier as string) ?? String(file.company.package_tier);
  transaction(() => {
    // Keep receipt photos already on this device if the file came without them.
    const photos = new Map<string, string>();
    if (!file.withPhotos && opts.keepPhotos) {
      for (const r of query<any>('SELECT id, receipt_photo FROM expenses WHERE company_id = :id AND receipt_photo IS NOT NULL', { ':id': id })) photos.set(r.id, r.receipt_photo);
    }
    // Keep this device's own settings (PIN, bank balance).
    const local = query<any>('SELECT key, value FROM settings WHERE company_id = :id', { ':id': id }).filter((r) => LOCAL_SETTINGS.has(r.key));

    for (const t of COMPANY_TABLES) {
      if (t === 'users') continue;
      run(`DELETE FROM ${t} WHERE company_id = :id`, { ':id': id });
    }
    run('DELETE FROM companies WHERE id = :id', { ':id': id });

    // The plan comes from this install's licence, not from the file.
    insertRow('companies', { ...file.company, package_tier: tier }, columnsOf('companies'));
    for (const t of COMPANY_TABLES) {
      if (t === 'users') continue;
      const rows = file.tables[t] ?? [];
      if (!rows.length) continue;
      const allowed = columnsOf(t);
      for (const row of rows) {
        const fixed: Record<string, any> = { ...row, company_id: id };
        if (t === 'expenses' && !fixed.receipt_photo && photos.has(String(fixed.id))) fixed.receipt_photo = photos.get(String(fixed.id));
        insertRow(t, fixed, allowed);
      }
    }
    for (const l of local) run('INSERT OR REPLACE INTO settings (company_id, key, value) VALUES (:id, :k, :v)', { ':id': id, ':k': l.key, ':v': l.value });
  });
  logChange(id, 'imported', 'business', id, `Books imported from file sent by ${file.exportedBy} on ${file.exportedAt.slice(0, 10)}`);
  setActiveCompany(id);
  return id;
}
