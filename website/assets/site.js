// Setwel website: picks the right download, pricing toggle, checkout form, and the thank-you page.
(function () {
  var WIN = '/downloads/Setwel-Setup.exe';
  var MAC = '/downloads/Setwel-Mac.dmg';

  function detectOS() {
    var ua = navigator.userAgent || '';
    var touchMac = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1; // iPad pretending to be a Mac
    if (/Android|iPhone|iPad|iPod|Mobile/.test(ua) || touchMac) return 'phone';
    if (/Mac/.test(ua)) return 'mac';
    if (/Win/.test(ua)) return 'windows';
    return 'other';
  }
  var os = detectOS();

  // "Download free trial" buttons go straight to the right file.
  document.querySelectorAll('[data-dl]').forEach(function (a) {
    var keep = a.hasAttribute('data-keep-text');
    if (os === 'windows') { a.href = WIN; if (!keep) a.textContent = 'Download free for Windows'; }
    else if (os === 'mac') { a.href = MAC; if (!keep) a.textContent = 'Download free for Mac'; }
    else if (os === 'phone') { a.href = '/app/'; if (!keep) a.textContent = 'Open Setwel free on this phone'; }
    // A direct file download leaves the visitor on the page; show the install steps next.
    if (os === 'windows' || os === 'mac') {
      a.addEventListener('click', function () {
        setTimeout(function () { location.href = '/download.html#' + os; }, 800);
      });
    }
  });
  document.querySelectorAll('[data-dl-note]').forEach(function (p) {
    if (os === 'windows') p.innerHTML = 'For Windows 10 and 11. <a href="/download.html">Mac or phone instead?</a>';
    if (os === 'mac') p.innerHTML = 'For macOS 12 or newer. <a href="/download.html">Windows or phone instead?</a>';
    if (os === 'phone') p.innerHTML = 'Nothing to install. <a href="/download.html">Windows or Mac instead?</a>';
  });

  // Download page: put the visitor's own device first.
  var mine = document.querySelector('.dl [data-os="' + os + '"]');
  if (mine) {
    mine.classList.add('mine');
    mine.parentNode.insertBefore(mine, mine.parentNode.firstChild);
  }

  // Pricing: monthly / yearly toggle.
  var toggle = document.querySelectorAll('[data-billing]');
  toggle.forEach(function (b) {
    b.addEventListener('click', function () {
      var billing = b.getAttribute('data-billing');
      toggle.forEach(function (x) { x.classList.toggle('on', x === b); });
      document.querySelectorAll('[data-monthly]').forEach(function (el) { el.hidden = billing !== 'monthly'; });
      document.querySelectorAll('[data-yearly]').forEach(function (el) { el.hidden = billing !== 'yearly'; });
      document.querySelectorAll('[data-buy]').forEach(function (a) {
        var plan = a.getAttribute('data-buy');
        var useYearly = billing === 'yearly' && plan !== 'accountant_partner';
        a.href = '/pay.html?plan=' + plan + '&billing=' + (useYearly ? 'yearly' : 'monthly');
      });
    });
  });

  var params = new URLSearchParams(location.search);

  // Remember a referral code from any link like ?ref=REF-AB12CD.
  try {
    if (params.get('ref')) localStorage.setItem('setwel_ref', params.get('ref'));
  } catch (e) { /* storage blocked */ }

  // Checkout form.
  var form = document.getElementById('payForm');
  if (form && window.SETWEL_PLANS) {
    var plans = window.SETWEL_PLANS;
    var planId = params.get('plan');
    if (!plans[planId]) planId = 'grinder';
    var plan = plans[planId];
    var billing = params.get('billing') === 'yearly' && plan.yearly ? 'yearly' : 'monthly';
    var price = billing === 'yearly' ? plan.yearly : plan.monthly;
    document.getElementById('plan').value = planId;
    document.getElementById('billing').value = billing;
    document.getElementById('summary').innerHTML =
      '<strong>' + plan.name + '</strong>: R' + price.toLocaleString('en-ZA', { minimumFractionDigits: price % 1 ? 2 : 0 }) +
      (billing === 'yearly' ? ' per year' : ' per month') +
      '<br><span class="hint">Renews automatically. Cancel any time on WhatsApp. <a href="/pricing.html">Change plan</a></span>';
    try {
      var saved = localStorage.getItem('setwel_ref');
      if (saved) document.getElementById('ref').value = saved;
    } catch (e) { /* storage blocked */ }
  }

  // Thank-you page: wait for PayFast's confirmation, then show the key.
  var keyEl = document.getElementById('key');
  if (keyEl && params.get('id') && params.get('t')) {
    var tries = 0;
    var poll = function () {
      tries++;
      fetch('/api/order-status.php?id=' + encodeURIComponent(params.get('id')) + '&t=' + encodeURIComponent(params.get('t')))
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (d.key) {
            document.getElementById('waiting').hidden = true;
            document.getElementById('slow').hidden = true;
            document.getElementById('ready').hidden = false;
            keyEl.textContent = d.key;
            document.getElementById('activateLink').href = 'setwel://activate?key=' + encodeURIComponent(d.key);
            document.getElementById('refCode').textContent = d.ref_code || '';
            var msg = 'I use Setwel Biz Suite for my invoices and books. Try it free for 30 days: https://setwelbusiness.co.za/?ref=' + (d.ref_code || '') + ' (use my code ' + (d.ref_code || '') + ' when you pay)';
            document.getElementById('shareWa').href = 'https://wa.me/?text=' + encodeURIComponent(msg);
            return;
          }
          if (tries === 20) document.getElementById('slow').hidden = false;
          if (tries < 120) setTimeout(poll, 3000);
        })
        .catch(function () { if (tries < 120) setTimeout(poll, 5000); });
    };
    poll();
  } else if (keyEl) {
    document.getElementById('waiting').innerHTML = '<p>Your licence key has been emailed to you. Can\'t find it? <a href="https://wa.me/27820829050">WhatsApp us</a>.</p>';
  }
})();

