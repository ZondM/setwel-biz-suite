// Catalogue, cart pricing, delivery and order logic.
const { db, getSettings, tx } = require('./db');
const { parseTiers, tierFor, token } = require('./util');

// ---------- Catalogue ----------
function categories() {
  return db.prepare('SELECT * FROM categories ORDER BY sort, name').all();
}
function productImages(productId) {
  return db.prepare('SELECT * FROM product_images WHERE product_id = ? ORDER BY sort, id').all(productId);
}
function productVariants(productId) {
  return db.prepare('SELECT * FROM variants WHERE product_id = ? ORDER BY sort, id').all(productId);
}
function decorate(p) {
  if (!p) return p;
  p.variants = productVariants(p.id);
  p.images = productImages(p.id);
  const prices = p.variants.map((v) => v.price_cents).filter((c) => c !== null && c !== undefined);
  p.minPrice = prices.length ? Math.min(...prices) : null;
  p.inStock = p.variants.some((v) => v.stock > 0 && v.price_cents !== null);
  p.tiers = parseTiers(p.bulk_tiers);
  return p;
}
function productBySlug(slug, { includeHidden = false } = {}) {
  const p = db.prepare(`SELECT p.*, c.name AS category_name, c.slug AS category_slug FROM products p
    LEFT JOIN categories c ON c.id = p.category_id WHERE p.slug = ? ${includeHidden ? '' : 'AND p.published = 1'}`).get(slug);
  return decorate(p);
}

// Shop listing with filters + sorting. Returns { products, total, facets }.
function listProducts(f = {}) {
  const where = ['p.published = 1'];
  const params = [];
  if (f.category) { where.push('c.slug = ?'); params.push(f.category); }
  if (f.q) {
    const words = String(f.q).toLowerCase().split(/\s+/).filter(Boolean).slice(0, 6);
    for (const w of words) {
      where.push("(lower(p.name) LIKE ? OR lower(p.brand) LIKE ? OR lower(p.material) LIKE ? OR lower(p.description) LIKE ? OR lower(IFNULL(c.name,'')) LIKE ?)");
      params.push(...Array(5).fill(`%${w}%`));
    }
  }
  const multi = (field, values) => {
    const list = [].concat(values || []).filter(Boolean);
    if (list.length) { where.push(`${field} IN (${list.map(() => '?').join(',')})`); params.push(...list); }
  };
  multi('p.material', f.material);
  multi('p.brand', f.brand);
  multi('CAST(p.pack_qty AS TEXT)', f.pack);
  if (f.sterile === '1') where.push('p.sterile = 1');
  if (f.sterile === '0') where.push('p.sterile = 0');
  const sizes = [].concat(f.size || []).filter(Boolean);
  if (sizes.length) {
    where.push(`EXISTS (SELECT 1 FROM variants v WHERE v.product_id = p.id AND v.label IN (${sizes.map(() => '?').join(',')}))`);
    params.push(...sizes);
  }
  if (f.instock === '1') where.push('EXISTS (SELECT 1 FROM variants v WHERE v.product_id = p.id AND v.stock > 0 AND v.price_cents IS NOT NULL)');

  const minPriceSql = '(SELECT MIN(v.price_cents) FROM variants v WHERE v.product_id = p.id)';
  const order = {
    featured: 'p.bestseller DESC, p.name',
    price_asc: `${minPriceSql} IS NULL, ${minPriceSql} ASC`,
    price_desc: `${minPriceSql} IS NULL, ${minPriceSql} DESC`,
    name: 'p.name',
    newest: 'p.created_at DESC, p.id DESC',
  }[f.sort] || 'p.bestseller DESC, p.name';

  const base = `FROM products p LEFT JOIN categories c ON c.id = p.category_id WHERE ${where.join(' AND ')}`;
  const total = db.prepare(`SELECT COUNT(*) AS n ${base}`).get(...params).n;
  const perPage = 24;
  const page = Math.max(1, Number(f.page) || 1);
  const products = db.prepare(`SELECT p.*, c.name AS category_name, c.slug AS category_slug ${base} ORDER BY ${order} LIMIT ? OFFSET ?`)
    .all(...params, perPage, (page - 1) * perPage).map(decorate);

  // Facet values (from all published products in this category, so filters don't disappear).
  const facetWhere = f.category ? 'AND c.slug = ?' : '';
  const fp = f.category ? [f.category] : [];
  const distinct = (col) => db.prepare(`SELECT DISTINCT ${col} AS v FROM products p LEFT JOIN categories c ON c.id = p.category_id
    WHERE p.published = 1 ${facetWhere} AND ${col} IS NOT NULL AND ${col} != '' ORDER BY ${col}`).all(...fp).map((r) => String(r.v));
  const facets = {
    material: distinct('p.material'),
    brand: distinct('p.brand'),
    pack: distinct('p.pack_qty').sort((a, b) => a - b),
    size: db.prepare(`SELECT DISTINCT v.label AS v FROM variants v JOIN products p ON p.id = v.product_id LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.published = 1 ${facetWhere} AND v.label NOT IN ('Standard','') ORDER BY v.sort, v.label`).all(...fp).map((r) => r.v),
  };
  return { products, total, page, pages: Math.max(1, Math.ceil(total / perPage)), facets };
}

