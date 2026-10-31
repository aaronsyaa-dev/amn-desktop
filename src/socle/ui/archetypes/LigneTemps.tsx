import React from 'react';
import type { Famille } from '../../familles';
import type { EtatPastille } from '../Pastilles';
import { TexteTronque } from './TexteTronque';
import { dateIso, formaterHeure } from './logique/formats';

/**
 * LA LIGNE DE TEMPS (TimelineItem, 01-SOCLE-DESIGN §4) — l'heure, une pastille ronde avec son icône, un filet, un titre et un détail.
 *
 * Mode d'emploi : `<ChronologieTemps libelle="…"><LigneTemps heure={date} icone={<Phone />} famille="echanger" titre detail /> …</ChronologieTemps>`.
 * L'heure est une date (mise en forme à la française, `HH:mm`) ou un texte ; la couleur de la pastille vient de la famille ou de
 * l'état, et `libelleEtat` dit l'état en mots (la couleur ne le porte jamais seule). Le filet relie les éléments ; la liste dit
 * au dernier de ne pas en tracer (`dernier`). Titre et détail s'arrêtent en ellipse avec info-bulle.
 */

export interface LigneTempsProps {
  /** Une date (formatée `HH:mm` à la française) ou un texte déjà écrit. */
  heure: Date | string;
  /** Une icône lucide-react de 14 px. */
  icone: React.ReactNode;
  famille?: Famille;
  etat?: EtatPastille;
  /** L'état dit en mots, pour les lecteurs d'écran (« En retard »). */
  libelleEtat?: string;
  titre: string;
  detail?: string;
  /** Posé par `ChronologieTemps` : pas de filet sous le dernier. */
  dernier?: boolean;
  /** Ouvre l'élément : le titre devient un bouton. */
  onOuvrir?: () => void;
  locale?: string;
}

export function LigneTemps({ heure, icone, famille, etat, libelleEtat, titre, detail, dernier = false, onOuvrir, locale }: LigneTempsProps) {
  const texteHeure = heure instanceof Date ? formaterHeure(heure, locale) : heure;
  const corps = <TexteTronque className="sc-ligne-temps__titre-texte">{titre}</TexteTronque>;
  return (
    <li data-famille={famille} data-etat={etat} data-dernier={dernier || undefined} className="sc-ligne-temps">
      {heure instanceof Date ? (
        <time dateTime={dateIso(heure)} className="sc-ligne-temps__heure">
          {texteHeure}
        </time>
      ) : (
        <span className="sc-ligne-temps__heure">{texteHeure}</span>
      )}
      <span aria-hidden className="sc-ligne-temps__pastille">
        {icone}
      </span>
      <span className="sc-ligne-temps__corps">
        <span className="sc-ligne-temps__titre">
          {onOuvrir ? (
            <button type="button" onClick={onOuvrir} className="sc-ligne-temps__lien sc-focus">
              {corps}
            </button>
          ) : (
            corps
          )}
          {libelleEtat && <span className="sr-only"> — {libelleEtat}</span>}
        </span>
        {detail && <TexteTronque className="sc-ligne-temps__detail">{detail}</TexteTronque>}
      </span>
    </li>
  );
}

/** La liste ordonnée de la ligne de temps : elle dit à chaque élément s'il est le dernier. */
export function ChronologieTemps({ libelle, children }: { libelle: string; children: React.ReactNode }) {
  const elements = React.Children.toArray(children);
  return (
    <ol aria-label={libelle} className="sc-chronologie">
      {elements.map((c, i) => (React.isValidElement<{ dernier?: boolean }>(c) ? React.cloneElement(c, { dernier: i === elements.length - 1 }) : c))}
    </ol>
  );
}
