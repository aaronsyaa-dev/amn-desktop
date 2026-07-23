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
} as const;
