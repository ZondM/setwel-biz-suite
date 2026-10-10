/* ════════════════════════════════════════════════════════════════
   Meta Pixel + TikTok Pixel — site-wide page-view tracking.

   SETUP (one-time): replace the two placeholder IDs below with your
   real ones, then re-upload this one file — every page that includes
   it (<script src="pixels.js"></script>) picks up the change.

     Meta Pixel ID:   Meta Events Manager → Data Sources → your pixel
                       (Business Settings → facebook.com/events_manager)
     TikTok Pixel ID: TikTok Ads Manager → Assets → Events → your pixel
                       (starts with "C", e.g. CXXXXXXXXXXXXXXXXXXX)

   Until a real ID is set, that tracker stays off — no script loads,
   no network call, no console error. Safe to deploy as-is before you
   have the IDs, and safe to leave one set while the other is still
   pending.
   ════════════════════════════════════════════════════════════════ */
(function () {
  var META_PIXEL_ID = '1818113350316960';
  var TIKTOK_PIXEL_ID = 'YOUR_TIKTOK_PIXEL_ID'; // e.g. 'CXXXXXXXXXXXXXXXXXXX'

  var metaReady = META_PIXEL_ID && META_PIXEL_ID.indexOf('YOUR_') !== 0;
  var tiktokReady = TIKTOK_PIXEL_ID && TIKTOK_PIXEL_ID.indexOf('YOUR_') !== 0;

  // --- Meta Pixel (standard base code) ---
  if (metaReady) {
    !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
    n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
    document,'script','https://connect.facebook.net/en_US/fbevents.js');
    window.fbq('init', META_PIXEL_ID);
    window.fbq('track', 'PageView');
  }

  // --- TikTok Pixel (standard base code) ---
  if (tiktokReady) {
    !function (w, d, t) {
      w.TiktokAnalyticsObject = t;
      var ttq = w[t] = w[t] || [];
      ttq.methods = ['page', 'track', 'identify', 'instances', 'debug', 'on', 'off', 'once', 'ready', 'alias', 'group', 'enableCookie', 'disableCookie', 'holdConsent', 'revokeConsent', 'grantConsent'];
      ttq.setAndDefer = function (t, e) { t[e] = function () { t.push([e].concat(Array.prototype.slice.call(arguments, 0))) } };
      for (var i = 0; i < ttq.methods.length; i++) ttq.setAndDefer(ttq, ttq.methods[i]);
      ttq.instance = function (t) { for (var e = ttq._i[t] || [], n = 0; n < e.length; n++) ttq.setAndDefer(e, e[n]); return e };
      ttq.load = function (e, n) {
        var r = 'https://analytics.tiktok.com/i18n/pixel/events.js', o = n && n.partner;
        ttq._i = ttq._i || {}; ttq._i[e] = []; ttq._i[e]._u = r;
        ttq._t = ttq._t || {}; ttq._t[e] = +new Date;
        ttq._o = ttq._o || {}; ttq._o[e] = n || {};
        var s = document.createElement('script'); s.type = 'text/javascript'; s.async = !0; s.src = r + '?sdkid=' + e + '&lib=' + t;
        var a = document.getElementsByTagName('script')[0]; a.parentNode.insertBefore(s, a);
      };
      ttq.load(TIKTOK_PIXEL_ID);
      ttq.page();
    }(window, document, 'ttq');
  }

  // Exposed so a specific page (e.g. thank-you.html) can fire a
  // conversion event on top of the base PageView, without needing to
  // know whether either pixel actually loaded.
  window.setwelTrackConversion = function (eventName, params) {
    if (metaReady && window.fbq) window.fbq('track', eventName, params || {});
    if (tiktokReady && window.ttq) window.ttq.track(eventName, params || {});
  };
})();
