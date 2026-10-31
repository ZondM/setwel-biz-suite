// Online sync between the owner's laptop (all businesses) and staff laptops (one business,
// quotes, invoices and customers only), through setwelbusiness.co.za/api/sync.php.
//
// Each laptop keeps working offline. When online it sends rows that changed since the last
// sync (found by comparing each row with what was last sent or received, in sync_state) and
// receives rows other laptops changed. If two laptops change the same row, the later sync wins.

import { query, queryOne, run, transaction, persistNow } from '../db/database';
import { getMetaValue, setMeta, setActiveCompany } from '../db/repository';
import { apiPost, ApiError } from './api';
import { LicenceInfo } from './licence';

export type SyncRole = 'owner' | 'staff';

// Kept in step with website/api/sync.php
const OWNER_TABLES = ['companies', 'customers', 'suppliers', 'expense_categories', 'quotes', 'invoices', 'payments',
  'expenses', 'bills', 'settings', 'recurring_invoices', 'reminders', 'bank_lines', 'bank_rules', 'budgets', 'audit_log'];
const STAFF_PUSH = ['customers', 'quotes', 'invoices', 'audit_log'];
const STAFF_PULL = ['companies', 'settings', 'customers', 'quotes', 'invoices'];
const BATCH_BYTES = 4 * 1024 * 1024;
const BATCH_ROWS = 500;

interface Change { t: string; id: string; c: string; d: Record<string, unknown> | null }

export function syncRole(): SyncRole | null {
  const r = getMetaValue('syncRole');
  return r === 'owner' || r === 'staff' ? r : null;
}
export const isStaffDevice = () => syncRole() === 'staff';
export const staffCompanyId = () => getMetaValue('syncCompanyId');
/** Staff laptops number their documents with their own code (INV-FD-00001), so laptops never clash. */
export const devicePrefix = () => (isStaffDevice() ? getMetaValue('syncPrefix') : null);
export const syncToken = () => getMetaValue('syncToken');

export interface SyncStatus { role: SyncRole | null; lastSync: string | null; error: string | null; revoked: boolean; deviceName: string | null }
export function syncStatus(): SyncStatus {
  return {
    role: syncRole(),
    lastSync: getMetaValue('syncLastAt'),
    error: getMetaValue('syncLastError') || null,
    revoked: getMetaValue('syncRevoked') === '1',
    deviceName: getMetaValue('syncName')
  };
}

function hashText(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16) + ':' + s.length;
}
const rowHash = (row: unknown) => hashText(JSON.stringify(row));
const rowKey = (t: string, row: any) => (t === 'settings' ? `${row.company_id}|${row.key}` : String(row.id));
const companyOf = (t: string, row: any) => String(t === 'companies' ? row.id : row.company_id);

const columnCache = new Map<string, Set<string>>();
function columns(t: string): Set<string> {
  if (!columnCache.has(t)) columnCache.set(t, new Set(query<any>(`PRAGMA table_info(${t})`).map((c) => c.name)));
  return columnCache.get(t)!;
}

function localRows(t: string): any[] {
  if (isStaffDevice()) {
    const cid = { ':c': staffCompanyId() };
    return t === 'companies' ? query(`SELECT * FROM companies WHERE id = :c`, cid) : query(`SELECT * FROM ${t} WHERE company_id = :c`, cid);
  }
  return query(`SELECT * FROM ${t}`);
}

function readRow(t: string, id: string): any | null {
  if (t === 'settings') {
    const [cid, ...rest] = id.split('|');
    return queryOne('SELECT * FROM settings WHERE company_id = :c AND key = :k', { ':c': cid, ':k': rest.join('|') });
  }
  return queryOne(`SELECT * FROM ${t} WHERE id = :id`, { ':id': id });
}

function remember(t: string, id: string, c: string, hash: string | null) {
  if (hash === null) run('DELETE FROM sync_state WHERE tbl = :t AND row_id = :id', { ':t': t, ':id': id });
  else run('INSERT OR REPLACE INTO sync_state (tbl, row_id, company_id, hash) VALUES (:t, :id, :c, :h)', { ':t': t, ':id': id, ':c': c, ':h': hash });
}

