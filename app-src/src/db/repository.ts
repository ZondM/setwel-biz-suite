import { run, query, queryOne, transaction } from './database';
import { uid } from '../core/numbering';
import {
  Company,
  Customer,
  Supplier,
  ExpenseCategory,
  Quote,
  Invoice,
  Payment,
  Expense,
  Bill,
  LineItem
} from '../core/types';

const bool = (v: any) => !!v && v !== 0;
const toInt = (v: boolean) => (v ? 1 : 0);
const nowIso = () => new Date().toISOString();

// ---------- Companies ----------

function rowToCompany(r: any): Company {
  return {
    id: r.id,
    name: r.name,
    businessType: r.business_type,
    cipcNumber: r.cipc_number ?? undefined,
    vatNumber: r.vat_number ?? undefined,
    isVatRegistered: bool(r.is_vat_registered),
    vatPeriod: r.vat_period,
    industry: r.industry ?? undefined,
    province: r.province ?? undefined,
    bankName: r.bank_name ?? undefined,
    bankAccountHolder: r.bank_account_holder ?? undefined,
    bankAccountNumber: r.bank_account_number ?? undefined,
    bankBranchCode: r.bank_branch_code ?? undefined,
    logo: r.logo ?? undefined,
    financialYearStartMonth: r.financial_year_start_month,
    packageTier: r.package_tier,
    trialStartDate: r.trial_start_date,
    ownerAgeBand: r.owner_age_band,
    createdAt: r.created_at
  };
}

export function getActiveCompany(): Company | null {
  const r = queryOne<any>('SELECT * FROM companies ORDER BY created_at ASC LIMIT 1');
  return r ? rowToCompany(r) : null;
}

export function createCompany(input: Omit<Company, 'id' | 'createdAt'>): Company {
  const id = uid('co_');
  run(
    `INSERT INTO companies (id, name, business_type, cipc_number, vat_number, is_vat_registered, vat_period, industry, province, bank_name, bank_account_holder, bank_account_number, bank_branch_code, logo, financial_year_start_month, package_tier, trial_start_date, owner_age_band, created_at)
     VALUES (:id, :name, :business_type, :cipc_number, :vat_number, :is_vat_registered, :vat_period, :industry, :province, :bank_name, :bank_account_holder, :bank_account_number, :bank_branch_code, :logo, :financial_year_start_month, :package_tier, :trial_start_date, :owner_age_band, :created_at)`,
    {
      ':id': id,
      ':name': input.name,
      ':business_type': input.businessType,
      ':cipc_number': input.cipcNumber ?? null,
      ':vat_number': input.vatNumber ?? null,
      ':is_vat_registered': toInt(input.isVatRegistered),
      ':vat_period': input.vatPeriod,
      ':industry': input.industry ?? null,
      ':province': input.province ?? null,
      ':bank_name': input.bankName ?? null,
      ':bank_account_holder': input.bankAccountHolder ?? null,
      ':bank_account_number': input.bankAccountNumber ?? null,
      ':bank_branch_code': input.bankBranchCode ?? null,
      ':logo': input.logo ?? null,
      ':financial_year_start_month': input.financialYearStartMonth,
      ':package_tier': input.packageTier,
      ':trial_start_date': input.trialStartDate,
      ':owner_age_band': input.ownerAgeBand,
      ':created_at': nowIso()
    }
  );
  return getActiveCompany()!;
}

