const express = require('express');
const config = require('../config');
const { db, getSettings } = require('../db');
const { layout, csrfField } = require('../views/layout');
const { orgTypes } = require('../views/shop');
const { html, raw, money, flash, clean, isEmail, hashPassword, checkPassword, token, rateLimit } = require('../util');
const { sendMail } = require('../email');
const { addToCart, statusText } = require('./cart');

const router = express.Router();
const safeNext = (n) => (typeof n === 'string' && /^\/[a-z0-9/_-]*$/i.test(n) ? n : '/account');

function page(req, res, title, body) {
  res.send(layout(req, { title, noindex: true, body: html`<div class="wrap section narrow">${body}</div>` }));
}

router.get('/account', (req, res) => {
  if (!req.session.customerId) {
    return page(req, res, 'Business accounts', html`
      <h1>Business accounts</h1>
      <p>For clinics, GP and dental practices, pharmacies, care homes, schools, home-care nurses and facilities.</p>
      <ul><li>Pay by bank EFT (once approved)</li><li>Order history and one-click re-ordering</li><li>Download invoices any time</li></ul>
      <p><a class="btn" href="/account/register">Apply for an account</a> <a class="btn btn--ghost" href="/account/login">Log in</a></p>
      <p class="muted">You don't need an account to buy — guest checkout is always available.</p>`);
  }
  const c = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.session.customerId);
  if (!c) { delete req.session.customerId; return res.redirect('/account/login'); }
  const orders = db.prepare('SELECT * FROM orders WHERE customer_id = ? ORDER BY id DESC LIMIT 100').all(c.id);
  page(req, res, 'My account', html`
    <h1>${c.org_name || c.name}</h1>
    <p>Account status: <b>${{ pending: 'Pending approval', approved: 'Approved — EFT payment available', rejected: 'Not approved — card payment only' }[c.status]}</b></p>
    <h2>Order history</h2>
    ${orders.length ? html`<div class="table-wrap"><table class="specs orders">
      <thead><tr><th>Order</th><th>Date</th><th>Total</th><th>Status</th><th></th></tr></thead>
      <tbody>${orders.map((o) => html`<tr>
        <td><a href="/order/${o.number}">${o.number}</a></td><td>${o.created_at.slice(0, 10)}</td><td>${money(o.total_cents)}</td><td>${statusText(o)}</td>
        <td class="actions"><a href="/order/${o.number}/invoice.pdf">Invoice</a>
          <form method="post" action="/account/reorder/${o.number}">${csrfField(req)}<button class="linkbtn">Re-order</button></form></td></tr>`)}</tbody>
    </table></div>` : html`<p>No orders yet. <a href="/shop">Start shopping</a></p>`}
    <form method="post" action="/account/logout">${csrfField(req)}<button class="btn btn--ghost btn--sm">Log out</button></form>`);
});

router.post('/account/reorder/:number', (req, res) => {
  const o = db.prepare('SELECT id FROM orders WHERE number = ? AND customer_id = ?').get(req.params.number, req.session.customerId || -1);
  if (!o) return res.redirect('/account');
  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(o.id);
  const skipped = [];
  for (const it of items) {
    const r = addToCart(req, it.variant_id, it.qty);
    if (!r.ok) skipped.push(it.name);
  }
  flash(req, 'ok', 'Items from your previous order were added to your cart. Prices are today\'s prices.');
  if (skipped.length) flash(req, 'error', `Not available right now: ${skipped.join(', ')}`);
  res.redirect('/cart');
});

// ---------- Register ----------
function registerForm(req, v = {}) {
  return html`<h1>Apply for a business account</h1>
    <p>We check each application (usually within one business day). Once approved you can pay by EFT.</p>
    <form method="post" action="/account/register" class="form">
      ${csrfField(req)}
      <label>Practice / organisation name *<input name="org_name" required maxlength="160" value="${v.org_name || ''}"></label>
      <label>Type of organisation *<select name="org_type" required><option value="">Choose…</option>${orgTypes.map((t) => html`<option ${v.org_type === t ? raw('selected') : ''}>${t}</option>`)}</select></label>
      <label>Practice / registration number (optional)<input name="practice_no" maxlength="60" value="${v.practice_no || ''}"></label>
      <label>Contact person *<input name="name" required maxlength="120" autocomplete="name" value="${v.name || ''}"></label>
      <div class="form__2">
        <label>Email *<input type="email" name="email" required maxlength="160" autocomplete="email" value="${v.email || ''}"></label>
        <label>Phone *<input type="tel" name="phone" required maxlength="30" autocomplete="tel" value="${v.phone || ''}"></label>
      </div>
      <label>Billing address *<textarea name="billing_address" rows="3" required maxlength="400">${v.billing_address || ''}</textarea></label>
      <label>Password * (at least 8 characters)<input type="password" name="password" required minlength="8" autocomplete="new-password"></label>
      <label class="check"><input type="checkbox" name="consent" value="1" required> I agree to the <a href="/terms">Terms</a> and to my details being used to manage this account (<a href="/privacy-policy">Privacy Policy</a>).</label>
      <button class="btn btn--wide">Apply</button>
    </form>
    <p>Already have an account? <a href="/account/login">Log in</a></p>`;
}
router.get('/account/register', (req, res) => page(req, res, 'Apply for a business account', registerForm(req)));
router.post('/account/register', rateLimit({ windowMs: 3600000, max: 10 }), async (req, res) => {
  const b = req.body;
  const v = {};
  for (const f of ['org_name', 'org_type', 'practice_no', 'name', 'email', 'phone', 'billing_address']) v[f] = clean(b[f], 400);
  v.email = v.email.toLowerCase();
  let err = '';
  if (!v.org_name || !orgTypes.includes(v.org_type) || !v.name || !isEmail(v.email) || !v.phone || !v.billing_address) err = 'Please fill in all required fields.';
  else if (String(b.password || '').length < 8) err = 'Password must be at least 8 characters.';
  else if (b.consent !== '1') err = 'Please accept the terms.';
  else if (db.prepare('SELECT 1 FROM customers WHERE email = ?').get(v.email)) err = 'An account with this email already exists. Please log in or reset your password.';
  if (err) { flash(req, 'error', err); return page(req, res, 'Apply for a business account', registerForm(req, v)); }
  const info = db.prepare(`INSERT INTO customers (email, password_hash, name, phone, org_name, org_type, practice_no, billing_address)
    VALUES (?,?,?,?,?,?,?,?)`).run(v.email, hashPassword(String(b.password)), v.name, v.phone, v.org_name, v.org_type, v.practice_no, v.billing_address);
  req.regenerateSession();
  req.session.customerId = Number(info.lastInsertRowid);
  await sendMail({ to: config.mail.adminTo, subject: `New business account application: ${v.org_name}`,
    html: String(html`<p>${v.org_name} (${v.org_type}) — ${v.name}, ${v.email}, ${v.phone}. Practice no: ${v.practice_no}</p>
      <p><a href="${config.baseUrl}/admin/customers">Approve or reject in admin</a></p>`) });
  flash(req, 'ok', 'Thank you — your application was received. You can order now with card payment; EFT is available once we approve your account.');
  res.redirect('/account');
});

