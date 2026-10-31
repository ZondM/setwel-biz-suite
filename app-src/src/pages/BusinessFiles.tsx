import React, { useRef, useState } from 'react';
import { Send, Download, Upload, MessageCircle, FileUp } from 'lucide-react';
import { useApp, usePermissions } from '../state/AppContext';
import { Button, Card, PageHeader, Field, Input, Toggle, Modal } from '../components/common/ui';
import { exportBusiness, businessFileBytes, fileName, parseBusinessFile, previewImport, importBusiness, BusinessFile, ImportPreview } from '../core/businessFile';
import { getAccountant, getPractice } from '../core/accountant';
import { getBusinessEmail, setBusinessEmail, sendEmail, isEmail } from '../core/email';
import { saveOrDownloadFile } from '../db/storageAdapter';
import { whatsappUrl } from '../core/automation';
import { formatDate } from '../core/numbering';
import { listCompanies } from '../db/repository';

function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

/** Send this business's books to the accountant (or, for a partner, back to the client), and import files. */
export default function BusinessFiles() {
  const { company, licence, switchCompany, bumpRefresh } = useApp();
  const { isPartner, multiBusiness } = usePermissions();
  const accountant = company ? getAccountant(company.id) : null;
  const practice = getPractice();
  const [withPhotos, setWithPhotos] = useState(false);
  const [to, setTo] = useState(isPartner ? '' : accountant?.email ?? '');
  const [replyTo, setReplyTo] = useState(company ? getBusinessEmail(company.id) || (isPartner ? practice.email : '') : '');
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<{ file: BusinessFile; preview: ImportPreview } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  if (!company) return null;

  const sender = isPartner ? practice.firm || practice.name || 'your accountant' : company.name;
  const make = () => exportBusiness(company.id, { withPhotos, exportedBy: sender });

  async function save() {
    const f = make();
    await saveOrDownloadFile(fileName(f), businessFileBytes(f), 'application/octet-stream');
    setMsg({ text: `Saved ${fileName(f)}. Send it by WhatsApp, email or USB stick.` });
  }

  async function email() {
    if (!licence) return;
    if (!isEmail(to)) return setMsg({ text: `Enter ${isPartner ? "your client's" : "your accountant's"} email address.`, error: true });
    if (!isEmail(replyTo)) return setMsg({ text: 'Enter your own email address so replies come to you.', error: true });
    const f = make();
    const bytes = businessFileBytes(f);
    if (bytes.length > 3 * 1024 * 1024) {
      return setMsg({ text: 'The file is too big to email (over 3 MB), usually because of receipt photos. Untick "Include receipt photos", or save the file and send it another way.', error: true });
    }
    setBusy(true);
    setBusinessEmail(company!.id, replyTo);
    try {
      await sendEmail(licence, {
        to,
        replyTo,
        fromName: sender,
        subject: isPartner ? `Your updated Setwel books: ${company!.name}` : `Setwel books from ${company!.name}`,
        body: isPartner
          ? `Hi,\n\nAttached are your updated books for ${company!.name}.\n\nTo load them: open Setwel, go to "Send to accountant", press "Import a business file" and choose the attached file. It replaces the books on your device with these, so don't capture anything new until you've imported it.\n\n${sender}`
          : `Hi,\n\nAttached are the Setwel books for ${company!.name}, up to ${formatDate(new Date().toISOString().slice(0, 10))}.\n\nTo open them: in Setwel press "Send to accountant", then "Import a business file", and choose the attached file.\n\nThank you,\n${company!.name}`,
        attachment: { filename: fileName(f), base64: toBase64(bytes) }
      });
      setMsg({ text: `Sent to ${to}.` });
    } catch (e: any) {
      setMsg({ text: e.message || 'The email could not be sent.', error: true });
    } finally {
      setBusy(false);
    }
  }

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try {
      const file = parseBusinessFile(await f.text());
      const preview = previewImport(file);
      const others = listCompanies().filter((c) => c.id !== String(file.company.id));
      if (!preview.existing && others.length >= 1 && !multiBusiness) {
        return setMsg({ text: `This file is for "${preview.name}", a different business. Keeping several businesses needs the Enterprise or Accountant Partner plan.`, error: true });
      }
      setPending({ file, preview });
    } catch (err: any) {
      setMsg({ text: err.message, error: true });
    }
  }

  function doImport() {
    if (!pending) return;
    const id = importBusiness(pending.file, { keepPhotos: true });
    setPending(null);
    switchCompany(id);
    bumpRefresh();
    setMsg({ text: `Imported the books for ${pending.preview.name}.` });
  }

  return (
    <div className="max-w-3xl">
      <PageHeader
        title={isPartner ? 'Send books to your client' : 'Send to my accountant'}
        subtitle={isPartner ? `Send ${company.name}'s updated books back, or import a file a client sent you.` : 'Send your books to your accountant in one file, or load a file they sent back.'}
      />
      {msg && <div className={`mb-4 rounded-lg px-4 py-3 text-sm ${msg.error ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-amber-50 text-brand-navy border border-brand-gold/40'}`}>{msg.text}</div>}

      <Card className="mb-5">
        <h3 className="font-semibold text-brand-navy mb-1 flex items-center gap-2">
          <Send size={16} /> Send {company.name}'s books
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          One file with all invoices, quotes, payments, expenses, bills, customers and suppliers. {isPartner ? 'Your client' : 'Your accountant'} imports it into their Setwel.
        </p>
        <Toggle checked={withPhotos} onChange={setWithPhotos} label="Include receipt photos (makes the file bigger)" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
          <Field label={isPartner ? "Client's email" : "Accountant's email"} hint={!isPartner && !accountant?.email ? 'Save it under Settings, My accountant' : undefined}>
            <Input type="email" value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
          <Field label="Your email" hint="Replies come here">
            <Input type="email" value={replyTo} onChange={(e) => setReplyTo(e.target.value)} />
          </Field>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={email} disabled={busy}>
            <Send size={15} /> {busy ? 'Sending…' : 'Email the file'}
          </Button>
          <Button variant="secondary" onClick={save}>
            <Download size={15} /> Save the file
          </Button>
          {!isPartner && accountant?.phone && (
            <Button
              variant="secondary"
              onClick={() => window.open(whatsappUrl(accountant.phone, `Hi ${accountant.name || ''}, I'm sending you my Setwel books for ${company.name}.`), '_blank')}
            >
              <MessageCircle size={15} /> Tell them on WhatsApp
            </Button>
          )}
        </div>
      </Card>

      <Card>
        <h3 className="font-semibold text-brand-navy mb-1 flex items-center gap-2">
          <FileUp size={16} /> Import a business file
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          Choose a <strong>.setwel</strong> file. If it's a business already in this app, its books are replaced with the file's. Otherwise it's added as{' '}
          {isPartner ? 'a new client' : 'another business'}.
        </p>
        <input ref={fileInput} type="file" accept=".setwel,application/json,application/octet-stream" className="hidden" onChange={pick} />
        <Button variant="secondary" onClick={() => fileInput.current?.click()}>
          <Upload size={15} /> Import a business file
        </Button>
      </Card>

      {pending && (
        <Modal
          open
          onClose={() => setPending(null)}
          title={pending.preview.existing ? `Replace ${pending.preview.name}'s books?` : `Add ${pending.preview.name}?`}
          footer={
            <>
              <Button variant="ghost" onClick={() => setPending(null)}>Cancel</Button>
              <Button variant={pending.preview.existing ? 'danger' : 'primary'} onClick={doImport}>
                {pending.preview.existing ? 'Replace with this file' : 'Add business'}
              </Button>
            </>
          }
        >
          <p className="text-sm text-gray-600 mb-2">
            File from <strong>{pending.preview.exportedBy}</strong>, made {new Date(pending.preview.exportedAt).toLocaleString('en-ZA')}. It has {pending.preview.counts.invoices} invoices,{' '}
            {pending.preview.counts.expenses} expenses and {pending.preview.counts.customers} customers.
          </p>
          {pending.preview.existing && (
            <p className="text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2">
              Anything captured for {pending.preview.name} on this device after that file was made will be lost. Receipt photos already here are kept.
            </p>
          )}
        </Modal>
      )}
    </div>
  );
}
