import React, { useEffect, useState } from 'react';
import { MessageCircle, Mail, CheckCircle2 } from 'lucide-react';
import { Button, Modal, Field, Input, Textarea, Toggle, Tabs } from '../common/ui';
import { useApp } from '../../state/AppContext';
import { Customer, Invoice } from '../../core/types';
import { invoiceMessage, reminderMessage, whatsappUrl } from '../../core/automation';
import { sendEmail, invoicePdfAttachment, getBusinessEmail, setBusinessEmail, isEmail } from '../../core/email';
import { saveInvoice } from '../../db/repository';
import { logReminder } from '../../db/automationRepo';

/**
 * One place to send an invoice or a payment reminder, by WhatsApp (opens WhatsApp with
 * the message typed out) or by email (sent for you, with the invoice PDF attached).
 */
export function SendModal({
  open,
  onClose,
  kind,
  invoice,
  customer,
  onSent
}: {
  open: boolean;
  onClose: () => void;
  kind: 'invoice' | 'reminder';
  invoice: Invoice;
  customer: Customer | null;
  onSent?: () => void;
}) {
  const { company, licence } = useApp();
  const [tab, setTab] = useState<'whatsapp' | 'email'>('whatsapp');
  const [text, setText] = useState('');
  const [to, setTo] = useState('');
  const [replyTo, setReplyTo] = useState('');
  const [subject, setSubject] = useState('');
  const [attach, setAttach] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  useEffect(() => {
    if (!open || !company) return;
    const msg = kind === 'invoice' ? invoiceMessage(company, customer, invoice) : reminderMessage(company, customer, invoice);
    setText(msg.body);
    setSubject(msg.subject);
    setTo(customer?.email ?? '');
    setReplyTo(getBusinessEmail(company.id));
    setTab(customer?.phone || !customer?.email ? 'whatsapp' : 'email');
    setError('');
    setDone('');
    // Only reset when a different invoice/customer is opened, not on every re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, kind, invoice.id, customer?.id, company?.id]);

  if (!company) return null;

  function markSent(channel: 'whatsapp' | 'email') {
    if (kind === 'reminder') logReminder(company!.id, invoice.id, channel);
    if (invoice.status === 'draft') saveInvoice({ ...invoice, status: 'sent' });
    onSent?.();
  }

  function sendWhatsApp() {
    window.open(whatsappUrl(customer?.phone, text), '_blank');
    markSent('whatsapp');
    setDone('WhatsApp opened with your message. Press send in WhatsApp. Attach the PDF there if you want to: download it with the PDF button.');
  }

  async function sendByEmail() {
    if (!licence) return;
    setError('');
    if (!isEmail(to)) return setError("Enter your customer's email address.");
    if (!isEmail(replyTo)) return setError('Enter your own email address, so replies come to you.');
    setBusy(true);
    try {
      setBusinessEmail(company!.id, replyTo);
      const res = await sendEmail(licence, {
        to: to.trim(),
        subject,
        body: text,
        replyTo: replyTo.trim(),
        fromName: company!.name,
        attachment: attach ? invoicePdfAttachment(company!, customer, invoice) : undefined
      });
      markSent('email');
      setDone(`Email sent to ${to}.${typeof res.remaining === 'number' ? ` ${res.remaining} emails left today.` : ''}`);
    } catch (e: any) {
      setError(e.message || 'The email could not be sent.');
    } finally {
      setBusy(false);
    }
  }

  function openMailApp() {
    window.location.href = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
    markSent('email');
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={kind === 'invoice' ? `Send invoice ${invoice.invoiceNumber}` : `Remind ${customer?.name ?? 'customer'} to pay`}
      wide
      footer={
        done ? (
          <Button onClick={onClose}>Done</Button>
        ) : tab === 'whatsapp' ? (
          <>
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button onClick={sendWhatsApp}>
              <MessageCircle size={16} /> Open WhatsApp
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button onClick={sendByEmail} disabled={busy}>
              <Mail size={16} /> {busy ? 'Sending…' : 'Send email'}
            </Button>
          </>
        )
      }
    >
      {done ? (
        <div className="flex items-start gap-3 text-sm text-brand-navy">
          <CheckCircle2 className="text-status-paid shrink-0" size={22} />
          <p>{done}</p>
        </div>
      ) : (
        <>
          <Tabs
            tabs={[
              { id: 'whatsapp', label: 'WhatsApp' },
              { id: 'email', label: 'Email' }
            ]}
            active={tab}
            onChange={(t) => setTab(t as 'whatsapp' | 'email')}
          />
          {tab === 'whatsapp' ? (
            <>
              {!customer?.phone && <p className="text-xs text-amber-700 mb-3">This customer has no phone number saved, so WhatsApp will ask you who to send it to.</p>}
              <Field label="Message">
                <Textarea rows={9} value={text} onChange={(e) => setText(e.target.value)} />
              </Field>
            </>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Customer's email" required>
                  <Input type="email" value={to} onChange={(e) => setTo(e.target.value)} />
                </Field>
                <Field label="Your email" hint="Replies come here. Remembered for next time." required>
                  <Input type="email" value={replyTo} onChange={(e) => setReplyTo(e.target.value)} />
                </Field>
              </div>
              <Field label="Subject">
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
              </Field>
              <Field label="Message">
                <Textarea rows={8} value={text} onChange={(e) => setText(e.target.value)} />
              </Field>
              <Toggle checked={attach} onChange={setAttach} label="Attach the invoice as a PDF" />
              {error && (
                <div className="mt-3 text-sm text-status-overdue">
                  {error}{' '}
                  <button onClick={openMailApp} className="underline text-brand-navy">
                    Use my own email app instead
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </Modal>
  );
}
