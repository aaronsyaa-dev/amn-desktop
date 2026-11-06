import React from 'react';
import { AnneauProgression, type TonVariation } from '../Indicateurs';
import { formaterPourcent } from './format';

/**
 * L'ANNEAU (le « Ring » des maquettes) — un mince alias de `AnneauProgression`.
 *
 * Il ne redessine rien : `AnneauProgression` (src/socle/ui/Indicateurs.tsx) porte
 * le SVG, le `role="progressbar"` et le calcul ; `Anneau` en fixe les cotes de la
 * spec (72 px, épaisseur 8, fond `--socle-anneau-fond`, extrémités rondes) et
 * pose au centre la valeur en pour cent, 600, chiffres tabulaires.
 *
 *   <Anneau valeur={0.8} libelle="Objectif du mois" />          → 72 px, « 80 % » au centre
 *   <Anneau valeur={0.8} libelle="…" taille={76} ton="succes" />
 *
 * `taille` : 72 ou 76 selon l'écran, 80 pour H42 ; et de 26 à 58 px pour les petits anneaux d'une ligne ou
 * d'une tuile (LOT-06). Sous 72 px, l'épaisseur suit la taille (8 px à 72 → 3 px à 26, `epaisseurAnneau`), et la
 * valeur centrée passe à 13 px (moins de 72) puis 11 px (moins de 48) ; sous 40 px, rien n'est écrit au centre
 * (`children` l'y met si besoin) : la valeur reste dite en mots. `ton` : le trait (« neutre » = encre principale,
 * ou un état). Un anneau est une progression, pas un tableau : il reste un `progressbar` (valeur dite en mots)
 * plutôt qu'un `img`.
 */
export interface AnneauProps {
  /** De 0 à 1 ; une valeur hors de l'intervalle est ramenée dedans. */
  valeur: number;
  /** Ce que l'anneau mesure, pour les lecteurs d'écran. */
  libelle: string;
  /** La valeur dite en mots (défaut : « 80 % »). */
  texte?: string;
  /** 72 à 76 px, 80 pour H42 (défaut 72) ; de 26 à 58 px en petit. Borné à [26, 80]. */
  taille?: number;
  ton?: TonVariation;
  /** Au centre, à la place du pour cent (« 3/7 »…). */
  children?: React.ReactNode;
  /** Tracé depuis 0 à l'apparition (couche de mouvement §0.2). Défaut : oui. */
  anime?: boolean;
}

/** Épaisseur du trait de l'anneau (spec : 8, à 72 px). */
export const EPAISSEUR_ANNEAU = 8;
/** La plus petite et la plus grande taille acceptées (LOT-06 : 26 à 58 ; H42 : 80). */
export const TAILLE_ANNEAU_MIN = 26;
export const TAILLE_ANNEAU_MAX = 80;

/** La taille, bornée à [26, 80] ; une valeur qui n'est pas un nombre fini vaut 72. */
export function tailleAnneau(taille: number | undefined): number {
  return Number.isFinite(taille) ? Math.min(TAILLE_ANNEAU_MAX, Math.max(TAILLE_ANNEAU_MIN, Math.round(taille as number))) : 72;
}

/** L'épaisseur du trait : 8 px dès 72 px ; en dessous, proportionnelle (8 × taille / 72), jamais moins de 3 px. */
export function epaisseurAnneau(taille: number): number {
  const t = tailleAnneau(taille);
  return t >= 72 ? EPAISSEUR_ANNEAU : Math.max(3, Math.round((EPAISSEUR_ANNEAU * t) / 72));
}

/** La cote du centre : `grand` (72 et plus, 16 px), `moyen` (48 à 71, 13 px), `petit` (40 à 47, 11 px), `muet` (moins de 40 : rien). */
export function coteAnneau(taille: number): 'grand' | 'moyen' | 'petit' | 'muet' {
  const t = tailleAnneau(taille);
  return t >= 72 ? 'grand' : t >= 48 ? 'moyen' : t >= 40 ? 'petit' : 'muet';
}

export function Anneau({ valeur, libelle, texte, taille = 72, ton = 'neutre', children, anime = true }: AnneauProps) {
  const pourcent = formaterPourcent(Math.round(Math.min(1, Math.max(0, Number.isFinite(valeur) ? valeur : 0)) * 100));
  const t = tailleAnneau(taille);
  const cote = coteAnneau(t);
  return (
    <span className="sc-g-anneau" data-socle="anneau" data-cote={cote === 'grand' ? undefined : cote}>
      <AnneauProgression valeur={valeur} libelle={libelle} texte={texte ?? pourcent} taille={t} epaisseur={epaisseurAnneau(t)} piste="anneau" ton={ton} anime={anime}>
        {children ?? (cote === 'muet' ? null : pourcent)}
      </AnneauProgression>
    </span>
  );
}
