/**
 * Contract shared between the Electron main process and the renderer.
 *
 * The renderer never imports Electron or the database directly: it talks to a
 * `bridge` (see src/lib/bridge.ts) whose shape is {@link AmnBridge}. In Electron
 * that bridge is `window.amn` (exposed by the preload script over IPC, backed by
 * SQLite + bcrypt in the main process). In a plain browser — used for headless
 * verification and vanilla `vite` dev — the same interface is fulfilled by a
 * local fallback that still performs real bcrypt verification.
 *
 * This indirection is what lets the same UI run in both environments and makes
 * swapping the local backend for a central API later a one-file change.
 */

export interface User {
  id: number;
  email: string;
  name: string;
}

export interface AuthResult {
  ok: boolean;
  user?: User;
  error?: string;
}

export interface Message {
  id: number;
  authorEmail: string;
  authorName: string;
  body: string;
  /** ISO timestamp */
  createdAt: string;
}

export interface SendMessageInput {
  authorEmail: string;
  body: string;
}

export type ClientStatus = 'active' | 'paused' | 'prospect';

export interface ClientEvent {
  id: number;
  clientId: number;
  title: string;
  detail: string;
  /** ISO timestamp */
  date: string;
}

export interface Client {
  id: number;
  name: string;
  company: string;
  status: ClientStatus;
  email: string;
  phone: string;
  notes: string;
  /** Data-URL of an uploaded avatar, or empty. */
  imageDataUrl: string;
  createdAt: string;
  updatedAt: string;
  events: ClientEvent[];
}

export interface CreateClientInput {
  name: string;
  company?: string;
  status?: ClientStatus;
  email?: string;
  phone?: string;
}

export interface UpdateClientInput {
  name?: string;
  company?: string;
  status?: ClientStatus;
  email?: string;
  phone?: string;
  notes?: string;
  imageDataUrl?: string;
}

export interface AddClientEventInput {
  clientId: number;
  title: string;
  detail?: string;
}

/* ------------------------- amn-api (real sites) ------------------------- */

/**
 * Shapes mirror exactly what amn-api actually returns — see
 * amn-api/src/db/schema.sql. Deliberately thinner than the old mock Site
 * model (no revenue, no visitor trends, no fixed vulnerability count): those
 * never had a real data source. Business analytics is an explicit future
 * tracker tier ("AMN Suite") rather than something faked here.
 */
export type RemoteEventType = 'connection' | 'request' | 'security_alert' | 'payment' | 'heartbeat';
export type RemoteSeverity = 'critical' | 'warning' | 'info';

export interface RemoteSiteState {
  siteId: string;
  /** Raw status as stored by amn-api ('online' on any event, 'unknown' before the first one). */
  status: string;
  activeVisitors: number;
  lastSeenAt: string | null;
  lastAlertAt: string | null;
  updatedAt: string;
}

export interface RemoteSite {
  id: string;
  name: string;
  createdAt: string;
  state: RemoteSiteState | null;
}

export interface RemoteEvent {
  id: number;
  siteId: string;
  type: RemoteEventType;
  severity: RemoteSeverity | null;
  message: string | null;
  payload: Record<string, unknown>;
  occurredAt: string;
}

/** Message pushed from amn-api's WebSocket stream, relayed verbatim by main. */
export interface RemoteEventPush {
  type: 'event';
  siteId: string;
  siteName: string;
  event: RemoteEvent;
}

export interface RegisterSiteResult {
  id: string;
  name: string;
  createdAt: string;
  /** Plaintext API key — shown once, never retrievable again. */
  apiKey: string;
}

export type RemoteConnectionStatus = 'connecting' | 'online' | 'offline' | 'unconfigured';

export interface AmnBridge {
  auth: {
    login(email: string, password: string): Promise<AuthResult>;
  };
  messages: {
    list(): Promise<Message[]>;
    send(input: SendMessageInput): Promise<Message>;
  };
  clients: {
    list(): Promise<Client[]>;
    create(input: CreateClientInput): Promise<Client>;
    update(id: number, patch: UpdateClientInput): Promise<Client>;
    addEvent(input: AddClientEventInput): Promise<Client>;
  };
  /**
   * Talks to the central amn-api. In Electron, the operator token never
   * leaves the main process — the renderer only sees the results, over IPC.
   */
  remote: {
    listSites(): Promise<RemoteSite[]>;
    getSiteEvents(siteId: string, opts?: { since?: string; limit?: number }): Promise<RemoteEvent[]>;
    registerSite(name: string): Promise<RegisterSiteResult>;
    /** Current live-connection status (WebSocket to amn-api). */
    getConnectionStatus(): Promise<RemoteConnectionStatus>;
    /** Subscribes to live event pushes. Returns an unsubscribe function. */
    onEvent(callback: (push: RemoteEventPush) => void): () => void;
    /** Subscribes to connection status changes. Returns an unsubscribe function. */
    onConnectionStatusChange(callback: (status: RemoteConnectionStatus) => void): () => void;
  };
  env: {
    /** true when backed by the Electron main process (SQLite), false in browser fallback. */
    isElectron: boolean;
  };
}

/** IPC channel names, kept in one place to avoid string drift. */
export const IPC = {
  authLogin: 'auth:login',
  messagesList: 'messages:list',
  messagesSend: 'messages:send',
  clientsList: 'clients:list',
  clientsCreate: 'clients:create',
  clientsUpdate: 'clients:update',
  clientsAddEvent: 'clients:addEvent',
  remoteListSites: 'remote:listSites',
  remoteSiteEvents: 'remote:siteEvents',
  remoteRegisterSite: 'remote:registerSite',
  remoteConnectionStatus: 'remote:connectionStatus',
  /** Push channels (main -> renderer via webContents.send, not invoke/handle). */
  remoteEventPush: 'remote:eventPush',
  remoteConnectionStatusPush: 'remote:connectionStatusPush',
} as const;
