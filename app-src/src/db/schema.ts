export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS app_meta (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS companies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  business_type TEXT NOT NULL,
  cipc_number TEXT,
  vat_number TEXT,
  is_vat_registered INTEGER NOT NULL DEFAULT 0,
  vat_period TEXT NOT NULL DEFAULT 'bi_monthly',
  industry TEXT,
  province TEXT,
  bank_name TEXT,
  bank_account_holder TEXT,
  bank_account_number TEXT,
  bank_branch_code TEXT,
  logo TEXT,
  financial_year_start_month INTEGER NOT NULL DEFAULT 3,
  package_tier TEXT NOT NULL DEFAULT 'hustler',
  trial_start_date TEXT NOT NULL,
  owner_age_band TEXT NOT NULL DEFAULT 'under_65',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  vat_number TEXT,
  is_vat_registered INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS suppliers (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  vat_number TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS expense_categories (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'operating',
  is_default INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS quotes (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  quote_number TEXT NOT NULL,
  quote_date TEXT NOT NULL,
  valid_until TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  items_json TEXT NOT NULL,
  subtotal REAL NOT NULL DEFAULT 0,
  vat_amount REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  notes TEXT,
  customer_vat_registered INTEGER NOT NULL DEFAULT 0,
  converted_to_invoice_id TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  quote_id TEXT,
  invoice_number TEXT NOT NULL,
  invoice_date TEXT NOT NULL,
  due_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  items_json TEXT NOT NULL,
  subtotal REAL NOT NULL DEFAULT 0,
  vat_amount REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  amount_paid REAL NOT NULL DEFAULT 0,
  notes TEXT,
  customer_vat_registered INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  invoice_id TEXT NOT NULL,
  amount REAL NOT NULL,
  payment_date TEXT NOT NULL,
  method TEXT NOT NULL,
  reference TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  supplier_id TEXT,
  category_id TEXT NOT NULL,
  description TEXT NOT NULL,
  amount REAL NOT NULL,
  vat_applicable INTEGER NOT NULL DEFAULT 0,
  vat_amount REAL NOT NULL DEFAULT 0,
  expense_date TEXT NOT NULL,
  receipt_photo TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS bills (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  supplier_id TEXT NOT NULL,
  bill_number TEXT NOT NULL,
  bill_date TEXT NOT NULL,
  due_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  items_json TEXT NOT NULL,
  subtotal REAL NOT NULL DEFAULT 0,
  vat_amount REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  amount_paid REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  company_id TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT,
  PRIMARY KEY (company_id, key)
);

CREATE INDEX IF NOT EXISTS idx_customers_company ON customers(company_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_company ON suppliers(company_id);
CREATE INDEX IF NOT EXISTS idx_quotes_company ON quotes(company_id);
CREATE INDEX IF NOT EXISTS idx_invoices_company ON invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_expenses_company ON expenses(company_id);
CREATE INDEX IF NOT EXISTS idx_bills_company ON bills(company_id);

-- Automation (added in schema version 2). All CREATE IF NOT EXISTS, so existing data files upgrade in place.
CREATE TABLE IF NOT EXISTS recurring_invoices (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  source_invoice_id TEXT NOT NULL,
  frequency TEXT NOT NULL,
  next_date TEXT NOT NULL,
  end_date TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  last_run TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reminders (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  invoice_id TEXT NOT NULL,
  channel TEXT NOT NULL,
  sent_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS bank_lines (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  line_date TEXT NOT NULL,
  description TEXT NOT NULL,
  amount REAL NOT NULL,
  fingerprint TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  match_type TEXT,
  match_id TEXT,
  imported_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS bank_rules (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  pattern TEXT NOT NULL,
  category_id TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_recurring_company ON recurring_invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_reminders_invoice ON reminders(invoice_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_bank_lines_fp ON bank_lines(company_id, fingerprint);
`;

export const SCHEMA_VERSION = 2;
