// Two ways to persist the SQLite binary blob that sql.js keeps in memory:
//  - Web:      IndexedDB (works fully offline in any browser, no native APIs needed)
//  - Electron: a real .sqlite file on disk via the preload bridge (window.setwelDesktop)
//
// The rest of the app never knows which one is active.

export interface StorageAdapter {
  load(): Promise<Uint8Array | null>;
  save(data: Uint8Array): Promise<void>;
}

const IDB_NAME = 'setwel-africa-db';
const IDB_STORE = 'sqlite';
const IDB_KEY = 'main';

class IndexedDbStorageAdapter implements StorageAdapter {
  private openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore(IDB_STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async load(): Promise<Uint8Array | null> {
    try {
      const db = await this.openDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(IDB_STORE, 'readonly');
        const req = tx.objectStore(IDB_STORE).get(IDB_KEY);
        req.onsuccess = () => resolve(req.result ?? null);
        req.onerror = () => reject(req.error);
      });
    } catch {
      return null;
    }
  }

  async save(data: Uint8Array): Promise<void> {
    const db = await this.openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(data, IDB_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}

declare global {
  interface Window {
    setwelDesktop?: {
      loadDatabase: () => Promise<Uint8Array | null>;
      saveDatabase: (data: Uint8Array) => Promise<void>;
      saveFile: (suggestedName: string, data: Uint8Array | string, isBase64?: boolean) => Promise<string | null>;
      isElectron: true;
      // Added by the Setwel desktop shell (desktop/preload.js)
      licence?: () => Promise<{
        mode: 'trial' | 'licensed' | 'expired';
        daysLeft?: number;
        deviceId: string;
        licence?: { key?: string; plan?: string; paid_until?: string };
      }>;
      apiPost?: (path: string, body: Record<string, unknown>) => Promise<{ status: number; data: any }>;
      openExternal?: (url: string) => Promise<void>;
    };
  }
}

class ElectronStorageAdapter implements StorageAdapter {
  async load(): Promise<Uint8Array | null> {
    if (!window.setwelDesktop) return null;
    return window.setwelDesktop.loadDatabase();
  }
  async save(data: Uint8Array): Promise<void> {
    if (!window.setwelDesktop) return;
    await window.setwelDesktop.saveDatabase(data);
  }
}

export function isElectron(): boolean {
  return typeof window !== 'undefined' && !!window.setwelDesktop?.isElectron;
}

export function getStorageAdapter(): StorageAdapter {
  return isElectron() ? new ElectronStorageAdapter() : new IndexedDbStorageAdapter();
}

/** Saves a file (PDF/CSV) to disk on desktop, or triggers a browser download on web. */
export async function saveOrDownloadFile(filename: string, data: Uint8Array | string, mimeType: string): Promise<void> {
  if (isElectron() && window.setwelDesktop) {
    const isBase64 = typeof data === 'string';
    await window.setwelDesktop.saveFile(filename, data, isBase64);
    return;
  }
  const blob = typeof data === 'string' ? base64ToBlob(data, mimeType) : new Blob([data.buffer as ArrayBuffer], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const clean = base64.includes(',') ? base64.split(',')[1] : base64;
  const byteChars = atob(clean);
  const byteNumbers = new Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
  return new Blob([new Uint8Array(byteNumbers)], { type: mimeType });
}
