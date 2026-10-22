import type { EntreesTaux } from './logique';

/** Bac à sable : une menuisière indépendante fictive, au réel. */
export const EXEMPLE: EntreesTaux = {
  regime: 'reel',
  revenuAnnuel: 3_600_000,
  chargesFixes: 960_000,
  tauxCotisations: 45,
  joursParSemaine: 5,
  semainesConges: 5,
  feriesChomes: 8,
  autresJoursOff: 5,
  heuresParJour: 7,
  partFacturable: 70,
  margeSecurite: 10,
  tarifActuel: 4_500,
};
