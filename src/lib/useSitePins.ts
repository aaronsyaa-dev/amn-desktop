import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';

/**
 * Per-operator "favoris" for sites — the handful of client sites a person is
 * actively watching float to the top of the registre. Purely a personal view
 * preference, so it lives in localStorage keyed by the operator's email rather
 * than in the shared parc state.
 */
function storageKey(email: string): string {
  return `amn.site.pins.${email}`;
}

function readPins(email: string): Set<string> {
  try {
    const raw = window.localStorage.getItem(storageKey(email));
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

export function useSitePins() {
  const { user } = useAuth();
  const email = user?.email ?? 'anon';
  const [pins, setPins] = useState<Set<string>>(() => readPins(email));

  // Reload when the account changes.
  useEffect(() => {
    setPins(readPins(email));
  }, [email]);

  const persist = useCallback(
    (next: Set<string>) => {
      setPins(next);
      try {
        window.localStorage.setItem(storageKey(email), JSON.stringify([...next]));
      } catch {
        /* storage unavailable — pins stay in-memory for this session */
      }
    },
    [email],
  );

  const togglePin = useCallback(
    (siteId: string) => {
      const next = new Set(pins);
      if (next.has(siteId)) next.delete(siteId);
      else next.add(siteId);
      persist(next);
    },
    [pins, persist],
  );

  const isPinned = useCallback((siteId: string) => pins.has(siteId), [pins]);

  return { isPinned, togglePin, pinnedCount: pins.size };
}
