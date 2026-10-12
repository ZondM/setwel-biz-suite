const { html, raw, money } = require('../util');
const { stockStatus } = require('../shop');
const { csrfField, waLink } = require('./layout');

const placeholder = (alt, cls = '') => html`<img class="${cls}" src="/img/placeholder.svg" alt="${alt} — photo coming soon" width="600" height="600" loading="lazy">`;
const productImg = (p, cls = '', eager = false) => p.images && p.images.length
  ? html`<img class="${cls}" src="/uploads/${p.images[0].filename}" alt="${p.images[0].alt || p.name}" width="600" height="600" ${eager ? '' : raw('loading="lazy"')}>`
  : placeholder(p.name, cls);
const sterileBadge = (p) => p.sterile === 1 ? html`<span class="tag tag--solid">Sterile</span>` : p.sterile === 0 ? html`<span class="tag">Non-sterile</span>` : '';

function productCard(p) {
  return html`<article class="card">
    <a href="/product/${p.slug}" class="card__img">${productImg(p)}</a>
    <div class="card__body">
      <div class="card__tags">${sterileBadge(p)}${p.pack_qty > 1 ? html`<span class="tag">Pack of ${p.pack_qty}</span>` : ''}</div>
      <h3 class="card__title"><a href="/product/${p.slug}">${p.name}</a></h3>
      ${p.minPrice !== null
        ? html`<p class="card__price">${p.variants.length > 1 ? 'From ' : ''}${money(p.minPrice)}${p.pack_qty > 1 ? html` <small>(${money(p.minPrice / p.pack_qty)} per ${p.unit_label})</small>` : ''}</p>
           <p class="stock stock--${p.inStock ? 'in' : 'out'}">${p.inStock ? 'In stock' : 'Out of stock'}</p>`
        : html`<p class="card__price card__price--req">Price on request</p>`}
    </div>
  </article>`;
}

function home({ s, cats, featured }) {
  return html`
  <section class="hero">
    <div class="wrap hero__inner">
      <h1>Medical supplies in Cape Town, delivered next day</h1>
      <p class="hero__sub">Gloves, wound dressings, syringes and needles, swabs, IV giving sets and PPE for clinics, practices, pharmacies, care homes and home-care nurses.</p>
      <form class="hero__search" action="/shop" method="get" role="search">
        <label class="sr" for="hq">Search products</label>
        <input id="hq" name="q" type="search" placeholder="e.g. nitrile gloves, gauze swabs, 5 ml syringe">
        <button class="btn">Search</button>
      </form>
      <div class="hero__actions">
        <a class="btn btn--dark" href="/shop">Shop all products</a>
        <a class="btn btn--wa" href="${waLink(s)}" target="_blank" rel="noopener">Order on WhatsApp</a>
      </div>
      <ul class="trust">
        <li>SAHPRA licence ${s.sahpra_no}</li>
        <li>Free delivery over ${money(Number(s.free_threshold || 0) * 100).replace('.00', '')}</li>
        <li>Next-day Cape Town delivery</li>
        <li>No VAT added</li>
      </ul>
    </div>
  </section>

  <section class="wrap section">
    <h2>Shop by category</h2>
    <div class="tiles">
      ${cats.map((c) => html`<a class="tile" href="/shop/${c.slug}"><span class="tile__name">${c.name}</span><span class="tile__desc">${c.description}</span><span class="tile__go" aria-hidden="true">→</span></a>`)}
    </div>
  </section>

  ${featured.length ? html`<section class="wrap section">
    <div class="section__head"><h2>Bestsellers</h2><a href="/shop">View all</a></div>
    <div class="grid">${featured.map(productCard)}</div>
  </section>` : ''}

  <section class="band">
    <div class="wrap section">
      <h2>Why buy from Micheals Dynamics</h2>
      <div class="why">
        <div><h3>Licensed supplier</h3><p>SAHPRA medical device licence no. ${s.sahpra_no}. Company reg. ${s.reg_no}.</p></div>
        <div><h3>Fast, tracked delivery</h3><p>Next working day in Cape Town. Courier nationwide with tracking by email.</p></div>
        <div><h3>Bulk & institutional pricing</h3><p>Automatic bulk discounts, written quotes and EFT for business accounts.</p></div>
        <div><h3>No VAT added</h3><p>We are not VAT registered — the price you see is the price you pay (plus delivery where applicable).</p></div>
      </div>
    </div>
  </section>

  <section class="wrap section cta">
    <div>
      <h2>Ordering for a clinic, practice or facility?</h2>
      <p>Send us your order list and we'll reply with a written quote, usually within one business day.</p>
    </div>
    <div class="cta__btns"><a class="btn" href="/quote">Request a quote</a><a class="btn btn--ghost" href="/account/register">Open a business account</a></div>
  </section>`;
}