export function updateCompany(id: string, patch: Partial<Company>) {
  const existing = queryOne<any>('SELECT * FROM companies WHERE id = :id', { ':id': id });
  if (!existing) return;
  const merged = { ...rowToCompany(existing), ...patch };
  run(
    `UPDATE companies SET name=:name, business_type=:business_type, cipc_number=:cipc_number, vat_number=:vat_number, is_vat_registered=:is_vat_registered, vat_period=:vat_period, industry=:industry, province=:province, bank_name=:bank_name, bank_account_holder=:bank_account_holder, bank_account_number=:bank_account_number, bank_branch_code=:bank_branch_code, logo=:logo, financial_year_start_month=:financial_year_start_month, package_tier=:package_tier, owner_age_band=:owner_age_band WHERE id=:id`,
    {
      ':id': id,
      ':name': merged.name,
      ':business_type': merged.businessType,
      ':cipc_number': merged.cipcNumber ?? null,
      ':vat_number': merged.vatNumber ?? null,
      ':is_vat_registered': toInt(merged.isVatRegistered),
      ':vat_period': merged.vatPeriod,
      ':industry': merged.industry ?? null,
      ':province': merged.province ?? null,
      ':bank_name': merged.bankName ?? null,
      ':bank_account_holder': merged.bankAccountHolder ?? null,
      ':bank_account_number': merged.bankAccountNumber ?? null,
      ':bank_branch_code': merged.bankBranchCode ?? null,
      ':logo': merged.logo ?? null,
      ':financial_year_start_month': merged.financialYearStartMonth,
      ':package_tier': merged.packageTier,
      ':owner_age_band': merged.ownerAgeBand
    }
  );
}

// ---------- Customers ----------

function rowToCustomer(r: any): Customer {
  return {
    id: r.id,
    companyId: r.company_id,
    name: r.name,
    email: r.email ?? undefined,
    phone: r.phone ?? undefined,
    address: r.address ?? undefined,
    vatNumber: r.vat_number ?? undefined,
    isVatRegistered: bool(r.is_vat_registered),
    createdAt: r.created_at
  };
}

export function listCustomers(companyId: string): Customer[] {
  return query<any>('SELECT * FROM customers WHERE company_id = :cid ORDER BY name ASC', { ':cid': companyId }).map(rowToCustomer);
}

export function getCustomer(id: string): Customer | null {
  const r = queryOne<any>('SELECT * FROM customers WHERE id = :id', { ':id': id });
  return r ? rowToCustomer(r) : null;
}

export function saveCustomer(c: Omit<Customer, 'createdAt' | 'id'> & { id?: string }): Customer {
  const id = c.id ?? uid('cust_');
  const exists = c.id ? queryOne('SELECT id FROM customers WHERE id = :id', { ':id': c.id }) : null;
  if (exists) {
    run(
      `UPDATE customers SET name=:name, email=:email, phone=:phone, address=:address, vat_number=:vat_number, is_vat_registered=:vr WHERE id=:id`,
      { ':id': id, ':name': c.name, ':email': c.email ?? null, ':phone': c.phone ?? null, ':address': c.address ?? null, ':vat_number': c.vatNumber ?? null, ':vr': toInt(c.isVatRegistered) }
    );
  } else {
    run(
      `INSERT INTO customers (id, company_id, name, email, phone, address, vat_number, is_vat_registered, created_at) VALUES (:id,:cid,:name,:email,:phone,:address,:vat_number,:vr,:created_at)`,
      { ':id': id, ':cid': c.companyId, ':name': c.name, ':email': c.email ?? null, ':phone': c.phone ?? null, ':address': c.address ?? null, ':vat_number': c.vatNumber ?? null, ':vr': toInt(c.isVatRegistered), ':created_at': nowIso() }
    );
  }
  return getCustomer(id)!;
}

export function deleteCustomer(id: string) {
  run('DELETE FROM customers WHERE id = :id', { ':id': id });
}

// ---------- Suppliers ----------

function rowToSupplier(r: any): Supplier {
  return {
    id: r.id,
    companyId: r.company_id,
    name: r.name,
    email: r.email ?? undefined,
    phone: r.phone ?? undefined,
    address: r.address ?? undefined,
    vatNumber: r.vat_number ?? undefined,
    createdAt: r.created_at
  };
}

export function listSuppliers(companyId: string): Supplier[] {
  return query<any>('SELECT * FROM suppliers WHERE company_id = :cid ORDER BY name ASC', { ':cid': companyId }).map(rowToSupplier);
}

