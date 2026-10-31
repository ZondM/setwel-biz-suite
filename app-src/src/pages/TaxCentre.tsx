import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calculator, FileBarChart, FileSpreadsheet, ExternalLink, CalendarClock, Lock } from 'lucide-react';
import { useApp } from '../state/AppContext';
import { Button, Card, PageHeader, Field, Input, Select, HelpTip } from '../components/common/ui';
import { listInvoices, listExpenses, listCategories } from '../db/repository';
import { estimateProvisionalTax, estimateIndividualTax, buildFinancialSummary, round2 } from '../core/financialEngine';
import { getProvisionalTaxDeadlines, TAX_TABLES, CORPORATE_TAX_RATE } from '../core/taxTables';
import { formatCurrency, formatDate, todayIso } from '../core/numbering';

export default function TaxCentre() {
  const { company } = useApp();
  const navigate = useNavigate();
  const [taxYear, setTaxYear] = useState('2027');
  const [annualIncomeOverride, setAnnualIncomeOverride] = useState<number | null>(null);

  const projectedAnnualProfit = useMemo(() => {
    if (!company) return 0;
    const invoices = listInvoices(company.id).filter((i) => i.status === 'paid');
    const expenses = listExpenses(company.id);
    const categories = listCategories(company.id);
    const costOfSalesIds = new Set(categories.filter((c) => c.type === 'cost_of_sales').map((c) => c.id));
    const summary = buildFinancialSummary({
      paidInvoices: invoices,
      expenses,
      costOfSalesCategoryIds: costOfSalesIds,
      businessType: company.businessType,
      isVatRegistered: company.isVatRegistered
    });
    // crude annualisation: scale year-to-date net profit up to a full year based on days elapsed in the FY
    const fyStartMonth = company.financialYearStartMonth;
    const now = new Date();
    let fyStart = new Date(now.getFullYear(), fyStartMonth - 1, 1);
    if (fyStart > now) fyStart = new Date(now.getFullYear() - 1, fyStartMonth - 1, 1);
    const daysElapsed = Math.max(1, Math.floor((now.getTime() - fyStart.getTime()) / (1000 * 60 * 60 * 24)));
    const annualised = round2((summary.netProfit / daysElapsed) * 365);
    return Math.max(0, annualised);
  }, [company]);

  if (!company) return null;
  const isCorporate = company.businessType === 'pty_ltd' || company.businessType === 'cc';
  const taxableIncome = annualIncomeOverride ?? projectedAnnualProfit;
  const provisional = estimateProvisionalTax(taxableIncome, company.businessType, company.ownerAgeBand);
  const deadlines = getProvisionalTaxDeadlines(taxYear);
  const table = TAX_TABLES[taxYear];

  return (
    <div>
      <PageHeader title="Tax & SARS Centre" subtitle="Provisional tax, income tax estimates, VAT201 and your filing calendar — all in one place." />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <HubCard
          icon={<FileBarChart size={20} />}
          title="VAT201"
          description="Output VAT, input VAT and the net amount owing for any period, ready to copy into eFiling."
          action={<Button size="sm" onClick={() => navigate('/reports/vat201')}>Open VAT201</Button>}
          available={company.isVatRegistered}
          unavailableNote="Not VAT registered — nothing to file"
        />
        <HubCard
          icon={<FileSpreadsheet size={20} />}
          title="IRP5 / Employee tax certificates"
          description="IRP5s are generated automatically from your Payroll records once you process payslips."
          action={
            <Button size="sm" variant="secondary" onClick={() => navigate('/upgrade')}>
              <Lock size={14} /> Unlock with Builder
            </Button>
          }
          available={false}
          unavailableNote="Needs the Payroll module"
        />
        <HubCard
          icon={<ExternalLink size={20} />}
          title="SARS eFiling"
          description="Submit your actual return on the official SARS eFiling website using the figures calculated here."
          action={
            <a href="https://www.sarsefiling.co.za" target="_blank" rel="noreferrer">
              <Button size="sm" variant="secondary">
                Open eFiling <ExternalLink size={14} />
              </Button>
            </a>
          }
          available
        />
      </div>

      <Card className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Calculator size={18} className="text-brand-green" />
          <h3 className="font-display font-bold text-brand-navy">
            {isCorporate ? 'Company income tax estimate' : 'Provisional & income tax estimate'}
          </h3>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          {isCorporate
            ? `Companies and CCs pay a flat ${CORPORATE_TAX_RATE * 100}% on taxable profit.`
            : 'Estimated from your annualised net profit using the current SARS individual tax table. Override it below if you have other income or deductions to account for.'}
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <Field label="Tax year">
            <Select value={taxYear} onChange={(e) => setTaxYear(e.target.value)}>
              <option value="2027">2027 (1 Mar 2026 - 28 Feb 2027)</option>
              <option value="2026">2026 (1 Mar 2025 - 28 Feb 2026)</option>
            </Select>
          </Field>
          <Field label="Estimated annual taxable income" hint="Auto-calculated from your recorded income, editable">
            <Input
              type="number"
              value={Math.round(taxableIncome)}
              onChange={(e) => setAnnualIncomeOverride(Number(e.target.value))}
            />
          </Field>
          {!isCorporate && (
            <Field label="Age band">
              <Select value={company.ownerAgeBand} disabled>
                <option value="under_65">Under 65</option>
                <option value="65_to_74">65 to 74</option>
                <option value="75_plus">75 and older</option>
              </Select>
            </Field>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Stat label="Estimated annual tax" value={formatCurrency(provisional.annualTaxEstimate)} />
          <Stat label="Set aside per month" value={formatCurrency(provisional.monthlyProvisionToSetAside)} hint="Helps avoid a shock bill" />
          <Stat label="Effective rate" value={taxableIncome > 0 ? `${round2((provisional.annualTaxEstimate / taxableIncome) * 100)}%` : '0%'} />
        </div>

        {!isCorporate && deadlines && (
          <div className="mt-5 pt-5 border-t border-gray-100">
            <h4 className="font-display font-bold text-sm text-brand-navy mb-3 flex items-center gap-1.5">
              <CalendarClock size={16} /> Provisional tax payment schedule
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <DeadlineRow label="1st period (50% of estimate)" date={deadlines.firstPeriod} amount={provisional.firstPeriodPayment} />
              <DeadlineRow label="2nd period (remaining 50%)" date={deadlines.secondPeriod} amount={provisional.secondPeriodPayment} />
              <DeadlineRow label="Voluntary top-up (avoids interest)" date={deadlines.voluntaryTopUp} amount={0} />
            </div>
            <p className="text-xs text-gray-400 mt-3">
              You're a provisional taxpayer if you earn business income outside of a normal salary. Underestimating your second payment by more than 20% can trigger a SARS penalty.
            </p>
          </div>
        )}
      </Card>

      {!isCorporate && (
        <Card>
          <h3 className="font-display font-bold text-brand-navy mb-3">{taxYear} individual tax brackets</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100">
                <th className="py-2">Taxable income</th>
                <th className="py-2 text-right">Tax rate</th>
              </tr>
            </thead>
            <tbody>
              {table.brackets.map((b) => (
                <tr key={b.min} className="border-b border-gray-50">
                  <td className="py-2">
                    {formatCurrency(b.min)} – {b.max ? formatCurrency(b.max) : 'and above'}
                  </td>
                  <td className="py-2 text-right">{b.rate * 100}%</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-gray-400 mt-3">
            Primary rebate {formatCurrency(table.primaryRebate)} · Tax-free threshold {formatCurrency(table.thresholdUnder65)} (under 65)
            <HelpTip text="Source: SARS Rates of Tax for Individuals, sars.gov.za. Rates change every Budget Speech — always confirm against the live SARS table before filing." />
          </p>
        </Card>
      )}
    </div>
  );
}

function HubCard({ icon, title, description, action, available, unavailableNote }: { icon: React.ReactNode; title: string; description: string; action: React.ReactNode; available: boolean; unavailableNote?: string }) {
  return (
    <Card className={!available ? 'opacity-70' : ''}>
      <div className="w-10 h-10 rounded-lg bg-brand-green/10 flex items-center justify-center text-brand-green mb-3">{icon}</div>
      <h3 className="font-display font-bold text-brand-navy mb-1">{title}</h3>
      <p className="text-sm text-gray-500 mb-3">{description}</p>
      {!available && unavailableNote && <p className="text-xs text-gray-400 mb-2">{unavailableNote}</p>}
      {action}
    </Card>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <div className="text-xs text-gray-400 mb-1">{label}</div>
      <div className="font-display font-bold text-lg text-brand-navy">{value}</div>
      {hint && <div className="text-xs text-gray-400 mt-0.5">{hint}</div>}
    </div>
  );
}

function DeadlineRow({ label, date, amount }: { label: string; date: string; amount: number }) {
  const isPast = date < todayIso();
  return (
    <div className={`rounded-lg p-3 border ${isPast ? 'border-gray-200 bg-gray-50' : 'border-brand-green/30 bg-brand-green/5'}`}>
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className="font-semibold text-brand-navy">{formatDate(date)}</div>
      {amount > 0 && <div className="text-sm text-brand-green font-medium">{formatCurrency(amount)}</div>}
    </div>
  );
}
