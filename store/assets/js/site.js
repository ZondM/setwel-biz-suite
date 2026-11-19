/* Setwel Africa storefront — small, dependency-free scripts. */
(function () {
  'use strict';
  var S = window.STORE || { base: '' };
  var $ = function (sel, el) { return (el || document).querySelector(sel); };
  var $$ = function (sel, el) { return Array.prototype.slice.call((el || document).querySelectorAll(sel)); };

  // Mobile menu
  var menuBtn = $('[data-menu]');
  if (menuBtn) {
    menuBtn.addEventListener('click', function () {
      var nav = $('#main-nav');
      var open = nav.classList.toggle('open');
      menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  // Filters toggle (mobile)
  $$('[data-filters-toggle]').forEach(function (b) {
    b.addEventListener('click', function () {
      var f = $('#filters');
      var open = f.classList.toggle('open');
      b.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  });

  // Auto-submit filter checkboxes / sort
  $$('[data-autosubmit]').forEach(function (el) {
    el.addEventListener('change', function () { el.form.submit(); });
  });

  // Search suggestions
  var box = $('[data-suggest]');
  if (box) {
    var input = $('input', box), list = $('.suggest', box), timer, active = -1;
    var esc = function (s) { var d = document.createElement('div'); d.textContent = s == null ? '' : s; return d.innerHTML; };
    var close = function () { list.hidden = true; active = -1; };
    input.addEventListener('input', function () {
      clearTimeout(timer);
      var q = input.value.trim();
      if (q.length < 2) { close(); return; }
      timer = setTimeout(function () {
        fetch(S.base + '/api/suggest?q=' + encodeURIComponent(q)).then(function (r) { return r.json(); }).then(function (data) {
          if (!data.items || !data.items.length) {
            list.innerHTML = '<a class="s-all" href="' + S.base + '/quote?item=' + encodeURIComponent(q) + '">Can\'t find it? Ask us for a quote on “' + esc(q) + '”</a>';
          } else {
            list.innerHTML = data.items.map(function (i) {
              return '<a role="option" href="' + esc(i.url) + '"><img src="' + esc(i.image) + '" alt="" loading="lazy"><span>' + esc(i.name) + '<br><small class="muted">' + esc(i.sku) + '</small></span><span class="s-price">' + esc(i.price) + '</span></a>';
            }).join('') + '<a class="s-all" href="' + S.base + '/search?q=' + encodeURIComponent(q) + '">See all results</a>';
          }
          list.hidden = false;
          active = -1;
        }).catch(close);
      }, 180);
    });
    input.addEventListener('keydown', function (e) {
      var items = $$('a', list);
      if (list.hidden || !items.length) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        active = (active + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
        items.forEach(function (a, i) { a.classList.toggle('active', i === active); });
      } else if (e.key === 'Enter' && active >= 0) {
        e.preventDefault();
        location.href = items[active].href;
      } else if (e.key === 'Escape') {
        close();
      }
    });
    document.addEventListener('click', function (e) { if (!box.contains(e.target)) close(); });
  }

  // Hero slider
  var slides = $$('.hero-slide');
  if (slides.length > 1) {
    var dots = $('.hero-dots'), idx = 0, timer2;
    slides.forEach(function (_, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('aria-label', 'Show slide ' + (i + 1));
      b.addEventListener('click', function () { show(i); restart(); });
      dots.appendChild(b);
    });
    var show = function (i) {
      idx = i;
      slides.forEach(function (s, j) { s.classList.toggle('active', j === i); });
      $$('button', dots).forEach(function (d, j) { d.classList.toggle('active', j === i); });
    };
    var restart = function () { clearInterval(timer2); timer2 = setInterval(function () { show((idx + 1) % slides.length); }, 7000); };
    show(0);
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) restart();
  }

  // Product gallery
  $$('[data-thumb]').forEach(function (b) {
    b.addEventListener('click', function () {
      var main = $('#main-image');
      main.src = b.getAttribute('data-thumb');
      $$('[data-thumb]').forEach(function (x) { x.classList.toggle('active', x === b); });
    });
  });

  // Quantity buttons
  $$('.qty').forEach(function (q) {
    var input = $('input', q);
    $$('button', q).forEach(function (b) {
      b.addEventListener('click', function () {
        var v = parseInt(input.value || '1', 10) + parseInt(b.getAttribute('data-step'), 10);
        input.value = Math.max(parseInt(input.min || '1', 10), Math.min(999, v));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      });
    });
  });

  // Checkout: show address only for courier; update delivery fee
  var checkout = $('#checkout-form');
  if (checkout) {
    var update = function () {
      var method = (checkout.querySelector('input[name=delivery_method]:checked') || {}).value;
      $('#address-fields').hidden = method !== 'courier';
      $$('#address-fields [data-required]').forEach(function (i) { i.required = method === 'courier'; });
      var sub = parseFloat(checkout.getAttribute('data-subtotal'));
      var fee = method === 'courier' ? (sub >= parseFloat(checkout.getAttribute('data-threshold')) && parseFloat(checkout.getAttribute('data-threshold')) > 0 ? 0 : parseFloat(checkout.getAttribute('data-fee'))) : 0;
      var fmt = function (n) { return 'R' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); };
      $('#sum-delivery').textContent = fee > 0 ? fmt(fee) : 'Free';
      $('#sum-total').textContent = fmt(sub + fee);
    };
    $$('input[name=delivery_method]', checkout).forEach(function (r) { r.addEventListener('change', update); });
    update();
  }

  // Native share (falls back to WhatsApp link)
  $$('[data-share]').forEach(function (b) {
    if (!navigator.share) { b.hidden = true; return; }
    b.addEventListener('click', function () {
      navigator.share({ title: document.title, url: location.href }).catch(function () {});
    });
  });

  // Cookie consent (POPIA): analytics/ads only load after "Accept all"
  var KEY = 'setwel_consent';
  var getConsent = function () { try { return localStorage.getItem(KEY); } catch (e) { return null; } };
  var cookie = $('#cookie');
  var loadTracking = function () {
    if (S.ga && !window.gtag) {
      var s = document.createElement('script');
      s.async = true;
      s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(S.ga);
      document.head.appendChild(s);
      window.dataLayer = window.dataLayer || [];
      window.gtag = function () { window.dataLayer.push(arguments); };
      window.gtag('js', new Date());
      window.gtag('config', S.ga);
    }
    if (S.pixel && !window.fbq) {
      /* Meta Pixel base code */
      !function (f, b, e, v, n, t, s) { if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); }; if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = []; t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s); }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
      window.fbq('init', S.pixel);
      window.fbq('track', 'PageView');
    }
    (S.events || []).forEach(function (ev) {
      if (window.gtag && ev.ga) window.gtag('event', ev.ga, ev.data || {});
      if (window.fbq && ev.fb) window.fbq('track', ev.fb, ev.fbData || {});
    });
  };
  if (cookie) {
    var c = getConsent();
    if (!c) cookie.classList.add('show');
    if (c === 'all') loadTracking();
    $$('[data-consent]', cookie).forEach(function (b) {
      b.addEventListener('click', function () {
        var v = b.getAttribute('data-consent');
        try { localStorage.setItem(KEY, v); } catch (e) {}
        cookie.classList.remove('show');
        if (v === 'all') loadTracking();
      });
    });
    $$('[data-cookie-open]').forEach(function (a) {
      a.addEventListener('click', function (e) { e.preventDefault(); cookie.classList.add('show'); });
    });
  }
  // Weekly specials: sliding showcase (auto-advances; pauses on hover/focus; no auto-play with reduced motion)
  $$('[data-showcase]').forEach(function (box) {
    var slides = $$('.showcase-slide', box), dots = $$('.showcase-dots button', box), i = 0, timer = null;
    if (slides.length < 2) { return; }
    var still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var go = function (n) {
      slides[i].classList.remove('active'); if (dots[i]) { dots[i].classList.remove('active'); }
      i = (n + slides.length) % slides.length;
      slides[i].classList.add('active'); if (dots[i]) { dots[i].classList.add('active'); }
    };
    var stop = function () { clearInterval(timer); timer = null; };
    var start = function () { if (!still && !timer) { timer = setInterval(function () { go(i + 1); }, 4500); } };
    $('[data-prev]', box).addEventListener('click', function () { stop(); go(i - 1); start(); });
    $('[data-next]', box).addEventListener('click', function () { stop(); go(i + 1); start(); });
    dots.forEach(function (d, n) { d.addEventListener('click', function () { stop(); go(n); start(); }); });
    box.addEventListener('mouseenter', stop);
    box.addEventListener('mouseleave', start);
    box.addEventListener('focusin', stop);
    box.addEventListener('focusout', start);
    var x0 = null;
    box.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; stop(); }, { passive: true });
    box.addEventListener('touchend', function (e) {
      if (x0 !== null) { var dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 40) { go(i + (dx < 0 ? 1 : -1)); } }
      x0 = null; start();
    });
    start();
  });

  // Weekly specials: countdown to the end of the week's specials
  $$('[data-countdown]').forEach(function (el) {
    var end = parseInt(el.getAttribute('data-countdown'), 10);
    var set = function (k, v) { var b = $('[data-' + k + ']', el); if (b) { b.textContent = v; } };
    var tick = function () {
      var s = Math.max(0, Math.floor((end - Date.now()) / 1000));
      set('d', Math.floor(s / 86400)); set('h', Math.floor(s % 86400 / 3600)); set('m', Math.floor(s % 3600 / 60)); set('s', s % 60);
    };
    tick(); setInterval(tick, 1000);
  });

  // Weekly specials: brand tabs (HP / Riso / Brother …)
  $$('[data-brand-tab]').forEach(function (tab) {
    tab.addEventListener('click', function () {
      var b = tab.getAttribute('data-brand-tab');
      $$('[data-brand-tab]').forEach(function (t) { t.classList.toggle('active', t === tab); });
      $$('[data-brand]').forEach(function (it) { it.hidden = b !== '' && it.getAttribute('data-brand') !== b; });
    });
  });
  // Home page: weekly specials reel (plays like a short video; pauses on hover; tap sides to skip)
  $$('[data-reel]').forEach(function (reel) {
    var frames = $$('.reel-frame', reel), bars = $$('.reel-bars span', reel), i = 0, timer = null, ms = 5000;
    var still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    reel.style.setProperty('--reel-ms', ms + 'ms');
    var show = function (n) {
      frames[i].classList.remove('active');
      i = (n + frames.length) % frames.length;
      frames[i].classList.add('active');
      bars.forEach(function (b, k) {
        b.classList.remove('run'); b.classList.toggle('done', k < i);
      });
      if (bars[i] && !still) { void bars[i].offsetWidth; bars[i].classList.add('run'); }
    };
    var play = function () { if (!still && frames.length > 1 && !timer) { timer = setInterval(function () { show(i + 1); }, ms); } };
    var pause = function () { clearInterval(timer); timer = null; };
    show(0); play();
    reel.addEventListener('mouseenter', function () { pause(); if (bars[i]) { bars[i].style.animationPlayState = 'paused'; } });
    reel.addEventListener('mouseleave', function () { show(i); play(); });
    reel.addEventListener('focusin', pause);
    $('.reel-frames', reel).addEventListener('click', function (e) {
      if (e.target.closest('a, button, form')) { return; }
      var r = reel.getBoundingClientRect();
      pause(); show(i + (e.clientX - r.left < r.width / 3 ? -1 : 1)); play();
    });
  });

  // Categories dropdown: close when clicking elsewhere
  $$('[data-navcats]').forEach(function (d) {
    document.addEventListener('click', function (e) { if (d.open && !d.contains(e.target)) { d.open = false; } });
  });
  // Count WhatsApp / call clicks (anonymous). Every wa.me link counts, plus anything marked data-track.
  var beacon = function (type, label) {
    try {
      var f = new FormData();
      f.append('type', type); f.append('label', label || ''); f.append('path', location.pathname);
      if (navigator.sendBeacon) { navigator.sendBeacon(S.base + '/api/track', f); }
    } catch (e) { /* ignore */ }
  };
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a');
    if (!a) { return; }
    var href = a.getAttribute('href') || '';
    if (a.hasAttribute('data-track')) { beacon(a.getAttribute('data-track'), a.getAttribute('data-label') || a.textContent.trim().slice(0, 80)); }
    else if (href.indexOf('wa.me/') !== -1) { beacon('wa_click', a.getAttribute('aria-label') || a.textContent.trim().slice(0, 80)); }
    else if (href.indexOf('tel:') === 0) { beacon('call_click', href); }
  });
  S.beacon = beacon;

  // Instant quote builder: search, add products, live totals (the server re-prices everything).
  var qb = $('[data-quote-builder]');
  if (qb) {
    var tbody = $('tbody', qb), input = $('#qb-q'), results = $('.qb-results', qb), timerQ;
    var fee = parseFloat(qb.getAttribute('data-fee')) || 0, free = parseFloat(qb.getAttribute('data-free')) || 0;
    var rands = function (n) { return 'R' + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' '); };
    var recalc = function () {
      var sub = 0, unpriced = 0, rows = $$('tr[data-id]', tbody);
      rows.forEach(function (tr) {
        var price = parseFloat(tr.getAttribute('data-price')) || 0, q = parseInt($('input', tr).value, 10) || 0;
        if (price > 0) { sub += price * q; $('[data-line]', tr).textContent = rands(price * q); }
        else { unpriced++; $('[data-line]', tr).textContent = 'To confirm'; }
      });
      var del = sub > 0 ? (free > 0 && sub >= free ? 0 : fee) : 0;
      $('[data-sub]', qb).textContent = rands(sub);
      $('[data-del]', qb).textContent = sub > 0 ? (del ? rands(del) : 'Free') : '—';
      $('[data-tot]', qb).textContent = rands(sub + del) + (unpriced ? ' + items to confirm' : '');
      $('.qb-empty', qb).hidden = rows.length > 0;
    };
    var addRow = function (it) {
      var ex = $('tr[data-id="' + it.id + '"]', tbody);
      if (ex) { var i = $('input', ex); i.value = (parseInt(i.value, 10) || 0) + 1; recalc(); return; }
      var tr = document.createElement('tr');
      tr.setAttribute('data-id', it.id); tr.setAttribute('data-price', it.buyable ? it.amount : 0);
      var esc = function (s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; };
      tr.innerHTML = '<td><strong>' + esc(it.name) + '</strong><br><small class="muted">' + esc(it.sku) + ' · ' + esc(it.stock || '') + '</small></td>' +
        '<td class="num">' + (it.buyable && it.amount > 0 ? esc(it.price) : 'We will price') + '</td>' +
        '<td class="num"><input type="number" name="qty[' + it.id + ']" value="1" min="1" max="999" aria-label="Quantity"></td>' +
        '<td class="num" data-line></td><td><button type="button" class="btn btn-ghost btn-sm" data-remove aria-label="Remove">✕</button></td>';
      tbody.appendChild(tr); recalc();
    };
    tbody.addEventListener('input', recalc);
    tbody.addEventListener('click', function (e) { if (e.target.closest('[data-remove]')) { e.target.closest('tr').remove(); recalc(); } });
    input.addEventListener('input', function () {
      clearTimeout(timerQ);
      var q = input.value.trim();
      if (q.length < 2) { results.hidden = true; return; }
      timerQ = setTimeout(function () {
        fetch(S.base + '/api/suggest?q=' + encodeURIComponent(q)).then(function (r) { return r.json(); }).then(function (d) {
          results.innerHTML = '';
          (d.items || []).forEach(function (it) {
            var b = document.createElement('button');
            b.type = 'button'; b.className = 'qb-hit';
            b.innerHTML = '<span></span><strong></strong>';
            b.firstChild.textContent = it.name + ' (' + it.sku + ')'; b.lastChild.textContent = it.price + ' · Add';
            b.addEventListener('click', function () { addRow(it); results.hidden = true; input.value = ''; input.focus(); });
            results.appendChild(b);
          });
          if (!(d.items || []).length) { results.innerHTML = '<p class="muted" style="padding:10px;margin:0">Not found — type it in "Anything not on our website?" below and we will price it.</p>'; }
          results.hidden = false;
        });
      }, 200);
    });
    recalc();
  }
  // AI assistant chat widget
  var chat = $('[data-chat]');
  if (chat) {
    var log = $('.chat-log', chat), form = $('[data-chat-form]', chat), field = $('input', form), opener = $('[data-chat-open]'), busy = false, opened = false;
    var esc = function (s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; };
    var linkify = function (s) { return esc(s).replace(/(https?:\/\/[^\s<>"'&]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>').replace(/\n/g, '<br>'); };
    var add = function (cls, html) { var m = document.createElement('div'); m.className = 'msg ' + cls; m.innerHTML = html; log.appendChild(m); log.scrollTop = log.scrollHeight; return m; };
    var save = function () { try { sessionStorage.setItem('setwel_chat', log.innerHTML); } catch (e) { /* ignore */ } };
    try { var old = sessionStorage.getItem('setwel_chat'); if (old) { log.innerHTML = old; } } catch (e) { /* ignore */ }
    var open = function () { chat.hidden = false; opener.hidden = true; field.focus(); log.scrollTop = log.scrollHeight; if (!opened) { opened = true; beacon('chat_open', location.pathname); } };
    opener.addEventListener('click', open);
    $('[data-chat-close]', chat).addEventListener('click', function () { chat.hidden = true; opener.hidden = false; });
    var send = function (text) {
      if (!text || busy) { return; }
      busy = true; field.value = '';
      add('me', esc(text));
      var typing = add('bot typing', '<span></span><span></span><span></span>');
      var f = new FormData(); f.append('message', text);
      fetch(S.base + '/api/chat', { method: 'POST', body: f, headers: { 'X-CSRF-TOKEN': S.csrf }, credentials: 'same-origin' })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          log.removeChild(typing);
          add('bot', linkify(d.reply || 'Sorry, something went wrong.'));
          if (d.quote_url) {
            add('bot', '<a class="btn btn-gold btn-sm" href="' + esc(d.quote_url) + '">Open my quote</a>');
            add('bot', 'Please double-check with a person on <strong>' + esc(S.waNumber) + '</strong> via WhatsApp before sending payment.<br>'
              + '<a class="btn btn-wa btn-sm" style="margin-top:8px" target="_blank" rel="noopener" href="https://wa.me/' + esc(S.wa) + '?text=' + encodeURIComponent('Hi, please confirm my quote before I pay: ' + d.quote_url) + '">Confirm on WhatsApp</a>');
          }
          save();
        })
        .catch(function () { if (typing.parentNode) { log.removeChild(typing); } add('bot', 'Sorry, the connection failed. Please try again or use WhatsApp below.'); })
        .then(function () { busy = false; });
    };
    $$('[data-chip]', chat).forEach(function (b) {
      b.addEventListener('click', function () {
        var t = b.getAttribute('data-chip');
        if (/ $/.test(t)) { field.value = t; field.focus(); } else { send(t); }
      });
    });
    form.addEventListener('submit', function (e) { e.preventDefault(); send(field.value.trim()); });
  }
})();
