import { definirMots } from '../../../socle/mots';

/**
 * LES MOTS DE L'ÉCRAN DE VEILLE (G09) ET DE SA LIGNE DE RÉGLAGES (H18) — l'anglais est le schéma, le français est
 * typé contre lui. Aucun nom, aucun montant, aucun texte de travail : c'est la règle de l'écran.
 */
const EN = {
  calque: 'Screensaver. Press a key to resume.',
  verrou: 'Space locked',
  'garde.nom': 'State of the Guard',
  garde: 'The Guard is watching',
  'etat.calme': 'all is in order',
  'etat.attention': 'one point needs your attention',
  'etat.critique': 'a critical alert',
  horsLigne: 'Offline',
  'horsLigne.texte': 'The Guard resumes when the network returns',
  inconnu: 'The Guard is not answering',
  ronde: 'next round',
  reprendre: 'Move the mouse or press a key to resume',
  'pied.veille': 'Sleep after {n} min',
  'pied.verrou': 'lock after {n} min',
  'pied.reglages': 'Settings · Screensaver',
  'reglage.titre': 'Screensaver',
  'reglage.texte':
    'After a while without any action, this computer covers the screen in black: the time, the day and the state of the Guard, nothing else. No client name, no amount, no work text. These settings apply to this computer only.',
  'reglage.coquille': 'It shows with the new shell. The old shell keeps the situation room.',
  'reglage.activer': 'Show the screensaver',
  'reglage.veille': 'Sleep after',
  'reglage.verrou': 'Lock the space after',
  'reglage.minutes': '{n} min',
  'reglage.jamais': 'Never',
  'reglage.verrou.aide': 'Saved on this computer for locking the space; it changes nothing today.',
  'reglage.jamaisPendant': 'Never during a call, a screen share, a dictation or a video playing.',
} as const;

const FR: Record<keyof typeof EN, string> = {
  calque: 'Écran de veille. Appuyez sur une touche pour reprendre.',
  verrou: 'Espace verrouillé',
  'garde.nom': 'État de La Garde',
  garde: 'La Garde veille',
  'etat.calme': 'tout est en ordre',
  'etat.attention': 'un point demande votre attention',
  'etat.critique': 'une alerte critique',
  horsLigne: 'Hors connexion',
  'horsLigne.texte': 'La Garde reprend au retour du réseau',
  inconnu: 'La Garde ne répond pas',
  ronde: 'prochaine ronde',
  reprendre: 'Bougez la souris ou appuyez sur une touche pour reprendre',
  'pied.veille': 'Veille après {n} min',
  'pied.verrou': 'verrouillage après {n} min',
  'pied.reglages': 'Réglages · Écran de veille',
  'reglage.titre': 'Écran de veille',
  'reglage.texte':
    'Après un moment sans action, ce poste couvre l’écran de noir : l’heure, le jour et l’état de La Garde, rien d’autre. Aucun nom de client, aucun montant, aucun texte de travail. Ces réglages valent pour ce poste seulement.',
  'reglage.coquille': 'Il s’affiche avec la nouvelle coquille. L’ancienne garde la salle de situation.',
  'reglage.activer': 'Afficher l’écran de veille',
  'reglage.veille': 'Veille après',
  'reglage.verrou': 'Verrouiller l’espace après',
  'reglage.minutes': '{n} min',
  'reglage.jamais': 'Jamais',
  'reglage.verrou.aide': 'Enregistré sur ce poste pour le verrouillage de l’espace ; il ne change rien aujourd’hui.',
  'reglage.jamaisPendant': 'Jamais pendant un appel, un partage d’écran, une dictée ou une vidéo en lecture.',
};

export const { useMots, traduire, dictionnaires } = definirMots(EN, FR);
