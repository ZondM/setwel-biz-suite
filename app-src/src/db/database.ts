import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import { SCHEMA_SQL } from './schema';
import { getStorageAdapter, isElectron } from './storageAdapter';

let sqlInstance: SqlJsDatabase | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
const storage = getStorageAdapter();

async function loadSqlJs() {
  return initSqlJs({
    // Electron loads from file:// so absolute path hits filesystem root — use relative instead.
    // Web server: absolute /sql-wasm.wasm works fine from any /assets/ sub-path.
    locateFile: (_file: string) => isElectron() ? './sql-wasm.wasm' : '/sql-wasm.wasm'
  });
}

export async function initDatabase(): Promise<SqlJsDatabase> {
  if (sqlInstance) return sqlInstance;
  const SQL = await loadSqlJs();
  const existing = await storage.load();
  sqlInstance = existing ? new SQL.Database(existing) : new SQL.Database();
  sqlInstance.run(SCHEMA_SQL);
  if (!existing) persistNow();
  return sqlInstance;
}

export function getDb(): SqlJsDatabase {
  if (!sqlInstance) throw new Error('Database not initialised yet — call initDatabase() first.');
  return sqlInstance;
}

export function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(persistNow, 400);
}

export function persistNow(): Promise<void> {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  if (!sqlInstance) return Promise.resolve();
  const data = sqlInstance.export();
  return storage.save(data);
}

// Save straight away when the app or tab is closing, so the last change is never lost.
// The desktop shell calls __setwelFlush and waits for it before closing the window.
if (typeof window !== 'undefined') {
  (window as any).__setwelFlush = () => persistNow();
  window.addEventListener('pagehide', () => void persistNow());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void persistNow();
  });
}

export function run(sql: string, params: Record<string, any> = {}) {
  const db = getDb();
  db.run(sql, params);
  scheduleSave();
}

export function query<T = any>(sql: string, params: Record<string, any> = {}): T[] {
  const db = getDb();
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows: T[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject() as T);
  }
  stmt.free();
  return rows;
}

export function queryOne<T = any>(sql: string, params: Record<string, any> = {}): T | null {
  const rows = query<T>(sql, params);
  return rows[0] ?? null;
}

let transactionDepth = 0;

/** Runs fn in one transaction. Nested calls (e.g. recordPayment inside a bigger import) join the outer one. */
export function transaction(fn: () => void) {
  const db = getDb();
  if (transactionDepth > 0) {
    fn();
    return;
  }
  transactionDepth++;
  db.run('BEGIN TRANSACTION;');
  try {
    fn();
    db.run('COMMIT;');
  } catch (err) {
    db.run('ROLLBACK;');
    throw err;
  } finally {
    transactionDepth--;
  }
  scheduleSave();
}

export async function resetDatabaseForDemo() {
  if (sqlInstance) sqlInstance.close();
  sqlInstance = null;
  const SQL = await loadSqlJs();
  sqlInstance = new SQL.Database();
  sqlInstance.run(SCHEMA_SQL);
  persistNow();
}
