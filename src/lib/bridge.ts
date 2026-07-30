import { DEFAULT_NOTIFICATION_PREFS } from '../shared/api';
import type {
  AddClientEventInput,
  AmnBridge,
  AuthResult,
  ChangePasswordResult,
  NotificationPrefs,
  PresenceEntry,
  RemoteRecord,
  UserProfile,
  ChecklistStateEntry,
  Client,
  CreateClientInput,
  CreateDecisionInput,
  CreateKnowledgeDocInput,
  CreateLearningGoalInput,
  CreateQuoteInput,
  CreateSharedTaskInput,
  Decision,
  KnowledgeDoc,
  LearningGoal,
  Message,
  MessageReaction,
  Objective,
  Quote,
  RegisterSiteResult,
  RemoteConnectionStatus,
  RemoteEvent,
  RemoteEventPush,
  RemoteSite,
  SendMessageInput,
  SharedTask,
  UpdateClientInput,
  UpdateKnowledgeDocInput,
  UpdateLearningGoalInput,
  UpdateObjectiveInput,
  UpdateQuoteInput,
  UpdateSharedTaskInput,
} from '../shared/api';

declare global {
  interface Window {
    amn?: AmnBridge;
  }
}

/**
 * Browser fallback accounts. Used only when the app runs outside Electron
 * (headless verification, vanilla `vite` dev). These are bcrypt hashes of the
 * same seeded dev password — verification is real, not "anything passes".
 * The authoritative store in production is the SQLite `users` table (main).
 */
const FALLBACK_ACCOUNTS: Record<string, { name: string; hash: string }> = {
  'aaron@amn-devsec.com': {
    name: 'Aaron',
    hash: '$2b$10$RDGsFc6Vk/22xXFuVpbwQuaI0N//XtYpLyfDA4aOsTEejh1dIxqTe',
  },
  'mohamed@amn-devsec.com': {
    name: 'Mohamed',
    hash: '$2b$10$LUTrx6TGqtz0vG3QrY2noeeNaPQeypeuA2fZpmZxCZY03a.9IoToC',
  },
};

const MESSAGES_KEY = 'amn.fallback.messages';
const CLIENTS_KEY = 'amn.fallback.clients';
const PROFILES_KEY = 'amn.fallback.profiles';
const PREFS_KEY = 'amn.fallback.prefs';
const PWD_OVERRIDE_KEY = 'amn.fallback.pwdOverrides';
const QUOTES_KEY = 'amn.fallback.quotes';
const TASKS_KEY = 'amn.fallback.tasks';
const DECISIONS_KEY = 'amn.fallback.decisions';
const KNOWLEDGE_KEY = 'amn.fallback.knowledge';
const CHECKLIST_KEY = 'amn.fallback.checklist';
const LEARNING_KEY = 'amn.fallback.learning';
const OBJECTIVES_KEY = 'amn.fallback.objectives';

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86400000).toISOString();
}

/** Generic localStorage-backed list, seeded once on first read. */
function readList<T>(key: string, seed: () => T[]): T[] {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T[];
  } catch {
    /* fall through to seed */
  }
  const seeded = seed();
  window.localStorage.setItem(key, JSON.stringify(seeded));
  return seeded;
}

function writeList<T>(key: string, items: T[]): void {
  window.localStorage.setItem(key, JSON.stringify(items));
}

function readFallbackMessages(): Message[] {
  return readList<Message>(MESSAGES_KEY, () => []);
}

function writeFallbackMessages(messages: Message[]): void {
  writeList(MESSAGES_KEY, messages);
}

function readPwdOverrides(): Record<string, string> {
  try {
    return JSON.parse(window.localStorage.getItem(PWD_OVERRIDE_KEY) || '{}') as Record<string, string>;
  } catch {
    return {};
  }
}

function readProfiles(): UserProfile[] {
  return readList<UserProfile>(PROFILES_KEY, () => {
    const now = new Date().toISOString();
    return Object.entries(FALLBACK_ACCOUNTS).map(([email, { name }]) => ({
      email,
      name,
      photoDataUrl: '',
      presenceText: '',
      updatedAt: now,
    }));
  });
}

