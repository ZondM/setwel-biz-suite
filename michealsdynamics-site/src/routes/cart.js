const express = require('express');
const config = require('../config');
const { db, getSettings } = require('../db');
const shop = require('../shop');
const { layout, csrfField } = require('../views/layout');
const { html, raw, money, flash, clean, isEmail } = require('../util');
const { onOrderPlaced } = require('../orders');
const { invoicePdf } = require('../invoice');
const pay = require('./payments');

const router = express.Router();
const PROVINCES = ['Western Cape', 'Eastern Cape', 'Northern Cape', 'Gauteng', 'KwaZulu-Natal', 'Free State', 'Limpopo', 'Mpumalanga', 'North West'];

function currentCustomer(req) {
  return req.session.customerId ? db.prepare('SELECT * FROM customers WHERE id = ?').get(req.session.customerId) : null;
}

function addToCart(req, variantId, qty) {
  const v = db.prepare('SELECT v.*, p.published, p.name FROM variants v JOIN products p ON p.id = v.product_id WHERE v.id = ?').get(variantId);
  if (!v || !v.published || v.price_cents === null) return { ok: false, msg: 'That item is not available to order online.' };
  const cart = (req.session.cart ||= {});
  const want = (Number(cart[v.id]) || 0) + qty;
  if (v.stock <= 0) return { ok: false, msg: `${v.name} (${v.label}) is out of stock.` };
  cart[v.id] = Math.min(want, v.stock, 9999);
  return { ok: true, capped: want > v.stock, v };
}

router.post('/cart/add', (req, res) => {
  const qty = Math.max(1, Math.min(9999, parseInt(req.body.qty, 10) || 1));
  const r = addToCart(req, Number(req.body.variant), qty);
  if (!r.ok) flash(req, 'error', r.msg);
  else flash(req, 'ok', r.capped ? `Added — only ${r.v.stock} in stock, so your quantity was reduced.` : 'Added to your cart.');
  res.redirect('/cart');
});

router.post('/cart/update', (req, res) => {
  const cart = (req.session.cart ||= {});
  const q = req.body.qty || {};
  for (const [key, n] of Object.entries(q)) {
    const id = String(key).replace(/^v/, '');
    const qty = Math.max(0, Math.min(9999, parseInt(n, 10) || 0));
    if (!cart[id]) continue;
    if (qty === 0) delete cart[id]; else cart[id] = qty;
  }
  if (req.body.remove) delete cart[req.body.remove];
  if (req.body.postal !== undefined) req.session.postal = clean(req.body.postal, 4);
  res.redirect('/cart' + (req.body.postal !== undefined ? '#delivery' : ''));
});

function summary(priced, delivery) {
  return html`<dl class="totals">
    <div><dt>Subtotal</dt><dd>${money(priced.subtotal)}</dd></div>
    ${priced.discount ? html`<div class="totals__save"><dt>Bulk discount</dt><dd>−${money(priced.discount)}</dd></div>` : ''}
    ${delivery ? html`<div><dt>Delivery</dt><dd>${delivery.cents === null ? '—' : delivery.cents === 0 ? 'Free' : money(delivery.cents)}</dd></div>` : ''}
    <div class="totals__total"><dt>Total</dt><dd>${money(priced.goods + (delivery && delivery.cents ? delivery.cents : 0))}</dd></div>
    <p class="muted small">Prices in ZAR. No VAT charged (not VAT registered).</p>
  </dl>`;
}

