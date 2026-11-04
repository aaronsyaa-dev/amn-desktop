/**
 * APERÇU « G09 » — Écran de veille, sur les vrais composants (`IdleScreen`, `VueVeille` et ses briques
 * `DayRing24`, `WatchOrbit`, `BigClock`, `StatusPill`), avec les valeurs d'exemple de la maquette : vendredi
 * 30 octobre 2026 à 10:42, « tout est en ordre », prochaine ronde FICTIVE à 12:30, le repère à -20° en veille.
 *
 * La maquette montre aussi « Espace verrouillé » et « · verrouillage après 15 min » : l'application n'a pas de
 * verrouillage après inactivité, l'écran branché ne les affiche donc jamais (`verrouille={false}`,
 * `verrouApresMin={null}`). L'aperçu les allume ici seulement, pour comparer le dessin à l'image.
 *
 *   npm run apercu -- G09
 */
import React from 'react';
import '../../../src/refonte/accueil/Ambiance';
import { IdleScreen } from '../../../src/refonte/systeme/veille/IdleScreen';
import { VueVeille } from '../../../src/refonte/systeme/veille/VueVeille';

const rien = () => undefined;

export default function Apercu() {
  return (
    <IdleScreen ouvert libelle="Écran de veille. Appuyez sur une touche pour reprendre." onReprendre={rien}>
      <VueVeille
        produit="AMN Business"
        maintenant={new Date(2026, 9, 30, 10, 42)}
        etat="calme"
        ronde={new Date(2026, 9, 30, 12, 30)}
        veilleMin={5}
        verrouApresMin={15}
        verrouille
        repereEnVeille={3}
      />
    </IdleScreen>
  );
}
