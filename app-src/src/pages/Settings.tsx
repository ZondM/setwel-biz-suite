import React, { useState } from 'react';
import { Building2, Tag, Hash, Package, Save, Shield } from 'lucide-react';
import { useApp } from '../state/AppContext';
import { updateCompany, listCategories, saveCategory, deleteCategory, getSettings, setSetting } from '../db/repository';
import { Button, Card, PageHeader, Field, Input, Select, Toggle, Tabs } from '../components/common/ui';
import { ExpenseCategory } from '../core/types';
import { PinSetup, DataSafetyCard } from '../components/common/SecurityGates';

const SA_PROVINCES = [
  'Eastern Cape','Free State','Gauteng','KwaZulu-Natal',
  'Limpopo','Mpumalanga','Northern Cape','North West','Western Cape'
];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const BUSINESS_TYPES = ['sole_proprietor','private_company','close_corporation','partnership','trust','non_profit'];
const BUSINESS_TYPE_LABELS: Record<string,string> = {
  sole_proprietor: 'Sole Proprietor', private_company: 'Private Company (Pty) Ltd',
  close_corporation: 'Close Corporation (CC)', partnership: 'Partnership',
  trust: 'Trust', non_profit: 'Non-Profit Organisation'
};

const TABS = [
  { id: 'company', label: 'Company' },
  { id: 'categories', label: 'Categories' },
  { id: 'numbering', label: 'Numbering' },
  { id: 'package', label: 'Package' },
  { id: 'security', label: 'Security & Privacy' }
];

export default function SettingsPage() {
  const { company, reloadCompany } = useApp();
  const [activeTab, setActiveTab] = useState('company');
  if (!company) return null;

  return (
    <div className="max-w-3xl">
      <PageHeader title="Settings" subtitle="Manage your business information and preferences" />
      <Tabs tabs={TABS} active={activeTab} onChange={setActiveTab} className="mb-6" />
      {activeTab === 'company' && <CompanyTab companyId={company.id} company={company} onSaved={reloadCompany} />}
      {activeTab === 'categories' && <CategoriesTab companyId={company.id} />}
      {activeTab === 'numbering' && <NumberingTab companyId={company.id} />}
      {activeTab === 'package' && <PackageTab />}
      {activeTab === 'security' && <SecurityTab companyId={company.id} />}
    </div>
  );
}

