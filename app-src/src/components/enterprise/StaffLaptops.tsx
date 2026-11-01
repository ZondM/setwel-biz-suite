import React, { useEffect, useState } from 'react';
import { Laptop, RefreshCw, Trash2, Cloud } from 'lucide-react';
import { Button, Card, Field, Input, Select } from '../common/ui';
import { useApp } from '../../state/AppContext';
import { createLinkCode, disconnect, listDevices, revokeDevice, setupOwner, syncNow, syncStatus, TeamDevice } from '../../core/sync';

/**
 * Settings → Staff laptops (Enterprise and Accountant Partner, paid licence).
 * The owner's laptop keeps every business; each staff laptop gets one business, for
 * quotes, invoices and customers only. Everything syncs through setwelbusiness.co.za.
 */
export function StaffLaptops() {
  const { licence, companies, company, bumpRefresh, restartSync, syncTick } = useApp();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [devices, setDevices] = useState<TeamDevice[] | null>(null);
  const [laptopName, setLaptopName] = useState('Owner laptop');
  const [businessId, setBusinessId] = useState(company?.id ?? '');
  const [staffName, setStaffName] = useState('');
  const [prefix, setPrefix] = useState('');
  const [code, setCode] = useState<{ code: string; business: string; name: string } | null>(null);
  const status = syncStatus();
  const paid = licence?.mode === 'licensed' && !!licence.key && licence.key !== 'TEAM';
  const nameOf = (id: string) => companies.find((c) => c.id === id)?.name ?? 'Unknown business';

  function loadDevices() {
    if (!licence || status.role !== 'owner') return;
    listDevices(licence)
      .then((r) => {
        setDevices(r.devices);
      })
      .catch((e) => setMsg(e.message));
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(loadDevices, [status.role, licence]);

  async function act(fn: () => Promise<void>) {
    setBusy(true);
    setMsg('');
    try {
      await fn();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  if (!paid) {
    return (
      <Card>
        <h3 className="font-display font-bold text-brand-navy mb-2">Staff laptops</h3>
        <p className="text-sm text-gray-600">
          Connect your staff's laptops: each works for one of your businesses and can only make quotes, invoices and customers. Everything they do appears on this laptop automatically.
        </p>
        <p className="text-sm text-gray-600 mt-3">
          This needs a paid <strong>Enterprise</strong> or <strong>Accountant Partner</strong> licence. Buy a plan, then enter your key (on a computer: the <em>Licence</em> menu).
        </p>
      </Card>
    );
  }

  if (status.role !== 'owner') {
    return (
      <Card>
        <h3 className="font-display font-bold text-brand-navy mb-2 flex items-center gap-2"><Cloud size={18} /> Turn on online sync</h3>
        <p className="text-sm text-gray-600 mb-3">
          Your staff laptops and this laptop share records through setwelbusiness.co.za. A copy of the books of all {companies.length} business{companies.length === 1 ? '' : 'es'} on this laptop is kept on Setwel's server for this, and works as an online backup too. Laptops keep working without internet and catch up when they're back online.
        </p>
        <Field label="Name for this laptop">
          <Input value={laptopName} onChange={(e) => setLaptopName(e.target.value)} />
        </Field>
        {msg && <p className="text-sm text-status-overdue mb-3">{msg}</p>}
        <Button
          disabled={busy || !laptopName.trim()}
          onClick={() =>
            act(async () => {
              await setupOwner(licence!, laptopName.trim());
              restartSync();
              bumpRefresh();
            })
          }
        >
          {busy ? 'Uploading your books…' : 'Turn on online sync'}
        </Button>
      </Card>
    );
  }

  const staff = (devices ?? []).filter((d) => d.role === 'staff');

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display font-bold text-brand-navy flex items-center gap-2"><Cloud size={18} /> Online sync is on</h3>
            <p className="text-sm text-gray-500" key={syncTick}>
              {status.lastSync ? `Last synced ${new Date(status.lastSync).toLocaleString('en-ZA')}` : 'Not synced yet'}
              {status.error ? ` · ${status.error}` : ''}
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            disabled={busy}
            onClick={() =>
              act(async () => {
                const n = await syncNow(licence!);
                if (n > 0) bumpRefresh();
                loadDevices();
                setMsg(n > 0 ? `${n} change${n === 1 ? '' : 's'} came in from other laptops.` : 'Up to date.');
              })
            }
          >
            <RefreshCw size={15} /> Sync now
          </Button>
        </div>
      </Card>

      <Card>
        <h3 className="font-display font-bold text-brand-navy mb-1">Staff laptops</h3>
        <p className="text-sm text-gray-500 mb-4">Each staff laptop works for one business and can only open Quotes, Invoices and Customers, and send them by WhatsApp or email. It can't delete, record payments or see any reports.</p>
        {devices === null ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : staff.length === 0 ? (
          <p className="text-sm text-gray-400 mb-2">No staff laptops yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100 mb-2">
            {staff.map((d) => (
              <li key={d.id} className="py-3 flex items-center gap-3">
                <Laptop size={18} className="text-gray-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-brand-navy text-sm">{d.name} <span className="text-gray-400 font-normal">· invoices {'INV-' + d.prefix}-…</span></div>
                  <div className="text-xs text-gray-500">{nameOf(d.company_id)} · last online {d.last_seen ? new Date(d.last_seen).toLocaleString('en-ZA') : 'never'}</div>
                </div>
                <button
                  className="text-gray-400 hover:text-status-overdue p-1"
                  title={`Remove ${d.name}`}
                  aria-label={`Remove ${d.name}`}
                  onClick={() => {
                    if (!window.confirm(`Remove "${d.name}"? It stops syncing straight away and can no longer open the books.`)) return;
                    act(async () => {
                      await revokeDevice(licence!, d.id);
                      loadDevices();
                    });
                  }}
                >
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h3 className="font-display font-bold text-brand-navy mb-3">Add a staff laptop</h3>
        {code ? (
          <div>
            <p className="text-sm text-gray-600">On the staff laptop, install Setwel, press <strong>"This is a staff laptop"</strong> on the first screen and type this code:</p>
            <div className="my-4 text-center font-mono text-3xl font-bold tracking-[0.2em] text-brand-navy bg-brand-panel rounded-xl py-4">{code.code}</div>
            <p className="text-sm text-gray-500">For <strong>{code.name}</strong>, working for <strong>{code.business}</strong>. The code works once, within 48 hours.</p>
            <Button variant="secondary" size="sm" className="mt-3" onClick={() => { setCode(null); loadDevices(); }}>Done</Button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field label="Business it works for">
                <Select value={businessId} onChange={(e) => setBusinessId(e.target.value)}>
                  {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </Field>
              <Field label="Laptop or person">
                <Input value={staffName} onChange={(e) => setStaffName(e.target.value)} placeholder="e.g. Front desk, Thandi" />
              </Field>
              <Field label="Invoice code (1–4 letters)">
                <Input value={prefix} maxLength={4} onChange={(e) => setPrefix(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} placeholder="e.g. FD" />
              </Field>
            </div>
            <p className="text-xs text-gray-500 mb-3">Its invoices are numbered with the code, e.g. INV-{prefix || 'FD'}-00001, so numbers never clash between laptops.</p>
            <Button
              disabled={busy || !businessId || !staffName.trim() || !prefix}
              onClick={() =>
                act(async () => {
                  await syncNow(licence!); // make sure the business is on the server before the laptop joins
                  const r = await createLinkCode(licence!, businessId, staffName.trim(), prefix);
                  setCode({ code: r.code, business: nameOf(businessId), name: staffName.trim() });
                  setStaffName('');
                  setPrefix('');
                })
              }
            >
              Make a code
            </Button>
          </>
        )}
      </Card>

      {msg && <p className="text-sm text-gray-600">{msg}</p>}

      <button
        className="text-xs text-gray-400 underline"
        onClick={() => {
          if (!window.confirm('Stop syncing on this laptop? Staff laptops keep their records but stop reaching this laptop until you turn sync on again.')) return;
          disconnect();
          restartSync();
          bumpRefresh();
        }}
      >
        Stop online sync on this laptop
      </button>
    </div>
  );
}
