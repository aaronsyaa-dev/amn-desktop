import React from 'react';
import { useSocleLangue } from '../../i18n';
import { formaterNombre } from '../graphiques/format';
import { borner, type TonVivant, type TonVivantNeutre } from './tons';

/**
 * LES MESURES VIVANTES — la demi-jauge (`Gauge`) et la case de chaleur (`HeatCell`). v3, §0.4.
 */

export interface GaugeProps {
  /** De 0 à 100 ; une valeur hors de l'intervalle est ramenée dedans. */
  valeur: number;
  /** Ce que la jauge mesure, pour les lecteurs d'écran (« Score de conformité »). */
  libelle: string;
  /** La valeur dite en mots (défaut : « 72 sur 100 »). */
  texte?: string;
  /** La couleur de l'arc : « neutre » (T1, défaut) ou un état. */
  ton?: TonVivantNeutre;
  /** Largeur de la jauge en pixels (défaut 120) ; la hauteur en découle (une demi-jauge). */
  largeur?: number;
  /** Épaisseur de l'arc (défaut 8, comme l'anneau). */
  epaisseur?: number;
  /** Tracé depuis 0 à l'apparition (1,1 s, départ à 250 ms). Défaut : oui. */
  anime?: boolean;
  /** Sous l'arc, à la place de la valeur (« 72 », « B+ »…). */
  children?: React.ReactNode;
  className?: string;
}

/**
 * LA DEMI-JAUGE — un arc de 180° en SVG, de gauche à droite par le haut : la piste `--socle-anneau-fond`, l'arc
 * de la valeur aux extrémités rondes, la valeur en dessous (600, chiffres tabulaires). `role="progressbar"`, comme
 * l'anneau : la valeur est redite en mots, jamais portée par l'arc seul.
 */
export function Gauge({ valeur, libelle, texte, ton = 'neutre', largeur = 120, epaisseur = 8, anime = true, children, className = '' }: GaugeProps) {
  const { ts } = useSocleLangue();
  const v = Math.round(borner(valeur, 0, 100) * 10) / 10;
  const rayon = (largeur - epaisseur) / 2;
  const cy = rayon + epaisseur / 2;
  const hauteur = cy + epaisseur / 2;
  const arc = `M ${epaisseur / 2} ${cy} A ${rayon} ${rayon} 0 0 1 ${largeur - epaisseur / 2} ${cy}`;
  const dit = formaterNombre(v);
  return (
    <span
      role="progressbar"
      aria-label={libelle}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={v}
      aria-valuetext={texte ?? ts('vivant.jauge.valeur', { valeur: dit })}
      className={`sc-jauge ${className}`.trim()}
      data-socle="jauge"
      data-ton={ton}
      style={{ width: largeur }}
    >
      <svg aria-hidden focusable="false" width={largeur} height={hauteur} viewBox={`0 0 ${largeur} ${hauteur}`} className="sc-jauge__svg" style={{ '--sc-mvt-tour': 100 } as React.CSSProperties}>
        <path className="sc-jauge__piste" d={arc} strokeWidth={epaisseur} />
        {v > 0 && <path className="sc-jauge__arc" d={arc} strokeWidth={epaisseur} pathLength={100} strokeDasharray={`${v} 100`} data-mvt={anime ? 'arc' : undefined} />}
      </svg>
      <span className="sc-jauge__valeur">{children ?? dit}</span>
    </span>
  );
}

export interface HeatCellProps {
  /** De 0 à 1 : l'opacité de la couleur d'état va de .18 (0) à .90 (1). */
  intensite: number;
  /** Ce que dit la case (« Mardi 14 h : 6 alertes ») : nom accessible et info-bulle. La couleur ne dit rien seule. */
  libelle: string;
  /** La couleur d'état (défaut critique). */
  ton?: TonVivant;
  /** Côté de la case en pixels ; sans lui, elle remplit sa case de grille (carrée). */
  taille?: number;
  /** Rend la case cliquable : un vrai bouton d'au moins 34 × 34 px. */
  onClick?: () => void;
  /** Un chiffre court dans la case (10,5 px au plus petit). */
  children?: React.ReactNode;
  className?: string;
}

/** Opacité minimale et maximale d'une case de chaleur (§0.4). */
export const OPACITE_CHALEUR = { min: 0.18, max: 0.9 } as const;

/** L'opacité de la couleur d'état pour une intensité de 0 à 1 (bornée ; non finie = 0). */
export function opaciteChaleur(intensite: number): number {
  const { min, max } = OPACITE_CHALEUR;
  return Math.round((min + borner(intensite, 0, 1) * (max - min)) * 1000) / 1000;
}

/**
 * LA CASE DE CHALEUR — une case teintée de la couleur d'état, de .18 à .90 d'opacité selon l'intensité. Elle dit
 * toujours ce qu'elle vaut (`aria-label` et info-bulle), et peut porter son chiffre.
 */
export function HeatCell({ intensite, libelle, ton = 'critique', taille, onClick, children, className = '' }: HeatCellProps) {
  const style = { '--sc-v-opacite': opaciteChaleur(intensite), ...(taille ? { width: taille, height: taille } : null) } as React.CSSProperties;
  const contenu = children != null ? <span className="sc-chaleur__valeur">{children}</span> : null;
  if (onClick) {
    return (
      <button type="button" aria-label={libelle} title={libelle} onClick={onClick} className={`sc-chaleur sc-focus ${className}`.trim()} data-socle="chaleur" data-ton={ton} style={style}>
        {contenu}
      </button>
    );
  }
  return (
    <span role="img" aria-label={libelle} title={libelle} className={`sc-chaleur ${className}`.trim()} data-socle="chaleur" data-ton={ton} style={style}>
      {contenu}
    </span>
  );
}
