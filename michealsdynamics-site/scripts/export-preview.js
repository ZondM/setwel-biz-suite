// Builds a static HTML preview of the shop in ./preview (open preview/index.html in any browser).
// Uses a temporary empty database, so it shows exactly what a new install looks like.
// Usage: npm run preview
const fs = require('fs');
const os = require('os');
const path = require('path');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'md-preview-'));
Object.assign(process.env, { DATA_DIR: tmp, BASE_URL: 'https://michealsdynamics.co.za', ADMIN_EMAIL: 'preview@example.com', ADMIN_PASSWORD: 'preview-only-123' });
const app = require('../src/app');
const { db } = require('../src/db');

const root = path.join(__dirname, '..');
const out = path.join(root, 'preview');
const css = fs.readFileSync(path.join(root, 'public/css/site.css'), 'utf8');
const adminCss = fs.readFileSync(path.join(root, 'public/css/admin.css'), 'utf8');
const siteJs = fs.readFileSync(path.join(root, 'public/js/site.js'), 'utf8');
const placeholder = 'data:image/svg+xml;base64,' + fs.readFileSync(path.join(root, 'public/img/placeholder.svg')).toString('base64');
const favicon = 'data:image/svg+xml;base64,' + fs.readFileSync(path.join(root, 'public/img/favicon.svg')).toString('base64');

// URL on the live site -> file name in the preview
const pages = new Map([
  ['/', 'index.html'], ['/shop', 'shop.html'], ['/cart', 'cart.html'], ['/quote', 'quote.html'], ['/contact', 'contact.html'],
  ['/about', 'about.html'], ['/faq', 'faq.html'], ['/delivery-returns', 'delivery-returns.html'], ['/privacy-policy', 'privacy-policy.html'],
  ['/terms', 'terms.html'], ['/returns-policy', 'returns-policy.html'], ['/cookies', 'cookies.html'],
  ['/account', 'account.html'], ['/account/register', 'account-register.html'], ['/account/login', 'account-login.html'], ['/account/forgot', 'account-forgot.html'],
]);
for (const c of db.prepare('SELECT slug FROM categories').all()) pages.set(`/shop/${c.slug}`, `shop-${c.slug}.html`);
for (const p of db.prepare('SELECT slug FROM products').all()) pages.set(`/product/${p.slug}`, `product-${p.slug}.html`);
const adminPages = new Map([['/admin/login', 'admin-login.html'], ['/admin', 'admin-dashboard.html'], ['/admin/orders', 'admin-orders.html'],
  ['/admin/products', 'admin-products.html'], ['/admin/stock', 'admin-prices-stock.html'], ['/admin/categories', 'admin-categories.html'],
  ['/admin/customers', 'admin-business-accounts.html'], ['/admin/quotes', 'admin-quotes.html'], ['/admin/messages', 'admin-messages.html'],
  ['/admin/settings', 'admin-settings.html'], ['/admin/products/new', 'admin-add-product.html']]);
const firstProduct = db.prepare('SELECT id FROM products ORDER BY id LIMIT 1').get().id;
adminPages.set(`/admin/products/${firstProduct}`, 'admin-edit-product.html');
const all = new Map([...pages, ...adminPages]);

const BANNER = '<div style="background:#FFF4D6;color:#5A3B00;padding:8px 16px;font:14px/1.4 system-ui,sans-serif;text-align:center;border-bottom:1px solid #E8D29A">' +
  '<b>Preview only.</b> Pages and design are real; search, cart, forms and payments only work when the site runs on a server.</div>';
const BLOCK_FORMS = '<script>document.addEventListener("submit",function(e){e.preventDefault();alert("Preview only: this works once the website is running on a server.");},true);</script>';

function convert(htmlText, isAdmin) {
  let h = htmlText;
  h = h.replace(/<link rel="stylesheet" href="\/css\/site\.css">/, `<style>${css}</style>`);
  h = h.replace(/<link rel="stylesheet" href="\/css\/admin\.css">/, `<style>${adminCss}</style>`);
  h = h.replace(/<script src="\/js\/site\.js" defer><\/script>/, `<script>${siteJs}</script>`);
  h = h.replace(/<script src="\/js\/admin\.js" defer><\/script>/, '');
  h = h.replace(/\/img\/placeholder\.svg/g, placeholder).replace(/\/img\/favicon\.svg/g, favicon);
  // Internal links -> preview files (anything not exported becomes "#")
  h = h.replace(/href="(\/[^"#]*)(#[^"]*)?"/g, (m, url, hash = '') => {
    const clean = url.split('?')[0].replace(/&amp;.*$/, '');
    const file = all.get(clean) || all.get(clean.replace(/\/$/, '')) ;
    return `href="${file ? file + hash : '#'}"`;
  });
  h = h.replace(/<body([^>]*)>/, `<body$1>${BANNER}`).replace('</body>', `${BLOCK_FORMS}</body>`);
  if (isAdmin) h = h.replace('<details class="adm-menu">', '<details class="adm-menu" open>');
  return h;
}

(async () => {
  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  let cookie = '';
  const get = async (p, opts = {}) => {
    const r = await fetch(base + p, { redirect: 'manual', ...opts, headers: { ...(opts.headers || {}), cookie } });
    for (const c of r.headers.getSetCookie()) if (c.startsWith('sid=')) cookie = c.split(';')[0];
    return { status: r.status, text: await r.text() };
  };
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });

  for (const [url, file] of pages) {
    const r = await get(url);
    fs.writeFileSync(path.join(out, file), convert(r.text, false));
  }
  // Admin: save the login page, then log in and save the admin screens.
  const login = await get('/admin/login');
  fs.writeFileSync(path.join(out, 'admin-login.html'), convert(login.text, true));
  const csrf = login.text.match(/name="_csrf" value="([a-f0-9]+)"/)[1];
  await get('/admin/login', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ _csrf: csrf, email: 'preview@example.com', password: 'preview-only-123' }) });
  for (const [url, file] of adminPages) {
    if (url === '/admin/login') continue;
    const r = await get(url);
    if (r.status !== 200) throw new Error(`${url} returned ${r.status}`);
    fs.writeFileSync(path.join(out, file), convert(r.text, true));
  }

  // A contents page listing every preview file
  const list = (m) => [...m].map(([u, f]) => `<li><a href="${f}">${f}</a> <span style="color:#5A6A70">— ${u}</span></li>`).join('');
  fs.writeFileSync(path.join(out, 'all-pages.html'), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>All preview pages</title><style>body{font:16px/1.6 system-ui,sans-serif;max-width:760px;margin:0 auto;padding:16px;color:#10202A}a{color:#0B6E78}li{margin:4px 0;word-break:break-word}</style></head>
<body><h1>Micheals Dynamics — website preview</h1><p>Open any page below. Start with <a href="index.html">index.html</a> (home page).</p>
<h2>Shop pages</h2><ul>${list(pages)}</ul><h2>Admin panel (what you will use)</h2><ul>${list(adminPages)}</ul></body></html>`);

  server.close();
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`Preview written: ${fs.readdirSync(out).length} files in ${out}`);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