router.get('/cart', (req, res) => {
  const s = getSettings();
  const priced = shop.priceCart(req.session.cart);
  priced.problems.forEach((p) => flash(req, 'error', p));
  const postal = req.query.postal !== undefined ? clean(req.query.postal, 4) : req.session.postal || '';
  if (req.query.postal !== undefined) req.session.postal = postal;
  const dq = shop.deliveryOptions(postal, priced.goods, s);
  const body = !priced.lines.length
    ? html`<div class="wrap section"><h1>Your cart</h1><div class="empty"><p>Your cart is empty.</p><p><a class="btn" href="/shop">Shop products</a></p></div></div>`
    : html`<div class="wrap section">
      <h1>Your cart</h1>
      <div class="cartgrid">
        <form method="post" action="/cart/update" class="cart">
          ${csrfField(req)}
          ${priced.lines.map((l) => html`<div class="line">
            <a href="/product/${l.slug}" class="line__img">${l.image ? html`<img src="/uploads/${l.image}" alt="" width="80" height="80" loading="lazy">` : html`<img src="/img/placeholder.svg" alt="" width="80" height="80">`}</a>
            <div class="line__info">
              <a href="/product/${l.slug}"><b>${l.product_name}</b></a>${l.label !== 'Standard' ? html`<br><span class="muted">${l.label}</span>` : ''}
              <br><span>${money(l.unit_price)} each${l.tier ? html` <span class="tag tag--save">${l.tier.pct}% bulk discount</span>` : ''}</span>
              ${l.pack_qty > 1 ? html`<br><span class="muted small">${money(l.unit_price / l.pack_qty)} per ${l.unit_label}</span>` : ''}
            </div>
            <div class="line__qty">
              <label class="sr" for="q${l.id}">Quantity</label>
              <input id="q${l.id}" type="number" name="qty[v${l.id}]" value="${l.qty}" min="0" max="${l.stock}" inputmode="numeric">
              <button class="linkbtn" name="remove" value="${l.id}">Remove</button>
            </div>
            <div class="line__total">${money(l.line_total)}</div>
          </div>`)}
          <button class="btn btn--ghost btn--sm">Update cart</button>
        </form>
        <aside class="cartside">
          <section id="delivery" class="box">
            <h2>Delivery cost</h2>
            <form method="get" action="/cart#delivery" class="inline">
              <label class="sr" for="postal">Postal code</label>
              <input id="postal" name="postal" value="${postal}" placeholder="Postal code e.g. 7784" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" required>
              <button class="btn btn--sm">Check</button>
            </form>
            ${postal && !dq.valid ? html`<p class="flash flash--error">Please enter a 4-digit South African postal code.</p>` : ''}
            ${dq.valid ? html`<ul class="plain dopts">${dq.options.map((o) => html`<li><b>${o.label}:</b> ${o.available ? (o.cents === 0 ? 'Free' : money(o.cents)) : o.note}</li>`)}</ul>` : ''}
            ${dq.shortBy > 0 ? html`<p class="muted">Spend ${money(dq.shortBy)} more for free delivery.</p>` : dq.isFree ? html`<p class="ok">Your order qualifies for free delivery.</p>` : ''}
          </section>
          <section class="box">${summary(priced, null)}
            <a class="btn btn--wide" href="/checkout">Checkout</a>
            <p class="muted small">Guest checkout — no account needed.</p>
          </section>
        </aside>
      </div>
    </div>`;
  res.send(layout(req, { title: 'Your cart', body, noindex: true }));
});

// ---------------- Checkout ----------------
function paymentChoices(customer) {
  const list = [];
  if (pay.payfastEnabled()) list.push({ id: 'payfast', label: 'Card or instant EFT (PayFast)' });
  if (pay.yocoEnabled()) list.push({ id: 'yoco', label: 'Card (Yoco)' });
  if (customer && customer.status === 'approved') list.push({ id: 'eft', label: 'Bank EFT (business account) — we dispatch once payment reflects' });
  return list;
}

