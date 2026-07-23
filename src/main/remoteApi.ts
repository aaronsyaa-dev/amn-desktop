import WebSocket from 'ws';
import { remoteConfig, isRemoteConfigured } from './remoteConfig';
import type {
  RegisterSiteResult,
  RemoteConnectionStatus,
  RemoteEvent,
  RemoteEventPush,
  RemoteSite,
} from '../shared/api';

const RECONNECT_DELAYS_MS = [1000, 2000, 5000, 10000, 20000, 30000];

async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
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

  getConnectionStatus(): RemoteConnectionStatus {
    return this.status;
  }

  onEvent(listener: (push: RemoteEventPush) => void): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  onStatusChange(listener: (status: RemoteConnectionStatus) => void): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  /** Starts the live WebSocket connection (no-op if amn-api isn't configured). */
  start(): void {
    if (!isRemoteConfigured()) {
      this.setStatus('unconfigured');
      return;
    }
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

    const wsUrl = `${remoteConfig.apiUrl.replace(/^http/, 'ws')}/v1/stream?token=${encodeURIComponent(remoteConfig.operatorToken)}`;
    const socket = new WebSocket(wsUrl);
    this.ws = socket;

    socket.on('open', () => {
      this.reconnectAttempt = 0;
      this.setStatus('online');
    });

    socket.on('message', (raw) => {
      try {
        const parsed = JSON.parse(raw.toString());
        if (parsed?.type === 'event') {
          for (const listener of this.eventListeners) listener(parsed as RemoteEventPush);
        }
      } catch {
        // Ignore malformed frames rather than crashing the main process.
      }
    });

    const scheduleReconnect = () => {
      if (this.stopped) return;
      this.setStatus('offline');
      const delay = RECONNECT_DELAYS_MS[Math.min(this.reconnectAttempt, RECONNECT_DELAYS_MS.length - 1)];
      this.reconnectAttempt += 1;
      this.reconnectTimer = setTimeout(() => this.connect(), delay);
    };

    socket.on('close', scheduleReconnect);
    socket.on('error', () => {
      socket.close();
    });
  }
}
