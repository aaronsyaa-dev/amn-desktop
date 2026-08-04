import WebSocket from 'ws';
import { remoteConfig, isRemoteConfigured } from './remoteConfig';
import type {
  PresenceEntry,
  RegisterSiteResult,
  RemoteConnectionStatus,
  RemoteEvent,
  RemoteEventPush,
  RemoteRecord,
  RemoteSite,
  SyncedCollection,
} from '../shared/api';

const RECONNECT_DELAYS_MS = [1000, 2000, 5000, 10000, 20000, 30000];

/* eslint-disable no-console */
/** Diagnostic logger for the amn-api connection (token never logged). */
function log(...args: unknown[]): void {
  console.log('[amn-api]', ...args);
}
/* eslint-enable no-console */

async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!isRemoteConfigured()) {
    // Without AMN_API_URL/AMN_API_OPERATOR_TOKEN set (.env), remoteConfig.apiUrl
    // is empty and `fetch('' + path, …)` throws an opaque "Failed to parse URL"
    // TypeError. Surface a clear, actionable message instead.
    throw new Error(
      "L'API centrale (amn-api) n'est pas configurée sur ce poste — AMN_API_URL / AMN_API_OPERATOR_TOKEN manquants dans .env. Voir docs/ARCHITECTURE.md.",
    );
  }
  const res = await fetch(`${remoteConfig.apiUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${remoteConfig.operatorToken}`,
      ...init.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`amn-api ${res.status} ${res.statusText}: ${body.slice(0, 200)}`);
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
  private identity: string | null = null;
  private stopped = false;

  async listSites(): Promise<RemoteSite[]> {
    const { sites } = await apiFetch<{ sites: RemoteSite[] }>('/v1/sites');
    return sites;
  }

  async getSiteEvents(
    siteId: string,
    opts: { since?: string; limit?: number } = {},
  ): Promise<RemoteEvent[]> {
    const params = new URLSearchParams();
    if (opts.since) params.set('since', opts.since);
    if (opts.limit) params.set('limit', String(opts.limit));
    const qs = params.toString();
    const { events } = await apiFetch<{ events: RemoteEvent[] }>(
      `/v1/sites/${siteId}/events${qs ? `?${qs}` : ''}`,
    );
    return events;
  }

  async registerSite(name: string): Promise<RegisterSiteResult> {
    return apiFetch<RegisterSiteResult>('/v1/sites', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  }

  async updateSite(id: string, name: string): Promise<RemoteSite> {
    const { site } = await apiFetch<{ site: RemoteSite }>(`/v1/sites/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ name }),
    });
    return site;
  }

  async deleteSite(id: string): Promise<void> {
    await apiFetch<{ ok: boolean }>(`/v1/sites/${id}`, { method: 'DELETE' });
  }

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

  async getPresence(): Promise<PresenceEntry[]> {
    if (!isRemoteConfigured()) return [];
    const { users } = await apiFetch<{ users: PresenceEntry[] }>('/v1/collections/_presence');
    return users;
  }

  /** Sets the signed-in operator's identity, reconnecting the WS so presence updates. */
  setIdentity(email: string | null): void {
    const next = email ? email.trim().toLowerCase() : null;
    if (next === this.identity) return;
    this.identity = next;
    if (isRemoteConfigured() && !this.stopped) {
      // Reconnect so the handshake carries the new ?user= identity.
      this.ws?.close();
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

  /** Starts the live WebSocket connection (no-op if amn-api isn't configured). */
  start(): void {
    if (!isRemoteConfigured()) {
      log(
        'NOT configured — running in LOCAL mode. AMN_API_URL/AMN_API_OPERATOR_TOKEN were not baked into this build.',
        `(apiUrl=${remoteConfig.apiUrl ? 'set' : 'empty'}, token=${remoteConfig.operatorToken ? 'set' : 'empty'})`,
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

  private setStatus(status: RemoteConnectionStatus) {
    if (this.status === status) return;
    this.status = status;
    for (const listener of this.statusListeners) listener(status);
  }

  private connect(): void {
    if (this.stopped) return;
    this.setStatus('connecting');

    const wsBase = remoteConfig.apiUrl.replace(/^http/, 'ws');
    const base = `${wsBase}/v1/stream?token=${encodeURIComponent(remoteConfig.operatorToken)}`;
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
        if (parsed?.type === 'event') {
          for (const listener of this.eventListeners) listener(parsed as RemoteEventPush);
        } else if (parsed?.type === 'record' && parsed.record) {
          for (const listener of this.recordListeners) listener(parsed.record as RemoteRecord);
        } else if (parsed?.type === 'presence' && Array.isArray(parsed.users)) {
          for (const listener of this.presenceListeners) listener(parsed.users as PresenceEntry[]);
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
