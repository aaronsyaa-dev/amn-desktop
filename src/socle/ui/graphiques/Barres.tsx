import React from 'react';
import { useSocleLangue } from '../../i18n';
import { calculerEchelle, estFini, indicesEtiquetes, mesurerTexte, pasEtiquettes, positionner, resumer } from './calculs';
import { PointsInteractifs, TableauAlternatif, useActif, useLargeur, type ZoneGraphique } from './commun';
import { formaterNombre } from './format';
import type { PointGraphique } from './Courbe';
import { couleurTon, type TonGraphique } from './tons';
import { decalageBarres, styleRang } from '../../couche-mouvement';

/**
 * LES BARRES — des colonnes grises, une seule mise en valeur en bleu d'information,
 * avec sa valeur au-dessus ; les étiquettes d'axe en T4, 10,5 px.
 *
 * Les colonnes partent TOUJOURS de zéro (une colonne tronquée mentirait). Une
 * valeur nulle se dessine en filet de 2 px sur la ligne de base : elle est
 * visible, elle ne disparaît pas. Les négatives descendent sous la ligne.
 *
 * Qui est mis en valeur : `miseEnValeur` (un indice, ou `null` pour personne) ;
 * par défaut, la plus grande valeur. Au survol ou aux flèches ← →, la colonne
 * active montre elle aussi sa valeur ; un seul point est actif à la fois.
 *
 * Accessibilité : `role="img"` avec un résumé (« Barres, 7 colonnes, de X à Y »),
 * un tableau `sr-only` avec toutes les valeurs, des boutons par colonne tant
 * que `interactif` n'est pas coupé. L'entrée vient de la couche de mouvement commune
 * (§0.2) : chaque colonne pousse depuis la ligne de base en 700 ms, avec un décalage de
 * 22 à 40 ms selon leur nombre ; supprimée par `prefers-reduced-motion`, « réduit » et « aucun ».
 */
export interface BarresProps {
  donnees: readonly PointGraphique[];
  /** Ce que les barres mesurent (« Factures par mois »), en tête du résumé lu à voix haute. */
  libelle: string;
  /** Nom de la série, pour le tableau lu par les lecteurs d'écran. */
  nom?: string;
  /** La couleur de la colonne mise en valeur : défaut « info » (`--socle-etat-info`). */
  ton?: TonGraphique;
  /** Indice de la colonne mise en valeur (dans `donnees`, valeurs finies seules), `null` pour aucune ; défaut : la plus grande. */
  miseEnValeur?: number | null;
  hauteur?: number;
  formater?: (valeur: number) => string;
  interactif?: boolean;
  className?: string;
}

const LARGEUR_DEFAUT = 560;
const MARGE_HAUT = 24;
const MARGE_BAS = 24;
const MARGE_COTES = 4;
/** Place gardée sous la ligne de base quand une valeur négative écrit son chiffre en dessous. */
const RESERVE_NEGATIVE = 20;
const LARGEUR_MAX_COLONNE = 36;
const FILET = 2;
const TAILLE_VALEUR = 12;