export function getSupplier(id: string): Supplier | null {
  const r = queryOne<any>('SELECT * FROM suppliers WHERE id = :id', { ':id': id });
  return r ? rowToSupplier(r) : null;
}

export function saveSupplier(s: Omit<Supplier, 'createdAt' | 'id'> & { id?: string }): Supplier {
  const id = s.id ?? uid('sup_');
  const exists = s.id ? queryOne('SELECT id FROM suppliers WHERE id = :id', { ':id': s.id }) : null;
  if (exists) {
    run(`UPDATE suppliers SET name=:name, email=:email, phone=:phone, address=:address, vat_number=:vat_number WHERE id=:id`, {
      ':id': id,
      ':name': s.name,
      ':email': s.email ?? null,
      ':phone': s.phone ?? null,
      ':address': s.address ?? null,
      ':vat_number': s.vatNumber ?? null
    });
  } else {
    run(
      `INSERT INTO suppliers (id, company_id, name, email, phone, address, vat_number, created_at) VALUES (:id,:cid,:name,:email,:phone,:address,:vat_number,:created_at)`,
      { ':id': id, ':cid': s.companyId, ':name': s.name, ':email': s.email ?? null, ':phone': s.phone ?? null, ':address': s.address ?? null, ':vat_number': s.vatNumber ?? null, ':created_at': nowIso() }
    );
  }
  return getSupplier(id)!;
}

export function deleteSupplier(id: string) {
  run('DELETE FROM suppliers WHERE id = :id', { ':id': id });
}

// ---------- Expense categories ----------

function rowToCategory(r: any): ExpenseCategory {
  return { id: r.id, companyId: r.company_id, name: r.name, type: r.type, isDefault: bool(r.is_default) };
}

export const DEFAULT_EXPENSE_CATEGORIES: { name: string; type: 'cost_of_sales' | 'operating' }[] = [
  { name: 'Stock / materials purchased', type: 'cost_of_sales' },
  { name: 'Subcontractor costs', type: 'cost_of_sales' },
  { name: 'Rent', type: 'operating' },
  { name: 'Electricity & water', type: 'operating' },
  { name: 'Telephone & internet', type: 'operating' },
  { name: 'Fuel & travel', type: 'operating' },
  { name: 'Bank charges', type: 'operating' },
  { name: 'Salaries & wages', type: 'operating' },
  { name: 'Marketing & advertising', type: 'operating' },
  { name: 'Insurance', type: 'operating' },
  { name: 'Repairs & maintenance', type: 'operating' },
  { name: 'Office supplies', type: 'operating' },
  { name: 'Accounting & professional fees', type: 'operating' },
  { name: 'Other expenses', type: 'operating' }
];

export function ensureDefaultCategories(companyId: string) {
  const existing = query('SELECT id FROM expense_categories WHERE company_id = :cid', { ':cid': companyId });
  if (existing.length > 0) return;
  transaction(() => {
    for (const cat of DEFAULT_EXPENSE_CATEGORIES) {
      run('INSERT INTO expense_categories (id, company_id, name, type, is_default) VALUES (:id,:cid,:name,:type,1)', {
        ':id': uid('cat_'),
        ':cid': companyId,
        ':name': cat.name,
        ':type': cat.type
      });
    }
  });
}

export function listCategories(companyId: string): ExpenseCategory[] {
  return query<any>('SELECT * FROM expense_categories WHERE company_id = :cid ORDER BY type DESC, name ASC', { ':cid': companyId }).map(rowToCategory);
}

export function createCategory(companyId: string, name: string, type: 'cost_of_sales' | 'operating'): ExpenseCategory {
  const id = uid('cat_');
  run('INSERT INTO expense_categories (id, company_id, name, type, is_default) VALUES (:id,:cid,:name,:type,0)', {
    ':id': id,
    ':cid': companyId,
    ':name': name,
    ':type': type
  });
  return rowToCategory(queryOne('SELECT * FROM expense_categories WHERE id = :id', { ':id': id }));
}

