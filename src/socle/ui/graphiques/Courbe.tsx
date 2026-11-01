import React, { useId } from 'react';
import { useSocleLangue } from '../../i18n';
import {
  abscisses,
  calculerEchelle,
  cheminAire,
  cheminLigne,
  estFini,
  indicesEtiquetes,
  mesurerTexte,
  pasEtiquettes,
  positionner,
  type Point,
} from './calculs';
import { PointsInteractifs, TableauAlternatif, phraseSerie, useActif, useLargeur, type ZoneGraphique } from './commun';
import { formaterNombre, TIRET_ABSENT } from './format';
import { couleurTon, type TonGraphique } from './tons';

/**
 * LA COURBE — aire dégradée (.28 → 0), ligne de 2 px, point final cerclé, grille,
 * axes en 10,5 px T4, option : seconde série en pointillé.
 *
 * Tout vient des données : l'échelle (bornes et graduations arrondies à un pas
 * lisible), les positions, les étiquettes d'axe qu'on garde ou saute selon la
 * place. Aucun chiffre d'exemple n'est codé ici.
 *
 *   0 point      → un cadre « Pas encore de données » (jamais un trou ni une erreur) ;
 *   1 point      → le point seul, centré, sans ligne ni aire ;
 *   tous égaux   → l'échelle s'ouvre autour de la valeur, la ligne est au milieu ;
 *   négatifs     → l'échelle descend sous zéro.
 *
 * Accessibilité : le dessin est `role="img"` avec un résumé (« Courbe, 12 points,
 * de X à Y, dernier : Z »), un tableau `sr-only` donne toutes les valeurs, et
 * chaque point est un vrai bouton (flèches ← →, un seul actif à la fois) tant
 * que `interactif` n'est pas coupé. La couleur ne porte jamais seule : une
 * seconde série a sa légende (trait plein / pointillé + nom).
 *
 * Animation d'entrée : la couche de mouvement commune (`src/socle/mouvement.css`, §0.2) — tracé
 * de la ligne en 1,3 s, puis l'aire en fondu, le point final en fondu à 1,2 s. `prefers-reduced-motion`
 * et le réglage Mouvement « aucun » la suppriment ; « réduit » n'en garde que les fondus courts.
 */
export interface PointGraphique {
  /** L'abscisse, dite telle quelle : « mars », « 12 oct. »… */
  etiquette: string;
  valeur: number;
}

export interface CourbeProps {
  donnees: readonly PointGraphique[];
  /** Ce que la courbe mesure (« Encaissements »), en tête du résumé lu à voix haute. */
  libelle: string;
  /** Une seconde série, une valeur par point de `donnees` (même ordre), tracée en pointillé. Une valeur manquante ouvre un trou. */
  secondeSerie?: ReadonlyArray<number | null | undefined>;
  /** Nom de la série principale (légende, tableau). */
  nom?: string;
  /** Nom de la seconde série (légende, tableau). */
  nomSeconde?: string;
  /** Famille ou état ; « neutre » (défaut) est l'encre principale. */
  ton?: TonGraphique;
  /** Hauteur du dessin, en pixels (défaut 180). */
  hauteur?: number;
  /** Force le zéro dans l'échelle (défaut : l'échelle suit les données). */
  depuisZero?: boolean;
  /** Comment une valeur s'écrit (défaut `formaterNombre` ; passez `formaterEuro`, `formaterPourcent`…). */
  formater?: (valeur: number) => string;
  /** Points au survol et au clavier (défaut : oui). Coupé : aucun bouton, aucune tabulation. */
  interactif?: boolean;
  className?: string;
}

/** La largeur d'un rendu hors navigateur ; en vrai, la largeur mesurée prend le relais. */
const LARGEUR_DEFAUT = 560;
const MARGE_HAUT = 14;
const MARGE_BAS = 24;
const MARGE_DROITE = 14;
const RAYON_FIN = 4;
const RAYON_ACTIF = 5;
const ECART_AXE = 8;

