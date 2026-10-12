// SQLite database (built into Node 22). One file: data/shop.db
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');
const config = require('./config');

fs.mkdirSync(config.dataDir, { recursive: true });
fs.mkdirSync(config.uploadDir, { recursive: true });

const db = new DatabaseSync(config.dbFile);
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

db.exec(`
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY, slug TEXT UNIQUE NOT NULL, name TEXT NOT NULL, description TEXT DEFAULT '',
  seo_title TEXT DEFAULT '', seo_description TEXT DEFAULT '', sort INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY, slug TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  brand TEXT DEFAULT '', material TEXT DEFAULT '', sterile INTEGER, pack_qty INTEGER DEFAULT 1,
  unit_label TEXT DEFAULT 'item', description TEXT DEFAULT '', specs TEXT DEFAULT '',
  bulk_tiers TEXT DEFAULT '', datasheet TEXT DEFAULT '', bestseller INTEGER DEFAULT 0, published INTEGER DEFAULT 1,
  seo_title TEXT DEFAULT '', seo_description TEXT DEFAULT '', created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS product_images (
  id INTEGER PRIMARY KEY, product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  filename TEXT NOT NULL, alt TEXT DEFAULT '', sort INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS variants (
  id INTEGER PRIMARY KEY, product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  label TEXT NOT NULL DEFAULT 'Standard', sku TEXT DEFAULT '', price_cents INTEGER, stock INTEGER DEFAULT 0,
  weight_g INTEGER DEFAULT 0, sort INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, name TEXT NOT NULL,
  phone TEXT DEFAULT '', org_name TEXT DEFAULT '', org_type TEXT DEFAULT '', practice_no TEXT DEFAULT '',
  billing_address TEXT DEFAULT '', status TEXT DEFAULT 'pending', reset_token TEXT, reset_expires INTEGER,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS admins (
  id INTEGER PRIMARY KEY, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY, data TEXT NOT NULL DEFAULT '{}', expires INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY, number TEXT UNIQUE, access_token TEXT NOT NULL,
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  email TEXT NOT NULL, name TEXT NOT NULL, phone TEXT NOT NULL, org_name TEXT DEFAULT '',
  address1 TEXT DEFAULT '', address2 TEXT DEFAULT '', suburb TEXT DEFAULT '', city TEXT DEFAULT '',
  province TEXT DEFAULT '', postal_code TEXT DEFAULT '', notes TEXT DEFAULT '',
  delivery_method TEXT NOT NULL, delivery_label TEXT NOT NULL, delivery_cents INTEGER NOT NULL,
  subtotal_cents INTEGER NOT NULL, discount_cents INTEGER NOT NULL DEFAULT 0, total_cents INTEGER NOT NULL,
  payment_method TEXT NOT NULL, payment_status TEXT NOT NULL DEFAULT 'pending', payment_ref TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'new', courier TEXT DEFAULT '', tracking_no TEXT DEFAULT '',
  stock_deducted INTEGER DEFAULT 0, admin_notes TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')), paid_at TEXT, shipped_at TEXT
);
CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY, order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER, variant_id INTEGER, name TEXT NOT NULL, variant_label TEXT DEFAULT '', sku TEXT DEFAULT '',
  base_price_cents INTEGER NOT NULL, unit_price_cents INTEGER NOT NULL, qty INTEGER NOT NULL, line_total_cents INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS quotes (
  id INTEGER PRIMARY KEY, name TEXT, org_name TEXT, org_type TEXT, email TEXT, phone TEXT, postal_code TEXT,
  items TEXT, reference TEXT, needed_by TEXT, file TEXT DEFAULT '', file_original TEXT DEFAULT '',
  status TEXT DEFAULT 'new', created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY, name TEXT, email TEXT, phone TEXT, message TEXT,
  status TEXT DEFAULT 'new', created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL DEFAULT '');
CREATE INDEX IF NOT EXISTS idx_variants_product ON variants(product_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
`);

// Business details and shop rules the owner can change in Admin > Settings.
const DEFAULT_SETTINGS = {
  business_name: 'Micheals Dynamics (Pty) Ltd',
  trading_name: 'Micheals Dynamics',
  reg_no: '2024/551935/07',
  sahpra_no: '00005896MD',
  vat_line: 'Not VAT registered — no VAT is charged',
  address: '33483 Hluhla Street, Harare, Khayelitsha, Cape Town, 7784',
  phone_1: '074 742 3962',
  phone_2: '071 076 2953',
  whatsapp: '27747423962',
  email: 'michealsdynamicresults@gmail.com',
  hours: '',
  directors: '',
  info_officer: '',
  gbp_url: '',
  cutoff_time: '14:00',
  local_ranges: '7100-7999, 8000-8099',
  local_label: 'Cape Town next-day delivery',
  local_fee: '',
  national_label: 'Nationwide courier (2–4 working days)',
  national_fee: '',
  free_threshold: '2000',
  allow_collection: '1',
  collection_label: 'Collect from our Khayelitsha premises',
  low_stock_threshold: '10',
  bank_name: '',
  bank_account_name: '',
  bank_account_no: '',
  bank_branch_code: '',
  bank_account_type: '',
  tracking_urls: '',
};

const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) insertSetting.run(k, v);

function getSettings() {
  const out = {};
  for (const row of db.prepare('SELECT key, value FROM settings').all()) out[row.key] = row.value;
  return out;
}
function setSetting(key, value) {
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, String(value));
}

function tx(fn) {
  db.exec('BEGIN');
  try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; }
}

module.exports = { db, getSettings, setSetting, tx, DEFAULT_SETTINGS };