// ---------- Quotes ----------

function rowToQuote(r: any): Quote {
  return {
    id: r.id,
    companyId: r.company_id,
    customerId: r.customer_id,
    quoteNumber: r.quote_number,
    quoteDate: r.quote_date,
    validUntil: r.valid_until,
    status: r.status,
    items: JSON.parse(r.items_json),
    subtotal: r.subtotal,
    vatAmount: r.vat_amount,
    total: r.total,
    notes: r.notes ?? undefined,
    customerVatRegistered: bool(r.customer_vat_registered),
    convertedToInvoiceId: r.converted_to_invoice_id ?? undefined,
    createdAt: r.created_at
  };
}

export function listQuotes(companyId: string): Quote[] {
  return query<any>('SELECT * FROM quotes WHERE company_id = :cid ORDER BY quote_date DESC', { ':cid': companyId }).map(rowToQuote);
}

export function getQuote(id: string): Quote | null {
  const r = queryOne<any>('SELECT * FROM quotes WHERE id = :id', { ':id': id });
  return r ? rowToQuote(r) : null;
}

export function saveQuote(q: Omit<Quote, 'createdAt'>): Quote {
  const exists = queryOne('SELECT id FROM quotes WHERE id = :id', { ':id': q.id });
  const params = {
    ':id': q.id,
    ':cid': q.companyId,
    ':customer_id': q.customerId,
    ':quote_number': q.quoteNumber,
    ':quote_date': q.quoteDate,
    ':valid_until': q.validUntil,
    ':status': q.status,
    ':items_json': JSON.stringify(q.items),
    ':subtotal': q.subtotal,
    ':vat_amount': q.vatAmount,
    ':total': q.total,
    ':notes': q.notes ?? null,
    ':cvr': toInt(q.customerVatRegistered),
    ':converted': q.convertedToInvoiceId ?? null
  };
  if (exists) {
    run(
      `UPDATE quotes SET customer_id=:customer_id, quote_number=:quote_number, quote_date=:quote_date, valid_until=:valid_until, status=:status, items_json=:items_json, subtotal=:subtotal, vat_amount=:vat_amount, total=:total, notes=:notes, customer_vat_registered=:cvr, converted_to_invoice_id=:converted WHERE id=:id`,
      params
    );
  } else {
    run(
      `INSERT INTO quotes (id, company_id, customer_id, quote_number, quote_date, valid_until, status, items_json, subtotal, vat_amount, total, notes, customer_vat_registered, converted_to_invoice_id, created_at)
       VALUES (:id,:cid,:customer_id,:quote_number,:quote_date,:valid_until,:status,:items_json,:subtotal,:vat_amount,:total,:notes,:cvr,:converted,:created_at)`,
      { ...params, ':created_at': nowIso() }
    );
  }
  return getQuote(q.id)!;
}

export function deleteQuote(id: string) {
  run('DELETE FROM quotes WHERE id = :id', { ':id': id });
}

export function getNextQuoteNumber(companyId: string, prefix: string): string {
  const r = queryOne<any>('SELECT COUNT(*) as c FROM quotes WHERE company_id = :cid', { ':cid': companyId });
  const n = (r?.c ?? 0) + 1;
  return `${prefix}-${String(n).padStart(5, '0')}`;
}

// ---------- Invoices ----------

function rowToInvoice(r: any): Invoice {
  return {
    id: r.id,
    companyId: r.company_id,
    customerId: r.customer_id,
    quoteId: r.quote_id ?? undefined,
    invoiceNumber: r.invoice_number,
    invoiceDate: r.invoice_date,
    dueDate: r.due_date,
    status: r.status,
    items: JSON.parse(r.items_json),
    subtotal: r.subtotal,
    vatAmount: r.vat_amount,
    total: r.total,
    amountPaid: r.amount_paid,
    notes: r.notes ?? undefined,
    customerVatRegistered: bool(r.customer_vat_registered),
    createdAt: r.created_at
  };
}