export function Courbe({
  donnees,
  libelle,
  secondeSerie,
  nom,
  nomSeconde,
  ton = 'neutre',
  hauteur = 180,
  depuisZero = false,
  formater = formaterNombre,
  interactif = true,
  className = '',
}: CourbeProps) {
  const { ts } = useSocleLangue();
  const [ref, largeur] = useLargeur<HTMLDivElement>(LARGEUR_DEFAUT);
  const idDegrade = useId();
  const { actif, onActiver, onDesactiver } = useActif();

  const lignes = donnees
    .map((d, i) => ({ etiquette: String(d.etiquette), v: d.valeur, v2: secondeSerie?.[i] }))
    .filter((l) => estFini(l.v));
  const n = lignes.length;
  const style = { '--sc-g-c': couleurTon(ton) } as React.CSSProperties;
  const aSeconde = lignes.some((l) => estFini(l.v2));
  const nomA = nom ?? ts('graphique.serie1');
  const nomB = nomSeconde ?? ts('graphique.serie2');

  const phrase = phraseSerie(ts, { plusieurs: 'graphique.courbe', un: 'graphique.courbe.un', vide: 'graphique.courbe.vide' }, lignes.map((l) => l.v), formater);
  const resume = `${libelle}. ${phrase}`;

  if (n === 0) {
    return (
      <div ref={ref} role="img" aria-label={resume} className={`sc-g sc-g--vide ${className}`} style={{ ...style, minHeight: hauteur }} data-socle="courbe" data-vide="true">
        <span>{ts('graphique.vide')}</span>
      </div>
    );
  }

  const ech = calculerEchelle([...lignes.map((l) => l.v), ...lignes.map((l) => l.v2).filter(estFini)], { graduations: 4, inclureZero: depuisZero });
  if (!ech) return null; // inatteignable : n > 0 implique au moins une valeur finie.

  const gauche = Math.max(...ech.graduations.map((g) => mesurerTexte(formater(g)))) + 2 * ECART_AXE;
  const interne = Math.max(largeur - gauche - MARGE_DROITE, 20);
  const yBas = hauteur - MARGE_BAS;
  const xs = abscisses(n, gauche, interne);
  const y = (v: number) => positionner(v, ech, MARGE_HAUT, yBas);
  const points: Point[] = lignes.map((l, i) => [xs[i], y(l.v)]);
  const points2: Array<Point | null> = lignes.map((l, i) => (estFini(l.v2) ? [xs[i], y(l.v2)] : null));

  const largeurEtiquette = Math.max(...lignes.map((l) => mesurerTexte(l.etiquette)));
  const etiquetees = indicesEtiquetes(n, pasEtiquettes(n, n > 1 ? interne / (n - 1) : interne, largeurEtiquette));

  const texteValeurs = (i: number): string =>
    aSeconde && estFini(lignes[i].v2) ? `${formater(lignes[i].v)} (${nomA}), ${formater(lignes[i].v2)} (${nomB})` : formater(lignes[i].v);
  const nomZone = (i: number): string => ts('graphique.point', { etiquette: lignes[i].etiquette, valeur: texteValeurs(i) });

  const demi = (n > 1 ? interne / (n - 1) : interne) / 2;
  const zones: ZoneGraphique[] = lignes.map((_, i) => ({
    debut: Math.max(0, xs[i] - demi) / largeur,
    fin: Math.min(largeur, xs[i] + demi) / largeur,
    nom: nomZone(i),
  }));

  const iActif = actif && actif.index < n ? actif.index : null;
  const aire = cheminAire(points, yBas);
  const point2Actif = iActif !== null ? points2[iActif] : null;

  return (
    <div ref={ref} className={`sc-g sc-g--courbe ${className}`} style={style} data-socle="courbe">
      <div className="sc-g__scene">
        <svg
          role="img"
          aria-label={resume}
          viewBox={`0 0 ${largeur} ${hauteur}`}
          preserveAspectRatio="xMidYMid meet"
          focusable="false"
          className="sc-g__svg"
        >
          {aire && (
            <defs>
              <linearGradient id={idDegrade} x1="0" y1="0" x2="0" y2="1">
                <stop className="sc-g__degrade" offset="0" stopOpacity="0.28" />
                <stop className="sc-g__degrade" offset="1" stopOpacity="0" />
              </linearGradient>
            </defs>
          )}
          {ech.graduations.map((g) => (
            <g key={g}>
              <line className="sc-g__grille" x1={gauche} x2={gauche + interne} y1={y(g)} y2={y(g)} />
              <text className="sc-g__axe" x={gauche - ECART_AXE} y={y(g)} dy="0.32em" textAnchor="end">
                {formater(g)}
              </text>
            </g>
          ))}
          {etiquetees.map((i) => (
            <text
              key={i}
              className="sc-g__axe"
              x={xs[i]}
              y={hauteur - 6}
              textAnchor={n === 1 ? 'middle' : i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}
            >
              {lignes[i].etiquette}
            </text>
          ))}
          {aire && <path className="sc-g__aire" d={aire} fill={`url(#${idDegrade})`} data-mvt="aire" />}
          {aSeconde && <path className="sc-g__ligne2" d={cheminLigne(points2)} data-mvt="aire" />}
          {n > 1 && <path className="sc-g__ligne" d={cheminLigne(points)} pathLength={1} data-mvt="trace" />}
          <circle className="sc-g__fin" cx={points[n - 1][0]} cy={points[n - 1][1]} r={RAYON_FIN} data-mvt="point-final" />
          {iActif !== null && (
            <g className="sc-g__actif">
              <line className="sc-g__repere" x1={xs[iActif]} x2={xs[iActif]} y1={MARGE_HAUT} y2={yBas} />
              {point2Actif && <circle className="sc-g__point2" cx={point2Actif[0]} cy={point2Actif[1]} r={RAYON_ACTIF - 1} />}
              <circle className="sc-g__point" cx={xs[iActif]} cy={points[iActif][1]} r={RAYON_ACTIF} />
            </g>
          )}
        </svg>
        {interactif && <PointsInteractifs zones={zones} onActiver={onActiver} onDesactiver={onDesactiver} />}
        {iActif !== null && (
          <div
            className="sc-g__bulle"
            aria-hidden
            data-bas={points[iActif][1] < 56 ? 'oui' : undefined}
            style={{ left: `clamp(56px, ${(xs[iActif] / largeur) * 100}%, calc(100% - 56px))`, top: points[iActif][1] }}
          >
            <span className="sc-g__bulle-etiquette">{lignes[iActif].etiquette}</span>
            <span className="sc-g__bulle-valeur">{aSeconde && estFini(lignes[iActif].v2) ? `${formater(lignes[iActif].v)} · ${formater(lignes[iActif].v2)}` : formater(lignes[iActif].v)}</span>
          </div>
        )}
      </div>
      {aSeconde && (
        <ul className="sc-g__legende" aria-label={ts('graphique.legende')}>
          <li>
            <svg width="18" height="8" aria-hidden className="sc-g__echantillon">
              <line className="sc-g__ligne-echantillon" x1="1" x2="17" y1="4" y2="4" />
            </svg>
            <span>{nomA}</span>
          </li>
          <li>
            <svg width="18" height="8" aria-hidden className="sc-g__echantillon">
              <line className="sc-g__ligne-echantillon sc-g__ligne-echantillon--pointille" x1="1" x2="17" y1="4" y2="4" />
            </svg>
            <span>{nomB}</span>
          </li>
        </ul>
      )}
      <TableauAlternatif
        legende={resume}
        colonnes={aSeconde ? [nomA, nomB] : [nomA]}
        lignes={lignes.map((l) => ({ entete: l.etiquette, cellules: aSeconde ? [formater(l.v), estFini(l.v2) ? formater(l.v2) : TIRET_ABSENT] : [formater(l.v)] }))}
      />
      <span role="status" className="sr-only">
        {actif?.source === 'souris' && iActif !== null ? nomZone(iActif) : ''}
      </span>
    </div>
  );
}
