import {
  API_UNREACHABLE_PREFIX,
  DEFAULT_NOTIFICATION_PREFS,
  GUEST_QUOTA_PREFIX,
  marquerStatut,
} from '../shared/api';
import { APP_VERSION, EDITION_PRODUCT_NAME, IS_BUSINESS } from '../edition/edition';
import { showLocalNotification } from './webPush';
import {
  FALLBACK_ACCOUNTS,
  seedClients,
  seedDecisions,
  seedKnowledge,
  seedLearningGoals,
  seedObjectives,
  seedQuotes,
  seedTasks,
} from '@edition/seeds';
import { browserExclusiveBridge, createBrowserExclusive } from '@edition/browserExclusive';
import type {
  ActiveSession,
  CallLink,
  CreatedCallLink,
  ModuleOffer,
  ModuleRequest,
  MemberInvitation,
  OrgMember,
  UserRole,
  OrgAccessRecord,
  AddClientEventInput,
  AmnBridge,
  AuthResult,
  ChangePasswordResult,
  NotificationPrefs,
  OrgIdentity,
  RemoteSession,
  RemoteSessionUser,
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
  RemoteConnectionStatus,
  RemoteEventPush,
  SendMessageInput,
  SharedTask,
  UpdateClientInput,
  UpdateKnowledgeDocInput,
  UpdateLearningGoalInput,
  UpdateObjectiveInput,
  UpdateQuoteInput,
  UpdateSharedTaskInput,
  VaultEntry,
  LoginOutcome,
  MfaEnrolment,
  MfaStatus,
  SupportRequest,
  WelcomePreview,
  WelcomeAccess,
  WelcomeLinkState,
} from '../shared/api';

declare global {
  interface Window {
    amn?: AmnBridge;
  }
}

/**
 * Per-platform stores that predate the synced collections.
 *
 * They are kept READ-ONLY, as the migration source for installs that still
 * hold data in them (see src/state/useClients.ts). Nothing may start writing a
 * synced collection through one of these again: that is precisely what made
 * the web build and Electron read two different databases for Clients, and
 * scripts/check-sync-parity.mjs fails on any collection that is both synced
 * and absent from this list.
 */
