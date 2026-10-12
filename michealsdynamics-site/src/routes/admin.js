// Admin panel: /admin
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const multer = require('multer');
const config = require('../config');
const { db, getSettings, setSetting, tx, DEFAULT_SETTINGS } = require('../db');
const shop = require('../shop');
const orders = require('../orders');
const pay = require('./payments');
const { invoicePdf } = require('../invoice');
const { html, raw, money, parseRandToCents, slugify, flash, takeFlash, clean, hashPassword, checkPassword, csrfToken, verifyCsrf, rateLimit } = require('../util');
const { statusText } = require('./cart');

const router = express.Router();

// ---------- Layout ----------
function page(req, title, body) {
  const flashes = takeFlash(req);
  const nav = [['/admin', 'Dashboard'], ['/admin/orders', 'Orders'], ['/admin/products', 'Products'], ['/admin/stock', 'Prices & stock'],
    ['/admin/categories', 'Categories'], ['/admin/customers', 'Business accounts'], ['/admin/quotes', 'Quotes'], ['/admin/messages', 'Messages'], ['/admin/settings', 'Settings']];
  return String(html`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="robots" content="noindex"><title>${title} · Admin</title><link rel="stylesheet" href="/css/site.css"><link rel="stylesheet" href="/css/admin.css"></head>
  <body class="admin">
  ${req.session.adminId ? html`<header class="adm-head"><a href="/admin" class="adm-brand">Micheals Dynamics · Admin</a>
    <details class="adm-menu"><summary>Menu</summary><nav>${nav.map(([h, l]) => html`<a href="${h}">${l}</a>`)}<a href="/" target="_blank">View shop ↗</a>
    <form method="post" action="/admin/logout"><input type="hidden" name="_csrf" value="${csrfToken(req)}"><button class="linkbtn">Log out</button></form></nav></details></header>` : ''}
  <main class="adm-main">${flashes.map((f) => html`<p class="flash flash--${f.type}">${f.text}</p>`)}${body}</main>
  <script src="/js/admin.js" defer></script></body></html>`);
}
const csrf = (req) => html`<input type="hidden" name="_csrf" value="${csrfToken(req)}">`;

// ---------- Auth ----------
if (config.admin.email && config.admin.password && !db.prepare('SELECT 1 FROM admins').get()) {
  db.prepare('INSERT INTO admins (email, password_hash) VALUES (?, ?)').run(config.admin.email.toLowerCase(), hashPassword(config.admin.password));
}

router.get('/login', (req, res) => {
  res.send(page(req, 'Log in', html`<div class="narrow"><h1>Admin log in</h1>
    ${!db.prepare('SELECT 1 FROM admins').get() ? html`<p class="flash flash--error">No admin user yet. Set ADMIN_EMAIL and ADMIN_PASSWORD in the .env file and restart the site.</p>` : ''}
    <form method="post" action="/admin/login" class="form">${csrf(req)}
    <label>Email<input type="email" name="email" required autocomplete="username"></label>
    <label>Password<input type="password" name="password" required autocomplete="current-password"></label>
    <button class="btn btn--wide">Log in</button></form></div>`));
});
router.post('/login', rateLimit({ windowMs: 15 * 60000, max: 8 }), (req, res) => {
  const a = db.prepare('SELECT * FROM admins WHERE email = ?').get(clean(req.body.email, 160).toLowerCase());
  if (!a || !checkPassword(req.body.password || '', a.password_hash)) { flash(req, 'error', 'Wrong email or password.'); return res.redirect('/admin/login'); }
  req.regenerateSession();
  req.session.adminId = a.id;
  res.redirect('/admin');
});
router.post('/logout', (req, res) => { delete req.session.adminId; req.regenerateSession(); res.redirect('/admin/login'); });

router.use((req, res, next) => {
  if (!req.session.adminId || !db.prepare('SELECT 1 FROM admins WHERE id = ?').get(req.session.adminId)) return res.redirect('/admin/login');
  res.set('Cache-Control', 'no-store');
  next();
});

// ---------- Dashboard ----------
router.get('/', (req, res) => {
  const s = getSettings();
  const n = (sql, ...p) => db.prepare(sql).get(...p).n;
  const unpriced = n('SELECT COUNT(*) AS n FROM variants v JOIN products p ON p.id = v.product_id WHERE p.published = 1 AND v.price_cents IS NULL');
  const noPhoto = n('SELECT COUNT(*) AS n FROM products p WHERE p.published = 1 AND NOT EXISTS (SELECT 1 FROM product_images i WHERE i.product_id = p.id)');
  const checklist = [
    [pay.payfastEnabled() || pay.yocoEnabled(), 'Online payments (PayFast or Yoco) connected', 'Add your PayFast or Yoco keys to the .env file (see README).'],
    [Boolean(config.mail.host), 'Email sending set up', 'Add SMTP details to the .env file. Until then emails are saved in data/outbox.'],
    [s.local_fee !== '' && s.national_fee !== '', 'Delivery prices set', 'Settings → Delivery.'],
    [Boolean(s.bank_account_no), 'Bank details for EFT set', 'Settings → Bank details.'],
    [unpriced === 0, `All products have prices (${unpriced} options still "Price on request")`, 'Prices & stock page.'],
    [noPhoto === 0, `All products have photos (${noPhoto} without)`, 'Products → edit → upload photos.'],
    [Boolean(s.hours && s.directors && s.info_officer), 'Trading hours, directors and Information Officer filled in', 'Settings → Business details.'],
  ];
  const low = shop.lowStockVariants();
  const toShip = db.prepare("SELECT * FROM orders WHERE payment_status = 'paid' AND status IN ('new','processing') ORDER BY id").all();
  const awaitingEft = db.prepare("SELECT * FROM orders WHERE payment_method = 'eft' AND payment_status = 'pending' AND status != 'cancelled' ORDER BY id").all();
  res.send(page(req, 'Dashboard', html`<h1>Dashboard</h1>
    <div class="stats">
      <a href="/admin/orders?view=toship" class="stat"><b>${toShip.length}</b><span>Paid — to dispatch</span></a>
      <a href="/admin/orders?view=eft" class="stat"><b>${awaitingEft.length}</b><span>Awaiting EFT</span></a>
      <a href="/admin/stock?low=1" class="stat"><b>${low.length}</b><span>Low stock</span></a>
      <a href="/admin/customers" class="stat"><b>${n("SELECT COUNT(*) AS n FROM customers WHERE status = 'pending'")}</b><span>Accounts to approve</span></a>
      <a href="/admin/quotes" class="stat"><b>${n("SELECT COUNT(*) AS n FROM quotes WHERE status = 'new'")}</b><span>New quotes</span></a>
      <a href="/admin/messages" class="stat"><b>${n("SELECT COUNT(*) AS n FROM messages WHERE status = 'new'")}</b><span>New messages</span></a>
    </div>
    ${checklist.some((c) => !c[0]) ? html`<section class="box"><h2>Launch checklist</h2><ul class="plain checklist">
      ${checklist.map(([ok, label, how]) => html`<li class="${ok ? 'done' : 'todo'}">${ok ? '✓' : '○'} ${label}${ok ? '' : html` — <span class="muted">${how}</span>`}</li>`)}</ul></section>` : ''}
    ${toShip.length ? html`<section class="box"><h2>Ready to dispatch</h2>${orderTable(toShip)}</section>` : ''}
    ${low.length ? html`<section class="box"><h2>Low stock</h2><ul class="plain">${low.slice(0, 15).map((v) => html`<li>${v.product_name} — ${v.label}: <b>${v.stock}</b></li>`)}</ul><a href="/admin/stock?low=1">Update stock</a></section>` : ''}`));
});

