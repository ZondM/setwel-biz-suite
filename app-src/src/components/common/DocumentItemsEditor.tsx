import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { LineItem } from '../../core/types';
import { calculateLineTotal, calculateDocumentTotals } from '../../core/financialEngine';
import { formatCurrency } from '../../core/numbering';
import { uid } from '../../core/numbering';
import { Button, Input, Toggle } from './ui';

export function DocumentItemsEditor({ items, onChange, vatRegistered }: { items: LineItem[]; onChange: (items: LineItem[]) => void; vatRegistered: boolean }) {
  function updateItem(id: string, patch: Partial<LineItem>) {
    onChange(
      items.map((it) => {
        if (it.id !== id) return it;
        const merged = { ...it, ...patch };
        merged.lineTotal = calculateLineTotal(merged.quantity, merged.unitPrice);
        return merged;
      })
    );
  }
  function addItem() {
    onChange([...items, { id: uid('li_'), description: '', quantity: 1, unitPrice: 0, vatApplicable: vatRegistered, lineTotal: 0 }]);
  }
  function removeItem(id: string) {
    onChange(items.filter((it) => it.id !== id));
  }

  const totals = calculateDocumentTotals(items);

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-400 uppercase tracking-wide border-b border-gray-200">
              <th className="py-2 pr-3">Description</th>
              <th className="py-2 px-2 w-20">Qty</th>
              <th className="py-2 px-2 w-32">Unit price</th>
              {vatRegistered && <th className="py-2 px-2 w-20 text-center">VAT</th>}
              <th className="py-2 px-2 w-32 text-right">Line total</th>
              <th className="py-2 pl-2 w-10" />
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-gray-100">
                <td className="py-2 pr-3">
                  <Input value={item.description} onChange={(e) => updateItem(item.id, { description: e.target.value })} placeholder="Describe the work or item" />
                </td>
                <td className="py-2 px-2">
                  <Input type="number" min={0} step="0.01" value={item.quantity} onChange={(e) => updateItem(item.id, { quantity: Number(e.target.value) })} />
                </td>
                <td className="py-2 px-2">
                  <Input type="number" min={0} step="0.01" value={item.unitPrice} onChange={(e) => updateItem(item.id, { unitPrice: Number(e.target.value) })} />
                </td>
                {vatRegistered && (
                  <td className="py-2 px-2 text-center">
                    <Toggle checked={item.vatApplicable} onChange={(v) => updateItem(item.id, { vatApplicable: v })} />
                  </td>
                )}
                <td className="py-2 px-2 text-right font-medium text-brand-navy">{formatCurrency(item.lineTotal)}</td>
                <td className="py-2 pl-2 text-right">
                  <button onClick={() => removeItem(item.id)} className="text-gray-400 hover:text-status-overdue">
                    <Trash2 size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Button variant="ghost" size="sm" onClick={addItem} className="mt-2">
        <Plus size={15} /> Add line item
      </Button>

      <div className="flex justify-end mt-4">
        <div className="w-64 space-y-1.5 text-sm">
          <div className="flex justify-between text-gray-500">
            <span>Subtotal</span>
            <span>{formatCurrency(totals.subtotal)}</span>
          </div>
          {vatRegistered && (
            <div className="flex justify-between text-gray-500">
              <span>VAT (15%)</span>
              <span>{formatCurrency(totals.vatAmount)}</span>
            </div>
          )}
          <div className="flex justify-between font-display font-bold text-brand-navy text-base pt-1.5 border-t border-gray-200">
            <span>Total</span>
            <span>{formatCurrency(totals.total)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
