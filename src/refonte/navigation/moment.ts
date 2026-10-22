import type { Registre } from '../modules/assembler';
import { REGISTRE_MODULES } from '../modules/registre';

/**
 * LE RAIL « DU MOMENT » — ce qu'il montre, décidé ici, sans React.
 *
 * Cinq groupes, dans cet ordre, sans doublon d'un groupe à l'autre :
 *
 *   1. les ESSENTIELS : les entrées de niveau « essentiel » du registre ;
 *   2. la GARDE ET LA SUPERVISION, à part : les essentiels des familles
 *      réservées à l'équipe AMN (`amnSeulement`) ;
 *   3. les ÉPINGLÉS de la personne ;
 *   4. les RÉCENTS (cinq au plus) ;
 *   5. « POUR CE MOMENT » : trois suggestions selon l'heure et le jour.
 *
 * Un module fermé pour l'organisation ou allégé n'est pas dans le catalogue
 * reçu, donc nulle part ici : on ne propose jamais une porte qui mène à une
 * redirection.
 */

/**
 * Les essentiels, lus au registre (`niveau: 'essentiel'`), dans l'ordre des
 * familles : un module déclaré essentiel entre au rail sans toucher au rail.
 * Le rail ouvre la vue principale de chaque entrée.
 */
export function essentielsDe(registre: Registre): { courants: string[]; garde: string[] } {
  const essentiels = registre.entrees.filter((e) => e.niveau === 'essentiel');
  return {
    courants: essentiels.filter((e) => !e.amnSeulement).map((e) => e.id),
    garde: essentiels.filter((e) => e.amnSeulement).map((e) => e.id),
  };
}

const LUS = essentielsDe(REGISTRE_MODULES);
export const ESSENTIELS: readonly string[] = LUS.courants;
export const ESSENTIELS_GARDE: readonly string[] = LUS.garde;

/** La vue « Tous les modules » : une route de l'édition interne, pas un module du catalogue. */
export const ROUTE_TOUS_LES_MODULES = '/tous-les-modules';

export const MAX_RECENTS = 5;
export const MAX_SUGGESTIONS = 3;

/**
 * Les suggestions selon l'heure. Des règles lisibles plutôt qu'un modèle :
 * on doit pouvoir dire pourquoi un module est proposé. Elles ne visent que des
 * modules hors des essentiels — ceux-là sont déjà à l'écran.
 */
export function suggestionsDuMoment(quand: Date): string[] {
  const heure = quand.getHours();
  const jourSemaine = quand.getDay(); // 0 = dimanche
  const quantieme = quand.getDate();
  const ids: string[] = [];

  // Fin et tout début de mois : ce qui reste à encaisser, et la trésorerie qui en dépend.
  if (quantieme >= 25 || quantieme <= 2) ids.push('reminders', 'cashForecast');
  // Vendredi après-midi : le bilan de la semaine.
  if (jourSemaine === 5 && heure >= 14) ids.push('weekly');
  // Lundi matin : les objectifs et les réunions de la semaine.
  if (jourSemaine === 1 && heure >= 5 && heure < 12) ids.push('okr', 'meetings');

  if (heure >= 5 && heure < 11) ids.push('priorities', 'routines', 'meetings');
  else if (heure >= 11 && heure < 14) ids.push('groups', 'meetings', 'time');
  else if (heure >= 14 && heure < 18) ids.push('time', 'expenseClaims', 'reminders');
  else ids.push('logbook', 'diary', 'priorities');

  return [...new Set(ids)];
}

export interface GroupesDuRail<T> {
  essentiels: T[];
  garde: T[];
  epingles: T[];
  recents: T[];
  maintenant: T[];
}

export function composerRail<T extends { key: string }>({
  catalogue,
  epingles,
  recents,
  quand,
  essentiels = LUS,
}: {
  /** Les modules ouverts à l'organisation, dans l'ordre du catalogue. */
  catalogue: readonly T[];
  /** Clés épinglées, dans l'ordre où l'appelant veut les voir. */
  epingles: readonly string[];
  /** Clés récentes, la plus récente d'abord. */
  recents: readonly string[];
  quand: Date;
  /** Par défaut, ceux du registre ; un contrôle peut passer ceux d'un registre d'essai. */
  essentiels?: { courants: readonly string[]; garde: readonly string[] };
}): GroupesDuRail<T> {
  const parCle = new Map(catalogue.map((i) => [i.key, i]));
  const vus = new Set<string>();
  const prendre = (cles: readonly string[], max = Infinity): T[] => {
    const out: T[] = [];
    for (const cle of cles) {
      if (out.length >= max) break;
      const item = parCle.get(cle);
      if (!item || vus.has(cle)) continue;
      vus.add(cle);
      out.push(item);
    }
    return out;
  };
  const essentielsPris = prendre(essentiels.courants);
  const garde = prendre(essentiels.garde);
  const epinglesPris = prendre(epingles);
  const recentsPris = prendre(recents, MAX_RECENTS);
  const maintenant = prendre(suggestionsDuMoment(quand), MAX_SUGGESTIONS);
  return { essentiels: essentielsPris, garde, epingles: epinglesPris, recents: recentsPris, maintenant };
}
