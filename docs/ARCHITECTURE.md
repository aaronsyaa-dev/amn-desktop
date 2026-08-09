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
  init (`src/main/seed.ts`, via `@edition/dbSeed`): `aaron@amn-devsec.com` and
  `mohamed@amn-devsec.com`. Seed plaintext exists only as input and is hashed
  immediately. **Édition Business : aucune graine** — pas de compte local du
  tout, la seule authentification est le compte amn-api de la cliente (voir
  « Deux éditions » en fin de document).
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

## Second workspace layer — tasks, decisions, knowledge, quotes, etc.

A second, larger batch of features follows the exact same bridge pattern
(new SQLite tables in `main/db.ts`, services in `main/services.ts`, IPC
channels in `shared/api.ts` + `main/ipc.ts` + `preload.ts`, and a matching
`localStorage`-backed implementation in `lib/bridge.ts` for the browser
fallback). Nothing here introduces a new architectural pattern — it's the
same one, repeated for eight more domains:

- **Messages** gained attachments (resized client-side to a data-URL before
  persisting — see `lib/imageResize.ts`), threaded replies, a fixed 5-emoji
  reaction set (`message_reactions` table), and pinning.
- **Tasks** (`shared_tasks`), **decisions** (`decisions`), and **knowledge
  docs** (`knowledge_docs`) are straightforward CRUD domains, each with its
  own screen (`TasksScreen`, `DecisionsScreen`, `KnowledgeScreen`).
- **Recurring checklists**: the check *content* is intentionally hardcoded
  (`src/data/checklistCatalog.ts`, no real scanning logic yet — matches what
  was asked). Only the `last_checked_at` timestamp per item is persisted
  (`checklist_state`); "due again" is computed client-side by comparing that
  timestamp against the item's frequency window.
- **Learning goals** (`learning_goals`) and **objectives** (`objectives`) are
  manually-edited progress trackers — no external integration, as scoped.
- **Client health score** (`lib/clientHealth.ts`) is *computed*, not stored:
  it combines the client's most recent `client_events` timestamp with the
  derived status of the sites linked to that client (`clients.linked_site_ids`,
  a JSON array of amn-api site ids — the one new column on the existing
  `clients` table). No new external data source, by design.
- **Quotes** (`quotes`) carry both a sales status (draft/sent/accepted/
  refused) and an independent payment status (unpaid/pending/paid/late), and
  are exported to a print-ready view (`assistant/QuotePrintPortal.tsx`) that
  reuses the same portal + `window.print()` pattern as the assistant's report
  export — "PDF" is "Save as PDF" in that dialog, no PDF library needed.

Every new screen (Tâches, Décisions, Connaissances, Progression) has its own
entry in `lib/transitions.ts` so it keeps a distinct "room" feel on
navigation, consistent with the rest of the app.

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

## Live shared workspace — real sync between operators (P2/P3)

The collaborative data (tasks, decisions, knowledge base, objectives, team
messages, and operator profiles) is no longer local-only: it syncs live
between Aaron and Mohamed through `amn-api`, so a change one makes appears for
the other without reloading.

### Server side (`amn-api`)

- **`shared_records`** — one generic table (Postgres/Supabase in prod, SQLite
  fallback in dev/test) keyed by `(collection, record_id)`. Each row holds the
  full domain object as JSON, an `updated_at`, and a `deleted` soft-delete
  **tombstone** (so removals propagate, not just creations).
- **`/v1/collections/:collection`** — operator-token-gated REST: `GET` lists a
  collection, `PUT /:id` upserts, `DELETE /:id` soft-deletes. Allowed
  collections are whitelisted.
- **WebSocket hub** — every write broadcasts a `record` message to all
  connected operator clients. The hub also tracks **real presence**: the WS
  handshake carries `?user=<email>` (alongside the operator `?token=`), and the
  hub maintains a per-operator connection count, broadcasting a `presence`
  snapshot on connect/disconnect. Because the operator token is shared, `user`
  is self-asserted — acceptable for a two-person internal tool, documented as
  such.
- The JSON body limit is raised to 12 MB so records carrying inline data-URL
  images (chat attachments, profile photos) sync.

### Client side (`amn-desktop`)

