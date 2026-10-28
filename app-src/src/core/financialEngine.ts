// The financial intelligence engine. Pure, deterministic functions only — no I/O, no
// framework dependency — so the same calculations run identically in the web build,
// the Electron build, and any future automated tests.

import { LineItem, BusinessType, Invoice, Expense, Bill } from './types';
import { VAT_RATE, CORPORATE_TAX_RATE, getTaxTableForDate, UIF_MONTHLY_CEILING, UIF_EMPLOYEE_RATE } from './taxTables';

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function calculateLineTotal(quantity: number, unitPrice: number): number {
  return round2(quantity * unitPrice);
}

/** Given exclusive-of-VAT line items, returns subtotal / VAT / total. Lines with vatApplicable=false are zero-rated/exempt. */
export function calculateDocumentTotals(items: LineItem[]) {
  let subtotal = 0;
  let vatAmount = 0;
  for (const item of items) {
    const lineTotal = calculateLineTotal(item.quantity, item.unitPrice);
    subtotal += lineTotal;
    if (item.vatApplicable) vatAmount += lineTotal * VAT_RATE;
  }
  subtotal = round2(subtotal);
  vatAmount = round2(vatAmount);
  return { subtotal, vatAmount, total: round2(subtotal + vatAmount) };
}

/** Splits a VAT-inclusive amount into its exclusive amount and the VAT portion. */
export function splitVatInclusive(amountIncl: number) {
  const exclusive = round2(amountIncl / (1 + VAT_RATE));
  const vat = round2(amountIncl - exclusive);
  return { exclusive, vat };
}

export function addVat(amountExcl: number) {
  return round2(amountExcl * VAT_RATE);
}

export interface FinancialSummary {
  totalIncomeExclVat: number;
  costOfSales: number;
  grossProfit: number;
  grossProfitMargin: number;
  operatingExpenses: number;
  netProfit: number;
  netProfitMargin: number;
  outputVat: number;
  inputVat: number;
  netVatOwing: number;
  estimatedIncomeTax: number;
  estimatedTakeHome: number;
}

interface SummaryInput {
  paidInvoices: Invoice[];
  expenses: Expense[];
  costOfSalesCategoryIds: Set<string>;
  bills?: Bill[];
  businessType: BusinessType;
  isVatRegistered: boolean;
  annualisedNetProfitOverride?: number; // for tax estimate based on full-year projection rather than just the period
}

/** Builds the always-visible dashboard summary block described in the product brief. */
export function buildFinancialSummary(input: SummaryInput): FinancialSummary {
  const { paidInvoices, expenses, costOfSalesCategoryIds, businessType, isVatRegistered } = input;

  const totalIncomeExclVat = round2(paidInvoices.reduce((sum, inv) => sum + inv.subtotal, 0));
  const outputVat = round2(paidInvoices.reduce((sum, inv) => sum + inv.vatAmount, 0));

  let costOfSales = 0;
  let operatingExpenses = 0;
  let inputVat = 0;
  for (const exp of expenses) {
    const exclAmount = exp.vatApplicable ? exp.amount - exp.vatAmount : exp.amount;
    if (costOfSalesCategoryIds.has(exp.categoryId)) costOfSales += exclAmount;
    else operatingExpenses += exclAmount;
    if (exp.vatApplicable) inputVat += exp.vatAmount;
  }
  costOfSales = round2(costOfSales);
  operatingExpenses = round2(operatingExpenses);
  inputVat = round2(inputVat);

  const grossProfit = round2(totalIncomeExclVat - costOfSales);
  const grossProfitMargin = totalIncomeExclVat > 0 ? round2((grossProfit / totalIncomeExclVat) * 100) : 0;
  const netProfit = round2(grossProfit - operatingExpenses);
  const netProfitMargin = totalIncomeExclVat > 0 ? round2((netProfit / totalIncomeExclVat) * 100) : 0;
  const netVatOwing = isVatRegistered ? round2(outputVat - inputVat) : 0;

  const taxableProfit = Math.max(0, input.annualisedNetProfitOverride ?? netProfit);
  const estimatedIncomeTax =
    businessType === 'pty_ltd' || businessType === 'cc'
      ? round2(taxableProfit * CORPORATE_TAX_RATE)
      : estimateIndividualTax(taxableProfit);

  const estimatedTakeHome = round2(netProfit - estimatedIncomeTax - (netVatOwing > 0 ? netVatOwing : 0));

  return {
    totalIncomeExclVat,
    costOfSales,
    grossProfit,
    grossProfitMargin,
    operatingExpenses,
    netProfit,
    netProfitMargin,
    outputVat,
    inputVat,
    netVatOwing,
    estimatedIncomeTax,
    estimatedTakeHome
  };
}

/** Annual SARS individual income tax estimate from progressive brackets, less the primary rebate. Pass a later asOfDate to pick a different tax year's table. */
export function estimateIndividualTax(annualTaxableIncome: number, asOfDate: string = new Date().toISOString().slice(0, 10), ageBand: 'under_65' | '65_to_74' | '75_plus' = 'under_65'): number {
  const table = getTaxTableForDate(asOfDate);
  const bracket = table.brackets.find((b) => annualTaxableIncome >= b.min && (b.max === null || annualTaxableIncome <= b.max));
  if (!bracket) return 0;
  const grossTax = bracket.base + (annualTaxableIncome - bracket.min) * bracket.rate;
  let rebate = table.primaryRebate;
  if (ageBand === '65_to_74') rebate += table.secondaryRebate;
  if (ageBand === '75_plus') rebate += table.secondaryRebate + table.tertiaryRebate;
  return round2(Math.max(0, grossTax - rebate));
}

