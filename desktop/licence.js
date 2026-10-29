/**
 * Trial and licence state for the desktop app.
 *
 * - The 30-day trial starts the first time the app opens. No sign-up.
 * - A paid licence is a short key (SETW-XXXX-XXXX-XXXX). The app swaps it
 *   once at setwelbusiness.co.za/api/licence.php for a signed token, then
 *   checks that token offline with the public key in licence-public.pem.
 * - Whenever the app is online it refreshes the token, so renewals (and
 *   referral free months) are picked up without the customer doing anything.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const TRIAL_DAYS = 30;
const GRACE_DAYS = 7; // keeps working for a week if a renewal is late or the PC is offline
const DAY = 24 * 60 * 60 * 1000;
const API = process.env.SETWEL_API || 'https://setwelbusiness.co.za/api/licence.php';

const PUBLIC_KEY = fs.readFileSync(path.join(__dirname, 'licence-public.pem'), 'utf8');

let stateFile;
let state;

function init(userDataDir) {
  stateFile = path.join(userDataDir, 'licence.json');
  try {
    state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  } catch {
    state = {};
  }
  const now = Date.now();
  if (!state.firstRun) state.firstRun = now;
  if (!state.deviceId) state.deviceId = 'dev_' + crypto.randomBytes(12).toString('hex'); // anonymous, for trial limits
  // If the clock was moved back to stretch the trial, count from the latest date seen.
  if (!state.lastSeen || now > state.lastSeen) state.lastSeen = now;
  save();
}

function save() {
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
}

function b64urlDecode(s) {
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

/** Returns the licence payload if the token's signature is genuine, else null. */
function readToken(token) {
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  try {
    const ok = crypto.verify(null, Buffer.from(body), PUBLIC_KEY, b64urlDecode(sig));
    return ok ? JSON.parse(b64urlDecode(body).toString('utf8')) : null;
  } catch {
    return null;
  }
}

function deviceId() {
  return state.deviceId;
}

function status() {
  const now = Math.max(Date.now(), state.lastSeen || 0);
  const licence = readToken(state.token);
  if (licence) {
    const paidUntil = Date.parse(licence.paid_until);
    if (now <= paidUntil + GRACE_DAYS * DAY) {
      return { mode: 'licensed', licence };
    }
    return { mode: 'expired', reason: 'renew', licence };
  }
  const used = Math.floor((now - state.firstRun) / DAY);
  const daysLeft = Math.max(0, TRIAL_DAYS - used);
  return daysLeft > 0 ? { mode: 'trial', daysLeft } : { mode: 'expired', reason: 'trial' };
}

async function fetchToken(key) {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key }),
    signal: AbortSignal.timeout(15000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.token) {
    throw new Error(data.error || 'We could not check that key. Check your internet connection and try again.');
  }
  if (!readToken(data.token)) throw new Error('That licence could not be verified.');
  return data.token;
}

function normaliseKey(key) {
  return String(key || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
    .replace(/^SETW/, '').replace(/(.{4})(?=.)/g, '$1-').replace(/^/, 'SETW-');
}

/** Activate with a key typed by the customer or passed in a setwel:// link. */
async function activate(key) {
  const clean = normaliseKey(key);
  if (!/^SETW-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(clean)) {
    throw new Error('A licence key looks like SETW-ABCD-EFGH-JKLM. Please check it and try again.');
  }
  state.token = await fetchToken(clean);
  state.key = clean;
  save();
  return status();
}

/** Staff laptop: the token comes from online sync, for the owner's plan. Ignored unless genuinely signed. */
function setTeamToken(token) {
  const payload = readToken(token);
  if (!payload || payload.key !== 'TEAM') return status();
  state.token = token;
  delete state.key; // nothing to refresh by key: every sync brings a fresh token
  save();
  return status();
}

/** Silent background refresh. Never throws; keeps the old token if offline. */
async function refresh() {
  if (!state.key) return status();
  try {
    state.token = await fetchToken(state.key);
    save();
  } catch {
    // offline or server unreachable: the stored token (plus grace period) still applies
  }
  return status();
}

module.exports = { init, status, activate, refresh, setTeamToken, normaliseKey, deviceId };
