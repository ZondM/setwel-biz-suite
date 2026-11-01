import React, { useState } from 'react';
import { Users, Trash2, KeyRound } from 'lucide-react';
import { Button, Card, Field, Input, Select } from '../common/ui';
import { useApp } from '../../state/AppContext';
import { addUser, changeUserPin, listUsers, removeUser, Role } from '../../db/enterpriseRepo';

/** Settings → Staff logins (Enterprise and Accountant Partner). */
export function StaffSettings({ companyId }: { companyId: string }) {
  const { user, setUser, bumpRefresh } = useApp();
  const [tick, setTick] = useState(0);
  const users = listUsers(companyId);
  const [name, setName] = useState('');
  const [role, setRole] = useState<Role>(users.length === 0 ? 'owner' : 'staff');
  const [pin, setPin] = useState('');
  const [msg, setMsg] = useState('');
  const hasOwner = users.some((u) => u.role === 'owner');

  async function add() {
    setMsg('');
    if (!name.trim()) return setMsg('Enter a name.');
    if (!/^\d{4,8}$/.test(pin)) return setMsg('The PIN must be 4 to 8 numbers.');
    if (users.length === 0 && role !== 'owner') return setMsg('Add yourself as the owner first.');
    const u = await addUser(companyId, name, role, pin);
    if (users.length === 0) setUser(u); // the first login is you
    setName('');
    setPin('');
    setRole('staff');
    setMsg(`${u.name} added. ${users.length === 0 ? 'From now on Setwel asks who is using it when it opens.' : ''}`);
    setTick(tick + 1);
    bumpRefresh();
  }

  async function resetPin(id: string, who: string) {
    const newPin = window.prompt(`New PIN for ${who} (4 to 8 numbers):`);
    if (newPin === null) return;
    if (!/^\d{4,8}$/.test(newPin)) return setMsg('The PIN must be 4 to 8 numbers.');
    await changeUserPin(id, newPin);
    setMsg(`PIN changed for ${who}.`);
  }

  function remove(id: string, who: string, r: Role) {
    if (r === 'owner' && users.filter((u) => u.role === 'owner').length === 1 && users.length > 1) {
      return setMsg('Remove the staff logins first, or add another owner. A business with staff needs an owner.');
    }
    if (!window.confirm(`Remove ${who}'s login?`)) return;
    removeUser(id);
    if (user?.id === id) setUser(null);
    setTick(tick + 1);
    bumpRefresh();
  }

  return (
    <Card>
      <h3 className="font-semibold text-brand-navy mb-1 flex items-center gap-2">
        <Users size={16} /> Staff logins
      </h3>
      <p className="text-sm text-gray-500 mb-4">
        Give each person their own PIN. <strong>Staff</strong> can make quotes and invoices, record payments and expenses, and send reminders. They can't delete
        anything, or see profit, reports, tax, bank matching or settings. Every change is recorded in Change history with their name. Logins work on this
        computer or phone.
      </p>
      {users.length > 0 && (
        <table className="w-full text-sm mb-4">
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-gray-100 last:border-0">
                <td className="py-2 font-medium text-brand-navy">{u.name}</td>
                <td className="py-2 text-gray-500">{u.role === 'owner' ? 'Owner' : 'Staff'}</td>
                <td className="py-2 text-right whitespace-nowrap">
                  <button onClick={() => resetPin(u.id, u.name)} className="text-gray-400 hover:text-brand-navy mr-3" title="Change PIN">
                    <KeyRound size={15} />
                  </button>
                  <button onClick={() => remove(u.id, u.name, u.role)} className="text-gray-400 hover:text-status-overdue" title="Remove">
                    <Trash2 size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
        <Field label="Name">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={users.length === 0 ? 'Your name' : 'e.g. Sipho'} />
        </Field>
        <Field label="Role">
          <Select value={role} onChange={(e) => setRole(e.target.value as Role)} disabled={users.length === 0}>
            <option value="owner">Owner</option>
            <option value="staff">Staff</option>
          </Select>
        </Field>
        <Field label="PIN (4 to 8 numbers)">
          <Input type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))} />
        </Field>
      </div>
      <Button onClick={add}>{users.length === 0 ? 'Add me as owner' : 'Add login'}</Button>
      {!hasOwner && users.length === 0 && <p className="text-xs text-gray-400 mt-2">Start with yourself as the owner. Then add your staff.</p>}
      {msg && <p className="text-sm text-brand-navy mt-3">{msg}</p>}
    </Card>
  );
}
