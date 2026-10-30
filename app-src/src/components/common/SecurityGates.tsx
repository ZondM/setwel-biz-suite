import React, { useState, useEffect } from 'react';
import { Lock, ShieldCheck, Clock, Eye, EyeOff, Zap, AlertTriangle } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import { getSetting, setSetting } from '../../db/repository';
import { PRICING_URL } from '../../core/licence';

// ── PIN / Password gate ────────────────────────────────────────────────────

export function usePinGate(companyId: string | undefined) {
  const [unlocked, setUnlocked] = useState(false);
  const [pinSet, setPinSet] = useState(false);

  useEffect(() => {
    if (!companyId) return;
    const saved = getSetting(companyId, 'appPin');
    setPinSet(!!saved);
    // Each business asks for its own PIN when you switch to it; no PIN = open straight away.
    setUnlocked(!saved);
  }, [companyId]);

  return { unlocked, setUnlocked, pinSet, setPinSet };
}

export function PinLockScreen({ companyId, onUnlock }: { companyId: string; onUnlock: () => void }) {
  const [pin, setPin] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(0);

  function handleUnlock() {
    const saved = getSetting(companyId, 'appPin');
    if (pin === saved) {
      setError('');
      onUnlock();
    } else {
      const next = attempts + 1;
      setAttempts(next);
      setError(`Incorrect PIN. ${next >= 5 ? 'Too many attempts — restart the app.' : `${5 - next} attempt${5 - next === 1 ? '' : 's'} remaining.`}`);
      setPin('');
    }
  }

  return (
    <div className="min-h-screen bg-brand-navy flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm text-center">
        <div className="w-14 h-14 rounded-full bg-brand-green/10 flex items-center justify-center mx-auto mb-4">
          <Lock size={26} className="text-brand-green" />
        </div>
        <h2 className="font-display text-xl font-bold text-brand-navy mb-1">Setwel Africa</h2>
        <p className="text-sm text-gray-500 mb-6">Enter your PIN to access your business data</p>

        <div className="relative mb-4">
          <input
            type={show ? 'text' : 'password'}
            value={pin}
            onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
            onKeyDown={e => e.key === 'Enter' && handleUnlock()}
            placeholder="••••"
            disabled={attempts >= 5}
            className="w-full border border-gray-200 rounded-lg px-4 py-3 text-center text-2xl tracking-[0.5em] font-mono focus:outline-none focus:ring-2 focus:ring-brand-green"
            autoFocus
          />
          <button onClick={() => setShow(s => !s)} className="absolute right-3 top-3.5 text-gray-400 hover:text-gray-600">
            {show ? <EyeOff size={18}/> : <Eye size={18}/>}
          </button>
        </div>

        {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

        <button
          onClick={handleUnlock}
          disabled={pin.length < 4 || attempts >= 5}
          className="w-full py-3 bg-brand-green text-white font-bold rounded-lg hover:bg-brand-greenDark disabled:opacity-40 transition-colors"
        >
          Unlock
        </button>

        <p className="text-xs text-gray-400 mt-4">
          Forgot your PIN? Your data is safe — reinstall the app and restore from your last backup.
        </p>
      </div>
    </div>
  );
}

// ── Trial expiry hard gate ─────────────────────────────────────────────────

export function useTrialStatus() {
  // The trial and licence are checked by the desktop shell / phone gate (see core/licence.ts).
  // This only reports what they found; it never locks a paying customer out.
  const { licence } = useApp();
  const daysLeft = licence?.daysLeft ?? 30;
  return {
    isExpired: licence?.mode === 'expired',
    isTrial: licence?.mode === 'trial',
    daysLeft,
    pct: Math.min(100, Math.round(((30 - daysLeft) / 30) * 100))
  };
}

export function TrialExpiredScreen() {
  return (
    <div className="min-h-screen bg-brand-navy flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md text-center">
        <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <Clock size={26} className="text-red-500" />
        </div>
        <h2 className="font-display text-2xl font-bold text-brand-navy mb-2">Your free trial has ended</h2>
        <p className="text-gray-500 text-sm mb-6 leading-relaxed">
          Your 30-day trial of <strong>Setwel Biz Suite</strong> has expired.
          Upgrade to continue accessing your invoices, expenses, and business data.
          <br /><br />
          <span className="text-xs">Your data is safe and waiting — it will be fully restored the moment you upgrade.</span>
        </p>

        <div className="bg-brand-panel rounded-xl p-4 mb-6 text-left space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Your data is protected</p>
          {[
            'All your invoices, customers, and expenses are intact',
            'Nothing is deleted — data is stored on your own device',
            'Upgrade to regain full access immediately'
          ].map(t => (
            <div key={t} className="flex items-start gap-2 text-sm text-gray-600">
              <ShieldCheck size={15} className="text-brand-green mt-0.5 shrink-0" />
              {t}
            </div>
          ))}
        </div>

        <a
          href={PRICING_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full flex items-center justify-center gap-2 py-3 bg-brand-gold text-brand-navy font-bold rounded-xl hover:brightness-95 transition-all mb-3"
        >
          <Zap size={16} /> Upgrade now — from R59.99/month
        </a>

        <p className="text-xs text-gray-400">
          Already paid? Enter your licence key: on a computer use the <strong>Licence</strong> menu, on a phone, type it on the screen that opens with Setwel.
        </p>
      </div>
    </div>
  );
}

// ── PIN setup (inside Settings) ────────────────────────────────────────────

export function PinSetup({ companyId }: { companyId: string }) {
  const [current, setCurrent] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [msg, setMsg] = useState('');
  const [isError, setIsError] = useState(false);
  const existing = getSetting(companyId, 'appPin');

  function handleSave() {
    if (existing && current !== existing) { setMsg('Current PIN is incorrect.'); setIsError(true); return; }
    if (newPin.length < 4) { setMsg('PIN must be at least 4 digits.'); setIsError(true); return; }
    if (newPin !== confirm) { setMsg("PINs don't match."); setIsError(true); return; }
    setSetting(companyId, 'appPin', newPin);
    setMsg('PIN saved successfully. It will be required on next app start.'); setIsError(false);
    setCurrent(''); setNewPin(''); setConfirm('');
  }

  function handleRemove() {
    if (!existing) return;
    if (current !== existing) { setMsg('Current PIN is incorrect.'); setIsError(true); return; }
    setSetting(companyId, 'appPin', '');
    setMsg('PIN removed. The app will open without a lock screen.'); setIsError(false);
    setCurrent('');
  }

  return (
    <div className="space-y-3 max-w-xs">
      <div className="flex items-center gap-2 mb-1">
        <Lock size={14} className="text-brand-navy" />
        <p className="text-sm font-semibold text-brand-navy">App PIN / Password Lock</p>
        <button onClick={() => setShow(s => !s)} className="ml-auto text-gray-400 hover:text-gray-600">{show ? <EyeOff size={14}/> : <Eye size={14}/>}</button>
      </div>
      <p className="text-xs text-gray-400">Set a 4–8 digit PIN to protect access to your business data. Required every time the app opens.</p>

      {existing && (
        <div>
          <label className="text-xs text-gray-500 font-medium">Current PIN</label>
          <input type={show ? 'text' : 'password'} value={current} onChange={e => setCurrent(e.target.value.replace(/\D/g,'').slice(0,8))}
            className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-green" />
        </div>
      )}

      <div>
        <label className="text-xs text-gray-500 font-medium">{existing ? 'New PIN' : 'Set PIN (4–8 digits)'}</label>
        <input type={show ? 'text' : 'password'} value={newPin} onChange={e => setNewPin(e.target.value.replace(/\D/g,'').slice(0,8))}
          className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-green" />
      </div>
      <div>
        <label className="text-xs text-gray-500 font-medium">Confirm PIN</label>
        <input type={show ? 'text' : 'password'} value={confirm} onChange={e => setConfirm(e.target.value.replace(/\D/g,'').slice(0,8))}
          className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-green" />
      </div>

      {msg && <p className={`text-xs ${isError ? 'text-red-500' : 'text-brand-green'}`}>{msg}</p>}

      <div className="flex gap-2">
        <button onClick={handleSave} className="flex-1 py-2 text-sm bg-brand-green text-white rounded-lg font-semibold hover:bg-brand-greenDark transition-colors">
          {existing ? 'Change PIN' : 'Set PIN'}
        </button>
        {existing && (
          <button onClick={handleRemove} className="px-3 py-2 text-sm border border-red-200 text-red-500 rounded-lg hover:bg-red-50 transition-colors">
            Remove
          </button>
        )}
      </div>
    </div>
  );
}

// ── Copyright footer ────────────────────────────────────────────────────────

export function CopyrightFooter() {
  const year = new Date().getFullYear();
  return (
    <div className="text-center py-3 px-4 text-xs text-gray-400 border-t border-gray-100 no-print">
      © {year} Setwel Africa (Pty) Ltd · All rights reserved ·{' '}
      <a href="#/help" className="hover:text-brand-green underline">Help</a>{' '}·{' '}
      <span title="Your data is stored locally on your device — never sent to the cloud without your consent.">
        🔒 Your data stays on your device
      </span>
    </div>
  );
}

// ── Data safety disclaimer ──────────────────────────────────────────────────

export function DataSafetyCard() {
  return (
    <div className="rounded-xl bg-brand-green/5 border border-brand-green/20 p-4">
      <div className="flex items-center gap-2 mb-3">
        <ShieldCheck size={16} className="text-brand-green" />
        <p className="font-semibold text-sm text-brand-navy">Your data is private and safe</p>
      </div>
      <ul className="space-y-1.5 text-xs text-gray-600">
        {[
          'All data is stored on YOUR device — never on a remote server by default.',
          'No employee at Setwel Africa can access your business data.',
          'PDFs and exports go directly to your downloads folder — nowhere else.',
          'Optional encrypted cloud backup coming in Builder+ tier (you control the key).',
          'We do not sell, share, or mine your financial data — ever.',
          'In compliance with the Protection of Personal Information Act (POPIA) 2021.'
        ].map(t => (
          <li key={t} className="flex items-start gap-1.5">
            <span className="text-brand-green mt-0.5">✓</span> {t}
          </li>
        ))}
      </ul>
    </div>
  );
}
