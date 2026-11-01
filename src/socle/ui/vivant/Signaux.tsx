import React from 'react';
import { useSocleLangue } from '../../i18n';
import type { TonVivant } from './tons';

/**
 * LES SIGNAUX — le voyant vivant (`LiveDot`), le curseur (`Caret`) et les niveaux (`Severity`). v3, §0.4.
 */

export interface LiveDotProps {
  /** L'état que dit le voyant : ok (défaut), attention, critique, info. */
  ton?: TonVivant;
  /**
   * Ce que dit le voyant, en mots (« En direct », « Personne 1 en ligne », « Alerte en cours »). Obligatoire :
   * la couleur ne porte jamais l'état seule. Lu par les lecteurs d'écran ; affiché avec `afficherLibelle`.
   */
  libelle: string;
  /** Le libellé à droite du point, en 12 px T2. Défaut : non (le texte voisin le dit déjà à l'œil). */
  afficherLibelle?: boolean;
  /** L'onde qui s'élargit autour du point (2,2 s en boucle, coupée en mouvement réduit). Défaut : oui. */
  onde?: boolean;
  /** Le halo fixe de 4 px (14 % de la couleur), comme la pastille de La Garde. Défaut : oui. */
  halo?: boolean;
  /** Diamètre du point : 8 px (défaut) ou 6 px (présence d'une personne). */
  taille?: 6 | 8;
  className?: string;
}

/**
 * LE VOYANT VIVANT — un point d'état avec, en option, l'onde de la couche de mouvement (« en direct », « en
 * ligne », « prochain rendez-vous », « alerte en cours »). L'onde ne sert qu'à une raison métier : au plus 2 ou 3
 * animations continues par écran.
 */
export function LiveDot({ ton = 'ok', libelle, afficherLibelle = false, onde = true, halo = true, taille = 8, className = '' }: LiveDotProps) {
  return (
    <span className={`sc-voyant ${className}`.trim()} data-socle="voyant" data-ton={ton} data-taille={taille === 8 ? undefined : taille}>
      <span aria-hidden className="sc-voyant__point" data-halo={halo ? undefined : 'non'} data-mvt={onde ? 'onde' : undefined} />
      <span className={afficherLibelle ? 'sc-voyant__libelle' : 'sr-only'}>{libelle}</span>
    </span>
  );
}

/**
 * LE CURSEUR — la barre de saisie qui clignote (barre Ajmani, console) : 1,1 s, 550 ms allumée, 550 ms éteinte.
 * Décoratif : il n'a rien à dire à un lecteur d'écran. En mouvement réduit, il reste allumé, immobile.
 */
export function Caret({ className = '' }: { className?: string }) {
  return <span aria-hidden className={`sc-curseur ${className}`.trim()} data-socle="curseur" data-mvt="curseur" />;
}

export type NiveauSeverite = 'critique' | 'moyen' | 'faible' | 'info' | 'ok';
export const NIVEAUX_SEVERITE: readonly NiveauSeverite[] = ['critique', 'moyen', 'faible', 'info', 'ok'];

export interface SeverityProps {
  niveau: NiveauSeverite;
  /** Un autre mot que celui du niveau (« P1 », « Élevé ») : il doit dire le niveau, pas seulement le colorer. */
  children?: React.ReactNode;
  className?: string;
}

/**
 * UN NIVEAU — en capitales monospace, 11 px / 600 : CRITIQUE `#e08a80`, MOYEN `#e0b35a`, FAIBLE et INFO
 * `#8aa4d6`, OK `#8fbf7a`. Le mot dit le niveau ; la couleur ne fait que le redire.
 */
export function Severity({ niveau, children, className = '' }: SeverityProps) {
  const { ts } = useSocleLangue();
  return (
    <span className={`sc-severite ${className}`.trim()} data-socle="severite" data-niveau={niveau}>
      {children ?? ts(`vivant.niveau.${niveau}`)}
    </span>
  );
}
