// Calls to the Setwel server (setwelbusiness.co.za/api/...), used for AI receipt
// scanning and sending emails. The customer's business data stays on their device;
// only the receipt photo or the email being sent goes to the server.
//
// Desktop goes through the Electron main process (no browser CORS rules apply there);
// the phone version runs on setwelbusiness.co.za itself, so a plain same-site fetch works.

import { LicenceInfo } from './licence';
import { getMetaValue } from '../db/repository';

export class ApiError extends Error {
  constructor(message: string, public status: number, public code?: string) {
    super(message);
  }
}

export async function apiPost<T = any>(path: string, body: Record<string, unknown>, licence: LicenceInfo): Promise<T> {
  // A staff laptop has no licence key of its own: its sync connection stands for the owner's licence
  const sync = getMetaValue('syncRole') === 'staff' ? getMetaValue('syncToken') ?? '' : '';
  const payload = { ...body, key: licence.key === 'TEAM' ? '' : licence.key ?? '', device: licence.deviceId, sync };
  const desktop = window.setwelDesktop;
  let status: number;
  let data: any;
  if (desktop?.apiPost) {
    const res = await desktop.apiPost(path, payload);
    status = res.status;
    data = res.data;
  } else {
    let res: Response;
    try {
      res = await fetch(`/api/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch {
      throw new ApiError('No internet connection. Please try again when you are online.', 0);
    }
    status = res.status;
    data = await res.json().catch(() => ({}));
  }
  if (status < 200 || status >= 300 || data?.error) {
    throw new ApiError(data?.error || 'Something went wrong. Please try again.', status, data?.code);
  }
  return data as T;
}