/** Provisional tax: SARS expects two payments of roughly half the estimated annual liability each. */
export function estimateProvisionalTax(
  annualTaxableIncomeEstimate: number,
  businessType: BusinessType,
  ageBand: 'under_65' | '65_to_74' | '75_plus' = 'under_65'
) {
  const annualTax =
    businessType === 'pty_ltd' || businessType === 'cc'
      ? round2(annualTaxableIncomeEstimate * CORPORATE_TAX_RATE)
      : estimateIndividualTax(annualTaxableIncomeEstimate, undefined, ageBand);
  return {
    annualTaxEstimate: annualTax,
    firstPeriodPayment: round2(annualTax / 2),
    secondPeriodPayment: round2(annualTax / 2),
    monthlyProvisionToSetAside: round2(annualTax / 12)
  };
}

export interface Vat201Result {
  periodStart: string;
  periodEnd: string;
  outputVat: number;
  inputVat: number;
  netVat: number; // positive = owing to SARS, negative = refund due
  totalSalesExclVat: number;
  totalPurchasesExclVat: number;
}

export function calculateVat201(invoices: Invoice[], expenses: Expense[], bills: Bill[], periodStart: string, periodEnd: string): Vat201Result {
  const inRange = (d: string) => d >= periodStart && d <= periodEnd;

  // Opening balances brought forward during setup were already declared before Setwel was used.
  const relevantInvoices = invoices.filter((i) => i.status !== 'draft' && inRange(i.invoiceDate) && i.notes !== 'Opening balance loaded during setup');
  const relevantExpenses = expenses.filter((e) => inRange(e.expenseDate));
  const relevantBills = bills.filter((b) => b.status !== 'draft' && inRange(b.billDate));

  const outputVat = round2(relevantInvoices.reduce((s, i) => s + i.vatAmount, 0));
  const totalSalesExclVat = round2(relevantInvoices.reduce((s, i) => s + i.subtotal, 0));

  const expenseInputVat = relevantExpenses.reduce((s, e) => s + (e.vatApplicable ? e.vatAmount : 0), 0);
  const billInputVat = relevantBills.reduce((s, b) => s + b.vatAmount, 0);
  const inputVat = round2(expenseInputVat + billInputVat);

  const expensePurchases = relevantExpenses.reduce((s, e) => s + (e.vatApplicable ? e.amount - e.vatAmount : e.amount), 0);
  const billPurchases = relevantBills.reduce((s, b) => s + b.subtotal, 0);
  const totalPurchasesExclVat = round2(expensePurchases + billPurchases);

  return {
    periodStart,
    periodEnd,
    outputVat,
    inputVat,
    netVat: round2(outputVat - inputVat),
    totalSalesExclVat,
    totalPurchasesExclVat
  };
}

export interface ProfitAndLoss {
  periodStart: string;
  periodEnd: string;
  incomeByCustomer: { name: string; amount: number }[];
  totalIncome: number;
  costOfSales: number;
  grossProfit: number;
  expensesByCategory: { name: string; amount: number }[];
  totalOperatingExpenses: number;
  netProfit: number;
}

export interface AgedBucket {
  current: number;
  days30: number;
  days60: number;
  days90Plus: number;
  total: number;
}

export function buildAgedBuckets(
  items: { dueDate: string; total: number; amountPaid: number; status: string }[],
  asOfDate: string = new Date().toISOString().slice(0, 10)
): AgedBucket {
  const bucket: AgedBucket = { current: 0, days30: 0, days60: 0, days90Plus: 0, total: 0 };
  const asOf = new Date(asOfDate).getTime();
  for (const item of items) {
    const outstanding = round2(item.total - item.amountPaid);
    if (outstanding <= 0 || item.status === 'draft') continue;
    const due = new Date(item.dueDate).getTime();
    const daysOverdue = Math.floor((asOf - due) / (1000 * 60 * 60 * 24));
    if (daysOverdue <= 0) bucket.current += outstanding;
    else if (daysOverdue <= 30) bucket.days30 += outstanding;
    else if (daysOverdue <= 60) bucket.days60 += outstanding;
    else bucket.days90Plus += outstanding;
    bucket.total += outstanding;
  }
  bucket.current = round2(bucket.current);
  bucket.days30 = round2(bucket.days30);
  bucket.days60 = round2(bucket.days60);
  bucket.days90Plus = round2(bucket.days90Plus);
  bucket.total = round2(bucket.total);
  return bucket;
}

/** Flags a non-VAT-registered business approaching the mandatory R1m registration threshold. */
export function checkVatRegistrationWarning(rolling12MonthTurnover: number): { shouldWarn: boolean; percentOfThreshold: number } {
  const THRESHOLD = 1_000_000;
  const percentOfThreshold = round2((rolling12MonthTurnover / THRESHOLD) * 100);
  return { shouldWarn: percentOfThreshold >= 80, percentOfThreshold };
}

/** UIF — simple monthly per-employee contribution (employee + employer side), capped at the earnings ceiling. */
export function calculateMonthlyUif(grossMonthlyRemuneration: number) {
  const cappedRemuneration = Math.min(grossMonthlyRemuneration, UIF_MONTHLY_CEILING);
  const employee = round2(cappedRemuneration * UIF_EMPLOYEE_RATE);
  const employer = round2(cappedRemuneration * UIF_EMPLOYEE_RATE);
  return { employee, employer, total: round2(employee + employer) };
}
