import React from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import type { Famille } from '../../familles';
import { useSocleLangue } from '../../i18n';
import { IconTile, type IconTileProps } from './IconTile';

/**
 * LA TUILE DE MODULE (`ModuleTile`, STATUT §1.10 point 1) — partagée par les vues d'ensemble F10 à F70 (dont les
 * fiches ne sont pas encore reçues) et par D02. Une tuile = l'icône du module dans une `IconTile`, son nom, un
 * sous-texte facultatif, et à droite un accessoire (`CountBadge`, `StatusPill`, ou `LiveDot` avec `afficherLibelle` :
 * un point seul ne porte pas l'état, §7.6). Un lien quand on lui donne `vers`, un bouton quand on lui donne `onClick` ;
 * l'un des deux au moins, par le type (`CibleTuile`) : jamais un bouton qui ne fait rien.
 *
 * Deux variantes :
 *   · `ligne`    — la puce des épinglés de D02, mesurée sur son image : 34 px de haut, `IconTile` de 22 px dans une
 *                  puce bordée (`--socle-bord-sous-carte`) sur fond `--socle-sous-carte`, rayon 9, nom 12,5 px / 500.
 *   · `standard` — « ModuleTile (41 px) » du CO : 41 px de haut, `IconTile` de 26 px, nom 13 px T2, sous-texte
 *                  11,5 px T4, survol de ligne de la couche de mouvement. PROVISOIRE tant que les fiches F10–F70 ne
 *                  sont pas reçues : le rayon (9), l'écart (10), la marge (8) et le poids du nom (500) sont supposés.
 *
 * `actif` pose `aria-current="page"` (le module ouvert) : fond `--socle-ligne-choisie`, nom T1.
 */
export type VarianteModuleTile = 'standard' | 'ligne';

/**
 * Où mène une tuile : une route (`vers` — un lien, qui peut aussi prévenir par `onClick`) ou une action seule
 * (`onClick` — un bouton). Sans l'un ni l'autre, la tuile serait un bouton inerte : le type le refuse.
 */
export type CibleTuile = { vers: string; onClick?: () => void } | { vers?: undefined; onClick: () => void };

export interface ModuleTileBase {
  nom: string;
  /** Le glyphe du module (lucide-react). */
  icone: React.ReactNode;
  famille?: Famille | 'garde';
  /** Une ligne sous le nom (variante standard) : « 3 à faire », « ouvert ce matin ». */
  sousTexte?: string;
  /** À droite : un `CountBadge`, une `StatusPill`, un `LiveDot` (avec `afficherLibelle`). */
  accessoire?: React.ReactNode;
  variante?: VarianteModuleTile;
  /** Le module ouvert. */
  actif?: boolean;
  /** Réglages de la tuile d'icône (part de teinte, bordure) : D02 garde ses pixels. */
  tuile?: Pick<IconTileProps, 'part' | 'bordure'>;
  title?: string;
  'aria-label'?: string;
  className?: string;
}

export type ModuleTileProps = ModuleTileBase & CibleTuile;

export function ModuleTile({ nom, icone, famille, sousTexte, accessoire, variante = 'standard', actif = false, vers, onClick, tuile, title, className, ...aria }: ModuleTileProps) {
  const { ts } = useSocleLangue();
  const commun = {
    className: ['sc-module-tile', 'sc-focus', className].filter(Boolean).join(' '),
    'data-variante': variante,
    'aria-current': actif ? ('page' as const) : undefined,
    /* Le survol de ligne de la couche de mouvement (§0.2) : la variante standard ; la puce de D02 n'éclaire que sa bordure. */
    'data-mvt-survol': variante === 'standard' ? ('ligne' as const) : undefined,
    title: title ?? nom,
    'aria-label': aria['aria-label'],
  };
  const contenu = (
    <>
      <IconTile icone={icone} taille={variante === 'ligne' ? 22 : 26} famille={famille} part={tuile?.part} bordure={tuile?.bordure} />
      <span className="sc-module-tile__textes">
        <span className="sc-module-tile__nom">{nom}</span>
        {variante === 'standard' && sousTexte && <span className="sc-module-tile__sous">{sousTexte}</span>}
      </span>
      {actif && <span className="sr-only"> · {ts('briques.tuile.actif')}</span>}
      {accessoire && <span className="sc-module-tile__acc">{accessoire}</span>}
    </>
  );
  if (vers) {
    return (
      <Link to={vers} onClick={onClick} {...commun}>
        {contenu}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} {...commun}>
      {contenu}
    </button>
  );
}

