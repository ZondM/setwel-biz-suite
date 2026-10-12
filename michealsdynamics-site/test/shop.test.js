// End-to-end tests: start the real app on a temporary database and drive it over HTTP.
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'md-test-'));
Object.assign(process.env, {
  DATA_DIR: dataDir, BASE_URL: 'http://shop.test', ADMIN_EMAIL: 'admin@test.co', ADMIN_PASSWORD: 'admin-pass-123',
  PAYFAST_MERCHANT_ID: '10000100', PAYFAST_MERCHANT_KEY: '46f0cd694581a', PAYFAST_PASSPHRASE: 'jt7NOE43FZPn', PAYFAST_SANDBOX: 'true',
  YOCO_SECRET_KEY: 'sk_test_x', YOCO_WEBHOOK_SECRET: 'whsec_' + Buffer.from('test-secret-123').toString('base64'),
});

const realFetch = globalThis.fetch;
const external = [];
globalThis.fetch = async (url, opts = {}) => {
  url = String(url);
  if (url.includes('payfast.co.za/eng/query/validate')) { external.push({ url, body: opts.body }); return new Response('VALID'); }
  if (url === 'https://payments.yoco.com/api/checkouts') {
    external.push({ url, body: JSON.parse(opts.body) });
    return new Response(JSON.stringify({ id: 'ch_123', redirectUrl: 'https://c.yoco.com/checkout/ch_123' }), { status: 200 });
  }
  return realFetch(url, opts);
};

const app = require('../src/app');
const { db } = require('../src/db');
let server, base;