export function listInvoices(companyId: string): Invoice[] {
  return query<any>('SELECT * FROM invoices WHERE company_id = :cid ORDER BY invoice_date DESC', { ':cid': companyId }).map(rowToInvoice);
}

export function getInvoice(id: string): Invoice | null {
  const r = queryOne<any>('SELECT * FROM invoices WHERE id = :id', { ':id': id });
  return r ? rowToInvoice(r) : null;
}

export function saveInvoice(inv: Omit<Invoice, 'createdAt'>): Invoice {
  const exists = queryOne('SELECT id FROM invoices WHERE id = :id', { ':id': inv.id });
  const params = {
    ':id': inv.id,
    ':cid': inv.companyId,
    ':customer_id': inv.customerId,
    ':quote_id': inv.quoteId ?? null,
    ':invoice_number': inv.invoiceNumber,
    ':invoice_date': inv.invoiceDate,
    ':due_date': inv.dueDate,
    ':status': inv.status,
    ':items_json': JSON.stringify(inv.items),
    ':subtotal': inv.subtotal,
    ':vat_amount': inv.vatAmount,
    ':total': inv.total,
    ':amount_paid': inv.amountPaid,
    ':notes': inv.notes ?? null,
    ':cvr': toInt(inv.customerVatRegistered)
  };
  if (exists) {
    run(
      `UPDATE invoices SET customer_id=:customer_id, quote_id=:quote_id, invoice_number=:invoice_number, invoice_date=:invoice_date, due_date=:due_date, status=:status, items_json=:items_json, subtotal=:subtotal, vat_amount=:vat_amount, total=:total, amount_paid=:amount_paid, notes=:notes, customer_vat_registered=:cvr WHERE id=:id`,
      params
    );
  } else {
    run(
      `INSERT INTO invoices (id, company_id, customer_id, quote_id, invoice_number, invoice_date, due_date, status, items_json, subtotal, vat_amount, total, amount_paid, notes, customer_vat_registered, created_at)
       VALUES (:id,:cid,:customer_id,:quote_id,:invoice_number,:invoice_date,:due_date,:status,:items_json,:subtotal,:vat_amount,:total,:amount_paid,:notes,:cvr,:created_at)`,
      { ...params, ':created_at': nowIso() }
    );
  }
  return getInvoice(inv.id)!;
}

export function deleteInvoice(id: string) {
  run('DELETE FROM invoices WHERE id = :id', { ':id': id });
  run('DELETE FROM payments WHERE invoice_id = :id', { ':id': id });
}

export function getNextInvoiceNumber(companyId: string, prefix: string): string {
  const r = queryOne<any>('SELECT COUNT(*) as c FROM invoices WHERE company_id = :cid', { ':cid': companyId });
  const n = (r?.c ?? 0) + 1;
  return `${prefix}-${String(n).padStart(5, '0')}`;
}

// ---------- Payments ----------

function rowToPayment(r: any): Payment {
  return {
    id: r.id,
    companyId: r.company_id,
    invoiceId: r.invoice_id,
    amount: r.amount,
    paymentDate: r.payment_date,
    method: r.method,
    reference: r.reference ?? undefined,
    createdAt: r.created_at
  };
}

export function listPaymentsForInvoice(invoiceId: string): Payment[] {
  return query<any>('SELECT * FROM payments WHERE invoice_id = :id ORDER BY payment_date DESC', { ':id': invoiceId }).map(rowToPayment);
}

