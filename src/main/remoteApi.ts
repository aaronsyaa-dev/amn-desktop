import WebSocket from 'ws';
import { remoteConfig, isRemoteConfigured, apiCredential, ownerCredential } from './remoteConfig';
import { API_UNREACHABLE_PREFIX } from '../shared/api';
import type {
  OrgIdentity,
  RemoteSession,
  RemoteSessionUser,
  PresenceEntry,
  RemoteConnectionStatus,
  RemoteEventPush,
  RemoteRecord,
  SyncedCollection,
} from '../shared/api';

const RECONNECT_DELAYS_MS = [1000, 2000, 5000, 10000, 20000, 30000];

/* eslint-disable no-console */
/** Diagnostic logger for the amn-api connection (token never logged). */
function log(...args: unknown[]): void {
  console.log('[amn-api]', ...args);
}
/* eslint-enable no-console */

/**
 * Un appel à amn-api.
 *
 * `owner: true` force le justificatif de l'opérateur au lieu du contexte
 * courant : c'est ce qu'il faut pour la console `/v1/admin/*`, qui doit
 * continuer de répondre alors même que l'app travaille dans le dossier d'une
 * cliente (voir `ownerCredential`).
 */
export async function apiFetch<T>(
  path: string,
  init: RequestInit & { owner?: boolean } = {},
): Promise<T> {
  if (!isRemoteConfigured()) {
    // Without AMN_API_URL/AMN_API_OPERATOR_TOKEN set (.env), remoteConfig.apiUrl
    // is empty and `fetch('' + path, …)` throws an opaque "Failed to parse URL"
    // TypeError. Surface a clear, actionable message instead.
    throw new Error(
      "L'API centrale (amn-api) n'est pas configurée sur ce poste — AMN_API_URL / AMN_API_OPERATOR_TOKEN manquants dans .env. Voir docs/ARCHITECTURE.md.",
    );
  }
  const { owner, ...request } = init;
  const res = await fetch(`${remoteConfig.apiUrl}${path}`, {
    ...request,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${owner ? ownerCredential() : apiCredential()}`,
      ...init.headers,
    },
  });
  if (!res.ok) {
    // amn-api écrit ses refus pour l'utilisateur final (« Mot de passe actuel
    // incorrect. », « Votre accès a été suspendu. »). Les remonter tels quels
    // vaut mieux que « amn-api 403 Forbidden » suivi d'un fragment de JSON,
    // que le renderer affichait jusqu'ici à l'écran.
    const detail = await res
      .json()
      .then((body: { error?: string }) => body?.error)
      .catch(() => undefined);
    throw new Error(detail || `amn-api ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

/**
 * Owns the connection to amn-api: HTTP calls plus a self-reconnecting
 * WebSocket for live events. Lives entirely in the main process — the
 * operator token is read from remoteConfig and never crosses into the
 * renderer (see src/main/ipc.ts, which only forwards the *results*).
 */
export class RemoteApiClient {
  private ws: WebSocket | null = null;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private status: RemoteConnectionStatus = isRemoteConfigured() ? 'connecting' : 'unconfigured';
  private eventListeners = new Set<(push: RemoteEventPush) => void>();
  private statusListeners = new Set<(status: RemoteConnectionStatus) => void>();
  private recordListeners = new Set<(record: RemoteRecord) => void>();
  private presenceListeners = new Set<(users: PresenceEntry[]) => void>();
  /**
   * Abonnés par type de trame WebSocket.
   *
   * Une carte plutôt que quatre ensembles nommés `scanListeners`,
   * `complyListeners`… : ce client est le transport, il n'a pas à connaître le
   * nom des produits qui passent dedans. Accessoirement, c'est ce qui fait que
   * les noms de produits n'apparaissent plus dans le bundle livré à
   * une organisation cliente — les noms de trames sont déclarés par le module
   * exclusif, qui n'y est pas compilé.
   */
  private frameListeners = new Map<string, Set<(frame: Record<string, unknown>) => void>>();
  private identity: string | null = null;
  private stopped = false;
  /**
   * True while a close() we asked for ourselves is in flight (identity change).
   * Without it the close handler cannot tell "the operator just signed in" from
   * "the server vanished", and reports a deliberate, sub-second re-handshake as
   * "Serveur injoignable" — a badge that lies at every single login.
   */
  private reconnectingOnPurpose = false;

  /* ------------------ SSL Monitor (BLOC 6) ------------------ */

  /* ------------------ Recurring runs (BLOC 5) ------------------ */

  getConnectionStatus(): RemoteConnectionStatus {
    return this.status;
  }

  /* ------------------------ Shared collections ------------------------ */

  async listRecords(collection: SyncedCollection): Promise<RemoteRecord[]> {
    const { records } = await apiFetch<{ records: RemoteRecord[] }>(`/v1/collections/${collection}`);
    return records;
  }

  async upsertRecord(
    collection: SyncedCollection,
    id: string,
    data: Record<string, unknown>,
  ): Promise<RemoteRecord> {
    const { record } = await apiFetch<{ record: RemoteRecord }>(
      `/v1/collections/${collection}/${encodeURIComponent(id)}`,
      { method: 'PUT', body: JSON.stringify({ data }) },
    );
    return record;
  }

  async deleteRecord(collection: SyncedCollection, id: string): Promise<RemoteRecord> {
    const { record } = await apiFetch<{ record: RemoteRecord }>(
      `/v1/collections/${collection}/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    );
    return record;
  }

  /* ------------------------------- Scanner ------------------------------- */

  /* ------------------------------- Comply -------------------------------- */

  async getPresence(): Promise<PresenceEntry[]> {
    if (!isRemoteConfigured()) return [];
    const { users } = await apiFetch<{ users: PresenceEntry[] }>('/v1/collections/_presence');
    return users;
  }

  /* ----------------------------- Session amn-api ---------------------------- */

  /**
   * Ouvre une session nominative et bascule tout le client dessus.
   *
   * Volontairement hors de `apiFetch` : cette route est publique, et une
   * installation cliente n'a AUCUN justificatif avant d'avoir réussi ce
   * premier appel — `apiFetch` la refuserait au motif que rien n'est configuré.
   */
  async login(email: string, password: string): Promise<RemoteSession> {
    const session = await this.publicPost<RemoteSession>('/v1/auth/login', { email, password });
    this.applySession(session.token);
    return session;
  }

  /**
   * Revalide un jeton stocké. Renvoie `null` s'il n'est plus bon (expiré,
   * compte ou organisation suspendus) — l'app redemande alors une connexion
   * plutôt que de rester sur une session morte qui échouerait appel par appel.
   */
  async restoreSession(token: string): Promise<RemoteSession | null> {
    if (!remoteConfig.apiUrl || !token) return null;
    const previous = remoteConfig.sessionToken;
    remoteConfig.sessionToken = token;
    try {
      const me = await apiFetch<{
        org: OrgIdentity | null;
        user: RemoteSessionUser | null;
      }>('/v1/auth/me');
      if (!me.user || !me.org) throw new Error('session sans utilisateur');
      this.applySession(token);
      return { token, expiresAt: '', user: me.user, org: me.org };
    } catch {
      remoteConfig.sessionToken = previous;
      return null;
    }
  }

  /** Change le mot de passe du compte connecté. Lève le message d'amn-api tel quel. */
  async changeSessionPassword(currentPassword: string, newPassword: string): Promise<void> {
    await apiFetch<{ ok: boolean }>('/v1/auth/password', {
      method: 'PUT',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  }

  /**
   * Entre dans le dossier d'une organisation cliente, ou en sort (`null`).
   *
   * La WebSocket doit se refaire dans les deux sens : elle porte le
   * justificatif dans son URL de poignée de main, donc la laisser en place
   * signifierait afficher le dossier de la cliente en recevant en direct les
   * enregistrements d'AMN DevSec — ou l'inverse en sortant.
   */
  applySupportToken(token: string | null): void {
    if (remoteConfig.supportToken === (token ?? '')) return;
    remoteConfig.supportToken = token ?? '';
    this.stopped = false;
    if (this.ws) {
      this.reconnectingOnPurpose = true;
      this.ws.close();
    } else {
      this.connect();
    }
  }

  /** Ferme la session côté serveur puis repasse au jeton opérateur, s'il y en a un. */
  async clearSession(): Promise<void> {
    // Se déconnecter depuis un contexte client doit refermer les deux portes.
    // Laisser le jeton de support en place ferait rouvrir l'app, au prochain
    // lancement, sur le dossier d'une cliente sans que personne soit connecté.
    remoteConfig.supportToken = '';
    if (remoteConfig.sessionToken) {
      await this.publicPost('/v1/auth/logout', {}, remoteConfig.sessionToken).catch(() => {
        /* le jeton est abandonné côté client de toute façon */
      });
    }
    this.applySession(null);
  }

  private async publicPost<T>(path: string, body: unknown, bearer?: string): Promise<T> {
    if (!remoteConfig.apiUrl) {
      throw new Error(
        `${API_UNREACHABLE_PREFIX}L'API centrale (amn-api) n'est pas configurée sur ce poste — AMN_API_URL manquant. Voir docs/ARCHITECTURE.md.`,
      );
    }
    let res: Response;
    try {
      res = await fetch(`${remoteConfig.apiUrl}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
        },
        body: JSON.stringify(body),
      });
    } catch {
      // `fetch` ne lève que si la requête n'est jamais arrivée : DNS, TLS,
      // réseau coupé. Un refus d'amn-api, lui, est une réponse — il passe par
      // la branche `!res.ok` ci-dessous et ne porte donc PAS ce marqueur.
      throw new Error(
        `${API_UNREACHABLE_PREFIX}amn-api est injoignable depuis ce poste (réseau ou URL). Réessayez une fois la connexion revenue.`,
      );
    }
    if (!res.ok) {
      // amn-api écrit ses refus pour l'utilisateur final (« Votre accès a été
      // suspendu… ») : les remonter tels quels vaut mieux qu'un code HTTP nu.
      const detail = await res
        .json()
        .then((b: { error?: string }) => b?.error)
        .catch(() => undefined);
      throw new Error(detail || `amn-api ${res.status} ${res.statusText}`);
    }
    return res.json() as Promise<T>;
  }

  /**
   * Applique un changement de justificatif : la WebSocket doit se refaire, sans
   * quoi le flux temps réel resterait celui de l'organisation précédente — le
   * cas exact qui ferait fuiter des enregistrements d'un tenant à l'autre.
   */
  private applySession(token: string | null): void {
    remoteConfig.sessionToken = token ?? '';
    // Changer de session, c'est changer d'opérateur : un contexte client
    // ouvert par le précédent n'a plus de titulaire et ne doit pas survivre.
    remoteConfig.supportToken = '';
    if (!isRemoteConfigured()) {
      // Plus aucun justificatif (déconnexion sur un poste client) : on coupe.
      this.stop();
      this.setStatus('unconfigured');
      return;
    }
    this.stopped = false;
    if (this.ws) {
      this.reconnectingOnPurpose = true;
      this.ws.close();
    } else {
      this.connect();
    }
  }

  /** Sets the signed-in operator's identity, reconnecting the WS so presence updates. */
  setIdentity(email: string | null): void {
    const next = email ? email.trim().toLowerCase() : null;
    if (next === this.identity) return;
    this.identity = next;
    if (isRemoteConfigured() && !this.stopped && this.ws) {
      // Reconnect so the handshake carries the new ?user= identity. Flagged as
      // deliberate so the close below reads as "reconnecting", not "offline".
      this.reconnectingOnPurpose = true;
      this.ws.close();
    }
  }

  onEvent(listener: (push: RemoteEventPush) => void): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  onStatusChange(listener: (status: RemoteConnectionStatus) => void): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  onRecord(listener: (record: RemoteRecord) => void): () => void {
    this.recordListeners.add(listener);
    return () => this.recordListeners.delete(listener);
  }

  onPresence(listener: (users: PresenceEntry[]) => void): () => void {
    this.presenceListeners.add(listener);
    return () => this.presenceListeners.delete(listener);
  }

  /**
   * Pousse une trame sur la WebSocket ouverte. Renvoie false si le lien est
   * coupé, pour que l'appelant échoue tout de suite au lieu d'émettre dans le
   * vide. Le contenu ne regarde pas ce client : il ne fait que transporter.
   */
  sendFrame(frame: Record<string, unknown>): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false;
    this.ws.send(JSON.stringify(frame));
    return true;
  }

  /**
   * Abonnement à un type de trame WebSocket. Renvoie une fonction de
   * désabonnement.
   */
  onFrame(type: string, listener: (frame: Record<string, unknown>) => void): () => void {
    let set = this.frameListeners.get(type);
    if (!set) {
      set = new Set();
      this.frameListeners.set(type, set);
    }
    set.add(listener);
    return () => {
      set?.delete(listener);
    };
  }

  /** Starts the live WebSocket connection (no-op if amn-api isn't configured). */
  start(): void {
    if (!isRemoteConfigured()) {
      // Deux situations très différentes derrière le même état :
      //   - aucune URL d'API : l'app tourne réellement seule (dev, build sans
      //     backend) ;
      //   - une URL mais aucun justificatif : c'est le cas NORMAL d'une
      //     installation cliente avant la connexion. La synchro démarrera à la
      //     seconde où une session existera.
      log(
        remoteConfig.apiUrl
          ? `configured (${remoteConfig.apiUrl}) but no credential yet — waiting for sign-in.`
          : 'NOT configured — running in LOCAL mode. AMN_API_URL was not baked into this build.',
      );
      this.setStatus('unconfigured');
      return;
    }
    log(`configured — apiUrl=${remoteConfig.apiUrl} (token present). Starting sync WebSocket.`);
    this.stopped = false;
    this.connect();
  }

  stop(): void {
    this.stopped = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.ws = null;
  }

  /**
   * True if this event id has already been dispatched — see the dual-name
   * broadcast in the message handler. Keeps a bounded window of recent ids;
   * only consecutive duplicates matter, so a small window is plenty.
   */
  private recentEventIds: number[] = [];

  private seenEvent(id: unknown): boolean {
    if (typeof id !== 'number') return false; // can't de-duplicate — let it through
    if (this.recentEventIds.includes(id)) return true;
    this.recentEventIds.push(id);
    if (this.recentEventIds.length > 200) this.recentEventIds.shift();
    return false;
  }

  private setStatus(status: RemoteConnectionStatus) {
    if (this.status === status) return;
    this.status = status;
    for (const listener of this.statusListeners) listener(status);
  }

  private connect(): void {
    if (this.stopped) return;
    this.setStatus('connecting');

    const wsBase = remoteConfig.apiUrl.replace(/^http/, 'ws');
    const base = `${wsBase}/v1/stream?token=${encodeURIComponent(apiCredential())}`;
    const wsUrl = this.identity ? `${base}&user=${encodeURIComponent(this.identity)}` : base;
    // Redacted URL for logs — never print the token.
    log(`WS connecting to ${wsBase}/v1/stream (user=${this.identity ?? 'none'})`);
    const socket = new WebSocket(wsUrl);
    this.ws = socket;

    socket.on('open', () => {
      log('WS connected (online).');
      this.reconnectAttempt = 0;
      this.setStatus('online');
    });

    socket.on('message', (raw) => {
      try {
        const parsed = JSON.parse(raw.toString());
        if (parsed?.type === 'tracker:event' || parsed?.type === 'event') {
          // amn-api emits every ingest under BOTH names — `tracker:event` (the
          // canonical one) and `event` (kept so desktops predating the rename
          // keep working). This build understands both, so it must drop the
          // second copy or every alert would notify twice.
          if (!this.seenEvent(parsed?.event?.id)) {
            for (const listener of this.eventListeners) listener(parsed as RemoteEventPush);
          }
        } else if (parsed?.type === 'record' && parsed.record) {
          for (const listener of this.recordListeners) listener(parsed.record as RemoteRecord);
        } else if (parsed?.type === 'presence' && Array.isArray(parsed.users)) {
          for (const listener of this.presenceListeners) listener(parsed.users as PresenceEntry[]);
        } else {
          // Toute autre trame est relayée telle quelle aux abonnés de son type
          // (voir onFrame). C'est par là que passent les poussées des produits
          // exclusifs et la signalisation d'appel.
          const listeners = this.frameListeners.get(String(parsed?.type ?? ''));
          if (listeners) {
            for (const listener of listeners) listener(parsed as Record<string, unknown>);
          }
        }
      } catch {
        // Ignore malformed frames rather than crashing the main process.
      }
    });

    const scheduleReconnect = (): number => {
      if (this.stopped) return 0;
      this.setStatus('offline');
      const delay = RECONNECT_DELAYS_MS[Math.min(this.reconnectAttempt, RECONNECT_DELAYS_MS.length - 1)];
      this.reconnectAttempt += 1;
      this.reconnectTimer = setTimeout(() => this.connect(), delay);
      return delay;
    };

    socket.on('close', (code: number, reasonBuf: Buffer) => {
      const reason = reasonBuf?.toString() || '';

      // A close we asked for (identity change) is not a connection loss: stay
      // on "connecting", keep the backoff counter untouched, and re-handshake
      // immediately rather than waiting out a delay meant for a broken server.
      if (this.reconnectingOnPurpose) {
        this.reconnectingOnPurpose = false;
        log(`WS closed for identity change (code=${code}). Reconnecting now.`);
        this.setStatus('connecting');
        if (!this.stopped) this.reconnectTimer = setTimeout(() => this.connect(), 0);
        return;
      }

      // 4401 = amn-api rejected the token (client token ≠ server OPERATOR_TOKEN).
      // 1006 = abnormal close (server unreachable / TLS / dropped).
      const hint =
        code === 4401
          ? ' — token refusé par amn-api (AMN_API_OPERATOR_TOKEN du build ≠ OPERATOR_TOKEN sur Render ?)'
          : '';
      const delay = scheduleReconnect();
      log(`WS closed (code=${code}${reason ? `, reason="${reason}"` : ''})${hint}. Reconnecting in ${delay}ms.`);
    });
    socket.on('error', (err: Error) => {
      log(`WS error: ${err?.message ?? err}`);
      socket.close();
    });
  }
}