// Find an accountant: list partners and send setup / training requests.
(function () {
  var list = document.getElementById('partner-list');
  if (!list) return;
  var prov = document.getElementById('pf-prov');
  var pick = document.getElementById('rq-partner');
  var partners = [];
  function esc(s) { var d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }
  function render() {
    var p = prov.value;
    var shown = partners.filter(function (x) { return !p || x.province === p || /online/i.test(x.province); });
    if (!shown.length) {
      list.innerHTML = '<div class="card"><h3>No listed partner here yet</h3><p>Send the request form below and our team will help you, or find someone who can.</p></div>';
      return;
    }
    list.innerHTML = shown.map(function (x) {
      var wa = x.phone ? 'https://wa.me/' + x.phone.replace(/\D/g, '').replace(/^0/, '27') : '';
      return '<div class="card"><h3>' + esc(x.firm) + '</h3>' +
        '<p>' + esc([x.city, x.province].filter(Boolean).join(', ')) + (x.languages ? '<br>' + esc(x.languages) : '') + '</p>' +
        (x.services && x.services.length ? '<p style="margin-top:8px;font-size:14px">' + esc(x.services.join(' · ')) + '</p>' : '') +
        '<div class="btn-row" style="margin-top:12px">' +
        (wa ? '<a class="btn btn-green" style="padding:9px 14px;font-size:14px" href="' + wa + '">WhatsApp</a>' : '') +
        (x.email ? '<a class="btn btn-plain" style="padding:9px 14px;font-size:14px" href="mailto:' + esc(x.email) + '">Email</a>' : '') +
        (x.website ? '<a class="btn btn-plain" style="padding:9px 14px;font-size:14px" href="' + esc(x.website) + '" rel="noopener">Website</a>' : '') +
        '</div></div>';
    }).join('');
  }
  fetch('/api/partners.php').then(function (r) { return r.json(); }).then(function (d) {
    partners = Array.isArray(d) ? d : [];
    partners.forEach(function (x) { var o = document.createElement('option'); o.value = x.id; o.textContent = x.firm + (x.city ? ' (' + x.city + ')' : ''); pick.appendChild(o); });
    render();
  }).catch(function () { list.innerHTML = '<p>Could not load the list right now. Use the form below or WhatsApp us on 082 082 9050.</p>'; });
  prov.addEventListener('change', render);

  var form = document.getElementById('partnerForm');
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var out = document.getElementById('rq-result');
    var data = {};
    new FormData(form).forEach(function (v, k) { data[k] = v; });
    out.textContent = 'Sending…';
    fetch('/api/partners.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d.error) { out.textContent = d.error; return; }
        form.reset();
        out.textContent = 'Thank you. ' + (d.partner ? d.partner + ' will' : 'We will') + ' contact you within one business day.';
      })
      .catch(function () { out.textContent = 'Could not send. Please WhatsApp us on 082 082 9050.'; });
  });
})();
