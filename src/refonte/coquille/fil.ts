import type { MiettePain } from '../../socle/coquille';

/**
 * LE FIL D'ARIANE — où je suis, en deux miettes : la famille, puis l'écran.
 * Pur : `CoquilleRefonte` lui passe le chemin et ce qu'il a trouvé au catalogue.
 *
 * Un écran hors catalogue (la vue « Tous les modules », un écran de réglage
 * tardif) reçoit son libellé de l'appelant, ou à défaut le dernier segment de
 * l'adresse, lisible : on ne laisse jamais le fil vide.
 */
export interface Trouve {
  famille: string;
  /** Le libellé de l'écran courant. */
  module: string;
}

export function construireFil(pathname: string, trouve: Trouve | null, libelleParDefaut: string, tousLesModules?: { route: string; libelle: string }): MiettePain[] {
  if (tousLesModules && pathname === tousLesModules.route) return [{ libelle: tousLesModules.libelle }];
  if (trouve) return [{ libelle: trouve.famille }, { libelle: trouve.module }];
  const segment = pathname.split('/').filter(Boolean).pop();
  if (!segment) return [{ libelle: libelleParDefaut }];
  const lisible = decodeURIComponent(segment).replace(/[-_]+/g, ' ');
  return [{ libelle: lisible.charAt(0).toUpperCase() + lisible.slice(1) }];
}
