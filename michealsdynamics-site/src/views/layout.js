const config = require('../config');
const { getSettings } = require('../db');
const { categories } = require('../shop');
const { html, raw, money, csrfToken, takeFlash } = require('../util');

const waLink = (s, text = 'Hi Micheals Dynamics, I would like to place an order:') =>
  `https://wa.me/${s.whatsapp}?text=${encodeURIComponent(text)}`;

function cartCount(req) {
  return Object.values(req.session.cart || {}).reduce((a, b) => a + Number(b || 0), 0);
}

const icon = {
  search: raw('<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M10 2a8 8 0 0 1 6.3 12.9l5.4 5.4-1.4 1.4-5.4-5.4A8 8 0 1 1 10 2zm0 2a6 6 0 1 0 0 12 6 6 0 0 0 0-12z"/></svg>'),
  cart: raw('<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M7 18a2 2 0 1 1 0 4 2 2 0 0 1 0-4zm10 0a2 2 0 1 1 0 4 2 2 0 0 1 0-4zM1 2h3.3l.9 2H21l-3.6 8.1A2 2 0 0 1 15.6 13H8.1l-.9 1.7V15H19v2H5.4l2-3.8L4 4H1z"/></svg>'),
  user: raw('<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M12 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm0 2c5 0 9 2.5 9 5.5V22H3v-2.5C3 16.5 7 14 12 14z"/></svg>'),
  wa: raw('<svg viewBox="0 0 32 32" width="26" height="26" aria-hidden="true"><path fill="currentColor" d="M16 3a13 13 0 0 0-11.2 19.6L3 29l6.6-1.7A13 13 0 1 0 16 3zm0 23.6c-2 0-4-.5-5.7-1.6l-.4-.2-3.9 1 1-3.8-.3-.4A10.6 10.6 0 1 1 16 26.6zm5.8-7.9c-.3-.2-1.9-.9-2.2-1s-.5-.2-.7.2l-1 1.2c-.2.2-.4.2-.7.1a8.7 8.7 0 0 1-4.3-3.8c-.3-.6.3-.5.9-1.7.1-.2 0-.4 0-.5l-1-2.4c-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.6.1-.9.4-.3.3-1.2 1.1-1.2 2.8s1.2 3.2 1.4 3.5c.2.2 2.4 3.6 5.7 5 2.1.9 2.9 1 4 .8.6-.1 1.9-.8 2.2-1.5.3-.8.3-1.4.2-1.5l-.6-.4z"/></svg>'),
};

