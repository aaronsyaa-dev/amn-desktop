import type {
  AddClientEventInput,
  AmnBridge,
  AuthResult,
  Client,
  CreateClientInput,
  Message,
  RegisterSiteResult,
  RemoteConnectionStatus,
  RemoteEvent,
  RemoteEventPush,
  RemoteSite,
  SendMessageInput,
  UpdateClientInput,
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

function readFallbackMessages(): Message[] {
  try {
    const raw = window.localStorage.getItem(MESSAGES_KEY);
    return raw ? (JSON.parse(raw) as Message[]) : [];
  } catch {
    return [];
  }
}

function writeFallbackMessages(messages: Message[]): void {
  window.localStorage.setItem(MESSAGES_KEY, JSON.stringify(messages));
}

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86400000).toISOString();
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
      createdAt: daysAgo(14),
      updatedAt: daysAgo(5),
      events: [
        { id: 6, clientId: 2, title: 'Devis envoyé', detail: 'Offre supervision + audit initial.', date: daysAgo(5) },
        { id: 5, clientId: 2, title: 'Premier contact', detail: 'Appel de découverte, 3 sites à superviser.', date: daysAgo(14) },
      ],
    },
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
  let status: RemoteConnectionStatus = configured ? 'connecting' : 'unconfigured';
  let reconnectAttempt = 0;
  let started = false;

  function setStatus(next: RemoteConnectionStatus) {
    if (status === next) return;
    status = next;
    for (const listener of statusListeners) listener(next);
  }

  function connect() {
    const wsUrl = `${apiUrl.replace(/^http/, 'ws')}/v1/stream?token=${encodeURIComponent(token)}`;
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      reconnectAttempt = 0;
      setStatus('online');
    };
    socket.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        if (parsed?.type === 'event') {
          for (const listener of eventListeners) listener(parsed as RemoteEventPush);
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
    socket.onerror = () => socket.close();
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
        const account = FALLBACK_ACCOUNTS[email.trim().toLowerCase()];
        const bcrypt = (await import('bcryptjs')).default;
        if (!account || !bcrypt.compareSync(password, account.hash)) {
          return { ok: false, error: 'Email ou mot de passe incorrect.' };
        }
        return {
          ok: true,
          user: { id: 0, email: email.trim().toLowerCase(), name: account.name },
        };
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
        };
        writeFallbackMessages([...messages, message]);
        return message;
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
    remote: createBrowserRemote(),
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
