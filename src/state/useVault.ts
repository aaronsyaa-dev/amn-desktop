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

/**
 * Un secret affiché une seule fois, prêt à être rangé.
 *
 * Le vocabulaire volontairement générique (`secret`, `subject`) plutôt que
 * `password`/`username` : ce qui transite ici est aussi bien un mot de passe
 * temporaire d'organisation qu'un jeton d'activation ou une clé d'API. Les
 * appelants n'ont pas à connaître la forme d'une entrée de coffre-fort — ils
 * décrivent ce qu'ils ont sous les yeux, au moment où ils l'ont.
 */
export interface VaultTransfer {
  category: VaultCategory;
  /** Libellé lisible dans la liste. Ex. « Organisation — Syraagensy ». */
  label: string;
  /** Ce qui identifie l'entrée de façon stable : email, identifiant de site… */
  subject: string;
  /** Le secret lui-même. */
  secret: string;
  url?: string;
  notes?: string;
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

  /**
   * Range un secret affiché une seule fois — le geste générique du bouton
   * « Transférer dans le coffre-fort ».
   *
   * Le même raisonnement que `recordTracker`, généralisé : un mot de passe
   * temporaire d'organisation, un jeton d'activation, une clé d'API n'existent
   * qu'à l'instant où on les lit. Les recopier à la main dans le coffre-fort
   * marchait tant qu'on y pensait ; le reste du temps, ils finissaient dans un
   * presse-papiers puis nulle part, et la seule issue était d'en réémettre un —
   * ce qui invalide celui déjà remis à la cliente.
   *
   * Le couple (rubrique, sujet) sert de clé : réémettre un accès pour la même
   * adresse met l'entrée à jour au lieu d'en empiler une quasi-identique. Un
   * secret vide n'écrase jamais un secret déjà rangé.
   */
  const transferSecret = useCallback(
    (input: VaultTransfer): void => {
      const now = new Date().toISOString();
      const existing = entriesRef.current.find(
        (e) => e.category === input.category && e.username === input.subject,
      );
      const draft: VaultDraft = {
        label: input.label,
        username: input.subject,
        password: input.secret.trim() || existing?.password || '',
        url: input.url?.trim() || existing?.url || '',
        notes: input.notes ?? existing?.notes ?? '',
        category: input.category,
      };
      if (existing) {
        persist(
          entriesRef.current.map((e) => (e.id === existing.id ? { ...e, ...draft, updatedAt: now } : e)),
        );
        return;
      }
      persist([...entriesRef.current, { id: vaultId(), ...draft, createdAt: now, updatedAt: now }]);
    },
    [persist],
  );

  const deleteEntry = useCallback(
    (id: string): void => {
      persist(entriesRef.current.filter((e) => e.id !== id));
    },
    [persist],
  );

  return { entries, encrypted, loading, saveEntry, deleteEntry, recordTracker, transferSecret };
}
