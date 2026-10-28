import React, { useMemo, useState } from 'react';
import { Plus, Users, Search, Pencil, Trash2 } from 'lucide-react';
import { useApp, usePermissions } from '../state/AppContext';
import { Button, Card, PageHeader, EmptyState, Modal, Field, Input, Toggle } from '../components/common/ui';
import { listCustomers, saveCustomer, deleteCustomer } from '../db/repository';
import { Customer } from '../core/types';

export default function Customers() {
  const { company, refreshKey, bumpRefresh } = useApp();
  const { canDelete } = usePermissions();
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Customer | null>(null);
  const [showModal, setShowModal] = useState(false);

  const customers = useMemo(() => (company ? listCustomers(company.id) : []), [company, refreshKey]);
  const filtered = customers.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()));

  function openNew() {
    setEditing(null);
    setShowModal(true);
  }
  function openEdit(c: Customer) {
    setEditing(c);
    setShowModal(true);
  }
  function handleDelete(c: Customer) {
    if (window.confirm(`Delete ${c.name}? This won't delete existing invoices for them.`)) {
      deleteCustomer(c.id);
      bumpRefresh();
    }
  }

  return (
    <div>
      <PageHeader
        title="Customers"
        subtitle={`${customers.length} customer${customers.length === 1 ? '' : 's'}`}
        actions={
          <Button onClick={openNew}>
            <Plus size={16} /> Add customer
          </Button>
        }
      />
      <div className="relative mb-4 max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <Input placeholder="Search customers…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Users size={40} />}
          title={customers.length === 0 ? 'No customers yet' : 'No matches'}
          description={customers.length === 0 ? 'Add your first customer to start sending quotes and invoices.' : 'Try a different search term.'}
          action={customers.length === 0 ? <Button onClick={openNew}><Plus size={16} /> Add customer</Button> : undefined}
        />
      ) : (
        <Card padded={false}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100">
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Contact</th>
                <th className="px-5 py-3">VAT status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium text-brand-navy">{c.name}</td>
                  <td className="px-5 py-3 text-gray-500">
                    {c.email && <div>{c.email}</div>}
                    {c.phone && <div>{c.phone}</div>}
                  </td>
                  <td className="px-5 py-3 text-gray-500">{c.isVatRegistered ? `VAT registered (${c.vatNumber || '—'})` : 'Not VAT registered'}</td>
                  <td className="px-5 py-3 text-right">
                    <button onClick={() => openEdit(c)} className="text-gray-400 hover:text-brand-navy mr-3">
                      <Pencil size={15} />
                    </button>
                    {canDelete && (<button onClick={() => handleDelete(c)} className="text-gray-400 hover:text-status-overdue"><Trash2 size={15} /></button>)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <CustomerModal
        open={showModal}
        onClose={() => setShowModal(false)}
        editing={editing}
        companyId={company!.id}
        onSaved={() => {
          setShowModal(false);
          bumpRefresh();
        }}
      />
    </div>
  );
}

export function CustomerModal({ open, onClose, editing, companyId, onSaved }: { open: boolean; onClose: () => void; editing: Customer | null; companyId: string; onSaved: (c: Customer) => void }) {
  const [name, setName] = useState(editing?.name ?? '');
  const [email, setEmail] = useState(editing?.email ?? '');
  const [phone, setPhone] = useState(editing?.phone ?? '');
  const [address, setAddress] = useState(editing?.address ?? '');
  const [isVatRegistered, setIsVatRegistered] = useState(editing?.isVatRegistered ?? false);
  const [vatNumber, setVatNumber] = useState(editing?.vatNumber ?? '');

  React.useEffect(() => {
    setName(editing?.name ?? '');
    setEmail(editing?.email ?? '');
    setPhone(editing?.phone ?? '');
    setAddress(editing?.address ?? '');
    setIsVatRegistered(editing?.isVatRegistered ?? false);
    setVatNumber(editing?.vatNumber ?? '');
  }, [editing, open]);

  function handleSave() {
    if (!name.trim()) return;
    const saved = saveCustomer({
      id: editing?.id,
      companyId,
      name: name.trim(),
      email: email || undefined,
      phone: phone || undefined,
      address: address || undefined,
      isVatRegistered,
      vatNumber: isVatRegistered ? vatNumber : undefined
    });
    onSaved(saved);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit customer' : 'Add customer'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!name.trim()}>
            Save customer
          </Button>
        </>
      }
    >
      <Field label="Name" required>
        <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Email">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Phone">
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
      </div>
      <Field label="Address">
        <Input value={address} onChange={(e) => setAddress(e.target.value)} />
      </Field>
      <Field label="VAT registered customer?">
        <Toggle checked={isVatRegistered} onChange={setIsVatRegistered} label={isVatRegistered ? 'Yes' : 'No'} />
      </Field>
      {isVatRegistered && (
        <Field label="VAT number">
          <Input value={vatNumber} onChange={(e) => setVatNumber(e.target.value)} />
        </Field>
      )}
    </Modal>
  );
}
