import { useCallback, useEffect, useMemo, useRef } from 'react';
import { bridge } from '../lib/bridge';
import { useSync, useCollection } from './SyncContext';
import { useClientView } from './ClientViewContext';
import { assignUniqueIds, oneOf } from '../lib/records';
import type {
  AddClientEventInput,
  Client,
  ClientEvent,
  ClientStatus,
  CreateClientInput,
  CreateQuoteInput,
  PaymentStatus,
  Quote,
  QuoteStatus,
  UpdateClientInput,
  UpdateQuoteInput,
} from '../shared/api';

/**
 * Clients and quotes, on the synced collections — one implementation for both
 * platforms.
 *
 * ## Why this hook exists
 *
 * Clients used to have TWO independent implementations of the same domain:
 * SQLite behind IPC in Electron, and localStorage in the browser/PWA build.
 * They were not two views of one store, they were two different databases. So
 * clients created on the desktop simply did not exist for the web app, in
 * either direction, for either operator. Earlier fixes added a one-way mirror
 * of the SQLite rows up to amn-api, which made desktop data survive a
 * reinstall — but never made the web read it. The symptom was treated; the
 * split was not, so it came back on every chantier that touched this area.
 *
 * Collections that go through `SyncContext` (tasks, decisions, notes, reports…)
 * never had this problem, because there is only one implementation of them and
 * both platforms run it. Clients and quotes now do the same.
 *
 * ## Ids stay numeric
 *
 * `Client.id` is a number across tasks, quotes and report links. Rather than
 * churn every call site, the record id in the collection is the number as a
 * string, and new ids are minted from the clock plus a random tail — unique
 * without a central counter, so two operators creating a client at the same
 * moment cannot collide (and it stays well inside Number.MAX_SAFE_INTEGER).
 */

/** Stored shape. `id` is not part of it — it IS the record id. */
type ClientData = Omit<Client, 'id'>;
type QuoteData = Omit<Quote, 'id'>;

/**
 * Ce que ce hook rend : la fiche, PLUS la clé réelle de son enregistrement.
 *
 * Le champ ne remonte volontairement pas dans le type partagé `Client` : le
 * pont SQLite d'Electron manipule des fiches qui n'ont pas d'enregistrement
 * synchronisé, et leur inventer une clé serait affirmer quelque chose de faux.
 * Ici, en revanche, il y en a toujours une — et c'est la seule voie d'écriture.
 */
export interface SyncedClient extends Client {
  recordId: string;
}
export interface SyncedQuote extends Quote {
  recordId: string;
}

type StoredClient = ClientData & { id: string; updatedAt: string };
type StoredQuote = QuoteData & { id: string; updatedAt: string };

/** Collision-free without a central counter; safe as a JS number. */
function mintId(): number {
  return Date.now() * 1000 + Math.floor(Math.random() * 1000);
}

/**
 * Les domaines fermés, déclarés une fois.
 *
 * Ils existaient déjà dans `shared/api.ts` — mais en TYPE seulement, c'est-à-
 * dire nulle part à l'exécution. Une valeur venue de la base ne rencontrait
 * donc aucune vérification, et un statut hérité comme `"client"` arrivait tel
 * quel dans `STATUS_META[...]` côté écran.
 */
const CLIENT_STATUSES: ClientStatus[] = ['active', 'paused', 'prospect'];
const QUOTE_STATUSES: QuoteStatus[] = ['draft', 'sent', 'accepted', 'refused'];
const PAYMENT_STATUSES: PaymentStatus[] = ['unpaid', 'pending', 'paid', 'late'];

/**
 * `id` est le nombre porté par les références croisées ; `recordId` est la
 * VRAIE clé de l'enregistrement, et la seule par laquelle on écrit.
 *
 * Les deux ne coïncident pas toujours : le miroir SQLite des postes Electron
 * écrit des clés `client-<uuid>`. Reconstruire la clé depuis le nombre — ce
 * que faisait `String(id)` — produisait alors `"NaN"`, et l'écriture partait
 * dans le vide. Voir la note de `src/lib/records.ts`.
 */
function toClient(row: StoredClient, id: number): SyncedClient {
  return {
    id,
    recordId: row.id,
    name: typeof row.name === 'string' ? row.name : '',
    company: typeof row.company === 'string' ? row.company : '',
    status: oneOf(row.status, CLIENT_STATUSES, 'prospect'),
    email: typeof row.email === 'string' ? row.email : '',
    phone: typeof row.phone === 'string' ? row.phone : '',
    notes: typeof row.notes === 'string' ? row.notes : '',
    imageDataUrl: typeof row.imageDataUrl === 'string' ? row.imageDataUrl : '',
    linkedSiteIds: Array.isArray(row.linkedSiteIds) ? row.linkedSiteIds : [],
    createdAt: row.createdAt ?? row.updatedAt,
    updatedAt: row.updatedAt,
    events: Array.isArray(row.events) ? row.events : [],
  };
}

