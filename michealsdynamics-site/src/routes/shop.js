const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const multer = require('multer');
const config = require('../config');
const { db, getSettings } = require('../db');
const shop = require('../shop');
const views = require('../views/shop');
const { layout } = require('../views/layout');
const { pages } = require('../content/pages');
const { html, isEmail, clean, verifyCsrf, rateLimit } = require('../util');
const { sendMail } = require('../email');

const router = express.Router();

router.get('/', (req, res) => {
  const s = getSettings();
  let featured = shop.bestsellers(8);
  if (!featured.length) featured = shop.listProducts({}).products.slice(0, 8);
  res.send(layout(req, {
    title: 'Medical Supplies Cape Town | Micheals Dynamics',
    description: 'Buy medical consumables online: nitrile gloves, wound dressings, syringes, swabs, IV giving sets and PPE. Next-day delivery in Cape Town, courier nationwide.',
    body: views.home({ s, cats: shop.categories(), featured }),
  }));
});

function shopHandler(req, res, next) {
  const cats = shop.categories();
  const cat = req.params.category ? cats.find((c) => c.slug === req.params.category) : null;
  if (req.params.category && !cat) return next();
  const q = req.query;
  const f = {
    q: clean(q.q, 100), sort: clean(q.sort, 20), sterile: clean(q.sterile, 1), instock: clean(q.instock, 1), page: clean(q.page, 4),
    size: [].concat(q.size || []).map((x) => clean(x, 40)), material: [].concat(q.material || []).map((x) => clean(x, 60)),
    brand: [].concat(q.brand || []).map((x) => clean(x, 60)), pack: [].concat(q.pack || []).map((x) => clean(x, 8)),
  };
  const result = shop.listProducts({ ...f, category: cat && cat.slug });
  const filtered = Object.entries(f).some(([k, v]) => k !== 'page' && (Array.isArray(v) ? v.length : v));
  res.send(layout(req, {
    title: cat ? (cat.seo_title || `${cat.name} | Buy Online South Africa`) : f.q ? `Search results for "${f.q}"` : 'Shop Medical Consumables Online',
    description: cat ? (cat.seo_description || cat.description) : 'Gloves, wound care, syringes, needles, swabs, IV giving sets and PPE for clinics, practices, pharmacies and home care. Free delivery over R2,000.',
    path: cat ? `/shop/${cat.slug}` : '/shop',
    noindex: filtered,
    query: f.q,
    body: views.shopPage({ cat, result, f, cats }),
  }));
}
router.get('/shop', shopHandler);
router.get('/shop/:category', shopHandler);

router.get('/product/:slug', (req, res, next) => {
  const p = shop.productBySlug(req.params.slug);
  if (!p) return next();
  const s = getSettings();
  const priced = p.variants.filter((v) => v.price_cents !== null);
  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'Product', name: p.name, sku: p.variants[0] && p.variants[0].sku,
    ...(p.brand ? { brand: { '@type': 'Brand', name: p.brand } } : {}),
    ...(p.images.length ? { image: p.images.map((i) => `${config.baseUrl}/uploads/${i.filename}`) } : {}),
    description: p.seo_description || p.description || p.name,
    ...(priced.length ? { offers: {
      '@type': 'AggregateOffer', priceCurrency: 'ZAR', lowPrice: (Math.min(...priced.map((v) => v.price_cents)) / 100).toFixed(2),
      highPrice: (Math.max(...priced.map((v) => v.price_cents)) / 100).toFixed(2), offerCount: priced.length,
      availability: p.inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
    } } : {}),
  };
  res.send(layout(req, {
    title: p.seo_title || `${p.name} | Buy Online South Africa`,
    description: p.seo_description || `Buy ${p.name.toLowerCase()} online in South Africa. Next-day delivery in Cape Town, nationwide courier.`.slice(0, 160),
    path: `/product/${p.slug}`,
    jsonLd,
    body: views.productPage(req, { p, s }),
  }));
});

