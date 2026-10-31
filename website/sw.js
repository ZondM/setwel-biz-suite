// Setwel service worker. The app registers /sw.js, so it lives at the site root,
// but it only handles the phone app (/app/ and the database engine) so it can work offline.
// Website pages are never cached here, so site updates show straight away.
const CACHE = 'setwel-app-v2';
const CORE = ['/app/', '/app/index.html', '/app/manifest.json', '/sql-wasm.wasm', '/assets/app-gate.js', '/app/icons/icon-192.png', '/app/icons/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

function isApp(url) {
  return url.origin === self.location.origin &&
    (url.pathname.startsWith('/app/') || url.pathname === '/sql-wasm.wasm' || url.pathname === '/assets/app-gate.js');
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || !isApp(url)) return;

  // Hashed build files never change, so cache first. Everything else: network first, cache when offline.
  if (url.pathname.startsWith('/app/assets/')) {
    event.respondWith(
      caches.match(event.request).then((hit) => hit || fetch(event.request).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(event.request, copy));
        }
        return res;
      }))
    );
    return;
  }
  event.respondWith(
    fetch(event.request).then((res) => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(event.request, copy));
      }
      return res;
    }).catch(() => caches.match(event.request).then((hit) => hit || caches.match('/app/index.html')))
  );
});