function checkoutPage(req, { values, priced, dq, payments, error }) {
  const v = values;
  return html`<div class="wrap section">
    <h1>Checkout</h1>
    ${error ? html`<p class="flash flash--error" role="alert">${error}</p>` : ''}
    ${!req.session.customerId ? html`<p class="muted">Checking out as a guest. Business account? <a href="/account/login?next=/checkout">Log in</a></p>` : ''}
    <div class="cartgrid">
      <form method="post" action="/checkout" class="form">
        ${csrfField(req)}
        <h2>Your details</h2>
        <label>Full name *<input name="name" required maxlength="120" autocomplete="name" value="${v.name || ''}"></label>
        <div class="form__2">
          <label>Email *<input type="email" name="email" required maxlength="160" autocomplete="email" value="${v.email || ''}"></label>
          <label>Mobile *<input type="tel" name="phone" required maxlength="30" autocomplete="tel" value="${v.phone || ''}"></label>
        </div>
        <label>Practice / organisation (optional)<input name="org_name" maxlength="160" autocomplete="organization" value="${v.org_name || ''}"></label>

        <h2>Delivery address</h2>
        <label>Street address *<input name="address1" required maxlength="160" autocomplete="address-line1" value="${v.address1 || ''}"></label>
        <label>Complex / building (optional)<input name="address2" maxlength="160" autocomplete="address-line2" value="${v.address2 || ''}"></label>
        <div class="form__2">
          <label>Suburb *<input name="suburb" required maxlength="80" value="${v.suburb || ''}"></label>
          <label>City / town *<input name="city" required maxlength="80" autocomplete="address-level2" value="${v.city || ''}"></label>
        </div>
        <div class="form__2">
          <label>Province *<select name="province" required>${PROVINCES.map((p) => html`<option ${(v.province || 'Western Cape') === p ? raw('selected') : ''}>${p}</option>`)}</select></label>
          <label>Postal code *<input name="postal_code" required pattern="[0-9]{4}" maxlength="4" inputmode="numeric" autocomplete="postal-code" value="${v.postal_code || ''}" data-requote></label>
        </div>
        <p class="muted small">Changed your postal code? <button class="linkbtn" name="requote" value="1" formnovalidate>Update delivery options</button></p>

        <h2>Delivery method</h2>
        ${dq.valid ? html`<fieldset class="radios">${dq.options.map((o) => html`<label class="${o.available ? '' : 'disabled'}">
            <input type="radio" name="delivery" value="${o.id}" required ${!o.available ? raw('disabled') : ''} ${v.delivery === o.id || (!v.delivery && o.available && o.id !== 'collect') ? raw('checked') : ''}>
            ${o.label} — ${o.available ? (o.cents === 0 ? 'Free' : money(o.cents)) : o.note}</label>`)}</fieldset>`
          : html`<p class="muted">Enter your postal code and tap "Update delivery options".</p>`}

        <h2>Payment</h2>
        ${payments.length ? html`<fieldset class="radios">${payments.map((p, i) => html`<label><input type="radio" name="payment" value="${p.id}" required ${v.payment === p.id || (!v.payment && i === 0) ? raw('checked') : ''}> ${p.label}</label>`)}</fieldset>`
          : html`<p class="flash flash--error">Online payment is not switched on yet. Please <a href="/quote">request a quote</a> or WhatsApp us to order.</p>`}

        <label>Order notes (optional)<textarea name="notes" rows="3" maxlength="1000" placeholder="Delivery instructions, purchase order number…">${v.notes || ''}</textarea></label>
        <label class="check"><input type="checkbox" name="agree" value="1" required ${v.agree ? raw('checked') : ''}> I accept the <a href="/terms" target="_blank">Terms</a> and <a href="/returns-policy" target="_blank">Returns Policy</a> (sterile and opened items are non-returnable unless faulty), and agree to my details being used to process this order (<a href="/privacy-policy" target="_blank">Privacy Policy</a>).</label>
        <button class="btn btn--wide" ${payments.length ? '' : raw('disabled')}>Place order</button>
      </form>
      <aside class="cartside"><section class="box">
        <h2>Order summary</h2>
        <ul class="plain mini">${priced.lines.map((l) => html`<li><span>${l.qty} × ${l.product_name}${l.label !== 'Standard' ? ` (${l.label})` : ''}</span><span>${money(l.line_total)}</span></li>`)}</ul>
        ${summary(priced, dq.valid ? (dq.options.find((o) => o.id === v.delivery && o.available) || dq.options.find((o) => o.available && o.id !== 'collect') || null) : null)}
        <p><a href="/cart">Edit cart</a></p>
      </section></aside>
    </div>
  </div>`;
}