function getFallbackProfile(email: string): UserProfile {
  const key = email.trim().toLowerCase();
  const found = readProfiles().find((p) => p.email === key);
  if (found) return found;
  return {
    email: key,
    name: FALLBACK_ACCOUNTS[key]?.name ?? key,
    photoDataUrl: '',
    presenceText: '',
    updatedAt: new Date().toISOString(),
  };
}

function readPrefs(): Record<string, NotificationPrefs> {
  try {
    return JSON.parse(window.localStorage.getItem(PREFS_KEY) || '{}') as Record<string, NotificationPrefs>;
  } catch {
    return {};
  }
}

/** Seed mirrors the SQLite seed so the browser fallback shows the same data. */
function seedClients(): Client[] {
  return [
    {
      id: 1,
      name: 'Mohamed Bensalah',
      company: 'G20 Corvetto',
      status: 'active',
      email: 'contact@g20corvetto.it',
      phone: '+39 02 1234 5678',
      notes:
        'Client historique. Sensible aux temps de réponse en soirée (pic e-commerce). Préfère un point hebdo le lundi.',
      imageDataUrl: '',
      linkedSiteIds: [],
      createdAt: daysAgo(120),
      updatedAt: daysAgo(2),
      events: [
        { id: 4, clientId: 1, title: 'Incident paiement', detail: 'Latence PSP traitée en 40 min.', date: daysAgo(2) },
        { id: 3, clientId: 1, title: 'Renouvellement contrat', detail: 'Contrat annuel reconduit.', date: daysAgo(30) },
        { id: 2, clientId: 1, title: 'Audit sécurité initial', detail: 'Correction de 4 vulnérabilités, durcissement WAF.', date: daysAgo(96) },
        { id: 1, clientId: 1, title: 'Onboarding', detail: 'Mise en place de la supervision des 2 domaines.', date: daysAgo(120) },
      ],
    },
    {
      id: 2,
      name: 'Sarah Lemaire',
      company: 'Atlas Retail',
      status: 'prospect',
      email: 's.lemaire@atlas-retail.fr',
      phone: '+33 6 12 34 56 78',
      notes: 'Prospect entrant via recommandation. Devis supervision + audit envoyé.',
      imageDataUrl: '',
      linkedSiteIds: [],
      createdAt: daysAgo(14),
      updatedAt: daysAgo(5),
      events: [
        { id: 6, clientId: 2, title: 'Devis envoyé', detail: 'Offre supervision + audit initial.', date: daysAgo(5) },
        { id: 5, clientId: 2, title: 'Premier contact', detail: 'Appel de découverte, 3 sites à superviser.', date: daysAgo(14) },
      ],
    },
  ];
}

function seedQuotes(): Quote[] {
  return [
    {
      id: 1,
      clientId: 1,
      title: 'Supervision annuelle + audit initial',
      detail: 'Mise en place du tracker Sentinel sur 2 domaines, audit sécurité initial, suivi mensuel.',
      trackerTier: 'sentinel',
      priceEuro: 2400,
      status: 'accepted',
      paymentStatus: 'paid',
      createdAt: daysAgo(96),
      updatedAt: daysAgo(90),
    },
    {
      id: 2,
      clientId: 2,
      title: 'Supervision + audit initial',
      detail: 'Déploiement Sentinel sur 3 sites, audit initial, rapport de synthèse.',
      trackerTier: 'sentinel',
      priceEuro: 1800,
      status: 'sent',
      paymentStatus: 'unpaid',
      createdAt: daysAgo(5),
      updatedAt: daysAgo(5),
    },
  ];
}

function seedTasks(): SharedTask[] {
  return [
    {
      id: 1,
      title: 'Relancer Atlas Retail sur le devis envoyé',
      detail: '',
      assigneeEmail: 'aaron@amn-devsec.com',
      status: 'todo',
      siteId: null,
      clientId: 2,
      createdAt: daysAgo(10),
      updatedAt: daysAgo(10),
    },
    {
      id: 2,
      title: 'Vérifier le certificat SSL du site principal',
      detail: 'Expire dans 3 semaines.',
      assigneeEmail: 'mohamed@amn-devsec.com',
      status: 'doing',
      siteId: null,
      clientId: null,
      createdAt: daysAgo(9),
      updatedAt: daysAgo(9),
    },
    {
      id: 3,
      title: 'Rédiger le rapport mensuel G20 Corvetto',
      detail: '',
      assigneeEmail: 'aaron@amn-devsec.com',
      status: 'done',
      siteId: null,
      clientId: 1,
      createdAt: daysAgo(8),
      updatedAt: daysAgo(8),
    },
  ];
}

