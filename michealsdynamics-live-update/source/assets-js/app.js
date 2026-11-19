/* Micheals Dynamics shop — runs in the visitor's browser. Data comes from /data/shop-data.js */
(function () {
  'use strict';
  var D = window.MD, R = window.MDR, BUILT = window.MD_BUILT || [];
  if (D && window.MDC) { D.groups = window.MDC.groups; D.categories = window.MDC.categories; D.products = window.MDC.products; }
  if (!D || !R) {
    var m = document.getElementById('main');
    if (m) m.insertAdjacentHTML('afterbegin', '<div class="wrap"><p class="flash flash--error">The shop data could not be loaded. If you just edited data/shop-data.js, check for a missing comma or quote mark.</p></div>');
    return;
  }
  var S = D.settings, e = R.esc;
  var $ = function (sel, el) { return (el || document).querySelector(sel); };
  var $$ = function (sel, el) { return Array.prototype.slice.call((el || document).querySelectorAll(sel)); };
  var params = new URLSearchParams(location.search);
  var bySlug = {};
  D.products.forEach(function (p) { bySlug[p.slug] = p; });
  var filled = function (v) { return v !== null && v !== undefined && String(v).trim() !== ''; };

  /* ---------- Business details from shop-data.js ---------- */
  $$('[data-s]').forEach(function (el) {
    var k = el.getAttribute('data-s'), v = S[k];
    if (k === 'free_delivery_from') { el.textContent = R.rand(v || 0); return; }
    if (k === 'whatsapp') { var d = String(v || '').replace(/\D/g, '').replace(/^27/, '0'); el.textContent = d.length === 10 ? d.slice(0, 3) + ' ' + d.slice(3, 6) + ' ' + d.slice(6) : d; return; }
    if (filled(v)) el.textContent = v;
    else if (el.getAttribute('data-ph')) el.textContent = '[' + el.getAttribute('data-ph') + ']';
  });
  $$('[data-show]').forEach(function (el) { el.hidden = !filled(S[el.getAttribute('data-show')]) || S[el.getAttribute('data-show')] === false; });
  $$('[data-link]').forEach(function (el) {
    var parts = el.getAttribute('data-link').split(':'), v = S[parts[1]];
    if (!filled(v)) { el.hidden = true; return; }
    el.hidden = false;
    el.href = parts[0] === 'tel' ? R.tel(v) : parts[0] === 'mail' ? 'mailto:' + v : v;
  });
  $$('[data-wa]').forEach(function (el) { el.href = R.waLink(S, el.getAttribute('data-wa') || undefined); });

  /* ---------- Order list (kept in this browser only) ---------- */
  var KEY = 'md-order';
  function getCart() {
    try { var c = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(c) ? c : []; } catch (err) { return memCart; }
  }
  var memCart = [];
  function setCart(c) {
    memCart = c;
    try { localStorage.setItem(KEY, JSON.stringify(c)); } catch (err) { /* storage blocked: keep in memory */ }
    badge();
  }
  function badge() {
    var n = getCart().reduce(function (a, l) { return a + (Number(l.qty) || 0); }, 0);
    $$('[data-cart-count]').forEach(function (b) { b.textContent = n; b.hidden = !n; });
  }
  function addToCart(p, option, qty) {
    var c = getCart(), found = false, o = p.options.filter(function (x) { return x.label === option; })[0] || p.options[0];
    c.forEach(function (l) { if (l.slug === p.slug && l.option === option) { l.qty = Math.min(9999, l.qty + qty); l.price = o.price; found = true; } });
    if (!found) c.push({ slug: p.slug, option: option, qty: qty, name: p.name, price: o.price, sku: p.sku || '', img: p.thumb || (p.photos || [])[0] || '', url: R.productUrl(p, BUILT) });
    setCart(c);
  }
  function fromLine(l) { // product rebuilt from what was saved in the order list
    return { slug: l.slug, name: l.name || l.slug, sku: l.sku || '', url: l.url, thumb: l.img, photos: l.img ? [l.img] : [], options: [{ label: l.option || 'Standard', price: l.price }], bulk: [] };
  }
  badge();

  /* ---------- Menu ---------- */
  document.addEventListener('click', function (ev) {
    var m = $('.menu[open]');
    if (m && !m.contains(ev.target)) m.open = false;
  });

  /* ---------- Product grids ---------- */
  var PER = 48;
  function renderGrid(el, list) {
    el.innerHTML = list.map(function (p) { return R.card(p, BUILT); }).join('');
  }
  var VER = (window.MDC && window.MDC.version) || '';
  var listCache = {};
  function getList(l1) { // cards for one category, from /data/list/<code>.json
    if (!listCache[l1]) {
      var cat = R.catByCode(D, l1);
      listCache[l1] = fetch('/data/list/' + encodeURIComponent(l1) + '.json?v=' + VER).then(function (r) { if (!r.ok) throw new Error('list'); return r.json(); })
        .then(function (rows) {
          return rows.map(function (r, i) {
            var sub = r[5] ? R.catByCode(D, r[5]) : null;
            return { slug: r[0], name: r[1], url: '/product/' + r[0] + '/', thumb: r[4], photos: r[4] ? [r[4]] : [], category: (sub || cat || {}).slug, sub: r[5], l1: l1, pos: i,
              options: [{ label: 'Standard', price: r[2], stock: r[3] }], bulk: [] };
          });
        });
    }
    return listCache[l1];
  }
  var searchIdx = null;
  function getSearch() {
    if (!searchIdx) searchIdx = fetch('/data/search.json?v=' + VER).then(function (r) { if (!r.ok) throw new Error('search'); return r.json(); });
    return searchIdx;
  }
  function pager(page, pages) {
    if (pages <= 1) return '';
    var h = '', from = Math.max(1, page - 2), to = Math.min(pages, page + 2);
    h += page > 1 ? '<button type="button" data-go="' + (page - 1) + '">‹ Prev</button>' : '';
    if (from > 1) h += '<button type="button" data-go="1">1</button>' + (from > 2 ? '<span>…</span>' : '');
    for (var i = from; i <= to; i++) h += '<button type="button" data-go="' + i + '"' + (i === page ? ' aria-current="page" class="is-on"' : '') + '>' + i + '</button>';
    if (to < pages) h += (to < pages - 1 ? '<span>…</span>' : '') + '<button type="button" data-go="' + pages + '">' + pages + '</button>';
    h += page < pages ? '<button type="button" data-go="' + (page + 1) + '">Next ›</button>' : '';
    return h;
  }
  function sortList(list, sort) {
    var price = function (p) { var m = R.minPrice(p); return m === null ? Infinity : m; };
    if (sort === 'name') list.sort(function (a, b) { return a.name.localeCompare(b.name); });
    if (sort === 'price') list.sort(function (a, b) { return price(a) - price(b); });
    if (sort === 'price-desc') list.sort(function (a, b) { return (price(b) === Infinity ? -1 : price(b)) - (price(a) === Infinity ? -1 : price(a)); });
    return list;
  }
  $$('[data-grid]').forEach(function (el) {
    var key = el.getAttribute('data-grid');
    if (key === 'best') { renderGrid(el, D.products.filter(function (p) { return !p.showcase_only; })); return; }
    if (key === 'special') { renderGrid(el, R.specials(D)); return; }
    var bar = $('[data-shopbar]'), cnt = $('[data-count]'), em = $('[data-empty]'), pg = $('[data-pager]');
    var l1 = key.indexOf('list:') === 0 ? key.slice(5) : null;
    var group = key.indexOf('group:') === 0 ? R.group(D, key.slice(6)) : null;
    var state = { q: params.get('q') || '', sort: params.get('sort') || '', sub: params.get('sub') || '', page: Math.max(1, parseInt(params.get('page'), 10) || 1) };
    if (bar) { bar.q.value = state.q; bar.sort.value = state.sort; }
    var hq = $('#q'); if (hq && state.q) hq.value = state.q;
    $$('[data-sub]').forEach(function (a) {
      a.classList.toggle('is-on', a.getAttribute('data-sub') === state.sub);
      a.addEventListener('click', function (ev) {
        ev.preventDefault(); state.sub = a.getAttribute('data-sub'); state.page = 1;
        $$('[data-sub]').forEach(function (x) { x.classList.toggle('is-on', x === a); }); run();
      });
    });
    function syncUrl() {
      var u = new URLSearchParams();
      if (state.q) u.set('q', state.q);
      if (state.sort) u.set('sort', state.sort);
      if (state.sub) u.set('sub', state.sub);
      if (state.page > 1) u.set('page', state.page);
      var qs = u.toString();
      try { history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '')); } catch (err) { /* ignore */ }
    }
    function show(list, total) {
      var pages = Math.max(1, Math.ceil(total / PER));
      renderGrid(el, list);
      if (cnt) cnt.textContent = total + (total === 1 ? ' product' : ' products') + (state.q ? ' for "' + state.q + '"' : '') + (pages > 1 ? ' · page ' + state.page + ' of ' + pages : '');
      if (em) em.hidden = total > 0;
      if (pg) {
        pg.innerHTML = pager(state.page, pages);
        $$('[data-go]', pg).forEach(function (b) {
          b.addEventListener('click', function () {
            state.page = Number(b.getAttribute('data-go')); run();
            var top = el.getBoundingClientRect().top + window.pageYOffset - 160; window.scrollTo(0, Math.max(0, top));
          });
        });
      }
      syncUrl();
    }
    function words() { return state.q.toLowerCase().split(/\s+/).filter(Boolean); }
    function failed() { if (cnt) cnt.textContent = 'Products could not be loaded. Please refresh the page.'; }
    function run() {
      if (cnt) cnt.textContent = 'Loading products…';
      if (l1) {
        getList(l1).then(function (all) {
          var w = words();
          var list = all.filter(function (p) {
            if (state.sub && p.sub !== state.sub) return false;
            var hay = p.name.toLowerCase();
            return !w.some(function (x) { return hay.indexOf(x) === -1; });
          });
          sortList(list, state.sort);
          var pages = Math.max(1, Math.ceil(list.length / PER)); if (state.page > pages) state.page = pages;
          show(list.slice((state.page - 1) * PER, state.page * PER), list.length);
        }).catch(failed);
        return;
      }
      // all products, a whole section, or a search: use the search index, then load only the cards this page needs
      getSearch().then(function (idx) {
        var w = words();
        var hits = idx.filter(function (r) {
          if (group) { var c = R.catByCode(D, r[1]); if (!c || c.group !== group.slug) return false; }
          var hay = r[0].toLowerCase();
          return !w.some(function (x) { return hay.indexOf(x) === -1; });
        });
        if (state.sort === 'name') hits.sort(function (a, b) { return a[0].localeCompare(b[0]); });
        var byPrice = state.sort === 'price' || state.sort === 'price-desc';
        var cats = {}; hits.forEach(function (r) { cats[r[1]] = 1; });
        if (byPrice && Object.keys(cats).length > 25) { byPrice = false; state.sort = ''; if (bar) bar.sort.value = ''; }
        var pages = Math.max(1, Math.ceil(hits.length / PER)); if (state.page > pages) state.page = pages;
        var pageHits = byPrice ? hits : hits.slice((state.page - 1) * PER, state.page * PER);
        var need = {}; pageHits.forEach(function (r) { need[r[1]] = 1; });
        Promise.all(Object.keys(need).map(function (c) { return getList(c).then(function (l) { return [c, l]; }, function () { return [c, []]; }); })).then(function (lists) {
          var m = {}; lists.forEach(function (x) { m[x[0]] = x[1]; });
          var list = pageHits.map(function (r) { return (m[r[1]] || [])[r[2]]; }).filter(Boolean);
          if (byPrice) { sortList(list, state.sort); list = list.slice((state.page - 1) * PER, state.page * PER); }
          show(list, hits.length);
        });
      }).catch(failed);
    }
    if (bar) {
      var t;
      bar.addEventListener('input', function () { clearTimeout(t); t = setTimeout(function () { state.q = bar.q.value.trim(); state.page = 1; run(); }, 300); });
      bar.addEventListener('change', function () { state.q = bar.q.value.trim(); state.sort = bar.sort.value; state.page = 1; run(); });
      bar.addEventListener('submit', function (ev) { ev.preventDefault(); state.q = bar.q.value.trim(); state.page = 1; run(); });
    }
    run();
  });

  /* ---------- Drop-down menus (Surgical, General Merchandise) ---------- */
  $$('[data-ddfill]').forEach(function (box) {
    var g = R.group(D, box.getAttribute('data-ddfill')); if (!g || !D.categories) return;
    var kids = function (code) { return D.categories.filter(function (c) { return c.parent === code; }); };
    var link = function (c, cls) { return '<a' + (cls ? ' class="' + cls + '"' : '') + ' href="/shop/' + e(c.slug) + '/">' + e(c.name) + '</a>'; };
    if (g.roots.length === 1) box.outerHTML = '<div class="dd__grid">' + kids(g.roots[0]).map(function (c) { return link(c); }).join('') + '</div>';
    else box.outerHTML = '<div class="dd__cols">' + g.roots.map(function (r) { return R.catByCode(D, r); }).filter(Boolean).map(function (rc) {
      return '<div class="dd__col">' + link(rc, 'dd__head') + kids(rc.code).map(function (c) { return link(c); }).join('') + '</div>';
    }).join('') + '</div>';
  });
  var dds = $$('.dd');
  dds.forEach(function (d) {
    d.addEventListener('toggle', function () { if (d.open) dds.forEach(function (o) { if (o !== d) o.open = false; }); });
    if (window.matchMedia('(hover: hover)').matches) {
      var t;
      d.addEventListener('mouseenter', function () { clearTimeout(t); d.open = true; });
      d.addEventListener('mouseleave', function () { t = setTimeout(function () { d.open = false; }, 200); });
    }
  });
  document.addEventListener('click', function (ev) { dds.forEach(function (d) { if (!d.contains(ev.target)) d.open = false; }); });
  document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') dds.forEach(function (d) { d.open = false; }); });

  /* ---------- Moving 3D specials showcase ---------- */
  $$('[data-specials]').forEach(function (el) { var sp = R.specials(D); el.innerHTML = sp.length ? '<div class="grid">' + sp.map(function (p) { return R.card(p, BUILT); }).join('') + '</div>' : ''; /* still grid, no motion */ el.hidden = !el.innerHTML; var sec = el.closest('[data-specials-section]'); if (sec) sec.hidden = !el.innerHTML; });
  $$('[data-spin]').forEach(function (root) {
    var ring = $('.sp3d__ring', root), stage = $('.sp3d__stage', root), items = $$('.sp3d__item', root), n = items.length;
    if (!n) return;
    var step = 360 / n, angle = 0, target = null, radius = 0, paused = false, hover = false, drag = null, moved = false, last = 0;
    var SPEED = 18; // degrees per second
    function layout() {
      var w = items[0].offsetWidth || 200;
      radius = Math.round(Math.max(w * 0.9, (w / 2) / Math.tan(Math.PI / n) + w * 0.15));
      items.forEach(function (it, i) { it.style.transform = 'rotateY(' + (i * step) + 'deg) translateZ(' + radius + 'px)'; });
    }
    function draw() {
      ring.style.transform = 'translateZ(' + (-radius) + 'px) rotateY(' + (-angle) + 'deg)';
      items.forEach(function (it, i) {
        var c = Math.cos((i * step - angle) * Math.PI / 180), f = (c + 1) / 2;
        it.style.opacity = (0.12 + 0.88 * f * f).toFixed(3);
        it.style.filter = 'brightness(' + (0.75 + 0.25 * f).toFixed(3) + ')';
        it.classList.toggle('is-front', c > 0.92);
      });
    }
    function frame(t) {
      var dt = last ? Math.min(0.05, (t - last) / 1000) : 0; last = t;
      if (target !== null) {
        var d = target - angle; angle += d * Math.min(1, dt * 6);
        if (Math.abs(d) < 0.2) { angle = target; target = null; }
      } else if (!paused && !hover && !drag) angle += SPEED * dt;
      draw(); requestAnimationFrame(frame);
    }
    function go(dir) { var base = target !== null ? target : angle; target = (Math.round(base / step) + dir) * step; }
    $('[data-spin-prev]', root).addEventListener('click', function () { go(-1); });
    $('[data-spin-next]', root).addEventListener('click', function () { go(1); });
    var pb = $('[data-spin-pause]', root);
    pb.addEventListener('click', function () {
      paused = !paused; pb.textContent = paused ? '▶ Play' : '❚❚ Pause';
      pb.setAttribute('aria-label', paused ? 'Play the moving showcase' : 'Pause the moving showcase');
    });
    stage.addEventListener('mouseenter', function () { hover = true; });
    stage.addEventListener('mouseleave', function () { hover = false; });
    stage.addEventListener('focusin', function () { hover = true; });
    stage.addEventListener('focusout', function () { hover = false; });
    stage.addEventListener('pointerdown', function (ev) { drag = { x: ev.clientX, a: angle }; moved = false; target = null; });
    window.addEventListener('pointermove', function (ev) {
      if (!drag) return; var dx = ev.clientX - drag.x; if (Math.abs(dx) > 6) moved = true;
      angle = drag.a - dx * 0.35;
    });
    window.addEventListener('pointerup', function () { if (drag) { drag = null; if (moved) go(0); } });
    stage.addEventListener('click', function (ev) { if (moved) { ev.preventDefault(); moved = false; } }, true);
    window.addEventListener('resize', layout);
    layout(); draw(); requestAnimationFrame(frame);
  });

  /* ---------- Product page ---------- */
  var holder = $('[data-product]');
  if (holder) {
    var slug = holder.getAttribute('data-product') || params.get('p') || '';
    var pd = document.getElementById('pdata');
    var p = bySlug[slug], fromPage = false;
    if (!p && pd) { try { p = JSON.parse(pd.textContent); bySlug[p.slug] = p; fromPage = true; } catch (err) { p = null; } }
    if (!p) {
      holder.innerHTML = '<div class="wrap section narrow"><h1>Product not found</h1><p>This product may have been removed.</p><p><a class="btn" href="/shop/">Browse products</a></p></div>';
    } else {
      holder.innerHTML = R.productBody(p, D); // always show the latest prices, stock and photos
      if (!holder.getAttribute('data-product')) document.title = p.name + ' | ' + S.trading_name;
      initBuy(p);
      if (fromPage) syncPagePrice(p, holder);
    }
  }

  /* ---------- Up-to-date prices ----------
     The product lists in /data/list are the price source. Product pages and saved order lists
     take their price from them, so a price change only needs new data files. */
  document.head.insertAdjacentHTML('beforeend', '<style>.md-syncing #price,.md-syncing #peritem,.md-syncing .tiers{visibility:hidden}</style>');
  function listCodeFor(catSlug) {
    var c = (D.categories || []).filter(function (x) { return x.slug === catSlug; })[0];
    return c && c.code.indexOf('-') > 0 ? c.code.split('-').slice(0, 2).join('-') : null;
  }
  function syncPagePrice(p, holder) {
    var code = listCodeFor(p.category);
    if (!code || p.options.length !== 1) return;
    holder.classList.add('md-syncing');
    var timer = setTimeout(function () { holder.classList.remove('md-syncing'); }, 4000);
    getList(code).then(function (rows) {
      var r = rows.filter(function (x) { return x.slug === p.slug; })[0];
      var now = r && r.options[0].price;
      if (R.hasPrice({ price: now }) && Number(now) !== Number(p.options[0].price)) {
        p.options[0].price = now;
        holder.innerHTML = R.productBody(p, D);
        initBuy(p);
      }
    }).catch(function () { /* keep the page's own price */ }).then(function () { clearTimeout(timer); holder.classList.remove('md-syncing'); });
  }
  function refreshCartPrices(then) {
    var c = getCart();
    if (!c.length) return;
    getSearch().then(function (idx) {
      var codeOf = {}, codes = {};
      idx.forEach(function (x) { codeOf[x[0]] = x[1]; });
      c.forEach(function (l) { if (codeOf[l.name]) codes[codeOf[l.name]] = 1; });
      return Promise.all(Object.keys(codes).map(getList));
    }).then(function (lists) {
      var price = {}, changed = false;
      lists.forEach(function (rows) { rows.forEach(function (r) { price[r.slug] = r.options[0].price; }); });
      c.forEach(function (l) {
        if (bySlug[l.slug] || !(l.slug in price) || !R.hasPrice({ price: price[l.slug] })) return;
        if (Number(price[l.slug]) !== Number(l.price)) { l.price = price[l.slug]; changed = true; }
      });
      if (changed) { setCart(c); then(); }
    }).catch(function () { /* keep saved prices */ });
  }
  function lineDiscount(p, qty) {
    var pct = 0;
    (p.bulk || []).forEach(function (b) { if (qty >= Number(b.from)) pct = Math.max(pct, Number(b.discount) || 0); });
    return pct;
  }
  function initBuy(p) {
    var form = $('#buy'), qty = $('#qty'), add = $('#addbtn');
    function current() {
      var r = form.querySelector('input[name=option]:checked') || form.querySelector('input[name=option]');
      var label = r ? r.value : '';
      return p.options.filter(function (o) { return o.label === label; })[0] || p.options[0];
    }
    function update() {
      var o = current(), st = R.optionState(o);
      var was = R.wasOf(o);
      var spc = p.special === true && !p.badge && R.hasPrice(o) && !R.isOut(o);
      $('#price').innerHTML = was ? '<s class="was">' + R.money(was) + '</s> ' + R.money(o.price) + ' <span class="save">Special: save ' + R.money(was - o.price) + '</span>' : (R.hasPrice(o) ? R.money(o.price) + (spc ? ' <span class="save">Special price</span>' : '') : 'Price on request');
      $('#peritem').textContent = R.hasPrice(o) && p.pack > 1 ? R.money(o.price / p.pack) + ' per ' + (p.unit || 'item') : '';
      var stock = $('#stock'); stock.textContent = st.text; stock.className = 'stock stock--' + st.key;
      add.disabled = st.key === 'out';
      add.textContent = st.key === 'out' ? 'Out of stock' : 'Add to order';
      $('#reqnote').hidden = st.key !== 'request';
      $('#added').hidden = true;
    }
    form.addEventListener('change', update);
    $$('[data-step]', form).forEach(function (b) {
      b.addEventListener('click', function () { qty.value = Math.max(1, Math.min(9999, (Number(qty.value) || 1) + Number(b.getAttribute('data-step')))); });
    });
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var o = current();
      if (R.isOut(o)) return;
      addToCart(p, o.label, Math.max(1, Math.min(9999, parseInt(qty.value, 10) || 1)));
      $('#added').hidden = false;
    });
    $$('.thumbs button').forEach(function (b) {
      b.addEventListener('click', function () { var m = $('#pdp-main'); if (m) m.src = b.getAttribute('data-src'); });
    });
    update();
  }

  /* ---------- Delivery + totals ---------- */
  function inRanges(code) {
    var n = parseInt(code, 10);
    if (isNaN(n)) return false;
    return String(S.cape_town_postcodes || '').split(',').some(function (r) {
      var a = r.trim().split('-').map(function (x) { return parseInt(x, 10); });
      return a.length === 2 ? n >= a[0] && n <= a[1] : n === a[0];
    });
  }
  function priceLines() {
    var lines = [], subtotal = 0, discount = 0, unpriced = 0;
    getCart().forEach(function (l) {
      var p = bySlug[l.slug] || (l.name ? fromLine(l) : null);
      if (!p) return;
      var o = p.options.filter(function (x) { return x.label === l.option; })[0];
      if (!o) return;
      var line = { p: p, o: o, qty: l.qty, priced: R.hasPrice(o), out: R.isOut(o), pct: 0, total: null };
      if (line.priced) {
        var gross = Number(o.price) * l.qty;
        line.pct = lineDiscount(p, l.qty);
        var off = Math.round(gross * line.pct) / 100;
        line.total = gross - off; subtotal += gross; discount += off;
      } else unpriced++;
      lines.push(line);
    });
    return { lines: lines, subtotal: subtotal, discount: discount, goods: subtotal - discount, unpriced: unpriced };
  }
  function delivery(method, postal, goods, unpriced) {
    if (method === 'collect') return { fee: 0, text: 'Free (collection)' };
    var free = Number(S.free_delivery_from) || 0;
    if (free && goods >= free) return { fee: 0, text: 'Free' };
    if (!/^\d{4}$/.test(postal || '')) return { fee: null, text: 'Enter your postal code' };
    var local = inRanges(postal);
    var fee = local ? S.cape_town_delivery_fee : S.nationwide_delivery_fee;
    var label = local ? 'Cape Town next-day' : 'Nationwide courier';
    if (fee === null || fee === undefined || fee === '') return { fee: null, text: label + ': we\'ll confirm the cost' };
    return { fee: Number(fee), text: label + ': ' + R.money(fee) + (free && !unpriced ? ' (free from ' + R.rand(free) + ')' : '') };
  }

  /* ---------- Cart page ---------- */
  var app = $('#cart-app');
  if (app) {
    renderCart();
    refreshCartPrices(function () { var f = $('form', app); renderCart(f ? formValues(f) : undefined); });
  }
  function renderCart(saved) {
    var t = priceLines();
    if (!t.lines.length) {
      app.innerHTML = '<div class="empty"><p>Your order is empty.</p><p><a class="btn" href="/shop/">Browse products</a></p></div>';
      return;
    }
    var v = saved || {};
    app.innerHTML =
      '<div class="cartgrid"><div><div class="cart">' + t.lines.map(function (l, i) {
        var url = R.productUrl(l.p, BUILT);
        return '<div class="line"><a href="' + e(url) + '" class="line__img">' + R.img(l.p).replace('width="600" height="600"', 'width="64" height="64"') + '</a>' +
          '<div class="line__info"><a href="' + e(url) + '">' + e(l.p.name) + '</a>' + (l.p.options.length > 1 ? '<br><span class="muted">' + e(l.p.option_name || 'Option') + ': ' + e(l.o.label) + '</span>' : '') +
          '<br><span class="muted">' + (l.priced ? R.money(l.o.price) + ' each' + (l.pct ? ' · <span class="ok">' + l.pct + '% bulk discount</span>' : '') : 'Price on request') + '</span>' +
          (l.out ? '<br><span class="stock stock--out">Out of stock — we\'ll suggest an alternative</span>' : '') + '</div>' +
          '<div class="line__total">' + (l.priced ? R.money(l.total) : '—') + '</div>' +
          '<div class="line__qty"><label class="sr" for="q' + i + '">Quantity</label><input id="q' + i + '" type="number" min="1" max="9999" value="' + l.qty + '" data-qty="' + i + '" inputmode="numeric">' +
          '<button type="button" class="linkbtn" data-remove="' + i + '">Remove</button></div></div>';
      }).join('') + '</div><p><a href="/shop/">← Continue shopping</a> · <button type="button" class="linkbtn" data-clear>Clear order</button></p></div>' +
      '<div class="cartside"><div class="box"><h2>Summary</h2><dl class="totals" id="totals"></dl></div>' +
      '<p class="muted small">We confirm stock, delivery and the final total before you pay. Then we send you a secure PayFast or Yoco payment link, or our bank details for EFT.</p></div></div>' +
      '<form class="form box" id="orderform"><h2>Your details</h2>' +
      '<div class="form__2"><label>Name *<input name="name" required maxlength="120" autocomplete="name" value="' + e(v.name) + '"></label>' +
      '<label>Practice / organisation (optional)<input name="organisation" maxlength="160" autocomplete="organization" value="' + e(v.organisation) + '"></label></div>' +
      '<div class="form__2"><label>Phone / WhatsApp *<input type="tel" name="phone" required maxlength="30" autocomplete="tel" value="' + e(v.phone) + '"></label>' +
      '<label>Email *<input type="email" name="email" required maxlength="160" autocomplete="email" value="' + e(v.email) + '"></label></div>' +
      '<fieldset class="radios"><legend><b>Delivery</b></legend>' +
      '<label><input type="radio" name="method" value="deliver"' + (v.method !== 'collect' ? ' checked' : '') + '> Deliver to me</label>' +
      (S.allow_collection ? '<label><input type="radio" name="method" value="collect"' + (v.method === 'collect' ? ' checked' : '') + '> Collect from Khayelitsha (free)</label>' : '') +
      '</fieldset>' +
      '<div data-addr><label>Street address *<input name="address" maxlength="200" autocomplete="street-address" value="' + e(v.address) + '"></label>' +
      '<div class="form__2"><label>Suburb and city *<input name="city" maxlength="120" autocomplete="address-level2" value="' + e(v.city) + '"></label>' +
      '<label>Postal code *<input name="postal_code" pattern="[0-9]{4}" maxlength="4" inputmode="numeric" autocomplete="postal-code" value="' + e(v.postal_code) + '"></label></div></div>' +
      '<label>Payment preference<select name="payment"><option>Card or instant EFT (send me a payment link)</option><option' + (v.payment === 'Bank EFT' ? ' selected' : '') + '>Bank EFT</option></select></label>' +
      '<label>Notes (optional)<textarea name="notes" rows="3" maxlength="1000">' + e(v.notes) + '</textarea></label>' +
      '<label class="check"><input type="checkbox" name="consent" value="1" required' + (v.consent ? ' checked' : '') + '> <span>I agree to the <a href="/terms/">Terms</a> and that my details are used to process this order (<a href="/privacy-policy/">Privacy Policy</a>).</span></label>' +
      '<div class="sendbtns"><button class="btn btn--wa" name="via" value="whatsapp">Send order on WhatsApp</button><button class="btn" name="via" value="email">Send order by email</button></div>' +
      '<p class="muted small">Sending your order doesn\'t charge you anything. You pay only after we confirm.</p></form>';

    var form = $('#orderform');
    function refresh() {
      var deliver = form.method.value !== 'collect';
      $('[data-addr]').hidden = !deliver;
      ['address', 'city', 'postal_code'].forEach(function (n) { form[n].required = deliver; });
      var d = delivery(form.method.value, form.postal_code.value, t.goods, t.unpriced);
      var rows = '<div><dt>Products</dt><dd>' + (t.subtotal || !t.unpriced ? R.money(t.subtotal) : 'Price on request') + '</dd></div>' +
        (t.discount ? '<div class="totals__save"><dt>Bulk discount</dt><dd>−' + R.money(t.discount) + '</dd></div>' : '') +
        '<div><dt>Delivery</dt><dd>' + e(d.text) + '</dd></div>' +
        (t.subtotal ? '<div class="totals__total"><dt>Total' + (t.unpriced || d.fee === null ? ' so far' : '') + '</dt><dd>' + R.money(t.goods + (d.fee || 0)) + '</dd></div>' : '');
      if (t.unpriced) rows += '<p class="muted small">' + t.unpriced + ' item' + (t.unpriced > 1 ? 's' : '') + ' priced on request — we\'ll add the price when we confirm.</p>';
      $('#totals').innerHTML = rows;
      return d;
    }
    form.addEventListener('input', refresh);
    form.addEventListener('change', refresh);
    refresh();

    $$('[data-qty]', app).forEach(function (inp) {
      inp.addEventListener('change', function () {
        var c = getCart(), i = Number(inp.getAttribute('data-qty'));
        c[i].qty = Math.max(1, Math.min(9999, parseInt(inp.value, 10) || 1));
        setCart(c); renderCart(formValues(form));
      });
    });
    $$('[data-remove]', app).forEach(function (b) {
      b.addEventListener('click', function () { var c = getCart(); c.splice(Number(b.getAttribute('data-remove')), 1); setCart(c); renderCart(formValues(form)); });
    });
    $('[data-clear]', app).addEventListener('click', function () { if (confirm('Remove everything from your order?')) { setCart([]); renderCart(); } });

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var via = ev.submitter && ev.submitter.value === 'email' ? 'email' : 'whatsapp';
      var v = formValues(form), d = refresh(), ref = orderRef();
      var text = orderText(ref, v, t, d);
      send(via, 'Website order ' + ref + ' from ' + v.name, text, v, function (ok) {
        if (!ok) return;
        showDone(ref, via);
      });
    });
  }
  function formValues(form) {
    var o = {};
    Array.prototype.forEach.call(form.elements, function (el) {
      if (!el.name || el.name === 'via') return;
      if (el.type === 'radio') { if (el.checked) o[el.name] = el.value; } else if (el.type === 'checkbox') o[el.name] = el.checked; else o[el.name] = el.value.trim();
    });
    return o;
  }
  function orderRef() {
    var d = new Date(), pad = function (n) { return (n < 10 ? '0' : '') + n; };
    return 'MD-' + String(d.getFullYear()).slice(2) + pad(d.getMonth() + 1) + pad(d.getDate()) + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
  }
  function orderText(ref, v, t, d) {
    var L = ['ORDER ' + ref, ''];
    t.lines.forEach(function (l) {
      L.push('• ' + l.qty + ' x ' + l.p.name + (l.p.options.length > 1 ? ' (' + l.o.label + ')' : '') + (l.p.sku ? ' [' + l.p.sku + ']' : '') +
        (l.priced ? ' @ ' + R.money(l.o.price) + (l.pct ? ' less ' + l.pct + '%' : '') + ' = ' + R.money(l.total) : ' — price on request') + (l.out ? ' (shown out of stock)' : ''));
    });
    L.push('');
    if (t.subtotal) {
      L.push('Products: ' + R.money(t.subtotal) + (t.discount ? '  |  Bulk discount: -' + R.money(t.discount) : ''));
      L.push('Delivery: ' + d.text);
      L.push((t.unpriced || d.fee === null ? 'Total so far: ' : 'Total: ') + R.money(t.goods + (d.fee || 0)) + (t.unpriced ? ' (+ ' + t.unpriced + ' item(s) on request)' : ''));
    } else {
      L.push('Prices: please send me a quote for these items.');
      L.push('Delivery: ' + d.text);
    }
    L.push('', 'Name: ' + v.name);
    if (v.organisation) L.push('Organisation: ' + v.organisation);
    L.push('Phone: ' + v.phone, 'Email: ' + v.email);
    L.push(v.method === 'collect' ? 'Delivery method: COLLECT from Khayelitsha' : 'Deliver to: ' + v.address + ', ' + v.city + ', ' + v.postal_code);
    L.push('Payment: ' + v.payment);
    if (v.notes) L.push('Notes: ' + v.notes);
    return L.join('\n');
  }
  function showDone(ref, via) {
    var bank = filled(S.bank_account_number)
      ? '<div class="box"><h2>Paying by EFT?</h2><p>Please wait for our confirmation of the total, then pay to:</p><ul class="plain">' +
        [['Bank', S.bank_name], ['Account name', S.bank_account_name], ['Account number', S.bank_account_number], ['Branch code', S.bank_branch_code], ['Account type', S.bank_account_type]]
          .filter(function (r) { return filled(r[1]); }).map(function (r) { return '<li><b>' + e(r[0]) + ':</b> ' + e(r[1]) + '</li>'; }).join('') +
        '<li><b>Reference:</b> ' + e(ref) + '</li></ul></div>'
      : '';
    app.innerHTML = '<div class="box"><h2>Thank you — order ' + e(ref) + '</h2>' +
      '<p>' + (via === 'whatsapp' ? 'WhatsApp opened with your order. <b>Please press send in WhatsApp</b> if you haven\'t yet.' : 'Your order was sent by email.') + '</p>' +
      '<p>We\'ll confirm stock, delivery and the final total, then send you a secure payment link (PayFast or Yoco) or our bank details. We usually reply the same business day.</p>' +
      '<p><button type="button" class="btn btn--ghost" data-new>Start a new order</button> <a class="btn btn--ghost" href="/shop/">Back to the shop</a></p></div>' + bank;
    $('[data-new]', app).addEventListener('click', function () { setCart([]); renderCart(); });
  }

  /* ---------- Sending: WhatsApp, form service (web3forms) or the visitor's email app ---------- */
  function send(via, subject, text, v, done) {
    if (via === 'whatsapp') {
      window.open(R.waLink(S, text), '_blank', 'noopener');
      done(true);
      return;
    }
    if (filled(S.web3forms_key)) {
      var btns = $$('.sendbtns button'); btns.forEach(function (b) { b.disabled = true; });
      fetch('https://api.web3forms.com/submit', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ access_key: S.web3forms_key, subject: subject, from_name: S.trading_name + ' website', name: v.name, email: v.email, replyto: v.email, message: text, botcheck: '' }),
      }).then(function (r) { return r.json(); }).then(function (j) {
        if (j && j.success) done(true);
        else throw new Error('not sent');
      }).catch(function () {
        btns.forEach(function (b) { b.disabled = false; });
        alert('Sorry, the message could not be sent. Please try "Send on WhatsApp", or email us at ' + S.email + '.');
        done(false);
      });
      return;
    }
    // No form service set up: open the visitor's own email app with everything filled in.
    location.href = 'mailto:' + encodeURIComponent(S.email) + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(text);
    done(true);
  }

  /* ---------- Contact and quote forms ---------- */
  $$('form[data-form]').forEach(function (form) {
    var kind = form.getAttribute('data-form');
    if (kind === 'quote' && params.get('item')) form.items.value = params.get('item') + ' – ';
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var via = ev.submitter && ev.submitter.value === 'whatsapp' ? 'whatsapp' : 'email';
      var v = formValues(form);
      var labels = { name: 'Name', organisation: 'Organisation', type: 'Type', email: 'Email', phone: 'Phone', postal_code: 'Delivery postal code', needed_by: 'Needed by', reference: 'Reference', items: 'Products and quantities', message: 'Message' };
      var lines = [kind === 'quote' ? 'QUOTE REQUEST' : 'WEBSITE MESSAGE', ''];
      Object.keys(labels).forEach(function (k) { if (filled(v[k])) lines.push(labels[k] + ': ' + v[k]); });
      var subject = kind === 'quote' ? 'Quote request from ' + (v.organisation || v.name) : 'Website message from ' + v.name;
      send(via, subject, lines.join('\n'), v, function (ok) {
        if (!ok) return;
        var box = form.parentNode.querySelector('[data-form-done]');
        box.innerHTML = '<p class="flash flash--ok" role="status">' + (via === 'whatsapp' ? 'WhatsApp opened with your message — please press send there.' : 'Thank you — ' + (filled(S.web3forms_key) ? 'your message was sent.' : 'your email app opened with the message. Please press send there.')) + ' We usually reply within one business day.</p>';
        box.hidden = false;
        form.hidden = true;
        box.scrollIntoView({ block: 'center' });
      });
    });
  });
})();
