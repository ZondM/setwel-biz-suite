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
})();
