import { useCallback, useSyncExternalStore } from 'react';

/**
 * Which modules stay pinned in the sidebar (BLOC C).
 *
 * The sidebar used to list every screen, so it grew a row taller with every
 * product shipped and had started to scroll. It now shows a short, chosen set
 * plus a launcher; everything else lives in the launcher's grid. That means the
 * sidebar's height stops depending on how many modules exist.
 *
 * Per machine, not synced: this is a personal fast lane, and Aaron's and
 * Mohamed's are not the same. localStorage rather than the vault or the sync
 * layer for exactly that reason.
 *
 * The list lives in a MODULE-LEVEL store, not in each hook's own state. Two
 * components read it — the sidebar and the launcher — and with plain useState
 * they each held a private copy: pinning from the launcher wrote localStorage
 * and updated the launcher, while the sidebar kept showing the old strip until
 * the next reload (the `storage` event does not fire in the window that wrote
 * it). One store with subscribers is what makes the pin land immediately.
 */

const KEY = 'amn.nav.favorites';

/** What a fresh install pins — the five screens actually opened every day. */
export const DEFAULT_FAVORITES = ['home', 'sites', 'team', 'tasks', 'tracker'] as const;

function read(): string[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [...DEFAULT_FAVORITES];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((k) => typeof k === 'string') : [...DEFAULT_FAVORITES];
  } catch {
    return [...DEFAULT_FAVORITES];
  }
}

let current: string[] = typeof window === 'undefined' ? [...DEFAULT_FAVORITES] : read();
const listeners = new Set<() => void>();

function emit(next: string[]) {
  // Same array identity ⇒ useSyncExternalStore would not re-render, so a new
  // one is always produced.
  current = next;
  for (const l of listeners) l();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  // Another window of the app can change the list; the sidebar of this one
  // must follow rather than drift.
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) emit(read());
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

function write(next: string[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* private mode — the choice just won't survive the session */
  }
  emit(next);
}

export function useNavFavorites() {
  const favorites = useSyncExternalStore(
    subscribe,
    () => current,
    () => current,
  );

  const toggleFavorite = useCallback((key: string) => {
    write(current.includes(key) ? current.filter((k) => k !== key) : [...current, key]);
  }, []);

  const isFavorite = useCallback((key: string) => favorites.includes(key), [favorites]);

  return { favorites, isFavorite, toggleFavorite, setFavorites: write };
}