function CompanyTab({ companyId, company, onSaved }: { companyId: string; company: NonNullable<ReturnType<typeof useApp>['company']>; onSaved: () => void }) {
  const [name, setName] = useState(company.name);
  const [businessType, setBusinessType] = useState(company.businessType);
  const [cipcNumber, setCipcNumber] = useState(company.cipcNumber ?? '');
  const [isVatRegistered, setIsVatRegistered] = useState(company.isVatRegistered);
  const [vatNumber, setVatNumber] = useState(company.vatNumber ?? '');
  const [industry, setIndustry] = useState(company.industry ?? '');
  const [province, setProvince] = useState(company.province ?? '');
  const [fyStartMonth, setFyStartMonth] = useState(company.financialYearStartMonth);
  const [bankName, setBankName] = useState(company.bankName ?? '');
  const [bankHolder, setBankHolder] = useState(company.bankAccountHolder ?? '');
  const [bankAccount, setBankAccount] = useState(company.bankAccountNumber ?? '');
  const [bankBranch, setBankBranch] = useState(company.bankBranchCode ?? '');
  const [saved, setSaved] = useState(false);

  function handleSave() {
    if (!name.trim()) return;
    updateCompany(companyId, {
      name: name.trim(), businessType, cipcNumber: cipcNumber || undefined,
      isVatRegistered, vatNumber: isVatRegistered ? (vatNumber || undefined) : undefined,
      industry: industry || undefined, province: province || undefined,
      financialYearStartMonth: fyStartMonth,
      bankName: bankName || undefined, bankAccountHolder: bankHolder || undefined,
      bankAccountNumber: bankAccount || undefined, bankBranchCode: bankBranch || undefined
    });
    onSaved();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="space-y-5">
      <Card>
        <h3 className="font-semibold text-brand-navy mb-4 flex items-center gap-2"><Building2 size={16} /> Business Information</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Field label="Business name"><Input value={name} onChange={e => setName(e.target.value)} /></Field>
          </div>
          <Field label="Business type">
            <Select value={businessType} onChange={e => setBusinessType(e.target.value as any)}>
              {BUSINESS_TYPES.map(t => <option key={t} value={t}>{BUSINESS_TYPE_LABELS[t]}</option>)}
            </Select>
          </Field>
          <Field label="CIPC / Reg. number">
            <Input value={cipcNumber} onChange={e => setCipcNumber(e.target.value)} placeholder="e.g. 2023/123456/07" />
          </Field>
          <Field label="Province">
            <Select value={province} onChange={e => setProvince(e.target.value)}>
              <option value="">Select province</option>
              {SA_PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
            </Select>
          </Field>
          <Field label="Industry">
            <Input value={industry} onChange={e => setIndustry(e.target.value)} placeholder="e.g. Construction" />
          </Field>
          <Field label="Financial year start">
            <Select value={fyStartMonth} onChange={e => setFyStartMonth(Number(e.target.value))}>
              {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </Select>
          </Field>
        </div>
      </Card>

      <Card>
        <h3 className="font-semibold text-brand-navy mb-3">VAT Registration</h3>
        <Toggle label="VAT registered" checked={isVatRegistered} onChange={setIsVatRegistered} />
        {isVatRegistered && (
          <div className="mt-3">
            <Field label="VAT number">
              <Input value={vatNumber} onChange={e => setVatNumber(e.target.value)} placeholder="4xxxxxxxxx" maxLength={10} />
            </Field>
          </div>
        )}
        {!isVatRegistered && (
          <p className="text-xs text-gray-400 mt-2">VAT registration is mandatory once turnover exceeds R1,000,000 in any rolling 12-month period.</p>
        )}
      </Card>

      <Card>
        <h3 className="font-semibold text-brand-navy mb-4">Banking Details</h3>
        <p className="text-xs text-gray-400 mb-3">These appear on invoices to make it easy for customers to pay you.</p>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Bank name">
            <Input value={bankName} onChange={e => setBankName(e.target.value)} placeholder="e.g. FNB" />
          </Field>
          <Field label="Branch code">
            <Input value={bankBranch} onChange={e => setBankBranch(e.target.value)} placeholder="e.g. 250655" />
          </Field>
          <Field label="Account holder">
            <Input value={bankHolder} onChange={e => setBankHolder(e.target.value)} />
          </Field>
          <Field label="Account number">
            <Input value={bankAccount} onChange={e => setBankAccount(e.target.value)} />
          </Field>
        </div>
      </Card>

      <Button variant="primary" onClick={handleSave}>
        <Save size={15} /> {saved ? '✓ Saved!' : 'Save changes'}
      </Button>
    </div>
  );
}

function CategoriesTab({ companyId }: { companyId: string }) {
  const [cats, setCats] = useState<ExpenseCategory[]>(() => listCategories(companyId));
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<'cost_of_sales' | 'operating'>('operating');

  function refresh() { setCats(listCategories(companyId)); }

  function handleAdd() {
    if (!newName.trim()) return;
    saveCategory({ companyId, name: newName.trim(), type: newType });
    setNewName('');
    refresh();
  }

  const cos = cats.filter(c => c.type === 'cost_of_sales');
  const ops = cats.filter(c => c.type === 'operating');

  return (
    <Card>
      <h3 className="font-semibold text-brand-navy mb-3 flex items-center gap-2"><Tag size={15}/> Expense Categories</h3>
      <p className="text-xs text-gray-400 mb-4">
        <strong>Cost of Sales</strong> categories reduce gross profit; <strong>Operating</strong> categories reduce net profit.
        These flow through to your Profit &amp; Loss report.
      </p>

      {cos.length > 0 && (
        <div className="mb-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Cost of Sales</p>
          {cos.map(c => <CategoryRow key={c.id} cat={c} onDelete={() => { deleteCategory(c.id); refresh(); }} />)}
        </div>
      )}
      {ops.length > 0 && (
        <div className="mb-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Operating Expenses</p>
          {ops.map(c => <CategoryRow key={c.id} cat={c} onDelete={() => { deleteCategory(c.id); refresh(); }} />)}
        </div>
      )}

      <div className="border-t pt-4 mt-2 flex gap-2 items-end">
        <div className="flex-1">
          <Field label="New category name">
            <Input value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAdd()} placeholder="e.g. Printing & Stationery" />
          </Field>
        </div>
        <div className="w-40">
          <Field label="Type">
            <Select value={newType} onChange={e => setNewType(e.target.value as any)}>
              <option value="operating">Operating</option>
              <option value="cost_of_sales">Cost of Sales</option>
            </Select>
          </Field>
        </div>
        <Button variant="primary" size="sm" onClick={handleAdd}>Add</Button>
      </div>
    </Card>
  );
}

function CategoryRow({ cat, onDelete }: { cat: ExpenseCategory; onDelete: () => void }) {
  return (
    <div className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-gray-50 group">
      <span className="text-sm">{cat.name}</span>
      {!cat.isDefault && (
        <button onClick={onDelete} className="text-red-400 opacity-0 group-hover:opacity-100 text-xs hover:text-red-600 transition-opacity">
          Remove
        </button>
      )}
      {cat.isDefault && <span className="text-xs text-gray-300">default</span>}
    </div>
  );
}

function NumberingTab({ companyId }: { companyId: string }) {
  const settings = getSettings(companyId);
  const [invPrefix, setInvPrefix] = useState(settings['invoicePrefix'] ?? 'INV');
  const [quoPrefix, setQuoPrefix] = useState(settings['quotePrefix'] ?? 'QUO');
  const [billPrefix, setBillPrefix] = useState(settings['billPrefix'] ?? 'BILL');
  const [saved, setSaved] = useState(false);

  function handleSave() {
    setSetting(companyId, 'invoicePrefix', invPrefix || 'INV');
    setSetting(companyId, 'quotePrefix', quoPrefix || 'QUO');
    setSetting(companyId, 'billPrefix', billPrefix || 'BILL');
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <Card>
      <h3 className="font-semibold text-brand-navy mb-3 flex items-center gap-2"><Hash size={15}/> Document Numbering</h3>
      <p className="text-xs text-gray-400 mb-4">Prefixes are used to generate sequential document numbers, e.g. <strong>INV-0001</strong>.</p>
      <div className="space-y-3 max-w-xs">
        <Field label="Invoice prefix">
          <Input value={invPrefix} onChange={e => setInvPrefix(e.target.value.toUpperCase())} maxLength={8} />
        </Field>
        <Field label="Quote prefix">
          <Input value={quoPrefix} onChange={e => setQuoPrefix(e.target.value.toUpperCase())} maxLength={8} />
        </Field>
        <Field label="Bill prefix">
          <Input value={billPrefix} onChange={e => setBillPrefix(e.target.value.toUpperCase())} maxLength={8} />
        </Field>
      </div>
      <div className="mt-4">
        <Button variant="primary" onClick={handleSave}>
          <Save size={15} /> {saved ? '✓ Saved!' : 'Save prefixes'}
        </Button>
      </div>
      <p className="text-xs text-amber-600 mt-3">⚠ Changing prefixes only affects new documents — existing numbers will not change.</p>
    </Card>
  );
}


function SecurityTab({ companyId }: { companyId: string }) {
  return (
    <div className="space-y-5">
      <Card>
        <h3 className="font-semibold text-brand-navy mb-4 flex items-center gap-2">
          <Shield size={15}/> App Lock (PIN)
        </h3>
        <PinSetup companyId={companyId} />
      </Card>
      <Card>
        <h3 className="font-semibold text-brand-navy mb-4 flex items-center gap-2">
          <Shield size={15}/> Data Privacy & Safety
        </h3>
        <DataSafetyCard />
        <div className="mt-4 text-xs text-gray-500 space-y-1">
          <p>© {new Date().getFullYear()} Setwel Africa (Pty) Ltd. All rights reserved.</p>
          <p>Setwel Africa Business Suite is protected under South African copyright law and the Copyright Act 98 of 1978. Unauthorised reproduction, distribution, reverse-engineering or resale is prohibited and will be prosecuted.</p>
          <p>Compliant with the Protection of Personal Information Act (POPIA) No. 4 of 2013.</p>
        </div>
      </Card>
    </div>
  );
}

function PackageTab() {
  const { company } = useApp();
  const tier = company?.packageTier ?? 'hustler';

  const tierLabel: Record<string,string> = {
    hustler: 'Hustler', grinder: 'Grinder', builder: 'Builder',
    enterprise: 'Enterprise', accountant_partner: 'Accountant Partner'
  };
  const tierColor: Record<string,string> = {
    hustler: 'text-gray-600 bg-gray-100',
    grinder: 'text-brand-green bg-green-50',
    builder: 'text-brand-navy bg-blue-50',
    enterprise: 'text-purple-700 bg-purple-50',
    accountant_partner: 'text-amber-700 bg-amber-50'
  };
  const tierDesc: Record<string,string> = {
    hustler: "Hustler: invoices, quotes, expenses, AI receipt scanning and reminders. Grinder adds suppliers, bills, VAT201, profit and loss and aged reports.",
    grinder: "Grinder: everything for a growing business. Builder adds bank statement matching and unlimited AI receipt scans.",
    builder: "Builder: bank statement matching and unlimited AI receipt scans. Payroll and stock are coming.",
    enterprise: "Enterprise: everything in Builder, plus setup, training and priority help.",
    accountant_partner: "Accountant Partner: your partner key runs Setwel for all your clients."
  };

  return (
    <Card>
      <h3 className="font-semibold text-brand-navy mb-4 flex items-center gap-2"><Package size={15}/> Your Current Plan</h3>
      <div className={`inline-flex items-center px-3 py-1.5 rounded-full font-semibold text-sm mb-3 ${tierColor[tier]}`}>
        {tierLabel[tier]}
      </div>
      <p className="text-sm text-gray-500 mb-5">{tierDesc[tier]}</p>
      {tier !== 'enterprise' && tier !== 'accountant_partner' && (
        <a href="#/upgrade" className="inline-flex items-center gap-2 px-4 py-2 bg-brand-gold text-brand-navy font-semibold rounded-lg hover:brightness-95 transition-all text-sm">
          View upgrade options →
        </a>
      )}
    </Card>
  );
}
