import { useCallback, useEffect, useRef, useState } from 'react';
import { bridge } from '../lib/bridge';
import type { VaultCategory, VaultEntry } from '../shared/api';

/**
 * Local password vault. Deliberately does not import anything from
 * SyncContext/useSync — this hook's only data path is `bridge().vault`, which
 * in Electron writes to an encrypted file on disk and in the browser writes to
 * plain localStorage. Neither ever calls amn-api. See VaultEntry in
 * shared/api.ts for the full rationale.
 */

export interface VaultDraft {
  label: string;
  username: string;
  password: string;
  url: string;
  notes: string;
  category: VaultCategory;
}

/** Vault-local id generator — independent of the sync module's `uid()`. */
function vaultId(): string {
  return `vault-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function useVault() {
  const [entries, setEntries] = useState<VaultEntry[]>([]);
  const [encrypted, setEncrypted] = useState(false);
  const [loading, setLoading] = useState(true);
  const entriesRef = useRef<VaultEntry[]>([]);
  entriesRef.current = entries;

  useEffect(() => {
    let active = true;
    (async () => {
      const [list, isEnc] = await Promise.all([bridge().vault.list(), bridge().vault.isEncrypted()]);
      if (!active) return;
      setEntries(list);
      setEncrypted(isEnc);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const persist = useCallback((next: VaultEntry[]) => {
    setEntries(next);
    void bridge().vault.save(next);
  }, []);

  /** Creates a new entry, or updates one when `id` is given. */
  const saveEntry = useCallback(
    (draft: VaultDraft, id?: string): void => {
      const now = new Date().toISOString();
      if (id) {
        persist(
          entriesRef.current.map((e) => (e.id === id ? { ...e, ...draft, updatedAt: now } : e)),
        );
      } else {
        persist([...entriesRef.current, { id: vaultId(), ...draft, createdAt: now, updatedAt: now }]);
      }
    },
    [persist],
  );

  /**
   * Records an installed tracker in the vault (BLOC D).
   *
   * An API key is shown ONCE, when the site is registered. Losing it meant
   * regenerating one by reflex — which invalidates the key already deployed on
   * the client's site and silently stops its supervision. Writing the key here
   * at the moment it exists turns "je regénère" into a deliberate act rather
   * than the only way out.
   *
   * Keyed on the site id, so re-running the wizard for a site updates its entry
   * instead of leaving a trail of near-duplicates. An existing key is never
   * overwritten by an empty one: passing through the wizard without retyping
   * the key must not erase what was recorded at registration.
   */
  const recordTracker = useCallback(
    (input: {
      siteId: string;
      siteName: string;
      tier: string;
      apiUrl: string;
      apiKey: string;
      modules?: string[];
      installedAt?: string;
    }): void => {
      const now = new Date().toISOString();
      const installedAt = input.installedAt ?? now;
      const existing = entriesRef.current.find((e) => e.username === input.siteId && e.category === 'trackers');
      const notes = [
        `Site : ${input.siteName}`,
        `Palier : ${input.tier || '—'}`,
        input.modules?.length ? `Modules : ${input.modules.join(', ')}` : null,
        `Installé le : ${new Date(installedAt).toLocaleDateString('fr-FR')}`,
        `Identifiant du site : ${input.siteId}`,
      ]
        .filter(Boolean)
        .join('\n');

      const draft: VaultDraft = {
        label: `Tracker — ${input.siteName}`,
        // The site id lives in `username` so the entry can be found again
        // unambiguously even after the site is renamed.
        username: input.siteId,
        password: input.apiKey.trim() || existing?.password || '',
        url: input.apiUrl.trim() || existing?.url || '',
        notes,
        category: 'trackers',
      };

      if (existing) {
        persist(
          entriesRef.current.map((e) =>
            e.id === existing.id ? { ...e, ...draft, updatedAt: now } : e,
          ),
        );
        return;
      }
      persist([
        ...entriesRef.current,
        { id: vaultId(), ...draft, createdAt: installedAt, updatedAt: now },
      ]);
    },
    [persist],
  );

  const deleteEntry = useCallback(
    (id: string): void => {
      persist(entriesRef.current.filter((e) => e.id !== id));
    },
    [persist],
  );

  return { entries, encrypted, loading, saveEntry, deleteEntry, recordTracker };
}
