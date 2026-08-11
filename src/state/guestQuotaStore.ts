import { useSyncExternalStore } from 'react';
import { readGuestQuotaRefusal } from '../lib/errorMessage';
import type { GuestQuotaState } from '../shared/api';

/**
 * L'état « quota invité épuisé », partagé par toute l'application.
 *
 * Un magasin au niveau du module plutôt qu'un contexte React, pour une raison
 * pratique : le refus n'arrive pas depuis un composant. Il tombe d'une requête
 * de synchronisation, d'un enregistrement, de n'importe quel appel à amn-api —
 * c'est-à-dire de code qui n'a pas de `dispatch` sous la main. Ici, n'importe
 * quel chemin d'erreur peut signaler le refus en une ligne, et l'interface le
 * voit via `useSyncExternalStore` (même procédé que `useNavFavorites`, qui
 * avait été introduit pour la même raison).
 *
 * Le blocage se LÈVE tout seul à l'heure annoncée : sans cela, un invité resté
 * ouvert toute la nuit trouverait encore son écran de blocage le lendemain
 * matin, alors que le serveur, lui, le laisserait passer.
 */

let current: GuestQuotaState | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

/** Signale un refus de quota. Sans effet si l'erreur n'en est pas un. */
export function reportGuestQuotaError(error: unknown): boolean {
  const quota = readGuestQuotaRefusal(error);
  if (!quota) return false;
  // Ne pas ré-émettre à chaque requête refusée : le refus revient à chaque
  // appel tant que le quota est épuisé, et re-rendre l'écran de blocage
  // plusieurs fois par seconde ferait clignoter le compte à rebours.
  if (current && current.resetsAt === quota.resetsAt) return true;
  current = quota;
  emit();
  return true;
}

/** Efface le blocage — à la déconnexion, ou quand l'heure de réouverture passe. */
export function clearGuestQuotaBlock() {
  if (!current) return;
  current = null;
  emit();
}

function getSnapshot(): GuestQuotaState | null {
  if (!current) return null;
  const resetsAtMs = Date.parse(current.resetsAt);
  if (Number.isFinite(resetsAtMs) && resetsAtMs <= Date.now()) {
    // L'heure est passée : le serveur accepterait de nouveau, donc l'écran
    // n'a plus lieu d'être. Lu ici plutôt que réglé par une minuterie, pour
    // qu'aucun rendu ne puisse afficher un blocage déjà expiré.
    current = null;
    return null;
  }
  return current;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useGuestQuotaBlock(): GuestQuotaState | null {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
