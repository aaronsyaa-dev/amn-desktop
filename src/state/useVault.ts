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

  const deleteEntry = useCallback(
    (id: string): void => {
      persist(entriesRef.current.filter((e) => e.id !== id));
    },
    [persist],
  );

  return { entries, encrypted, loading, saveEntry, deleteEntry };
}
