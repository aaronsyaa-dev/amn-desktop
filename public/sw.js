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
 *
 * v3 fixes the bug that made every earlier deploy invisible: v1/v2 were
 * cache-first for EVERY same-origin GET, including page navigations. Since
 * index.html is precached, the browser kept being served the very first
 * index.html it ever cached — which points at that build's hashed asset names,
 * themselves cached — so the app was permanently frozen on the first deployed
 * version. Redeploys (new env vars, bug fixes) never took effect, which is why
 * the sync badge stayed on "Local" even after VITE_AMN_API_URL was configured.
 * Fix: navigations are network-first (cache is only an offline fallback), while
 * hashed build assets stay cache-first — safe, because their filename changes
 * whenever their content does.
 *
 * v4 adds Web Push handling. A closed PWA has no page and no WebSocket, so the
 * service worker is the ONLY thing that can be woken to announce an incoming
 * call — which is why a call to a phone previously produced nothing at all.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * v5 — LA MISE À JOUR CESSE D'ÊTRE MUETTE (BLOC 4)
 *
 * Jusqu'ici : `skipWaiting()` dès l'installation. Le nouveau worker prenait
 * donc la main IMMÉDIATEMENT — sur une page qui continuait, elle, de faire
 * tourner l'ANCIEN JavaScript. La page n'était jamais rechargée, et personne
 * n'était prévenu.
 *
 * Ce que ça donnait sur un téléphone : une PWA laissée ouverte gardait
 * l'ancienne version des jours durant. Aucun message, aucun geste possible —
 * la seule façon d'avoir la nouvelle était de fermer complètement
 * l'application, ce que personne ne fait, et ce que rien n'indiquait.
 *
 * Le worker attend donc désormais, et c'est la PAGE qui décide du moment :
 *
 *   1. le nouveau worker s'installe et reste en attente (`waiting`) ;
 *   2. la page le voit et propose « une nouvelle version est prête » ;
 *   3. sur acceptation, elle lui envoie `SKIP_WAITING` ;
 *   4. il prend la main, `controllerchange` se déclenche, la page recharge.
 *
 * L'ordre compte : recharger APRÈS la prise de contrôle garantit que le
 * JavaScript rechargé et le worker qui le sert viennent du même build. Le
 * comportement d'avant ne le garantissait pas — c'était sans conséquence ici
 * (aucun découpage dynamique du bundle, vérifié), mais c'était vrai par
 * chance, pas par construction.
 */
/*
 * ─────────────────────────────────────────────────────────────────────────────
 * v6 — L'IMPASSE QUE v5 A CRÉÉE, ET LES FICHIERS QUI NE POUVAIENT PAS CHANGER
 *
 * Remonté en testant : « la version mobile n'est pas à jour du tout, ni icône
 * ni contenu ». Deux causes, et la première est de mon fait.
 *
 * ## 1. Une politesse qui bloque pour toujours
 *
 * v5 a retiré `skipWaiting()` de l'installation — pour de bonnes raisons : un
 * worker qui prend la main sur une page dont le JavaScript est resté à
 * l'ancienne version est un défaut. Le nouveau worker attend donc que la PAGE
 * lui dise d'y aller.
 *
 * Sauf que ça suppose une page qui SAIT le dire. Sur un téléphone dont le
 * worker en place est antérieur à v5, la page servie est celle de ce
 * build-là : elle ne contient pas `PwaUpdateNotice`, donc elle n'enverra
 * jamais `SKIP_WAITING`. Le nouveau worker attend indéfiniment, l'ancien
 * continue de servir — et si cet ancien est v1 ou v2, il sert TOUT depuis son
 * cache, y compris `index.html`. L'application est alors figée sur le premier
 * build jamais installé, définitivement, sans aucun geste possible.
 *
 * C'est exactement « pas à jour du tout ». Et c'est irrattrapable depuis
 * l'appareil : il n'y a pas d'écran à toucher pour en sortir.
 *
 * Le worker prend donc la main TOUT SEUL, mais dans un seul cas : quand le
 * worker qu'il remplace est antérieur à v5, c'est-à-dire quand la page en
 * place ne sait pas demander. Face à un worker v5 ou plus récent, il attend
 * comme avant — la politesse de v5 vaut pour tous ceux qui peuvent répondre.
 *
 * ## 2. Des fichiers dont le nom ne change jamais
 *
 * Les icônes et le manifeste étaient servis CACHE-FIRST. Ils ne portent pas
 * d'empreinte dans leur nom — `icon.png` reste `icon.png` — donc leur version
 * en cache ne pouvait être remplacée que par un changement de `CACHE`. Entre
 * deux, une icône refaite ou un nom de produit corrigé dans le manifeste
 * restaient invisibles sur un téléphone qui avait déjà installé l'application.
 *
 * Ils passent en réseau d'abord, cache en secours. Ils sont petits, et c'est
 * la seule façon qu'un fichier au nom fixe cesse d'être figé.
 */
const CACHE = 'amn-pwa-v6';
const GENERATION = 6;
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon.png'];

/** La génération v5 est la première dont la page sait réclamer la mise à jour. */
const PREMIERE_GENERATION_QUI_SAIT_DEMANDER = 5;