// ---------- Orders ----------
function orderTable(list) {
  return html`<div class="table-wrap"><table class="tbl"><thead><tr><th>Order</th><th>Date</th><th>Customer</th><th>Total</th><th>Payment</th><th>Status</th></tr></thead><tbody>
    ${list.map((o) => html`<tr><td><a href="/admin/orders/${o.id}"><b>${o.number}</b></a></td><td>${o.created_at.slice(0, 16)}</td><td>${o.org_name || o.name}<br><span class="muted">${o.city} ${o.postal_code}</span></td>
      <td>${money(o.total_cents)}</td><td>${o.payment_method.toUpperCase()} · ${o.payment_status}</td><td>${statusText(o)}</td></tr>`)}
  </tbody></table></div>`;
}
router.get('/orders', (req, res) => {
  const view = req.query.view || 'all';
  const where = { all: '1=1', toship: "payment_status = 'paid' AND status IN ('new','processing')", eft: "payment_method = 'eft' AND payment_status = 'pending' AND status != 'cancelled'",
    unpaid: "payment_status != 'paid' AND status != 'cancelled'", shipped: "status = 'shipped'", done: "status IN ('delivered','cancelled')" }[view] || '1=1';
  const q = clean(req.query.q, 80);
  const list = db.prepare(`SELECT * FROM orders WHERE ${where} ${q ? 'AND (number LIKE ? OR name LIKE ? OR org_name LIKE ? OR email LIKE ?)' : ''} ORDER BY id DESC LIMIT 200`)
    .all(...(q ? Array(4).fill(`%${q}%`) : []));
  const tabs = [['all', 'All'], ['toship', 'To dispatch'], ['eft', 'Awaiting EFT'], ['unpaid', 'Unpaid'], ['shipped', 'Shipped'], ['done', 'Done / cancelled']];
  res.send(page(req, 'Orders', html`<h1>Orders</h1>
    <nav class="tabs">${tabs.map(([k, l]) => html`<a href="/admin/orders?view=${k}" class="${view === k ? 'on' : ''}">${l}</a>`)}</nav>
    <form class="inline" method="get"><input type="hidden" name="view" value="${view}"><input name="q" value="${q}" placeholder="Search order no, name, email"><button class="btn btn--sm">Search</button></form>
    ${list.length ? orderTable(list) : html`<p>No orders here.</p>`}`));
});

