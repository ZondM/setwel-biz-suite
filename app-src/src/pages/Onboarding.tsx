import React, { useState } from 'react';
import { Check, ArrowRight, ArrowLeft } from 'lucide-react';
import { PACKAGES } from '../core/packages';
import { Button, Card, Field, Input, Select, Toggle } from '../components/common/ui';
import { useApp } from '../state/AppContext';
import { createCompany, ensureDefaultCategories } from '../db/repository';
import { seedDemoData } from '../db/sampleData';
import { BusinessType, Company, PackageTier } from '../core/types';
import { todayIso } from '../core/numbering';
import { useNavigate } from 'react-router-dom';
import { applyPracticeToClient } from '../core/accountant';

const PROVINCES = [
  'Eastern Cape', 'Free State', 'Gauteng', 'KwaZulu-Natal', 'Limpopo', 'Mpumalanga', 'Northern Cape', 'North West', 'Western Cape'
];

type Step = 'welcome' | 'package' | 'company' | 'finish';

/** mode "add": adding another business or client file to an existing install. */
export default function Onboarding({ mode = 'first' }: { mode?: 'first' | 'add' }) {
  const { setCompany, bumpRefresh, company: current, setAddingBusiness, setUser } = useApp();
  const adding = mode === 'add';
  const [step, setStep] = useState<Step>(adding ? 'company' : 'welcome');
  const [selectedTier, setSelectedTier] = useState<PackageTier>(current?.packageTier ?? 'hustler');
  const [created, setCreated] = useState<Company | null>(null);
  const isPartner = current?.packageTier === 'accountant_partner';
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-brand-panel flex flex-col">
      <header className="px-8 py-5 flex items-center gap-2">
        <img src="./setwel-logo.png" alt="" className="w-8 h-8 rounded-lg" />
        <span className="font-display font-bold text-brand-navy">Setwel <span className="text-brand-green">Biz Suite</span></span>
      </header>

      {step === 'welcome' && <Welcome onNext={() => setStep('package')} />}
      {step === 'package' && (
        <PackageStep
          selected={selectedTier}
          onSelect={setSelectedTier}
          onNext={() => setStep('company')}
          onBack={() => setStep('welcome')}
        />
      )}
      {adding && step === 'company' && (
        <p className="text-center text-sm text-gray-500 -mb-2">
          {isPartner ? 'Add a client. Their books are kept separate from your other clients.' : 'Add another business or branch. Its books are kept separate.'}
        </p>
      )}
      {step === 'company' && (
        <CompanyStep
          tier={selectedTier}
          onBack={() => (adding ? setAddingBusiness(false) : setStep('package'))}
          onDone={(company) => {
            if (adding) {
              if (isPartner) applyPracticeToClient(company.id);
              setUser(null);
              setCompany(company);
              setAddingBusiness(false);
              navigate('/dashboard');
              return;
            }
            // Keep showing onboarding until the last step; the app opens once setCompany runs.
            setCreated(company);
            setStep('finish');
          }}
        />
      )}
      {step === 'finish' && created && (
        <FinishStep
          company={created}
          onLoadDemo={(companyId) => {
            seedDemoData(companyId);
            setCompany(created);
            bumpRefresh();
            navigate('/dashboard');
          }}
          onSkip={() => {
            setCompany(created);
            navigate('/dashboard');
          }}
        />
      )}
    </div>
  );
}

function Welcome({ onNext }: { onNext: () => void }) {
  return (
    <div className="flex-1 flex items-center justify-center px-6">
      <div className="max-w-xl text-center">
        <h1 className="font-display text-3xl font-extrabold text-brand-navy mb-3">
          Your business finances, <span className="text-brand-green">handled with confidence.</span>
        </h1>
        <p className="text-gray-600 mb-8">
          Quotes, invoices, expenses, VAT and tax figures in one place, built for South African businesses. Setwel reminds your customers to pay, reads your receipts and tells you what's due. Works without internet.
        </p>
        <Button size="lg" onClick={onNext}>
          Get started <ArrowRight size={18} />
        </Button>
        <p className="text-xs text-gray-400 mt-4">Free for 30 days. No card needed.</p>
      </div>
    </div>
  );
}

