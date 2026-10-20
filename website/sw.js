/**
 * Minimal service worker for mobile.html.
 *
 * Two jobs: (1) satisfy Chrome's PWA installability requirement (a fetch
 * handler must exist, even a passthrough one) so the real one-tap
 * "Install app" prompt can fire instead of the manual 3-dot-menu
 * fallback already in mobile.html; (2) cache the app shell so the tool
 * still opens on a bad connection, matching "works offline" claims
 * already made elsewhere on the site.
 *
 * Deliberately does NOT cache api/scan-proxy.php, api/create-payment.php
 * or any api/ response — those must always hit the network.
 */

const CACHE_NAME = 'setwel-shell-v2';
const APP_SHELL = [
  '/mobile.html',
  '/manifest.json',
  '/setwel-logo.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never cache API calls — scanning and payments must always be live.
  if (url.pathname.startsWith('/api/')) return;

  if (event.request.method !== 'GET') return;

  // HTML (the navigation itself, or any .html fetch) must never be served
  // stale just because it's cached: a code fix shipped to the server has
  // to show up on the very next load, not "whenever the cache happens to
  // refresh." Network-first, falling back to the cached copy only when
  // genuinely offline.
  const isHTML = event.request.mode === 'navigate' || url.pathname.endsWith('.html');
  if (isHTML) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok && url.origin === self.location.origin) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Static assets (images, manifest, libraries): cache-first with a
  // background refresh, so the offline app shell still opens instantly.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((response) => {
          if (response.ok && url.origin === self.location.origin) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
