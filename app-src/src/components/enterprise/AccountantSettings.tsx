import React, { useState } from 'react';
import { Briefcase, Save } from 'lucide-react';
import { Button, Card, Field, Input, Toggle } from '../common/ui';
import { getAccountant, setAccountant, getPractice, setPractice } from '../../core/accountant';

/** Settings → My accountant: who keeps this business's books. */
export function AccountantSettings({ companyId }: { companyId: string }) {
  const start = getAccountant(companyId);
  const [a, setA] = useState(start);
  const [saved, setSaved] = useState(false);
  const set = (k: keyof typeof a, v: any) => setA({ ...a, [k]: v });

  return (
    <Card>
      <h3 className="font-semibold text-brand-navy mb-1 flex items-center gap-2">
        <Briefcase size={16} /> My accountant
      </h3>
      <p className="text-sm text-gray-500 mb-4">
        Used for <strong>Send to my accountant</strong>. Don't have an accountant? <a href="https://setwelbusiness.co.za/find-an-accountant.html" target="_blank" rel="noreferrer" className="underline">Find a Setwel partner accountant</a>.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Accounting firm">
          <Input value={a.firm} onChange={(e) => set('firm', e.target.value)} />
        </Field>
        <Field label="Accountant's name">
          <Input value={a.name} onChange={(e) => set('name', e.target.value)} />
        </Field>
        <Field label="Email">
          <Input type="email" value={a.email} onChange={(e) => set('email', e.target.value)} />
        </Field>
        <Field label="Phone">
          <Input value={a.phone} onChange={(e) => set('phone', e.target.value)} />
        </Field>
      </div>
      <Toggle checked={a.onInvoices} onChange={(v) => set('onInvoices', v)} label='Show "Books kept with ..." at the bottom of my invoices' />
      <div className="mt-4">
        <Button
          onClick={() => {
            setAccountant(companyId, a);
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
          }}
        >
          <Save size={15} /> {saved ? 'Saved' : 'Save'}
        </Button>
      </div>
    </Card>
  );
}

/** Settings → My practice (Accountant Partner): your firm's details and logo for reports you prepare. */
export function PracticeSettings() {
  const [p, setP] = useState(getPractice());
  const [saved, setSaved] = useState(false);
  const set = (k: keyof typeof p, v: any) => setP({ ...p, [k]: v });

  function logo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => set('logo', reader.result as string);
    reader.readAsDataURL(file);
  }

  return (
    <Card>
      <h3 className="font-semibold text-brand-navy mb-1 flex items-center gap-2">
        <Briefcase size={16} /> My practice
      </h3>
      <p className="text-sm text-gray-500 mb-4">
        Your firm's name and logo go on the reports you prepare for clients. New client files get your firm as their accountant, so "Books kept with your
        firm" appears on their invoices.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Firm name">
          <Input value={p.firm} onChange={(e) => set('firm', e.target.value)} />
        </Field>
        <Field label="Your name">
          <Input value={p.name} onChange={(e) => set('name', e.target.value)} />
        </Field>
        <Field label="Email">
          <Input type="email" value={p.email} onChange={(e) => set('email', e.target.value)} />
        </Field>
        <Field label="Phone">
          <Input value={p.phone} onChange={(e) => set('phone', e.target.value)} />
        </Field>
      </div>
      <Field label="Logo" hint="PNG or JPG">
        <input type="file" accept="image/png,image/jpeg" onChange={logo} className="text-sm" />
        {p.logo && <img src={p.logo} alt="" className="mt-2 h-14 object-contain border border-gray-200 rounded" />}
      </Field>
      <Button
        onClick={() => {
          setPractice(p);
          setSaved(true);
          setTimeout(() => setSaved(false), 2000);
        }}
      >
        <Save size={15} /> {saved ? 'Saved' : 'Save'}
      </Button>
    </Card>
  );
}
