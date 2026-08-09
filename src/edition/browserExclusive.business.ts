import type { AmnBridge } from '../shared/api';

/**
 * Part exclusive du pont navigateur — édition Business.
 *
 * Vide. Aucune route `/v1/scans`, `/v1/ssl`, `/v1/sites` ni signalisation
 * d'appel n'est compilée dans le bundle livré à une organisation cliente, et
 * `window.amn.remote` n'expose donc rien de tout cela — ni via Electron (voir
 * `preload.exclusive.business.ts`), ni via le repli navigateur.
 *
 * Le contexte reste dans la signature pour que les deux faces de la couture
 * soient interchangeables sans que `bridge.ts` ait à savoir laquelle est
 * construite.
 */
/* eslint-disable @typescript-eslint/no-unused-vars */
export interface BrowserExclusiveContext {
  apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>;
  apiUrl: string;
  token: string;
  ensureStarted: () => void;
  socket: () => WebSocket | null;
  eventListeners: Set<unknown>;
  onFrame: (type: string, listener: (frame: Record<string, unknown>) => void) => () => void;
}

export function createBrowserExclusive(_ctx: BrowserExclusiveContext): AmnBridge['remote'] {
  return {} as unknown as AmnBridge['remote'];
}

/** Ni veille RSS ni modèle local dans cette édition. */
export const browserExclusiveBridge = {} as unknown as Pick<AmnBridge, 'watch' | 'ollama'>;
/* eslint-enable @typescript-eslint/no-unused-vars */
