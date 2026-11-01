import React from 'react';
import type { Famille } from '../familles';
import { couleurTon } from './graphiques/tons';

/**
 * LES INDICATEURS — tuile KPI, barre et anneau de progression.
 *
 * La barre et l'anneau disent « où j'en suis » avec un chiffre à côté : ils ne
 * sont jamais le seul porteur de l'information (`aria-valuetext` la redit en
 * mots). Une valeur hors de [0, 1] est ramenée dans l'intervalle.
 */
const borne = (v: number) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);

export type TonBarre = 'neutre' | 'succes' | 'attention' | 'critique' | 'info';

/** La couleur d'une santé : au moins 70 vert, de 45 à 69 orange, moins de 45 rouge (valeur de 0 à 1). */
export function tonDeSante(valeur: number): TonBarre {
  const pourcent = borne(valeur) * 100;
  return pourcent >= 70 ? 'succes' : pourcent >= 45 ? 'attention' : 'critique';
}

export interface BarreProgressionProps {
  /** De 0 à 1. */
  valeur: number;
  /** Dégradé neutre par défaut ; une couleur d'état quand la barre mesure une santé ou un statut. */
  ton?: TonBarre;
  /** 5 px (défaut), 4 px dans un ticket, 8 px dans un jalon. */
  hauteur?: 4 | 5 | 8;
  /** Les repères à 25, 50 et 75 % d'un jalon. */
  reperes?: boolean;
  /** Ce que la barre mesure, pour les lecteurs d'écran. */
  libelle: string;
  /** La valeur dite en mots (« 3 sur 7 »). */
  texte?: string;
  className?: string;
  style?: React.CSSProperties;
}

export function BarreProgression({ valeur, ton = 'neutre', hauteur = 5, reperes = false, libelle, texte, className = '', style }: BarreProgressionProps) {
  const v = borne(valeur);
  return (
    <span
      role="progressbar"
      aria-label={libelle}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(v * 100)}
      aria-valuetext={texte}
      data-ton={ton === 'neutre' ? undefined : ton}
      data-hauteur={hauteur === 5 ? undefined : hauteur}
      className={`sc-barre ${className}`}
      style={style}
    >
      <span style={{ width: `${Math.round(v * 100)}%` }} />
      {reperes && [25, 50, 75].map((r) => <i key={r} aria-hidden style={{ left: `${r}%` }} />)}
    </span>
  );
}

export interface AnneauProgressionProps {
  valeur: number;
  libelle: string;
  texte?: string;
  taille?: number;
  epaisseur?: number;
  /** La couleur du trait : un état (« succes », « attention »…). Défaut « neutre » : l'encre principale, comme avant. */
  ton?: TonVariation;
  /** Le fond du trait : « defaut » (`--socle-piste`, comme avant) ou « anneau » (`--socle-anneau-fond`, le Ring des maquettes). */
  piste?: 'defaut' | 'anneau';
  /** Au centre : un chiffre court (« 3/7 », « 42 % »). */
  children?: React.ReactNode;
}

export function AnneauProgression({ valeur, libelle, texte, taille = 44, epaisseur = 4, ton = 'neutre', piste = 'defaut', children }: AnneauProgressionProps) {
  const v = borne(valeur);
  // Défauts : pas de style en ligne, la feuille (`.sc-anneau__trait`, `__piste`) décide comme avant.
  const styleTrait = ton === 'neutre' ? undefined : { stroke: couleurTon(ton) };
  const stylePiste = piste === 'anneau' ? { stroke: 'var(--socle-anneau-fond)' } : undefined;
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
        <circle className="sc-anneau__piste" cx={taille / 2} cy={taille / 2} r={r} strokeWidth={epaisseur} style={stylePiste} />
        <circle
          className="sc-anneau__trait"
          cx={taille / 2}
          cy={taille / 2}
          r={r}
          strokeWidth={epaisseur}
          strokeDasharray={tour}
          strokeDashoffset={tour * (1 - v)}
          style={styleTrait}
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
  /** 84 px (défaut, règle 4 des écarts) ; 92 px sur l'Accueil. */
  hauteur?: 84 | 92;
  /** À droite de la tuile : une mini-courbe de 70 × 26 (décorative, la valeur est déjà dite). */
  droite?: React.ReactNode;
  onClick?: () => void;
  'aria-label'?: string;
}

export function TuileKpi({ libelle, valeur, variation, detail, ton = 'neutre', barre, libelleBarre, famille, hauteur = 84, droite, onClick, ...aria }: TuileKpiProps) {
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
      {droite && <span aria-hidden className="sc-kpi__droite">{droite}</span>}
    </>
  );
  if (onClick) {
    return (
      <button type="button" data-socle="kpi" data-famille={famille} data-hauteur={hauteur === 84 ? undefined : hauteur} onClick={onClick} aria-label={aria['aria-label']} title={detail} className="sc-kpi sc-focus">
        {contenu}
      </button>
    );
  }
  return (
    <div data-socle="kpi" data-famille={famille} data-hauteur={hauteur === 84 ? undefined : hauteur} aria-label={aria['aria-label']} title={detail} className="sc-kpi">
      {contenu}
    </div>
  );
}

/** L'emplacement vide d'une grille de tuiles : une invitation (« Ajouter une carte »), jamais un trou. */
export function TuileAjouter({ libelle, onClick, hauteur = 84 }: { libelle: string; onClick: () => void; hauteur?: 84 | 92 }) {
  return (
    <button type="button" data-socle="kpi" data-vide="true" data-hauteur={hauteur === 84 ? undefined : hauteur} onClick={onClick} className="sc-kpi sc-focus">
      <span>+ {libelle}</span>
    </button>
  );
}
