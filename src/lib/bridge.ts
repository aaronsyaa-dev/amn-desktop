import type {
  AmnBridge,
  AuthResult,
  Message,
  SendMessageInput,
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
