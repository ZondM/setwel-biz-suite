import React, { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Download, Pencil, Send, BellRing, Repeat, CircleDollarSign, Trash2 } from 'lucide-react';
import { useApp, usePermissions } from '../state/AppContext';
import { Button, Card, PageHeader, StatusBadge, MoneyText, Modal, Field, Input, Select } from '../components/common/ui';
import { getInvoice, getCustomer, listPaymentsForInvoice, recordPayment, deleteInvoice } from '../db/repository';
import { generateInvoicePdf } from '../utils/pdf';
import { saveOrDownloadFile } from '../db/storageAdapter';
import { formatCurrency, formatDate, todayIso, uid } from '../core/numbering';
import { PaymentMethod } from '../core/types';
import { SendModal } from '../components/automation/SendModal';
import { RepeatModal } from '../components/automation/RepeatModal';
import { getRecurringForInvoice } from '../db/automationRepo';
import { FREQUENCY_LABELS, isOverdue } from '../core/automation';

export default function InvoiceView() {
  const { company, refreshKey, bumpRefresh } = useApp();
  const { canDelete, staffDevice } = usePermissions();
  const navigate = useNavigate();
  const { id } = useParams();
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [sendKind, setSendKind] = useState<'invoice' | 'reminder' | null>(null);
  const [showRepeat, setShowRepeat] = useState(false);

  const data = useMemo(() => {
    if (!id) return null;
    const invoice = getInvoice(id);
    if (!invoice) return null;
    const customer = getCustomer(invoice.customerId);
    const payments = listPaymentsForInvoice(id);
    const recurring = getRecurringForInvoice(id);
    return { invoice, customer, payments, recurring };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, refreshKey]);

  if (!company || !data) {
    return (
      <div>
        <button onClick={() => navigate('/invoices')} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-brand-navy mb-4">
          <ArrowLeft size={15} /> Back to invoices
        </button>
        <p className="text-gray-500">Invoice not found.</p>
      </div>
    );
  }

  const { invoice, customer, payments, recurring } = data;
  const overdue = isOverdue(invoice);
  const balanceDue = Math.max(0, Math.round((invoice.total - invoice.amountPaid) * 100) / 100);

  async function handleDownload() {
    const doc = generateInvoicePdf(company!, customer, invoice);
    const blob = doc.output('blob');
    const arrayBuffer = await blob.arrayBuffer();
    await saveOrDownloadFile(`${invoice.invoiceNumber}.pdf`, new Uint8Array(arrayBuffer), 'application/pdf');
  }

  function handleDelete() {
    if (window.confirm('Delete this invoice and all its recorded payments?')) {
      deleteInvoice(invoice.id);
      navigate('/invoices');
    }
  }

  return (
    <div>
      <button onClick={() => navigate('/invoices')} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-brand-navy mb-4 no-print">
        <ArrowLeft size={15} /> Back to invoices
      </button>
      <PageHeader
        title={`Invoice ${invoice.invoiceNumber}`}
        subtitle={customer?.name}
        actions={
          <div className="no-print flex flex-wrap gap-2">
            <StatusBadge status={invoice.status} />
            <Button variant="secondary" size="sm" onClick={() => navigate(`/invoices/${invoice.id}/edit`)}>
              <Pencil size={15} /> Edit
            </Button>
            <Button variant="secondary" size="sm" onClick={handleDownload}>
              <Download size={15} /> PDF
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setSendKind('invoice')}>
              <Send size={15} /> Send
            </Button>
            {overdue && (
              <Button variant="secondary" size="sm" onClick={() => setSendKind('reminder')}>
                <BellRing size={15} /> Remind to pay
              </Button>
            )}
            {!staffDevice && (
              <Button variant="secondary" size="sm" onClick={() => setShowRepeat(true)}>
                <Repeat size={15} /> {recurring?.active ? 'Repeating' : 'Repeat'}
              </Button>
            )}
            {balanceDue > 0 && !staffDevice && (
              <Button variant="gold" size="sm" onClick={() => setShowPaymentModal(true)}>
                <CircleDollarSign size={15} /> Record payment
              </Button>
            )}
            {canDelete && (<button onClick={handleDelete} className="text-gray-400 hover:text-status-overdue px-2"><Trash2 size={16} /></button>)}
          </div>
        }
      />

      {recurring?.active && (
        <p className="text-sm text-gray-500 -mt-3 mb-4 no-print">
          <Repeat size={13} className="inline mr-1" />
          {FREQUENCY_LABELS[recurring.frequency]}. Next copy on {formatDate(recurring.nextDate)}.
        </p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card className="lg:col-span-2">
          <div className="flex justify-between mb-5">
            <div>
              <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Billed to</div>
              <div className="font-semibold text-brand-navy">{customer?.name}</div>
              {customer?.address && <div className="text-sm text-gray-500">{customer.address}</div>}
              {customer?.isVatRegistered && <div className="text-sm text-gray-500">VAT No: {customer.vatNumber}</div>}
            </div>
            <div className="text-right text-sm">
              <div>
                <span className="text-gray-400">Invoice date: </span>
                {formatDate(invoice.invoiceDate)}
              </div>
              <div>
                <span className="text-gray-400">Due date: </span>
                {formatDate(invoice.dueDate)}
              </div>
            </div>
          </div>

          <table className="w-full text-sm mb-5">
            <thead>
              <tr className="text-left text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100">
                <th className="py-2">Description</th>
                <th className="py-2 text-center">Qty</th>
                <th className="py-2 text-right">Unit price</th>
                <th className="py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((it) => (
                <tr key={it.id} className="border-b border-gray-50">
                  <td className="py-2">{it.description}</td>
                  <td className="py-2 text-center">{it.quantity}</td>
                  <td className="py-2 text-right">{formatCurrency(it.unitPrice)}</td>
                  <td className="py-2 text-right">{formatCurrency(it.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-end">
            <div className="w-64 space-y-1.5 text-sm">
              <div className="flex justify-between text-gray-500">
                <span>Subtotal</span>
                <span>{formatCurrency(invoice.subtotal)}</span>
              </div>
              {company!.isVatRegistered && (
                <div className="flex justify-between text-gray-500">
                  <span>VAT (15%)</span>
                  <span>{formatCurrency(invoice.vatAmount)}</span>
                </div>
              )}
              <div className="flex justify-between font-display font-bold text-brand-navy text-base pt-1.5 border-t border-gray-200">
                <span>Total</span>
                <span>{formatCurrency(invoice.total)}</span>
              </div>
              {invoice.amountPaid > 0 && (
                <>
                  <div className="flex justify-between text-brand-green">
                    <span>Paid</span>
                    <span>{formatCurrency(invoice.amountPaid)}</span>
                  </div>
                  <div className="flex justify-between font-semibold text-status-overdue">
                    <span>Balance due</span>
                    <span>{formatCurrency(balanceDue)}</span>
                  </div>
                </>
              )}
            </div>
          </div>
          {invoice.notes && (
            <div className="mt-5 pt-4 border-t border-gray-100 text-sm text-gray-500">
              <span className="font-semibold text-brand-navy">Notes: </span>
              {invoice.notes}
            </div>
          )}
        </Card>

        <Card>
          <h3 className="font-display font-bold text-brand-navy mb-3">Payment history</h3>
          {payments.length === 0 ? (
            <p className="text-sm text-gray-400">No payments recorded yet.</p>
          ) : (
            <div className="space-y-3">
              {payments.map((p) => (
                <div key={p.id} className="flex justify-between text-sm border-b border-gray-50 pb-2">
                  <div>
                    <div className="font-medium text-brand-navy capitalize">{p.method}</div>
                    <div className="text-gray-400 text-xs">{formatDate(p.paymentDate)}{p.reference ? ` · ${p.reference}` : ''}</div>
                  </div>
                  <MoneyText amount={p.amount} className="font-semibold text-brand-green" />
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {sendKind && (
        <SendModal open kind={sendKind} invoice={invoice} customer={customer} onClose={() => setSendKind(null)} onSent={bumpRefresh} />
      )}
      <RepeatModal
        open={showRepeat}
        onClose={() => setShowRepeat(false)}
        invoice={invoice}
        onSaved={() => {
          setShowRepeat(false);
          bumpRefresh();
        }}
      />

      <PaymentModal
        open={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        maxAmount={balanceDue}
        onSave={(amount, method, paymentDate, reference) => {
          recordPayment({ companyId: company!.id, invoiceId: invoice.id, amount, method, paymentDate, reference });
          setShowPaymentModal(false);
          bumpRefresh();
        }}
      />
    </div>
  );
}

function PaymentModal({ open, onClose, maxAmount, onSave }: { open: boolean; onClose: () => void; maxAmount: number; onSave: (amount: number, method: PaymentMethod, date: string, reference?: string) => void }) {
  const [amount, setAmount] = useState(maxAmount);
  const [method, setMethod] = useState<PaymentMethod>('eft');
  const [date, setDate] = useState(todayIso());
  const [reference, setReference] = useState('');

  React.useEffect(() => {
    setAmount(maxAmount);
  }, [maxAmount, open]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record a payment"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => amount > 0 && onSave(amount, method, date, reference || undefined)} disabled={amount <= 0}>
            Save payment
          </Button>
        </>
      }
    >
      <Field label="Amount received" required>
        <Input type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
      </Field>
      <Field label="Payment date">
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <Field label="Method">
        <Select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
          <option value="eft">EFT</option>
          <option value="cash">Cash</option>
          <option value="card">Card</option>
          <option value="snapscan">SnapScan</option>
          <option value="zapper">Zapper</option>
          <option value="other">Other</option>
        </Select>
      </Field>
      <Field label="Reference" hint="Optional">
        <Input value={reference} onChange={(e) => setReference(e.target.value)} />
      </Field>
    </Modal>
  );
}
