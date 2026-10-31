import { definirMots } from '../../../socle/mots';

/**
 * LES MOTS DE DÉMARRAGE (H42) ET DU CHOIX DU MÉTIER (H47) — fr et en.
 *
 * Même schéma que `src/socle/i18n.ts` : l'anglais est la base, le français est typé contre lui (une clé oubliée ne
 * compile pas). Rien n'entre dans `src/i18n/fr.ts` ni `en.ts`, qui partent dans le paquet de l'édition cliente.
 *
 * Les libellés des étapes 2, 3 et 5 vivent avec le modèle de métier (`modeles.ts`) ; ici, les étapes communes
 * (1, 4, 6) et tout le reste. Aucun nom propre : `{prenom}`, `{etape}`, `{n}` sont des variables.
 * Le ton : vouvoiement, sans pression, sans point d'exclamation.
 */
const EN = {
  /* ── H42 · en-tête ── */
  'titre': 'Getting started',
  'sous': 'Your space gets ready with you, with no pressure',
  'plusTard': 'Later',
  'reprendreVisite': 'Resume the tour',
  'allerAccueil': 'Go to home',

  /* ── H42 · carte principale ── */
  'bienvenue': 'Welcome, {prenom}',
  'bienvenue.sans': 'Welcome',
  'pret': 'Your space is ready, {prenom}',
  'pret.sans': 'Your space is ready',
  'texte.plusieurs': 'Only {n} more steps to get everything ready. You can do them in any order you like.',
  'texte.une': 'Only one more step to get everything ready.',
  'texte.tout': 'Everything is in place. You can count on Ajmani for what comes next.',
  'anneau.libelle': 'Setup progress',
  'anneau.texte': '{n} of {total} steps done',

  /* ── H42 · étapes communes ── */
  'etapes.liste': 'Setup steps',
  'etape.metier.titre': 'Choose your trade',
  'etape.metier.sous': 'To switch on the right modules',
  'etape.metier.sous.passee': 'You kept the general set of modules',
  'etape.metier.action': 'Choose',
  'etape.equipe.titre': 'Invite your team',
  'etape.equipe.sous': 'Everyone keeps their own access',
  'etape.equipe.action': 'Invite',
  'etape.mobile.titre': 'Install the mobile app',
  'etape.mobile.sous': 'Your tasks in your pocket',
  'etape.mobile.action': 'Get the link',
  'etape.case.manuel': 'Mark as done: {etape}',
  'etape.case.auto': '{etape} (ticks itself)',
  'etape.statut.faite': 'Done',
  'etape.statut.afaire': 'To do',
  'etape.ouvrir': 'Open: {etape}',
  'etape.pasPourMoi': 'Not for me',
  'etape.pasPourMoi.aide': 'Press S, or right-click, to take this step off the list',
  'etape.retirees.une': '1 step taken off the list',
  'etape.retirees.plusieurs': '{n} steps taken off the list',
  'etape.remettre': 'Put back',
  'etape.admin': 'Reserved for administrators',
  'etape.libre': 'Need help? Ajmani can do these steps with you.',
  'etape.libre.lien': 'See the help below',

  /* ── H42 · colonne de droite ── */
  'visite.titre': 'Guided tour, 2 minutes',
  'visite.texte': 'A tour of what you can do here.',
  'visite.lire': 'Start the guided tour (2 minutes)',
  'savoir.titre': 'Good to know',
  'savoir.liste': 'Shortcuts',
  'savoir.chercher': 'Search anything',
  'savoir.ajmani': 'Talk to Ajmani',
  'savoir.raccourcis': 'See all shortcuts',

  /* ── H42 · le bandeau d'aide ── */
  'aide.groupe': 'Help',
  'aide.ajmani.titre': 'Ask Ajmani',
  'aide.ajmani.texte': 'It guides you step by step',
  'aide.ajmani.demande': 'Guide me step by step to finish the setup',
  'aide.appel.titre': 'A 15-minute call',
  'aide.appel.texte': 'With someone from the team',
  'aide.donnees.titre': 'Bring in your data',
  'aide.donnees.texte': 'From Excel or another tool',

  /* ── H42 · états ── */
  'chargement': 'Loading your progress',
  'erreur': 'Your progress could not be loaded.',
  'erreur.reessayer': 'Try again',
  'horsLigne': 'Available when the network is back',

  /* ── H42 · le lien de l'application mobile ── */
  'lien.titre': 'Install the mobile app',
  'lien.texte': 'Open this link on your phone, or scan the code. The link is the same for everyone and carries nothing personal.',
  'lien.qr': 'Code to scan with your phone',
  'lien.champ': 'Link to the app',
  'lien.copier': 'Copy the link',
  'lien.copie': 'Link copied',
  'lien.fermer': 'Close',
  'lien.indisponible': 'No public address is set up for this app yet, so no link can be given. Your provider sets it once on the server.',

  /* ── H47 · en-tête ── */
  'metier.titre': 'What is your trade?',
  'metier.sous': 'We switch on the right modules, you have nothing else to set up',
  'metier.passer': 'Skip',
  'metier.continuer': 'Continue',
  'metier.continuer.info': 'Choose a trade or use Skip',

  /* ── H47 · la grille, la taille, l'aperçu ── */
  'metier.grille': 'Families of trades',
  'metier.tuile.choisie': 'Selected',
  'taille.titre': 'How many of you are there?',
  'taille.aide': 'To set up access and roles',
  'taille.seul': 'Alone',
  'taille.2-5': '2 to 5',
  'taille.6-20': '6 to 20',
  'taille.plus': 'More',
  'apercu.titre': 'Your first day, previewed',
  'apercu.aide': 'What you will see tomorrow morning',
  'apercu.exemple': 'Example',
  'apercu.exemple.aide': 'Examples that come with the family, not your data',
  'apercu.vide': 'Choose a trade: three examples of your first day will appear here.',

  /* ── H47 · « Décrire » ── */
  'decrire.texte': 'Your activity is not in the list? Describe it in one sentence, Ajmani composes the space.',
  'decrire.bouton': 'Describe',
  'decrire.champ': 'Describe your activity in one sentence',
  'decrire.placeholder': 'For example: I repair bikes and sell a few',
  'decrire.composer': 'Compose the space',
  'decrire.fermer': 'Esc to close',
  'decrire.envoye': 'Ajmani answers in its panel. Then pick the closest family above, or set the modules on the right.',
  'decrire.consigne': 'Here is my activity: “{phrase}”. Among these eight families of trades, which one is the closest: {familles}? Then list the modules to switch on. Change nothing yourself: I will make the choice in the page.',

  /* ── H47 · la carte de droite ── */
  'compose.titre': 'Your space will be made of',
  'compose.sous': 'You can change everything later',
  'compose.liste': 'Modules of your space',
  'compose.autres': '+ {n} more modules available at any time',
  'compose.autres.zero': 'All the modules of the family are shown',
  'compose.toujours': 'Always available',
  'compose.dernier': 'At least one module stays on',
  'vide.titre': 'Choose a trade',
  'vide.texte': 'The modules to switch on will appear here.',
  'vide.action': 'Describe my activity',
  'erreur.enregistrement': 'Your choice could not be saved.',
} as const;