/**
 * Le worker qu'on remplace savait-il se faire réclamer la main ?
 *
 * On le lit dans les caches laissés en place : `amn-pwa-v4` dit une page qui
 * n'a pas `PwaUpdateNotice`, donc qui n'enverra jamais `SKIP_WAITING`.
 */
async function pageSaitDemander() {
  const noms = (await caches.keys()).filter((n) => n.startsWith('amn-pwa-v') && n !== CACHE);
  if (noms.length === 0) return true; // première installation : rien à remplacer
  return noms.every((n) => {
    const g = Number(n.slice('amn-pwa-v'.length));
    return Number.isFinite(g) && g >= PREMIERE_GENERATION_QUI_SAIT_DEMANDER;
  });
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await cache.addAll(SHELL);
      /*
        LA SEULE PRISE DE MAIN AUTOMATIQUE, ET ELLE EST CONDITIONNELLE.

        Voir le préambule v6 : sans elle, un téléphone dont le worker est
        antérieur à v5 reste figé pour toujours, parce que sa page ne sait pas
        envoyer `SKIP_WAITING`. Face à un worker v5 ou plus, on attend comme
        v5 l'a voulu — c'est `check:updates` qui vérifie que cette condition
        est bien là et qu'elle n'a pas été élargie.
      */
      if (!(await pageSaitDemander())) await self.skipWaiting();
    })(),
  );
});

/**
 * Le seul message que ce worker accepte : « tu peux prendre la main ».
 *
 * Envoyé par la page quand quelqu'un a accepté la mise à jour. On ne l'exécute
 * jamais de nous-mêmes — c'est tout l'intérêt de v5.
 */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
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

  const cachePut = (req, res) => {
    if (res.ok && res.type === 'basic') {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy));
    }
    return res;
  };

  // Page navigations: NETWORK-FIRST. The freshly deployed index.html must win,
  // otherwise the app is pinned forever to the first cached build. The cached
  // copy is kept strictly as an offline fallback.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => cachePut('./index.html', res))
        .catch(() => caches.match('./index.html')),
    );
    return;
  }

  /*
    LES FICHIERS DONT LE NOM NE CHANGE JAMAIS : RÉSEAU D'ABORD.

    `icon.png` reste `icon.png`, `manifest.webmanifest` reste
    `manifest.webmanifest`. Servis cache-first, ils ne pouvaient être remplacés
    que par un changement de `CACHE` — donc une icône refaite ou un nom de
    produit corrigé restaient invisibles sur un téléphone déjà installé, ce qui
    est précisément ce qui a été remonté. Ils sont petits ; le réseau d'abord
    avec le cache en secours ne coûte rien et supprime la classe entière.
  */
  if (/\/(manifest\.webmanifest|[\w-]*icon[\w-]*\.png)$/.test(url.pathname)) {
    event.respondWith(
      fetch(request)
        .then((res) => cachePut(request, res))
        .catch(() => caches.match(request)),
    );
    return;
  }

  // Everything else (hashed build assets): cache-first is safe because
  // a content change produces a new filename, so a stale entry is never served
  // for new content. On a genuine network failure the request fails for real —
  // it must never be silently answered with index.html's HTML, which the
  // browser would refuse to apply as CSS (unstyled page) or run as a module
  // script (blank page). See the "Dépannage" section of docs/PWA.md.
  event.respondWith(
    caches.match(request).then(
      (hit) =>
        hit ||
        fetch(request)
          .then((res) => cachePut(request, res))
          .catch(() => {
            throw new Error(`amn-pwa sw: network fetch failed for ${request.url}`);
          }),
    ),
  );
});


/* ------------------------------ Web Push (A.3) ----------------------------- */

/**
 * A push arrives here even when the app is closed — this is the whole point.
 *
 * Calls get treated differently from everything else: they stay on screen until
 * acted on (`requireInteraction`), they vibrate on a ring-like pattern rather
 * than a single buzz, and they share a tag so a second signal for the same call
 * replaces the first instead of stacking. A missed call is time-sensitive in a
 * way a synced note is not.
 */
self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: '%AMN_PRODUCT_NAME%', body: event.data ? event.data.text() : '' };
  }

  const isCall = payload.kind === 'call';
  const title = payload.title || '%AMN_PRODUCT_NAME%';
  const options = {
    body: payload.body || '',
    icon: './icon.png',
    badge: './icon.png',
    tag: isCall ? `call-${payload.callId || 'incoming'}` : payload.kind || 'amn',
    renotify: true,
    requireInteraction: isCall,
    // Long-short-long reads as a ring; a single buzz reads as a message.
    vibrate: isCall ? [400, 150, 400, 150, 400] : [180],
    data: { kind: payload.kind || 'info', from: payload.from || '', callId: payload.callId || '' },
    actions: isCall ? [{ action: 'answer', title: 'Répondre' }] : [],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

/**
 * Tapping the notification focuses an already-open window when there is one,
 * and only opens a new one otherwise — so answering a call never ends up in a
 * second instance fighting the first for the microphone.
 */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.kind === 'call' ? './#/team' : './';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) {
          client.postMessage({ type: 'amn:notification-click', data: event.notification.data });
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
