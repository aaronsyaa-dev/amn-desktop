import { useEffect, useState } from 'react';
import { bridge } from '../lib/bridge';
import { useAuth } from '../auth/AuthContext';
import type { SyncedCollection } from '../shared/api';

/**
 * Qui d'autre a CETTE fiche ouverte en ce moment (confort d'usage à deux,
 * cf. docs/confort-usage-quotidien-2026-09-10.md) — pas « qui est connecté »
 * (voir `onlineEmails` dans SyncContext), mais « qui regarde cette fiche
 * précise ». Annonce l'ouverture au montage, l'annule au démontage ou dès
 * que `collection`/`id` change (changer de fiche, c'est quitter la
 * précédente).
 *
 * Rend uniquement les AUTRES opérateurs : ce que cet écran affiche lui-même
 * ne l'intéresse pas.
 */
export function useRecordWatchers(collection: SyncedCollection, id: string | null): string[] {
  const { user } = useAuth();
  const myEmail = user?.email?.trim().toLowerCase();
  const [emails, setEmails] = useState<string[]>([]);

  useEffect(() => {
    if (!id) {
      setEmails([]);
      return;
    }
    const remote = bridge().remote;
    remote.watchRecord(collection, id);
    setEmails([]);
    const off = remote.onWatchers((info) => {
      if (info.collection !== collection || info.id !== id) return;
      setEmails(info.emails);
    });
    return () => {
      off();
      remote.unwatchRecord();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collection, id]);

  return emails.filter((e) => e.trim().toLowerCase() !== myEmail);
}