function seedDecisions(): Decision[] {
  return [
    {
      id: 1,
      title: 'Adoption de Supabase (plan gratuit) pour amn-api',
      detail:
        'Évite un coût récurrent tant que le volume reste faible ; migration vers un plan payant possible sans changement de code (client pg standard).',
      authorEmail: 'aaron@amn-devsec.com',
      authorName: 'Aaron',
      createdAt: daysAgo(20),
    },
    {
      id: 2,
      title: 'Tarif de base Sentinel fixé à 1800–2400 €/an selon nombre de sites',
      detail: 'Aligné sur le temps de mise en place + suivi mensuel estimé.',
      authorEmail: 'mohamed@amn-devsec.com',
      authorName: 'Mohamed',
      createdAt: daysAgo(7),
    },
  ];
}

function seedKnowledge(): KnowledgeDoc[] {
  const now = new Date().toISOString();
  return [
    {
      id: 1,
      title: 'Installation du tracker (procédure)',
      body: '1. npm install @amn-devsec/security-monitor\n2. Enregistrer le site depuis AMN Desktop (onglet Sites) pour obtenir la clé API\n3. Ajouter AMN_API_URL et AMN_API_KEY dans le .env du site client\n4. const tracker = createTracker(); app.use(tracker.middleware()); tracker.start();\n5. Vérifier dans AMN Desktop que le site passe "en ligne" après le premier heartbeat.',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 2,
      title: 'Modèle — email de relance devis',
      body: 'Objet : Suite à notre devis du [date]\n\nBonjour [prénom],\n\nJe reviens vers vous concernant le devis envoyé le [date] pour [mission]. Restez-vous disponible cette semaine pour un point rapide ?\n\nBien à vous,\n[signature]',
      createdAt: now,
      updatedAt: now,
    },
  ];
}

function seedLearningGoals(): LearningGoal[] {
  const now = new Date().toISOString();
  return [
    {
      id: 1,
      ownerEmail: 'aaron@amn-devsec.com',
      title: 'Certification OSCP',
      platform: 'TryHackMe',
      progressPct: 35,
      targetDate: null,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 2,
      ownerEmail: 'mohamed@amn-devsec.com',
      title: 'AWS Certified Security',
      platform: 'A Cloud Guru',
      progressPct: 60,
      targetDate: null,
      createdAt: now,
      updatedAt: now,
    },
  ];
}

function seedObjectives(): Objective[] {
  const now = new Date().toISOString();
  const period = new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  return [
    { id: 1, label: 'Chiffre d’affaires visé', unit: '€', targetValue: 6000, currentValue: 2400, periodLabel: period, updatedAt: now },
    { id: 2, label: 'Nouveaux clients visés', unit: 'clients', targetValue: 3, currentValue: 1, periodLabel: period, updatedAt: now },
  ];
}

function readFallbackClients(): Client[] {
  try {
    const raw = window.localStorage.getItem(CLIENTS_KEY);
    if (raw) return JSON.parse(raw) as Client[];
  } catch {
    /* fall through to seed */
  }
  const seeded = seedClients();
  window.localStorage.setItem(CLIENTS_KEY, JSON.stringify(seeded));
  return seeded;
}

function writeFallbackClients(clients: Client[]): void {
  window.localStorage.setItem(CLIENTS_KEY, JSON.stringify(clients));
}

function nextId(items: { id: number }[]): number {
  return items.reduce((max, i) => Math.max(max, i.id), 0) + 1;
}

const RECONNECT_DELAYS_MS = [1000, 2000, 5000, 10000, 20000, 30000];

/**
 * Browser-fallback amn-api client: talks to amn-api directly via fetch/
 * WebSocket, using VITE_-prefixed env vars (see src/vite-env.d.ts for why
 * this is dev/test-only, unlike the Electron path which proxies through the
 * main process and never exposes the token to the renderer).
 */
