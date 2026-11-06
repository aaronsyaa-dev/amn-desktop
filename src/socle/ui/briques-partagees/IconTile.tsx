import React from 'react';
import type { Famille } from '../../familles';

/**
 * LA TUILE D'ICÔNE (`IconTile`, 01-SOCLE-DESIGN §4 et §5, fiches v3) — un carré arrondi teinté de la couleur de la
 * famille (`rgba(famille, .13)`) ou neutre (aplat `#1A1A1C`, jeton `--socle-tag`), avec un glyphe lucide de trait.
 *
 * Les tailles sont celles des écrans qui la dessinent déjà, mesurées sur leurs images : 22 (D02, épinglés et
 * récents), 26 (H41, lignes de la palette), 28 (D02, à découvrir), 36 (H43, état compact), 38 (archétype Cartes),
 * 42 (H41, aperçu), 44 (`Empty`, état vide), 48 (`BlocEtat` standard). Le rayon et le glyphe suivent la taille dans
 * `briques-partagees.css` (`data-taille`) : la brique ne reçoit jamais une cote à la main.
 *
 * `part` : la part de la couleur de famille dans le fond, en pour cent. Le socle dit 13 ; les images de D02 (10,
 * avec une bordure à 22) et de H41 (14, 18 pour l'aperçu) en diffèrent, et ces écrans gardent leurs pixels :
 * elles passent par ce réglage plutôt que par une feuille locale. `ton` : la couleur d'un état à la place de la
 * famille (`neutre` est l'aplat du §4).
 *
 * Décorative par défaut (le texte voisin dit le module) ; avec `libelle`, elle devient une image nommée.
 */
export type TailleIconTile = 22 | 26 | 28 | 36 | 38 | 42 | 44 | 48;
export type TonIconTile = 'neutre' | 'succes' | 'attention' | 'critique' | 'info';
export type PartIconTile = 10 | 13 | 14 | 18;

export interface IconTileProps {
  /** Le glyphe (lucide-react) : sa taille vient de la feuille, selon `taille`. */
  icone: React.ReactNode;
  taille?: TailleIconTile;
  /** La famille dont on prend la couleur (`data-famille`, variable `--fam`) ; `garde` a sa teinte propre. */
  famille?: Famille | 'garde';
  /** La couleur d'un état à la place de la famille. `neutre` : l'aplat `--socle-tag` du §4. */
  ton?: TonIconTile;
  /** La part de la teinte dans le fond (13 par défaut, §4). */
  part?: PartIconTile;
  /** Une bordure de la teinte à 22 % (D02). */
  bordure?: boolean;
  /** Nom accessible : la tuile devient une image. Sans lui, elle est décorative. */
  libelle?: string;
  className?: string;
}

export function IconTile({ icone, taille = 26, famille, ton, part, bordure = false, libelle, className }: IconTileProps) {
  return (
    <span
      role={libelle ? 'img' : undefined}
      aria-label={libelle}
      aria-hidden={libelle ? undefined : true}
      data-taille={taille}
      data-famille={famille}
      data-ton={ton}
      data-part={part && part !== 13 ? part : undefined}
      data-bordure={bordure || undefined}
      className={['sc-icon-tile', className].filter(Boolean).join(' ')}
    >
      {icone}
    </span>
  );
}
