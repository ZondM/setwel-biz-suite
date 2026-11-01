import React, { useEffect, useState } from 'react';
import { Button, Modal, Field, Input, Select } from '../common/ui';
import { Invoice } from '../../core/types';
import { advanceDate, FREQUENCY_LABELS } from '../../core/automation';
import { Frequency, getRecurringForInvoice, saveRecurring, deleteRecurring } from '../../db/automationRepo';
import { formatDate } from '../../core/numbering';

/** Turns an invoice into a template that Setwel copies automatically on a schedule. */
export function RepeatModal({ open, onClose, invoice, onSaved }: { open: boolean; onClose: () => void; invoice: Invoice; onSaved: () => void }) {
  const existing = open ? getRecurringForInvoice(invoice.id) : null;
  const [frequency, setFrequency] = useState<Frequency>('monthly');
  const [nextDate, setNextDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    if (!open) return;
    const ex = getRecurringForInvoice(invoice.id);
    const f = ex?.frequency ?? 'monthly';
    setFrequency(f);
    setNextDate(ex?.nextDate ?? advanceDate(invoice.invoiceDate, f));
    setEndDate(ex?.endDate ?? '');
  }, [open, invoice]);

  function changeFrequency(f: Frequency) {
    setFrequency(f);
    if (!existing) setNextDate(advanceDate(invoice.invoiceDate, f));
  }

  function save() {
    saveRecurring({
      id: existing?.id,
      companyId: invoice.companyId,
      sourceInvoiceId: invoice.id,
      frequency,
      nextDate,
      endDate: endDate || undefined,
      active: true,
      lastRun: existing?.lastRun
    });
    onSaved();
  }

  function stop() {
    if (existing && window.confirm('Stop repeating this invoice? Invoices already created stay as they are.')) {
      deleteRecurring(existing.id);
      onSaved();
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={existing ? 'Repeating invoice' : 'Repeat this invoice'}
      footer={
        <>
          {existing && (
            <Button variant="danger" onClick={stop} className="mr-auto">
              Stop repeating
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={!nextDate}>
            {existing ? 'Save changes' : 'Start repeating'}
          </Button>
        </>
      }
    >
      <p className="text-sm text-gray-500 mb-4">
        Setwel will make a copy of {invoice.invoiceNumber} on each date below, with a new number and due date, and put it in <strong>Needs your attention</strong> for you to send. Good for rent, retainers, school fees and subscriptions.
      </p>
      <Field label="How often">
        <Select value={frequency} onChange={(e) => changeFrequency(e.target.value as Frequency)}>
          {(Object.keys(FREQUENCY_LABELS) as Frequency[]).map((f) => (
            <option key={f} value={f}>
              {FREQUENCY_LABELS[f]}
            </option>
          ))}
        </Select>
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Next invoice date" required>
          <Input type="date" value={nextDate} onChange={(e) => setNextDate(e.target.value)} />
        </Field>
        <Field label="Stop after (optional)" hint="Leave empty to keep going">
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </Field>
      </div>
      {existing?.lastRun && <p className="text-xs text-gray-400">Last created: {formatDate(existing.lastRun)}</p>}
    </Modal>
  );
}
