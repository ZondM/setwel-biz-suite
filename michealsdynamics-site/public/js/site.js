// Small progressive enhancements. The site works without JavaScript.
(function () {
  function money(cents) {
    var p = (Math.round(cents) / 100).toFixed(2).split('.');
    return 'R' + p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '.' + p[1];
  }

  // Cookie notice (remembered in this browser only)
  var c = document.getElementById('cookie');
  var seen = false;
  try { seen = localStorage.getItem('md-cookie-ok') === '1'; } catch (e) { /* storage blocked */ }
  if (c && !seen) {
    c.hidden = false;
    document.getElementById('cookie-ok').addEventListener('click', function () {
      try { localStorage.setItem('md-cookie-ok', '1'); } catch (e) { /* ignore */ }
      c.hidden = true;
    });
  }

  // Filters open by default on wide screens; auto-apply when changed.
  var f = document.querySelector('[data-open-desktop]');
  if (f && window.matchMedia('(min-width: 900px)').matches) f.open = true;
  var ff = document.getElementById('filters');
  if (ff) ff.addEventListener('change', function () { ff.submit(); });

  // Product page: variant switching, quantity buttons, bulk table, photo thumbnails.
  var buy = document.getElementById('buy');
  if (buy) {
    var qty = document.getElementById('qty');
    var tiersEl = document.getElementById('tiers');
    var tiers = tiersEl ? JSON.parse(tiersEl.getAttribute('data-tiers')) : [];
    var add = document.getElementById('addbtn');

    function renderTiers(cents) {
      if (!tiersEl || cents === '' || cents === null) return;
      var tb = tiersEl.querySelector('tbody'), rows = '';
      rows += '<tr><td>1–' + (tiers[0].min - 1) + '</td><td>' + money(cents) + '</td><td>—</td></tr>';
      tiers.forEach(function (t, i) {
        var next = tiers[i + 1];
        rows += '<tr><td>' + t.min + (next ? '–' + (next.min - 1) : '+') + '</td><td>' + money(cents * (100 - t.pct) / 100) + '</td><td>' + t.pct + '%</td></tr>';
      });
      tb.innerHTML = rows;
    }
    function update() {
      var r = buy.querySelector('input[name=variant]:checked');
      if (!r) { var h = buy.querySelector('input[name=variant]'); if (h && h.type === 'hidden' && tiersEl && tiersEl.dataset.base) renderTiers(Number(tiersEl.dataset.base)); return; }
      document.getElementById('price').textContent = r.dataset.price || 'Price on request';
      document.getElementById('peritem').textContent = r.dataset.peritem || '';
      var st = document.getElementById('stock');
      st.textContent = r.dataset.stockkey === 'request' ? '' : r.dataset.stock;
      st.className = 'stock stock--' + r.dataset.stockkey;
      if (qty) { qty.max = Math.max(1, Number(r.dataset.max)); if (Number(qty.value) > Number(qty.max)) qty.value = qty.max; }
      if (add) add.disabled = !(r.dataset.stockkey === 'in' || r.dataset.stockkey === 'low');
      renderTiers(r.dataset.cents === '' ? null : Number(r.dataset.cents));
    }
    buy.addEventListener('change', update);
    buy.querySelectorAll('[data-step]').forEach(function (b) {
      b.addEventListener('click', function () {
        var v = Math.max(1, Math.min(Number(qty.max) || 9999, (Number(qty.value) || 1) + Number(b.dataset.step)));
        qty.value = v;
      });
    });
    update();
  }
  document.querySelectorAll('.thumbs button').forEach(function (b) {
    b.addEventListener('click', function () { var m = document.getElementById('pdp-main'); if (m) m.src = b.dataset.src; });
  });
})();
