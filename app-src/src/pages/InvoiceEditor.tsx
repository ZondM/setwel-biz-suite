import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Save, Send } from 'lucide-react';
import { useApp } from '../state/AppContext';
import { CustomerModal } from './Customers';
import { Button, Card, PageHeader, Field, Select, Input, Textarea, StatusBadge } from '../components/common/ui';
import { DocumentItemsEditor } from '../components/common/DocumentItemsEditor';
import { listCustomers, getInvoice, saveInvoice, getNextInvoiceNumber, getSetting } from '../db/repository';
import { calculateDocumentTotals } from '../core/financialEngine';
import { addDays, todayIso, uid } from '../core/numbering';
import { LineItem, DocStatus } from '../core/types';

export default function InvoiceEditor() {
  const { company, bumpRefresh } = useApp();
  const navigate = useNavigate();
  const { id } = useParams();
  const isNew = !id;

  const customers = company ? listCustomers(company!.id) : [];
  const [addingCustomer, setAddingCustomer] = useState(false);
  const existing = id ? getInvoice(id) : null;

  const [customerId, setCustomerId] = useState(existing?.customerId ?? customers[0]?.id ?? '');
  const [invoiceDate, setInvoiceDate] = useState(existing?.invoiceDate ?? todayIso());
  const [dueDate, setDueDate] = useState(existing?.dueDate ?? addDays(todayIso(), 30));
  const [items, setItems] = useState<LineItem[]>(existing?.items ?? []);
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [status] = useState<DocStatus>(existing?.status ?? 'draft');

  useEffect(() => {
    if (!customerId && customers.length > 0) setCustomerId(customers[0].id);
  }, [customers.length]);

  if (!company) return null;
  const selectedCustomer = customers.find((c) => c.id === customerId);

  function persist(newStatus: DocStatus) {
    if (!customerId || items.length === 0) {
      window.alert('Add a customer and at least one line item first.');
      return null;
    }
    const totals = calculateDocumentTotals(items);
    const invoiceId = existing?.id ?? uid('inv_');
    const saved = saveInvoice({
      id: invoiceId,
      companyId: company!.id,
      customerId,
      quoteId: existing?.quoteId,
      invoiceNumber: existing?.invoiceNumber ?? getNextInvoiceNumber(company!.id, getSetting(company!.id, 'invoicePrefix') || 'INV'),
      invoiceDate,
      dueDate,
      status: existing?.amountPaid ? existing.status : newStatus,
      items,
      ...totals,
      amountPaid: existing?.amountPaid ?? 0,
      notes,
      customerVatRegistered: selectedCustomer?.isVatRegistered ?? false
    });
    bumpRefresh();
    return saved;
  }

  function handleSaveDraft() {
    const saved = persist('draft');
    if (saved) navigate('/invoices');
  }

  function handleSaveAndSend() {
    const saved = persist('sent');
    if (saved) navigate(`/invoices/${saved.id}`);
  }

  return (
    <div>
      <button onClick={() => navigate('/invoices')} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-brand-navy mb-4">
        <ArrowLeft size={15} /> Back to invoices
      </button>
      <PageHeader title={isNew ? 'New invoice' : `Invoice ${existing?.invoiceNumber ?? ''}`} actions={!isNew ? <StatusBadge status={status} /> : undefined} />

      <Card>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Customer" required>
            <Select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              {customers.length === 0 && <option value="">No customers yet</option>}
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            <button type="button" onClick={() => setAddingCustomer(true)} className="mt-1.5 flex items-center gap-1 text-sm font-semibold text-brand-green hover:underline">
              <Plus size={14} /> Add new customer
            </button>
          </Field>
          <Field label="Invoice date">
            <Input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
          </Field>
          <Field label="Due date">
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </Field>
        </div>

        <h3 className="font-display font-bold text-sm text-brand-navy mt-2 mb-3">Line items</h3>
        <DocumentItemsEditor items={items} onChange={setItems} vatRegistered={company!.isVatRegistered} />

        <Field label="Notes (shown on the PDF)">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Banking details are added automatically from Settings." />
        </Field>
      </Card>

      <div className="flex gap-2 mt-5">
        <Button variant="secondary" onClick={handleSaveDraft}>
          <Save size={16} /> Save as draft
        </Button>
        <Button onClick={handleSaveAndSend}>
          <Send size={16} /> Save & view invoice
        </Button>
      </div>
      <CustomerModal
        open={addingCustomer}
        onClose={() => setAddingCustomer(false)}
        editing={null}
        companyId={company!.id}
        onSaved={(c) => {
          setAddingCustomer(false);
          setCustomerId(c.id);
          bumpRefresh();
        }}
      />
    </div>
  );
}
