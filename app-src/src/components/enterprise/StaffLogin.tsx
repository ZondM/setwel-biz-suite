import React, { useState } from 'react';
import { Lock } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import { AppUser, checkUserPin, listUsers } from '../../db/enterpriseRepo';

/** Shown when the open business has staff logins: pick your name, enter your PIN. */
export function StaffLogin() {
  const { company, companies, setUser, switchCompany } = useApp();
  const users = company ? listUsers(company.id) : [];
  const [chosen, setChosen] = useState<AppUser | null>(users.length === 1 ? users[0] : null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(0);
  if (!company) return null;

  async function signIn() {
    if (!chosen) return;
    const ok = await checkUserPin(chosen.id, pin);
    if (ok) {
      setUser(ok);
      return;
    }
    const n = attempts + 1;
    setAttempts(n);
    setPin('');
    setError(n >= 5 ? 'Too many wrong PINs. Close Setwel and try again later.' : 'That PIN is not right. Try again.');
  }

  return (
    <div className="min-h-screen bg-brand-navy flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-2xl p-7 w-full max-w-sm">
        <div className="flex items-center gap-2 mb-1">
          <Lock size={18} className="text-brand-green" />
          <h2 className="font-display text-xl font-bold text-brand-navy truncate">{company.name}</h2>
        </div>
        <p className="text-sm text-gray-500 mb-5">Who is using Setwel?</p>
        <div className="flex flex-wrap gap-2 mb-4">
          {users.map((u) => (
            <button
              key={u.id}
              onClick={() => {
                setChosen(u);
                setError('');
              }}
              className={`px-3 py-2 rounded-lg border text-sm font-semibold ${chosen?.id === u.id ? 'bg-brand-green text-white border-brand-green' : 'border-gray-300 text-brand-navy'}`}
            >
              {u.name}
              <span className="block text-[10px] font-normal opacity-80">{u.role === 'owner' ? 'Owner' : 'Staff'}</span>
            </button>
          ))}
        </div>
        {chosen && (
          <>
            <input
              type="password"
              inputMode="numeric"
              autoFocus
              value={pin}
              disabled={attempts >= 5}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
              onKeyDown={(e) => e.key === 'Enter' && signIn()}
              placeholder="PIN"
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-center text-2xl tracking-[0.4em] font-mono focus:outline-none focus:ring-2 focus:ring-brand-green"
            />
            {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
            <button
              onClick={signIn}
              disabled={pin.length < 4 || attempts >= 5}
              className="w-full mt-3 py-3 bg-brand-green text-white font-bold rounded-lg disabled:opacity-40"
            >
              Sign in
            </button>
          </>
        )}
        {companies.length > 1 && (
          <select
            className="mt-5 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-600"
            value={company.id}
            onChange={(e) => switchCompany(e.target.value)}
          >
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                Switch to: {c.name}
              </option>
            ))}
          </select>
        )}
        <p className="text-xs text-gray-400 mt-4">Forgot your PIN? Ask the owner to reset it in Settings, then Staff logins.</p>
      </div>
    </div>
  );
}
