import React, { useLayoutEffect, useRef, useState } from 'react';
import { useSocleLangue, type CleSocle, type ParamsSocle } from '../../i18n';
import { resumer } from './calculs';

/**
 * Les petites pièces que les graphiques se partagent : la largeur mesurée, le
 * tableau lu par les lecteurs d'écran, les zones qu'on survole ou qu'on
 * parcourt aux flèches.
 */

/**
 * La largeur réelle du conteneur, en pixels, tenue à jour.
 *
 * Le graphique se dessine dans un `viewBox` égal à cette largeur : un pixel de
 * dessin vaut un pixel d'écran, donc un axe en 10,5 px reste à 10,5 px quel que
 * soit l'emplacement (un `viewBox` fixe réduirait les textes avec lui). Hors
 * navigateur — rendu statique, tests — on garde `defaut`.
 */
export function useLargeur<T extends HTMLElement>(defaut: number): [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [largeur, setLargeur] = useState(defaut);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const lire = () => {
      const l = Math.round(el.getBoundingClientRect().width);
      if (l > 0) setLargeur(l);
    };
    lire();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const veille = new ResizeObserver(lire);
    veille.observe(el);
    return () => veille.disconnect();
  }, []);
  return [ref, largeur];
}

export interface LigneTableau {
  entete: string;
  cellules: readonly string[];
}

/**
 * L'ALTERNATIVE TEXTUELLE : toutes les valeurs, en tableau, masquée à l'œil
 * (`sr-only`) et lue par les lecteurs d'écran. Un graphique n'est jamais le
 * seul porteur de ses chiffres.
 */
export function TableauAlternatif({ legende, colonnes, lignes }: { legende: string; colonnes: readonly string[]; lignes: readonly LigneTableau[] }) {
  const { ts } = useSocleLangue();
  return (
    <table className="sr-only" data-socle="graphique-tableau">
      <caption>{legende}</caption>
      <thead>
        <tr>
          <th scope="col">{ts('graphique.tableau.etiquette')}</th>
          {colonnes.map((nom, i) => (
            <th key={i} scope="col">
              {nom}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {lignes.map((l, i) => (
          <tr key={i}>
            <th scope="row">{l.entete}</th>
            {l.cellules.map((cel, j) => (
              <td key={j}>{cel}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export type SourceActive = 'souris' | 'clavier';

/**
 * Le point actif : un seul à la fois, avec sa source. Chaque source n'efface que
 * ce qu'elle a posé : quitter le point du pointeur ne désactive pas un point que
 * le clavier vient de choisir.
 */
export function useActif() {
  const [actif, setActif] = useState<{ index: number; source: SourceActive } | null>(null);
  return {
    actif,
    onActiver: (index: number, source: SourceActive) => setActif({ index, source }),
    onDesactiver: (source: SourceActive) => setActif((a) => (a && a.source === source ? null : a)),
  };
}

export interface ZoneGraphique {
  /** De 0 à 1, dans la largeur du graphique. */
  debut: number;
  fin: number;
  /** Ce que dit la zone au lecteur d'écran : « mars : 1 250 € ». */
  nom: string;
}

/**
 * Les zones qu'on survole ou qu'on parcourt : un vrai `<button>` par point, posé
 * au-dessus du dessin. Une seule tabulation (le point « courant », par défaut
 * le dernier) ; ← → passent d'un point à l'autre, Début et Fin vont aux
 * extrémités. Un seul point est actif à la fois. Sans `interactif`, rien de
 * tout cela n'existe : pas de bouton, pas de tabulation.
 */
export function PointsInteractifs({
  zones,
  onActiver,
  onDesactiver,
}: {
  zones: readonly ZoneGraphique[];
  onActiver: (index: number, source: SourceActive) => void;
  onDesactiver: (source: SourceActive) => void;
}) {
  const { ts } = useSocleLangue();
  const [courant, setCourant] = useState<number | null>(null);
  const dernier = zones.length - 1;
  const tab = Math.min(courant ?? dernier, dernier);

  const sourceDuFocus = (el: HTMLElement): SourceActive => {
    try {
      return el.matches(':focus-visible') ? 'clavier' : 'souris';
    } catch {
      return 'clavier';
    }
  };

  const parcourir = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const i = Number((e.target as HTMLElement).dataset.i);
    if (!Number.isInteger(i)) return;
    let suivant: number;
    if (e.key === 'ArrowRight') suivant = Math.min(dernier, i + 1);
    else if (e.key === 'ArrowLeft') suivant = Math.max(0, i - 1);
    else if (e.key === 'Home') suivant = 0;
    else if (e.key === 'End') suivant = dernier;
    else return;
    e.preventDefault();
    (e.currentTarget.children[suivant] as HTMLElement | undefined)?.focus();
  };

  return (
    <div role="group" aria-label={ts('graphique.points')} className="sc-g__points" onKeyDown={parcourir}>
      {zones.map((z, i) => (
        <button
          key={i}
          type="button"
          data-i={i}
          tabIndex={i === tab ? 0 : -1}
          aria-label={z.nom}
          className="sc-g__zone"
          style={{ left: `${z.debut * 100}%`, width: `${(z.fin - z.debut) * 100}%` }}
          onMouseEnter={() => onActiver(i, 'souris')}
          onMouseLeave={() => onDesactiver('souris')}
          onFocus={(e) => {
            setCourant(i);
            onActiver(i, sourceDuFocus(e.currentTarget));
          }}
          onBlur={() => onDesactiver('clavier')}
        />
      ))}
    </div>
  );
}

/**
 * La phrase qui résume une série pour un lecteur d'écran : « Courbe, 12 points, de X à Y, dernier : Z ».
 * `cles` nomme les trois phrases (plusieurs points, un seul, aucun) du dictionnaire.
 */
export function phraseSerie(
  ts: (cle: CleSocle, params?: ParamsSocle) => string,
  cles: { plusieurs: CleSocle; un: CleSocle; vide: CleSocle },
  valeurs: readonly number[],
  formater: (valeur: number) => string,
): string {
  const r = resumer(valeurs);
  if (!r) return ts(cles.vide);
  if (r.n === 1) return ts(cles.un, { dernier: formater(r.dernier) });
  return ts(cles.plusieurs, { n: r.n, min: formater(r.min), max: formater(r.max), dernier: formater(r.dernier) });
}
