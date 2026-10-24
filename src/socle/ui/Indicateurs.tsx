import React from 'react';
import type { Famille } from '../familles';

/**
 * LES INDICATEURS — tuile KPI, barre et anneau de progression.
 *
 * La barre et l'anneau disent « où j'en suis » avec un chiffre à côté : ils ne
 * sont jamais le seul porteur de l'information (`aria-valuetext` la redit en
 * mots). Une valeur hors de [0, 1] est ramenée dans l'intervalle.
 */
const borne = (v: number) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);

export interface BarreProgressionProps {
  /** De 0 à 1. */
  valeur: number;
  /** Ce que la barre mesure, pour les lecteurs d'écran. */
  libelle: string;
  /** La valeur dite en mots (« 3 sur 7 »). */
  texte?: string;
  className?: string;
  style?: React.CSSProperties;
}

export function BarreProgression({ valeur, libelle, texte, className = '', style }: BarreProgressionProps) {
  const v = borne(valeur);
  return (
    <span
      role="progressbar"
      aria-label={libelle}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(v * 100)}
      aria-valuetext={texte}
      className={`sc-barre ${className}`}
      style={style}
    >
      <span style={{ width: `${Math.round(v * 100)}%` }} />
    </span>
  );
}

export interface AnneauProgressionProps {
  valeur: number;
  libelle: string;
  texte?: string;
  taille?: number;
  epaisseur?: number;
  /** Au centre : un chiffre court (« 3/7 », « 42 % »). */
  children?: React.ReactNode;
}

export function AnneauProgression({ valeur, libelle, texte, taille = 44, epaisseur = 4, children }: AnneauProgressionProps) {
  const v = borne(valeur);
  const r = (taille - epaisseur) / 2;
  const tour = 2 * Math.PI * r;
  return (
    <span
      role="progressbar"
      aria-label={libelle}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(v * 100)}
      aria-valuetext={texte}
      className="sc-anneau"
      style={{ width: taille, height: taille }}
    >
      <svg width={taille} height={taille} viewBox={`0 0 ${taille} ${taille}`} aria-hidden>
        <circle className="sc-anneau__piste" cx={taille / 2} cy={taille / 2} r={r} strokeWidth={epaisseur} />
        <circle
          className="sc-anneau__trait"
          cx={taille / 2}
          cy={taille / 2}
          r={r}
          strokeWidth={epaisseur}
          strokeDasharray={tour}
          strokeDashoffset={tour * (1 - v)}
        />
      </svg>
      {children != null && <span className="sc-anneau__centre">{children}</span>}
    </span>
  );
}

export type TonVariation = 'neutre' | 'succes' | 'attention' | 'critique' | 'info';

export interface TuileKpiProps {
  libelle: string;
  valeur: React.ReactNode;
  /** « +12 % vs septembre ». */
  variation?: string;
  /** La phrase entière derrière la variation courte : infobulle et lecteurs d'écran. */
  detail?: string;
  ton?: TonVariation;
  /** De 0 à 1 : affiche la barre de 5 px. */
  barre?: number;
  /** Ce que mesure la barre, pour les lecteurs d'écran. */
  libelleBarre?: string;
  famille?: Famille;
  onClick?: () => void;
  'aria-label'?: string;
}

export function TuileKpi({ libelle, valeur, variation, detail, ton = 'neutre', barre, libelleBarre, famille, onClick, ...aria }: TuileKpiProps) {
  const contenu = (
    <>
      <span className="sc-kpi__label">
        {famille && <span aria-hidden className="sc-point" />}
        <span>{libelle}</span>
      </span>
      <span className="sc-kpi__valeur">
        <span>{valeur}</span>
        {variation && (
          <span className="sc-kpi__variation" data-ton={ton}>
            {variation}
            {detail && <span className="sr-only"> — {detail}</span>}
          </span>
        )}
      </span>
      {barre != null && <BarreProgression valeur={barre} libelle={libelleBarre ?? libelle} />}
    </>
  );
  if (onClick) {
    return (
      <button type="button" data-socle="kpi" data-famille={famille} onClick={onClick} aria-label={aria['aria-label']} title={detail} className="sc-kpi sc-focus">
        {contenu}
      </button>
    );
  }
  return (
    <div data-socle="kpi" data-famille={famille} aria-label={aria['aria-label']} title={detail} className="sc-kpi">
      {contenu}
    </div>
  );
}

/** L'emplacement vide d'une grille de tuiles : une invitation (« Ajouter une carte »), jamais un trou. */
export function TuileAjouter({ libelle, onClick }: { libelle: string; onClick: () => void }) {
  return (
    <button type="button" data-socle="kpi" data-vide="true" onClick={onClick} className="sc-kpi sc-focus">
      <span>+ {libelle}</span>
    </button>
  );
}
