import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Save } from 'lucide-react';
import { useApp } from '../state/AppContext';
import { SupplierModal } from './Suppliers';
import { Button, Card, PageHeader, Field, Select, Input } from '../components/common/ui';
import { DocumentItemsEditor } from '../components/common/DocumentItemsEditor';
import { listSuppliers, listBills, saveBill, getNextBillNumber } from '../db/repository';
import { calculateDocumentTotals } from '../core/financialEngine';
import { addDays, todayIso, uid } from '../core/numbering';
import { LineItem } from '../core/types';

export default function BillEditor() {
  const { company, bumpRefresh } = useApp();
  const navigate = useNavigate();
  const { id } = useParams();
  const isNew = !id;

  const suppliers = company ? listSuppliers(company.id) : [];
  const [addingSupplier, setAddingSupplier] = useState(false);
  const existing = id && company ? listBills(company.id).find((b) => b.id === id) ?? null : null;

  const [supplierId, setSupplierId] = useState(existing?.supplierId ?? suppliers[0]?.id ?? '');
  const [billDate, setBillDate] = useState(existing?.billDate ?? todayIso());
  const [dueDate, setDueDate] = useState(existing?.dueDate ?? addDays(todayIso(), 30));
  const [items, setItems] = useState<LineItem[]>(existing?.items ?? []);

  if (!company) return null;

  function handleSave() {
    if (!supplierId || items.length === 0) {
      window.alert('Choose a supplier and add at least one line item.');
      return;
    }
    const totals = calculateDocumentTotals(items);
    saveBill({
      id: existing?.id ?? uid('bill_'),
      companyId: company!.id,
      supplierId,
      billNumber: existing?.billNumber ?? getNextBillNumber(company!.id, 'BILL'),
      billDate,
      dueDate,
      status: existing?.status ?? 'sent',
      items,
      ...totals,
      amountPaid: existing?.amountPaid ?? 0
    });
    bumpRefresh();
    navigate('/bills');
  }

  return (
    <div>
      <button onClick={() => navigate('/bills')} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-brand-navy mb-4">
        <ArrowLeft size={15} /> Back to bills
      </button>
      <PageHeader title={isNew ? 'Record a bill' : `Bill ${existing?.billNumber ?? ''}`} subtitle="A bill is an invoice you've received from a supplier" />

      <Card>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Supplier" required>
            <Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
              {suppliers.length === 0 && <option value="">No suppliers yet</option>}
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
            <button type="button" onClick={() => setAddingSupplier(true)} className="mt-1.5 flex items-center gap-1 text-sm font-semibold text-brand-green hover:underline">
              <Plus size={14} /> Add new supplier
            </button>
          </Field>
          <Field label="Bill date">
            <Input type="date" value={billDate} onChange={(e) => setBillDate(e.target.value)} />
          </Field>
          <Field label="Due date">
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </Field>
        </div>

        <h3 className="font-display font-bold text-sm text-brand-navy mt-2 mb-3">Line items</h3>
        <DocumentItemsEditor items={items} onChange={setItems} vatRegistered={company.isVatRegistered} />
      </Card>

      <div className="flex gap-2 mt-5">
        <Button onClick={handleSave}>
          <Save size={16} /> Save bill
        </Button>
      </div>
      <SupplierModal
        open={addingSupplier}
        onClose={() => setAddingSupplier(false)}
        editing={null}
        companyId={company!.id}
        onSaved={(s) => {
          setAddingSupplier(false);
          setSupplierId(s.id);
          bumpRefresh();
        }}
      />
    </div>
  );
}