router.get('/checkout', (req, res) => {
  const priced = shop.priceCart(req.session.cart);
  if (!priced.lines.length) return res.redirect('/cart');
  const c = currentCustomer(req);
  const values = { ...(req.session.checkout || {}) };
  if (c) Object.assign(values, { name: values.name || c.name, email: values.email || c.email, phone: values.phone || c.phone, org_name: values.org_name || c.org_name });
  values.postal_code ||= req.session.postal || '';
  let error = '';
  if (req.query.cancelled || req.query.failed) error = 'Payment was not completed. Your cart is still here — you can try again or choose another payment method.';
  const dq = shop.deliveryOptions(values.postal_code, priced.goods);
  res.send(layout(req, { title: 'Checkout', noindex: true, body: checkoutPage(req, { values, priced, dq, payments: paymentChoices(c), error }) }));
});

router.post('/checkout', async (req, res) => {
  const b = req.body;
  const fields = ['name', 'email', 'phone', 'org_name', 'address1', 'address2', 'suburb', 'city', 'province', 'postal_code', 'notes', 'delivery', 'payment', 'agree'];
  const values = {};
  for (const f of fields) values[f] = clean(b[f], f === 'notes' ? 1000 : 160);
  req.session.checkout = { ...values, agree: '' };
  req.session.postal = values.postal_code;
  const priced = shop.priceCart(req.session.cart);
  if (!priced.lines.length) return res.redirect('/cart');
  const c = currentCustomer(req);
  const payments = paymentChoices(c);
  const dq = shop.deliveryOptions(values.postal_code, priced.goods);
  const render = (error) => res.status(error ? 400 : 200).send(layout(req, { title: 'Checkout', noindex: true, body: checkoutPage(req, { values, priced, dq, payments, error }) }));
  if (b.requote) return render('');

  const delivery = dq.options.find((o) => o.id === values.delivery && o.available);
  const errors = [];
  if (!values.name || !isEmail(values.email) || !values.phone) errors.push('Please enter your name, a valid email and phone number.');
  if (!values.address1 || !values.suburb || !values.city || !PROVINCES.includes(values.province) || !dq.valid) errors.push('Please complete your delivery address, including a 4-digit postal code.');
  if (!delivery) errors.push('Please choose an available delivery method.');
  if (!payments.find((p) => p.id === values.payment)) errors.push('Please choose a payment method.');
  if (values.agree !== '1') errors.push('Please accept the terms to continue.');
  if (priced.problems.length) errors.push(...priced.problems);
  if (errors.length) return render(errors.join(' '));

  let order;
  try {
    order = shop.createOrder({ cart: req.session.cart, customer: c, form: values, paymentMethod: values.payment, delivery });
  } catch (e) {
    return render(e.message);
  }
  req.session.cart = {};
  delete req.session.checkout;
  (req.session.myOrders ||= []).push(order.number);

  if (order.payment_method === 'eft') {
    await onOrderPlaced(order);
    return res.redirect(`/order/${order.number}?t=${order.access_token}`);
  }
  if (order.payment_method === 'payfast') {
    const { action, data } = pay.payfastFields(order);
    return res.send(String(html`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Redirecting to PayFast…</title>
      <link rel="stylesheet" href="/css/site.css"></head><body><div class="wrap section"><p>Taking you to PayFast to pay ${money(order.total_cents)} securely…</p>
      <form id="pf" action="${action}" method="post">${Object.entries(data).map(([k, val]) => html`<input type="hidden" name="${k}" value="${val}">`)}
      <button class="btn">Continue to PayFast</button></form></div><script src="/js/autosubmit.js"></script></body></html>`));
  }
  try {
    return res.redirect(await pay.yocoCreateCheckout(order));
  } catch (e) {
    // Put the items back so the customer can try another method.
    for (const it of order.items) req.session.cart[it.variant_id] = it.qty;
    db.prepare("UPDATE orders SET status = 'cancelled', payment_status = 'failed' WHERE id = ?").run(order.id);
    return render(e.message);
  }
});

