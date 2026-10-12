// PayFast (cards + instant EFT) and Yoco (cards) payments.
// Orders are only marked PAID by the payment provider's server-to-server notification,
// never by the customer's browser returning to the site.
const crypto = require('crypto');
const express = require('express');
const config = require('../config');
const { db } = require('../db');
const { getOrder, getOrderByNumber } = require('../shop');
const { markPaid } = require('../orders');

const router = express.Router();

// ---------------- PayFast ----------------
const pfHost = () => (config.payfast.sandbox ? 'sandbox.payfast.co.za' : 'www.payfast.co.za');
const pfEncode = (v) => encodeURIComponent(String(v).trim()).replace(/%20/g, '+');

function payfastSignature(data, passphrase) {
  let str = Object.entries(data).filter(([k, v]) => k !== 'signature' && v !== '' && v !== undefined && v !== null)
    .map(([k, v]) => `${k}=${pfEncode(v)}`).join('&');
  if (passphrase) str += `&passphrase=${pfEncode(passphrase)}`;
  return crypto.createHash('md5').update(str).digest('hex');
}

// Fields in the exact order PayFast requires for the signature.
function payfastFields(order) {
  const [first, ...rest] = order.name.trim().split(/\s+/);
  const data = {
    merchant_id: config.payfast.merchantId,
    merchant_key: config.payfast.merchantKey,
    return_url: `${config.baseUrl}/order/${order.number}?t=${order.access_token}&paid=1`,
    cancel_url: `${config.baseUrl}/checkout?cancelled=${order.number}`,
    notify_url: `${config.baseUrl}/payments/payfast/notify`,
    name_first: first.slice(0, 100),
    name_last: rest.join(' ').slice(0, 100),
    email_address: order.email,
    m_payment_id: order.number,
    amount: (order.total_cents / 100).toFixed(2),
    item_name: `Order ${order.number}`,
  };
  data.signature = payfastSignature(data, config.payfast.passphrase);
  return { action: `https://${pfHost()}/eng/process`, data };
}

router.post('/payfast/notify', express.urlencoded({ extended: false }), async (req, res) => {
  res.sendStatus(200); // PayFast wants a quick 200; we process after.
  try {
    const body = req.body || {};
    // Rebuild the parameter string in the order received, stopping at 'signature'.
    const parts = [];
    for (const [k, v] of Object.entries(body)) { if (k === 'signature') break; parts.push(`${k}=${pfEncode(v)}`); }
    const paramString = parts.join('&');
    const expected = crypto.createHash('md5')
      .update(paramString + (config.payfast.passphrase ? `&passphrase=${pfEncode(config.payfast.passphrase)}` : '')).digest('hex');
    if (expected !== body.signature) return console.warn('PayFast ITN: bad signature', body.m_payment_id);

    const order = getOrderByNumber(body.m_payment_id);
    if (!order) return console.warn('PayFast ITN: unknown order', body.m_payment_id);
    if (Math.abs(order.total_cents / 100 - parseFloat(body.amount_gross)) > 0.01) return console.warn('PayFast ITN: amount mismatch', order.number);
    if (body.merchant_id && body.merchant_id !== config.payfast.merchantId) return console.warn('PayFast ITN: merchant mismatch');

    // Ask PayFast to confirm this notification is genuine.
    const check = await fetch(`https://${pfHost()}/eng/query/validate`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: paramString,
    });
    if ((await check.text()).trim() !== 'VALID') return console.warn('PayFast ITN: not validated', order.number);

    if (body.payment_status === 'COMPLETE') await markPaid(order.id, `payfast:${body.pf_payment_id || ''}`);
    else if (body.payment_status === 'CANCELLED') db.prepare("UPDATE orders SET payment_status = 'failed' WHERE id = ? AND payment_status = 'pending'").run(order.id);
  } catch (e) {
    console.error('PayFast ITN error', e);
  }
});

// ---------------- Yoco ----------------
async function yocoCreateCheckout(order) {
  const r = await fetch('https://payments.yoco.com/api/checkouts', {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.yoco.secretKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': `${order.number}-${order.access_token.slice(0, 8)}` },
    body: JSON.stringify({
      amount: order.total_cents,
      currency: 'ZAR',
      successUrl: `${config.baseUrl}/order/${order.number}?t=${order.access_token}&paid=1`,
      cancelUrl: `${config.baseUrl}/checkout?cancelled=${order.number}`,
      failureUrl: `${config.baseUrl}/checkout?failed=${order.number}`,
      metadata: { orderNumber: order.number },
    }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || !data.redirectUrl) throw new Error('Could not start the card payment. Please try again or choose another payment method.');
  db.prepare('UPDATE orders SET payment_ref = ? WHERE id = ?').run(`yoco:${data.id}`, order.id);
  return data.redirectUrl;
}

// Yoco signs webhooks: HMAC-SHA256 over "id.timestamp.body" with the base64 secret after "whsec_".
function yocoVerify(headers, rawBody) {
  const id = headers['webhook-id'], ts = headers['webhook-timestamp'], sigHeader = headers['webhook-signature'];
  if (!id || !ts || !sigHeader || !config.yoco.webhookSecret) return false;
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;
  const secret = Buffer.from(config.yoco.webhookSecret.replace(/^whsec_/, ''), 'base64');
  const expected = crypto.createHmac('sha256', secret).update(`${id}.${ts}.${rawBody}`).digest('base64');
  return sigHeader.split(' ').some((part) => {
    const sig = part.split(',')[1] || '';
    return sig.length === expected.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  });
}

router.post('/yoco/webhook', express.raw({ type: '*/*', limit: '200kb' }), async (req, res) => {
  const rawBody = req.body.toString('utf8');
  if (!yocoVerify(req.headers, rawBody)) return res.sendStatus(403);
  res.sendStatus(200);
  try {
    const event = JSON.parse(rawBody);
    if (event.type !== 'payment.succeeded') return;
    const p = event.payload || {};
    const meta = p.metadata || {};
    let order = meta.checkoutId ? db.prepare('SELECT id FROM orders WHERE payment_ref = ?').get(`yoco:${meta.checkoutId}`) : null;
    if (!order && meta.orderNumber) order = getOrderByNumber(meta.orderNumber);
    if (!order) return console.warn('Yoco webhook: order not found', meta);
    const full = getOrder(order.id);
    if (Number(p.amount) !== full.total_cents) return console.warn('Yoco webhook: amount mismatch', full.number);
    await markPaid(full.id, `yoco:${meta.checkoutId || p.id}`);
  } catch (e) {
    console.error('Yoco webhook error', e);
  }
});

const payfastEnabled = () => Boolean(config.payfast.merchantId && config.payfast.merchantKey);
const yocoEnabled = () => Boolean(config.yoco.secretKey);

module.exports = { router, payfastFields, payfastSignature, yocoCreateCheckout, yocoVerify, payfastEnabled, yocoEnabled };
