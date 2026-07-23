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

export interface AmnBridge {
  auth: {
    login(email: string, password: string): Promise<AuthResult>;
  };
  messages: {
    list(): Promise<Message[]>;
    send(input: SendMessageInput): Promise<Message>;
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
} as const;