/** Rows added, changed or deleted on this laptop since they were last sent or received. */
function localChanges(): { change: Change; hash: string | null }[] {
  const staff = isStaffDevice();
  const tables = staff ? STAFF_PUSH : OWNER_TABLES;
  const known = new Map<string, { hash: string; c: string }>();
  for (const r of query<any>('SELECT tbl, row_id, company_id, hash FROM sync_state')) known.set(`${r.tbl}\u0000${r.row_id}`, { hash: r.hash, c: r.company_id });
  const out: { change: Change; hash: string | null }[] = [];
  for (const t of tables) {
    const seen = new Set<string>();
    for (const row of localRows(t)) {
      const id = rowKey(t, row);
      seen.add(id);
      const h = rowHash(row);
      if (known.get(`${t}\u0000${id}`)?.hash !== h) out.push({ change: { t, id, c: companyOf(t, row), d: row }, hash: h });
    }
    if (staff) continue; // staff laptops never delete
    for (const [k, v] of known) {
      const [kt, id] = k.split('\u0000');
      if (kt === t && !seen.has(id)) out.push({ change: { t, id, c: v.c, d: null }, hash: null });
    }
  }
  return out;
}

function applyChange(ch: Change) {
  const allowed = isStaffDevice() ? STAFF_PULL : OWNER_TABLES;
  if (!allowed.includes(ch.t)) return;
  if (ch.d === null) {
    if (ch.t === 'settings') {
      const [cid, ...rest] = ch.id.split('|');
      run('DELETE FROM settings WHERE company_id = :c AND key = :k', { ':c': cid, ':k': rest.join('|') });
    } else {
      run(`DELETE FROM ${ch.t} WHERE id = :id`, { ':id': ch.id });
    }
    remember(ch.t, ch.id, ch.c, null);
    return;
  }
  const cols = columns(ch.t);
  const keys = Object.keys(ch.d).filter((k) => cols.has(k));
  if (!keys.length) return;
  const params: Record<string, unknown> = {};
  keys.forEach((k, i) => (params[`:v${i}`] = ch.d![k]));
  run(`INSERT OR REPLACE INTO ${ch.t} (${keys.join(', ')}) VALUES (${keys.map((_, i) => `:v${i}`).join(', ')})`, params);
  const saved = readRow(ch.t, ch.id);
  if (saved) remember(ch.t, ch.id, ch.c, rowHash(saved));
}

/** Keeps a staff laptop unlocked for as long as the owner's subscription is paid up. */
async function storeTeamLicence(licence: { plan: string; paid_until: string; token: string } | undefined) {
  if (!licence || !isStaffDevice()) return;
  const desktop = (window as any).setwelDesktop;
  if (desktop?.setTeamToken) await desktop.setTeamToken(licence.token);
  else {
    try {
      localStorage.setItem('setwel_licence', JSON.stringify({ key: 'TEAM', team: true, plan: licence.plan, paid_until: licence.paid_until, checked: Date.now() }));
    } catch {
      /* storage blocked */
    }
  }
}

function syncApi<T = any>(body: Record<string, unknown>, licence: LicenceInfo) {
  return apiPost<T>('sync.php', { ...body, token: syncToken() ?? '' }, licence);
}

let running: Promise<number> | null = null;

/** Sends this laptop's changes, then fetches everyone else's. Returns how many rows came in. */
export function syncNow(licence: LicenceInfo): Promise<number> {
  if (!syncRole() || getMetaValue('syncRevoked') === '1') return Promise.resolve(0);
  if (!running) running = doSync(licence).finally(() => (running = null));
  return running;
}

