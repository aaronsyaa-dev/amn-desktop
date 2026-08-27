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
import { reportGuestQuotaError } from './guestQuotaStore';
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

/**
 * Every collection pulled on startup and mirrored locally. A collection absent
 * from this list still *writes* through `upsert` (and reaches amn-api), but it
 * is never read back — so its data silently disappears on the next reload.
 * Anything added to `SyncedCollection` must be listed here too.
 */
const SYNCED_COLLECTIONS: SyncedCollection[] = [
  'tasks',
  'decisions',
  'knowledge',
  'objectives',
  'messages',
  'profiles',
  'notes',
  'reports',
  // Rendez-vous et médiathèque de l'édition Business. Listés ici même dans le
  // build interne : la liste est le contrat de synchronisation, pas la liste
  // des écrans compilés — et `npm run check:sync` vérifie qu'elle correspond
  // exactement au type SyncedCollection et à la liste ALLOWED d'amn-api.
  // Pages composées de blocs (BLOC 3) : un seul moteur pour les fiches de
  // production, les briefs, les pages d'équipe et le module Personnel.
  'pages',
  'appointments',
  'media',
  'remediation',
  // Clients and quotes moved here from the per-platform stores (SQLite on
  // Electron, localStorage on the web) that made them invisible across
  // platforms. See src/state/useClients.ts.
  'clients',
  'quotes',
  // Found by scripts/check-sync-parity.mjs: declared as a synced collection but
  // never pulled back, so installed-tracker state was written and then lost on
  // the next reload, on every platform.
  'trackers',
  'siteMeta',
  'siteNotes',
  // Facturation. Une facture émise doit être lisible depuis le téléphone comme
  // depuis le poste — c'est souvent sur le téléphone qu'on constate un
  // encaissement — et l'identité légale de l'émetteur doit suivre, sans quoi
  // le même document sortirait sans mentions obligatoires d'un appareil à
  // l'autre.
  'invoices',
  'billing',
  // Dossier client : nos notes internes SUR une cliente. Portées par le tenant
  // d'AMN DevSec, jamais par le sien — voir le type SyncedCollection.
  'orgDossier',
  // Projets et le réglage du moteur. Le rattachement se fait par un simple
  // `projectId` porté par les collections existantes : rien n'est recopié.
  'projects',
  'projectConfig',
  // Dépenses et temps passé. Le chronomètre en cours est un enregistrement de
  // `timeEntries` comme les autres : lancé sur le téléphone, il doit se voir —
  // et s'arrêter — depuis le poste, ce qu'un état local ne permettrait pas.
  'expenses',
  'expenseConfig',
  'timeEntries',
  'timeConfig',
  'orders',
];

const MIRROR_PREFIX = 'amn.sync.';

/**
 * Le miroir local est indexé par CONTEXTE, pas seulement par poste.
 *
 * Tant qu'AMN Desktop ne voyait qu'une organisation, `amn.sync.<collection>`
 * suffisait. Depuis le contexte client, le même poste lit tour à tour le
 * dossier d'AMN DevSec et celui d'une cliente : sans préfixe, les deux se
 * mélangeraient dans le même miroir — les tâches de la cliente réapparaîtraient
 * chez nous à la sortie, et les nôtres chez elle à l'entrée, le temps que la
 * première synchro les remplace. C'est exactement la fuite que le contexte
 * client doit rendre impossible.
 *
 * Le contexte par défaut garde les clés historiques : une mise à jour ne doit
 * pas repartir d'un miroir vide sur les postes existants (visible tout de suite
 * si amn-api est injoignable au premier lancement).
 */
function mirrorKey(scope: string | undefined, collection: string): string {
  return scope ? `${MIRROR_PREFIX}ctx-${scope}.${collection}` : MIRROR_PREFIX + collection;
}

/**
 * Efface le miroir d'un contexte client. Appelé en quittant : les données d'une
 * cliente n'ont pas à rester sur le disque de l'opérateur une fois la porte
 * refermée.
 */
export function purgeContextMirror(scope: string): void {
  try {
    const prefix = `${MIRROR_PREFIX}ctx-${scope}.`;
    for (const key of Object.keys(window.localStorage)) {
      if (key.startsWith(prefix)) window.localStorage.removeItem(key);
    }
  } catch {
    /* quota / mode privé — rien à faire de plus */
  }
}

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

function readMirror(scope: string | undefined, collection: string): RemoteRecord[] {
  try {
    const raw = window.localStorage.getItem(mirrorKey(scope, collection));
    return raw ? (JSON.parse(raw) as RemoteRecord[]) : [];
  } catch {
    return [];
  }
}