- **`RemoteApiClient`** (main process) / the browser-fallback remote client
  gain collection CRUD, `onRecord`, `getPresence`/`onPresence`, and
  `setIdentity(email)` — which reconnects the WebSocket with the signed-in
  operator's `?user=` so presence is real. In Electron the operator token still
  never leaves the main process.
- **`SyncContext`** (`src/state/SyncContext.tsx`) is the source of truth for the
  UI. It keeps a per-collection **localStorage mirror** for instant, offline
  reads; on connect it reconciles each collection against `amn-api`
  (last-writer-wins by `updatedAt`); it applies live `record` pushes; and it
  writes optimistically to the mirror then to the server. When `amn-api` is
  unconfigured it runs standalone off the mirror, so the app still works
  offline / in dev. Records use string ids and a `data` payload; screens consume
  them via `useCollection<T>()` / `useMessages()`.
- **Profiles** (`ProfilesContext`) are a synced collection too, so a photo one
  operator uploads (Settings) is visible to the other everywhere via
  `UserAvatar` (messages, task assignees, decision authors, presence, the
  account button). Each client only ever seeds *its own* profile row, never
  overwriting the other's.
- **Presence** in `TeamScreen` is now driven by real WebSocket connections
  (`SyncContext.onlineEmails`) plus the profile's custom presence text — not a
  client-side mock.

Deliberately still local (per-machine): notification preferences, the password
(local auth), and `clients`/`quotes` (their integer ids are per-machine; the
same generic `shared_records` mechanism can extend to them later, keyed by a
stable string id).

### Deploying the sync layer

`amn-api` must be redeployed with this change, and the new `shared_records`
table created in Supabase — run `amn-api/src/db/schema.sql` in the Supabase SQL
editor (the SQLite dev fallback creates it automatically). `amn-desktop`
consumes it once `AMN_API_URL` + `AMN_API_OPERATOR_TOKEN` are set in the main
process (production) — see `.env.example`.

## Native notifications, welcome screen (P4/P5)

- **`system.notify`** — a fire-and-forget bridge call backed by the Electron
  main-process `Notification` (best-effort Web Notifications in the browser
  fallback). The renderer's `NotificationsManager` decides *when* to fire — on a
  critical alert, a site going offline, an incoming message, or a task assigned
  to you — honouring the per-event toggles in Settings, baselining against
  startup history so there's no spam, and suppressing self-originated events.
- **Welcome screen** — `WelcomeOverlay` shows once per calendar day on launch
  (localStorage high-water mark), speaks the greeting via the free
  `SpeechSynthesis` Web API, and is skippable by click/keypress.

## Deux éditions, un seul dépôt (AMN Business)

L'application se construit désormais en deux éditions : `internal` (AMN
Desktop, ce que font tourner Aaron et Mohamed) et `business` (AMN Business,
livré aux organisations clientes). Le mécanisme complet, les coutures
`@edition/*` et la marche à suivre pour livrer une cliente sont documentés dans
`docs/BUSINESS.md`. Deux points touchent l'architecture décrite plus haut et
méritent d'être ici :

**L'authentification n'est plus locale.** Le pont `auth.login` (SQLite +
bcrypt) reste, mais il n'est plus le chemin principal : la connexion passe
d'abord par `POST /v1/auth/login` d'amn-api, qui rend une session nominative
portant l'organisation. Cette session devient le justificatif de TOUTES les
requêtes et de la WebSocket — c'est elle, et non un jeton partagé embarqué dans
le build, qui détermine les données visibles. Le compte local ne subsiste que
comme repli hors-ligne dans l'édition interne ; l'édition Business n'en a
aucun.

Conséquence sur `remoteConfig.ts` : `isRemoteConfigured()` n'exige plus le
jeton opérateur, mais « une URL ET un justificatif ». Une installation cliente
est donc « non configurée » jusqu'à la connexion, puis configurée. C'est voulu
— la synchronisation ne doit pas démarrer avant de savoir POUR QUELLE
organisation elle démarre.

**Le client amn-api est devenu un transport.** `RemoteApiClient` ne connaît
plus le nom des trames produit : il expose `onFrame(type, listener)` et
`sendFrame(frame)`, et ce sont les modules d'édition qui déclarent
`scan:progress`, `comply:progress`, `signal`… Outre la propreté, c'est ce qui
fait que ces noms n'apparaissent pas dans le bundle d'une édition qui n'a pas
ces produits.
