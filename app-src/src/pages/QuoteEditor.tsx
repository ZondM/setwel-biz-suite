import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRightCircle, Plus, Save, Send } from 'lucide-react';
import { useApp } from '../state/AppContext';
import { CustomerModal } from './Customers';
import { Button, Card, PageHeader, Field, Select, Input, Textarea, StatusBadge } from '../components/common/ui';
import { DocumentItemsEditor } from '../components/common/DocumentItemsEditor';
import { listCustomers, getQuote, saveQuote, getNextQuoteNumber, saveInvoice, getNextInvoiceNumber } from '../db/repository';
import { calculateDocumentTotals } from '../core/financialEngine';
import { addDays, todayIso, uid } from '../core/numbering';
import { LineItem, DocStatus } from '../core/types';

export default function QuoteEditor() {
  const { company, bumpRefresh } = useApp();
  const navigate = useNavigate();
  const { id } = useParams();
  const isNew = !id;

  const customers = company ? listCustomers(company!.id) : [];
  const [addingCustomer, setAddingCustomer] = useState(false);
  const existing = id ? getQuote(id) : null;

  const [customerId, setCustomerId] = useState(existing?.customerId ?? customers[0]?.id ?? '');
  const [quoteDate, setQuoteDate] = useState(existing?.quoteDate ?? todayIso());
  const [validUntil, setValidUntil] = useState(existing?.validUntil ?? addDays(todayIso(), 30));
  const [items, setItems] = useState<LineItem[]>(existing?.items ?? []);
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [status, setStatus] = useState<DocStatus>(existing?.status ?? 'draft');

  useEffect(() => {
    if (!customerId && customers.length > 0) setCustomerId(customers[0].id);
  }, [customers.length]);

  if (!company) return null;
  const selectedCustomer = customers.find((c) => c.id === customerId);

  function persist(newStatus?: DocStatus) {
    if (!customerId || items.length === 0) {
      window.alert('Add a customer and at least one line item first.');
      return null;
    }
    const totals = calculateDocumentTotals(items);
    const quoteId = existing?.id ?? uid('quo_');
    const saved = saveQuote({
      id: quoteId,
      companyId: company!.id,
      customerId,
      quoteNumber: existing?.quoteNumber ?? getNextQuoteNumber(company!.id, 'QUO'),
      quoteDate,
      validUntil,
      status: newStatus ?? status,
      items,
      ...totals,
      notes,
      customerVatRegistered: selectedCustomer?.isVatRegistered ?? false,
      convertedToInvoiceId: existing?.convertedToInvoiceId
    });
    bumpRefresh();
    return saved;
  }

  function handleSaveDraft() {
    const saved = persist('draft');
    if (saved) navigate('/quotes');
  }

  function handleMarkSent() {
    const saved = persist('sent');
    if (saved) {
      setStatus('sent');
      navigate('/quotes');
    }
  }

  function handleConvert() {
    const saved = persist();
    if (!saved) return;
    const totals = calculateDocumentTotals(saved.items);
    const invoiceId = uid('inv_');
    saveInvoice({
      id: invoiceId,
      companyId: company!.id,
      customerId: saved.customerId,
      quoteId: saved.id,
      invoiceNumber: getNextInvoiceNumber(company!.id, 'INV'),
      invoiceDate: todayIso(),
      dueDate: addDays(todayIso(), 30),
      status: 'sent',
      items: saved.items,
      ...totals,
      amountPaid: 0,
      notes: saved.notes,
      customerVatRegistered: saved.customerVatRegistered
    });
    saveQuote({ ...saved, status: 'converted', convertedToInvoiceId: invoiceId });
    bumpRefresh();
    navigate(`/invoices/${invoiceId}`);
  }

  return (
    <div>
      <button onClick={() => navigate('/quotes')} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-brand-navy mb-4">
        <ArrowLeft size={15} /> Back to quotes
      </button>
      <PageHeader
        title={isNew ? 'New quote' : `Quote ${existing?.quoteNumber ?? ''}`}
        subtitle={!isNew ? undefined : 'Send a quote, then convert it to an invoice in one click once the customer accepts.'}
        actions={!isNew ? <StatusBadge status={status} /> : undefined}
      />

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
          <Field label="Quote date">
            <Input type="date" value={quoteDate} onChange={(e) => setQuoteDate(e.target.value)} />
          </Field>
          <Field label="Valid until">
            <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
          </Field>
        </div>

        <h3 className="font-display font-bold text-sm text-brand-navy mt-2 mb-3">Line items</h3>
        <DocumentItemsEditor items={items} onChange={setItems} vatRegistered={company!.isVatRegistered} />

        <Field label="Notes (shown on the PDF)">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Payment terms, scope notes, etc." />
        </Field>
      </Card>

      <div className="flex flex-wrap justify-between gap-2 mt-5">
        <div className="flex gap-2">
          <Button variant="secondary" onClick={handleSaveDraft}>
            <Save size={16} /> Save as draft
          </Button>
          <Button onClick={handleMarkSent}>
            <Send size={16} /> Save & mark as sent
          </Button>
        </div>
        {!isNew && status !== 'converted' && (
          <Button variant="gold" onClick={handleConvert}>
            <ArrowRightCircle size={16} /> Convert to invoice
          </Button>
        )}
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
