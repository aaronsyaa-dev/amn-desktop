import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { signalerArrivee } from '../lib/fluxVisible';
import { bridge } from '../lib/bridge';
import { reportGuestQuotaError } from './guestQuotaStore';
import {
  appliquer as appliquerVerdict,
  attenteAvantEssai,
  poser as poserEnFile,
  pretALEnvoi,
  resume as resumeFile,
  motsPurge,
  type Abandon,
  type EntreeEnvoi,
} from '../lib/fileEnvoi';
import { statutErreur } from '../lib/errorMessage';
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
  // Les événements. Voir `SyncedCollection` pour la raison du nom français :
  // `events` désigne déjà, côté amn-api, une observation brute de tracker.
  'evenements',
  'dms',
  'groups',
  'groupMessages',
  'announcements',
  'polls',
  'leaves',
  'prospects',
  'paymentReminders',
  'subscriptions',
  'contracts',
  'reviews',
  'loyaltyCards',
  'referrals',
  'bookingConfig',
  'stockItems',
  'suppliers',
  'shifts',
  'checklists',
  'checkRuns',
  'assemblies',
  'tickets',
  'boms',
  'okrs',
  'weeklyReviews',
  'meetings',
  'dailyPriorities',
  'routines',
  'logbook',
  'forms',
  'formAnswers',
  'minisite',
  'newsletters',
  'signatures',
  'portfolioItems',
  'templates',
  'automations',
  'customAlerts',
  'cashCounts',
  'deliveryRounds',
  'resources',
  'resourceBookings',
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
 * Où la file d'envoi attend, en clair et par contexte.
 *
 * Elle vit à côté du miroir et pour la même raison : ce qui n'est pas parti
 * doit survivre à la fermeture de l'application. Une file gardée seulement en
 * mémoire perdrait, au premier redémarrage, exactement les écritures qu'elle
 * est là pour sauver — et c'est un redémarrage qu'on fait volontiers quand
 * « ça ne marche pas ».
 */
function fileKey(scope: string | undefined): string {
  return scope ? `${MIRROR_PREFIX}ctx-${scope}.__envoi` : `${MIRROR_PREFIX}__envoi`;
}

