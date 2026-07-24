# Architecture — auth, local storage & the bridge

This document records the technical choices behind authentication and local
persistence, and how they are meant to evolve when the central API is wired up.

## The bridge pattern (key idea)

The renderer never imports Electron, the database, or Node modules directly. It
talks to a single abstraction, the **bridge** (`src/lib/bridge.ts`), whose shape
is defined once in `src/shared/api.ts` (`AmnBridge`).

```
renderer ──> bridge() ──┬── window.amn        (Electron: preload → IPC → main → SQLite)
                        └── browser fallback  (bcryptjs + localStorage)
```

- **In Electron**, `window.amn` is exposed by the preload script
  (`src/preload.ts`) via `contextBridge`. Each method does an `ipcRenderer.invoke`
  to a handler in the main process (`src/main/ipc.ts`), which runs the real
  SQLite + bcrypt logic.
- **In a plain browser** (headless verification, vanilla `vite` dev), the same
  interface is fulfilled by a local fallback that still performs **real bcrypt
  verification** against committed hashes and stores messages in `localStorage`.

Because both environments satisfy the same typed contract, the UI is identical
and testable in a browser, and **swapping the local backend for the central API
is a change confined to `bridge.ts` (or the main-process services)** — no UI
changes.

## Authentication

- **Storage**: `better-sqlite3` (synchronous, file-backed, native module). The
  DB file lives at `app.getPath('userData')/amn.db`, so it persists across
  sessions. `@electron-forge/plugin-auto-unpack-natives` unpacks the native
  binary when packaged.
- **Hashing**: `bcryptjs` (pure-JS bcrypt) — chosen over native `bcrypt`/argon2
  to avoid a second native build in the toolchain. Cost factor 10. Passwords are
  **never stored in clear**; only the hash is persisted.
- **Accounts**: no open sign-up yet. Two accounts are auto-seeded on first DB
  init (`src/main/seed.ts`): `aaron@amn-devsec.com` and
  `mohamed@amn-devsec.com`. Seed plaintext exists only as input and is hashed
  immediately.
- **Session**: on success the renderer stores the returned `User` in
  `localStorage` (`AuthContext`) to keep the user signed in across reloads. This
  is a convenience cache, not the source of truth.

> **Dev credentials** (change before any real deployment): password `AmnQG-2026`
> for both seeded accounts. To change them, edit `DEFAULT_PASSWORD` in
> `src/main/seed.ts` and delete `amn.db`, or update the row hashes directly.

### Schema

```sql
users(id, email UNIQUE, name, password_hash, created_at)
messages(id, author_email, author_name, body, created_at)
clients(id, name, company, status, email, phone, notes, image_data_url,
        created_at, updated_at)
client_events(id, client_id, title, detail, date)
```

`author_name` is denormalised onto `messages` so the feed renders without a
join. Timestamps are ISO strings. Ids are stable integers — close to what a
server would expose. Client avatars are stored inline as data-URLs
(`image_data_url`) for now; a real deployment would move these to object
storage and keep only a reference.

## Team messaging & clients

Messages and clients both go through the bridge (SQLite in Electron,
`localStorage` fallback in browser). `@site` mentions are parsed at render time
(`src/lib/mentions.ts`) into clickable chips that open the site panel; the
composer offers an autocomplete when typing `@`.

Clients use `bridge().clients` (`list` / `create` / `update` / `addEvent`).
Notes autosave (debounced `update`), the status selector and inline fields
persist immediately, and events append to `client_events`. The browser
fallback seeds the same two clients as the SQLite seed so both environments
present identical data.

## Écosystème AMN — vue d'ensemble (mis à jour)

Le système compte désormais trois projets séparés, chacun avec son propre
dépôt Git :

```
security-monitor  --(HTTPS, X-API-Key)-->  amn-api  --(WebSocket, OPERATOR_TOKEN)-->  amn-desktop
   (sur le site           (ingestion, stockage,          (consomme en temps réel —
    du client)             diffusion temps réel)          câblé et en production)
```

- **`security-monitor`** (dépôt séparé) — le tracker installé sur le site
  supervisé. Détection inchangée (force brute, rate limiting, injection),
  mais la destination des logs est désormais l'API centrale plutôt qu'un
  fichier local ; file d'attente locale durable en cas de panne réseau. Voir
  `security-monitor/README.md` pour l'installation et
  `security-monitor/src/transport/localQueue.js` pour le mécanisme de
  résilience (rotation atomique, récupération après crash).
- **`amn-api`** (dépôt séparé) — API centrale Express + WebSocket, déployée en
  production sur Render (`https://amn-api.onrender.com`), stockage Postgres
  (Supabase, plan gratuit) avec fallback SQLite en local pour le dev/tests —
  même pattern bridge que ci-dessus, appliqué cette fois à un service réseau
  plutôt qu'à un process Electron. Voir `amn-api/README.md` pour le
  raisonnement détaillé (choix de Supabase, structure de la clé API par site,
  jeton opérateur partagé).
- **`amn-desktop`** (ce projet) — câblé sur `amn-api` : le mock
  (`src/data/mockSites.ts`) a été supprimé, les sites/événements viennent
  désormais en direct de l'API centrale. Voir « Câblage à l'API centrale »
  ci-dessous pour le détail de l'implémentation.

### Nouveauté : le catalogue Tracker

