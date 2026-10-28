import React, { useMemo, useState } from 'react';
import { Plus, Wallet, Trash2, Pencil, Paperclip, ScanLine, Loader2 } from 'lucide-react';
import { useApp, usePermissions } from '../state/AppContext';
import { Button, Card, PageHeader, EmptyState, Modal, Field, Input, Select, Toggle, MoneyText } from '../components/common/ui';
import { listExpenses, listCategories, listSuppliers, saveExpense, deleteExpense, saveSupplier } from '../db/repository';
import { prepareFile, scanReceipt, ScannedReceipt } from '../core/scan';
import { tierAtLeast } from '../state/AppContext';
import { Expense } from '../core/types';
import { formatDate, todayIso } from '../core/numbering';
import { splitVatInclusive } from '../core/financialEngine';

interface ScanPrefill {
  fields: ScannedReceipt;
  photo?: string;
  remaining: number | null;
  trial: boolean;
}

export default function Expenses() {
  const { company, licence, refreshKey, bumpRefresh } = useApp();
  const { canDelete } = usePermissions();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [prefill, setPrefill] = useState<ScanPrefill | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState('');
  const fileInput = React.useRef<HTMLInputElement>(null);

  async function handleScanFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !company || !licence) return;
    setScanError('');
    setScanning(true);
    try {
      const prepared = await prepareFile(file);
      const names = listCategories(company.id).map((c) => c.name);
      const result = await scanReceipt(licence, prepared, names);
      setEditing(null);
      setPrefill({ fields: result.fields, photo: prepared.previewDataUrl, remaining: result.remaining, trial: licence.mode !== 'licensed' });
      setShowModal(true);
    } catch (err: any) {
      setScanError(err.message || 'The receipt could not be read. Please type the expense in.');
    } finally {
      setScanning(false);
    }
  }

  const { expenses, categoryName, supplierName } = useMemo(() => {
    if (!company) return { expenses: [], categoryName: (_: string) => '', supplierName: (_?: string) => '' };
    const categories = listCategories(company.id);
    const suppliers = listSuppliers(company.id);
    const catMap = new Map(categories.map((c) => [c.id, c.name]));
    const supMap = new Map(suppliers.map((s) => [s.id, s.name]));
    return {
      expenses: listExpenses(company.id),
      categoryName: (id: string) => catMap.get(id) ?? 'Uncategorised',
      supplierName: (id?: string) => (id ? supMap.get(id) ?? '' : '')
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company, refreshKey]);

  function openNew() {
    setEditing(null);
    setPrefill(null);
    setShowModal(true);
  }
  function openEdit(e: Expense) {
    setPrefill(null);
    setEditing(e);
    setShowModal(true);
  }
  function handleDelete(e: Expense) {
    if (window.confirm('Delete this expense?')) {
      deleteExpense(e.id);
      bumpRefresh();
    }
  }

  if (!company) return null;

  return (
    <div>
      <PageHeader
        title="Expenses"
        subtitle={`${expenses.length} expense${expenses.length === 1 ? '' : 's'} recorded`}
        actions={
          <>
            <input ref={fileInput} type="file" accept="image/*,application/pdf" className="hidden" onChange={handleScanFile} />
            <Button variant="gold" onClick={() => fileInput.current?.click()} disabled={scanning}>
              {scanning ? <Loader2 size={16} className="animate-spin" /> : <ScanLine size={16} />} {scanning ? 'Reading receipt…' : 'Scan receipt'}
            </Button>
            <Button onClick={openNew}>
              <Plus size={16} /> Record expense
            </Button>
          </>
        }
      />
      {scanError && <div className="mb-4 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700 px-4 py-3">{scanError}</div>}
      {expenses.length === 0 ? (
        <EmptyState icon={<Wallet size={40} />} title="No expenses yet" description="Record every business expense — even small ones — to get an accurate profit picture and claim every VAT input you're entitled to." action={<Button onClick={openNew}><Plus size={16} /> Record expense</Button>} />
      ) : (
        <Card padded={false}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100">
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">Description</th>
                <th className="px-5 py-3">Category</th>
                <th className="px-5 py-3">Supplier</th>
                <th className="px-5 py-3 text-center">VAT</th>
                <th className="px-5 py-3 text-right">Amount</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((e) => (
                <tr key={e.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                  <td className="px-5 py-3 text-gray-500">{formatDate(e.expenseDate)}</td>
                  <td className="px-5 py-3 font-medium text-brand-navy">
                    {e.description}
                    {e.receiptPhoto && <Paperclip size={12} className="inline ml-1.5 text-gray-400" />}
                  </td>
                  <td className="px-5 py-3 text-gray-500">{categoryName(e.categoryId)}</td>
                  <td className="px-5 py-3 text-gray-500">{supplierName(e.supplierId)}</td>
                  <td className="px-5 py-3 text-center text-gray-400">{e.vatApplicable ? '15%' : '—'}</td>
                  <td className="px-5 py-3 text-right font-semibold text-brand-navy">
                    <MoneyText amount={e.amount} />
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button onClick={() => openEdit(e)} className="text-gray-400 hover:text-brand-navy mr-3">
                      <Pencil size={15} />
                    </button>
                    {canDelete && (<button onClick={() => handleDelete(e)} className="text-gray-400 hover:text-status-overdue"><Trash2 size={15} /></button>)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <ExpenseModal
        open={showModal}
        onClose={() => setShowModal(false)}
        editing={editing}
        prefill={prefill}
        canUseSuppliers={tierAtLeast(company.packageTier, 'grinder')}
        companyId={company.id}
        onSaved={() => {
          setShowModal(false);
          setPrefill(null);
          bumpRefresh();
        }}
      />
    </div>
  );
}

function ExpenseModal({
  open,
  onClose,
  editing,
  prefill,
  canUseSuppliers,
  companyId,
  onSaved
}: {
  open: boolean;
  onClose: () => void;
  editing: Expense | null;
  prefill: ScanPrefill | null;
  canUseSuppliers: boolean;
  companyId: string;
  onSaved: () => void;
}) {
  const categories = listCategories(companyId);
  const suppliers = listSuppliers(companyId);

  const [description, setDescription] = useState(editing?.description ?? '');
  const [amount, setAmount] = useState(editing?.amount ?? 0);
  const [categoryId, setCategoryId] = useState(editing?.categoryId ?? categories[0]?.id ?? '');
  const [supplierId, setSupplierId] = useState(editing?.supplierId ?? '');
  const [vatApplicable, setVatApplicable] = useState(editing?.vatApplicable ?? true);
  const [expenseDate, setExpenseDate] = useState(editing?.expenseDate ?? todayIso());
  const [receiptPhoto, setReceiptPhoto] = useState<string | undefined>(editing?.receiptPhoto);
  const [scannedVat, setScannedVat] = useState<number | null>(null); // VAT exactly as printed on the slip
  const [newSupplierName, setNewSupplierName] = useState(''); // supplier read from the slip that isn't saved yet
  const [addSupplier, setAddSupplier] = useState(true);

  React.useEffect(() => {
    if (prefill && !editing) {
      // Fill the form from the AI scan; the owner checks it and presses Save.
      const f = prefill.fields;
      const match = suppliers.find((s) => s.name.trim().toLowerCase() === f.supplier_name.trim().toLowerCase());
      const cat = categories.find((c) => c.name === f.category) ?? categories.find((c) => c.name === 'Other expenses');
      setDescription([f.supplier_name, f.description].filter(Boolean).join(': ').slice(0, 120));
      setAmount(f.total || 0);
      setCategoryId(cat?.id ?? categories[0]?.id ?? '');
      setSupplierId(match?.id ?? '');
      setNewSupplierName(!match && canUseSuppliers ? f.supplier_name.trim() : '');
      setAddSupplier(true);
      setVatApplicable(f.vat_amount > 0);
      setScannedVat(f.vat_amount > 0 ? f.vat_amount : null);
      setExpenseDate(/^\d{4}-\d{2}-\d{2}$/.test(f.date) ? f.date : todayIso());
      setReceiptPhoto(prefill.photo);
      return;
    }
    setDescription(editing?.description ?? '');
    setAmount(editing?.amount ?? 0);
    setCategoryId(editing?.categoryId ?? categories[0]?.id ?? '');
    setSupplierId(editing?.supplierId ?? '');
    setVatApplicable(editing?.vatApplicable ?? true);
    setExpenseDate(editing?.expenseDate ?? todayIso());
    setReceiptPhoto(editing?.receiptPhoto);
    setScannedVat(null);
    setNewSupplierName('');
  }, [editing, open, prefill]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setReceiptPhoto(reader.result as string);
    reader.readAsDataURL(file);
  }

  function handleSave() {
    if (!description.trim() || amount <= 0 || !categoryId) return;
    const vatAmount = vatApplicable ? scannedVat ?? splitVatInclusive(amount).vat : 0;
    let finalSupplierId = supplierId || undefined;
    if (!finalSupplierId && newSupplierName && addSupplier) {
      finalSupplierId = saveSupplier({ companyId, name: newSupplierName, vatNumber: prefill?.fields.supplier_vat_number || undefined }).id;
    }
    saveExpense({
      id: editing?.id,
      companyId,
      supplierId: finalSupplierId,
      categoryId,
      description: description.trim(),
      amount,
      vatApplicable,
      vatAmount,
      expenseDate,
      receiptPhoto
    });
    onSaved();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit expense' : 'Record expense'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!description.trim() || amount <= 0}>
            Save expense
          </Button>
        </>
      }
    >
      {prefill && !editing && (
        <div className={`mb-4 rounded-lg px-3 py-2.5 text-sm ${prefill.fields.confidence === 'high' ? 'bg-amber-50 text-brand-navy' : 'bg-red-50 text-red-700'}`}>
          {prefill.fields.confidence === 'high'
            ? 'Filled in from your receipt. Check it, then press Save.'
            : 'Parts of the receipt were hard to read. Please check every field before saving.'}
          {prefill.remaining !== null && (
            <span className="block text-xs text-gray-500 mt-0.5">
              {prefill.remaining} scans left {prefill.trial ? 'in your free trial' : 'this month'}.
            </span>
          )}
        </div>
      )}
      <Field label="What was it for?" required>
        <Input value={description} onChange={(e) => setDescription(e.target.value)} autoFocus placeholder="e.g. Diesel for the bakkie" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Amount (incl. VAT if applicable)" required>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={amount}
            onChange={(e) => {
              setAmount(Number(e.target.value));
              setScannedVat(null);
            }}
          />
        </Field>
        <Field label="Date">
          <Input type="date" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} />
        </Field>
      </div>
      <Field label="Category" required>
        <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Supplier" hint="Optional">
        <Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
          <option value="">No specific supplier</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      </Field>
      {newSupplierName && !supplierId && (
        <div className="-mt-2 mb-4">
          <Toggle checked={addSupplier} onChange={setAddSupplier} label={`Add "${newSupplierName}" to my suppliers`} />
        </div>
      )}
      <Field label="This expense included VAT">
        <Toggle
          checked={vatApplicable}
          onChange={(v) => {
            setVatApplicable(v);
            if (!v) setScannedVat(null);
          }}
          label={vatApplicable ? `Yes, claim input VAT${scannedVat !== null ? ` (R${scannedVat.toFixed(2)} on the slip)` : ''}` : 'No VAT on this'}
        />
      </Field>
      <Field label="Receipt photo" hint="Optional, stored with this record">
        <input type="file" accept="image/*" onChange={handleFileChange} className="text-sm" />
        {receiptPhoto && <img src={receiptPhoto} alt="Receipt" className="mt-2 h-20 rounded border border-gray-200 object-cover" />}
      </Field>
    </Modal>
  );
}
