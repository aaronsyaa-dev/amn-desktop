import React from 'react';

/**
 * LA RESPIRATION D'UNE GARDE EN RONDE (S3).
 *
 * `sv-souffle-calme` (index.css) descend à 0,14 d'opacité : c'est le souffle
 * d'un point de site sur l'ancien mur. Posé sur une garde en ronde, il la
 * rendrait PLUS PÂLE qu'une garde au repos (0,45) — le contraire de ce qu'il
 * doit dire. Celle-ci reste vive (0,62 → 1).
 *
 * Déclarée ici plutôt que dans `src/index.css` (fichier sensible) ; les règles
 * `data-mouvement` du socle s'y appliquent comme à toute animation CSS, et les
 * composants ne posent la classe qu'en mouvement « complet ».
 */
export const CLASSE_SOUFFLE = 's3-souffle';

const CSS = `@keyframes s3-souffle{0%,100%{opacity:.62}50%{opacity:1}}.s3-souffle{animation:s3-souffle 3.2s ease-in-out infinite}`;

export function StyleSouffle() {
  return <style>{CSS}</style>;
}
