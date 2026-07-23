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
    du client)             diffusion temps réel)          câblage prévu, pas encore fait)
```

- **`security-monitor`** (nouveau dépôt) — le tracker installé sur le site
  supervisé. Détection inchangée (force brute, rate limiting, injection),
  mais la destination des logs est désormais l'API centrale plutôt qu'un
  fichier local ; file d'attente locale durable en cas de panne réseau. Voir
  `security-monitor/README.md` pour l'installation et
  `security-monitor/src/transport/localQueue.js` pour le mécanisme de
  résilience (rotation atomique, récupération après crash).
- **`amn-api`** (nouveau dépôt) — API centrale Express + WebSocket. Stockage
  Postgres (Supabase) en production avec fallback SQLite en local — même
  pattern bridge que ci-dessus, appliqué cette fois à un service réseau plutôt
  qu'à un process Electron. Voir `amn-api/README.md` pour le raisonnement
  détaillé (choix de Supabase, structure de la clé API par site, jeton
  opérateur partagé).
- **`amn-desktop`** (ce projet) — reste pour l'instant sur ses données mock
  pour les sites (`src/data/mockSites.ts`). Le câblage réel (remplacer le mock
  par une consommation de `amn-api` via HTTP + WebSocket, avec le même
  raisonnement bridge que l'auth/DB ci-dessus) est prévu pour une étape
  ultérieure, une fois `amn-api` réellement déployé (Render/Railway) — voir
  `amn-api/render.yaml`, préparé mais pas encore utilisé.

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

## Migration path to the central API

Avec `amn-api` maintenant codé (mais pas déployé), le chemin de migration
initialement prévu se précise :

1. **Main process** devient la couche de cache/sync hors-ligne.
   `src/main/services.ts` gagnerait un client de sync vers `amn-api` ; le
   schéma SQLite miroir déjà une forme serveur.
2. **Auth** : à ce stade, l'auth AMN Desktop (comptes Aaron/Mohamed) et l'auth
   `amn-api` (jeton opérateur partagé + clés API par site) restent deux
   systèmes distincts et volontairement simples — fusionner les deux (SSO
   interne) n'est pas nécessaire tant que l'équipe reste à 2 personnes.
3. **Sites** : `mockSites.ts` serait remplacé par un client qui appelle
   `GET /v1/sites`, `GET /v1/sites/:id/state` et `GET /v1/sites/:id/events`
   sur `amn-api`, et ouvre une connexion `WebSocket /v1/stream` pour les mises
   à jour temps réel (alertes, heartbeats) — remplaçant le polling par un flux
   poussé, exactement ce que le WebSocket de `amn-api` a été conçu pour
   fournir.
4. **Présence** (actuellement simulée pour l'« autre » utilisateur dans
   `TeamScreen`) pourrait à terme s'appuyer sur les heartbeats `amn-api` par
   opérateur, une fois qu'un tel concept existe côté API (pas encore le cas —
   les heartbeats actuels sont par *site*, pas par opérateur).

Nothing in the UI layer needs to change for any of the above — that is the point
of the bridge.
