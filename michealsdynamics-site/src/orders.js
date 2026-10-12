// What happens when an order is placed, paid, shipped or cancelled (emails, stock, invoices).
const { db, getSettings } = require('./db');
const config = require('./config');
const { sendMail } = require('./email');
const { invoicePdf } = require('./invoice');
const { getOrder, deductStock, restoreStock } = require('./shop');
const { html, money } = require('./util');

function itemsTable(order) {
  return html`<table cellpadding="6" style="border-collapse:collapse;width:100%;font-size:14px">
    ${order.items.map((i) => html`<tr style="border-bottom:1px solid #e3e8ea"><td>${i.name}${i.variant_label !== 'Standard' ? ` — ${i.variant_label}` : ''}</td>
      <td align="right">${i.qty} × ${money(i.unit_price_cents)}</td><td align="right">${money(i.line_total_cents)}</td></tr>`)}
    ${order.discount_cents ? html`<tr><td colspan="2" align="right">Bulk discount</td><td align="right">-${money(order.discount_cents)}</td></tr>` : ''}
    <tr><td colspan="2" align="right">${order.delivery_label}</td><td align="right">${order.delivery_cents ? money(order.delivery_cents) : 'Free'}</td></tr>
    <tr><td colspan="2" align="right"><b>Total</b></td><td align="right"><b>${money(order.total_cents)}</b></td></tr>
  </table>`;
}

function wrap(s, body) {
  return String(html`<div style="font-family:Arial,sans-serif;color:#10202A;max-width:600px">
    <h2 style="color:#0B6E78">${s.trading_name}</h2>${body}
    <p style="font-size:12px;color:#4A5559;margin-top:24px">${s.business_name} · Reg. ${s.reg_no} · SAHPRA licence ${s.sahpra_no} · ${s.vat_line}<br>
    ${s.address} · ${s.phone_1} · ${s.email}</p></div>`);
}

const orderLink = (o) => `${config.baseUrl}/order/${o.number}?t=${o.access_token}`;

async function invoiceAttachment(order) {
  return { filename: `Invoice-${order.number}.pdf`, content: await invoicePdf(order) };
}

async function onOrderPlaced(order) {
  const s = getSettings();
  if (order.payment_method !== 'eft') return; // card/instant EFT orders are confirmed when payment arrives
  const bank = s.bank_account_no
    ? html`<p><b>Please pay by EFT to:</b><br>Bank: ${s.bank_name}<br>Account name: ${s.bank_account_name}<br>Account no: ${s.bank_account_no}<br>
        Branch code: ${s.bank_branch_code}<br>Account type: ${s.bank_account_type}<br>Reference: <b>${order.number}</b></p>`
    : html`<p>We will send you our banking details shortly.</p>`;
  await sendMail({
    to: order.email, subject: `Order ${order.number} received — awaiting EFT payment`,
    html: wrap(s, html`<p>Hi ${order.name},</p><p>Thank you for your order <b>${order.number}</b>. We'll dispatch it once your payment reflects.</p>
      ${bank}${itemsTable(order)}<p><a href="${orderLink(order)}">View your order</a></p>`),
    attachments: [await invoiceAttachment(order)],
  });
  await sendMail({ to: config.mail.adminTo, subject: `New EFT order ${order.number} (${money(order.total_cents)}) — awaiting payment`,
    html: wrap(s, html`<p>${order.org_name || order.name} placed an EFT order. Mark it as paid in Admin once the money reflects.</p>${itemsTable(order)}
      <p><a href="${config.baseUrl}/admin/orders/${order.id}">Open in admin</a></p>`) });
}

// Called by the payment webhooks, or by the admin for EFT.
async function markPaid(orderId, paymentRef = '') {
  let order = getOrder(orderId);
  if (!order || order.payment_status === 'paid') return order;
  db.prepare("UPDATE orders SET payment_status = 'paid', paid_at = datetime('now'), payment_ref = CASE WHEN ? != '' THEN ? ELSE payment_ref END, status = CASE WHEN status = 'new' THEN 'processing' ELSE status END WHERE id = ?")
    .run(paymentRef, paymentRef, order.id);
  order = getOrder(order.id);
  const low = deductStock(order);
  order = getOrder(order.id);
  const s = getSettings();
  await sendMail({
    to: order.email, subject: `Order ${order.number} confirmed — payment received`,
    html: wrap(s, html`<p>Hi ${order.name},</p><p>We've received your payment for order <b>${order.number}</b>. Your invoice is attached.
      We'll email you a tracking number when it ships.</p>${itemsTable(order)}<p><a href="${orderLink(order)}">View your order</a></p>`),
    attachments: [await invoiceAttachment(order)],
  });
  await sendMail({ to: config.mail.adminTo, subject: `PAID order ${order.number} — ${money(order.total_cents)} — please dispatch`,
    html: wrap(s, html`<p>${order.org_name || order.name}, ${order.city || ''} ${order.postal_code} · ${order.delivery_label}</p>${itemsTable(order)}
      <p><a href="${config.baseUrl}/admin/orders/${order.id}">Open in admin</a></p>`) });
  if (low.length) await lowStockAlert(low);
  return order;
}

async function lowStockAlert(variants) {
  const s = getSettings();
  await sendMail({ to: config.mail.adminTo, subject: `Low stock alert (${variants.length} item${variants.length > 1 ? 's' : ''})`,
    html: wrap(s, html`<p>These items are at or below your low-stock level (${s.low_stock_threshold}):</p><ul>
      ${variants.map((v) => html`<li>${v.product_name} — ${v.label}: <b>${v.stock}</b> left</li>`)}</ul>
      <p><a href="${config.baseUrl}/admin/products">Update stock in admin</a></p>`) });
}

function trackingUrl(courier, tracking) {
  for (const line of String(getSettings().tracking_urls || '').split(/\r?\n/)) {
    const [name, url] = line.split('|').map((x) => (x || '').trim());
    if (name && url && name.toLowerCase() === String(courier).toLowerCase()) return url.replace('{tracking}', encodeURIComponent(tracking));
  }
  return '';
}

async function markShipped(orderId, courier, trackingNo) {
  db.prepare("UPDATE orders SET status = 'shipped', courier = ?, tracking_no = ?, shipped_at = datetime('now') WHERE id = ?").run(courier, trackingNo, orderId);
  const order = getOrder(orderId);
  const s = getSettings();
  const url = trackingUrl(courier, trackingNo);
  await sendMail({
    to: order.email, subject: `Order ${order.number} is on its way`,
    html: wrap(s, html`<p>Hi ${order.name},</p><p>Your order <b>${order.number}</b> has been dispatched${courier ? html` with <b>${courier}</b>` : ''}.</p>
      ${trackingNo ? html`<p>Tracking number: <b>${trackingNo}</b>${url ? html` — <a href="${url}">track your parcel</a>` : ''}</p>` : ''}
      ${itemsTable(order)}`),
  });
  return order;
}

function cancelOrder(orderId) {
  const order = getOrder(orderId);
  restoreStock(order);
  db.prepare("UPDATE orders SET status = 'cancelled' WHERE id = ?").run(orderId);
  return getOrder(orderId);
}

module.exports = { onOrderPlaced, markPaid, markShipped, cancelOrder, lowStockAlert, invoiceAttachment, trackingUrl };
