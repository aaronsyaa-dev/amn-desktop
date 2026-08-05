import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { bridge } from '../lib/bridge';
import { useAuth } from '../auth/AuthContext';
import type {
  PresenceEntry,
  RemoteConnectionStatus,
  RemoteRecord,
  SyncedCollection,
} from '../shared/api';

/**
 * Live-synced shared workspace.
 *
 * Collaborative collections (tasks, decisions, knowledge, objectives,
 * messages, profiles) are synced between operators through amn-api:
 *   - amn-api (Supabase) is the durable, shared source of truth.
 *   - A per-collection localStorage "mirror" gives instant, offline-capable
 *     reads and survives restarts.
 *   - Writes go to the mirror immediately (optimistic) and to amn-api; every
 *     amn-api write is broadcast back over the WebSocket as a `record` message,
 *     so the *other* operator's app updates without reloading.
 *   - Conflicts resolve last-writer-wins by `updatedAt` (server timestamps win
 *     because they're assigned after the client's optimistic one).
 *
 * When amn-api is not configured the mirror is used standalone (no sharing) so
 * the app still works offline / in dev.
 */

const SYNCED_COLLECTIONS: SyncedCollection[] = [
  'tasks',
  'decisions',
  'knowledge',
  'objectives',
  'messages',
  'profiles',
  'notes',
];

const MIRROR_PREFIX = 'amn.sync.';

type CollectionMap = Record<string, RemoteRecord>; // id -> record (incl. tombstones)
type Store = Record<string, CollectionMap>; // collection -> map

