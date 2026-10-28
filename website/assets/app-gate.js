// Phone/browser version of Setwel: 30-day trial from first open, then a licence key unlocks it.
// The desktop app does the same check in its own code (desktop/licence.js).
(function () {
  var TRIAL_DAYS = 30;
  var GRACE_DAYS = 7;
  var DAY = 86400000;
  var RECHECK = DAY; // refresh the licence from the server once a day when online

  function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* storage blocked */ } }

  var now = Date.now();
  var firstRun = Number(get('setwel_first_run')) || now;
  var lastSeen = Math.max(Number(get('setwel_last_seen')) || 0, now);
  set('setwel_first_run', String(firstRun));
  set('setwel_last_seen', String(lastSeen));

  function licence() {
    try { return JSON.parse(get('setwel_licence') || 'null'); } catch (e) { return null; }
  }

  function state() {
    var l = licence();
    if (l && l.paid_until) {
      return lastSeen <= Date.parse(l.paid_until) + GRACE_DAYS * DAY ? { mode: 'licensed' } : { mode: 'expired', reason: 'renew' };
    }
    var left = Math.max(0, TRIAL_DAYS - Math.floor((lastSeen - firstRun) / DAY));
    return left > 0 ? { mode: 'trial', daysLeft: left } : { mode: 'expired', reason: 'trial' };
  }

  function check(key) {
    return fetch('/api/licence.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: key })
    }).then(function (r) {
      return r.json().then(function (d) {
        if (!r.ok || !d.paid_until) throw new Error(d.error || 'We could not check that key. Try again.');
        set('setwel_licence', JSON.stringify({ key: key, plan: d.plan, paid_until: d.paid_until, checked: Date.now() }));
        return d;
      });
    });
  }

  function overlay(s) {
    var el = document.createElement('div');
    el.id = 'setwel-gate';
    el.setAttribute('style', 'position:fixed;inset:0;z-index:2147483647;background:#fff;overflow:auto;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#0d1b2a');
    var title = s.reason === 'renew' ? 'Your subscription needs renewing' : 'Your 30-day free trial has ended';
    var lead = s.reason === 'renew'
      ? 'We could not confirm a recent payment. Renew your plan, or connect to the internet so Setwel can check again.'
      : 'Choose a plan to unlock Setwel again. Everything you captured is still saved on this phone.';
    el.innerHTML =
      '<div style="background:#0d1b2a;color:#fff;padding:20px 16px"><strong style="font-size:19px">Setwel Biz Suite</strong></div>' +
      '<div style="max-width:460px;margin:0 auto;padding:22px 16px">' +
      '<h2 style="margin:0 0 8px;font-size:21px">' + title + '</h2>' +
      '<p style="color:#5b6673;line-height:1.5">' + lead + '</p>' +
      '<a href="/pricing.html" style="display:block;text-align:center;background:#007a4d;color:#fff;padding:14px;border-radius:6px;font-weight:700;text-decoration:none">See plans and pay securely</a>' +
      '<label for="sg-key" style="display:block;font-weight:600;margin:20px 0 6px">Already paid? Enter your licence key</label>' +
      '<input id="sg-key" placeholder="SETW-XXXX-XXXX-XXXX" autocomplete="off" style="width:100%;box-sizing:border-box;padding:12px;font-size:16px;border:2px solid #cfd6dd;border-radius:6px;text-transform:uppercase">' +
      '<button id="sg-go" style="width:100%;margin-top:10px;padding:13px;font-size:15px;font-weight:700;border:0;border-radius:6px;background:#eef2f5;color:#0d1b2a">Activate</button>' +
      '<p id="sg-msg" style="min-height:20px;font-size:14px"></p>' +
      '<p style="color:#5b6673;font-size:14px">Stuck? <a href="https://wa.me/27820829050" style="color:#007a4d">WhatsApp us on 082 082 9050</a>.</p>' +
      '</div>';
    document.body.appendChild(el);
    var msg = el.querySelector('#sg-msg');
    el.querySelector('#sg-go').onclick = function () {
      msg.style.color = '#5b6673';
      msg.textContent = 'Checking your key…';
      check(el.querySelector('#sg-key').value.trim().toUpperCase()).then(function () {
        msg.style.color = '#007a4d';
        msg.textContent = 'Activated. Opening Setwel…';
        setTimeout(function () { el.remove(); }, 800);
      }).catch(function (err) {
        msg.style.color = '#b42318';
        msg.textContent = err.message;
      });
    };
  }

  function reminder(daysLeft) {
    var bar = document.createElement('a');
    bar.href = '/pricing.html';
    bar.textContent = daysLeft + ' day' + (daysLeft === 1 ? '' : 's') + ' left in your free trial. Choose a plan →';
    bar.setAttribute('style', 'position:fixed;left:0;right:0;bottom:0;z-index:2147483646;background:#f2a900;color:#0d1b2a;text-align:center;padding:10px 16px;font:600 14px -apple-system,Segoe UI,Roboto,Arial,sans-serif;text-decoration:none');
    document.body.appendChild(bar);
    setTimeout(function () { bar.remove(); }, 12000);
  }

  function start() {
    var s = state();
    if (s.mode === 'expired') overlay(s);
    else if (s.mode === 'trial' && s.daysLeft <= 7) reminder(s.daysLeft);

    var l = licence();
    if (l && l.key && navigator.onLine && Date.now() - (l.checked || 0) > RECHECK) {
      check(l.key).then(function () {
        var g = document.getElementById('setwel-gate');
        if (g && state().mode === 'licensed') g.remove();
      }).catch(function () { /* keep the stored licence */ });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
