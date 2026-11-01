// Core domain types shared by the financial engine, the database layer and the UI.
// Keeping these in one place means the web build and the Electron build never drift apart.

export type PackageTier = 'hustler' | 'grinder' | 'builder' | 'enterprise' | 'accountant_partner';

export type BusinessType = 'sole_proprietor' | 'partnership' | 'pty_ltd' | 'cc' | 'npo';

export interface Company {
  id: string;
  name: string;
  businessType: BusinessType;
  cipcNumber?: string;
  vatNumber?: string;
  isVatRegistered: boolean;
  vatPeriod: 'bi_monthly' | 'monthly';
  industry?: string;
  province?: string;
  bankName?: string;
  bankAccountHolder?: string;
  bankAccountNumber?: string;
  bankBranchCode?: string;
  logo?: string; // base64 data URL
  financialYearStartMonth: number; // 1-12, default 3 (March)
  packageTier: PackageTier;
  trialStartDate: string; // ISO date
  ownerAgeBand: 'under_65' | '65_to_74' | '75_plus';
  createdAt: string;
}

export interface Customer {
  id: string;
  companyId: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  vatNumber?: string;
  isVatRegistered: boolean;
  createdAt: string;
}

export interface Supplier {
  id: string;
  companyId: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  vatNumber?: string;
  createdAt: string;
}

export interface ExpenseCategory {
  id: string;
  companyId: string;
  name: string;
  type: 'cost_of_sales' | 'operating';
  isDefault: boolean;
}

export interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  vatApplicable: boolean;
  lineTotal: number; // excl. VAT
}

export type DocStatus = 'draft' | 'sent' | 'paid' | 'partial' | 'overdue' | 'accepted' | 'declined' | 'converted';

export interface Quote {
  id: string;
  companyId: string;
  customerId: string;
  quoteNumber: string;
  quoteDate: string;
  validUntil: string;
  status: DocStatus;
  items: LineItem[];
  subtotal: number;
  vatAmount: number;
  total: number;
  notes?: string;
  customerVatRegistered: boolean;
  convertedToInvoiceId?: string;
  createdAt: string;
}

export interface Invoice {
  id: string;
  companyId: string;
  customerId: string;
  quoteId?: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  status: DocStatus;
  items: LineItem[];
  subtotal: number;
  vatAmount: number;
  total: number;
  amountPaid: number;
  notes?: string;
  customerVatRegistered: boolean;
  createdAt: string;
}

export type PaymentMethod = 'cash' | 'eft' | 'card' | 'snapscan' | 'zapper' | 'other';

export interface Payment {
  id: string;
  companyId: string;
  invoiceId: string;
  amount: number;
  paymentDate: string;
  method: PaymentMethod;
  reference?: string;
  createdAt: string;
}

export interface Expense {
  id: string;
  companyId: string;
  supplierId?: string;
  categoryId: string;
  description: string;
  amount: number; // total incl. VAT if vatApplicable
  vatApplicable: boolean;
  vatAmount: number;
  expenseDate: string;
  receiptPhoto?: string; // base64 data URL
  createdAt: string;
}

export interface Bill {
  id: string;
  companyId: string;
  supplierId: string;
  billNumber: string;
  billDate: string;
  dueDate: string;
  status: DocStatus;
  items: LineItem[];
  subtotal: number;
  vatAmount: number;
  total: number;
  amountPaid: number;
  createdAt: string;
}

export interface AppSettings {
  nextQuoteNumber: number;
  nextInvoiceNumber: number;
  nextBillNumber: number;
  invoicePrefix: string;
  quotePrefix: string;
  billPrefix: string;
  defaultPaymentTermsDays: number;
  whatsappSupportNumber: string;
}

export interface TaxBracket {
  min: number;
  max: number | null;
  base: number;
  rate: number;
}

export interface TaxYearTable {
  taxYear: string; // e.g. "2027" meaning 1 Mar 2026 - 28 Feb 2027
  startDate: string;
  endDate: string;
  brackets: TaxBracket[];
  primaryRebate: number;
  secondaryRebate: number; // 65+
  tertiaryRebate: number; // 75+
  thresholdUnder65: number;
  threshold65to74: number;
  threshold75plus: number;
}