export function recordPayment(p: Omit<Payment, 'id' | 'createdAt'>): Payment {
  const id = uid('pay_');
  transaction(() => {
    run(
      `INSERT INTO payments (id, company_id, invoice_id, amount, payment_date, method, reference, created_at) VALUES (:id,:cid,:invoice_id,:amount,:payment_date,:method,:reference,:created_at)`,
      { ':id': id, ':cid': p.companyId, ':invoice_id': p.invoiceId, ':amount': p.amount, ':payment_date': p.paymentDate, ':method': p.method, ':reference': p.reference ?? null, ':created_at': nowIso() }
    );
    const inv = getInvoice(p.invoiceId);
    if (inv) {
      const newPaid = Math.round((inv.amountPaid + p.amount) * 100) / 100;
      const newStatus = newPaid >= inv.total ? 'paid' : newPaid > 0 ? 'partial' : inv.status;
      run('UPDATE invoices SET amount_paid = :paid, status = :status WHERE id = :id', { ':paid': newPaid, ':status': newStatus, ':id': inv.id });
    }
  });
  return rowToPayment(queryOne('SELECT * FROM payments WHERE id = :id', { ':id': id }));
}

// ---------- Expenses ----------

function rowToExpense(r: any): Expense {
  return {
    id: r.id,
    companyId: r.company_id,
    supplierId: r.supplier_id ?? undefined,
    categoryId: r.category_id,
    description: r.description,
    amount: r.amount,
    vatApplicable: bool(r.vat_applicable),
    vatAmount: r.vat_amount,
    expenseDate: r.expense_date,
    receiptPhoto: r.receipt_photo ?? undefined,
    createdAt: r.created_at
  };
}

export function listExpenses(companyId: string): Expense[] {
  return query<any>('SELECT * FROM expenses WHERE company_id = :cid ORDER BY expense_date DESC', { ':cid': companyId }).map(rowToExpense);
}

export function saveExpense(e: Omit<Expense, 'createdAt' | 'id'> & { id?: string }): Expense {
  const id = e.id ?? uid('exp_');
  const exists = e.id ? queryOne('SELECT id FROM expenses WHERE id = :id', { ':id': e.id }) : null;
  const params = {
    ':id': id,
    ':cid': e.companyId,
    ':supplier_id': e.supplierId ?? null,
    ':category_id': e.categoryId,
    ':description': e.description,
    ':amount': e.amount,
    ':vat_applicable': toInt(e.vatApplicable),
    ':vat_amount': e.vatAmount,
    ':expense_date': e.expenseDate,
    ':receipt_photo': e.receiptPhoto ?? null
  };
  if (exists) {
    run(
      `UPDATE expenses SET supplier_id=:supplier_id, category_id=:category_id, description=:description, amount=:amount, vat_applicable=:vat_applicable, vat_amount=:vat_amount, expense_date=:expense_date, receipt_photo=:receipt_photo WHERE id=:id`,
      params
    );
  } else {
    run(
      `INSERT INTO expenses (id, company_id, supplier_id, category_id, description, amount, vat_applicable, vat_amount, expense_date, receipt_photo, created_at) VALUES (:id,:cid,:supplier_id,:category_id,:description,:amount,:vat_applicable,:vat_amount,:expense_date,:receipt_photo,:created_at)`,
      { ...params, ':created_at': nowIso() }
    );
  }
  return rowToExpense(queryOne('SELECT * FROM expenses WHERE id = :id', { ':id': id }));
}

export function deleteExpense(id: string) {
  run('DELETE FROM expenses WHERE id = :id', { ':id': id });
}

// ---------- Bills (supplier invoices, Grinder+) ----------

function rowToBill(r: any): Bill {
  return {
    id: r.id,
    companyId: r.company_id,
    supplierId: r.supplier_id,
    billNumber: r.bill_number,
    billDate: r.bill_date,
    dueDate: r.due_date,
    status: r.status,
    items: JSON.parse(r.items_json),
    subtotal: r.subtotal,
    vatAmount: r.vat_amount,
    total: r.total,
    amountPaid: r.amount_paid,
    createdAt: r.created_at
  };
}

export function listBills(companyId: string): Bill[] {
  return query<any>('SELECT * FROM bills WHERE company_id = :cid ORDER BY bill_date DESC', { ':cid': companyId }).map(rowToBill);
}

