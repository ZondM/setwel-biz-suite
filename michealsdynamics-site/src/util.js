const crypto = require('crypto');
const { db } = require('./db');
const config = require('./config');

// ---------- HTML templating: everything interpolated is escaped unless wrapped in raw() ----------
class Raw { constructor(s) { this.s = s; } toString() { return this.s; } }
const raw = (s) => new Raw(String(s ?? ''));
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ESC[c]);
function renderVal(v) {
  if (v === null || v === undefined || v === false) return '';
  if (v instanceof Raw) return v.s;
  if (Array.isArray(v)) return v.map(renderVal).join('');
  return esc(String(v));
}
function html(strings, ...vals) {
  let out = '';
  strings.forEach((s, i) => { out += s; if (i < vals.length) out += renderVal(vals[i]); });
  return new Raw(out);
}

// ---------- Money ----------
function money(cents) {
  if (cents === null || cents === undefined) return '';
  const [r, c] = (Math.round(cents) / 100).toFixed(2).split('.');
  return 'R' + r.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '.' + c;
}
function parseRandToCents(v) {
  const s = String(v ?? '').replace(/[R\s,]/gi, '');
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
}

// Bulk tiers "10:5, 50:10" -> [{min:10,pct:5},{min:50,pct:10}] sorted
function parseTiers(str) {
  return String(str || '').split(',').map((t) => t.split(':').map((x) => Number(x.trim())))
    .filter(([min, pct]) => Number.isInteger(min) && min > 1 && pct > 0 && pct < 100)
    .map(([min, pct]) => ({ min, pct })).sort((a, b) => a.min - b.min);
}
function tierFor(tiers, qty) {
  let best = null;
  for (const t of tiers) if (qty >= t.min) best = t;
  return best;
}

function slugify(s) {
  return String(s).toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-').slice(0, 80) || 'item';
}
const token = (bytes = 24) => crypto.randomBytes(bytes).toString('hex');

// ---------- Passwords (scrypt) ----------
function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  return salt + ':' + crypto.scryptSync(pw, salt, 64).toString('hex');
}
function checkPassword(pw, stored) {
  const [salt, hash] = String(stored).split(':');
  if (!salt || !hash) return false;
  const a = crypto.scryptSync(String(pw), salt, 64);
  const b = Buffer.from(hash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ---------- Sessions (stored in the database, cookie holds a random id) ----------
const SESSION_DAYS = 30;
function parseCookies(header) {
  const out = {};
  for (const part of String(header || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}
function sessionMiddleware(req, res, next) {
  const sid = parseCookies(req.headers.cookie).sid;
  let row = sid && /^[a-f0-9]{48}$/.test(sid) ? db.prepare('SELECT * FROM sessions WHERE id = ? AND expires > ?').get(sid, Date.now()) : null;
  req.session = row ? JSON.parse(row.data) : {};
  req.sessionId = row ? row.id : null;
  const original = JSON.stringify(req.session);
  req.saveSession = () => {
    const data = JSON.stringify(req.session);
    if (!req.sessionId) {
      req.sessionId = token(24);
      res.append('Set-Cookie', `sid=${req.sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}${config.production ? '; Secure' : ''}`);
    }
    db.prepare('INSERT INTO sessions (id, data, expires) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data, expires = excluded.expires')
      .run(req.sessionId, data, Date.now() + SESSION_DAYS * 86400000);
  };
  // New session id on login to prevent session fixation.
  req.regenerateSession = () => {
    if (req.sessionId) db.prepare('DELETE FROM sessions WHERE id = ?').run(req.sessionId);
    req.sessionId = null;
    req.session = { cart: req.session.cart || {}, csrf: token(16) };
  };
  const end = res.end;
  res.end = function (...args) {
    try { if (JSON.stringify(req.session) !== original) req.saveSession(); } catch (e) { console.error(e); }
    return end.apply(this, args);
  };
  // Make sure Set-Cookie for a brand-new session goes out before headers are sent.
  const writeHead = res.writeHead;
  res.writeHead = function (...args) {
    if (!req.sessionId && JSON.stringify(req.session) !== original) req.saveSession();
    return writeHead.apply(this, args);
  };
  next();
}
// Clean up expired sessions now and then.
setInterval(() => db.prepare('DELETE FROM sessions WHERE expires < ?').run(Date.now()), 6 * 3600000).unref();

// ---------- CSRF ----------
function csrfToken(req) {
  if (!req.session.csrf) req.session.csrf = token(16);
  return req.session.csrf;
}
function verifyCsrf(req) {
  const sent = (req.body && req.body._csrf) || req.get('x-csrf-token');
  return Boolean(sent && req.session.csrf && sent.length === req.session.csrf.length &&
    crypto.timingSafeEqual(Buffer.from(sent), Buffer.from(req.session.csrf)));
}
// For urlencoded forms. Multipart forms call verifyCsrf after multer has parsed the body.
function csrfProtect(req, res, next) {
  if (req.method !== 'POST' || req.is('multipart/form-data')) return next();
  if (!verifyCsrf(req)) return res.status(403).send('Your session expired. Please go back, refresh the page and try again.');
  next();
}

// ---------- Flash messages ----------
function flash(req, type, text) { (req.session.flash ||= []).push({ type, text }); }
function takeFlash(req) { const f = req.session.flash || []; if (f.length) delete req.session.flash; return f; }

// ---------- Simple rate limit (per IP, in memory) ----------
function rateLimit({ windowMs, max }) {
  const hits = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip + req.path;
    const h = (hits.get(key) || []).filter((t) => now - t < windowMs);
    if (h.length >= max) return res.status(429).send('Too many attempts. Please wait a few minutes and try again.');
    h.push(now); hits.set(key, h);
    next();
  };
}

const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || ''));
const clean = (s, max = 500) => String(s ?? '').trim().slice(0, max);

module.exports = {
  html, raw, esc, money, parseRandToCents, parseTiers, tierFor, slugify, token,
  hashPassword, checkPassword, sessionMiddleware, csrfToken, verifyCsrf, csrfProtect,
  flash, takeFlash, rateLimit, isEmail, clean,
};