Le nouvel onglet « Tracker » (`src/screens/TrackerScreen.tsx`,
`src/data/trackerCatalog.ts`) est un catalogue statique (pas de DB) présentant
une offre en 3 paliers : **AMN Sentinel** (disponible — correspond
exactement à `security-monitor`), **AMN Sentinel+** (à venir — détection par
anomalie, réputation IP, anti-bot, webhooks), **AMN Suite** (verrouillé —
analytics business, fraude paiement, disponibilité active, scan de
dépendances, rapports générés par l'assistant IA). Seul le premier palier est
déverrouillé car c'est le seul réellement implémenté ; le raisonnement complet
de la progression est documenté en commentaire en tête de
`trackerCatalog.ts`.

## Câblage à l'API centrale

`amn-desktop` est câblé sur `amn-api` en suivant exactement le même
raisonnement bridge que l'auth/DB locale (voir plus haut), avec une seule
différence de posture : **le jeton opérateur ne quitte jamais le process
main** en production.

```
renderer ──> bridge().remote ──┬── window.amn.remote  (Electron: preload → IPC → main → RemoteApiClient → amn-api)
                                 └── browser fallback   (fetch + WebSocket direct, jeton via VITE_*, dev/test only)
```

- **Configuration** (`src/main/remoteConfig.ts`) : `AMN_API_URL` et
  `AMN_API_OPERATOR_TOKEN`, lus depuis `.env` via `dotenv/config` dans le
  process main uniquement. `isRemoteConfigured()` gate le démarrage du client
  — sans ces deux variables, l'app tourne toujours (mode « non configuré »,
  visible dans l'UI via `RemoteConnectionStatus = 'unconfigured'`) plutôt que
  de crasher.
- **`RemoteApiClient`** (`src/main/remoteApi.ts`, process main uniquement) —
  HTTP pour les requêtes ponctuelles (`listSites`, `getSiteEvents`,
  `registerSite`) et une connexion `WebSocket /v1/stream?token=...` pour le
  flux temps réel, avec reconnexion à backoff exponentiel
  (`[1s, 2s, 5s, 10s, 20s, 30s]`). C'est la seule pièce de code qui connaît le
  jeton opérateur en production.
- **IPC** (`src/main/ipc.ts`) expose `remote:*` (list/get/register/status) en
  `ipcMain.handle`, et relaie les événements du client (`onEvent`,
  `onStatusChange`) vers tous les `BrowserWindow` via `webContents.send`.
- **Preload** (`src/preload.ts`) expose `window.amn.remote` avec les mêmes
  signatures que la partie « local » du bridge (`AmnBridge.remote` dans
  `src/shared/api.ts`), y compris `onEvent`/`onConnectionStatusChange` qui
  renvoient un désabonnement (`ipcRenderer.removeListener`).
- **Fallback navigateur** (`src/lib/bridge.ts`, `createBrowserRemote()`) —
  utilisé en dev/test headless (pas d'Electron). Parle directement à `amn-api`
  en HTTP/WebSocket depuis le renderer, avec le jeton lu depuis
  `import.meta.env.VITE_AMN_API_URL` / `VITE_AMN_API_OPERATOR_TOKEN`.
  **Ces variables `VITE_*` finissent dans le bundle du renderer — jamais un
  jeton de production ici**, uniquement une clé de dev/test jetable. Voir
  `.env.example` pour l'avertissement explicite.
- **Statut dérivé** (`src/lib/siteStatus.ts`) — `amn-api` ne distingue que
  `online`/`unknown` côté site ; le desktop dérive un statut plus riche
  (`unknown` / `online` / `degraded` / `offline`) côté client, à partir de
  `lastSeenAt`/`lastAlertAt` (site considéré hors-ligne après 90s sans
  heartbeat, dégradé si une alerte est survenue dans les 15 dernières
  minutes).
- **État global** (`src/state/RemoteSitesContext.tsx`, `RemoteSitesProvider` /
  `useRemoteSites()`) — même pattern Context que `AuthProvider`,
  `AssistantProvider`, etc. Maintient la liste des sites, un cache
  d'événements par site (`ensureEventsLoaded` fire-and-forget,
  `loadEvents` version *awaited* utilisée par l'assistant IA pour éviter de
  raisonner sur un cache pas encore rempli), le statut de connexion, et
  applique les pushes WebSocket en direct sur le state React. Un intervalle
  de 15s ré-évalue le statut dérivé pour les transitions purement temporelles
  (ex. un site qui bascule hors-ligne sans nouvel événement).
- **UI** : `SitesDashboardScreen`, `HomeScreen`, `SiteDetailPanel`,
  `NotificationCenter`, `CommandPalette`, `TeamScreen` (mentions `@site`) et
  l'assistant IA (`AssistantContext`/`AssistantPanel`, `engine.ts`,
  `mockData.ts`, `reportContent.ts`) consomment tous `useRemoteSites()`.
  `src/data/mockSites.ts` et `src/types/site.ts` ont été supprimés — plus
  aucune donnée de site n'est fabriquée en dur dans l'app.
- **Analytics business** (revenus, tendances) qui existaient dans le mock
  n'ont pas d'équivalent réel côté `amn-api` aujourd'hui : plutôt que
  d'inventer des chiffres, l'UI les remplace par une mention explicite
  (« disponible avec le palier AMN Suite ») — honnête sur ce qui est
  réellement mesuré vs. sur la feuille de route.
- **Auth** : l'auth AMN Desktop (comptes Aaron/Mohamed, SQLite locale) et
  l'auth `amn-api` (jeton opérateur partagé + clés API par site) restent deux
  systèmes distincts et volontairement simples — fusionner les deux (SSO
  interne) n'est pas nécessaire tant que l'équipe reste à 2 personnes.
- **Présence** (actuellement simulée pour l'« autre » utilisateur dans
  `TeamScreen`) reste hors périmètre : `amn-api` ne modélise pas encore de
  heartbeat par opérateur (uniquement par site).

Rien dans la couche UI n'a eu besoin de changer de forme pour ce câblage —
c'est tout l'intérêt du bridge : les écrans consomment `useRemoteSites()`
exactement comme ils consommaient le mock avant.