function filterGroup(name, label, values, selected, fmt = (v) => v) {
  if (!values.length) return '';
  const sel = new Set([].concat(selected || []));
  return html`<fieldset class="filter"><legend>${label}</legend>
    ${values.map((v) => html`<label><input type="checkbox" name="${name}" value="${v}" ${sel.has(String(v)) ? raw('checked') : ''}> ${fmt(v)}</label>`)}
  </fieldset>`;
}

function shopPage({ cat, result, f, cats }) {
  const { products, total, page, pages, facets } = result;
  const qs = (extra) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...f, ...extra })) [].concat(v ?? []).forEach((x) => x !== '' && x !== undefined && p.append(k, x));
    p.delete('category');
    const s = p.toString();
    return s ? `?${s}` : '';
  };
  const base = cat ? `/shop/${cat.slug}` : '/shop';
  return html`
  <div class="wrap section">
    <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/shop">Shop</a>${cat ? html` / <span>${cat.name}</span>` : ''}</nav>
    <h1>${f.q ? `Search: “${f.q}”` : cat ? cat.name : 'All medical supplies'}</h1>
    ${cat && cat.description ? html`<p class="lead">${cat.description}</p>` : ''}
    <div class="shop">
      <form class="shop__filters" method="get" action="${base}" id="filters">
        <details class="filters" data-open-desktop>
          <summary>Filter &amp; sort</summary>
          ${f.q ? html`<input type="hidden" name="q" value="${f.q}">` : ''}
          <label class="sort">Sort by
            <select name="sort">
              ${[['featured', 'Featured'], ['price_asc', 'Price: low to high'], ['price_desc', 'Price: high to low'], ['name', 'Name A–Z'], ['newest', 'Newest']]
                .map(([v, l]) => html`<option value="${v}" ${f.sort === v ? raw('selected') : ''}>${l}</option>`)}
            </select>
          </label>
          ${!cat ? html`<fieldset class="filter"><legend>Category</legend>${cats.map((c) => html`<a href="/shop/${c.slug}${qs({ page: '' })}">${c.name}</a>`)}</fieldset>` : ''}
          <fieldset class="filter"><legend>Sterility</legend>
            ${[['', 'Any'], ['1', 'Sterile'], ['0', 'Non-sterile']].map(([v, l]) => html`<label><input type="radio" name="sterile" value="${v}" ${(f.sterile || '') === v ? raw('checked') : ''}> ${l}</label>`)}
          </fieldset>
          ${filterGroup('size', 'Size / volume / gauge', facets.size, f.size)}
          ${filterGroup('material', 'Material', facets.material, f.material)}
          ${filterGroup('pack', 'Pack size', facets.pack, f.pack, (v) => `${v} per pack`)}
          ${filterGroup('brand', 'Brand', facets.brand, f.brand)}
          <fieldset class="filter"><legend>Availability</legend><label><input type="checkbox" name="instock" value="1" ${f.instock === '1' ? raw('checked') : ''}> In stock only</label></fieldset>
          <div class="filters__btns"><button class="btn btn--sm">Apply</button><a class="btn btn--sm btn--ghost" href="${base}${f.q ? `?q=${encodeURIComponent(f.q)}` : ''}">Clear</a></div>
        </details>
      </form>
      <div>
        <p class="muted">${total} product${total === 1 ? '' : 's'}</p>
        ${products.length ? html`<div class="grid">${products.map(productCard)}</div>`
          : html`<div class="empty"><p>No products match. Try fewer filters, or <a href="/quote">ask us for a quote</a> — we may be able to source it.</p></div>`}
        ${pages > 1 ? html`<nav class="pager" aria-label="Pages">
          ${page > 1 ? html`<a href="${base}${qs({ page: page - 1 })}">← Previous</a>` : ''}
          <span>Page ${page} of ${pages}</span>
          ${page < pages ? html`<a href="${base}${qs({ page: page + 1 })}">Next →</a>` : ''}</nav>` : ''}
      </div>
    </div>
  </div>`;
}