router.get('/orders/:id', (req, res, next) => {
  const o = shop.getOrder(Number(req.params.id));
  if (!o) return next();
  const couriers = String(getSettings().tracking_urls || '').split(/\r?\n/).map((l) => l.split('|')[0].trim()).filter(Boolean);
  res.send(page(req, o.number, html`<p><a href="/admin/orders">← Orders</a></p>
    <h1>Order ${o.number}</h1>
    <p><b>${statusText(o)}</b> · ${o.payment_method.toUpperCase()} · payment ${o.payment_status}${o.payment_ref ? ` (${o.payment_ref})` : ''} · placed ${o.created_at}</p>
    <div class="cols">
      <section class="box"><h2>Customer</h2><p>${o.org_name ? html`<b>${o.org_name}</b><br>` : ''}${o.name}<br><a href="mailto:${o.email}">${o.email}</a><br><a href="tel:${o.phone}">${o.phone}</a>
        ${o.customer_id ? html`<br><span class="muted">Business account #${o.customer_id}</span>` : html`<br><span class="muted">Guest</span>`}</p>
        <h2>Deliver to</h2><p>${o.delivery_label}<br>${o.address1}${o.address2 ? html`<br>${o.address2}` : ''}<br>${o.suburb}, ${o.city}<br>${o.province} ${o.postal_code}</p>
        ${o.notes ? html`<h2>Customer notes</h2><p>${o.notes}</p>` : ''}</section>
      <section class="box"><h2>Items</h2><table class="tbl">
        ${o.items.map((i) => html`<tr><td>${i.qty} ×</td><td>${i.name}${i.variant_label !== 'Standard' ? ` — ${i.variant_label}` : ''}<br><span class="muted">${i.sku}</span></td><td class="r">${money(i.line_total_cents)}</td></tr>`)}
        ${o.discount_cents ? html`<tr><td></td><td>Bulk discount</td><td class="r">−${money(o.discount_cents)}</td></tr>` : ''}
        <tr><td></td><td>Delivery</td><td class="r">${money(o.delivery_cents)}</td></tr>
        <tr><td></td><th>Total</th><th class="r">${money(o.total_cents)}</th></tr></table>
        <p><a href="/admin/orders/${o.id}/invoice.pdf" target="_blank">Invoice PDF</a></p></section>
    </div>
    <section class="box actions-box"><h2>Actions</h2>
      ${o.payment_status !== 'paid' && o.status !== 'cancelled' ? html`<form method="post" action="/admin/orders/${o.id}/paid" data-confirm="Mark ${o.number} as PAID? Only do this when the money is in your bank account.">${csrf(req)}
        <button class="btn">Mark as paid</button> <span class="muted">Use for EFT once the money reflects. Card payments are marked paid automatically.</span></form>` : ''}
      ${o.payment_status === 'paid' && o.status !== 'cancelled' ? html`<form method="post" action="/admin/orders/${o.id}/ship" class="form">${csrf(req)}
        <h3>Dispatch</h3>
        <div class="form__2"><label>Courier<input name="courier" list="couriers" value="${o.courier}" required placeholder="e.g. The Courier Guy"></label>
        <label>Tracking / waybill number<input name="tracking_no" value="${o.tracking_no}" placeholder="Leave empty for own delivery"></label></div>
        <datalist id="couriers">${couriers.map((c) => html`<option value="${c}">`)}<option value="Own delivery"><option value="Collected"></datalist>
        <button class="btn">${o.status === 'shipped' ? 'Update & re-send tracking email' : 'Mark as shipped & email customer'}</button></form>` : ''}
      ${o.status === 'shipped' ? html`<form method="post" action="/admin/orders/${o.id}/delivered">${csrf(req)}<button class="btn btn--ghost">Mark as delivered</button></form>` : ''}
      <form method="post" action="/admin/orders/${o.id}/resend">${csrf(req)}<button class="btn btn--ghost btn--sm">Email invoice to customer again</button></form>
      <form method="post" action="/admin/orders/${o.id}/notes" class="form">${csrf(req)}<label>Private notes<textarea name="admin_notes" rows="2">${o.admin_notes}</textarea></label><button class="btn btn--ghost btn--sm">Save notes</button></form>
      ${o.status !== 'cancelled' ? html`<form method="post" action="/admin/orders/${o.id}/cancel" data-confirm="Cancel ${o.number}? Stock will be put back. Refunds must be done in PayFast/Yoco or by EFT.">${csrf(req)}<button class="btn btn--danger btn--sm">Cancel order</button></form>` : ''}
    </section>`));
});
router.post('/orders/:id/paid', async (req, res) => { await orders.markPaid(Number(req.params.id), 'manual'); flash(req, 'ok', 'Marked as paid. Confirmation and invoice emailed to the customer.'); res.redirect(`/admin/orders/${req.params.id}`); });
router.post('/orders/:id/ship', async (req, res) => {
  await orders.markShipped(Number(req.params.id), clean(req.body.courier, 80), clean(req.body.tracking_no, 80));
  flash(req, 'ok', 'Marked as shipped. Tracking email sent.'); res.redirect(`/admin/orders/${req.params.id}`);
});
router.post('/orders/:id/delivered', (req, res) => { db.prepare("UPDATE orders SET status = 'delivered' WHERE id = ?").run(Number(req.params.id)); res.redirect(`/admin/orders/${req.params.id}`); });
router.post('/orders/:id/cancel', (req, res) => { orders.cancelOrder(Number(req.params.id)); flash(req, 'ok', 'Order cancelled and stock restored.'); res.redirect(`/admin/orders/${req.params.id}`); });
router.post('/orders/:id/notes', (req, res) => { db.prepare('UPDATE orders SET admin_notes = ? WHERE id = ?').run(clean(req.body.admin_notes, 2000), Number(req.params.id)); res.redirect(`/admin/orders/${req.params.id}`); });
router.post('/orders/:id/resend', async (req, res) => {
  const o = shop.getOrder(Number(req.params.id));
  const { sendMail } = require('../email');
  await sendMail({ to: o.email, subject: `Invoice for order ${o.number}`, html: `<p>Hi ${String(o.name).replace(/[<>&]/g, '')},</p><p>Please find your invoice attached.</p>`, attachments: [await orders.invoiceAttachment(o)] });
  flash(req, 'ok', 'Invoice emailed.'); res.redirect(`/admin/orders/${o.id}`);
});
router.get('/orders/:id/invoice.pdf', async (req, res, next) => {
  const o = shop.getOrder(Number(req.params.id));
  if (!o) return next();
  res.type('application/pdf').send(await invoicePdf(o));
});

// ---------- Prices & stock (quick edit for every product option) ----------
router.get('/stock', (req, res) => {
  const low = req.query.low === '1';
  const threshold = Number(getSettings().low_stock_threshold || 10);
  const rows = db.prepare(`SELECT v.*, p.name AS product_name, p.id AS pid, p.pack_qty FROM variants v JOIN products p ON p.id = v.product_id
    ${low ? 'WHERE v.stock <= ? AND v.price_cents IS NOT NULL' : ''} ORDER BY p.name, v.sort, v.id`).all(...(low ? [threshold] : []));
  res.send(page(req, 'Prices & stock', html`<h1>Prices &amp; stock</h1>
    <p>Change prices (in Rand, per pack) and stock, then press <b>Save all</b>. Leave price empty to show "Price on request".</p>
    <p><a href="/admin/stock">All</a> · <a href="/admin/stock?low=1">Low stock only</a></p>
    <form method="post" action="/admin/stock">${csrf(req)}
    <div class="table-wrap"><table class="tbl"><thead><tr><th>Product</th><th>Option</th><th>Price (R)</th><th>Stock</th></tr></thead><tbody>
    ${rows.map((v) => html`<tr class="${v.stock <= threshold && v.price_cents !== null ? 'warn' : ''}"><td><a href="/admin/products/${v.pid}">${v.product_name}</a></td><td>${v.label}</td>
      <td><input name="price[v${v.id}]" value="${v.price_cents === null ? '' : (v.price_cents / 100).toFixed(2)}" inputmode="decimal" size="8"></td>
      <td><input name="stock[v${v.id}]" value="${v.stock}" inputmode="numeric" size="5"></td></tr>`)}
    </tbody></table></div><button class="btn sticky-save">Save all</button></form>`));
});
router.post('/stock', (req, res) => {
  const price = req.body.price || {}, stock = req.body.stock || {};
  let bad = 0;
  tx(() => {
    for (const key of Object.keys(price)) {
      const cents = parseRandToCents(price[key]);
      if (String(price[key]).trim() !== '' && cents === null) { bad++; continue; }
      const st = parseInt(stock[key], 10);
      db.prepare('UPDATE variants SET price_cents = ?, stock = ? WHERE id = ?').run(cents, Number.isFinite(st) ? st : 0, Number(String(key).replace(/^v/, '')));
    }
  });
  flash(req, bad ? 'error' : 'ok', bad ? `Saved, but ${bad} price(s) were not valid numbers and were skipped.` : 'Prices and stock saved.');
  res.redirect('/admin/stock' + (req.query.low ? '?low=1' : ''));
});

// ---------- Products ----------
router.get('/products', (req, res) => {
  const q = clean(req.query.q, 80);
  const list = db.prepare(`SELECT p.*, c.name AS category_name,
      (SELECT COUNT(*) FROM variants v WHERE v.product_id = p.id) AS nvar,
      (SELECT COUNT(*) FROM variants v WHERE v.product_id = p.id AND v.price_cents IS NULL) AS nopr,
      (SELECT SUM(stock) FROM variants v WHERE v.product_id = p.id) AS stock,
      (SELECT filename FROM product_images i WHERE i.product_id = p.id ORDER BY sort, id LIMIT 1) AS img
    FROM products p LEFT JOIN categories c ON c.id = p.category_id ${q ? 'WHERE p.name LIKE ?' : ''} ORDER BY c.sort, p.name`).all(...(q ? [`%${q}%`] : []));
  res.send(page(req, 'Products', html`<h1>Products</h1>
    <p><a class="btn" href="/admin/products/new">+ Add product</a></p>
    <form class="inline" method="get"><input name="q" value="${q}" placeholder="Search products"><button class="btn btn--sm">Search</button></form>
    <div class="table-wrap"><table class="tbl"><thead><tr><th></th><th>Product</th><th>Category</th><th>Options</th><th>Stock</th><th>Shown</th></tr></thead><tbody>
    ${list.map((p) => html`<tr><td>${p.img ? html`<img src="/uploads/${p.img}" alt="" width="48" height="48">` : html`<span class="muted small">No photo</span>`}</td>
      <td><a href="/admin/products/${p.id}"><b>${p.name}</b></a>${p.nopr ? html`<br><span class="tag">${p.nopr} without price</span>` : ''}</td>
      <td>${p.category_name || '—'}</td><td>${p.nvar}</td><td>${p.stock ?? 0}</td><td>${p.published ? 'Yes' : 'Hidden'}</td></tr>`)}
    </tbody></table></div>`));
});

const imgTypes = ['.jpg', '.jpeg', '.png', '.webp'];
const productUpload = multer({
  storage: multer.diskStorage({
    destination: config.uploadDir,
    filename: (req, file, cb) => cb(null, crypto.randomBytes(10).toString('hex') + path.extname(file.originalname).toLowerCase()),
  }),
  limits: { fileSize: 10 * 1024 * 1024, files: 10 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, file.fieldname === 'datasheet' ? ext === '.pdf' : imgTypes.includes(ext));
  },
}).fields([{ name: 'images', maxCount: 8 }, { name: 'datasheet', maxCount: 1 }]);

function productForm(req, p, cats) {
  const variants = [...(p.variants || []), ...Array(3).fill({ id: '', label: '', sku: '', price_cents: null, stock: 0, weight_g: 0 })];
  return html`<p><a href="/admin/products">← Products</a></p>
  <h1>${p.id ? `Edit: ${p.name}` : 'Add product'}</h1>
  ${p.id ? html`<p><a href="/product/${p.slug}" target="_blank">View on shop ↗</a></p>` : ''}
  <form method="post" action="/admin/products/${p.id || 'new'}" enctype="multipart/form-data" class="form">
    ${csrf(req)}
    <section class="box"><h2>Basics</h2>
      <label>Product name *<input name="name" required maxlength="160" value="${p.name || ''}" placeholder="e.g. Nitrile Examination Gloves, Powder-Free (Box of 100)"></label>
      <div class="form__2">
        <label>Category<select name="category_id"><option value="">—</option>${cats.map((c) => html`<option value="${c.id}" ${p.category_id === c.id ? raw('selected') : ''}>${c.name}</option>`)}</select></label>
        <label>Brand<input name="brand" maxlength="80" value="${p.brand || ''}"></label>
      </div>
      <div class="form__2">
        <label>Material<input name="material" maxlength="80" value="${p.material || ''}" placeholder="e.g. Nitrile"></label>
        <label>Sterile?<select name="sterile"><option value="" ${p.sterile == null ? raw('selected') : ''}>Not applicable</option><option value="1" ${p.sterile === 1 ? raw('selected') : ''}>Sterile</option><option value="0" ${p.sterile === 0 ? raw('selected') : ''}>Non-sterile</option></select></label>
      </div>
      <div class="form__2">
        <label>Items per pack *<input name="pack_qty" type="number" min="1" required value="${p.pack_qty || 1}"></label>
        <label>Item name (singular)<input name="unit_label" maxlength="30" value="${p.unit_label || 'item'}" placeholder="glove, swab, syringe…"></label>
      </div>
      <label>Description<textarea name="description" rows="4" maxlength="4000">${p.description || ''}</textarea></label>
      <p class="muted small">Describe what the product is. No medical claims (e.g. don't write "prevents infection").</p>
      <label>Specifications (one per line, e.g. "Length: 240 mm")<textarea name="specs" rows="4" maxlength="4000">${p.specs || ''}</textarea></label>
      <label>Bulk discount tiers<input name="bulk_tiers" maxlength="100" value="${p.bulk_tiers || ''}" placeholder="10:5, 50:10"></label>
      <p class="muted small">"10:5, 50:10" means 10+ packs = 5% off, 50+ packs = 10% off. Leave empty for no bulk discount.</p>
      <label class="check"><input type="checkbox" name="bestseller" value="1" ${p.bestseller ? raw('checked') : ''}> Show in Bestsellers on the home page</label>
      <label class="check"><input type="checkbox" name="published" value="1" ${p.published !== 0 ? raw('checked') : ''}> Show on website</label>
    </section>

    <section class="box"><h2>Options, prices &amp; stock</h2>
      <p class="muted small">One row per size/volume/gauge. If there's only one option, call it "Standard". Price is per pack, in Rand. Empty price = "Price on request". Weight helps courier quotes.</p>
      <div class="table-wrap"><table class="tbl"><thead><tr><th>Option (size)</th><th>SKU</th><th>Price R</th><th>Stock</th><th>Weight g</th><th>Delete</th></tr></thead><tbody>
      ${variants.map((v, i) => html`<tr>
        <td><input type="hidden" name="variants[${i}][id]" value="${v.id}"><input name="variants[${i}][label]" value="${v.label}" size="10" placeholder="${i === 0 && !v.id ? 'Standard' : ''}"></td>
        <td><input name="variants[${i}][sku]" value="${v.sku}" size="10"></td>
        <td><input name="variants[${i}][price]" value="${v.price_cents === null ? '' : (v.price_cents / 100).toFixed(2)}" inputmode="decimal" size="7"></td>
        <td><input name="variants[${i}][stock]" value="${v.stock}" inputmode="numeric" size="5"></td>
        <td><input name="variants[${i}][weight_g]" value="${v.weight_g}" inputmode="numeric" size="6"></td>
        <td>${v.id ? html`<input type="checkbox" name="variants[${i}][delete]" value="1" aria-label="Delete option">` : ''}</td></tr>`)}
      </tbody></table></div>
      <p class="muted small">Need more rows? Save, then edit again — 3 empty rows are added each time.</p>
    </section>

    <section class="box"><h2>Photos &amp; data sheet</h2>
      ${(p.images || []).length ? html`<div class="thumbs-adm">${p.images.map((im) => html`<label><img src="/uploads/${im.filename}" alt="" width="96" height="96"><span><input type="checkbox" name="delete_images[]" value="${im.id}"> delete</span></label>`)}</div>` : html`<p class="muted">No photos yet — a "photo coming soon" picture is shown.</p>`}
      <label>Add photos (JPG, PNG or WebP; square, about 1200×1200 px, under 500 KB each is best)<input type="file" name="images" multiple accept=".jpg,.jpeg,.png,.webp"></label>
      ${p.datasheet ? html`<p>Data sheet: <a href="/uploads/${p.datasheet}" target="_blank">current PDF</a> <label class="check"><input type="checkbox" name="delete_datasheet" value="1"> remove</label></p>` : ''}
      <label>Data sheet (PDF)<input type="file" name="datasheet" accept=".pdf"></label>
    </section>

    <section class="box"><h2>Google (optional)</h2>
      <label>Page title<input name="seo_title" maxlength="70" value="${p.seo_title || ''}" placeholder="Leave empty to use the product name"></label>
      <label>Description<input name="seo_description" maxlength="160" value="${p.seo_description || ''}"></label>
    </section>
    <button class="btn sticky-save">Save product</button>
  </form>
  ${p.id ? html`<form method="post" action="/admin/products/${p.id}/delete" data-confirm="Delete this product permanently? Past orders keep their details.">${csrf(req)}<button class="btn btn--danger btn--sm">Delete product</button></form>` : ''}`;
}

router.get('/products/new', (req, res) => res.send(page(req, 'Add product', productForm(req, { published: 1, pack_qty: 1 }, shop.categories()))));
router.get('/products/:id', (req, res, next) => {
  const p = db.prepare('SELECT * FROM products WHERE id = ?').get(Number(req.params.id));
  if (!p) return next();
  p.variants = shop.productVariants(p.id); p.images = shop.productImages(p.id);
  res.send(page(req, p.name, productForm(req, p, shop.categories())));
});

router.post('/products/:id', (req, res, next) => {
  productUpload(req, res, (err) => {
    if (err) { flash(req, 'error', err.code === 'LIMIT_FILE_SIZE' ? 'A file was too large (max 10 MB).' : 'Upload failed.'); return res.redirect(req.originalUrl); }
    next();
  });
}, (req, res) => {
  const uploaded = [...((req.files || {}).images || []), ...((req.files || {}).datasheet || [])];
  if (!verifyCsrf(req)) { uploaded.forEach((f) => fs.rmSync(f.path, { force: true })); return res.status(403).send('Session expired. Go back and refresh.'); }
  const b = req.body;
  const isNew = req.params.id === 'new';
  const name = clean(b.name, 160);
  if (!name) { flash(req, 'error', 'Product name is required.'); return res.redirect(req.originalUrl); }
  const fields = {
    name, category_id: Number(b.category_id) || null, brand: clean(b.brand, 80), material: clean(b.material, 80),
    sterile: b.sterile === '1' ? 1 : b.sterile === '0' ? 0 : null, pack_qty: Math.max(1, parseInt(b.pack_qty, 10) || 1),
    unit_label: clean(b.unit_label, 30) || 'item', description: clean(b.description, 4000), specs: clean(b.specs, 4000),
    bulk_tiers: clean(b.bulk_tiers, 100), bestseller: b.bestseller === '1' ? 1 : 0, published: b.published === '1' ? 1 : 0,
    seo_title: clean(b.seo_title, 70), seo_description: clean(b.seo_description, 160),
  };
  const id = tx(() => {
    let pid = Number(req.params.id);
    if (isNew) {
      let slug = slugify(name), n = 2;
      while (db.prepare('SELECT 1 FROM products WHERE slug = ?').get(slug)) slug = `${slugify(name)}-${n++}`;
      pid = Number(db.prepare(`INSERT INTO products (slug, ${Object.keys(fields).join(', ')}) VALUES (?, ${Object.keys(fields).map(() => '?').join(', ')})`)
        .run(slug, ...Object.values(fields)).lastInsertRowid);
    } else {
      db.prepare(`UPDATE products SET ${Object.keys(fields).map((k) => `${k} = ?`).join(', ')} WHERE id = ?`).run(...Object.values(fields), pid);
    }
    // Variants
    const rows = Object.values(b.variants || {});
    rows.forEach((v, i) => {
      const vid = Number(v.id) || null;
      const label = clean(v.label, 60);
      if (vid && v.delete === '1') { db.prepare('DELETE FROM variants WHERE id = ? AND product_id = ?').run(vid, pid); return; }
      if (!vid && !label && !clean(v.price) && !clean(v.sku)) return;
      const vals = [label || 'Standard', clean(v.sku, 60), parseRandToCents(v.price), parseInt(v.stock, 10) || 0, parseInt(v.weight_g, 10) || 0, i];
      if (vid) db.prepare('UPDATE variants SET label = ?, sku = ?, price_cents = ?, stock = ?, weight_g = ?, sort = ? WHERE id = ? AND product_id = ?').run(...vals, vid, pid);
      else db.prepare('INSERT INTO variants (label, sku, price_cents, stock, weight_g, sort, product_id) VALUES (?,?,?,?,?,?,?)').run(...vals, pid);
    });
    if (!db.prepare('SELECT 1 FROM variants WHERE product_id = ?').get(pid)) db.prepare("INSERT INTO variants (product_id, label) VALUES (?, 'Standard')").run(pid);
    // Images
    for (const imgId of [].concat(b.delete_images || [])) {
      const im = db.prepare('SELECT * FROM product_images WHERE id = ? AND product_id = ?').get(Number(imgId), pid);
      if (im) { fs.rmSync(path.join(config.uploadDir, im.filename), { force: true }); db.prepare('DELETE FROM product_images WHERE id = ?').run(im.id); }
    }
    for (const f of (req.files || {}).images || []) db.prepare('INSERT INTO product_images (product_id, filename, alt, sort) VALUES (?,?,?,?)').run(pid, f.filename, name, 100);
    const old = db.prepare('SELECT datasheet FROM products WHERE id = ?').get(pid).datasheet;
    const newSheet = ((req.files || {}).datasheet || [])[0];
    if ((newSheet || b.delete_datasheet === '1') && old) fs.rmSync(path.join(config.uploadDir, old), { force: true });
    if (newSheet) db.prepare('UPDATE products SET datasheet = ? WHERE id = ?').run(newSheet.filename, pid);
    else if (b.delete_datasheet === '1') db.prepare("UPDATE products SET datasheet = '' WHERE id = ?").run(pid);
    return pid;
  });
  flash(req, 'ok', 'Product saved.');
  res.redirect(`/admin/products/${id}`);
});

router.post('/products/:id/delete', (req, res) => {
  const pid = Number(req.params.id);
  for (const im of shop.productImages(pid)) fs.rmSync(path.join(config.uploadDir, im.filename), { force: true });
  const p = db.prepare('SELECT datasheet FROM products WHERE id = ?').get(pid);
  if (p && p.datasheet) fs.rmSync(path.join(config.uploadDir, p.datasheet), { force: true });
  db.prepare('DELETE FROM products WHERE id = ?').run(pid);
  flash(req, 'ok', 'Product deleted.');
  res.redirect('/admin/products');
});

// ---------- Categories ----------
router.get('/categories', (req, res) => {
  const cats = shop.categories();
  const row = (c, i) => html`<tr>
    <td><input type="hidden" name="cats[${i}][id]" value="${c.id || ''}"><input name="cats[${i}][name]" value="${c.name || ''}" size="16" placeholder="${c.id ? '' : 'New category'}"></td>
    <td><input name="cats[${i}][description]" value="${c.description || ''}" size="30"></td>
    <td><input name="cats[${i}][seo_title]" value="${c.seo_title || ''}" size="24"></td>
    <td><input name="cats[${i}][seo_description]" value="${c.seo_description || ''}" size="30"></td>
    <td><input name="cats[${i}][sort]" value="${c.sort ?? i}" size="3" inputmode="numeric"></td>
    <td>${c.id ? html`<input type="checkbox" name="cats[${i}][delete]" value="1" aria-label="Delete">` : ''}</td></tr>`;
  res.send(page(req, 'Categories', html`<h1>Categories</h1>
    <form method="post" action="/admin/categories">${csrf(req)}
    <div class="table-wrap"><table class="tbl"><thead><tr><th>Name</th><th>Short description</th><th>Google title</th><th>Google description</th><th>Order</th><th>Delete</th></tr></thead>
    <tbody>${[...cats, {}, {}].map(row)}</tbody></table></div>
    <p class="muted small">Deleting a category doesn't delete its products; they just become uncategorised.</p>
    <button class="btn">Save categories</button></form>`));
});
router.post('/categories', (req, res) => {
  tx(() => {
    for (const c of Object.values(req.body.cats || {})) {
      const id = Number(c.id) || null;
      const name = clean(c.name, 80);
      if (id && c.delete === '1') { db.prepare('DELETE FROM categories WHERE id = ?').run(id); continue; }
      if (!name) continue;
      const vals = [name, clean(c.description, 200), clean(c.seo_title, 70), clean(c.seo_description, 160), parseInt(c.sort, 10) || 0];
      if (id) db.prepare('UPDATE categories SET name = ?, description = ?, seo_title = ?, seo_description = ?, sort = ? WHERE id = ?').run(...vals, id);
      else {
        let slug = slugify(name), n = 2;
        while (db.prepare('SELECT 1 FROM categories WHERE slug = ?').get(slug)) slug = `${slugify(name)}-${n++}`;
        db.prepare('INSERT INTO categories (name, description, seo_title, seo_description, sort, slug) VALUES (?,?,?,?,?,?)').run(...vals, slug);
      }
    }
  });
  flash(req, 'ok', 'Categories saved.');
  res.redirect('/admin/categories');
});

// ---------- Business accounts ----------
router.get('/customers', (req, res) => {
  const list = db.prepare("SELECT c.*, (SELECT COUNT(*) FROM orders o WHERE o.customer_id = c.id) AS norders FROM customers c ORDER BY c.status = 'pending' DESC, c.id DESC").all();
  res.send(page(req, 'Business accounts', html`<h1>Business accounts</h1>
    <p class="muted">Approved accounts can pay by bank EFT. Check the practice before approving.</p>
    <div class="table-wrap"><table class="tbl"><thead><tr><th>Organisation</th><th>Contact</th><th>Practice no.</th><th>Orders</th><th>Status</th><th></th></tr></thead><tbody>
    ${list.map((c) => html`<tr><td><b>${c.org_name}</b><br><span class="muted">${c.org_type}</span><br><span class="muted small">${c.billing_address}</span></td>
      <td>${c.name}<br><a href="mailto:${c.email}">${c.email}</a><br>${c.phone}</td><td>${c.practice_no}</td><td>${c.norders}</td><td>${c.status}</td>
      <td><form method="post" action="/admin/customers/${c.id}" class="inline">${csrf(req)}
        ${c.status !== 'approved' ? html`<button class="btn btn--sm" name="status" value="approved">Approve</button>` : ''}
        ${c.status !== 'rejected' ? html`<button class="btn btn--ghost btn--sm" name="status" value="rejected">Reject</button>` : ''}</form></td></tr>`)}
    </tbody></table></div>`));
});
router.post('/customers/:id', async (req, res) => {
  const status = ['approved', 'rejected', 'pending'].includes(req.body.status) ? req.body.status : 'pending';
  db.prepare('UPDATE customers SET status = ? WHERE id = ?').run(status, Number(req.params.id));
  const c = db.prepare('SELECT * FROM customers WHERE id = ?').get(Number(req.params.id));
  if (c && status === 'approved') {
    const { sendMail } = require('../email');
    await sendMail({ to: c.email, subject: 'Your business account is approved',
      html: String(html`<p>Hi ${c.name},</p><p>Your business account for <b>${c.org_name}</b> is approved. You can now choose bank EFT at checkout, see your order history and re-order in one click.</p>
        <p><a href="${config.baseUrl}/account/login">Log in</a></p>`) });
  }
  flash(req, 'ok', `Account ${status}.`);
  res.redirect('/admin/customers');
});

// ---------- Quotes & messages ----------
router.get('/quotes', (req, res) => {
  const list = db.prepare('SELECT * FROM quotes ORDER BY status = \'new\' DESC, id DESC LIMIT 300').all();
  res.send(page(req, 'Quotes', html`<h1>Quote requests</h1>
    <div class="table-wrap"><table class="tbl"><thead><tr><th>Date</th><th>From</th><th>Items</th><th>File</th><th>Status</th></tr></thead><tbody>
    ${list.map((q) => html`<tr><td><a href="/admin/quotes/${q.id}">${q.created_at.slice(0, 10)}</a></td><td><a href="/admin/quotes/${q.id}"><b>${q.org_name}</b></a><br>${q.name}</td>
      <td class="small">${String(q.items).slice(0, 120)}</td><td>${q.file ? 'Yes' : ''}</td><td>${q.status}</td></tr>`)}
    </tbody></table></div>`));
});
router.get('/quotes/:id', (req, res, next) => {
  const q = db.prepare('SELECT * FROM quotes WHERE id = ?').get(Number(req.params.id));
  if (!q) return next();
  res.send(page(req, 'Quote', html`<p><a href="/admin/quotes">← Quotes</a></p><h1>Quote from ${q.org_name}</h1>
    <section class="box"><p><b>${q.name}</b> · ${q.org_type}<br><a href="mailto:${q.email}">${q.email}</a> · <a href="tel:${q.phone}">${q.phone}</a> ·
      <a href="https://wa.me/27${String(q.phone).replace(/\D/g, '').replace(/^(27|0)/, '')}" target="_blank" rel="noopener">WhatsApp</a><br>
      Postal code ${q.postal_code} · Needed by ${q.needed_by || '—'} · Ref ${q.reference || '—'}</p>
      <pre class="pre">${q.items}</pre>
      ${q.file ? html`<p><a class="btn btn--ghost" href="/admin/quotes/${q.id}/file">Download attached file (${q.file_original})</a></p>` : ''}
      <form method="post" action="/admin/quotes/${q.id}" class="inline">${csrf(req)}
        <select name="status">${['new', 'quoted', 'won', 'lost'].map((s) => html`<option ${q.status === s ? raw('selected') : ''}>${s}</option>`)}</select><button class="btn btn--sm">Update</button></form></section>`));
});
router.get('/quotes/:id/file', (req, res, next) => {
  const q = db.prepare('SELECT * FROM quotes WHERE id = ?').get(Number(req.params.id));
  if (!q || !q.file) return next();
  res.download(path.join(config.uploadDir, '..', 'quote-files', q.file), q.file_original || q.file);
});
router.post('/quotes/:id', (req, res) => {
  db.prepare('UPDATE quotes SET status = ? WHERE id = ?').run(clean(req.body.status, 10), Number(req.params.id));
  res.redirect(`/admin/quotes/${req.params.id}`);
});
router.get('/messages', (req, res) => {
  const list = db.prepare('SELECT * FROM messages ORDER BY id DESC LIMIT 300').all();
  res.send(page(req, 'Messages', html`<h1>Messages</h1>${list.map((m) => html`<section class="box ${m.status === 'new' ? 'box--new' : ''}">
    <p><b>${m.name}</b> · <a href="mailto:${m.email}">${m.email}</a> · ${m.phone} · ${m.created_at}</p><pre class="pre">${m.message}</pre>
    ${m.status === 'new' ? html`<form method="post" action="/admin/messages/${m.id}">${csrf(req)}<button class="btn btn--sm btn--ghost">Mark as handled</button></form>` : ''}</section>`)}`));
});
router.post('/messages/:id', (req, res) => { db.prepare("UPDATE messages SET status = 'done' WHERE id = ?").run(Number(req.params.id)); res.redirect('/admin/messages'); });

// ---------- Settings ----------
const SETTING_GROUPS = [
  ['Business details', [['trading_name', 'Trading name'], ['business_name', 'Registered name'], ['reg_no', 'Company reg. no.'], ['sahpra_no', 'SAHPRA licence no.'],
    ['vat_line', 'VAT line (footer & invoices)'], ['address', 'Address'], ['phone_1', 'Phone 1'], ['phone_2', 'Phone 2'], ['whatsapp', 'WhatsApp number (27…, no +)'],
    ['email', 'Email'], ['hours', 'Trading hours'], ['directors', 'Director name(s) — required on Terms page by ECTA'], ['info_officer', 'POPIA Information Officer name'],
    ['gbp_url', 'Google Business Profile link']]],
  ['Delivery', [['local_ranges', 'Next-day postal-code ranges (e.g. 7100-7999, 8000-8099)'], ['local_label', 'Local delivery name'], ['local_fee', 'Local delivery price (R) — empty = not offered online'],
    ['national_label', 'Nationwide delivery name'], ['national_fee', 'Nationwide delivery price (R) — empty = not offered online'], ['free_threshold', 'Free delivery from (R)'],
    ['cutoff_time', 'Order cut-off time for next-day delivery'], ['allow_collection', 'Allow collection (1 = yes, 0 = no)'], ['collection_label', 'Collection option name']]],
  ['Bank details (for EFT)', [['bank_name', 'Bank'], ['bank_account_name', 'Account name'], ['bank_account_no', 'Account number'], ['bank_branch_code', 'Branch code'], ['bank_account_type', 'Account type']]],
  ['Stock & couriers', [['low_stock_threshold', 'Low-stock alert level (packs)'], ['tracking_urls', 'Courier tracking links — one per line: Courier name|https://tracking-link?no={tracking}']]],
];
router.get('/settings', (req, res) => {
  const s = getSettings();
  res.send(page(req, 'Settings', html`<h1>Settings</h1>
    <form method="post" action="/admin/settings" class="form">${csrf(req)}
    ${SETTING_GROUPS.map(([title, keys]) => html`<section class="box"><h2>${title}</h2>
      ${keys.map(([k, label]) => k === 'tracking_urls'
        ? html`<label>${label}<textarea name="${k}" rows="4">${s[k]}</textarea></label>`
        : html`<label>${label}<input name="${k}" value="${s[k]}"></label>`)}</section>`)}
    <button class="btn sticky-save">Save settings</button></form>
    <section class="box"><h2>Backup</h2><p>Download a copy of the database (products, orders, customers, settings). Do this weekly and keep it somewhere safe. Photos are in the <code>data/uploads</code> folder on the server.</p>
      <a class="btn btn--ghost" href="/admin/backup">Download database backup</a></section>
    <section class="box"><h2>Change admin password</h2><form method="post" action="/admin/password" class="form">${csrf(req)}
      <label>Current password<input type="password" name="current" required autocomplete="current-password"></label>
      <label>New password (at least 10 characters)<input type="password" name="next" minlength="10" required autocomplete="new-password"></label><button class="btn btn--ghost">Change password</button></form></section>`));
});
router.post('/settings', (req, res) => {
  const errors = [];
  for (const [, keys] of SETTING_GROUPS) for (const [k] of keys) {
    if (req.body[k] === undefined) continue;
    let v = clean(req.body[k], 2000);
    if (['local_fee', 'national_fee', 'free_threshold'].includes(k) && v !== '') {
      const c = parseRandToCents(v);
      if (c === null) { errors.push(`"${v}" is not a valid amount`); continue; }
      v = String(c / 100);
    }
    if (k === 'whatsapp') v = v.replace(/\D/g, '');
    if (k in DEFAULT_SETTINGS) setSetting(k, v);
  }
  flash(req, errors.length ? 'error' : 'ok', errors.length ? `Saved, except: ${errors.join('; ')}` : 'Settings saved.');
  res.redirect('/admin/settings');
});
router.post('/password', (req, res) => {
  const a = db.prepare('SELECT * FROM admins WHERE id = ?').get(req.session.adminId);
  if (!checkPassword(req.body.current || '', a.password_hash) || String(req.body.next || '').length < 10) {
    flash(req, 'error', 'Current password wrong, or new password shorter than 10 characters.');
  } else {
    db.prepare('UPDATE admins SET password_hash = ? WHERE id = ?').run(hashPassword(String(req.body.next)), a.id);
    flash(req, 'ok', 'Password changed.');
  }
  res.redirect('/admin/settings');
});
router.get('/backup', (req, res) => {
  const file = path.join(os.tmpdir(), `md-backup-${Date.now()}.db`);
  db.exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`);
  res.download(file, `michealsdynamics-backup-${new Date().toISOString().slice(0, 10)}.db`, () => fs.rmSync(file, { force: true }));
});

module.exports = router;