// ---------- Login / logout ----------
const loginForm = (req, next = '') => html`<h1>Log in</h1>
  <form method="post" action="/account/login" class="form">
    ${csrfField(req)}<input type="hidden" name="next" value="${next}">
    <label>Email<input type="email" name="email" required autocomplete="email"></label>
    <label>Password<input type="password" name="password" required autocomplete="current-password"></label>
    <button class="btn btn--wide">Log in</button>
  </form>
  <p><a href="/account/forgot">Forgot your password?</a> · <a href="/account/register">Apply for an account</a></p>`;
router.get('/account/login', (req, res) => page(req, res, 'Log in', loginForm(req, safeNext(req.query.next))));
router.post('/account/login', rateLimit({ windowMs: 15 * 60000, max: 10 }), (req, res) => {
  const c = db.prepare('SELECT * FROM customers WHERE email = ?').get(clean(req.body.email, 160).toLowerCase());
  if (!c || !checkPassword(req.body.password || '', c.password_hash)) {
    flash(req, 'error', 'Email or password is incorrect.');
    return page(req, res, 'Log in', loginForm(req, safeNext(req.body.next)));
  }
  req.regenerateSession();
  req.session.customerId = c.id;
  res.redirect(safeNext(req.body.next));
});
router.post('/account/logout', (req, res) => { delete req.session.customerId; req.regenerateSession(); res.redirect('/'); });

// ---------- Password reset ----------
router.get('/account/forgot', (req, res) => page(req, res, 'Reset password', html`<h1>Reset your password</h1>
  <form method="post" action="/account/forgot" class="form">${csrfField(req)}
    <label>Email<input type="email" name="email" required autocomplete="email"></label><button class="btn">Email me a reset link</button></form>`));
router.post('/account/forgot', rateLimit({ windowMs: 3600000, max: 5 }), async (req, res) => {
  const c = db.prepare('SELECT * FROM customers WHERE email = ?').get(clean(req.body.email, 160).toLowerCase());
  if (c) {
    const t = token(24);
    db.prepare('UPDATE customers SET reset_token = ?, reset_expires = ? WHERE id = ?').run(t, Date.now() + 3600000, c.id);
    await sendMail({ to: c.email, subject: 'Reset your password',
      html: String(html`<p>Hi ${c.name},</p><p><a href="${config.baseUrl}/account/reset/${t}">Click here to set a new password</a>. The link works for 1 hour.</p><p>If you didn't ask for this, ignore this email.</p>`) });
  }
  flash(req, 'ok', 'If that email has an account, we sent a reset link.');
  res.redirect('/account/login');
});
router.get('/account/reset/:t', (req, res) => {
  const c = db.prepare('SELECT id FROM customers WHERE reset_token = ? AND reset_expires > ?').get(req.params.t, Date.now());
  if (!c) { flash(req, 'error', 'That reset link has expired. Please request a new one.'); return res.redirect('/account/forgot'); }
  page(req, res, 'New password', html`<h1>Choose a new password</h1><form method="post" action="/account/reset/${req.params.t}" class="form">${csrfField(req)}
    <label>New password (at least 8 characters)<input type="password" name="password" minlength="8" required autocomplete="new-password"></label><button class="btn">Save password</button></form>`);
});
router.post('/account/reset/:t', (req, res) => {
  const c = db.prepare('SELECT id FROM customers WHERE reset_token = ? AND reset_expires > ?').get(req.params.t, Date.now());
  if (!c || String(req.body.password || '').length < 8) { flash(req, 'error', 'Link expired or password too short.'); return res.redirect('/account/forgot'); }
  db.prepare('UPDATE customers SET password_hash = ?, reset_token = NULL, reset_expires = NULL WHERE id = ?').run(hashPassword(String(req.body.password)), c.id);
  req.regenerateSession();
  req.session.customerId = c.id;
  flash(req, 'ok', 'Password updated.');
  res.redirect('/account');
});

module.exports = router;