function writeMirror(scope: string | undefined, collection: string, records: RemoteRecord[]): void {
  try {
    window.localStorage.setItem(mirrorKey(scope, collection), JSON.stringify(records));
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
  /**
   * False if the most recent full pull hit a network/amn-api error on ANY
   * collection. `ready` alone isn't enough to tell — it also flips true after
   * a failed pull (so the mirror is still usable offline) — but a caller that
   * treats "no records" as "this doesn't exist yet, create it" (e.g. the
   * profile auto-seed in ProfilesContext) must NOT do that after a failed
   * pull: an empty in-memory store from a transient fetch error would then be
   * mistaken for "no profile" and overwrite the real one on amn-api.
   */
  pullFailed: boolean;
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

export function SyncProvider({
  children,
  scope,
}: {
  children: React.ReactNode;
  /**
   * Identifiant du contexte dont ce fournisseur tient le miroir. Absent pour
   * l'organisation de l'opérateur ; l'identifiant de l'organisation cliente
   * dans un contexte client. Le fournisseur est remonté (via une `key`) quand
   * il change, donc il n'a pas à gérer de transition.
   */
  scope?: string;
}) {
  const { user } = useAuth();
  const [store, setStore] = useState<Store>(() => {
    const initial: Store = {};
    for (const c of SYNCED_COLLECTIONS) initial[c] = toMap(readMirror(scope, c));
    return initial;
  });
  const storeRef = useRef(store);
  storeRef.current = store;

  const [ready, setReady] = useState(false);
  const [pullFailed, setPullFailed] = useState(false);
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
  const applyRecords = useCallback(
    (collection: string, incoming: RemoteRecord[]) => {
      setStore((prev) => {
        let map = prev[collection] ?? {};
        for (const r of incoming) map = mergeRecord(map, r);
        const next = { ...prev, [collection]: map };
        writeMirror(scope, collection, Object.values(map));
        return next;
      });
    },
    [scope],
  );

  // Tell the main process / remote client who is signed in (presence + attribution).
  useEffect(() => {
    bridge().remote.setIdentity(user?.email ?? null);
  }, [user?.email]);

  // Signing out unmounts this whole provider (the app falls back to the login
  // screen), so the effect above never gets to run with `null`. Without this
  // cleanup the operator stayed advertised as online to the other one long
  // after logging out — harmless-looking until BLOC 2, where it offers a call
  // button that rings a machine nobody is signed in to. Unmount-only (empty
  // deps) so a normal account switch still takes the single-reconnect path.
  useEffect(() => () => bridge().remote.setIdentity(null), []);

  // Initial load + live subscriptions.
  useEffect(() => {
    let active = true;
    const remote = bridge().remote;
    let lastStatus: RemoteConnectionStatus = 'connecting';

    // Full catch-up pull: reconciles every collection + presence. Runs on
    // startup and again whenever the connection is (re)established, so any
    // changes the other operator made while we were offline are picked up.
    const pullAll = async () => {
      let anyFailed = false;
      await Promise.all(
        SYNCED_COLLECTIONS.map(async (collection) => {
          try {
            const records = await remote.listRecords(collection);
            if (active) applyRecords(collection, records);
          } catch (err) {
            // Un quota d'invité épuisé n'est pas une panne de réseau : c'est
            // une décision du serveur, et elle doit remonter jusqu'à l'écran
            // de blocage au lieu de se confondre avec « synchronisation
            // indisponible », qui laisserait l'application ouverte.
            reportGuestQuotaError(err);
            /* keep mirror data on failure */
            anyFailed = true;
          }
        }),
      );
      if (active) setPullFailed(anyFailed);
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

    /*
      Reprise après veille, verrouillage du téléphone, ou onglet laissé de côté
      (BLOC G).

      La resynchronisation ci-dessus ne se déclenche que si la WebSocket
      SIGNALE une reconnexion. Or une machine qui s'endort ne ferme pas
      proprement sa socket : au réveil, elle est morte sans que personne l'ait
      constaté, et l'application continue d'afficher les données d'hier sans
      rien indiquer d'anormal — le pire des états, parce qu'il a l'air normal.

      Revenir sur l'application est donc traité comme un événement en soi. Un
      intervalle minimal évite qu'un simple aller-retour entre deux fenêtres ne
      relance un rattrapage complet à chaque fois.
    */
    const MIN_REFRESH_GAP_MS = 30_000;
    let lastRefreshAt = Date.now();
    const refreshIfStale = () => {
      if (!active) return;
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      if (Date.now() - lastRefreshAt < MIN_REFRESH_GAP_MS) return;
      lastRefreshAt = Date.now();
      void pullAll();
    };

    window.addEventListener('visibilitychange', refreshIfStale);
    window.addEventListener('focus', refreshIfStale);
    // Le réseau qui revient : même raisonnement, sans attendre que la socket
    // s'en aperçoive.
    window.addEventListener('online', refreshIfStale);

    return () => {
      active = false;
      offRecord();
      offStatus();
      offPresence();
      window.removeEventListener('visibilitychange', refreshIfStale);
      window.removeEventListener('focus', refreshIfStale);
      window.removeEventListener('online', refreshIfStale);
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
    () => ({
      ready,
      configured,
      pullFailed,
      connectionStatus,
      onlineEmails,
      useRecords,
      upsert,
      remove,
      isLocalWrite,
      onRemoteChange,
    }),
    [ready, configured, pullFailed, connectionStatus, onlineEmails, useRecords, upsert, remove, isLocalWrite, onRemoteChange],
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
