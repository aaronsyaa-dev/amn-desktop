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
];

const MIRROR_PREFIX = 'amn.sync.';

type CollectionMap = Record<string, RemoteRecord>; // id -> record (incl. tombstones)
type Store = Record<string, CollectionMap>; // collection -> map

export function uid(prefix = 'r'): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
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

    (async () => {
      const status = await remote.getConnectionStatus().catch(() => 'unconfigured' as const);
      if (!active) return;
      const isConfigured = status !== 'unconfigured';
      setConfigured(isConfigured);
      setConnectionStatus(status);

      if (isConfigured) {
        // Pull each collection from the server and reconcile into the mirror.
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
      }
      if (active) setReady(true);
    })();

    const offRecord = remote.onRecord((record) => {
      if (active) applyRecords(record.collection, [record]);
    });
    const offStatus = remote.onConnectionStatusChange((s) => active && setConnectionStatus(s));
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
      const optimistic: RemoteRecord = {
        id,
        collection,
        data,
        updatedAt: new Date().toISOString(),
        deleted: false,
      };
      applyRecords(collection, [optimistic]); // instant local update
      if (configured) {
        try {
          const saved = await bridge().remote.upsertRecord(collection, id, data);
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
    () => ({ ready, configured, connectionStatus, onlineEmails, useRecords, upsert, remove, isLocalWrite }),
    [ready, configured, connectionStatus, onlineEmails, useRecords, upsert, remove, isLocalWrite],
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