function PackageStep({ selected, onSelect, onNext, onBack }: { selected: PackageTier; onSelect: (t: PackageTier) => void; onNext: () => void; onBack: () => void }) {
  return (
    <div className="flex-1 px-6 py-8 max-w-6xl mx-auto w-full">
      <h2 className="font-display text-2xl font-bold text-brand-navy text-center mb-1">Choose the package that fits your business today</h2>
      <p className="text-center text-gray-500 mb-8 text-sm">You can upgrade any time as you grow. All prices in ZAR.</p>
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {PACKAGES.map((pkg) => (
          <Card
            key={pkg.tier}
            className={`cursor-pointer flex flex-col gap-3 transition-all ${selected === pkg.tier ? 'border-brand-green ring-2 ring-brand-green' : 'hover:border-gray-300'}`}
            padded
          >
            <div onClick={() => onSelect(pkg.tier)}>
              <div className="font-display font-bold text-brand-navy">{pkg.name}</div>
              <div className="text-xs text-gray-400 mb-2">{pkg.tagline}</div>
              <div className="font-display text-xl font-extrabold text-brand-green mb-3">{pkg.priceMonthly}</div>
              <ul className="space-y-1.5 text-xs text-gray-600">
                {pkg.features.slice(0, 5).map((f) => (
                  <li key={f} className="flex gap-1.5">
                    <Check size={14} className="text-brand-green shrink-0 mt-0.5" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
            <Button variant={selected === pkg.tier ? 'primary' : 'secondary'} size="sm" onClick={() => onSelect(pkg.tier)} className="mt-auto">
              {selected === pkg.tier ? 'Selected' : 'Choose'}
            </Button>
          </Card>
        ))}
      </div>
      <div className="flex justify-between mt-8">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft size={16} /> Back
        </Button>
        <Button onClick={onNext}>
          Continue with {PACKAGES.find((p) => p.tier === selected)?.name} <ArrowRight size={16} />
        </Button>
      </div>
    </div>
  );
}

function CompanyStep({ tier, onBack, onDone }: { tier: PackageTier; onBack: () => void; onDone: (c: any) => void }) {
  const [name, setName] = useState('');
  const [businessType, setBusinessType] = useState<BusinessType>('sole_proprietor');
  const [cipc, setCipc] = useState('');
  const [vatRegistered, setVatRegistered] = useState(false);
  const [vatNumber, setVatNumber] = useState('');
  const [industry, setIndustry] = useState('');
  const [province, setProvince] = useState('Gauteng');
  const [bankName, setBankName] = useState('');
  const [bankAccountHolder, setBankAccountHolder] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [bankBranchCode, setBankBranchCode] = useState('');
  const [fyMonth, setFyMonth] = useState(3);

  const canSubmit = name.trim().length > 0;

  function handleSubmit() {
    const company = createCompany({
      name: name.trim(),
      businessType,
      cipcNumber: cipc || undefined,
      vatNumber: vatRegistered ? vatNumber : undefined,
      isVatRegistered: vatRegistered,
      vatPeriod: 'bi_monthly',
      industry: industry || undefined,
      province,
      bankName: bankName || undefined,
      bankAccountHolder: bankAccountHolder || undefined,
      bankAccountNumber: bankAccountNumber || undefined,
      bankBranchCode: bankBranchCode || undefined,
      financialYearStartMonth: fyMonth,
      packageTier: tier,
      trialStartDate: todayIso(),
      ownerAgeBand: 'under_65'
    });
    ensureDefaultCategories(company.id);
    onDone(company);
  }

  return (
    <div className="flex-1 px-6 py-8 max-w-2xl mx-auto w-full">
      <h2 className="font-display text-2xl font-bold text-brand-navy mb-1">Tell us about your business</h2>
      <p className="text-gray-500 text-sm mb-6">This takes about two minutes. You can change any of this later in Settings.</p>
      <Card>
        <Field label="Business name" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Thabo's Electrical Services" />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Business type" required>
            <Select value={businessType} onChange={(e) => setBusinessType(e.target.value as BusinessType)}>
              <option value="sole_proprietor">Sole Proprietor</option>
              <option value="partnership">Partnership</option>
              <option value="pty_ltd">(Pty) Ltd</option>
              <option value="cc">CC</option>
              <option value="npo">NPO</option>
            </Select>
          </Field>
          <Field label="CIPC registration number" hint="Optional">
            <Input value={cipc} onChange={(e) => setCipc(e.target.value)} placeholder="e.g. 2021/123456/07" />
          </Field>
        </div>
        <Field label="Is this business VAT registered?">
          <Toggle checked={vatRegistered} onChange={setVatRegistered} label={vatRegistered ? 'Yes, VAT registered' : 'Not yet registered'} />
        </Field>
        {vatRegistered && (
          <Field label="VAT registration number" required>
            <Input value={vatNumber} onChange={(e) => setVatNumber(e.target.value)} placeholder="10-digit VAT number" />
          </Field>
        )}
        <div className="grid grid-cols-2 gap-4">
          <Field label="Industry" hint="Optional">
            <Input value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="e.g. Electrical services" />
          </Field>
          <Field label="Province" required>
            <Select value={province} onChange={(e) => setProvince(e.target.value)}>
              {PROVINCES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Financial year start month">
            <Select value={fyMonth} onChange={(e) => setFyMonth(Number(e.target.value))}>
              {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <h3 className="font-display font-bold text-sm text-brand-navy mt-2 mb-3">Banking details (shown on your invoices)</h3>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Bank name" hint="Optional">
            <Input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="e.g. Capitec Business" />
          </Field>
          <Field label="Account holder" hint="Optional">
            <Input value={bankAccountHolder} onChange={(e) => setBankAccountHolder(e.target.value)} />
          </Field>
          <Field label="Account number" hint="Optional">
            <Input value={bankAccountNumber} onChange={(e) => setBankAccountNumber(e.target.value)} />
          </Field>
          <Field label="Branch code" hint="Optional">
            <Input value={bankBranchCode} onChange={(e) => setBankBranchCode(e.target.value)} />
          </Field>
        </div>
      </Card>
      <div className="flex justify-between mt-6">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft size={16} /> Back
        </Button>
        <Button disabled={!canSubmit} onClick={handleSubmit}>
          Finish setup <ArrowRight size={16} />
        </Button>
      </div>
    </div>
  );
}

function FinishStep({ company, onLoadDemo, onSkip }: { company: Company; onLoadDemo: (companyId: string) => void; onSkip: () => void }) {
  return (
    <div className="flex-1 flex items-center justify-center px-6">
      <div className="max-w-lg text-center">
        <div className="w-14 h-14 rounded-full bg-brand-green/10 flex items-center justify-center mx-auto mb-4">
          <Check className="text-brand-green" size={28} />
        </div>
        <h2 className="font-display text-2xl font-bold text-brand-navy mb-2">You're ready, {company?.name?.split(' ')[0] || 'there'}!</h2>
        <p className="text-gray-500 text-sm mb-8">
          Here's what most people do first: create your first customer, send a quote, and check your dashboard. Want to explore with realistic sample data first?
        </p>
        <div className="flex flex-col gap-3 items-center">
          <Button size="lg" onClick={() => company && onLoadDemo(company.id)}>
            Load sample data (Thabo's Electrical Services)
          </Button>
          <Button variant="ghost" onClick={onSkip}>
            Skip — I'll start with my own data
          </Button>
        </div>
      </div>
    </div>
  );
}