function readFile(scope: string | undefined): EntreeEnvoi[] {
  try {
    const raw = window.localStorage.getItem(fileKey(scope));
    const parsed = raw ? (JSON.parse(raw) as EntreeEnvoi[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeFile(scope: string | undefined, file: readonly EntreeEnvoi[]): void {
  try {
    window.localStorage.setItem(fileKey(scope), JSON.stringify(file));
  } catch {
    /* quota — l'état en mémoire reste la référence pour cette session */
  }
}

/**
 * Efface le miroir d'un contexte client. Appelé en quittant : les données d'une
 * cliente n'ont pas à rester sur le disque de l'opérateur une fois la porte
 * refermée.
 */
export { motsPurge };

export function purgeContextMirror(scope: string): number {
  let perdues = 0;
  try {
    /*
      CE QUI PART AVEC LE MIROIR DOIT ÊTRE DIT.

      La file d'envoi vit sous le même préfixe que le miroir, et c'est
      volontaire : les données d'une cliente n'ont pas à rester sur le disque
      de l'opérateur une fois la porte refermée, la file comprise.

      Mais une file non vide au moment de la purge, ce sont des écritures qui
      n'atteindront jamais le serveur. Les effacer sans un mot rejouerait
      exactement le défaut que la file répare — et au pire moment, celui d'une
      session de support qui EXPIRE toute seule, sans que personne n'ait
      décidé de partir. On compte donc, et l'appelant le dit.
    */
    perdues = readFile(scope).length;
    const prefix = `${MIRROR_PREFIX}ctx-${scope}.`;
    for (const key of Object.keys(window.localStorage)) {
      if (key.startsWith(prefix)) window.localStorage.removeItem(key);
    }
  } catch {
    /* quota / mode privé — rien à faire de plus */
  }
  return perdues;
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
  /**
   * Combien d'écritures attendent d'atteindre le serveur.
   *
   * Zéro la quasi-totalité du temps. Ce n'est pas un indicateur de santé mais
   * un indicateur d'ATTENTE : le défaut réparé était le silence, et pendant une
   * longue coupure on doit pouvoir savoir que le travail n'est pas encore parti
   * avant de fermer l'application.
   */
  enAttenteEnvoi: number;
  /** La même chose en une phrase, ou `null` quand il n'y a rien à dire. */
  resumeEnvoi: string | null;
  /**
   * Les écritures qui ne partiront jamais — refusées par le serveur, ou
   * abandonnées après trop d'essais. C'est le seul cas où l'utilisateur DOIT
   * être dérangé : la donnée est sur cet appareil et n'ira nulle part.
   *
   * Elles sont exposées plutôt que notifiées d'ici parce que `ToastProvider`
   * vit SOUS `SyncProvider` (voir AppLayout et SpaceProviders) : c'est un
   * composant placé plus bas qui les annonce, et appelle `oublierAbandons`.
   */
  abandonsEnvoi: Abandon[];
  oublierAbandons: () => void;
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
  /*
    LA FILE D'ENVOI — ce qui n'est pas parti attend ici.

    Elle est tenue dans une `ref` et non dans un state : le vidage lit et récrit
    la file plusieurs fois par passage, et un state ne serait à jour qu'au
    rendu suivant — deux envois concurrents repartiraient alors de la même
    version et l'un écraserait l'autre. `enAttente` porte la seule chose dont
    l'écran a besoin, et ne change qu'à chaque variation réelle.
  */
  const fileRef = useRef<EntreeEnvoi[]>([]);
  const [enAttente, setEnAttente] = useState(0);
  const [abandons, setAbandons] = useState<Abandon[]>([]);
  const videEnCours = useRef(false);
  const relanceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

      /*
        UN ALLER-RETOUR, PAS VINGT-HUIT.

        MESURÉ en entrant dans le dossier d'une organisation cliente : une
        requête par collection. Le temps SERVEUR est négligeable — deux
        millisecondes chacune — mais un navigateur n'ouvre que six connexions
        par origine, donc vingt-huit requêtes font cinq vagues successives. À
        300 ms de latence, une seconde et demie passée à attendre plutôt qu'à
        calculer, et c'est exactement ce qui se voyait à l'entrée d'un espace.

        Le repli une-par-une reste : une amn-api plus ancienne ne connaît pas
        `_bulk` et rendrait un 404. Mieux vaut une entrée lente qu'un espace
        vide, et c'est le genre de décalage qui arrive en vrai — le poste se
        met à jour tout seul, le serveur non.
      */
      try {
        /*
          PAR LOTS DE CINQUANTE. Mesuré à l'audit du 4 septembre 2026 : le
          contrat compte 69 collections depuis les cinquante modules, une
          amn-api d'avant ce jour plafonne à 50, et un seul appel recevait un
          400 — puis 69 requêtes une par une, à chaque ouverture, sur chaque
          poste. Deux allers-retours au lieu de soixante-neuf, quel que soit
          l'âge du serveur en face ; le repli une-par-une reste pour les
          serveurs qui ne connaissent pas `_bulk` du tout.
        */
        const LOT = 50;
        const groupe: Record<string, RemoteRecord[]> = {};
        for (let i = 0; i < SYNCED_COLLECTIONS.length; i += LOT) {
          Object.assign(groupe, await remote.listRecordsBulk(SYNCED_COLLECTIONS.slice(i, i + LOT)));
        }
        const manquantes = SYNCED_COLLECTIONS.filter((c) => !Array.isArray(groupe[c]));
        if (manquantes.length === 0) {
          if (active) {
            for (const collection of SYNCED_COLLECTIONS) applyRecords(collection, groupe[collection]);
            setPullFailed(false);
          }
          const presenceGroupee = await remote.getPresence().catch(() => [] as PresenceEntry[]);
          if (active) {
            setOnlineEmails(new Set(presenceGroupee.filter((p) => p.online).map((p) => p.email)));
          }
          return;
        }
        // Réponse incomplète : on ne devine pas ce qui manque, on refait tout
        // par la voie sûre plutôt que d'afficher un espace à moitié chargé.
      } catch (err) {
        reportGuestQuotaError(err);
      }

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
        /*
          LE FLUX VISIBLE (Signes Vitaux) : une vraie arrivée réseau, écrite
          par quelqu'un d'autre — le seul cas où montrer « d'où vient le +1 »
          dit quelque chose de vrai. Voir lib/fluxVisible.ts.
        */
        if (!record.deleted) signalerArrivee(record.collection);
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

  /** Range la file, la persiste, et met l'écran à jour. */
  const rangerFile = useCallback(
    (suite: EntreeEnvoi[], nouveauxAbandons: Abandon[]) => {
      fileRef.current = suite;
      writeFile(scope, suite);
      setEnAttente(suite.length);
      if (nouveauxAbandons.length > 0) setAbandons((prev) => [...prev, ...nouveauxAbandons]);
    },
    [scope],
  );

  /**
   * VIDER LA FILE — une entrée à la fois, dans l'ordre.
   *
   * En série et non en parallèle : l'ordre de création porte du sens (un devis
   * part après le client qu'il cite), et vingt requêtes lancées ensemble sur
   * une API qui vient à peine de se relever la remettraient à terre — la file
   * aggraverait la panne qu'elle absorbe.
   *
   * Le premier échec ARRÊTE le passage. Continuer ferait, sur un serveur
   * éteint, deux cents requêtes vouées à l'échec à chaque retour d'onglet, et
   * ferait monter d'un coup le compteur d'essais de toute la file — qui
   * atteindrait sa limite et abandonnerait tout, pour une coupure de trente
   * secondes.
   */
  const viderFile = useCallback(async () => {
    if (videEnCours.current) return;
    if (fileRef.current.length === 0) return;
    videEnCours.current = true;
    try {
      const remote = bridge().remote;
      // Une copie du premier tour : la file peut changer sous nos pieds pendant
      // l'envoi, et `appliquerVerdict` sait déjà reconnaître une entrée périmée.
      for (const entree of [...fileRef.current]) {
        // L'attente entre deux essais est portée par l'entrée elle-même : une
        // entrée qui vient d'échouer ne doit pas repartir au retour d'onglet
        // suivant, sinon le doublement ne sert à rien.
        if (!pretALEnvoi(entree, Date.now())) continue;
        try {
          if (entree.geste === 'suppression') {
            await remote.deleteRecord(entree.collection as SyncedCollection, entree.id);
          } else {
            const saved = await remote.upsertRecord(
              entree.collection as SyncedCollection,
              entree.id,
              entree.donnees ?? {},
            );
            applyRecords(entree.collection, [saved]); // adopter l'horodatage serveur
          }
          const r = appliquerVerdict(fileRef.current, entree, { parti: true });
          rangerFile(r.file, r.abandons);
        } catch (err) {
          reportGuestQuotaError(err);
          const statut = statutErreur(err);
          const r = appliquerVerdict(fileRef.current, entree, {
            parti: false,
            statut,
            detail: err instanceof Error ? err.message : undefined,
          });
          rangerFile(r.file, r.abandons);
          // Un REFUS ne dit rien de l'entrée suivante : le serveur répond, il
          // rejette celle-ci. On continue. Une panne, elle, vaut pour toutes.
          if (statut === undefined || statut >= 500) break;
        }
      }
    } finally {
      videEnCours.current = false;
    }

    /*
      Se redonner rendez-vous tant qu'il reste quelque chose. Sans ça, une file
      bloquée n'attendrait qu'un geste de l'utilisateur — retour d'onglet,
      nouvelle écriture — et sur un poste laissé ouvert toute la nuit rien ne
      repartirait avant le matin.
    */
    if (relanceRef.current) clearTimeout(relanceRef.current);
    relanceRef.current = null;
    const reste = fileRef.current;
    if (reste.length > 0) {
      const dans = Math.max(1000, Math.min(...reste.map((e) => attenteAvantEssai(e.essais) || 1000)));
      relanceRef.current = setTimeout(() => {
        void viderFile();
      }, dans);
    }
  }, [applyRecords, rangerFile]);

  /** Met un geste en file, et tente aussitôt de la vider. */
  const mettreEnFile = useCallback(
    (entree: EntreeEnvoi) => {
      const r = poserEnFile(fileRef.current, entree);
      rangerFile(r.file, r.abandons);
    },
    [rangerFile],
  );

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
        } catch (err) {
          /*
            CE QUI N'EST PAS PARTI REPART.

            Ce `catch` avalait l'échec avec, pour tout traitement, un
            commentaire qui promettait « will re-sync later ». Rien ne le
            faisait : `pullAll()` ne fait que TIRER. MESURÉ au navigateur,
            l'API répondant 503, cinq soumissions sur cinq — rendez-vous,
            tâche, client, facture, rapport — sans le moindre mot, et deux fois
            la fenêtre s'est même refermée, ce que tout le monde lit comme
            « c'est enregistré ». La facture existait sur le poste, pas sur le
            serveur, donc pas sur le téléphone ni pour le collègue.

            L'écriture optimiste reste : l'écran ne doit pas attendre le
            réseau. Ce qui change, c'est qu'elle est maintenant SUIVIE.
          */
          reportGuestQuotaError(err);
          mettreEnFile({
            collection,
            id,
            geste: 'ecriture',
            donnees: stamped,
            pose: optimistic.updatedAt,
            essais: 0,
          });
        }
      }
    },
    [applyRecords, configured, mettreEnFile],
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
        } catch (err) {
          /*
            Une suppression perdue est PIRE qu'une écriture perdue : ce qu'on a
            supprimé continue d'exister pour tout le monde sauf pour soi, donc
            on ne le voit plus et on ne peut plus le supprimer.
          */
          reportGuestQuotaError(err);
          mettreEnFile({
            collection,
            id,
            geste: 'suppression',
            pose: tombstone.updatedAt,
            essais: 0,
          });
        }
      }
    },
    [applyRecords, configured, mettreEnFile],
  );

  /*
    LA FILE REPART — et pas seulement quand on écrit.

    Les mêmes signaux que la relecture (`refreshIfStale`), plus la reprise de
    connexion : le défaut réparé ici est précisément que RIEN ne renvoyait une
    écriture perdue. Un seul déclencheur — la prochaine écriture — aurait laissé
    la facture d'hier soir sur le poste jusqu'à ce qu'on en saisisse une autre.

    La file est relue du stockage au montage : ce qui n'était pas parti à la
    fermeture doit repartir à l'ouverture, et c'est justement le redémarrage
    qu'on fait quand « ça ne marche pas ».
  */
  useEffect(() => {
    const dejaLa = readFile(scope);
    fileRef.current = dejaLa;
    setEnAttente(dejaLa.length);

    const relancer = () => {
      void viderFile();
    };
    relancer();
    window.addEventListener('online', relancer);
    window.addEventListener('focus', relancer);
    window.addEventListener('visibilitychange', relancer);
    return () => {
      window.removeEventListener('online', relancer);
      window.removeEventListener('focus', relancer);
      window.removeEventListener('visibilitychange', relancer);
      if (relanceRef.current) clearTimeout(relanceRef.current);
    };
  }, [scope, viderFile]);

  // Une écriture qui vient d'échouer ne doit pas attendre le prochain signal.
  useEffect(() => {
    if (enAttente > 0) void viderFile();
  }, [enAttente, viderFile]);

  // La connexion revient : c'est le moment le plus probable pour que ça passe.
  useEffect(() => {
    if (connectionStatus === 'online') void viderFile();
  }, [connectionStatus, viderFile]);

  /** Les abandons non encore montrés, et de quoi dire qu'ils l'ont été. */
  const oublierAbandons = useCallback(() => setAbandons([]), []);

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
      enAttenteEnvoi: enAttente,
      resumeEnvoi: resumeFile(fileRef.current),
      abandonsEnvoi: abandons,
      oublierAbandons,
      remove,
      isLocalWrite,
      onRemoteChange,
    }),
    [
      ready,
      configured,
      pullFailed,
      connectionStatus,
      onlineEmails,
      useRecords,
      upsert,
      enAttente,
      abandons,
      oublierAbandons,
      remove,
      isLocalWrite,
      onRemoteChange,
    ],
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