function bestsellers(limit = 8) {
  return db.prepare('SELECT p.*, c.slug AS category_slug FROM products p LEFT JOIN categories c ON c.id = p.category_id WHERE p.published = 1 AND p.bestseller = 1 ORDER BY p.name LIMIT ?')
    .all(limit).map(decorate);
}

function stockStatus(variant, settings = getSettings()) {
  if (variant.price_cents === null || variant.price_cents === undefined) return { key: 'request', text: 'Price on request' };
  if (variant.stock <= 0) return { key: 'out', text: 'Out of stock' };
  if (variant.stock <= Number(settings.low_stock_threshold || 10)) return { key: 'low', text: 'Low stock — order soon' };
  return { key: 'in', text: 'In stock' };
}

// ---------- Cart ----------
// cart = { [variantId]: qty }
function priceCart(cart = {}) {
  const ids = Object.keys(cart).map(Number).filter(Boolean);
  if (!ids.length) return { lines: [], subtotal: 0, discount: 0, goods: 0, weight: 0, problems: [] };
  const rows = db.prepare(`SELECT v.*, p.name AS product_name, p.slug, p.published, p.bulk_tiers, p.pack_qty, p.unit_label, p.id AS pid
    FROM variants v JOIN products p ON p.id = v.product_id WHERE v.id IN (${ids.map(() => '?').join(',')})`).all(...ids);
  const problems = [];
  const lines = [];
  const qtyByProduct = {};
  for (const r of rows) {
    const qty = Math.max(0, Math.floor(Number(cart[r.id]) || 0));
    if (!qty) continue;
    if (!r.published || r.price_cents === null) { problems.push(`${r.product_name} is no longer available online and was removed.`); continue; }
    lines.push({ ...r, qty });
    qtyByProduct[r.pid] = (qtyByProduct[r.pid] || 0) + qty;
  }
  let subtotal = 0, discount = 0, weight = 0;
  for (const l of lines) {
    if (l.qty > l.stock) problems.push(`Only ${Math.max(0, l.stock)} of ${l.product_name} (${l.label}) in stock.`);
    const tier = tierFor(parseTiers(l.bulk_tiers), qtyByProduct[l.pid]);
    l.tier = tier;
    l.unit_price = tier ? Math.round(l.price_cents * (100 - tier.pct) / 100) : l.price_cents;
    l.line_total = l.unit_price * l.qty;
    subtotal += l.price_cents * l.qty;
    discount += (l.price_cents - l.unit_price) * l.qty;
    weight += (l.weight_g || 0) * l.qty;
    const img = db.prepare('SELECT filename FROM product_images WHERE product_id = ? ORDER BY sort, id LIMIT 1').get(l.pid);
    l.image = img ? img.filename : null;
  }
  lines.sort((a, b) => a.product_name.localeCompare(b.product_name) || a.sort - b.sort);
  return { lines, subtotal, discount, goods: subtotal - discount, weight, problems };
}

// ---------- Delivery ----------
function inRanges(postal, ranges) {
  const pc = Number(postal);
  return String(ranges || '').split(',').some((r) => {
    const [lo, hi] = r.trim().split('-').map((x) => Number(x.trim()));
    return Number.isFinite(lo) && pc >= lo && pc <= (Number.isFinite(hi) ? hi : lo);
  });
}
const feeCents = (v) => (String(v ?? '').trim() === '' ? null : Math.round(Number(v) * 100));

