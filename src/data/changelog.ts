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
export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '1.0.0',
    date: '2026-07-25',
    title: 'Première version stable',
    changes: [
      'Poste de commandement AMN complet : Accueil, Sites, Équipe, Tâches, Clients, Tracker, Décisions, Connaissances, Progression.',
      'Espace de travail partagé en temps réel (sites, messages, tâches, décisions) avec présence de l’équipe.',
      'Assistant IA intégré et recherche universelle (Cmd/Ctrl + K).',
      'Robustesse hors-ligne : l’app continue de fonctionner sans réseau et se resynchronise à la reconnexion.',
      'Intégration bureau : démarrage avec Windows, icône dans la barre système, notifications natives.',
      'Mises à jour automatiques et écran « À propos » avec l’historique des versions.',
    ],
  },
];

/** Version courante de l'app d'après le changelog (première entrée). */
export const CURRENT_VERSION = CHANGELOG[0]?.version ?? '1.0.0';

/**
 * Toutes les entrées de changelog strictement plus récentes que `since`.
 * Utilisé par la notification de mise à jour pour n'afficher que les
 * nouveautés depuis la dernière version vue. Si `since` est nul/inconnu,
 * renvoie un tableau vide (première installation → pas de « nouveautés »).
 */
export function changesSince(since: string | null | undefined): ChangelogEntry[] {
  if (!since) return [];
  const idx = CHANGELOG.findIndex((e) => e.version === since);
  // Version inconnue (ex. downgrade) : on ne spamme pas, rien à montrer.
  if (idx === -1) return [];
  return CHANGELOG.slice(0, idx);
}