const FR: Record<keyof typeof EN, string> = {
  /* ── H42 · en-tête ── */
  'titre': 'Démarrage',
  'sous': 'Votre espace se prépare avec vous, sans pression',
  'plusTard': 'Plus tard',
  'reprendreVisite': 'Reprendre la visite',
  'allerAccueil': 'Aller à l’accueil',

  /* ── H42 · carte principale ── */
  'bienvenue': 'Bienvenue, {prenom}',
  'bienvenue.sans': 'Bienvenue',
  'pret': 'Votre espace est prêt, {prenom}',
  'pret.sans': 'Votre espace est prêt',
  'texte.plusieurs': 'Plus que {n} étapes pour que tout soit prêt. Vous pouvez les faire dans l’ordre que vous voulez.',
  'texte.une': 'Plus qu’une étape pour que tout soit prêt.',
  'texte.tout': 'Tout est en place. Vous pouvez compter sur Ajmani pour la suite.',
  'anneau.libelle': 'Avancement de la mise en route',
  'anneau.texte': '{n} étapes faites sur {total}',

  /* ── H42 · étapes communes ── */
  'etapes.liste': 'Étapes de la mise en route',
  'etape.metier.titre': 'Choisir votre métier',
  'etape.metier.sous': 'Pour activer les bons modules',
  'etape.metier.sous.passee': 'Vous avez gardé le jeu général de modules',
  'etape.metier.action': 'Choisir',
  'etape.equipe.titre': 'Inviter votre équipe',
  'etape.equipe.sous': 'Chacun garde ses accès',
  'etape.equipe.action': 'Inviter',
  'etape.mobile.titre': 'Installer l’application mobile',
  'etape.mobile.sous': 'Vos tâches dans la poche',
  'etape.mobile.action': 'Obtenir le lien',
  'etape.case.manuel': 'Marquer comme faite : {etape}',
  'etape.case.auto': '{etape} (se coche toute seule)',
  'etape.statut.faite': 'Faite',
  'etape.statut.afaire': 'À faire',
  'etape.ouvrir': 'Ouvrir : {etape}',
  'etape.pasPourMoi': 'Pas pour moi',
  'etape.pasPourMoi.aide': 'Touche S, ou clic droit, pour sortir cette étape de la liste',
  'etape.retirees.une': '1 étape sortie de la liste',
  'etape.retirees.plusieurs': '{n} étapes sorties de la liste',
  'etape.remettre': 'Les remettre',
  'etape.admin': 'Réservé aux administrateurs',
  'etape.libre': 'Besoin d’aide ? Ajmani peut faire ces étapes avec vous.',
  'etape.libre.lien': 'Voir l’aide ci-dessous',

  /* ── H42 · colonne de droite ── */
  'visite.titre': 'Visite guidée, 2 minutes',
  'visite.texte': 'Le tour de ce que vous pouvez faire ici.',
  'visite.lire': 'Lancer la visite guidée (2 minutes)',
  'savoir.titre': 'Bon à savoir',
  'savoir.liste': 'Raccourcis',
  'savoir.chercher': 'Chercher n’importe quoi',
  'savoir.ajmani': 'Parler à Ajmani',
  'savoir.raccourcis': 'Voir tous les raccourcis',

  /* ── H42 · le bandeau d'aide ── */
  'aide.groupe': 'Aide',
  'aide.ajmani.titre': 'Demander à Ajmani',
  'aide.ajmani.texte': 'Il vous guide pas à pas',
  'aide.ajmani.demande': 'Guide-moi pas à pas pour finir la configuration',
  'aide.appel.titre': 'Un appel de 15 minutes',
  'aide.appel.texte': 'Avec quelqu’un de l’équipe',
  'aide.donnees.titre': 'Reprendre vos données',
  'aide.donnees.texte': 'Depuis Excel ou un autre outil',

  /* ── H42 · états ── */
  'chargement': 'Chargement de votre progression',
  'erreur': 'Votre progression n’a pas pu être chargée.',
  'erreur.reessayer': 'Réessayer',
  'horsLigne': 'Disponible au retour du réseau',

  /* ── H42 · le lien de l'application mobile ── */
  'lien.titre': 'Installer l’application mobile',
  'lien.texte': 'Ouvrez ce lien sur votre téléphone, ou scannez le code. Le lien est le même pour tout le monde et ne porte rien de personnel.',
  'lien.qr': 'Code à scanner avec votre téléphone',
  'lien.champ': 'Lien vers l’application',
  'lien.copier': 'Copier le lien',
  'lien.copie': 'Lien copié',
  'lien.fermer': 'Fermer',
  'lien.indisponible': 'Aucune adresse publique n’est encore réglée pour cette application : on ne peut donc pas donner de lien. Votre prestataire la règle une seule fois, sur le serveur.',

  /* ── H47 · en-tête ── */
  'metier.titre': 'Quel est votre métier ?',
  'metier.sous': 'On active les bons modules, vous n’avez rien d’autre à régler',
  'metier.passer': 'Passer',
  'metier.continuer': 'Continuer',
  'metier.continuer.info': 'Choisissez un métier ou utilisez Passer',

  /* ── H47 · la grille, la taille, l'aperçu ── */
  'metier.grille': 'Familles de métiers',
  'metier.tuile.choisie': 'Choisi',
  'taille.titre': 'Combien êtes-vous ?',
  'taille.aide': 'Pour régler les accès et les rôles',
  'taille.seul': 'Seul',
  'taille.2-5': '2 à 5',
  'taille.6-20': '6 à 20',
  'taille.plus': 'Plus',
  'apercu.titre': 'Votre première journée, en aperçu',
  'apercu.aide': 'Ce que vous verrez dès demain matin',
  'apercu.exemple': 'Exemple',
  'apercu.exemple.aide': 'Des exemples livrés avec la famille, pas vos données',
  'apercu.vide': 'Choisissez un métier : trois exemples de votre première journée apparaîtront ici.',

  /* ── H47 · « Décrire » ── */
  'decrire.texte': 'Votre activité n’est pas dans la liste ? Décrivez-la en une phrase, Ajmani compose l’espace.',
  'decrire.bouton': 'Décrire',
  'decrire.champ': 'Décrivez votre activité en une phrase',
  'decrire.placeholder': 'Par exemple : je répare des vélos et j’en vends quelques-uns',
  'decrire.composer': 'Composer l’espace',
  'decrire.fermer': 'Échap pour fermer',
  'decrire.envoye': 'Ajmani vous répond dans son panneau. Choisissez ensuite la famille la plus proche ci-dessus, ou réglez les modules à droite.',
  'decrire.consigne': 'Voici mon activité : « {phrase} ». Parmi ces huit familles de métiers, laquelle est la plus proche : {familles} ? Liste ensuite les modules à activer. Ne modifie rien toi-même : je ferai le choix dans la page.',

  /* ── H47 · la carte de droite ── */
  'compose.titre': 'Votre espace sera composé de',
  'compose.sous': 'Vous pourrez tout changer plus tard',
  'compose.liste': 'Modules de votre espace',
  'compose.autres': '+ {n} autres modules disponibles à tout moment',
  'compose.autres.zero': 'Tous les modules du modèle sont affichés',
  'compose.toujours': 'Toujours disponible',
  'compose.dernier': 'Au moins un module reste activé',
  'vide.titre': 'Choisissez un métier',
  'vide.texte': 'Les modules à activer apparaîtront ici.',
  'vide.action': 'Décrire mon activité',
  'erreur.enregistrement': 'Votre choix n’a pas pu être enregistré.',
};

export const { useMots, traduire } = definirMots(EN, FR);
export type CleMot = keyof typeof EN;
export const MOTS_FR: Readonly<Record<CleMot, string>> = FR;
export const MOTS_EN: Readonly<Record<CleMot, string>> = EN;
