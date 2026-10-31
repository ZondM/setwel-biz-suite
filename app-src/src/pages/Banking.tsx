import React, { useMemo, useRef, useState } from 'react';
import { Upload, Landmark, CheckCircle2, EyeOff, Sparkles, Undo2 } from 'lucide-react';
import { useApp } from '../state/AppContext';
import { Button, Card, PageHeader, EmptyState, MoneyText, Select, Tabs, Modal, Field } from '../components/common/ui';
import { listInvoices, listCustomers, listExpenses, listBills, listCategories, recordPayment, saveExpense, saveBill } from '../db/repository';
import { listBankLines, addBankLines, setBankLineStatus, listBankRules, saveBankRule, BankLine } from '../db/automationRepo';
import { parseStatement, extractLines, ColumnMap, ParseResult } from '../core/bankImport';
import { suggest, rulePattern, Suggestion, MatchContext } from '../core/bankMatch';
import { balanceDue } from '../core/automation';
import { formatDate } from '../core/numbering';

export default function Banking() {
  const { company, refreshKey, bumpRefresh } = useApp();
  const fileInput = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState('review');
  const [message, setMessage] = useState('');
  const [mapping, setMapping] = useState<ParseResult | null>(null);

  const data = useMemo(() => {
    if (!company) return null;
    const lines = listBankLines(company.id);
    const invoices = listInvoices(company.id);
    const ctx: MatchContext = {
      invoices,
      customers: listCustomers(company.id),
      expenses: listExpenses(company.id),
      bills: listBills(company.id),
      categories: listCategories(company.id),
      rules: listBankRules(company.id),
      alreadyMatched: new Set(lines.filter((l) => l.matchId).map((l) => l.matchId!))
    };
    // Suggest in date order so two equal payments don't both claim the same invoice.
    const suggestions = new Map<string, Suggestion>();
    for (const l of [...lines].filter((l) => l.status === 'new').sort((a, b) => (a.date < b.date ? -1 : 1))) {
      const s = suggest(l, ctx);
      suggestions.set(l.id, s);
      if (s.kind === 'invoice') ctx.alreadyMatched.add(s.invoice.id);
      if (s.kind === 'existing_expense') ctx.alreadyMatched.add(s.expense.id);
      if (s.kind === 'bill') ctx.alreadyMatched.add(s.bill.id);
    }
    return { lines, ctx, suggestions, unpaid: invoices.filter((i) => i.status !== 'paid' && i.status !== 'draft' && balanceDue(i) > 0) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company, refreshKey]);

  if (!company || !data) return null;
  const { lines, ctx, suggestions, unpaid } = data;
  const toReview = lines.filter((l) => l.status === 'new');
  const done = lines.filter((l) => l.status !== 'new');
  const customerName = (id: string) => ctx.customers.find((c) => c.id === id)?.name ?? '';

  function importLines(parsed: { date: string; description: string; amount: number; fingerprint: string }[]) {
    const added = addBankLines(company!.id, parsed);
    const range = parsed.length ? `${formatDate(parsed.map((p) => p.date).sort()[0])} to ${formatDate(parsed.map((p) => p.date).sort().slice(-1)[0])}` : '';
    setMessage(`Read ${parsed.length} transactions${range ? ` (${range})` : ''}. ${added} new, ${parsed.length - added} already imported before.`);
    setTab('review');
    bumpRefresh();
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setMessage('');
    const text = await file.text();
    const result = parseStatement(text);
    if (result.columns && result.lines.length > 0) importLines(result.lines);
    else if (result.rows.length > 1) setMapping(result);
    else setMessage("That file doesn't look like a bank statement CSV. In your online banking, download the transactions as a CSV file and try again.");
  }

  // ---- actions ----
  function confirm(line: BankLine, s: Suggestion) {
    if (s.kind === 'invoice') {
      const amount = Math.min(line.amount, balanceDue(s.invoice));
      recordPayment({ companyId: company!.id, invoiceId: s.invoice.id, amount, method: 'eft', paymentDate: line.date, reference: line.description.slice(0, 80) });
      setBankLineStatus(line.id, 'matched', 'invoice', s.invoice.id);
    } else if (s.kind === 'existing_expense') {
      setBankLineStatus(line.id, 'matched', 'expense', s.expense.id);
    } else if (s.kind === 'bill') {
      saveBill({ ...s.bill, amountPaid: s.bill.total, status: 'paid' });
      setBankLineStatus(line.id, 'matched', 'bill', s.bill.id);
    } else if (s.kind === 'new_expense') {
      createExpense(line, s.categoryId);
      return;
    }
  }

  function createExpense(line: BankLine, categoryId: string) {
    const exp = saveExpense({
      companyId: company!.id,
      categoryId,
      description: line.description.slice(0, 120),
      amount: Math.abs(line.amount),
      vatApplicable: false, // a bank line is not a tax invoice; add VAT on the expense if you have one
      vatAmount: 0,
      expenseDate: line.date
    });
    const pattern = rulePattern(line.description);
    if (pattern) saveBankRule(company!.id, pattern, categoryId); // remember for next time
    setBankLineStatus(line.id, 'matched', 'expense', exp.id);
  }

  function confirmAllSure() {
    let n = 0;
    for (const l of toReview) {
      const s = suggestions.get(l.id);
      if (!s) continue;
      const sure =
        (s.kind === 'invoice' && s.confident) || s.kind === 'existing_expense' || (s.kind === 'bill' && s.confident) || (s.kind === 'new_expense' && s.learnt);
      if (sure) {
        confirm(l, s);
        n++;
      }
    }
    setMessage(`${n} transaction${n === 1 ? '' : 's'} matched.`);
    bumpRefresh();
  }

  const sureCount = toReview.filter((l) => {
    const s = suggestions.get(l.id);
    return s && ((s.kind === 'invoice' && s.confident) || s.kind === 'existing_expense' || (s.kind === 'bill' && s.confident) || (s.kind === 'new_expense' && s.learnt));
  }).length;

  return (
    <div>
      <PageHeader
        title="Bank statement matching"
        subtitle="Upload your bank statement. Setwel matches payments to your invoices and expenses for you."
        actions={
          <>
            <input ref={fileInput} type="file" accept=".csv,text/csv,text/plain" className="hidden" onChange={handleFile} />
            <Button onClick={() => fileInput.current?.click()}>
              <Upload size={16} /> Upload statement (CSV)
            </Button>
          </>
        }
      />
      {message && <div className="mb-4 rounded-lg bg-amber-50 border border-brand-gold/40 px-4 py-3 text-sm text-brand-navy">{message}</div>}

      {lines.length === 0 ? (
        <EmptyState
          icon={<Landmark size={40} />}
          title="No bank transactions yet"
          description="In your online banking or banking app, download your account transactions as a CSV file, then upload it here. Setwel reads FNB, ABSA, Standard Bank, Nedbank, Capitec and most other banks. Your statement stays on this device."
          action={
            <Button onClick={() => fileInput.current?.click()}>
              <Upload size={16} /> Upload statement (CSV)
            </Button>
          }
        />
      ) : (
        <>
          <Tabs
            tabs={[
              { id: 'review', label: `To review (${toReview.length})` },
              { id: 'done', label: `Done (${done.length})` }
            ]}
            active={tab}
            onChange={setTab}
          />
          {tab === 'review' && sureCount > 0 && (
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <Button variant="gold" onClick={confirmAllSure}>
                <Sparkles size={16} /> Accept {sureCount} sure match{sureCount === 1 ? '' : 'es'}
              </Button>
              <span className="text-xs text-gray-500">Only matches Setwel is sure about. Check the rest one by one.</span>
            </div>
          )}
          <Card padded={false}>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3">{tab === 'review' ? 'Setwel suggests' : 'Matched to'}</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {(tab === 'review' ? toReview : done).map((l) => (
                  <LineRow
                    key={l.id}
                    line={l}
                    suggestion={suggestions.get(l.id)}
                    ctx={ctx}
                    unpaid={unpaid}
                    customerName={customerName}
                    onConfirm={(s) => {
                      confirm(l, s);
                      bumpRefresh();
                    }}
                    onCreateExpense={(cat) => {
                      createExpense(l, cat);
                      bumpRefresh();
                    }}
                    onIgnore={() => {
                      setBankLineStatus(l.id, 'ignored');
                      bumpRefresh();
                    }}
                    onUndo={() => {
                      setBankLineStatus(l.id, 'new');
                      bumpRefresh();
                    }}
                  />
                ))}
              </tbody>
            </table>
          </Card>
          {tab === 'done' && <p className="text-xs text-gray-400 mt-3">"Move back" only returns the line to review. A payment or expense it created stays; delete it on its own page if needed.</p>}
        </>
      )}

      {mapping && (
        <ColumnMapper
          result={mapping}
          onClose={() => setMapping(null)}
          onImport={(cols, headerRow) => {
            const parsed = extractLines(mapping.rows, headerRow, cols);
            setMapping(null);
            if (parsed.length) importLines(parsed);
            else setMessage('No transactions found with those columns. Please check the file.');
          }}
        />
      )}
    </div>
  );
}

