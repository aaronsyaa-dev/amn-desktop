import { FAMILLES, type Famille } from '../../familles';
import type { TonVariation } from '../Indicateurs';

/**
 * LES TONS D'UN GRAPHIQUE — jamais une couleur, toujours un jeton.
 *
 * Un graphique reçoit un NOM de ton (« info », « argent »…) et le traduit en
 * `var(--socle-…)` : la valeur vit dans `src/socle/noir.css` et nulle part
 * ailleurs. Famille ou état, au choix de l'appelant ; « neutre » est l'encre
 * principale.
 */
export type TonGraphique = TonVariation | Famille;

const ETATS = { neutre: '--socle-texte-1', succes: '--socle-etat-succes', attention: '--socle-etat-attention', critique: '--socle-etat-critique', info: '--socle-etat-info' } as const;

/** `var(--socle-…)` du ton ; un nom inconnu retombe sur « neutre ». */
export function couleurTon(ton: TonGraphique | undefined): string {
  if (ton && (FAMILLES as readonly string[]).includes(ton)) return `var(--socle-fam-${ton})`;
  const nom = ton && Object.prototype.hasOwnProperty.call(ETATS, ton) ? ETATS[ton as keyof typeof ETATS] : ETATS.neutre;
  return `var(${nom})`;
}