// Returns the delivery options for a postal code and goods value (cents).
function deliveryOptions(postal, goodsCents, settings = getSettings()) {
  const opts = [];
  const valid = /^\d{4}$/.test(String(postal || ''));
  const freeOver = feeCents(settings.free_threshold);
  const isFree = freeOver !== null && goodsCents >= freeOver;
  if (valid) {
    const local = inRanges(postal, settings.local_ranges);
    const fee = feeCents(local ? settings.local_fee : settings.national_fee);
    const id = local ? 'local' : 'national';
    const label = local ? settings.local_label : settings.national_label;
    if (fee === null) {
      opts.push({ id, label, cents: null, available: false, note: 'Delivery to this area is not set up online yet — please contact us for a quote.' });
    } else {
      opts.push({ id, label, cents: isFree ? 0 : fee, available: true, free: isFree });
    }
  }
  if (settings.allow_collection === '1') opts.push({ id: 'collect', label: settings.collection_label, cents: 0, available: true });
  return { valid, options: opts, freeOver, isFree, shortBy: freeOver !== null && !isFree ? freeOver - goodsCents : 0 };
}

// ---------- Orders ----------
function nextOrderNumber() {
  const row = db.prepare('SELECT MAX(id) AS m FROM orders').get();
  return 'MD-' + String(10000 + (row.m || 0) + 1);
}

function createOrder({ cart, customer, form, paymentMethod, delivery }) {
  const priced = priceCart(cart);
  if (!priced.lines.length) throw new Error('Your cart is empty.');
  if (priced.problems.length) throw new Error(priced.problems.join(' '));
  return tx(() => {
    const number = nextOrderNumber();
    const total = priced.goods + delivery.cents;
    const info = db.prepare(`INSERT INTO orders (number, access_token, customer_id, email, name, phone, org_name, address1, address2, suburb, city,
      province, postal_code, notes, delivery_method, delivery_label, delivery_cents, subtotal_cents, discount_cents, total_cents, payment_method)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      number, token(16), customer ? customer.id : null, form.email, form.name, form.phone, form.org_name || '',
      form.address1 || '', form.address2 || '', form.suburb || '', form.city || '', form.province || '', form.postal_code || '',
      form.notes || '', delivery.id, delivery.label, delivery.cents, priced.subtotal, priced.discount, total, paymentMethod);
    const orderId = Number(info.lastInsertRowid);
    const ins = db.prepare(`INSERT INTO order_items (order_id, product_id, variant_id, name, variant_label, sku, base_price_cents, unit_price_cents, qty, line_total_cents)
      VALUES (?,?,?,?,?,?,?,?,?,?)`);
    for (const l of priced.lines) ins.run(orderId, l.pid, l.id, l.product_name, l.label, l.sku || '', l.price_cents, l.unit_price, l.qty, l.line_total);
    return getOrder(orderId);
  });
}

function getOrder(id) {
  const o = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
  if (o) o.items = db.prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY id').all(o.id);
  return o;
}
function getOrderByNumber(number) {
  const o = db.prepare('SELECT id FROM orders WHERE number = ?').get(String(number));
  return o ? getOrder(o.id) : null;
}

// Deduct stock once; returns variants that are now at/below the low-stock threshold.
function deductStock(order) {
  if (order.stock_deducted) return [];
  const threshold = Number(getSettings().low_stock_threshold || 10);
  const low = [];
  tx(() => {
    for (const it of order.items) {
      if (!it.variant_id) continue;
      db.prepare('UPDATE variants SET stock = stock - ? WHERE id = ?').run(it.qty, it.variant_id);
      const v = db.prepare('SELECT v.*, p.name AS product_name FROM variants v JOIN products p ON p.id = v.product_id WHERE v.id = ?').get(it.variant_id);
      if (v && v.stock <= threshold) low.push(v);
    }
    db.prepare('UPDATE orders SET stock_deducted = 1 WHERE id = ?').run(order.id);
  });
  return low;
}
function restoreStock(order) {
  if (!order.stock_deducted) return;
  tx(() => {
    for (const it of order.items) if (it.variant_id) db.prepare('UPDATE variants SET stock = stock + ? WHERE id = ?').run(it.qty, it.variant_id);
    db.prepare('UPDATE orders SET stock_deducted = 0 WHERE id = ?').run(order.id);
  });
}

function lowStockVariants() {
  const threshold = Number(getSettings().low_stock_threshold || 10);
  return db.prepare(`SELECT v.*, p.name AS product_name, p.id AS pid FROM variants v JOIN products p ON p.id = v.product_id
    WHERE p.published = 1 AND v.price_cents IS NOT NULL AND v.stock <= ? ORDER BY v.stock, p.name`).all(threshold);
}

module.exports = {
  categories, productBySlug, listProducts, bestsellers, stockStatus, decorate,
  priceCart, deliveryOptions, inRanges, createOrder, getOrder, getOrderByNumber,
  deductStock, restoreStock, lowStockVariants, productImages, productVariants,
};
