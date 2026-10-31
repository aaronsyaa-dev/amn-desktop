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
 * `taille` : 72 ou 76 selon l'écran, 80 pour H42. `ton` : le trait (« neutre » =
 * encre principale, ou un état). Un anneau est une progression, pas un tableau :
 * il reste un `progressbar` (valeur dite en mots) plutôt qu'un `img`.
 */
export interface AnneauProps {
  /** De 0 à 1 ; une valeur hors de l'intervalle est ramenée dedans. */
  valeur: number;
  /** Ce que l'anneau mesure, pour les lecteurs d'écran. */
  libelle: string;
  /** La valeur dite en mots (défaut : « 80 % »). */
  texte?: string;
  /** 72 à 76 px, 80 pour H42 (défaut 72). */
  taille?: number;
  ton?: TonVariation;
  /** Au centre, à la place du pour cent (« 3/7 »…). */
  children?: React.ReactNode;
}

/** Épaisseur du trait de l'anneau (spec : 8). */
export const EPAISSEUR_ANNEAU = 8;

export function Anneau({ valeur, libelle, texte, taille = 72, ton = 'neutre', children }: AnneauProps) {
  const pourcent = formaterPourcent(Math.round(Math.min(1, Math.max(0, Number.isFinite(valeur) ? valeur : 0)) * 100));
  return (
    <span className="sc-g-anneau" data-socle="anneau">
      <AnneauProgression valeur={valeur} libelle={libelle} texte={texte ?? pourcent} taille={taille} epaisseur={EPAISSEUR_ANNEAU} piste="anneau" ton={ton}>
        {children ?? pourcent}
      </AnneauProgression>
    </span>
  );
}