before(async () => {
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => { server.close(); fs.rmSync(dataDir, { recursive: true, force: true }); });

// Tiny browser: keeps cookies, extracts CSRF tokens.
function browser() {
  let cookie = '';
  const go = async (p, opts = {}) => {
    const r = await realFetch(base + p, { redirect: 'manual', ...opts, headers: { ...(opts.headers || {}), cookie } });
    const set = r.headers.getSetCookie ? r.headers.getSetCookie() : [];
    for (const c of set) { const kv = c.split(';')[0]; if (kv.startsWith('sid=')) cookie = kv; }
    const ct = r.headers.get('content-type') || '';
    const body = ct.includes('pdf') ? Buffer.from(await r.arrayBuffer()) : await r.text();
    return { status: r.status, location: r.headers.get('location'), body, type: ct };
  };
  const csrfFrom = (h) => (h.match(/name="_csrf" value="([a-f0-9]+)"/) || [])[1];
  return {
    get: (p) => go(p),
    post: async (p, data, { from } = {}) => {
      const page = await go(from || p.replace(/\/[^/]*$/, '') || '/');
      const form = new URLSearchParams({ _csrf: csrfFrom(page.body) || '', ...data });
      return go(p, { method: 'POST', body: form, headers: { 'content-type': 'application/x-www-form-urlencoded' } });
    },
    postWithCsrf: async (p, data, csrfPage) => {
      const page = await go(csrfPage);
      const form = new URLSearchParams({ _csrf: csrfFrom(page.body), ...data });
      return go(p, { method: 'POST', body: form, headers: { 'content-type': 'application/x-www-form-urlencoded' } });
    },
    multipart: async (p, fd, csrfPage) => {
      const page = await go(csrfPage);
      fd.append('_csrf', csrfFrom(page.body));
      return go(p, { method: 'POST', body: fd });
    },
  };
}
const outbox = () => (fs.existsSync(path.join(dataDir, 'outbox')) ? fs.readdirSync(path.join(dataDir, 'outbox')).sort()
  .map((f) => JSON.parse(fs.readFileSync(path.join(dataDir, 'outbox', f), 'utf8'))) : []);

const admin = browser();
let gloveVariants;

test('starter catalogue has no prices and shows "Price on request"', async () => {
  const b = browser();
  const shop = await b.get('/shop');
  assert.match(shop.body, /Price on request/);
  const prices = [...shop.body.matchAll(/class="card__price[^"]*">([^<]*)/g)].map((m) => m[1]);
  assert.ok(prices.length > 10);
  assert.ok(prices.every((p) => p === 'Price on request'), prices.join('|')); // no invented prices
  const p = await b.get('/product/nitrile-examination-gloves-powder-free-box-of-100');
  assert.match(p.body, /Request a price/);
  assert.doesNotMatch(p.body, /id="addbtn"/);
  assert.match(p.body, /Not VAT registered/);
  assert.match(p.body, /2024\/551935\/07/);
  assert.match(p.body, /00005896MD/);
  assert.match(p.body, /photo coming soon/);
});

test('admin login rejects wrong password and accepts the right one', async () => {
  const bad = await admin.postWithCsrf('/admin/login', { email: 'admin@test.co', password: 'nope' }, '/admin/login');
  assert.equal(bad.location, '/admin/login');
  const ok = await admin.postWithCsrf('/admin/login', { email: 'admin@test.co', password: 'admin-pass-123' }, '/admin/login');
  assert.equal(ok.location, '/admin');
  const dash = await admin.get('/admin');
  assert.match(dash.body, /Launch checklist/);
});

test('admin pages need a login', async () => {
  const r = await browser().get('/admin/orders');
  assert.equal(r.status, 302);
  assert.equal(r.location, '/admin/login');
});

test('POST without CSRF token is refused', async () => {
  const r = await realFetch(base + '/cart/add', { method: 'POST', body: new URLSearchParams({ variant: '1', qty: '1' }), redirect: 'manual' });
  assert.equal(r.status, 403);
});

test('admin sets prices, stock, delivery fees and bank details', async () => {
  const pid = db.prepare("SELECT id FROM products WHERE slug = 'nitrile-examination-gloves-powder-free-box-of-100'").get().id;
  gloveVariants = db.prepare('SELECT * FROM variants WHERE product_id = ? ORDER BY sort').all(pid);
  const data = {};
  for (const v of gloveVariants) { data[`price[v${v.id}]`] = '120.00'; data[`stock[v${v.id}]`] = '50'; }
  const r = await admin.postWithCsrf('/admin/stock', data, '/admin/stock');
  assert.equal(r.status, 302);
  assert.equal(db.prepare('SELECT price_cents, stock FROM variants WHERE id = ?').get(gloveVariants[2].id).price_cents, 12000);

  const s = await admin.postWithCsrf('/admin/settings', {
    local_fee: '80', national_fee: '150', free_threshold: '2000', bank_name: 'FNB', bank_account_name: 'Micheals Dynamics',
    bank_account_no: '62000000000', bank_branch_code: '250655', bank_account_type: 'Cheque', low_stock_threshold: '10',
    tracking_urls: 'The Courier Guy|https://example.test/track?ref={tracking}',
  }, '/admin/settings');
  assert.equal(s.status, 302);
});

test('admin edits a product: bulk tiers, new option, photo upload', async () => {
  const pid = gloveVariants[0].product_id;
  const fd = new FormData();
  const fields = { name: 'Nitrile Examination Gloves, Powder-Free (Box of 100)', category_id: '1', brand: 'TestBrand', material: 'Nitrile',
    sterile: '0', pack_qty: '100', unit_label: 'glove', bulk_tiers: '10:5, 50:10', published: '1', bestseller: '1', description: 'Blue gloves.', specs: 'Colour: Blue' };
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  gloveVariants.forEach((v, i) => {
    fd.append(`variants[${i}][id]`, String(v.id)); fd.append(`variants[${i}][label]`, v.label); fd.append(`variants[${i}][sku]`, `GLV-${v.label}`);
    fd.append(`variants[${i}][price]`, '120'); fd.append(`variants[${i}][stock]`, '50'); fd.append(`variants[${i}][weight_g]`, '600');
  });
  const png = Buffer.from('89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C4890000000D49444154789C6360000002000154A24F5D0000000049454E44AE426082', 'hex');
  fd.append('images', new Blob([png], { type: 'image/png' }), 'glove.png');
  fd.append('images', new Blob(['not an image'], { type: 'text/plain' }), 'evil.html'); // must be ignored
  const r = await admin.multipart(`/admin/products/${pid}`, fd, `/admin/products/${pid}`);
  assert.equal(r.status, 302, r.body);
  const imgs = db.prepare('SELECT * FROM product_images WHERE product_id = ?').all(pid);
  assert.equal(imgs.length, 1);
  assert.ok(imgs[0].filename.endsWith('.png'));
  const page = await browser().get('/product/nitrile-examination-gloves-powder-free-box-of-100');
  assert.match(page.body, /R120\.00/);
  assert.match(page.body, /R1\.20 per glove/);
  assert.match(page.body, /Bulk pricing/);
  assert.match(page.body, /In stock/);
  assert.match(page.body, /"@type":"Product"/);
});

test('cart applies bulk tier across sizes and quotes delivery by postal code', async () => {
  const b = browser();
  const prod = '/product/nitrile-examination-gloves-powder-free-box-of-100';
  await b.postWithCsrf('/cart/add', { variant: String(gloveVariants[1].id), qty: '6' }, prod);
  await b.postWithCsrf('/cart/add', { variant: String(gloveVariants[2].id), qty: '4' }, prod);
  const cart = await b.get('/cart?postal=7784');
  assert.match(cart.body, /5% bulk discount/);
  assert.match(cart.body, /R1,200\.00/); // subtotal 10 × R120
  assert.match(cart.body, /−R60\.00/); // 5% off
  assert.match(cart.body, /Cape Town next-day delivery:<\/b> R80\.00/);
  const far = await b.get('/cart?postal=2196');
  assert.match(far.body, /Nationwide courier[^<]*:<\/b> R150\.00/);
  assert.match(far.body, /Spend R860\.00 more for free delivery/);
});

test('stock limit: cannot add more than is in stock', async () => {
  const b = browser();
  await b.postWithCsrf('/cart/add', { variant: String(gloveVariants[0].id), qty: '999' }, '/product/nitrile-examination-gloves-powder-free-box-of-100');
  const cart = await b.get('/cart');
  assert.match(cart.body, /value="50"/);
});

const checkoutData = { name: 'Thandi Mokoena', email: 'thandi@example.co.za', phone: '0821234567', org_name: 'Harare Clinic', address1: '1 Main Rd',
  suburb: 'Harare', city: 'Cape Town', province: 'Western Cape', postal_code: '7784', delivery: 'local', agree: '1' };

test('guest checkout with PayFast: signed form, ITN marks paid, stock deducted, invoice emailed', async () => {
  const b = browser();
  await b.postWithCsrf('/cart/add', { variant: String(gloveVariants[2].id), qty: '2' }, '/product/nitrile-examination-gloves-powder-free-box-of-100');
  const r = await b.postWithCsrf('/checkout', { ...checkoutData, payment: 'payfast' }, '/checkout');
  assert.equal(r.status, 200);
  assert.match(r.body, /action="https:\/\/sandbox\.payfast\.co\.za\/eng\/process"/);
  const fields = Object.fromEntries([...r.body.matchAll(/name="([a-z_]+)" value="([^"]*)"/g)].map((m) => [m[1], m[2].replace(/&amp;/g, '&')]));
  assert.equal(fields.amount, '320.00'); // 2 × R120 + R80 delivery
  const { payfastSignature } = require('../src/routes/payments');
  const { signature, ...rest } = fields;
  assert.equal(signature, payfastSignature(rest, 'jt7NOE43FZPn'));

  const order = db.prepare('SELECT * FROM orders WHERE number = ?').get(fields.m_payment_id);
  assert.equal(order.payment_status, 'pending');
  const stockBefore = db.prepare('SELECT stock FROM variants WHERE id = ?').get(gloveVariants[2].id).stock;

  // Forged ITN (bad signature) is ignored
  const forged = new URLSearchParams({ m_payment_id: order.number, pf_payment_id: '1', payment_status: 'COMPLETE', amount_gross: '320.00', signature: 'bad' });
  await realFetch(base + '/payments/payfast/notify', { method: 'POST', body: forged });
  await new Promise((res) => setTimeout(res, 50));
  assert.equal(db.prepare('SELECT payment_status FROM orders WHERE id = ?').get(order.id).payment_status, 'pending');

  // Genuine ITN
  const itn = { m_payment_id: order.number, pf_payment_id: '1089250', payment_status: 'COMPLETE', item_name: `Order ${order.number}`,
    amount_gross: '320.00', amount_fee: '-9.20', amount_net: '310.80', name_first: 'Thandi', email_address: 'thandi@example.co.za', merchant_id: '10000100' };
  const sig = payfastSignature(itn, 'jt7NOE43FZPn');
  await realFetch(base + '/payments/payfast/notify', { method: 'POST', body: new URLSearchParams({ ...itn, signature: sig }) });
  await new Promise((res) => setTimeout(res, 300));
  const paid = db.prepare('SELECT * FROM orders WHERE id = ?').get(order.id);
  assert.equal(paid.payment_status, 'paid');
  assert.equal(db.prepare('SELECT stock FROM variants WHERE id = ?').get(gloveVariants[2].id).stock, stockBefore - 2);
  const mail = outbox().find((m) => m.subject.includes(`${order.number} confirmed`));
  assert.ok(mail, 'confirmation email sent');
  assert.deepEqual(mail.attachments, [`Invoice-${order.number}.pdf`]);

  // Guest can view order + invoice with token, others can't
  const view = await b.get(`/order/${order.number}?t=${order.access_token}`);
  assert.match(view.body, /Paid/);
  const pdf = await b.get(`/order/${order.number}/invoice.pdf?t=${order.access_token}`);
  assert.equal(pdf.body.subarray(0, 4).toString(), '%PDF');
  assert.equal((await browser().get(`/order/${order.number}`)).status, 404);

  // Admin ships it → tracking email
  await admin.postWithCsrf(`/admin/orders/${order.id}/ship`, { courier: 'The Courier Guy', tracking_no: 'TCG123' }, `/admin/orders/${order.id}`);
  const ship = outbox().find((m) => m.subject.includes('on its way'));
  assert.match(ship.html, /TCG123/);
  assert.match(ship.html, /example\.test\/track\?ref=TCG123/);
});

test('Yoco: checkout redirect, signed webhook marks paid, unsigned is rejected', async () => {
  const b = browser();
  await b.postWithCsrf('/cart/add', { variant: String(gloveVariants[3].id), qty: '1' }, '/product/nitrile-examination-gloves-powder-free-box-of-100');
  const r = await b.postWithCsrf('/checkout', { ...checkoutData, payment: 'yoco' }, '/checkout');
  assert.equal(r.status, 302);
  assert.equal(r.location, 'https://c.yoco.com/checkout/ch_123');
  const order = db.prepare("SELECT * FROM orders WHERE payment_ref = 'yoco:ch_123'").get();
  assert.ok(order);
  const body = JSON.stringify({ type: 'payment.succeeded', payload: { id: 'p_1', amount: order.total_cents, metadata: { checkoutId: 'ch_123' } } });
  const unsigned = await realFetch(base + '/payments/yoco/webhook', { method: 'POST', body, headers: { 'content-type': 'application/json' } });
  assert.equal(unsigned.status, 403);
  const id = 'msg_1', ts = String(Math.floor(Date.now() / 1000));
  const sig = crypto.createHmac('sha256', Buffer.from('test-secret-123')).update(`${id}.${ts}.${body}`).digest('base64');
  const ok = await realFetch(base + '/payments/yoco/webhook', { method: 'POST', body, headers: { 'content-type': 'application/json', 'webhook-id': id, 'webhook-timestamp': ts, 'webhook-signature': `v1,${sig}` } });
  assert.equal(ok.status, 200);
  await new Promise((res) => setTimeout(res, 300));
  assert.equal(db.prepare('SELECT payment_status FROM orders WHERE id = ?').get(order.id).payment_status, 'paid');
});

test('business account: apply, EFT hidden until approved, EFT order, admin marks paid, re-order', async () => {
  const b = browser();
  const reg = await b.postWithCsrf('/account/register', { org_name: 'Khaya Dental', org_type: 'Dental practice', name: 'Dr Sipho', email: 'sipho@khaya.co.za',
    phone: '0712223333', billing_address: '5 Long St, Cape Town', password: 'longpassword1', consent: '1' }, '/account/register');
  assert.equal(reg.location, '/account');
  await b.postWithCsrf('/cart/add', { variant: String(gloveVariants[1].id), qty: '20' }, '/product/nitrile-examination-gloves-powder-free-box-of-100');
  let co = await b.get('/checkout');
  assert.doesNotMatch(co.body, /value="eft"/);

  const cust = db.prepare("SELECT id FROM customers WHERE email = 'sipho@khaya.co.za'").get();
  await admin.postWithCsrf(`/admin/customers/${cust.id}`, { status: 'approved' }, '/admin/customers');
  co = await b.get('/checkout');
  assert.match(co.body, /value="eft"/);

  const r = await b.postWithCsrf('/checkout', { ...checkoutData, payment: 'eft' }, '/checkout');
  assert.equal(r.status, 302);
  const order = db.prepare('SELECT * FROM orders WHERE customer_id = ? ORDER BY id DESC').get(cust.id);
  assert.equal(order.payment_method, 'eft');
  assert.equal(order.discount_cents, 12000); // 20 boxes → 5% of R2,400
  assert.equal(order.delivery_cents, 0); // R2,280 ≥ R2,000 → free delivery
  const eftMail = outbox().find((m) => m.subject.includes(`${order.number} received`));
  assert.match(eftMail.html, /62000000000/);

  const stock = db.prepare('SELECT stock FROM variants WHERE id = ?').get(gloveVariants[1].id).stock;
  await admin.postWithCsrf(`/admin/orders/${order.id}/paid`, {}, `/admin/orders/${order.id}`);
  assert.equal(db.prepare('SELECT stock FROM variants WHERE id = ?').get(gloveVariants[1].id).stock, stock - 20);
  assert.ok(outbox().some((m) => m.subject.startsWith('Low stock alert')) || stock - 20 > 10);

  const acct = await b.get('/account');
  assert.match(acct.body, new RegExp(order.number));
  const inv = await b.get(`/order/${order.number}/invoice.pdf`);
  assert.equal(inv.body.subarray(0, 4).toString(), '%PDF');
  await b.postWithCsrf(`/account/reorder/${order.number}`, {}, '/account');
  const cart = await b.get('/cart');
  assert.match(cart.body, /Nitrile Examination Gloves/);

  // Another customer can't see this order
  const other = browser();
  assert.equal((await other.get(`/order/${order.number}`)).status, 404);
});

test('cancelling a paid order restores stock', async () => {
  const o = db.prepare("SELECT * FROM orders WHERE payment_method = 'eft' ORDER BY id DESC").get();
  const before = db.prepare('SELECT stock FROM variants WHERE id = ?').get(gloveVariants[1].id).stock;
  await admin.postWithCsrf(`/admin/orders/${o.id}/cancel`, {}, `/admin/orders/${o.id}`);
  assert.equal(db.prepare('SELECT stock FROM variants WHERE id = ?').get(gloveVariants[1].id).stock, before + 20);
});

test('quote request with file upload reaches admin; bad file types are dropped', async () => {
  const b = browser();
  const fd = new FormData();
  for (const [k, v] of Object.entries({ name: 'Nurse Zodwa', org_name: 'Care Home', org_type: 'Old-age / care home', email: 'z@care.co.za',
    phone: '0730000000', postal_code: '7784', items: 'Gloves M x 40', consent: '1' })) fd.append(k, v);
  fd.append('file', new Blob(['a,b\n1,2'], { type: 'text/csv' }), 'order-list.csv');
  const r = await b.multipart('/quote', fd, '/quote');
  assert.equal(r.location, '/quote?sent=1');
  const q = db.prepare('SELECT * FROM quotes ORDER BY id DESC').get();
  assert.equal(q.file_original, 'order-list.csv');
  const dl = await admin.get(`/admin/quotes/${q.id}/file`);
  assert.equal(dl.body, 'a,b\n1,2');
  assert.equal((await browser().get(`/admin/quotes/${q.id}/file`)).status, 302); // not public
});

test('shop filters, search and sorting', async () => {
  const b = browser();
  const sterile = await b.get('/shop?sterile=1');
  assert.match(sterile.body, /Hypodermic Needles/);
  assert.doesNotMatch(sterile.body, /Vinyl Examination Gloves/);
  const size = await b.get('/shop/gloves?size=XS');
  assert.match(size.body, /Nitrile Examination/);
  assert.doesNotMatch(size.body, /Latex Examination/);
  const q = await b.get('/shop?q=syringe');
  assert.match(q.body, /Disposable Syringes/);
  const sorted = await b.get('/shop?sort=price_asc');
  assert.ok(sorted.body.indexOf('Nitrile Examination') < sorted.body.indexOf('Vinyl Examination')); // priced first
  const instock = await b.get('/shop?instock=1');
  assert.match(instock.body, /1 product\b/);
});

test('SEO: sitemap, robots, titles, escaping of user input', async () => {
  const b = browser();
  assert.match((await b.get('/sitemap.xml')).body, /\/product\/nitrile-examination-gloves/);
  assert.match((await b.get('/robots.txt')).body, /Disallow: \/admin/);
  assert.match((await b.get('/')).body, /<title>Medical Supplies Cape Town \| Micheals Dynamics<\/title>/);
  const xss = await b.get('/shop?q=%3Cscript%3Ealert(1)%3C%2Fscript%3E');
  assert.doesNotMatch(xss.body, /<script>alert/);
});
