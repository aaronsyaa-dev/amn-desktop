import type { ChangelogEntry } from '../data/changelog';

/**
 * Historique des versions d'AMN Business.
 *
 * Écrit pour la personne qui l'utilise : ce qu'elle peut faire, dans ses mots.
 * Il ne reprend pas l'historique interne — une cliente n'a que faire des
 * corrections d'un chat d'équipe qu'elle n'a pas.
 *
 * Le numéro de version suit celui du dépôt : les deux éditions sortent du même
 * code et sont publiées ensemble.
 */
export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '1.2.11',
    date: '2026-08-09',
    title: 'Première version',
    changes: [
      'Agenda : vos rendez-vous en vue mois, semaine ou jour, avec rappel avant l’heure, lien vers une fiche client (ou rendez-vous libre), et suivi terminé / annulé.',
      'Clients : fiches complètes — contact, historique, notes, devis imprimables en PDF.',
      'Tâches : suivi personnel de ce qu’il reste à faire, avec priorité et lien vers un client.',
      'Notes : bloc-notes organisé, en markdown, épinglable.',
      'Médias : vos photos et fichiers, rattachables à un client.',
      'Rapports : comptes-rendus par client ou par période, exportables.',
      'Coffre-fort : vos mots de passe et accès, chiffrés sur votre machine.',
      'Vos données sont synchronisées en temps réel entre vos appareils et n’appartiennent qu’à votre organisation.',
    ],
  },
];
