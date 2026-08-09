/**
 * Historique des changelogs, généré manuellement à chaque release.
 *
 * À chaque nouvelle version publiée (voir README → « Publier une nouvelle
 * version »), ajoute une entrée EN TÊTE de `CHANGELOG` avec le numéro de
 * version (identique à `package.json`), la date et la liste des changements
 * marquants. Garde les libellés courts et orientés utilisateur.
 *
 * Deux usages consomment ces données :
 *  - l'écran « À propos » (Paramètres) affiche tout l'historique ;
 *  - la notification « Nouvelle mise à jour ! » compare la version courante
 *    (via `system.getAppInfo()`) à la dernière version vue par l'utilisateur
 *    et présente les nouveautés des versions non encore consultées.
 */

export interface ChangelogEntry {
  /** Numéro de version, identique à `package.json` (ex. "1.0.0"). */
  version: string;
  /** Date de publication, format ISO court "AAAA-MM-JJ". */
  date: string;
  /** Titre optionnel de la release (une ligne). */
  title?: string;
  /** Liste des changements marquants, phrasés côté utilisateur. */
  changes: string[];
}

/**
 * Le plus récent en premier. La première entrée est considérée comme la
 * version courante de l'application.
 */
export { CHANGELOG } from '@edition/changelog';
import { CHANGELOG } from '@edition/changelog';

export const CURRENT_VERSION = CHANGELOG[0]?.version ?? '1.0.0';

/** Compares two dotted versions numerically. Returns >0 if a>b, <0 if a<b. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

/**
 * Toutes les entrées de changelog strictement plus récentes que `since`.
 * Utilisé par la notification de mise à jour pour n'afficher que les
 * nouveautés depuis la dernière version vue. Comparaison sémantique (numérique)
 * pour rester robuste même si la version exacte n'est pas dans l'historique
 * (ex. l'utilisateur a sauté plusieurs versions). Si `since` est nul, renvoie un
 * tableau vide (première installation → pas de « nouveautés »).
 */
export function changesSince(since: string | null | undefined): ChangelogEntry[] {
  if (!since) return [];
  return CHANGELOG.filter((e) => compareVersions(e.version, since) > 0);
}