async function doSync(licence: LicenceInfo): Promise<number> {
  try {
    // 1. Send
    const changes = localChanges();
    for (let i = 0; i < changes.length; ) {
      const batch: typeof changes = [];
      let bytes = 0;
      while (i < changes.length && batch.length < BATCH_ROWS && (batch.length === 0 || bytes < BATCH_BYTES)) {
        bytes += JSON.stringify(changes[i].change.d ?? '').length;
        batch.push(changes[i++]);
      }
      await syncApi({ action: 'push', changes: batch.map((b) => b.change) }, licence);
      transaction(() => batch.forEach((b) => remember(b.change.t, b.change.id, b.change.c, b.hash)));
    }
    // 2. Receive
    let received = 0;
    for (let page = 0; page < 50; page++) {
      const since = Number(getMetaValue('syncCursor') || 0);
      const res = await syncApi<{ changes: Change[]; cursor: number; more: boolean; licence: any }>({ action: 'pull', since }, licence);
      transaction(() => {
        // Companies first, so a business exists before its records
        [...res.changes].sort((a, b) => Number(b.t === 'companies') - Number(a.t === 'companies')).forEach((ch) => {
          try {
            applyChange(ch);
          } catch (err) {
            // One broken record must never stop the rest from syncing
            console.error('Sync: skipped a record', ch.t, ch.id, err);
          }
        });
        setMeta('syncCursor', String(res.cursor));
      });
      received += res.changes.length;
      if (page === 0) await storeTeamLicence(res.licence);
      if (!res.more) break;
    }
    setMeta('syncLastAt', new Date().toISOString());
    setMeta('syncLastError', '');
    await persistNow();
    return received;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401 && err.code === 'revoked') setMeta('syncRevoked', '1');
    setMeta('syncLastError', err instanceof Error ? err.message : 'Sync failed.');
    throw err;
  }
}

/** Owner laptop: connect to online sync with the paid licence key, then upload everything. */
export async function setupOwner(licence: LicenceInfo, name: string) {
  const res = await apiPost<any>('sync.php', { action: 'setup', name }, licence);
  transaction(() => {
    run('DELETE FROM sync_state');
    setMeta('syncRole', 'owner');
    setMeta('syncToken', res.token);
    setMeta('syncDeviceId', res.deviceId);
    setMeta('syncTeam', res.team);
    setMeta('syncName', name);
    setMeta('syncCursor', '0');
    setMeta('syncRevoked', '0');
  });
  await syncNow(licence);
}

/** Staff laptop: join with the code from the owner, then download that business. */
export async function joinTeam(licence: LicenceInfo, code: string) {
  const res = await apiPost<any>('sync.php', { action: 'join', code }, licence);
  transaction(() => {
    run('DELETE FROM sync_state');
    setMeta('syncRole', 'staff');
    setMeta('syncToken', res.token);
    setMeta('syncDeviceId', res.deviceId);
    setMeta('syncTeam', res.team);
    setMeta('syncCompanyId', res.companyId);
    setMeta('syncPrefix', res.prefix);
    setMeta('syncName', res.name);
    setMeta('syncCursor', '0');
    setMeta('syncRevoked', '0');
  });
  await storeTeamLicence(res.licence);
  await syncNow(licence);
  if (!queryOne('SELECT id FROM companies WHERE id = :c', { ':c': res.companyId })) {
    throw new Error('Connected, but the business has not been uploaded yet. Ask the owner to open Setwel on their laptop with internet, then press Sync now.');
  }
  setActiveCompany(res.companyId);
  return res as { companyId: string; name: string; prefix: string };
}

export interface TeamDevice { id: string; role: SyncRole; company_id: string; name: string; prefix: string; created: string; last_seen: string }
export const listDevices = (licence: LicenceInfo) => syncApi<{ devices: TeamDevice[]; me: string }>({ action: 'devices' }, licence);
export const revokeDevice = (licence: LicenceInfo, deviceId: string) => syncApi({ action: 'revoke', deviceId }, licence);
export const createLinkCode = (licence: LicenceInfo, companyId: string, name: string, prefix: string) =>
  syncApi<{ code: string; expiresHours: number }>({ action: 'link', companyId, name, prefix }, licence);

/** Owner laptop: stop syncing on this laptop (the data stays on it and on the server). */
export function disconnect() {
  transaction(() => {
    for (const k of ['syncRole', 'syncToken', 'syncDeviceId', 'syncTeam', 'syncCompanyId', 'syncPrefix', 'syncName', 'syncCursor', 'syncLastAt', 'syncLastError', 'syncRevoked']) {
      run('DELETE FROM app_meta WHERE key = :k', { ':k': k });
    }
    run('DELETE FROM sync_state');
  });
}