function toQuote(row: StoredQuote, id: number, clientIdBySyncId: Map<string, number>): SyncedQuote {
  /*
    Le devis remonté par le miroir SQLite ne porte PAS `clientId` mais
    `clientSyncId` — la clé d'enregistrement de son client. Sans cette
    traduction, `Number(undefined ?? 0)` donnait 0 : le devis existait, mais
    rattaché à un client numéro zéro qui n'a jamais existé, donc invisible
    depuis toutes les fiches.
  */
  const bySyncId =
    typeof row.clientSyncId === 'string' ? clientIdBySyncId.get(row.clientSyncId) : undefined;
  return {
    id,
    recordId: row.id,
    clientId: bySyncId ?? Number(row.clientId ?? 0),
    title: typeof row.title === 'string' ? row.title : '',
    detail: typeof row.detail === 'string' ? row.detail : '',
    trackerTier: typeof row.trackerTier === 'string' ? row.trackerTier : '',
    priceEuro: Number.isFinite(Number(row.priceEuro)) ? Number(row.priceEuro) : 0,
    status: oneOf(row.status, QUOTE_STATUSES, 'draft'),
    paymentStatus: oneOf(row.paymentStatus, PAYMENT_STATUSES, 'unpaid'),
    createdAt: row.createdAt ?? row.updatedAt,
    updatedAt: row.updatedAt,
  };
}

function stripId<T extends { id: unknown; updatedAt?: unknown }>(row: T): Record<string, unknown> {
  const rest = { ...row } as Record<string, unknown>;
  delete rest.id;
  delete rest.updatedAt;
  // `recordId` EST la clé de l'enregistrement : la recopier à l'intérieur des
  // données en ferait une seconde vérité, qui finirait par diverger de la
  // première — exactement le mécanisme du bug qu'on corrige.
  delete rest.recordId;
  return rest;
}