export function uid(prefix = 'r'): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Reserved key stamped into every record's `data` at write time with the email
 * of the operator who made the write. It travels inside the opaque `data` blob
 * (no amn-api change needed) and lets features attribute a record to its author
 * durably — across restarts and offline catch-up — where the domain shape has
 * no author field of its own (read receipts, activity feed, unseen badges).
 * Typed consumers via `useCollection<T>` never see it (it's outside T).
 */
export const WRITER_KEY = '_by';

/** Reads the durable writer email stamped on a record, if any. */
export function recordWriter(data: Record<string, unknown>): string | null {
  const v = data[WRITER_KEY];
  return typeof v === 'string' && v ? v : null;
}

/** Strips the synthetic id/updatedAt back off a decoded record for writing. */
export function stripMeta<T extends { id: string; updatedAt: string }>(
  record: T,
): Record<string, unknown> {
  const rest = { ...record } as Record<string, unknown>;
  delete rest.id;
  delete rest.updatedAt;
  return rest;
}

function readMirror(collection: string): RemoteRecord[] {
  try {
    const raw = window.localStorage.getItem(MIRROR_PREFIX + collection);
    return raw ? (JSON.parse(raw) as RemoteRecord[]) : [];
  } catch {
    return [];
  }
}

function writeMirror(collection: string, records: RemoteRecord[]): void {
  try {
    window.localStorage.setItem(MIRROR_PREFIX + collection, JSON.stringify(records));
  } catch {
    /* quota — ignore, memory state stays authoritative for this session */
  }
}

function toMap(records: RemoteRecord[]): CollectionMap {
  const map: CollectionMap = {};
  for (const r of records) map[r.id] = r;
  return map;
}

/** Keeps the record with the newer updatedAt. */
function mergeRecord(map: CollectionMap, record: RemoteRecord): CollectionMap {
  const existing = map[record.id];
  if (existing && existing.updatedAt > record.updatedAt) return map;
  return { ...map, [record.id]: record };
}

interface SyncContextValue {
  ready: boolean;
  configured: boolean;
  connectionStatus: RemoteConnectionStatus;
  onlineEmails: Set<string>;
  /** Live, non-deleted records of a collection. */
  useRecords: (collection: SyncedCollection) => RemoteRecord[];
  upsert: (collection: SyncedCollection, id: string, data: Record<string, unknown>) => Promise<void>;
  remove: (collection: SyncedCollection, id: string) => Promise<void>;
  /** True if this record id was written by *this* client (to suppress self-notifications). */
  isLocalWrite: (collection: SyncedCollection, id: string) => boolean;
  /**
   * Subscribe to live changes pushed over the WebSocket by the OTHER operator
   * (self-writes are filtered out). Returns an unsubscribe fn. Used to confirm,
   * discreetly, that sync is working (Partie 3).
   */
  onRemoteChange: (cb: (change: RemoteChange) => void) => () => void;
}

export interface RemoteChange {
  collection: SyncedCollection;
  id: string;
  deleted: boolean;
  data: Record<string, unknown>;
}

const SyncContext = createContext<SyncContextValue | undefined>(undefined);

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [store, setStore] = useState<Store>(() => {
    const initial: Store = {};
    for (const c of SYNCED_COLLECTIONS) initial[c] = toMap(readMirror(c));
    return initial;
  });
  const storeRef = useRef(store);
  storeRef.current = store;

  const [ready, setReady] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<RemoteConnectionStatus>('connecting');
  const [onlineEmails, setOnlineEmails] = useState<Set<string>>(new Set());
  const localWrites = useRef<Set<string>>(new Set());
  // Current operator email, kept in a ref so `upsert` (which stamps authorship)
  // stays referentially stable across sign-in changes.
  const emailRef = useRef(user?.email);
  emailRef.current = user?.email;
  const remoteChangeSubs = useRef<Set<(c: RemoteChange) => void>>(new Set());
  const onRemoteChange = useCallback((cb: (c: RemoteChange) => void) => {
    remoteChangeSubs.current.add(cb);
    return () => remoteChangeSubs.current.delete(cb);
  }, []);

  // Apply a batch of records to a collection: merge, persist mirror, set state.
  const applyRecords = useCallback((collection: string, incoming: RemoteRecord[]) => {
    setStore((prev) => {
      let map = prev[collection] ?? {};
      for (const r of incoming) map = mergeRecord(map, r);
      const next = { ...prev, [collection]: map };
      writeMirror(collection, Object.values(map));
      return next;
    });
  }, []);

  // Tell the main process / remote client who is signed in (presence + attribution).
  useEffect(() => {
    bridge().remote.setIdentity(user?.email ?? null);
  }, [user?.email]);

  // Initial load + live subscriptions.
  useEffect(() => {
    let active = true;
    const remote = bridge().remote;
    let lastStatus: RemoteConnectionStatus = 'connecting';

    // Full catch-up pull: reconciles every collection + presence. Runs on
    // startup and again whenever the connection is (re)established, so any
    // changes the other operator made while we were offline are picked up.
    const pullAll = async () => {
      await Promise.all(
        SYNCED_COLLECTIONS.map(async (collection) => {
          try {
            const records = await remote.listRecords(collection);
            if (active) applyRecords(collection, records);
          } catch {
            /* keep mirror data on failure */
          }
        }),
      );
      const presence = await remote.getPresence().catch(() => [] as PresenceEntry[]);
      if (active) setOnlineEmails(new Set(presence.filter((p) => p.online).map((p) => p.email)));
    };

    (async () => {
      const status = await remote.getConnectionStatus().catch(() => 'unconfigured' as const);
      if (!active) return;
      lastStatus = status;
      const isConfigured = status !== 'unconfigured';
      setConfigured(isConfigured);
      setConnectionStatus(status);
      if (isConfigured) await pullAll();
      if (active) setReady(true);
    })();

    const offRecord = remote.onRecord((record) => {
      if (!active) return;
      applyRecords(record.collection, [record]);
      // Notify subscribers only for changes made by the OTHER operator — a
      // live WS push whose id we didn't write ourselves this session.
      if (!localWrites.current.has(`${record.collection}:${record.id}`)) {
        for (const cb of remoteChangeSubs.current) {
          cb({
            collection: record.collection as SyncedCollection,
            id: record.id,
            deleted: record.deleted,
            data: record.data,
          });
        }
      }
    });
    const offStatus = remote.onConnectionStatusChange((s) => {
      if (!active) return;
      const reconnected = s === 'online' && lastStatus !== 'online';
      lastStatus = s;
      setConnectionStatus(s);
      if (reconnected) pullAll(); // resync cleanly on reconnection
    });
    const offPresence = remote.onPresence((users) => {
      if (active) setOnlineEmails(new Set(users.filter((p) => p.online).map((p) => p.email)));
    });

    return () => {
      active = false;
      offRecord();
      offStatus();
      offPresence();
    };
  }, [applyRecords]);

  const upsert = useCallback(
    async (collection: SyncedCollection, id: string, data: Record<string, unknown>) => {
      localWrites.current.add(`${collection}:${id}`);
      // Stamp the writer so every collection carries durable authorship.
      const stamped = emailRef.current
        ? { ...data, [WRITER_KEY]: emailRef.current }
        : data;
      const optimistic: RemoteRecord = {
        id,
        collection,
        data: stamped,
        updatedAt: new Date().toISOString(),
        deleted: false,
      };
      applyRecords(collection, [optimistic]); // instant local update
      if (configured) {
        try {
          const saved = await bridge().remote.upsertRecord(collection, id, stamped);
          applyRecords(collection, [saved]); // adopt server timestamp
        } catch {
          /* offline: mirror keeps the optimistic record; will re-sync later */
        }
      }
    },
    [applyRecords, configured],
  );

  const remove = useCallback(
    async (collection: SyncedCollection, id: string) => {
      const tombstone: RemoteRecord = {
        id,
        collection,
        data: {},
        updatedAt: new Date().toISOString(),
        deleted: true,
      };
      applyRecords(collection, [tombstone]);
      if (configured) {
        try {
          await bridge().remote.deleteRecord(collection, id);
        } catch {
          /* offline: tombstone stays in the mirror */
        }
      }
    },
    [applyRecords, configured],
  );

  const useRecords = useCallback(
    (collection: SyncedCollection): RemoteRecord[] =>
      Object.values(store[collection] ?? {}).filter((r) => !r.deleted),
    [store],
  );

  const isLocalWrite = useCallback(
    (collection: SyncedCollection, id: string) => localWrites.current.has(`${collection}:${id}`),
    [],
  );

  const value = useMemo(
    () => ({ ready, configured, connectionStatus, onlineEmails, useRecords, upsert, remove, isLocalWrite, onRemoteChange }),
    [ready, configured, connectionStatus, onlineEmails, useRecords, upsert, remove, isLocalWrite, onRemoteChange],
  );

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync(): SyncContextValue {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error('useSync must be used within a SyncProvider');
  return ctx;
}

/**
 * Typed helper: live records of a collection, decoded to a domain shape.
 * Each record's `data` is spread with its string `id` and `updatedAt`.
 */
export function useCollection<T>(collection: SyncedCollection): (T & { id: string; updatedAt: string })[] {
  const { useRecords } = useSync();
  const records = useRecords(collection);
  return useMemo(
    () => records.map((r) => ({ ...(r.data as T), id: r.id, updatedAt: r.updatedAt })),
    [records],
  );
}
