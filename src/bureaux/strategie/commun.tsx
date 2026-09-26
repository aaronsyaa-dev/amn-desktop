import { useCallback } from 'react';
import { stripMeta, useCollection, useSync } from '../../state/SyncContext';
import type { SyncedCollection } from '../../shared/api';

/**
 * STRATÉGIE — ce que ses écrans partagent : écrire un enregistrement en
 * repartant de sa version brute (sans les champs synthétiques), et les
 * écritures courtes des dates.
 */

export function useEcrire<T>(collection: SyncedCollection) {
  const brutes = useCollection<T>(collection);
  const { upsert } = useSync();
  return useCallback(
    (id: string, modifier: (brute: T | null) => Partial<T>) => {
      const brute = brutes.find((x) => x.id === id);
      const base = brute ? (stripMeta(brute) as unknown as T) : null;
      void upsert(collection, id, { ...(base ?? {}), ...modifier(base) } as Record<string, unknown>);
    },
    [brutes, upsert, collection],
  );
}

/** « 16/09 » */
export const jjmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

const MOIS_ABREGES = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
/** « 2 oct. » */
export function jourMoisAbrege(iso: string): string {
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T12:00:00` : iso);
  return `${d.getDate()} ${MOIS_ABREGES[d.getMonth()]}`;
}

/** AAAA-MM-JJ d'aujourd'hui, heure locale. */
export function aujourdHui(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const champ = 'border border-[#28282c] bg-transparent px-2.5 text-[13px] text-text-primary outline-none placeholder:text-text-muted focus:border-[#8a8a87]';