export function saveBill(b: Omit<Bill, 'createdAt'>): Bill {
  const exists = queryOne('SELECT id FROM bills WHERE id = :id', { ':id': b.id });
  const params = {
    ':id': b.id,
    ':cid': b.companyId,
    ':supplier_id': b.supplierId,
    ':bill_number': b.billNumber,
    ':bill_date': b.billDate,
    ':due_date': b.dueDate,
    ':status': b.status,
    ':items_json': JSON.stringify(b.items),
    ':subtotal': b.subtotal,
    ':vat_amount': b.vatAmount,
    ':total': b.total,
    ':amount_paid': b.amountPaid
  };
  if (exists) {
    run(
      `UPDATE bills SET supplier_id=:supplier_id, bill_number=:bill_number, bill_date=:bill_date, due_date=:due_date, status=:status, items_json=:items_json, subtotal=:subtotal, vat_amount=:vat_amount, total=:total, amount_paid=:amount_paid WHERE id=:id`,
      params
    );
  } else {
    run(
      `INSERT INTO bills (id, company_id, supplier_id, bill_number, bill_date, due_date, status, items_json, subtotal, vat_amount, total, amount_paid, created_at) VALUES (:id,:cid,:supplier_id,:bill_number,:bill_date,:due_date,:status,:items_json,:subtotal,:vat_amount,:total,:amount_paid,:created_at)`,
      { ...params, ':created_at': nowIso() }
    );
  }
  return rowToBill(queryOne('SELECT * FROM bills WHERE id = :id', { ':id': b.id }));
}

export function deleteBill(id: string) {
  run('DELETE FROM bills WHERE id = :id', { ':id': id });
}

export function getNextBillNumber(companyId: string, prefix: string): string {
  const r = queryOne<any>('SELECT COUNT(*) as c FROM bills WHERE company_id = :cid', { ':cid': companyId });
  const n = (r?.c ?? 0) + 1;
  return `${prefix}-${String(n).padStart(5, '0')}`;
}

// ---------- Settings (generic key/value per company) ----------

export function getSetting(companyId: string, key: string): string | null {
  const r = queryOne<any>('SELECT value FROM settings WHERE company_id = :cid AND key = :key', { ':cid': companyId, ':key': key });
  return r ? r.value : null;
}

export function setSetting(companyId: string, key: string, value: string) {
  const exists = queryOne('SELECT 1 as x FROM settings WHERE company_id = :cid AND key = :key', { ':cid': companyId, ':key': key });
  if (exists) {
    run('UPDATE settings SET value = :value WHERE company_id = :cid AND key = :key', { ':value': value, ':cid': companyId, ':key': key });
  } else {
    run('INSERT INTO settings (company_id, key, value) VALUES (:cid, :key, :value)', { ':cid': companyId, ':key': key, ':value': value });
  }
}

export function saveCategory(c: { id?: string; companyId: string; name: string; type: 'cost_of_sales' | 'operating' | 'income' }): ExpenseCategory {
  if (c.id) {
    run('UPDATE expense_categories SET name=:name, type=:type WHERE id=:id', { ':id': c.id, ':name': c.name, ':type': c.type });
    return rowToCategory(queryOne('SELECT * FROM expense_categories WHERE id=:id', { ':id': c.id }));
  }
  return createCategory(c.companyId, c.name, c.type as any);
}

export function deleteCategory(id: string) {
  run('DELETE FROM expense_categories WHERE id=:id AND is_default=0', { ':id': id });
}

export function getSettings(companyId: string): Record<string, string> {
  const rows = query<any>('SELECT key, value FROM settings WHERE company_id = :cid', { ':cid': companyId });
  const out: Record<string, string> = {};
  for (const r of rows) out[r.key] = r.value;
  return out;
}

export function newLineItem(): LineItem {
  return { id: uid('li_'), description: '', quantity: 1, unitPrice: 0, vatApplicable: true, lineTotal: 0 };
}