function createBrowserRemote(): AmnBridge['remote'] {
  const apiUrl = (import.meta.env.VITE_AMN_API_URL || '').replace(/\/$/, '');
  const token = import.meta.env.VITE_AMN_API_OPERATOR_TOKEN || '';
  const configured = Boolean(apiUrl && token);

  const eventListeners = new Set<(push: RemoteEventPush) => void>();
  const statusListeners = new Set<(status: RemoteConnectionStatus) => void>();
  const recordListeners = new Set<(record: RemoteRecord) => void>();
  const presenceListeners = new Set<(users: PresenceEntry[]) => void>();
  let status: RemoteConnectionStatus = configured ? 'connecting' : 'unconfigured';
  let reconnectAttempt = 0;
  let started = false;
  let identity: string | null = null;
  let socket: WebSocket | null = null;

  function setStatus(next: RemoteConnectionStatus) {
    if (status === next) return;
    status = next;
    for (const listener of statusListeners) listener(next);
  }

  function connect() {
    const base = `${apiUrl.replace(/^http/, 'ws')}/v1/stream?token=${encodeURIComponent(token)}`;
    const wsUrl = identity ? `${base}&user=${encodeURIComponent(identity)}` : base;
    socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      reconnectAttempt = 0;
      setStatus('online');
    };
    socket.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        if (parsed?.type === 'event') {
          for (const listener of eventListeners) listener(parsed as RemoteEventPush);
        } else if (parsed?.type === 'record' && parsed.record) {
          for (const listener of recordListeners) listener(parsed.record as RemoteRecord);
        } else if (parsed?.type === 'presence' && Array.isArray(parsed.users)) {
          for (const listener of presenceListeners) listener(parsed.users as PresenceEntry[]);
        }
      } catch {
        // Ignore malformed frames.
      }
    };
    socket.onclose = () => {
      setStatus('offline');
      const delay = RECONNECT_DELAYS_MS[Math.min(reconnectAttempt, RECONNECT_DELAYS_MS.length - 1)];
      reconnectAttempt += 1;
      setTimeout(connect, delay);
    };
    socket.onerror = () => socket?.close();
  }

  async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(`${apiUrl}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...init.headers,
      },
    });
    if (!res.ok) throw new Error(`amn-api ${res.status} ${res.statusText}`);
    return res.json() as Promise<T>;
  }

  return {
    async listSites(): Promise<RemoteSite[]> {
      const { sites } = await apiFetch<{ sites: RemoteSite[] }>('/v1/sites');
      return sites;
    },
    async getSiteEvents(siteId, opts = {}): Promise<RemoteEvent[]> {
      const params = new URLSearchParams();
      if (opts.since) params.set('since', opts.since);
      if (opts.limit) params.set('limit', String(opts.limit));
      const qs = params.toString();
      const { events } = await apiFetch<{ events: RemoteEvent[] }>(
        `/v1/sites/${siteId}/events${qs ? `?${qs}` : ''}`,
      );
      return events;
    },
    async registerSite(name: string): Promise<RegisterSiteResult> {
      return apiFetch<RegisterSiteResult>('/v1/sites', {
        method: 'POST',
        body: JSON.stringify({ name }),
      });
    },
    async updateSite(id: string, name: string): Promise<RemoteSite> {
      const { site } = await apiFetch<{ site: RemoteSite }>(`/v1/sites/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ name }),
      });
      return site;
    },
    async deleteSite(id: string): Promise<void> {
      await apiFetch<{ ok: boolean }>(`/v1/sites/${id}`, { method: 'DELETE' });
    },
    async getConnectionStatus(): Promise<RemoteConnectionStatus> {
      return status;
    },
    onEvent(callback) {
      eventListeners.add(callback);
      ensureStarted();
      return () => eventListeners.delete(callback);
    },
    onConnectionStatusChange(callback) {
      statusListeners.add(callback);
      ensureStarted();
      return () => statusListeners.delete(callback);
    },
    async listRecords(collection) {
      const { records } = await apiFetch<{ records: RemoteRecord[] }>(`/v1/collections/${collection}`);
      return records;
    },
    async upsertRecord(collection, id, data) {
      const { record } = await apiFetch<{ record: RemoteRecord }>(
        `/v1/collections/${collection}/${encodeURIComponent(id)}`,
        { method: 'PUT', body: JSON.stringify({ data }) },
      );
      return record;
    },
    async deleteRecord(collection, id) {
      const { record } = await apiFetch<{ record: RemoteRecord }>(
        `/v1/collections/${collection}/${encodeURIComponent(id)}`,
        { method: 'DELETE' },
      );
      return record;
    },
    onRecord(callback) {
      recordListeners.add(callback);
      ensureStarted();
      return () => recordListeners.delete(callback);
    },
    setIdentity(email) {
      const next = email ? email.trim().toLowerCase() : null;
      if (next === identity) return;
      identity = next;
      if (configured && started) socket?.close(); // reconnect with new ?user=
    },
    async getPresence() {
      if (!configured) return [];
      const { users } = await apiFetch<{ users: PresenceEntry[] }>('/v1/collections/_presence');
      return users;
    },
    onPresence(callback) {
      presenceListeners.add(callback);
      ensureStarted();
      return () => presenceListeners.delete(callback);
    },
  };

  function ensureStarted() {
    if (configured && !started) {
      started = true;
      connect();
    }
  }
}

