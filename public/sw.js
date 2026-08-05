/*
 * Minimal service worker for the AMN PWA (B2).
 *
 * V1 goal is installability + a fast repeat launch, NOT full offline. We
 * pre-cache the app shell and serve static assets cache-first; everything else
 * (and crucially every amn-api request / WebSocket) goes straight to the
 * network so live sync is never served stale. Bumping CACHE drops old assets.
 */
const CACHE = 'amn-pwa-v1';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Never intercept cross-origin traffic (amn-api, fonts, etc.) — let it hit
  // the network so realtime data is always fresh.
  if (url.origin !== self.location.origin) return;

  // Cache-first for same-origin static assets; fall back to the network and
  // cache successful responses for next time.
  event.respondWith(
    caches.match(request).then(
      (hit) =>
        hit ||
        fetch(request)
          .then((res) => {
            if (res.ok && res.type === 'basic') {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(request, copy));
            }
            return res;
          })
          .catch(() => caches.match('./index.html')),
    ),
  );
});