export interface AddModuleTileBase {
  /** Le libellé (défaut : « Ajouter un module » ; « Ajouter » en variante `ligne`, où la puce fait 132 px). */
  libelle?: string;
  variante?: VarianteModuleTile;
  className?: string;
}

/** Mène à Tous les modules (D02, `vers`) ou à une action (`onClick`) : l'un des deux au moins (`CibleTuile`). */
export type AddModuleTileProps = AddModuleTileBase & CibleTuile;

/**
 * LA TUILE « + AJOUTER UN MODULE » (`AddModuleTile`) — pointillé `--socle-pointille` (#2E2E33, comme `Empty`), même
 * hauteur et même rayon que `ModuleTile`, icône + de 14 px, libellé T3 (jamais coupé net : ellipse). Un lien vers Tous les
 * modules (D02) ou un bouton.
 */
export function AddModuleTile({ libelle, vers, onClick, variante = 'standard', className }: AddModuleTileProps) {
  const { ts } = useSocleLangue();
  const commun = { className: ['sc-add-module-tile', 'sc-focus', className].filter(Boolean).join(' '), 'data-variante': variante };
  const contenu = (
    <>
      <Plus aria-hidden size={14} strokeWidth={2} />
      <span className="sc-add-module-tile__libelle">{libelle ?? ts(variante === 'ligne' ? 'briques.ajouter' : 'briques.ajouterModule')}</span>
    </>
  );
  if (vers) {
    return (
      <Link to={vers} onClick={onClick} {...commun}>
        {contenu}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} {...commun}>
      {contenu}
    </button>
  );
}

export interface ModuleGroupGridProps {
  /** Le titre du groupe (11 px, capitales, T4, `.08em`). */
  titre: string;
  /** L'effectif écrit à côté du titre ; absent : le nombre d'enfants. */
  effectif?: number;
  /** Des `ModuleTile`. */
  children: React.ReactNode;
  /** Le nombre de colonnes (3 par défaut). */
  colonnes?: number;
  /** Avec `onAjouter` ou `versAjouter`, une `AddModuleTile` ferme la grille. */
  onAjouter?: () => void;
  versAjouter?: string;
  libelleAjouter?: string;
  variante?: VarianteModuleTile;
  className?: string;
}

/**
 * LA GRILLE D'UN GROUPE DE MODULES (`ModuleGroupGrid`, F10, F30, F50) — un titre de groupe en capitales avec son
 * effectif, puis N colonnes de `ModuleTile` (écart 6, celui des épinglés de D02), et `AddModuleTile` en dernière
 * position quand on donne `onAjouter` ou `versAjouter`. PROVISOIRE : les fiches F10–F70 diront la largeur des
 * colonnes et l'écart entre groupes (14 px ici, l'écart de page du socle).
 */
export function ModuleGroupGrid({ titre, effectif, children, colonnes = 3, onAjouter, versAjouter, libelleAjouter, variante = 'standard', className }: ModuleGroupGridProps) {
  const { ts } = useSocleLangue();
  const id = React.useId();
  const n = effectif ?? React.Children.toArray(children).filter(Boolean).length;
  return (
    <section aria-labelledby={id} className={['sc-module-group', className].filter(Boolean).join(' ')}>
      <h3 id={id} className="sc-module-group__titre">
        <span className="sc-module-group__nom">{titre}</span>
        {/* Le chiffre se voit ; les lecteurs d'écran lisent « 4 modules » en texte (un aria-label sur un span sans rôle n'est pas annoncé de façon fiable). */}
        <span className="sc-module-group__effectif sc-nombre">
          <span aria-hidden="true">{n}</span>
          <span className="sr-only"> {n === 1 ? ts('briques.groupe.effectif.un') : ts('briques.groupe.effectif', { n })}</span>
        </span>
      </h3>
      <div className="sc-module-group__grille" style={{ '--sc-module-colonnes': colonnes } as React.CSSProperties}>
        {children}
        {versAjouter ? (
          <AddModuleTile libelle={libelleAjouter} vers={versAjouter} onClick={onAjouter} variante={variante} />
        ) : (
          onAjouter && <AddModuleTile libelle={libelleAjouter} onClick={onAjouter} variante={variante} />
        )}
      </div>
    </section>
  );
}