function layout(req, { title, description = '', body, path = req.path, jsonLd = null, noindex = false, query = '' }) {
  const s = getSettings();
  const cats = categories();
  const count = cartCount(req);
  const flashes = takeFlash(req);
  const fullTitle = title.includes(s.trading_name) ? title : `${title} | ${s.trading_name}`;
  const canonical = config.baseUrl + path;
  const org = {
    '@context': 'https://schema.org', '@type': 'Store',
    name: s.trading_name, legalName: s.business_name, url: config.baseUrl, email: s.email, telephone: '+27' + s.phone_1.replace(/\D/g, '').replace(/^0/, ''),
    address: { '@type': 'PostalAddress', streetAddress: s.address, addressRegion: 'Western Cape', addressCountry: 'ZA' },
    ...(s.gbp_url ? { sameAs: [s.gbp_url] } : {}),
  };
  const ld = [path === '/' ? org : null, jsonLd].filter(Boolean);
  return String(html`<!doctype html>
<html lang="en-ZA">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${fullTitle}</title>
<meta name="description" content="${description}">
<link rel="canonical" href="${canonical}">
${noindex ? raw('<meta name="robots" content="noindex">') : ''}
<meta property="og:title" content="${fullTitle}">
<meta property="og:description" content="${description}">
<meta property="og:type" content="website">
<meta property="og:url" content="${canonical}">
<meta name="theme-color" content="#0B6E78">
<link rel="icon" href="/img/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/css/site.css">
${ld.map((x) => html`<script type="application/ld+json">${raw(JSON.stringify(x).replace(/</g, '\\u003c'))}</script>`)}
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<div class="topbar">Next-day delivery in Cape Town · Free delivery over ${money(Number(s.free_threshold || 0) * 100).replace('.00', '')} · <a href="${waLink(s)}" rel="noopener" target="_blank">WhatsApp ${s.phone_1}</a></div>
<header class="header">
  <div class="wrap header__row">
    <details class="menu">
      <summary aria-label="Menu"><span></span><span></span><span></span></summary>
      <nav class="menu__panel" aria-label="Main">
        <a href="/shop">All products</a>
        ${cats.map((c) => html`<a href="/shop/${c.slug}">${c.name}</a>`)}
        <hr>
        <a href="/quote">Request a quote</a>
        <a href="/account">Business account</a>
        <a href="/about">About us</a>
        <a href="/contact">Contact</a>
        <a href="/faq">FAQ</a>
        <a href="/delivery-returns">Delivery &amp; returns</a>
      </nav>
    </details>
    <a class="logo" href="/" aria-label="${s.trading_name} home"><span class="logo__mark">+</span><span>Micheals<b>Dynamics</b></span></a>
    <form class="search" action="/shop" method="get" role="search">
      <label class="sr" for="q">Search products</label>
      <input id="q" name="q" type="search" value="${query}" placeholder="Search gloves, swabs, syringes…" autocomplete="off">
      <button aria-label="Search">${icon.search}</button>
    </form>
    <nav class="header__icons" aria-label="Account and cart">
      <a href="/account" aria-label="Account">${icon.user}</a>
      <a href="/cart" class="cartlink" aria-label="Cart, ${count} items">${icon.cart}${count ? html`<span class="badge">${count}</span>` : ''}</a>
    </nav>
  </div>
  <nav class="catnav wrap" aria-label="Categories">
    <a href="/shop">All</a>${cats.map((c) => html`<a href="/shop/${c.slug}">${c.name}</a>`)}<a href="/quote" class="catnav__quote">Request a quote</a>
  </nav>
</header>
<main id="main">
${flashes.length ? html`<div class="wrap">${flashes.map((f) => html`<p class="flash flash--${f.type}" role="status">${f.text}</p>`)}</div>` : ''}
${raw(body)}
</main>
<footer class="footer">
  <div class="wrap footer__grid">
    <div>
      <p class="footer__brand">${s.trading_name}</p>
      <p>Medical consumables for clinics, practices, pharmacies, care homes, schools, home-care nurses and the public.</p>
      <p>${s.address}</p>
      <p><a href="tel:${s.phone_1.replace(/\s/g, '')}">${s.phone_1}</a>${s.phone_2 ? html` · <a href="tel:${s.phone_2.replace(/\s/g, '')}">${s.phone_2}</a>` : ''}<br>
      <a href="mailto:${s.email}">${s.email}</a>${s.hours ? html`<br>${s.hours}` : ''}</p>
    </div>
    <div>
      <p class="footer__h">Shop</p>
      ${cats.map((c) => html`<a href="/shop/${c.slug}">${c.name}</a>`)}
      <a href="/quote">Request a quote</a>
    </div>
    <div>
      <p class="footer__h">Help</p>
      <a href="/account">Business account</a><a href="/about">About us</a><a href="/contact">Contact</a><a href="/faq">FAQ</a>
      <a href="/delivery-returns">Delivery &amp; returns</a>
    </div>
    <div>
      <p class="footer__h">Legal</p>
      <a href="/privacy-policy">Privacy policy (POPIA)</a><a href="/terms">Terms &amp; conditions</a><a href="/returns-policy">Returns policy</a><a href="/cookies">Cookie notice</a>
      ${s.gbp_url ? html`<a href="${s.gbp_url}" target="_blank" rel="noopener">Find us on Google</a>` : ''}
    </div>
  </div>
  <div class="wrap footer__legal">
    <p><b>${s.business_name}</b> · Company reg. no. ${s.reg_no} · SAHPRA licence no. ${s.sahpra_no} · ${s.vat_line}</p>
    <p>Product information is for identification only and is not medical advice. Use products as directed by the manufacturer and a qualified healthcare professional.</p>
    <p>Payments: card and instant EFT via secure payment provider. Prices in South African Rand (ZAR).</p>
  </div>
</footer>
<a class="wa-float" href="${waLink(s)}" target="_blank" rel="noopener" aria-label="Order on WhatsApp">${icon.wa}<span>WhatsApp</span></a>
<div class="cookie" id="cookie" hidden>
  <p>We only use essential cookies to run the cart, checkout and login. No tracking or advertising cookies. <a href="/cookies">Cookie notice</a></p>
  <button type="button" class="btn btn--sm" id="cookie-ok">OK</button>
</div>
<script src="/js/site.js" defer></script>
</body>
</html>`);
}

// Hidden CSRF field for forms.
const csrfField = (req) => html`<input type="hidden" name="_csrf" value="${csrfToken(req)}">`;

module.exports = { layout, csrfField, waLink, icon };
