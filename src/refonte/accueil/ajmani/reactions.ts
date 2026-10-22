import { subscribe, type Moment } from '../../../socle/moments';
import type { Situation } from './phrases';

/**
 * LES MOMENTS QUI MÉRITENT UN MOT — une facture encaissée, un nouveau client.
 *
 * Dans l'app seulement, jamais de notification système : un petit toast
 * sobre (`Toasts.tsx`), une phrase de la bibliothèque, puis il s'efface.
 */
export const MOMENTS_FETES = { 'facture.payee': 'fete.facture', 'client.cree': 'fete.client' } as const satisfies Record<string, Situation>;
export type MomentFete = keyof typeof MOMENTS_FETES;

export function ecouterFetes(fn: (m: Moment<MomentFete>) => void): () => void {
  const offs = (Object.keys(MOMENTS_FETES) as MomentFete[]).map((type) => subscribe(type, fn as (m: Moment) => void));
  return () => offs.forEach((off) => off());
}
