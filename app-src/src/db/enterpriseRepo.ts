// Storage for Enterprise and Accountant Partner features: budgets, change history and staff logins.
import { run, query, queryOne } from './database';
import { uid } from '../core/numbering';

// ---------- Budgets ----------

export function listBudgets(companyId: string): Map<string, number> {
  const rows = query<any>('SELECT category_id, monthly_amount FROM budgets WHERE company_id = :cid', { ':cid': companyId });
  return new Map(rows.map((r) => [r.category_id, r.monthly_amount]));
}

export function setBudget(companyId: string, categoryId: string, amount: number) {
  if (!amount || amount <= 0) {
    run('DELETE FROM budgets WHERE company_id = :cid AND category_id = :cat', { ':cid': companyId, ':cat': categoryId });
    return;
  }
  run('INSERT OR REPLACE INTO budgets (company_id, category_id, monthly_amount) VALUES (:cid, :cat, :amt)', {
    ':cid': companyId,
    ':cat': categoryId,
    ':amt': Math.round(amount * 100) / 100
  });
}

// ---------- Change history ----------

export interface AuditEntry {
  id: string;
  at: string;
  userName: string;
  action: 'created' | 'changed' | 'deleted' | 'payment' | 'imported';
  entity: string;
  entityId?: string;
  summary: string;
}

/** Name of whoever is signed in (set by the login screen). "Owner" when staff logins aren't used. */
let currentUserName = 'Owner';
export function setAuditUser(name: string) {
  currentUserName = name || 'Owner';
}

export function logChange(companyId: string, action: AuditEntry['action'], entity: string, entityId: string | undefined, summary: string) {
  try {
    run('INSERT INTO audit_log (id, company_id, at, user_name, action, entity, entity_id, summary) VALUES (:id,:cid,:at,:u,:a,:e,:eid,:s)', {
      ':id': uid('log_'),
      ':cid': companyId,
      ':at': new Date().toISOString(),
      ':u': currentUserName,
      ':a': action,
      ':e': entity,
      ':eid': entityId ?? null,
      ':s': summary.slice(0, 300)
    });
  } catch {
    // never let the history log stop the real change
  }
}

export function listChanges(companyId: string, limit = 500): AuditEntry[] {
  return query<any>('SELECT * FROM audit_log WHERE company_id = :cid ORDER BY at DESC LIMIT :lim', { ':cid': companyId, ':lim': limit }).map((r) => ({
    id: r.id,
    at: r.at,
    userName: r.user_name,
    action: r.action,
    entity: r.entity,
    entityId: r.entity_id ?? undefined,
    summary: r.summary
  }));
}

// ---------- Staff logins ----------

export type Role = 'owner' | 'staff';

export interface AppUser {
  id: string;
  companyId: string;
  name: string;
  role: Role;
}

async function hashPin(pin: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${pin}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function listUsers(companyId: string): AppUser[] {
  return query<any>('SELECT id, company_id, name, role FROM users WHERE company_id = :cid ORDER BY role ASC, name ASC', { ':cid': companyId }).map((r) => ({
    id: r.id,
    companyId: r.company_id,
    name: r.name,
    role: r.role
  }));
}

export async function addUser(companyId: string, name: string, role: Role, pin: string): Promise<AppUser> {
  const salt = uid('s_');
  const id = uid('usr_');
  run('INSERT INTO users (id, company_id, name, role, pin_hash, pin_salt, created_at) VALUES (:id,:cid,:n,:r,:h,:s,:at)', {
    ':id': id,
    ':cid': companyId,
    ':n': name.trim(),
    ':r': role,
    ':h': await hashPin(pin, salt),
    ':s': salt,
    ':at': new Date().toISOString()
  });
  return { id, companyId, name: name.trim(), role };
}

export async function changeUserPin(userId: string, pin: string) {
  const salt = uid('s_');
  run('UPDATE users SET pin_hash = :h, pin_salt = :s WHERE id = :id', { ':id': userId, ':h': await hashPin(pin, salt), ':s': salt });
}

export function removeUser(userId: string) {
  run('DELETE FROM users WHERE id = :id', { ':id': userId });
}

export async function checkUserPin(userId: string, pin: string): Promise<AppUser | null> {
  const r = queryOne<any>('SELECT * FROM users WHERE id = :id', { ':id': userId });
  if (!r) return null;
  return (await hashPin(pin, r.pin_salt)) === r.pin_hash ? { id: r.id, companyId: r.company_id, name: r.name, role: r.role } : null;
}
