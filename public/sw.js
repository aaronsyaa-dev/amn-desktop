/*
 * Minimal service worker for the AMN PWA (B2).
 *
 * V1 goal is installability + a fast repeat launch, NOT full offline. We
 * pre-cache the app shell and serve static assets cache-first; everything else
 * (and crucially every amn-api request / WebSocket) goes straight to the
 * network so live sync is never served stale. Bumping CACHE drops old assets
 * (also required whenever this file's fetch logic changes, since browsers only
 * re-run install/activate when the SW script's bytes change).
 *
 * v2 fixes a real bug found in production: on a failed same-origin GET, v1
 * fell back to the cached index.html for EVERY resource, not just page
 * navigations. A transient network hiccup fetching a hashed asset (very
 * plausible right after a redeploy, while a CDN edge is still propagating)
 * made the SW hand back index.html's HTML content, with a 200 status, in
 * place of that CSS or JS file. The browser silently refuses to apply HTML as
 * a stylesheet (unstyled page, no console error) or to execute it as a module
 * script (React never mounts — blank page) — one bug, two symptoms depending
 * on which asset's fetch happened to fail. Fix: the index.html fallback now
 * only applies to actual page navigations; a failed asset fetch fails for
 * real instead of being silently swapped for the wrong content.
 */
const CACHE = 'amn-pwa-v2';
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

  // Cache-first for same-origin requests; fall back to the network and cache
  // successful responses for next time. On a genuine network failure, only
  // page navigations fall back to the cached shell (the classic "offline still
  // opens the app" behaviour) — a failed asset request (CSS/JS/image) must
  // fail for real, never be silently replaced by index.html's HTML content.
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
          .catch(() => {
            if (request.mode === 'navigate') return caches.match('./index.html');
            throw new Error(`amn-pwa sw: network fetch failed for ${request.url}`);
          }),
    ),
  );
});
