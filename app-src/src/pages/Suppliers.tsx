import React, { useMemo, useState } from 'react';
import { Plus, Factory, Search, Pencil, Trash2 } from 'lucide-react';
import { useApp, usePermissions } from '../state/AppContext';
import { Button, Card, PageHeader, EmptyState, Modal, Field, Input } from '../components/common/ui';
import { listSuppliers, saveSupplier, deleteSupplier } from '../db/repository';
import { Supplier } from '../core/types';

export default function Suppliers() {
  const { company, refreshKey, bumpRefresh } = useApp();
  const { canDelete } = usePermissions();
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [showModal, setShowModal] = useState(false);

  const suppliers = useMemo(() => (company ? listSuppliers(company.id) : []), [company, refreshKey]);
  const filtered = suppliers.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()));

  function openNew() {
    setEditing(null);
    setShowModal(true);
  }
  function openEdit(s: Supplier) {
    setEditing(s);
    setShowModal(true);
  }
  function handleDelete(s: Supplier) {
    if (window.confirm(`Delete ${s.name}?`)) {
      deleteSupplier(s.id);
      bumpRefresh();
    }
  }

  return (
    <div>
      <PageHeader
        title="Suppliers"
        subtitle={`${suppliers.length} supplier${suppliers.length === 1 ? '' : 's'}`}
        actions={
          <Button onClick={openNew}>
            <Plus size={16} /> Add supplier
          </Button>
        }
      />
      <div className="relative mb-4 max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <Input placeholder="Search suppliers…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Factory size={40} />}
          title={suppliers.length === 0 ? 'No suppliers yet' : 'No matches'}
          description={suppliers.length === 0 ? 'Add the businesses you buy stock or services from to track bills and input VAT.' : 'Try a different search term.'}
          action={suppliers.length === 0 ? <Button onClick={openNew}><Plus size={16} /> Add supplier</Button> : undefined}
        />
      ) : (
        <Card padded={false}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100">
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Contact</th>
                <th className="px-5 py-3">VAT number</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium text-brand-navy">{s.name}</td>
                  <td className="px-5 py-3 text-gray-500">
                    {s.email && <div>{s.email}</div>}
                    {s.phone && <div>{s.phone}</div>}
                  </td>
                  <td className="px-5 py-3 text-gray-500">{s.vatNumber || '—'}</td>
                  <td className="px-5 py-3 text-right">
                    <button onClick={() => openEdit(s)} className="text-gray-400 hover:text-brand-navy mr-3">
                      <Pencil size={15} />
                    </button>
                    {canDelete && (<button onClick={() => handleDelete(s)} className="text-gray-400 hover:text-status-overdue"><Trash2 size={15} /></button>)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <SupplierModal
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

export function SupplierModal({ open, onClose, editing, companyId, onSaved }: { open: boolean; onClose: () => void; editing: Supplier | null; companyId: string; onSaved: (s: Supplier) => void }) {
  const [name, setName] = useState(editing?.name ?? '');
  const [email, setEmail] = useState(editing?.email ?? '');
  const [phone, setPhone] = useState(editing?.phone ?? '');
  const [address, setAddress] = useState(editing?.address ?? '');
  const [vatNumber, setVatNumber] = useState(editing?.vatNumber ?? '');

  React.useEffect(() => {
    setName(editing?.name ?? '');
    setEmail(editing?.email ?? '');
    setPhone(editing?.phone ?? '');
    setAddress(editing?.address ?? '');
    setVatNumber(editing?.vatNumber ?? '');
  }, [editing, open]);

  function handleSave() {
    if (!name.trim()) return;
    const saved = saveSupplier({ id: editing?.id, companyId, name: name.trim(), email: email || undefined, phone: phone || undefined, address: address || undefined, vatNumber: vatNumber || undefined });
    onSaved(saved);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit supplier' : 'Add supplier'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!name.trim()}>
            Save supplier
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
      <Field label="VAT number" hint="So their bills count correctly toward your input VAT">
        <Input value={vatNumber} onChange={(e) => setVatNumber(e.target.value)} />
      </Field>
    </Modal>
  );
}
