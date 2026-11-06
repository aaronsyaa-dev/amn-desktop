import React from 'react';

/**
 * MONO — une donnée technique en police monospace (01-SOCLE-DESIGN §0.4) : l'heure d'une ronde à la seconde, un
 * code, un numéro de facture, un niveau, le montant d'un grand livre. Les fiches l'écrivent « en MONO ».
 *
 * C'est un élément en ligne (`span` par défaut ; `time`, `code`, `b` ou `p` au choix) qui porte `.sc-mono` : la police
 * `--socle-police-mono` de noir.css, chiffres tabulaires, sans ligatures. La couleur vient du parent (T1 à T4, ou
 * une couleur d'état : la brique n'en impose aucune). `taille` : de 11 à 18 px, les bornes du §0.4 — une valeur hors
 * de l'intervalle y est ramenée ; sans `taille`, la taille du parent.
 *
 *   <Mono>10:42:07</Mono>                                 → l'heure d'une ronde, dans la taille du texte voisin
 *   <Mono as="time" dateTime="2026-10-30T10:42:07">10:42:07</Mono>
 *   <Mono taille={18}>3 840,00 €</Mono>                   → le plus grand monospace permis
 */
export const TAILLE_MONO_MIN = 11;
export const TAILLE_MONO_MAX = 18;

/** La taille demandée, bornée à [11, 18] ; `undefined` (hérite du parent) reste `undefined`. */
export function tailleMono(taille: number | undefined): number | undefined {
  if (taille === undefined || !Number.isFinite(taille)) return undefined;
  return Math.min(TAILLE_MONO_MAX, Math.max(TAILLE_MONO_MIN, taille));
}

export interface MonoProps extends React.HTMLAttributes<HTMLElement> {
  as?: 'span' | 'time' | 'code' | 'b' | 'p';
  /** De 11 à 18 px (§0.4) ; absent : la taille du parent. */
  taille?: number;
  /** Pour `as="time"` : la forme machine de l'instant. */
  dateTime?: string;
  children?: React.ReactNode;
}

export function Mono({ as: Balise = 'span', taille, className = '', style, children, ...reste }: MonoProps) {
  const t = tailleMono(taille);
  return (
    <Balise data-socle="mono" className={`sc-mono ${className}`.trim()} style={t === undefined ? style : { fontSize: t, ...style }} {...reste}>
      {children}
    </Balise>
  );
}