function createBrowserBridge(): AmnBridge {
  return {
    auth: {
      async login(email: string, password: string): Promise<AuthResult> {
        const key = email.trim().toLowerCase();
        const account = FALLBACK_ACCOUNTS[key];
        if (!account) return { ok: false, error: 'Email ou mot de passe incorrect.' };
        const bcrypt = (await import('bcryptjs')).default;
        const overrides = readPwdOverrides();
        const hash = overrides[key] ?? account.hash;
        if (!bcrypt.compareSync(password, hash)) {
          return { ok: false, error: 'Email ou mot de passe incorrect.' };
        }
        return { ok: true, user: { id: 0, email: key, name: account.name } };
      },
      async changePassword(input): Promise<ChangePasswordResult> {
        const key = input.email.trim().toLowerCase();
        const account = FALLBACK_ACCOUNTS[key];
        if (!account) return { ok: false, error: 'Compte introuvable.' };
        const bcrypt = (await import('bcryptjs')).default;
        const overrides = readPwdOverrides();
        const hash = overrides[key] ?? account.hash;
        if (!bcrypt.compareSync(input.currentPassword, hash)) {
          return { ok: false, error: 'Mot de passe actuel incorrect.' };
        }
        if (input.newPassword.length < 8) {
          return { ok: false, error: 'Le nouveau mot de passe doit faire au moins 8 caractères.' };
        }
        overrides[key] = bcrypt.hashSync(input.newPassword, 10);
        window.localStorage.setItem(PWD_OVERRIDE_KEY, JSON.stringify(overrides));
        return { ok: true };
      },
    },
    profiles: {
      async list(): Promise<UserProfile[]> {
        return readProfiles();
      },
      async get(email: string): Promise<UserProfile> {
        return getFallbackProfile(email);
      },
      async updateSelf(email: string, patch): Promise<UserProfile> {
        const profiles = readProfiles();
        const key = email.trim().toLowerCase();
        const idx = profiles.findIndex((p) => p.email === key);
        const base = idx >= 0 ? profiles[idx] : getFallbackProfile(key);
        const updated: UserProfile = { ...base, ...patch, email: key, updatedAt: new Date().toISOString() };
        const next = idx >= 0 ? profiles.map((p) => (p.email === key ? updated : p)) : [...profiles, updated];
        writeList(PROFILES_KEY, next);
        return updated;
      },
    },
    prefs: {
      async get(email: string): Promise<NotificationPrefs> {
        return readPrefs()[email.trim().toLowerCase()] ?? { ...DEFAULT_NOTIFICATION_PREFS };
      },
      async update(email: string, patch): Promise<NotificationPrefs> {
        const all = readPrefs();
        const key = email.trim().toLowerCase();
        const merged = { ...(all[key] ?? DEFAULT_NOTIFICATION_PREFS), ...patch };
        all[key] = merged;
        window.localStorage.setItem(PREFS_KEY, JSON.stringify(all));
        return merged;
      },
    },
    messages: {
      async list(): Promise<Message[]> {
        return readFallbackMessages();
      },
      async send(input: SendMessageInput): Promise<Message> {
        const messages = readFallbackMessages();
        const account = FALLBACK_ACCOUNTS[input.authorEmail];
        const message: Message = {
          id: (messages.at(-1)?.id ?? 0) + 1,
          authorEmail: input.authorEmail,
          authorName: account?.name ?? input.authorEmail,
          body: input.body,
          createdAt: new Date().toISOString(),
          attachments: input.attachments ?? [],
          replyToId: input.replyToId ?? null,
          reactions: [],
          pinned: false,
        };
        writeFallbackMessages([...messages, message]);
        return message;
      },
      async react(id: number, emoji: string, authorEmail: string): Promise<Message> {
        const messages = readFallbackMessages();
        const idx = messages.findIndex((m) => m.id === id);
        if (idx < 0) throw new Error(`Message ${id} introuvable`);
        const exists = messages[idx].reactions.some(
          (r) => r.emoji === emoji && r.authorEmail === authorEmail,
        );
        const reactions: MessageReaction[] = exists
          ? messages[idx].reactions.filter((r) => !(r.emoji === emoji && r.authorEmail === authorEmail))
          : [...messages[idx].reactions, { emoji, authorEmail }];
        messages[idx] = { ...messages[idx], reactions };
        writeFallbackMessages(messages);
        return messages[idx];
      },
      async setPinned(id: number, pinned: boolean): Promise<Message> {
        const messages = readFallbackMessages();
        const idx = messages.findIndex((m) => m.id === id);
        if (idx < 0) throw new Error(`Message ${id} introuvable`);
        messages[idx] = { ...messages[idx], pinned };
        writeFallbackMessages(messages);
        return messages[idx];
      },
    },
    clients: {
      async list(): Promise<Client[]> {
        return readFallbackClients().sort((a, b) =>
          a.name.localeCompare(b.name, 'fr'),
        );
      },
      async create(input: CreateClientInput): Promise<Client> {
        const clients = readFallbackClients();
        const now = new Date().toISOString();
        const client: Client = {
          id: nextId(clients),
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
        writeFallbackClients([...clients, client]);
        return client;
      },
      async update(id: number, patch: UpdateClientInput): Promise<Client> {
        const clients = readFallbackClients();
        const idx = clients.findIndex((c) => c.id === id);
        if (idx < 0) throw new Error(`Client ${id} introuvable`);
        const updated: Client = {
          ...clients[idx],
          ...patch,
          updatedAt: new Date().toISOString(),
        };
        clients[idx] = updated;
        writeFallbackClients(clients);
        return updated;
      },
      async addEvent(input: AddClientEventInput): Promise<Client> {
        const clients = readFallbackClients();
        const idx = clients.findIndex((c) => c.id === input.clientId);
        if (idx < 0) throw new Error(`Client ${input.clientId} introuvable`);
        const allEvents = clients.flatMap((c) => c.events);
        const event = {
          id: nextId(allEvents),
          clientId: input.clientId,
          title: input.title,
          detail: input.detail ?? '',
          date: new Date().toISOString(),
        };
        clients[idx] = {
          ...clients[idx],
          events: [event, ...clients[idx].events],
          updatedAt: event.date,
        };
        writeFallbackClients(clients);
        return clients[idx];
      },
    },
    quotes: {
      async list(): Promise<Quote[]> {
        return readList<Quote>(QUOTES_KEY, seedQuotes).sort((a, b) =>
          b.createdAt.localeCompare(a.createdAt),
        );
      },
      async create(input: CreateQuoteInput): Promise<Quote> {
        const quotes = readList<Quote>(QUOTES_KEY, seedQuotes);
        const now = new Date().toISOString();
        const quote: Quote = {
          id: nextId(quotes),
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
        writeList(QUOTES_KEY, [...quotes, quote]);
        return quote;
      },
      async update(id: number, patch: UpdateQuoteInput): Promise<Quote> {
        const quotes = readList<Quote>(QUOTES_KEY, seedQuotes);
        const idx = quotes.findIndex((q) => q.id === id);
        if (idx < 0) throw new Error(`Devis ${id} introuvable`);
        quotes[idx] = { ...quotes[idx], ...patch, updatedAt: new Date().toISOString() };
        writeList(QUOTES_KEY, quotes);
        return quotes[idx];
      },
      async remove(id: number): Promise<void> {
        const quotes = readList<Quote>(QUOTES_KEY, seedQuotes);
        writeList(QUOTES_KEY, quotes.filter((q) => q.id !== id));
      },
    },
    tasks: {
      async list(): Promise<SharedTask[]> {
        return readList<SharedTask>(TASKS_KEY, seedTasks).sort((a, b) =>
          b.createdAt.localeCompare(a.createdAt),
        );
      },
      async create(input: CreateSharedTaskInput): Promise<SharedTask> {
        const tasks = readList<SharedTask>(TASKS_KEY, seedTasks);
        const now = new Date().toISOString();
        const task: SharedTask = {
          id: nextId(tasks),
          title: input.title,
          detail: input.detail ?? '',
          assigneeEmail: input.assigneeEmail,
          status: 'todo',
          siteId: input.siteId ?? null,
          clientId: input.clientId ?? null,
          createdAt: now,
          updatedAt: now,
        };
        writeList(TASKS_KEY, [...tasks, task]);
        return task;
      },
      async update(id: number, patch: UpdateSharedTaskInput): Promise<SharedTask> {
        const tasks = readList<SharedTask>(TASKS_KEY, seedTasks);
        const idx = tasks.findIndex((t) => t.id === id);
        if (idx < 0) throw new Error(`Tâche ${id} introuvable`);
        tasks[idx] = { ...tasks[idx], ...patch, updatedAt: new Date().toISOString() };
        writeList(TASKS_KEY, tasks);
        return tasks[idx];
      },
      async remove(id: number): Promise<void> {
        const tasks = readList<SharedTask>(TASKS_KEY, seedTasks);
        writeList(TASKS_KEY, tasks.filter((t) => t.id !== id));
      },
    },
    decisions: {
      async list(): Promise<Decision[]> {
        return readList<Decision>(DECISIONS_KEY, seedDecisions).sort((a, b) =>
          b.createdAt.localeCompare(a.createdAt),
        );
      },
      async create(input: CreateDecisionInput): Promise<Decision> {
        const decisions = readList<Decision>(DECISIONS_KEY, seedDecisions);
        const account = FALLBACK_ACCOUNTS[input.authorEmail];
        const decision: Decision = {
          id: nextId(decisions),
          title: input.title,
          detail: input.detail ?? '',
          authorEmail: input.authorEmail,
          authorName: account?.name ?? input.authorEmail,
          createdAt: new Date().toISOString(),
        };
        writeList(DECISIONS_KEY, [...decisions, decision]);
        return decision;
      },
      async remove(id: number): Promise<void> {
        const decisions = readList<Decision>(DECISIONS_KEY, seedDecisions);
        writeList(DECISIONS_KEY, decisions.filter((d) => d.id !== id));
      },
    },
    knowledge: {
      async list(): Promise<KnowledgeDoc[]> {
        return readList<KnowledgeDoc>(KNOWLEDGE_KEY, seedKnowledge).sort((a, b) =>
          a.title.localeCompare(b.title, 'fr'),
        );
      },
      async create(input: CreateKnowledgeDocInput): Promise<KnowledgeDoc> {
        const docs = readList<KnowledgeDoc>(KNOWLEDGE_KEY, seedKnowledge);
        const now = new Date().toISOString();
        const doc: KnowledgeDoc = {
          id: nextId(docs),
          title: input.title,
          body: input.body ?? '',
          createdAt: now,
          updatedAt: now,
        };
        writeList(KNOWLEDGE_KEY, [...docs, doc]);
        return doc;
      },
      async update(id: number, patch: UpdateKnowledgeDocInput): Promise<KnowledgeDoc> {
        const docs = readList<KnowledgeDoc>(KNOWLEDGE_KEY, seedKnowledge);
        const idx = docs.findIndex((d) => d.id === id);
        if (idx < 0) throw new Error(`Document ${id} introuvable`);
        docs[idx] = { ...docs[idx], ...patch, updatedAt: new Date().toISOString() };
        writeList(KNOWLEDGE_KEY, docs);
        return docs[idx];
      },
      async remove(id: number): Promise<void> {
        const docs = readList<KnowledgeDoc>(KNOWLEDGE_KEY, seedKnowledge);
        writeList(KNOWLEDGE_KEY, docs.filter((d) => d.id !== id));
      },
    },
    checklist: {
      async getState(): Promise<ChecklistStateEntry[]> {
        return readList<ChecklistStateEntry>(CHECKLIST_KEY, () => []);
      },
      async check(itemId: string): Promise<ChecklistStateEntry> {
        const state = readList<ChecklistStateEntry>(CHECKLIST_KEY, () => []);
        const now = new Date().toISOString();
        const idx = state.findIndex((s) => s.itemId === itemId);
        const entry: ChecklistStateEntry = { itemId, lastCheckedAt: now };
        if (idx < 0) state.push(entry);
        else state[idx] = entry;
        writeList(CHECKLIST_KEY, state);
        return entry;
      },
    },
    learning: {
      async list(): Promise<LearningGoal[]> {
        return readList<LearningGoal>(LEARNING_KEY, seedLearningGoals);
      },
      async create(input: CreateLearningGoalInput): Promise<LearningGoal> {
        const goals = readList<LearningGoal>(LEARNING_KEY, seedLearningGoals);
        const now = new Date().toISOString();
        const goal: LearningGoal = {
          id: nextId(goals),
          ownerEmail: input.ownerEmail,
          title: input.title,
          platform: input.platform ?? '',
          progressPct: input.progressPct ?? 0,
          targetDate: input.targetDate ?? null,
          createdAt: now,
          updatedAt: now,
        };
        writeList(LEARNING_KEY, [...goals, goal]);
        return goal;
      },
      async update(id: number, patch: UpdateLearningGoalInput): Promise<LearningGoal> {
        const goals = readList<LearningGoal>(LEARNING_KEY, seedLearningGoals);
        const idx = goals.findIndex((g) => g.id === id);
        if (idx < 0) throw new Error(`Objectif d’apprentissage ${id} introuvable`);
        goals[idx] = { ...goals[idx], ...patch, updatedAt: new Date().toISOString() };
        writeList(LEARNING_KEY, goals);
        return goals[idx];
      },
      async remove(id: number): Promise<void> {
        const goals = readList<LearningGoal>(LEARNING_KEY, seedLearningGoals);
        writeList(LEARNING_KEY, goals.filter((g) => g.id !== id));
      },
    },
    objectives: {
      async list(): Promise<Objective[]> {
        return readList<Objective>(OBJECTIVES_KEY, seedObjectives);
      },
      async update(id: number, patch: UpdateObjectiveInput): Promise<Objective> {
        const objectives = readList<Objective>(OBJECTIVES_KEY, seedObjectives);
        const idx = objectives.findIndex((o) => o.id === id);
        if (idx < 0) throw new Error(`Objectif ${id} introuvable`);
        objectives[idx] = { ...objectives[idx], ...patch, updatedAt: new Date().toISOString() };
        writeList(OBJECTIVES_KEY, objectives);
        return objectives[idx];
      },
    },
    remote: createBrowserRemote(),
    system: {
      notify(input: { title: string; body: string }): void {
        // Best-effort Web Notifications in the browser fallback (dev/test).
        try {
          if (typeof Notification === 'undefined') return;
          if (Notification.permission === 'granted') {
            new Notification(input.title, { body: input.body });
          } else if (Notification.permission !== 'denied') {
            Notification.requestPermission().then((perm) => {
              if (perm === 'granted') new Notification(input.title, { body: input.body });
            });
          }
        } catch {
          /* no-op */
        }
      },
      // OS integration is Electron-only; harmless no-ops in the browser.
      async getAutoLaunch(): Promise<boolean> {
        return false;
      },
      async setAutoLaunch(): Promise<boolean> {
        return false;
      },
      async getAppInfo() {
        return { name: 'AMN Desktop', version: '0.0.0-dev', platform: 'web', isElectron: false };
      },
    },
    watch: {
      // RSS fetching needs the Electron main process (cross-origin). The browser
      // fallback has no feed; the panel shows a clear "desktop-only" state.
      async list() {
        return { items: [], fetchedAt: null, degraded: true };
      },
    },
    env: { isElectron: false },
  };
}

let cached: AmnBridge | null = null;

/** Returns the Electron bridge when available, else the browser fallback. */
export function bridge(): AmnBridge {
  if (cached) return cached;
  cached = window.amn ?? createBrowserBridge();
  return cached;
}
