import { subscribe, type Moment } from '../../../socle/moments';
import type { Situation } from './phrases';

/**
 * LES MOMENTS AUXQUELS AJMANI RÉAGIT — une facture encaissée, un nouveau client.
 *
 * Dans l'app seulement : jamais de notification système. Quand l'Accueil
 * vivant est à l'écran, c'est lui qui réagit (Ajmani en grand, qui sautille) ;
 * ailleurs, la petite tête en bas de l'écran (`ReactionsAjmani`). Le compteur
 * `accueilEcoute` dit lequel des deux parle, pour ne jamais réagir deux fois.
 */
export const MOMENTS_FETES = { 'facture.payee': 'fete.facture', 'client.cree': 'fete.client' } as const satisfies Record<string, Situation>;
export type MomentFete = keyof typeof MOMENTS_FETES;

export function ecouterFetes(fn: (m: Moment<MomentFete>) => void): () => void {
  const offs = (Object.keys(MOMENTS_FETES) as MomentFete[]).map((type) => subscribe(type, fn as (m: Moment) => void));
  return () => offs.forEach((off) => off());
}

let accueilsAffiches = 0;
export const accueilEcoute = {
  prendre: () => {
    accueilsAffiches += 1;
  },
  rendre: () => {
    accueilsAffiches = Math.max(0, accueilsAffiches - 1);
  },
  actif: () => accueilsAffiches > 0,
};
