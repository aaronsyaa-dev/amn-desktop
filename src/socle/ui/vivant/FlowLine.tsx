import React from 'react';
import { dureeFlux } from '../../couche-mouvement';
import type { TonVivantNeutre } from './tons';

/**
 * LE LIEN QUI AVANCE (`FlowLine`) — un trait pointillé dont les pointillés avancent dans le sens du flux (graphe,
 * flux d'automatisation, rapprochement). v3, §0.4. Un `<path>` à poser DANS un `<svg>` : le lien vit dans le
 * dessin de l'écran, avec ses nœuds.
 *
 *   <svg …><FlowLine de={[20, 40]} a={[220, 90]} ton="info" libelle="Facture vers paiement" /></svg>
 *
 * En mouvement réduit, le pointillé reste, immobile : on voit encore qu'il y a un lien et dans quel état.
 */
export interface FlowLineProps {
  /** Le chemin SVG du lien. Sans lui, `de` et `a` tracent une courbe douce (tangentes horizontales). */
  d?: string;
  de?: readonly [number, number];
  a?: readonly [number, number];
  /** « neutre » (T3, défaut) ou un état. */
  ton?: TonVivantNeutre;
  /** Le flux avance (défaut : oui). Non : un pointillé immobile (lien en attente, coupé). */
  actif?: boolean;
  /** Durée d'une période, de 1 200 à 2 200 ms (défaut 1 600). */
  duree?: number;
  /** Ce que porte le lien, s'il porte une information (`<title>` et nom accessible). Absent : décoratif. */
  libelle?: string;
  /** Épaisseur du trait (défaut 1,5). */
  epaisseur?: number;
  className?: string;
}

/** La courbe douce entre deux points : tangentes horizontales, milieu à mi-chemin. */
export function cheminFlux(de: readonly [number, number], a: readonly [number, number]): string {
  const mx = (de[0] + a[0]) / 2;
  return `M ${de[0]} ${de[1]} C ${mx} ${de[1]}, ${mx} ${a[1]}, ${a[0]} ${a[1]}`;
}

export function FlowLine({ d, de, a, ton = 'neutre', actif = true, duree, libelle, epaisseur = 1.5, className = '' }: FlowLineProps) {
  const chemin = d ?? (de && a ? cheminFlux(de, a) : '');
  if (!chemin) return null;
  return (
    <path
      d={chemin}
      className={`sc-flux ${className}`.trim()}
      data-socle="flux"
      data-ton={ton}
      data-actif={actif ? undefined : 'non'}
      data-mvt={actif ? 'flux' : undefined}
      strokeWidth={epaisseur}
      style={{ '--sc-mvt-flux-duree': `${dureeFlux(duree)}ms` } as React.CSSProperties}
      role={libelle ? 'img' : undefined}
      aria-label={libelle}
      aria-hidden={libelle ? undefined : true}
    >
      {libelle && <title>{libelle}</title>}
    </path>
  );
}