export function useClients() {
  const { upsert, remove, ready, configured, pullFailed } = useSync();
  const clientRows = useCollection<StoredClient>('clients');
  const quoteRows = useCollection<StoredQuote>('quotes');

  const clients = useMemo(() => {
    const ids = assignUniqueIds(clientRows, (row) => row.id);
    return clientRows
      .map((row) => toClient(row, ids.get(row.id) ?? 0))
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  }, [clientRows]);

  const quotes = useMemo(() => {
    const ids = assignUniqueIds(quoteRows, (row) => row.id);
    // La correspondance clé d'enregistrement → identifiant numérique du client,
    // pour rattacher les devis remontés par le miroir SQLite (voir `toQuote`).
    const clientIdBySyncId = new Map(clients.map((c) => [c.recordId, c.id]));
    return quoteRows
      .map((row) => toQuote(row, ids.get(row.id) ?? 0, clientIdBySyncId))
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }, [quoteRows, clients]);

  /**
   * One-time import of whatever the legacy per-platform store still holds —
   * SQLite on Electron, localStorage in the browser. Runs only once the pull is
   * known to have succeeded, so an empty in-memory collection caused by a
   * transient amn-api hiccup is never mistaken for "nothing has been migrated
   * yet". Existing records are never overwritten.
   */
  const importedRef = useRef(false);
  const rowsRef = useRef({ clients: clientRows, quotes: quoteRows });
  rowsRef.current = { clients: clientRows, quotes: quoteRows };
  // Le magasin hérité est celui de CE poste — nos fiches, dans notre base
  // SQLite locale ou notre localStorage. L'importer depuis le dossier d'une
  // cliente y déverserait nos clients à nous : une migration devenue une fuite.
  // Elle n'a de sens que dans notre propre organisation.
  const clientView = useClientView();
  useEffect(() => {
    if (importedRef.current) return;
    if (clientView) return;
    if (!ready) return;
    if (configured && pullFailed) return;
    importedRef.current = true;

    void (async () => {
      const [legacyClients, legacyQuotes] = await Promise.all([
        bridge().clients.list().catch(() => [] as Client[]),
        bridge().quotes.list().catch(() => [] as Quote[]),
      ]);
      const known = new Set(rowsRef.current.clients.map((r) => r.id));
      // The two legacy stores hold the SAME clients under different ids (each
      // platform numbered them independently), so importing by id alone shows
      // every client twice. Identity is the name + company pair, which is what
      // an operator would call "the same client".
      const identity = (name: unknown, company: unknown) =>
        `${String(name ?? '').trim().toLowerCase()}|${String(company ?? '').trim().toLowerCase()}`;
      const knownIdentities = new Set(
        rowsRef.current.clients.map((r) => identity(r.name, r.company)),
      );
      for (const c of legacyClients) {
        if (known.has(String(c.id))) continue;
        const key = identity(c.name, c.company);
        if (knownIdentities.has(key)) continue;
        knownIdentities.add(key);
        await upsert('clients', String(c.id), stripId(c));
      }
      const knownQuotes = new Set(rowsRef.current.quotes.map((r) => r.id));
      for (const q of legacyQuotes) {
        if (knownQuotes.has(String(q.id))) continue;
        await upsert('quotes', String(q.id), stripId(q));
      }
    })();
    // Deliberately keyed on readiness only: this must run once per session, not
    // every time the collection updates — which it does, since it writes to it.
    // `clientRows`/`quoteRows` are read through refs above for the same reason.
  }, [ready, configured, pullFailed, upsert, clientView]);

  const createClient = useCallback(
    async (input: CreateClientInput): Promise<SyncedClient> => {
      const now = new Date().toISOString();
      const id = mintId();
      const data: ClientData = {
        name: input.name,
        company: input.company ?? '',
        status: input.status ?? 'prospect',
        email: input.email ?? '',
        phone: input.phone ?? '',
        notes: '',
        imageDataUrl: '',
        linkedSiteIds: [],
        createdAt: now,
        updatedAt: now,
        events: [],
      };
      // À la création, la clé est CHOISIE ici : `String(id)` la définit, il ne
      // la reconstruit pas. On la conserve telle quelle dans `recordId`, qui
      // sera désormais la seule voie d'écriture pour cette fiche.
      const recordId = String(id);
      await upsert('clients', recordId, data as unknown as Record<string, unknown>);
      return { ...data, id, recordId };
    },
    [upsert],
  );

  /*
    Toutes les écritures ci-dessous passent par `current.recordId`, jamais par
    `String(id)`. C'est LA correction du bug « Elie Sy » : reconstruire la clé
    à partir du nombre échouait silencieusement sur tout enregistrement dont la
    clé n'est pas un nombre — l'écriture partait sur `"NaN"`, l'API répondait
    par un succès, et rien ne changeait.
  */
  const updateClient = useCallback(
    async (id: number, patch: UpdateClientInput): Promise<SyncedClient> => {
      const current = clients.find((c) => c.id === id);
      if (!current) throw new Error(`Client ${id} introuvable`);
      const next: SyncedClient = { ...current, ...patch, updatedAt: new Date().toISOString() };
      await upsert('clients', current.recordId, stripId(next));
      return next;
    },
    [clients, upsert],
  );

  const addClientEvent = useCallback(
    async (input: AddClientEventInput): Promise<SyncedClient> => {
      const current = clients.find((c) => c.id === input.clientId);
      if (!current) throw new Error(`Client ${input.clientId} introuvable`);
      const event: ClientEvent = {
        id: mintId(),
        clientId: input.clientId,
        title: input.title,
        detail: input.detail ?? '',
        date: new Date().toISOString(),
      };
      const next: SyncedClient = {
        ...current,
        events: [event, ...current.events],
        updatedAt: new Date().toISOString(),
      };
      await upsert('clients', current.recordId, stripId(next));
      return next;
    },
    [clients, upsert],
  );

  const removeClient = useCallback(
    async (id: number) => {
      const current = clients.find((c) => c.id === id);
      // Un client introuvable dans la liste ne doit pas faire échouer le geste
      // en silence : on le dit, plutôt que de laisser croire à une suppression.
      if (!current) throw new Error(`Client ${id} introuvable`);
      // Quotes belong to their client: leaving them behind would show orphan
      // amounts in the totals with no fiche to open.
      for (const q of quotes.filter((q) => q.clientId === id)) {
        await remove('quotes', q.recordId);
      }
      await remove('clients', current.recordId);
    },
    [clients, quotes, remove],
  );

  const createQuote = useCallback(
    async (input: CreateQuoteInput): Promise<SyncedQuote> => {
      const now = new Date().toISOString();
      const id = mintId();
      const data: QuoteData = {
        clientId: input.clientId,
        title: input.title,
        detail: input.detail ?? '',
        trackerTier: input.trackerTier,
        priceEuro: input.priceEuro,
        status: 'draft',
        paymentStatus: 'unpaid',
        createdAt: now,
        updatedAt: now,
      };
      const recordId = String(id);
      await upsert('quotes', recordId, data as unknown as Record<string, unknown>);
      return { ...data, id, recordId };
    },
    [upsert],
  );

  const updateQuote = useCallback(
    async (id: number, patch: UpdateQuoteInput): Promise<SyncedQuote> => {
      const current = quotes.find((q) => q.id === id);
      if (!current) throw new Error(`Devis ${id} introuvable`);
      const next: SyncedQuote = { ...current, ...patch, updatedAt: new Date().toISOString() };
      await upsert('quotes', current.recordId, stripId(next));
      return next;
    },
    [quotes, upsert],
  );

  const removeQuote = useCallback(
    async (id: number) => {
      const current = quotes.find((q) => q.id === id);
      if (!current) throw new Error(`Devis ${id} introuvable`);
      await remove('quotes', current.recordId);
    },
    [quotes, remove],
  );

  return {
    clients,
    quotes,
    ready,
    createClient,
    updateClient,
    addClientEvent,
    removeClient,
    createQuote,
    updateQuote,
    removeQuote,
  };
}
