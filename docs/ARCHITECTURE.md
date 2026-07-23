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

## Migration path to the central API

When the central API + tracker arrive:

1. **Main process** becomes the offline cache/sync layer. `src/main/services.ts`
   gains a sync client; the SQLite schema already mirrors a server shape.
2. **Auth** moves to the server (issue a token on login); `verifyCredentials`
   calls the API and caches the session. The `AuthResult` contract is unchanged.
3. **Presence** (currently mocked for the "other" user in `TeamScreen`) is fed by
   the real presence service — swap the hard-coded `online` flag for live data.
4. **Messages** gain real-time delivery (websocket/poll) and cross-machine sync;
   `messages.list/send` keep their signatures, with a new `onNew` subscription
   added to `AmnBridge`.

Nothing in the UI layer needs to change for any of the above — that is the point
of the bridge.