function LineRow({
  line,
  suggestion,
  ctx,
  unpaid,
  customerName,
  onConfirm,
  onCreateExpense,
  onIgnore,
  onUndo
}: {
  line: BankLine;
  suggestion?: Suggestion;
  ctx: MatchContext;
  unpaid: ReturnType<typeof listInvoices>;
  customerName: (id: string) => string;
  onConfirm: (s: Suggestion) => void;
  onCreateExpense: (categoryId: string) => void;
  onIgnore: () => void;
  onUndo: () => void;
}) {
  const s = suggestion ?? { kind: 'none' as const };
  const [category, setCategory] = useState(s.kind === 'new_expense' ? s.categoryId : ctx.categories[0]?.id ?? '');
  const [invoiceId, setInvoiceId] = useState('');
  const isIn = line.amount > 0;

  let matched = '';
  if (line.status !== 'new') {
    if (line.status === 'ignored') matched = 'Ignored';
    else if (line.matchType === 'invoice') matched = `Payment on ${ctx.invoices.find((i) => i.id === line.matchId)?.invoiceNumber ?? 'invoice'}`;
    else if (line.matchType === 'bill') matched = 'Supplier bill paid';
    else matched = `Expense: ${ctx.categories.find((c) => c.id === ctx.expenses.find((e) => e.id === line.matchId)?.categoryId)?.name ?? 'recorded'}`;
  }

  return (
    <tr className="border-b border-gray-100 last:border-0 align-top">
      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDate(line.date)}</td>
      <td className="px-4 py-3 text-brand-navy max-w-xs break-words">{line.description}</td>
      <td className={`px-4 py-3 text-right font-semibold whitespace-nowrap ${isIn ? 'text-status-paid' : 'text-brand-navy'}`}>
        <MoneyText amount={line.amount} />
      </td>
      <td className="px-4 py-3 text-gray-600 min-w-[220px]">
        {line.status !== 'new' ? (
          matched
        ) : s.kind === 'invoice' ? (
          <span>
            Payment for <strong>{s.invoice.invoiceNumber}</strong> ({customerName(s.invoice.customerId)})
            {!s.confident && <span className="block text-xs text-amber-700">Same amount. Please check.</span>}
          </span>
        ) : s.kind === 'existing_expense' ? (
          <span>Already recorded: {s.expense.description}</span>
        ) : s.kind === 'bill' ? (
          <span>Pays supplier bill <strong>{s.bill.billNumber}</strong></span>
        ) : isIn ? (
          <Select value={invoiceId} onChange={(e) => setInvoiceId(e.target.value)}>
            <option value="">Not an invoice payment</option>
            {unpaid.map((i) => (
              <option key={i.id} value={i.id}>
                {i.invoiceNumber} · {customerName(i.customerId)} · R{balanceDue(i).toFixed(2)}
              </option>
            ))}
          </Select>
        ) : (
          <div>
            <Select value={category} onChange={(e) => setCategory(e.target.value)}>
              {ctx.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            {s.kind === 'new_expense' && s.learnt && <span className="text-xs text-gray-400">Learnt from earlier</span>}
          </div>
        )}
      </td>
      <td className="px-4 py-3 text-right whitespace-nowrap">
        {line.status !== 'new' ? (
          <button onClick={onUndo} className="text-gray-400 hover:text-brand-navy text-xs inline-flex items-center gap-1">
            <Undo2 size={13} /> Move back
          </button>
        ) : (
          <div className="flex justify-end gap-2">
            {s.kind === 'invoice' || s.kind === 'existing_expense' || s.kind === 'bill' ? (
              <Button size="sm" onClick={() => onConfirm(s)}>
                <CheckCircle2 size={14} /> Confirm
              </Button>
            ) : isIn ? (
              invoiceId && (
                <Button
                  size="sm"
                  onClick={() => {
                    const inv = unpaid.find((i) => i.id === invoiceId);
                    if (inv) onConfirm({ kind: 'invoice', invoice: inv, confident: true });
                  }}
                >
                  <CheckCircle2 size={14} /> Link
                </Button>
              )
            ) : (
              <Button size="sm" onClick={() => category && onCreateExpense(category)}>
                <CheckCircle2 size={14} /> Add expense
              </Button>
            )}
            <button onClick={onIgnore} title="Ignore (e.g. transfer between your own accounts)" className="text-gray-400 hover:text-brand-navy px-1">
              <EyeOff size={15} />
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}

/** Shown only when Setwel can't work out the columns itself. */
function ColumnMapper({ result, onClose, onImport }: { result: ParseResult; onClose: () => void; onImport: (cols: ColumnMap, headerRow: number) => void }) {
  const width = Math.max(...result.rows.slice(0, 20).map((r) => r.length));
  const [headerRow, setHeaderRow] = useState(result.headerRow);
  const [date, setDate] = useState(0);
  const [desc, setDesc] = useState(Math.min(1, width - 1));
  const [mode, setMode] = useState<'one' | 'two'>('one');
  const [amount, setAmount] = useState(Math.min(2, width - 1));
  const [moneyOut, setMoneyOut] = useState(Math.min(3, width - 1));

  const sampleRow = result.rows[Math.max(0, headerRow + 1)] ?? [];
  const colOptions = Array.from({ length: width }, (_, i) => (
    <option key={i} value={i}>
      Column {i + 1}: {(sampleRow[i] ?? '').slice(0, 30)}
    </option>
  ));

  return (
    <Modal
      open
      onClose={onClose}
      title="Which columns are which?"
      wide
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() =>
              onImport(
                mode === 'one' ? { date, description: [desc], amount } : { date, description: [desc], moneyIn: amount, moneyOut },
                headerRow
              )
            }
          >
            Import
          </Button>
        </>
      }
    >
      <p className="text-sm text-gray-500 mb-4">Setwel couldn't tell the columns apart in this file. Pick them below. The examples come from the first transaction.</p>
      <Field label="Transactions start after row">
        <Select value={headerRow} onChange={(e) => setHeaderRow(Number(e.target.value))}>
          <option value={-1}>No header row</option>
          {result.rows.slice(0, 15).map((r, i) => (
            <option key={i} value={i}>
              Row {i + 1}: {r.join(' | ').slice(0, 60)}
            </option>
          ))}
        </Select>
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Date">
          <Select value={date} onChange={(e) => setDate(Number(e.target.value))}>{colOptions}</Select>
        </Field>
        <Field label="Description">
          <Select value={desc} onChange={(e) => setDesc(Number(e.target.value))}>{colOptions}</Select>
        </Field>
      </div>
      <Field label="Amounts are in">
        <Select value={mode} onChange={(e) => setMode(e.target.value as 'one' | 'two')}>
          <option value="one">One column (money out is negative)</option>
          <option value="two">Two columns (money in and money out)</option>
        </Select>
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label={mode === 'one' ? 'Amount' : 'Money in'}>
          <Select value={amount} onChange={(e) => setAmount(Number(e.target.value))}>{colOptions}</Select>
        </Field>
        {mode === 'two' && (
          <Field label="Money out">
            <Select value={moneyOut} onChange={(e) => setMoneyOut(Number(e.target.value))}>{colOptions}</Select>
          </Field>
        )}
      </div>
    </Modal>
  );
}
