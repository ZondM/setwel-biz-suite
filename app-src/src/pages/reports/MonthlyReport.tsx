import React, { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Download, MessageCircle, Mail } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import { Button, Card, PageHeader, Field, Input, Modal, StatCard } from '../../components/common/ui';
import { buildMonthlyReport, changeText, previousMonth, reportPdf, reportText } from '../../core/monthlyReport';
import { whatsappUrl } from '../../core/automation';
import { sendEmail, getBusinessEmail, setBusinessEmail, isEmail } from '../../core/email';
import { saveOrDownloadFile } from '../../db/storageAdapter';
import { formatCurrency } from '../../core/numbering';

export default function MonthlyReport() {
  const { company, licence } = useApp();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const thisMonth = new Date().toISOString().slice(0, 7);
  const month = /^\d{4}-\d{2}$/.test(params.get('month') ?? '') ? params.get('month')! : previousMonth(thisMonth);
  const [emailOpen, setEmailOpen] = useState(false);

  const report = useMemo(() => (company ? buildMonthlyReport(company.id, month) : null), [company, month]);
  if (!company || !report) return null;
  const { current: c, previous: p } = report;

  async function download() {
    const bytes = new Uint8Array(reportPdf(company!, report!).output('arraybuffer'));
    await saveOrDownloadFile(`Setwel report ${c.month}.pdf`, bytes, 'application/pdf');
  }

  return (
    <div>
      <button onClick={() => navigate('/reports')} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-brand-navy mb-4 no-print">
        <ArrowLeft size={15} /> Back to reports
      </button>
      <PageHeader
        title={`Monthly report: ${c.label}`}
        subtitle="What came in, what went out, and who owes you."
        actions={
          <>
            <Input type="month" value={month} max={thisMonth} onChange={(e) => e.target.value && setParams({ month: e.target.value })} className="max-w-[170px]" />
            <Button variant="secondary" size="sm" onClick={download}>
              <Download size={15} /> PDF
            </Button>
            <Button variant="secondary" size="sm" onClick={() => window.open(whatsappUrl('', reportText(company, report)), '_blank')}>
              <MessageCircle size={15} /> WhatsApp
            </Button>
            <Button size="sm" onClick={() => setEmailOpen(true)}>
              <Mail size={15} /> Email
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Invoiced (excl. VAT)" value={formatCurrency(c.invoicedExclVat)} sublabel={`${c.invoiceCount} invoices, ${changeText(c.invoicedExclVat, p.invoicedExclVat)}`} />
        <StatCard label="Money received" value={formatCurrency(c.received)} sublabel={changeText(c.received, p.received)} tone="good" />
        <StatCard label="Expenses (excl. VAT)" value={formatCurrency(c.expensesExclVat)} sublabel={changeText(c.expensesExclVat, p.expensesExclVat)} />
        <StatCard label="Profit" value={formatCurrency(c.profit)} sublabel={changeText(c.profit, p.profit)} tone={c.profit >= 0 ? 'good' : 'bad'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ListCard title="Biggest expenses" rows={c.topExpenses} empty="No expenses recorded this month." />
        <ListCard title="Top customers" rows={c.topCustomers} empty="No invoices this month." />
        <Card>
          <h3 className="font-display font-bold text-brand-navy mb-1">Who owes you</h3>
          <p className="text-sm text-gray-500 mb-3">{formatCurrency(report.owedTotal)} in total, as of today</p>
          {report.owedTop.length === 0 ? (
            <p className="text-sm text-gray-400">Nobody owes you money right now.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {report.owedTop.map((o) => (
                <li key={o.name} className="flex justify-between gap-3">
                  <span className={o.overdue ? 'text-status-overdue' : 'text-brand-navy'}>
                    {o.name}
                    {o.overdue && ' (overdue)'}
                  </span>
                  <span className="font-semibold">{formatCurrency(o.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {company.isVatRegistered && (
        <Card className="mt-4">
          <h3 className="font-display font-bold text-brand-navy mb-1">VAT for {c.label}</h3>
          <p className="text-sm text-gray-600">
            Output VAT {formatCurrency(c.vatOutput)} minus input VAT {formatCurrency(c.vatInput)} ={' '}
            <strong>{formatCurrency(c.vatOutput - c.vatInput)}</strong>. This is one month only; your VAT201 covers your full VAT period.
          </p>
        </Card>
      )}
      <p className="text-xs text-gray-400 mt-4">Figures come from your Setwel records. Tax amounts are estimates. If something doesn't add up, ask your accountant.</p>

      <EmailReportModal open={emailOpen} onClose={() => setEmailOpen(false)} onSend={async (to, replyTo) => {
        setBusinessEmail(company.id, replyTo);
        const doc = reportPdf(company, report);
        await sendEmail(licence!, {
          to,
          replyTo,
          fromName: company.name,
          subject: `${company.name}: monthly report for ${c.label}`,
          body: reportText(company, report) + '\n\nThe full report is attached as a PDF.',
          attachment: { filename: `Setwel report ${c.month}.pdf`, base64: doc.output('datauristring').split(',')[1] }
        });
      }} defaultReplyTo={getBusinessEmail(company.id)} />
    </div>
  );
}

function ListCard({ title, rows, empty }: { title: string; rows: { name: string; amount: number }[]; empty: string }) {
  return (
    <Card>
      <h3 className="font-display font-bold text-brand-navy mb-3">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-gray-400">{empty}</p>
      ) : (
        <ul className="space-y-1.5 text-sm">
          {rows.map((r) => (
            <li key={r.name} className="flex justify-between gap-3">
              <span className="text-brand-navy">{r.name}</span>
              <span className="font-semibold">{formatCurrency(r.amount)}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function EmailReportModal({ open, onClose, onSend, defaultReplyTo }: { open: boolean; onClose: () => void; onSend: (to: string, replyTo: string) => Promise<void>; defaultReplyTo: string }) {
  const [to, setTo] = useState(defaultReplyTo);
  const [replyTo, setReplyTo] = useState(defaultReplyTo);
  const [state, setState] = useState<{ busy?: boolean; error?: string; done?: boolean }>({});

  async function send() {
    if (!isEmail(to) || !isEmail(replyTo)) return setState({ error: 'Please enter both email addresses.' });
    setState({ busy: true });
    try {
      await onSend(to.trim(), replyTo.trim());
      setState({ done: true });
    } catch (e: any) {
      setState({ error: e.message || 'The email could not be sent.' });
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        setState({});
        onClose();
      }}
      title="Email this report"
      footer={
        state.done ? (
          <Button onClick={onClose}>Done</Button>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button onClick={send} disabled={state.busy}>{state.busy ? 'Sending…' : 'Send'}</Button>
          </>
        )
      }
    >
      {state.done ? (
        <p className="text-sm text-brand-navy">Sent to {to}, with the PDF attached.</p>
      ) : (
        <>
          <Field label="Send to" hint="Yourself, a partner, or your accountant">
            <Input type="email" value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
          <Field label="Your email" hint="Replies come here">
            <Input type="email" value={replyTo} onChange={(e) => setReplyTo(e.target.value)} />
          </Field>
          {state.error && <p className="text-sm text-status-overdue">{state.error}</p>}
        </>
      )}
    </Modal>
  );
}
