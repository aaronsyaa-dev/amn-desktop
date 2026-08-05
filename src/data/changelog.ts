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
    version: '1.2.0',
    date: '2026-08-05',
    title: 'Corrections & fondations',
    changes: [
      'Zoom plein écran des images du chat réparé : la visionneuse s’ouvre correctement sur toutes les images (plus d’affichage partiel), navigation ← / → et vidéos inchangées.',
      'Bouton « Démarrer avec Windows » à nouveau fonctionnel : l’app se lance bien à l’ouverture de session, et le réglage survit aux mises à jour automatiques.',
      'Le raccourci sur le Bureau est recréé à chaque mise à jour (il pouvait disparaître après une mise à jour auto).',
      'Suppression d’un site : en cas d’échec, un message d’erreur clair s’affiche au lieu d’un retour silencieux.',
      'Onglet « Progression » retiré de l’interface (barre latérale et recherche Ctrl/Cmd + K) pour épurer la navigation.',
      'Accusés de lecture dans l’Équipe : un ✓ indique un message envoyé, un ✓✓ qu’il a été lu par votre binôme.',
      'Fil « Activité récente » sur l’Accueil : ce que l’autre opérateur a ajouté ou modifié dernièrement, cliquable.',
      'Pastilles de notification sur la barre latérale : nombre d’ajouts non vus par onglet, remis à zéro à la visite.',
      'Repères contextuels sur les tâches : « Ajouter un repère » vous laisse pointer un endroit précis de l’app ; le repère devient une étiquette cliquable qui y ramène et le met en évidence.',
      'Tâches : ouverture d’une fiche détaillée avec fil de discussion (commentaires), édition (titre, détail, assigné, priorité) et priorité visible sur les cartes.',
      'Chat : tapez « # » pour mentionner une tâche ; le lien cliquable ouvre directement sa fiche.',
    ],
  },
  {
    version: '1.1.7',
    date: '2026-08-04',
    title: 'Correctif synchronisation temps réel',
    changes: [
      'Correction du mode « Local » persistant : l’URL et le token d’amn-api sont désormais intégrés au build, donc l’app packagée se connecte réellement au serveur (synchronisation, présence en ligne, WebSocket temps réel entre Aaron et Mohamed).',
      'Journaux de connexion clairs (statut, ouverture/fermeture WebSocket, token refusé) pour diagnostiquer rapidement.',
      'Nouveautés récentes également incluses : Ajmani dans le chat, messages vocaux et vidéos, onglet Notes, bibliothèque Médias, veille tech élargie.',
    ],
  },
  {
    version: '1.1.0',
    date: '2026-07-31',
    title: 'Ajmani, veille en direct & confort',
    changes: [
      'L’assistant devient « Ajmani » : une vraie IA généraliste (via Ollama en local) qui répond à toutes vos questions, en plus de vos rapports et analyses ancrés sur vos données réelles.',
      'Ajmani : sélecteur de modèle directement dans le chat, blocs de code copiables, et notification quand la réponse est prête si vous avez quitté le panneau.',
      'Écran de veille cosy après quelques minutes d’inactivité — parfait pour laisser l’app tournée sur un second écran.',
      'Notification discrète quand votre binôme modifie une donnée partagée (la synchro se voit en direct).',
      'Veille cyber : bouton de rafraîchissement manuel et mise à jour automatique de l’affichage.',
      'Suppression de site : bouton pour confirmer immédiatement, sans attendre le délai d’annulation.',
      'Assistant d’installation du tracker : choix entre 3 modes (serveur, serverless, site statique) avec le bon script pour chacun.',
    ],
  },
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