// Information and legal pages
for (const key of Object.keys(pages)) {
  router.get(`/${key}`, (req, res) => {
    const pg = pages[key](getSettings());
    const jsonLd = pg.faq ? { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: pg.faq.map(([q, a]) => ({
      '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: String(a).replace(/<[^>]+>/g, '') } })) } : null;
    res.send(layout(req, { title: pg.title, description: pg.description, jsonLd, body: views.infoPage(pg) }));
  });
}

// Contact
router.get('/contact', (req, res) => {
  const s = getSettings();
  res.send(layout(req, {
    title: 'Contact Us | Medical Supplies Cape Town',
    description: `Call or WhatsApp ${s.phone_1}. Visit us at ${s.address}.`,
    body: views.contactPage(req, { s, sent: req.query.sent === '1' }),
  }));
});
router.post('/contact', rateLimit({ windowMs: 3600000, max: 10 }), async (req, res) => {
  const b = req.body;
  if (!clean(b.name) || !isEmail(b.email) || !clean(b.message) || b.consent !== '1') return res.status(400).send('Please fill in all required fields.');
  const m = { name: clean(b.name, 120), email: clean(b.email, 160), phone: clean(b.phone, 30), message: clean(b.message, 3000) };
  db.prepare('INSERT INTO messages (name, email, phone, message) VALUES (?,?,?,?)').run(m.name, m.email, m.phone, m.message);
  await sendMail({ to: config.mail.adminTo, replyTo: m.email, subject: `Website message from ${m.name}`,
    html: String(html`<p><b>${m.name}</b> (${m.email}, ${m.phone})</p><p style="white-space:pre-wrap">${m.message}</p>`) });
  res.redirect('/contact?sent=1');
});

// Request a quote (with optional file upload)
const quoteDir = path.join(config.uploadDir, '..', 'quote-files'); // not publicly served
fs.mkdirSync(quoteDir, { recursive: true });
const ALLOWED = ['.pdf', '.xls', '.xlsx', '.doc', '.docx', '.csv', '.jpg', '.jpeg', '.png'];
const quoteUpload = multer({
  storage: multer.diskStorage({
    destination: quoteDir,
    filename: (req, file, cb) => cb(null, crypto.randomBytes(12).toString('hex') + path.extname(file.originalname).toLowerCase()),
  }),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => cb(null, ALLOWED.includes(path.extname(file.originalname).toLowerCase())),
});

router.get('/quote', (req, res) => {
  const s = getSettings();
  const values = req.query.product ? { items: `${clean(req.query.product, 200)} – ` } : {};
  res.send(layout(req, {
    title: 'Request a Quote for Bulk Medical Supplies',
    description: 'Request a quote for bulk or institutional orders of medical consumables. Clinics, hospitals, schools and care homes. Reply within 1 business day.',
    body: views.quotePage(req, { s, values, sent: req.query.sent === '1' }),
  }));
});
router.post('/quote', rateLimit({ windowMs: 3600000, max: 10 }), (req, res, next) => {
  quoteUpload.single('file')(req, res, (err) => {
    if (err) return res.status(400).send(err.code === 'LIMIT_FILE_SIZE' ? 'File is too large (max 10 MB).' : 'Upload failed. Please try again.');
    next();
  });
}, async (req, res) => {
  const removeFile = () => req.file && fs.rmSync(req.file.path, { force: true });
  if (!verifyCsrf(req)) { removeFile(); return res.status(403).send('Your session expired. Please go back, refresh the page and try again.'); }
  const b = req.body;
  const v = {
    name: clean(b.name, 120), org_name: clean(b.org_name, 160), org_type: clean(b.org_type, 60), email: clean(b.email, 160),
    phone: clean(b.phone, 30), postal_code: clean(b.postal_code, 4), items: clean(b.items, 5000), reference: clean(b.reference, 120), needed_by: clean(b.needed_by, 10),
  };
  if (!v.name || !v.org_name || !v.org_type || !isEmail(v.email) || !v.phone || !/^\d{4}$/.test(v.postal_code) || b.consent !== '1' || (!v.items && !req.file)) {
    removeFile();
    req.session.flash = [{ type: 'error', text: 'Please fill in the required fields and either list the products or upload your order list.' }];
    return res.send(layout(req, { title: 'Request a Quote', body: views.quotePage(req, { s: getSettings(), values: v }) }));
  }
  const info = db.prepare(`INSERT INTO quotes (name, org_name, org_type, email, phone, postal_code, items, reference, needed_by, file, file_original)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(v.name, v.org_name, v.org_type, v.email, v.phone, v.postal_code, v.items, v.reference, v.needed_by,
    req.file ? req.file.filename : '', req.file ? clean(req.file.originalname, 200) : '');
  await sendMail({
    to: config.mail.adminTo, replyTo: v.email, subject: `Quote request from ${v.org_name}`,
    html: String(html`<p><b>${v.org_name}</b> (${v.org_type}) — ${v.name}, ${v.email}, ${v.phone}, postal code ${v.postal_code}</p>
      <p style="white-space:pre-wrap">${v.items}</p><p>Reference: ${v.reference} · Needed by: ${v.needed_by}</p>
      <p><a href="${config.baseUrl}/admin/quotes/${info.lastInsertRowid}">Open in admin</a></p>`),
    attachments: req.file ? [{ filename: req.file.originalname, path: req.file.path }] : [],
  });
  await sendMail({ to: v.email, subject: 'We received your quote request', html: String(html`<p>Hi ${v.name},</p>
    <p>Thank you — we received your quote request and will reply, usually within one business day.</p><p>${getSettings().trading_name}</p>`) });
  res.redirect('/quote?sent=1');
});

// SEO files
router.get('/robots.txt', (req, res) => {
  res.type('text/plain').send(`User-agent: *\nDisallow: /admin\nDisallow: /cart\nDisallow: /checkout\nDisallow: /account\nDisallow: /order/\nSitemap: ${config.baseUrl}/sitemap.xml\n`);
});
router.get('/sitemap.xml', (req, res) => {
  const urls = ['/', '/shop', '/quote', '/contact', ...Object.keys(pages).map((k) => `/${k}`),
    ...shop.categories().map((c) => `/shop/${c.slug}`),
    ...db.prepare('SELECT slug FROM products WHERE published = 1').all().map((p) => `/product/${p.slug}`)];
  res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${
    urls.map((u) => `  <url><loc>${config.baseUrl}${u}</loc></url>`).join('\n')}\n</urlset>\n`);
});

module.exports = router;