export const LEGACY_MIGRATION_ONLY_STORES = [
  'tasks',
  'decisions',
  'knowledge',
  'objectives',
  'messages',
  'profiles',
  'clients',
  'quotes',
] as const;

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
// A distinct `amn.vault.` namespace (not `amn.fallback.`) marks this key as
// what it is: plain localStorage, never synced to amn-api, never touched by
// the sync machinery the `fallback` keys above stand in for.
const VAULT_KEY = 'amn.vault.entries';

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
  // Prefer the scoped web token (VITE_AMN_API_WEB_TOKEN) so the public web/PWA
  // build never has to embed the full desktop operator token. The operator
  // token is only a dev/local fallback; production web deploys set the web one.
  //
  // L'édition Business n'en prend AUCUN, et pas par convention : `IS_BUSINESS`
  // est une constante remplacée à la compilation, donc Rollup supprime la
  // branche entière et les deux `import.meta.env.*` avec elle. Une variable
  // `VITE_AMN_API_WEB_TOKEN` présente par erreur dans l'environnement de build
  // d'une cliente ne peut donc pas se retrouver inlinée dans SON bundle — qui
  // est un fichier public servi par HTTPS, lisible par quiconque a l'URL. Son
  // seul justificatif est la session obtenue à la connexion.
  const token = IS_BUSINESS
    ? ''
    : import.meta.env.VITE_AMN_API_WEB_TOKEN || import.meta.env.VITE_AMN_API_OPERATOR_TOKEN || '';
  // "Configured" means a backend URL was set — i.e. this deployment intends to
  // sync, as opposed to a genuine standalone/dev build with no amn-api at all.
  // Requiring the token too was a bug: on the web/PWA build, if VITE_AMN_API_URL
  // is set but VITE_AMN_API_WEB_TOKEN is missing/misnamed at build time, the
  // badge got stuck on "Local" forever (the initial-only 'unconfigured' state —
  // setStatus() never re-emits it) even though the app clearly intends to sync
  // and Sites/Tasks/etc. could still show stale/cached data, making the badge
  // actively misleading. With only `apiUrl` required, the WS/HTTP calls are
  // attempted regardless; a genuinely bad or missing token now surfaces as an
  // honest, actionable "Hors ligne" (WS closes 4401) instead of a silent "Local".
  const configured = Boolean(apiUrl);

  /**
   * Jeton de session de l'utilisateur connecté. Il prend le pas sur le jeton
   * partagé du build : c'est lui qui porte l'organisation, donc les données
   * visibles. Vide tant que personne ne s'est connecté.
   */
  let sessionToken = '';
  /**
   * Jeton de session de SUPPORT — présent uniquement pendant qu'AMN Desktop
   * travaille dans le dossier d'une organisation cliente. Il recouvre la
   * session de l'opérateur sans l'effacer : la console d'administration
   * continue de partir avec celle-ci (`ownerCredential`), comme côté Electron.
   */
  let supportToken = '';
  const credential = () => supportToken || sessionToken || token;
  const ownerCredential = () => sessionToken || token;

  const eventListeners = new Set<(push: RemoteEventPush) => void>();
  const statusListeners = new Set<(status: RemoteConnectionStatus) => void>();
  const recordListeners = new Set<(record: RemoteRecord) => void>();
  const presenceListeners = new Set<(users: PresenceEntry[]) => void>();
  /** Abonnés par type de trame WebSocket — voir le dispatch plus bas. */
  const frameListeners = new Map<string, Set<(frame: Record<string, unknown>) => void>>();
  let status: RemoteConnectionStatus = configured ? 'connecting' : 'unconfigured';
  let reconnectAttempt = 0;
  let started = false;
  let identity: string | null = null;
  let socket: WebSocket | null = null;
  // See the Electron client: a close we asked for ourselves must not be
  // reported as "Serveur injoignable".
  let reconnectingOnPurpose = false;

  function setStatus(next: RemoteConnectionStatus) {
    if (status === next) return;
    status = next;
    for (const listener of statusListeners) listener(next);
  }

  function connect() {
    const base = `${apiUrl.replace(/^http/, 'ws')}/v1/stream?token=${encodeURIComponent(credential())}`;
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
        } else {
          // Toute autre trame part vers les abonnés de son type. Comme dans le
          // process main, ce pont est un transport : il ne connaît pas le nom
          // des produits qui passent dedans, et ces noms ne se retrouvent donc
          // pas dans le bundle d'une édition qui ne les a pas.
          const listeners = frameListeners.get(String(parsed?.type ?? ''));
          if (listeners) for (const listener of listeners) listener(parsed as Record<string, unknown>);
        }
      } catch {
        // Ignore malformed frames.
      }
    };
    socket.onclose = () => {
      /*
        UNE POIGNÉE DE MAIN VOLONTAIRE N'EST PAS UNE COUPURE.

        MESURÉ en entrant dans le contexte d'une organisation cliente : 58
        requêtes `/v1/collections/` au lieu de 29. La moitié était une
        relecture COMPLÈTE de l'espace de l'opérateur — vingt-huit collections
        qu'il venait de charger et qui n'avaient pas changé.

        La cause était ici. Changer de justificatif referme la socket et la
        rouvre aussitôt ; en passant par « connecting » puis « online », le
        contexte de synchronisation lisait une reconnexion (`lastStatus !==
        'online'`) et relançait `pullAll()` sur CHAQUE espace monté.

        On ne signale donc plus ce clignotement. Il ne dure que le temps d'un
        aller-retour, aucune donnée n'est perdue, et l'espace client qui vient
        de se monter fait son propre chargement de toute façon. Si la reprise
        échoue vraiment, `reconnectingOnPurpose` est déjà retombé et le
        prochain `onclose` passera par le chemin normal : « offline », puis
        relecture — celle-là légitime.
      */
      if (reconnectingOnPurpose) {
        reconnectingOnPurpose = false;
        setTimeout(connect, 0);
        return;
      }
      setStatus('offline');
      const delay = RECONNECT_DELAYS_MS[Math.min(reconnectAttempt, RECONNECT_DELAYS_MS.length - 1)];
      reconnectAttempt += 1;
      setTimeout(connect, delay);
    };
    socket.onerror = () => socket?.close();
  }

  async function apiFetch<T>(
    path: string,
    init: RequestInit & { owner?: boolean } = {},
  ): Promise<T> {
    const { owner, ...request } = init;
    const res = await fetch(`${apiUrl}${path}`, {
      ...request,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${owner ? ownerCredential() : credential()}`,
        ...init.headers,
      },
    });
    if (!res.ok) {
      // Surface amn-api's own message when it sends one. Without this the UI
      // could only show "amn-api 400 Bad Request", hiding actionable errors
      // like a refused private scan target or an unknown tier.
      const body = await res
        .json()
        .then((parsed: { error?: string; code?: string; quota?: unknown }) => parsed)
        .catch(() => undefined);
      const detail = body?.error;
      /*
        Quota d'invité épuisé — le MÊME traitement que dans le client du
        process main (src/main/remoteApi.ts).

        Ce doublon n'en est pas un par négligence : `AmnBridge` a deux
        implémentations, Electron et navigateur, et c'est la version navigateur
        que sert la PWA. Ne traiter le cas que d'un côté donnait exactement ce
        qu'on a mesuré : le serveur refusait bien (38 réponses 403), et
        l'application restait ouverte en échouant en silence à chaque geste.
      */
      if (body?.code === 'guest_quota_exhausted') {
        throw new Error(`${GUEST_QUOTA_PREFIX}${JSON.stringify(body.quota ?? {})}|${detail ?? ''}`);
      }
      /*
        Le code voyage dans le message : c'est la file d'envoi qui le lit, pour
        distinguer « plus tard » (503, on renvoie) de « non » (422, on sort et
        on le dit). Sans lui il ne resterait qu'à reconnaître le refus à sa
        phrase, qui est écrite pour un humain et change au premier mot
        reformulé. `cleanErrorMessage` le retire avant affichage.
      */
      throw new Error(marquerStatut(detail || `amn-api ${res.status} ${res.statusText}`, res.status));
    }
    return res.json() as Promise<T>;
  }

  /** Lecture publique (lien de bienvenue) : aucune session n'existe encore. */
  async function publicGet<T>(path: string): Promise<T> {
    if (!apiUrl) {
      throw new Error(`${API_UNREACHABLE_PREFIX}L'API centrale (amn-api) n'est pas configurée pour cette build.`);
    }
    let res: Response;
    try {
      res = await fetch(`${apiUrl}${path}`);
    } catch {
      throw new Error(`${API_UNREACHABLE_PREFIX}amn-api est injoignable depuis ce navigateur (réseau ou URL).`);
    }
    // Un lien inconnu répond 404 avec un corps utile ({ status: 'expired' }) :
    // la page doit le lire, pas le prendre pour une panne.
    const body = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
    if (!res.ok && !(body && 'status' in (body as object))) {
      throw new Error(body?.error || `amn-api ${res.status} ${res.statusText}`);
    }
    return body as T;
  }

  /** Requête publique (connexion) : aucune session n'existe encore. */
  async function publicPost<T>(path: string, body: unknown, bearer?: string): Promise<T> {
    if (!apiUrl) {
      throw new Error(
        `${API_UNREACHABLE_PREFIX}L'API centrale (amn-api) n'est pas configurée pour cette build.`,
      );
    }
    let res: Response;
    try {
      res = await fetch(`${apiUrl}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
        },
        body: JSON.stringify(body),
      });
    } catch {
      // Voir le client du process main : seule une requête qui n'arrive jamais
      // porte ce marqueur. Un refus d'amn-api est une réponse, pas une panne.
      throw new Error(
        `${API_UNREACHABLE_PREFIX}amn-api est injoignable depuis ce navigateur (réseau ou URL). Réessayez une fois la connexion revenue.`,
      );
    }
    if (!res.ok) {
      const detail = await res
        .json()
        .then((b: { error?: string }) => b?.error)
        .catch(() => undefined);
      throw new Error(detail || `amn-api ${res.status} ${res.statusText}`);
    }
    return res.json() as Promise<T>;
  }

  /**
   * Rebranche la WebSocket sur le nouveau justificatif. Sans cette reprise, le
   * flux temps réel resterait celui de l'organisation précédente — exactement
   * la fuite d'un tenant vers l'autre que l'isolation doit empêcher.
   */
  function reconnectWithNewCredential() {
    if (!apiUrl) return;
    if (socket) {
      reconnectingOnPurpose = true;
      socket.close();
    } else if (started) {
      connect();
    }
  }

  function applySession(next: string | null) {
    sessionToken = next ?? '';
    // Changer de session, c'est changer d'opérateur : un contexte client ouvert
    // par le précédent n'a plus de titulaire et ne doit pas lui survivre.
    supportToken = '';
    reconnectWithNewCredential();
  }

  /** Entre dans le dossier d'une organisation cliente, ou en sort (`null`). */
  function applySupportToken(next: string | null) {
    if (supportToken === (next ?? '')) return;
    supportToken = next ?? '';
    reconnectWithNewCredential();
  }

  // Contexte remis à la part exclusive du pont : elle a besoin du transport,
  // pas de la mécanique de reconnexion. Dans l'édition Business, la fabrique
  // ne lit rien de tout ça — elle renvoie un objet vide.
  const exclusiveContext = {
    apiFetch,
    apiUrl,
    token,
    credential,
    ensureStarted,
    socket: () => socket,
    eventListeners,
    onFrame(type: string, listener: (frame: Record<string, unknown>) => void) {
      let set = frameListeners.get(type);
      if (!set) {
        set = new Set();
        frameListeners.set(type, set);
      }
      set.add(listener);
      return () => {
        set?.delete(listener);
      };
    },
    applySupportToken,
    supportToken: () => supportToken,
  };

  return {
    ...createBrowserExclusive(exclusiveContext),
    session: {
      async login(email: string, password: string): Promise<LoginOutcome> {
        const res = await publicPost<
          RemoteSession & { mfaRequired?: boolean; challenge?: string; email?: string }
        >('/v1/auth/login', { email, password });
        // Un défi n'est PAS un justificatif : pas d'`applySession` dessus.
        if (res.mfaRequired && res.challenge) {
          return { kind: 'mfa', challenge: res.challenge, expiresAt: res.expiresAt, email: res.email ?? email };
        }
        applySession(res.token);
        return { kind: 'session', session: res };
      },

      async listMyOrganizations() {
        return apiFetch<import('../shared/api').MyOrganizations>('/v1/auth/organizations');
      },
      async switchOrganization(orgId: string) {
        const res = await apiFetch<RemoteSession & { role: string }>(
          '/v1/auth/organizations/switch',
          { method: 'POST', body: JSON.stringify({ orgId }) },
        );
        // Le serveur a tué l'ancien jeton en réémettant : adopter le nouveau
        // immédiatement, sinon la requête suivante part avec un mort.
        applySession(res.token);
      /*
        Le rôle rendu au PREMIER niveau par `/organizations/switch` est celui
        de l'APPARTENANCE — le seul juste pour l'organisation où l'on entre.
        `res.user.role`, lui, reste celui de l'organisation d'origine.

        On normalise ici pour que le contrat tienne partout : dans une
        `RemoteSession`, `user.role` est TOUJOURS le rôle effectif. Sans cette
        ligne, basculer chez une cliente qui a invité Aaron comme membre lui
        rendrait, à l'écran, ses pouvoirs de propriétaire de chez lui.
      */
        return {
          ...res,
          user: { ...res.user, role: (res.role as RemoteSessionUser['role']) ?? res.user.role },
        };
      },
      async loginMfa(input: { challenge: string; code?: string; backupCode?: string }) {
        const session = await publicPost<RemoteSession>('/v1/auth/login/mfa', input);
        applySession(session.token);
        return session;
      },
      async restore(tokenToCheck: string) {
        if (!apiUrl || !tokenToCheck) return null;
        const previous = sessionToken;
        sessionToken = tokenToCheck;
        try {
          // `auth.role` est le rôle EFFECTIF dans l'organisation active ;
          // `user.role` celui de l'organisation d'origine. Les deux diffèrent
          // dès qu'une session a basculé, et seul le premier fait autorité —
          // même raisonnement, mot pour mot, que dans main/remoteApi.ts.
          const me = await apiFetch<{
            org: OrgIdentity | null;
            user: RemoteSessionUser | null;
            auth?: { role?: RemoteSessionUser['role'] } | null;
          }>('/v1/auth/me');
          if (!me.user || !me.org) throw new Error('session sans utilisateur');
          applySession(tokenToCheck);
          return {
            token: tokenToCheck,
            expiresAt: '',
            user: { ...me.user, role: me.auth?.role ?? me.user.role },
            org: me.org,
          };
        } catch {
          sessionToken = previous;
          return null;
        }
      },
      async acceptInvitation(token: string, password: string): Promise<LoginOutcome> {
        const res = await publicPost<
          RemoteSession & { mfaRequired?: boolean; challenge?: string; email?: string }
        >('/v1/auth/invitations/accept', { token, password });
        if (res.mfaRequired && res.challenge) {
          return { kind: 'mfa', challenge: res.challenge, expiresAt: res.expiresAt, email: res.email ?? '' };
        }
        applySession(res.token);
        return { kind: 'session', session: res };
      },
      async changePassword(currentPassword: string, newPassword: string) {
        await apiFetch<{ ok: boolean }>('/v1/auth/password', {
          method: 'PUT',
          body: JSON.stringify({ currentPassword, newPassword }),
        });
      },
      async clear() {
        if (sessionToken) {
          await publicPost('/v1/auth/logout', {}, sessionToken).catch(() => {
            /* le jeton est abandonné côté client de toute façon */
          });
        }
        applySession(null);
      },
    },
    async getConnectionStatus(): Promise<RemoteConnectionStatus> {
      return status;
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
    async listRecordsBulk(collections) {
      if (collections.length === 0) return {};
      const { collections: rendues } = await apiFetch<{
        collections: Record<string, RemoteRecord[]>;
      }>(`/v1/collections/_bulk?names=${collections.map(encodeURIComponent).join(',')}`);
      return rendues ?? {};
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
      if (configured && started && socket) {
        reconnectingOnPurpose = true;
        socket.close(); // reconnect with new ?user=
      }
    },
    async listSessions(): Promise<ActiveSession[]> {
      const res = await apiFetch<{ sessions: ActiveSession[] }>('/v1/auth/sessions');
      return res.sessions ?? [];
    },
    async revokeSession(id: string): Promise<void> {
      await apiFetch(`/v1/auth/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' });
    },
    async exportOrganization(): Promise<Record<string, unknown>> {
      return apiFetch<Record<string, unknown>>('/v1/auth/organization/export');
    },
    async accessLog(): Promise<OrgAccessRecord[]> {
      const res = await apiFetch<{ entries: OrgAccessRecord[] }>('/v1/auth/access-log');
      return res.entries ?? [];
    },
    async setOrganizationAccent(accent: string | null): Promise<OrgIdentity> {
      const { org } = await apiFetch<{ org: OrgIdentity }>('/v1/auth/organization', {
        method: 'PATCH',
        body: JSON.stringify({ accent }),
      });
      return org;
    },
    mfa: {
      async status() {
        const res = await apiFetch<{ mfa: MfaStatus }>('/v1/auth/mfa');
        return res.mfa;
      },
      setup: () => apiFetch<MfaEnrolment>('/v1/auth/mfa/setup', { method: 'POST' }),
      activate: (code: string) =>
        apiFetch<{ backupCodes: string[]; mfa: MfaStatus }>('/v1/auth/mfa/activate', {
          method: 'POST',
          body: JSON.stringify({ code }),
        }),
      regenerateBackupCodes: (input: { password: string; code: string }) =>
        apiFetch<{ backupCodes: string[]; mfa: MfaStatus }>('/v1/auth/mfa/backup-codes', {
          method: 'POST',
          body: JSON.stringify(input),
        }),
      async disable(input: { password: string; code: string }) {
        const res = await apiFetch<{ mfa: MfaStatus }>('/v1/auth/mfa', {
          method: 'DELETE',
          body: JSON.stringify(input),
        });
        return res.mfa;
      },
    },
    members: {
      async list(): Promise<OrgMember[]> {
        const res = await apiFetch<{ users: OrgMember[] }>('/v1/auth/users');
        return res.users ?? [];
      },
      async invite(input: { email: string; role: UserRole }): Promise<MemberInvitation> {
        return apiFetch<MemberInvitation>('/v1/auth/invitations', {
          method: 'POST',
          body: JSON.stringify({ email: input.email, role: input.role }),
        });
      },
      async setRole(userId: string, role: UserRole): Promise<OrgMember> {
        const res = await apiFetch<{ user: OrgMember }>(
          `/v1/auth/users/${encodeURIComponent(userId)}/role`,
          { method: 'PUT', body: JSON.stringify({ role }) },
        );
        return res.user;
      },
      async setStatus(userId: string, status: 'active' | 'suspended'): Promise<OrgMember> {
        const res = await apiFetch<{ user: OrgMember }>(
          `/v1/auth/users/${encodeURIComponent(userId)}/status`,
          { method: 'PUT', body: JSON.stringify({ status }) },
        );
        return res.user;
      },
    },
    assistance: {
      async list(): Promise<SupportRequest[]> {
        const res = await apiFetch<{ requests: SupportRequest[] }>('/v1/support/requests');
        return res.requests ?? [];
      },
      async send(input: { kind: 'message' | 'seat'; subject?: string; body?: string }): Promise<SupportRequest> {
        const res = await apiFetch<{ request: SupportRequest }>('/v1/support/requests', {
          method: 'POST',
          body: JSON.stringify(input),
        });
        return res.request;
      },
    },
    async forgotPassword(email: string) {
      return publicPost<{ ok: boolean; message: string }>('/v1/support/forgot', { email });
    },
    welcome: {
      async inspect(token: string): Promise<WelcomePreview> {
        return publicGet<WelcomePreview>(`/v1/welcome/${encodeURIComponent(token)}`);
      },
      async reveal(token: string): Promise<WelcomeAccess> {
        return publicPost<WelcomeAccess>(`/v1/welcome/${encodeURIComponent(token)}/reveal`, { policyAccepted: true });
      },
      async confirm(token: string) {
        return publicPost<{ ok: boolean; status: WelcomeLinkState }>(`/v1/welcome/${encodeURIComponent(token)}/confirm`, {});
      },
    },
    modules: {
      async catalogue(): Promise<ModuleOffer[]> {
        const res = await apiFetch<{ modules: ModuleOffer[] }>('/v1/modules');
        return res.modules ?? [];
      },
      async request(input: { module: string; message?: string }) {
        return apiFetch<{ request: ModuleRequest; created: boolean }>('/v1/modules/requests', {
          method: 'POST',
          body: JSON.stringify({ module: input.module, message: input.message ?? '' }),
        });
      },
      async requests(): Promise<ModuleRequest[]> {
        const res = await apiFetch<{ requests: ModuleRequest[] }>('/v1/modules/requests');
        return res.requests ?? [];
      },
    },
    callLinks: {
      async create(input: { label?: string; minutes?: number }): Promise<CreatedCallLink> {
        return apiFetch<CreatedCallLink>('/v1/call-links', {
          method: 'POST',
          body: JSON.stringify({ label: input.label ?? '', minutes: input.minutes }),
        });
      },
      async list(): Promise<CallLink[]> {
        const res = await apiFetch<{ links: CallLink[] }>('/v1/call-links');
        return res.links ?? [];
      },
      async revoke(id: string): Promise<void> {
        await apiFetch(`/v1/call-links/${encodeURIComponent(id)}`, { method: 'DELETE' });
      },
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
    // Veille RSS et modèle local : hors périmètre du navigateur, et hors
    // périmètre tout court dans l'édition Business (voir @edition/browserExclusive).
    ...browserExclusiveBridge,
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
      async remove(id: number): Promise<void> {
        writeFallbackClients(readFallbackClients().filter((c) => c.id !== id));
        const quotes = readList<Quote>(QUOTES_KEY, seedQuotes);
        writeList(QUOTES_KEY, quotes.filter((q) => q.clientId !== id));
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
      notify(input: { title: string; body: string; kind?: 'default' | 'call' }): void {
        // Routed through showLocalNotification rather than `new Notification()`:
        // on Android that constructor THROWS inside an installed PWA, which is
        // why notifications worked on a desktop browser and did nothing at all
        // on the phone. showLocalNotification goes through the service worker
        // registration, the only path Android accepts.
        void showLocalNotification(input.title, input.body, {
          kind: input.kind === 'call' ? 'call' : 'default',
          vibrate: input.kind === 'call' ? [400, 150, 400, 150, 400] : undefined,
        });
      },
      // OS integration is Electron-only; harmless no-ops in the browser.
      async getAutoLaunch(): Promise<boolean> {
        return false;
      },
      async setAutoLaunch(): Promise<boolean> {
        return false;
      },
      async getAppInfo() {
        return {
          name: EDITION_PRODUCT_NAME,
          version: APP_VERSION,
          platform: 'web',
          isElectron: false,
        };
      },
      // A browser tab cannot be driven: it has no way to move the real cursor.
      // Saying so plainly is what lets the other side refuse the request with a
      // reason instead of granting a control that does nothing.
      async canBeRemoteControlled() {
        return false;
      },
      async injectRemoteInput() {
        return false;
      },
    },
    updates: {
      // No Squirrel auto-update in the browser fallback.
      onDownloaded() {
        return () => {
          /* nothing to unsubscribe */
        };
      },
      install() {
        /* no-op */
      },
      async check() {
        // Le web/PWA se met à jour en rechargeant la page : il n'y a pas de
        // canal à interroger. Le dire franchement vaut mieux qu'un « à jour »
        // qui laisserait croire à une vérification qui n'a pas eu lieu.
        return {
          status: 'unconfigured' as const,
          reason: 'La version web se met à jour toute seule au rechargement de la page.',
        };
      },
    },
    vault: {
      async isEncrypted() {
        // Plain localStorage in the browser — never encrypted. The UI shows
        // this as an explicit warning rather than a silent lock icon.
        return false;
      },
      async list() {
        return readList<VaultEntry>(VAULT_KEY, () => []);
      },
      async save(entries: VaultEntry[]) {
        writeList(VAULT_KEY, entries);
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