// ---------------- Order status page + invoice (guest token or logged-in owner) ----------------
function canView(req, order) {
  if (!order) return false;
  if (req.query.t && req.query.t === order.access_token) return true;
  return Boolean(req.session.customerId && order.customer_id === req.session.customerId);
}

const statusText = (o) => o.status === 'cancelled' ? 'Cancelled'
  : o.payment_status !== 'paid' ? (o.payment_method === 'eft' ? 'Awaiting EFT payment' : 'Awaiting payment confirmation')
  : ({ new: 'Paid', processing: 'Paid — being prepared', shipped: 'Shipped', delivered: 'Delivered' }[o.status] || o.status);

router.get('/order/:number', (req, res, next) => {
  const o = shop.getOrderByNumber(req.params.number);
  if (!canView(req, o)) return next();
  const s = getSettings();
  const t = req.query.t ? `?t=${encodeURIComponent(req.query.t)}` : '';
  const body = html`<div class="wrap section prose prose--page">
    <h1>Order ${o.number}</h1>
    ${req.query.paid && o.payment_status !== 'paid' ? html`<p class="flash flash--ok">Thank you! We're confirming your payment with the payment provider. You'll receive a confirmation email shortly — refresh this page in a minute.</p>` : ''}
    ${o.payment_status === 'paid' && req.query.paid ? html`<p class="flash flash--ok">Payment received — thank you! A confirmation and invoice have been emailed to ${o.email}.</p>` : ''}
    <p><b>Status:</b> ${statusText(o)}</p>
    ${o.tracking_no ? html`<p><b>Tracking:</b> ${o.courier} ${o.tracking_no}</p>` : ''}
    ${o.payment_method === 'eft' && o.payment_status !== 'paid' && o.status !== 'cancelled' ? html`<div class="box">
      <h2>Pay by EFT</h2>
      ${s.bank_account_no ? html`<p>Bank: ${s.bank_name}<br>Account name: ${s.bank_account_name}<br>Account no: ${s.bank_account_no}<br>Branch code: ${s.bank_branch_code}<br>Account type: ${s.bank_account_type}<br>Reference: <b>${o.number}</b></p>`
        : html`<p>We'll email you our banking details.</p>`}
      <p>We dispatch once payment reflects.</p></div>` : ''}
    <table class="specs">
      ${o.items.map((i) => html`<tr><td>${i.qty} × ${i.name}${i.variant_label !== 'Standard' ? ` (${i.variant_label})` : ''}</td><td class="r">${money(i.line_total_cents)}</td></tr>`)}
      ${o.discount_cents ? html`<tr><td>Bulk discount</td><td class="r">−${money(o.discount_cents)}</td></tr>` : ''}
      <tr><td>${o.delivery_label}</td><td class="r">${o.delivery_cents ? money(o.delivery_cents) : 'Free'}</td></tr>
      <tr><th>Total</th><th class="r">${money(o.total_cents)}</th></tr>
    </table>
    <p><a class="btn btn--ghost" href="/order/${o.number}/invoice.pdf${t}">Download invoice (PDF)</a> <a href="/shop">Continue shopping</a></p>
  </div>`;
  res.send(layout(req, { title: `Order ${o.number}`, noindex: true, body }));
});

router.get('/order/:number/invoice.pdf', async (req, res, next) => {
  const o = shop.getOrderByNumber(req.params.number);
  if (!canView(req, o)) return next();
  const pdf = await invoicePdf(o);
  res.type('application/pdf').set('Content-Disposition', `inline; filename="Invoice-${o.number}.pdf"`).send(pdf);
});

module.exports = { router, addToCart, statusText };
