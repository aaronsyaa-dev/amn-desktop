import React from 'react';
import '@fontsource/inter/200.css';
import { styleRang } from '../../../socle/couche-mouvement';

/**
 * LA GRANDE HEURE (G09, `BigClock`) — « 10:42 » en 176 px, graisse 200, `-.045em`, chiffres tabulaires, et le
 * jour en dessous (« Vendredi 30 octobre », 20 px T3). Deux des trois choses que lit un lecteur d'écran.
 *
 * La graisse 200 d'Inter n'est pas chargée par l'ambiance (400 à 700) : elle l'est ici, depuis le paquet
 * `@fontsource/inter` déjà installé, et seulement avec cet écran. Entrée en fondu échelonné (couche commune).
 */
export function BigClock({ heure, iso, jour }: { heure: string; iso: string; jour: string }) {
  return (
    <>
      <time className="ve-heure" dateTime={iso} data-mvt="entree" style={styleRang(0)}>
        {heure}
      </time>
      <p className="ve-jour" data-mvt="entree" style={styleRang(1)}>
        {jour}
      </p>
    </>
  );
}