export function Barres({ donnees, libelle, nom, ton = 'info', miseEnValeur, hauteur = 160, formater = formaterNombre, interactif = true, className = '' }: BarresProps) {
  const { ts } = useSocleLangue();
  const [ref, largeur] = useLargeur<HTMLDivElement>(LARGEUR_DEFAUT);
  const { actif, onActiver, onDesactiver } = useActif();

  const colonnes = donnees.map((d) => ({ etiquette: String(d.etiquette), v: d.valeur })).filter((c) => estFini(c.v));
  const n = colonnes.length;
  const style = { '--sc-g-c': couleurTon(ton) } as React.CSSProperties;
  const r = resumer(colonnes.map((c) => c.v));
  const resume = `${libelle}. ${r ? ts('graphique.barres', { n: r.n, min: formater(r.min), max: formater(r.max) }) : ts('graphique.barres.vide')}`;

  if (n === 0) {
    return (
      <div ref={ref} role="img" aria-label={resume} className={`sc-g sc-g--vide ${className}`} style={{ ...style, minHeight: hauteur }} data-socle="barres" data-vide="true">
        <span>{ts('graphique.vide')}</span>
      </div>
    );
  }

  const valeurs = colonnes.map((c) => c.v);
  const ech = calculerEchelle(valeurs, { graduations: 3, inclureZero: true });
  if (!ech) return null; // inatteignable : n > 0 implique au moins une valeur finie.

  const aNegatif = valeurs.some((v) => v < 0);
  const yBas = hauteur - MARGE_BAS - (aNegatif ? RESERVE_NEGATIVE : 0);
  const y = (v: number) => positionner(v, ech, MARGE_HAUT, yBas);
  const y0 = y(0);
  const interne = Math.max(largeur - 2 * MARGE_COTES, 10);
  const largeurCase = interne / n;
  const epaisseur = Math.min(LARGEUR_MAX_COLONNE, Math.max(2, largeurCase * 0.6));
  const centre = (i: number) => MARGE_COTES + largeurCase * (i + 0.5);

  const iMax = valeurs.some((v) => v !== 0) ? valeurs.indexOf(Math.max(...valeurs)) : -1;
  const iMise = miseEnValeur === null ? -1 : miseEnValeur === undefined ? iMax : Number.isInteger(miseEnValeur) && miseEnValeur >= 0 && miseEnValeur < n ? miseEnValeur : -1;
  const iActif = actif && actif.index < n ? actif.index : -1;

  const largeurEtiquette = Math.max(...colonnes.map((c) => mesurerTexte(c.etiquette)));
  const etiquetees = indicesEtiquetes(n, pasEtiquettes(n, largeurCase, largeurEtiquette));
  const nomZone = (i: number) => ts('graphique.point', { etiquette: colonnes[i].etiquette, valeur: formater(colonnes[i].v) });
  const zones: ZoneGraphique[] = colonnes.map((_, i) => ({ debut: (MARGE_COTES + largeurCase * i) / largeur, fin: (MARGE_COTES + largeurCase * (i + 1)) / largeur, nom: nomZone(i) }));

  /** Une valeur écrite au-dessus de sa colonne (en dessous si elle est négative), jamais coupée par les bords. */
  const valeurDe = (i: number) => {
    const v = colonnes[i].v;
    const texte = formater(v);
    const demi = mesurerTexte(texte, TAILLE_VALEUR) / 2;
    const x = Math.min(largeur - demi - 1, Math.max(demi + 1, centre(i)));
    const bord = v < 0 ? Math.max(y(v), y0 + FILET) : Math.min(y(v), y0 - FILET);
    return (
      <text key={`v${i}`} className="sc-g__valeur" x={x} y={v < 0 ? bord + TAILLE_VALEUR + 4 : bord - 6} textAnchor="middle">
        {texte}
      </text>
    );
  };

  // Le décalage entre deux colonnes (22 à 40 ms selon leur nombre), lu par la couche de mouvement.
  const styleDessin = { '--sc-mvt-barre-decalage': `${decalageBarres(n)}ms` } as React.CSSProperties;

  return (
    <div ref={ref} className={`sc-g sc-g--barres ${className}`} style={style} data-socle="barres">
      <div className="sc-g__scene">
        <svg role="img" aria-label={resume} viewBox={`0 0 ${largeur} ${hauteur}`} preserveAspectRatio="xMidYMid meet" focusable="false" className="sc-g__svg" style={styleDessin}>
          <line className="sc-g__grille" x1={MARGE_COTES} x2={largeur - MARGE_COTES} y1={y0} y2={y0} />
          {colonnes.map((c, i) => {
            const bas = c.v < 0;
            const haut = c.v === 0 ? FILET : Math.max(Math.abs(y(c.v) - y0), FILET);
            return (
              <rect
                key={i}
                className="sc-g__colonne"
                data-mvt="pousse"
                style={styleRang(i)}
                x={centre(i) - epaisseur / 2}
                y={bas ? y0 : y0 - haut}
                width={epaisseur}
                height={haut}
                rx={Math.min(4, haut / 2, epaisseur / 2)}
                data-mise={i === iMise ? 'oui' : undefined}
                data-zero={c.v === 0 ? 'oui' : undefined}
                data-actif={i === iActif ? 'oui' : undefined}
                data-sens={bas ? 'bas' : undefined}
              />
            );
          })}
          {etiquetees.map((i) => {
            const demi = mesurerTexte(colonnes[i].etiquette) / 2;
            return (
              <text key={i} className="sc-g__axe" x={Math.min(largeur - demi - 1, Math.max(demi + 1, centre(i)))} y={hauteur - 6} textAnchor="middle">
                {colonnes[i].etiquette}
              </text>
            );
          })}
          {iMise >= 0 && valeurDe(iMise)}
          {iActif >= 0 && iActif !== iMise && valeurDe(iActif)}
        </svg>
        {interactif && <PointsInteractifs zones={zones} onActiver={onActiver} onDesactiver={onDesactiver} />}
      </div>
      <TableauAlternatif legende={resume} colonnes={[nom ?? ts('graphique.tableau.valeur')]} lignes={colonnes.map((c) => ({ entete: c.etiquette, cellules: [formater(c.v)] }))} />
      <span role="status" className="sr-only">
        {actif?.source === 'souris' && iActif >= 0 ? nomZone(iActif) : ''}
      </span>
    </div>
  );
}