function productPage(req, { p, s }) {
  const firstAvail = p.variants.find((v) => v.price_cents !== null && v.stock > 0) || p.variants[0];
  const st = firstAvail ? stockStatus(firstAvail, s) : { key: 'request', text: 'Price on request' };
  const sellable = p.variants.some((v) => v.price_cents !== null);
  const showOptions = p.variants.length > 1 || (p.variants[0] && p.variants[0].label !== 'Standard');
  return html`
  <div class="wrap section">
    <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/shop">Shop</a>${p.category_slug ? html` / <a href="/shop/${p.category_slug}">${p.category_name}</a>` : ''} / <span>${p.name}</span></nav>
    <div class="pdp">
      <div class="pdp__media">
        <div class="pdp__main">${p.images.length ? html`<img id="pdp-main" src="/uploads/${p.images[0].filename}" alt="${p.images[0].alt || p.name}" width="800" height="800">` : placeholder(p.name)}</div>
        ${p.images.length > 1 ? html`<div class="thumbs">${p.images.map((im) => html`<button type="button" data-src="/uploads/${im.filename}" aria-label="Show photo"><img src="/uploads/${im.filename}" alt="${im.alt || p.name}" width="80" height="80" loading="lazy"></button>`)}</div>` : ''}
      </div>
      <div class="pdp__info">
        <div class="card__tags">${sterileBadge(p)}${p.material ? html`<span class="tag">${p.material}</span>` : ''}${p.pack_qty > 1 ? html`<span class="tag">Pack of ${p.pack_qty}</span>` : ''}</div>
        <h1>${p.name}</h1>
        ${p.brand ? html`<p class="muted">Brand: ${p.brand}</p>` : ''}

        <form method="post" action="/cart/add" class="buy" id="buy">
          ${csrfField(req)}
          ${showOptions ? html`<fieldset class="opts"><legend>Choose option</legend>
            ${p.variants.map((v) => {
              const vs = stockStatus(v, s);
              return html`<label class="opt"><input type="radio" name="variant" value="${v.id}" ${v.id === firstAvail.id ? raw('checked') : ''}
                data-price="${v.price_cents === null ? '' : money(v.price_cents)}" data-cents="${v.price_cents ?? ''}"
                data-peritem="${v.price_cents !== null && p.pack_qty > 1 ? `${money(v.price_cents / p.pack_qty)} per ${p.unit_label}` : ''}"
                data-stock="${vs.text}" data-stockkey="${vs.key}" data-max="${Math.max(0, v.stock)}"><span>${v.label}</span></label>`;
            })}</fieldset>` : html`<input type="hidden" name="variant" value="${firstAvail ? firstAvail.id : ''}">`}

          <p class="pdp__price"><span id="price">${firstAvail && firstAvail.price_cents !== null ? money(firstAvail.price_cents) : 'Price on request'}</span>
            ${firstAvail && firstAvail.price_cents !== null ? html`<small>per pack</small>` : ''}</p>
          <p class="pdp__peritem" id="peritem">${firstAvail && firstAvail.price_cents !== null && p.pack_qty > 1 ? `${money(firstAvail.price_cents / p.pack_qty)} per ${p.unit_label}` : ''}</p>
          <p class="stock stock--${st.key}" id="stock">${st.key === 'request' ? '' : st.text}</p>

          ${sellable ? html`<div class="buy__row">
            <div class="qty"><button type="button" data-step="-1" aria-label="Decrease quantity">−</button>
              <input type="number" name="qty" id="qty" value="1" min="1" max="${firstAvail ? Math.max(1, firstAvail.stock) : 1}" inputmode="numeric" aria-label="Quantity">
              <button type="button" data-step="1" aria-label="Increase quantity">+</button></div>
            <button class="btn btn--wide" id="addbtn" ${st.key !== 'in' && st.key !== 'low' ? raw('disabled') : ''}>Add to cart</button>
          </div>` : html`<a class="btn btn--wide" href="/quote?product=${encodeURIComponent(p.name)}">Request a price</a>`}
        </form>

        ${p.tiers.length && sellable ? html`<div class="tiers" id="tiers" data-tiers="${JSON.stringify(p.tiers)}" data-base="${firstAvail.price_cents ?? ''}">
          <h2>Bulk pricing</h2>
          <table><thead><tr><th>Packs</th><th>Price per pack</th><th>Saving</th></tr></thead><tbody></tbody></table>
          <p class="muted small">Applied automatically in the cart. Counts all options of this product together.</p>
        </div>` : ''}

        <p class="pdp__links"><a href="/quote?product=${encodeURIComponent(p.name)}">Bulk or institutional order? Request a quote</a> ·
          <a href="${waLink(s, `Hi, I'd like to order: ${p.name}`)}" target="_blank" rel="noopener">Ask on WhatsApp</a></p>

        ${p.description ? html`<div class="prose"><h2>Description</h2>${p.description.split(/\n{2,}/).map((para) => html`<p>${para}</p>`)}</div>` : ''}
        <div class="prose"><h2>Specifications</h2>
          <table class="specs">
            ${p.brand ? html`<tr><th>Brand</th><td>${p.brand}</td></tr>` : ''}
            ${p.material ? html`<tr><th>Material</th><td>${p.material}</td></tr>` : ''}
            ${p.sterile !== null ? html`<tr><th>Sterility</th><td>${p.sterile ? 'Sterile' : 'Non-sterile'}</td></tr>` : ''}
            <tr><th>Pack size</th><td>${p.pack_qty} ${p.unit_label}${p.pack_qty > 1 ? 's' : ''} per pack</td></tr>
            ${p.specs.split(/\r?\n/).filter((l) => l.trim()).map((l) => {
              const i = l.indexOf(':');
              return i > 0 ? html`<tr><th>${l.slice(0, i)}</th><td>${l.slice(i + 1).trim()}</td></tr>` : html`<tr><td colspan="2">${l}</td></tr>`;
            })}
          </table>
        </div>
        ${p.datasheet ? html`<p><a class="btn btn--ghost" href="/uploads/${p.datasheet}" download>Download product data sheet (PDF)</a></p>` : ''}
        <p class="notice">Sterile items and opened packs cannot be returned unless faulty. <a href="/returns-policy">Returns policy</a></p>
        <p class="muted small">Product information is for identification only and is not medical advice.</p>
      </div>
    </div>
  </div>`;
}

function infoPage(pg) {
  return html`<div class="wrap section prose prose--page">
    <h1>${pg.h1}</h1>
    ${pg.body || ''}
    ${pg.faq ? html`<div class="faq">${pg.faq.map(([q, a]) => html`<details><summary>${q}</summary><p>${a}</p></details>`)}</div>` : ''}
  </div>`;
}

const orgTypes = ['Clinic', 'GP practice', 'Dental practice', 'Pharmacy', 'Old-age / care home', 'School', 'Home-care nursing', 'Government hospital / facility', 'Individual', 'Other'];

function quotePage(req, { s, values = {}, sent = false }) {
  if (sent) return html`<div class="wrap section prose prose--page"><h1>Thank you</h1><p class="flash flash--ok">We received your quote request and will reply, usually within one business day.</p><p><a href="/shop">Continue shopping</a></p></div>`;
  return html`<div class="wrap section prose prose--page">
    <h1>Request a quote</h1>
    <p>Ordering in bulk for a clinic, practice, school or facility? Tell us what you need, or upload your order list (Excel, PDF, Word or a photo), and we'll send a written quote.</p>
    <form method="post" action="/quote" enctype="multipart/form-data" class="form">
      ${csrfField(req)}
      <label>Your name *<input name="name" required maxlength="120" autocomplete="name" value="${values.name || ''}"></label>
      <label>Practice / organisation *<input name="org_name" required maxlength="160" autocomplete="organization" value="${values.org_name || ''}"></label>
      <label>Type of organisation *<select name="org_type" required><option value="">Choose…</option>${orgTypes.map((t) => html`<option ${values.org_type === t ? raw('selected') : ''}>${t}</option>`)}</select></label>
      <div class="form__2">
        <label>Email *<input type="email" name="email" required maxlength="160" autocomplete="email" value="${values.email || ''}"></label>
        <label>Phone / WhatsApp *<input type="tel" name="phone" required maxlength="30" autocomplete="tel" value="${values.phone || ''}"></label>
      </div>
      <div class="form__2">
        <label>Delivery postal code *<input name="postal_code" required pattern="[0-9]{4}" maxlength="4" inputmode="numeric" value="${values.postal_code || ''}"></label>
        <label>Needed by (optional)<input type="date" name="needed_by" value="${values.needed_by || ''}"></label>
      </div>
      <label>Products and quantities<textarea name="items" rows="6" maxlength="5000" placeholder="e.g. Nitrile gloves size M – 20 boxes&#10;Gauze swabs 10x10 – 10 packs">${values.items || ''}</textarea></label>
      <label>Upload order list (optional, max 10 MB: PDF, Excel, Word, CSV, JPG, PNG)<input type="file" name="file" accept=".pdf,.xls,.xlsx,.doc,.docx,.csv,.jpg,.jpeg,.png"></label>
      <label>Order / tender reference (optional)<input name="reference" maxlength="120" value="${values.reference || ''}"></label>
      <label class="check"><input type="checkbox" name="consent" value="1" required> I agree that ${s.trading_name} may use these details to respond to this request, as described in the <a href="/privacy-policy">Privacy Policy</a>.</label>
      <button class="btn btn--wide">Send quote request</button>
    </form>
    <p class="muted">Prefer WhatsApp? <a href="${waLink(s, 'Hi, I would like a quote. My order list is attached.')}" target="_blank" rel="noopener">Send your list on WhatsApp</a> or email <a href="mailto:${s.email}">${s.email}</a>.</p>
  </div>`;
}

function contactPage(req, { s, sent }) {
  return html`<div class="wrap section">
    <h1>Contact us</h1>
    <div class="contact">
      <div class="prose">
        <p>Questions about a product, stock or an order? We usually reply the same business day.</p>
        <ul class="plain">
          <li><b>Phone / WhatsApp:</b> <a href="tel:${s.phone_1.replace(/\s/g, '')}">${s.phone_1}</a>${s.phone_2 ? html` or <a href="tel:${s.phone_2.replace(/\s/g, '')}">${s.phone_2}</a>` : ''}</li>
          <li><b>Email:</b> <a href="mailto:${s.email}">${s.email}</a></li>
          <li><b>Address:</b> ${s.address}</li>
          ${s.hours ? html`<li><b>Hours:</b> ${s.hours}</li>` : ''}
        </ul>
        <p><a class="btn btn--wa" href="${waLink(s)}" target="_blank" rel="noopener">Chat on WhatsApp</a></p>
        ${sent ? html`<p class="flash flash--ok">Thank you — your message was sent.</p>` : html`
        <form method="post" action="/contact" class="form">
          ${csrfField(req)}
          <label>Name *<input name="name" required maxlength="120" autocomplete="name"></label>
          <label>Email *<input type="email" name="email" required maxlength="160" autocomplete="email"></label>
          <label>Phone<input type="tel" name="phone" maxlength="30" autocomplete="tel"></label>
          <label>Message *<textarea name="message" rows="5" required maxlength="3000"></textarea></label>
          <label class="check"><input type="checkbox" name="consent" value="1" required> I agree that you may use these details to reply to me (<a href="/privacy-policy">Privacy Policy</a>).</label>
          <button class="btn">Send message</button>
        </form>`}
      </div>
      <iframe class="map" title="Map: ${s.address}" src="https://www.google.com/maps?q=${encodeURIComponent(s.address)}&output=embed" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>
    </div>
  </div>`;
}

module.exports = { home, shopPage, productPage, productCard, infoPage, quotePage, contactPage, orgTypes, productImg, placeholder };
