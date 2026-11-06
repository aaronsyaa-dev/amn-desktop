import React from 'react';
import { useSocleLangue } from '../../i18n';

/**
 * LE COMPTEUR (`CountBadge`, fiche D02 § 5 : 16 px de haut, fond `#26262A` — jeton `--socle-pastille-compte` —,
 * chiffre 10,5 px / 600, rouge pour une alerte critique). Au-delà de 99, « 99+ ». Zéro : rien n'est rendu.
 *
 * Trois variantes, pour que chaque écran garde ses pixels :
 *   · `standard` — la pastille de la fiche D02 (lignes du répertoire) ;
 *   · `laterale` — la pastille de Cyber dans la barre latérale §0.1 (16 px, 21 px de large au moins, 11,5 / 500,
 *     fond `--socle-lateral-compteur`) ;
 *   · `texte`    — le chiffre seul, 11,5 px T3 (les épinglés de la barre latérale, images v3).
 *
 * Le chiffre ne dit rien seul : `libelle` (« 3 à voir ») est lu par les lecteurs d'écran et posé en info-bulle.
 */
export type VarianteCountBadge = 'standard' | 'laterale' | 'texte';

export interface CountBadgeProps {
  n: number;
  /** Ce que compte le chiffre, en mots (« 3 à voir ») ; défaut : le mot du socle. */
  libelle?: string;
  variante?: VarianteCountBadge;
  /** Une alerte critique : le chiffre passe en rouge (le libellé le dit aussi). */
  critique?: boolean;
  className?: string;
}

export const PLAFOND_COMPTE = 99;

export function CountBadge({ n, libelle, variante = 'standard', critique = false, className }: CountBadgeProps) {
  const { ts } = useSocleLangue();
  if (!(n > 0)) return null;
  // Le mot du socle s'accorde : « 1 alerte critique » (le cas de la fiche D02), « 2 alertes critiques ».
  const mots = libelle ?? ts(critique ? (n === 1 ? 'briques.compte.critique.un' : 'briques.compte.critique') : 'briques.compte', { n });
  return (
    <span className={['sc-count-badge', className].filter(Boolean).join(' ')} data-variante={variante} data-critique={critique || undefined} title={mots}>
      {n > PLAFOND_COMPTE ? `${PLAFOND_COMPTE}+` : n}
      <span className="sr-only"> {mots}</span>
    </span>
  );
}
