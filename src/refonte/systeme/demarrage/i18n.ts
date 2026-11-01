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
  'sous.prenom': 'Welcome {prenom}, your space gets ready with you, with no pressure',
  'plusTard': 'Later',
  'reprendreVisite': 'Resume the tour',
  'allerAccueil': 'Go to home',
  'ajmani.barre': 'Ask Ajmani, for example: “invite my team”',

  /* ── H42 · le parcours ── */
  'etapes.liste': 'Setup steps',
  'anneau.libelle': 'Setup progress',
  'anneau.texte': '{n} of {total} steps done',
  'resume.pretes': '{n} of {total} ready',
  'resume.duree': 'about {n} min',
  'resume.reste': 'for the rest',
  'resume.rien': 'nothing else to do',
  'statut.maintenant': 'now · {n} min',
  'statut.ensuite': 'next · {n} min',
  'statut.duree': '{n} min',
  'statut.faite': 'done',
  'statut.passee': 'skipped',
  'statut.clients': '{n} recorded',
  'statut.membres': '{n} people',
  'noeud.faite': '{etape}, done: review it',
  'noeud.afaire': '{etape}, to do: show it',

  /* ── H42 · étapes communes ── */
  'etape.metier.titre': 'Choose your trade',
  'etape.metier.sous': 'To switch on the right modules',
  'etape.metier.texte': 'Choose the closest trade: the right modules are switched on, you have nothing else to set up. Allow one minute.',
  'etape.metier.action': 'Choose',
  'etape.equipe.titre': 'Invite your team',
  'etape.equipe.sous': 'Everyone keeps their own access',
  'etape.equipe.texte': 'Invite the people you work with. Everyone keeps their own access, you choose their role.',
  'etape.equipe.action': 'Invite',
  'etape.mobile.titre': 'Install the mobile app',
  'etape.mobile.sous': 'Your tasks in your pocket',
  'etape.mobile.texte': 'Open the link on your phone, or scan the code. The link is the same for everyone and carries nothing personal.',
  'etape.mobile.action': 'Get the link',
  'etape.admin': 'Reserved for administrators',

  /* ── H42 · la carte de l'étape ── */
  'panneau.etape': 'Step {n} of {total}',
  'panneau.conseillee': '· recommended now',
  'panneau.afaire': '· to do',
  'panneau.rempli': 'Already filled in for you',
  'panneau.plusTard': 'Later',
  'panneau.pasPourMoi': 'Not for me',
  'panneau.dejaFait': 'Already done',
  'panneau.ajmani': 'Nothing goes to {client} without your approval.',
  'panneau.ajmani.sans': 'Nothing goes out without your approval.',
  'panneau.retiree': 'Step removed',
  'panneau.annuler': 'Undo',
  'panneau.retirees.une': '1 step removed',
  'panneau.retirees.plusieurs': '{n} steps removed',
  'panneau.remettre': 'Put back',
  'rempli.client.terme': 'Client',
  'rempli.client.suite': '{client}, added at step {n}',
  'rempli.lignes.terme': 'Standard lines',
  'rempli.lignes.suite': 'those of your trade, editable',
  'ensuite.titre': 'Next: {etape}',
  'ensuite.inviter': 'Next: invite {noms}',
  'ensuite.et': 'and',
  'ensuite.detail': '{sous} · {n} min',
  'ensuite.libelle': 'Show the next step: {etape}',
  'savoir.titre': 'Good to know',
  'savoir.liste': 'Shortcuts',
  'savoir.chercher': 'search',
  'savoir.ajmani': 'Ajmani',
  'savoir.raccourcis': 'shortcuts',
  'pret': 'Your space is ready, {prenom}',
  'pret.sans': 'Your space is ready',
  'texte.tout': 'Everything is in place. You can count on Ajmani for what comes next.',

  /* ── H42 · le papier (aperçu, rien n'est enregistré) ── */
  'papier.libelle': 'Preview of the draft',
  'papier.statut': 'Draft',
  'papier.titre': 'Quote',
  'papier.pour': 'For',
  'papier.note': 'Prefilled by Ajmani, to review',

  /* ── H42 · « Déjà prêt » ── */
  'dejaPret.titre': 'Already ready',
  'dejaPret.sous': 'without doing anything',
  'dejaPret.modules.titre': '{n} modules switched on',
  'dejaPret.modules.sous': '{metier}, {n} in the sidebar',
  'dejaPret.clients.titre': '{n} clients added',
  'dejaPret.clients.sous': 'in your contacts',
  'dejaPret.garde.titre': 'La Garde watches over your access',
  'dejaPret.garde.sous': 'every sign-in is recorded',

  /* ── H42 · l'accompagnement ── */
  'aide.referent.titre': '{nom} is here to help',
  'aide.referent.sous': 'from the AMN team · answers within {n} min',
  'aide.equipe.titre': 'The AMN team answers you',
  'aide.equipe.sous': 'in writing, from the help desk',
  'aide.texte': 'A 15-minute call to go round together, or a question in writing. As you prefer.',
  'aide.texte.equipe': 'A question in writing, or a call to arrange together. As you prefer.',
  'aide.creneaux': 'Free slots today',
  'aide.reserver': 'Book {heure}',
  'aide.ecrire': 'Write to them',
  'aide.ecrire.equipe': 'Write to the team',
  'aide.reserve': 'Meeting with {nom} at {heure}',

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
  'metier.sous': 'Choose the closest one: we switch on the right modules, you have nothing else to set up',
  'metier.passer': 'Skip',
  'metier.continuer': 'Continue',
  'metier.continuer.avec': 'Continue with {metier}',
  'metier.continuer.info': 'Choose a trade or use Skip',
  'metier.miette': 'Your trade',
  'metier.ajmani': 'Describe your activity in one sentence, Ajmani composes the space',

  /* ── H47 · les cartes de métier ── */
  'metier.grille': 'Families of trades',
  'carte.autres': '+ {n} more modules, {total} in all',
  'carte.autres.zero': '{total} modules in all',
  'carte.bande': 'Make-up by family',
  'carte.module': '{module} in the sidebar',
  'carte.toujours': 'Always available',
  'carte.dernier': 'At least one module stays on',

  /* ── H47 · « Votre espace, demain matin » ── */
  'barre.titre': 'Your sidebar',
  'apercu.titre': 'Your space, tomorrow morning',
  'apercu.avec': 'preview with {metier}',
  'apercu.phrase': '{nombre} modules in your sidebar, {autres} more ready to serve. Everything can be changed later.',
  'apercu.phrase.sans': '{nombre} modules in your sidebar. Everything can be changed later.',
  'apercu.phrase.un': 'One module in your sidebar, {autres} more ready to serve. Everything can be changed later.',
  'apercu.phrase.un.sans': 'One module in your sidebar. Everything can be changed later.',
  'nombre.2': 'Two',
  'nombre.3': 'Three',
  'nombre.4': 'Four',
  'nombre.5': 'Five',
  'nombre.6': 'Six',
  'apercu.exemple.aide': 'Examples that come with the trade, not your data',
  'apercu.mention': 'The {n} modules stay in “All modules”, nothing is deleted.',
  'apercu.vide': 'Choose a trade to see your space',

  /* ── H47 · la taille de l'équipe ── */
  'taille.titre': 'How many of you are there?',
  'taille.aide': 'To prepare access and roles',
  'taille.seul': 'Alone',
  'taille.2-5': '2 to 5',
  'taille.6-20': '6 to 20',
  'taille.plus': 'More',

  /* ── H47 · « Pas dans la liste ? » ── */
  'decrire.titre': 'Not in the list?',
  'decrire.texte': 'Describe your activity in one sentence, Ajmani composes the space.',
  'decrire.bouton': 'Describe my activity',
  'decrire.champ': 'Describe your activity in one sentence',
  'decrire.placeholder': 'For example: I repair bikes and sell a few',
  'decrire.composer': 'Compose the space',
  'decrire.fermer': 'Esc to close',
  'decrire.envoye': 'Ajmani answers in its panel. Then pick the closest trade above.',
  'decrire.consigne': 'Here is my activity: “{phrase}”. Among these eight families of trades, which one is the closest: {familles}? Then list the modules to switch on. Change nothing yourself: I will make the choice in the page.',
  'erreur.enregistrement': 'Your choice could not be saved.',
} as const;

const FR: Record<keyof typeof EN, string> = {
  /* ── H42 · en-tête ── */
  'titre': 'Démarrage',
  'sous': 'Votre espace se prépare avec vous, sans pression',
  'sous.prenom': 'Bienvenue {prenom}, votre espace se prépare avec vous, sans pression',
  'plusTard': 'Plus tard',
  'reprendreVisite': 'Reprendre la visite',
  'allerAccueil': 'Aller à l’accueil',
  'ajmani.barre': 'Demandez à Ajmani, par exemple : « invite mon équipe »',

  /* ── H42 · le parcours ── */
  'etapes.liste': 'Étapes de la mise en route',
  'anneau.libelle': 'Avancement de la mise en route',
  'anneau.texte': '{n} étapes faites sur {total}',
  'resume.pretes': '{n} sur {total} prêtes',
  'resume.duree': 'environ {n} min',
  'resume.reste': 'pour le reste',
  'resume.rien': 'plus rien à faire',
  'statut.maintenant': 'maintenant · {n} min',
  'statut.ensuite': 'ensuite · {n} min',
  'statut.duree': '{n} min',
  'statut.faite': 'faite',
  'statut.passee': 'passée',
  'statut.clients': '{n} enregistrés',
  'statut.membres': '{n} personnes',
  'noeud.faite': '{etape}, faite : la revoir',
  'noeud.afaire': '{etape}, à faire : l’afficher',

  /* ── H42 · étapes communes ── */
  'etape.metier.titre': 'Choisir votre métier',
  'etape.metier.sous': 'Pour activer les bons modules',
  'etape.metier.texte': 'Choisissez le métier le plus proche : on active les bons modules, vous n’avez rien d’autre à régler. Comptez une minute.',
  'etape.metier.action': 'Choisir',
  'etape.equipe.titre': 'Inviter votre équipe',
  'etape.equipe.sous': 'Chacun garde ses accès',
  'etape.equipe.texte': 'Invitez les personnes avec qui vous travaillez. Chacun garde ses accès, vous choisissez son rôle.',
  'etape.equipe.action': 'Inviter',
  'etape.mobile.titre': 'Installer l’application mobile',
  'etape.mobile.sous': 'Vos tâches dans la poche',
  'etape.mobile.texte': 'Ouvrez le lien sur votre téléphone, ou scannez le code. Le lien est le même pour tout le monde et ne porte rien de personnel.',
  'etape.mobile.action': 'Obtenir le lien',
  'etape.admin': 'Réservé aux administrateurs',

  /* ── H42 · la carte de l'étape ── */
  'panneau.etape': 'Étape {n} sur {total}',
  'panneau.conseillee': '· conseillée maintenant',
  'panneau.afaire': '· à faire',
  'panneau.rempli': 'Déjà rempli pour vous',
  'panneau.plusTard': 'Plus tard',
  'panneau.pasPourMoi': 'Pas pour moi',
  'panneau.dejaFait': 'C’est déjà fait',
  'panneau.ajmani': 'Rien ne part chez {client} sans votre accord.',
  'panneau.ajmani.sans': 'Rien ne part sans votre accord.',
  'panneau.retiree': 'Étape retirée',
  'panneau.annuler': 'Annuler',
  'panneau.retirees.une': '1 étape retirée',
  'panneau.retirees.plusieurs': '{n} étapes retirées',
  'panneau.remettre': 'Les remettre',
  'rempli.client.terme': 'Client',
  'rempli.client.suite': '{client}, ajouté à l’étape {n}',
  'rempli.lignes.terme': 'Lignes types',
  'rempli.lignes.suite': 'celles de votre métier, modifiables',
  'ensuite.titre': 'Ensuite : {etape}',
  'ensuite.inviter': 'Ensuite : inviter {noms}',
  'ensuite.et': 'et',
  'ensuite.detail': '{sous} · {n} min',
  'ensuite.libelle': 'Afficher l’étape suivante : {etape}',
  'savoir.titre': 'Bon à savoir',
  'savoir.liste': 'Raccourcis',
  'savoir.chercher': 'chercher',
  'savoir.ajmani': 'Ajmani',
  'savoir.raccourcis': 'raccourcis',
  'pret': 'Votre espace est prêt, {prenom}',
  'pret.sans': 'Votre espace est prêt',
  'texte.tout': 'Tout est en place. Vous pouvez compter sur Ajmani pour la suite.',

  /* ── H42 · le papier (aperçu, rien n'est enregistré) ── */
  'papier.libelle': 'Aperçu du brouillon',
  'papier.statut': 'Brouillon',
  'papier.titre': 'Devis',
  'papier.pour': 'Pour',
  'papier.note': 'Prérempli par Ajmani, à relire',

  /* ── H42 · « Déjà prêt » ── */
  'dejaPret.titre': 'Déjà prêt',
  'dejaPret.sous': 'sans rien faire',
  'dejaPret.modules.titre': '{n} modules activés',
  'dejaPret.modules.sous': '{metier}, {n} dans la barre',
  'dejaPret.clients.titre': '{n} clients ajoutés',
  'dejaPret.clients.sous': 'dans vos contacts',
  'dejaPret.garde.titre': 'La Garde veille sur vos accès',
  'dejaPret.garde.sous': 'chaque connexion est notée',

  /* ── H42 · l'accompagnement ── */
  'aide.referent.titre': '{nom} vous accompagne',
  'aide.referent.sous': 'de l’équipe AMN · répond sous {n} min',
  'aide.equipe.titre': 'L’équipe AMN vous répond',
  'aide.equipe.sous': 'par écrit, depuis l’assistance',
  'aide.texte': 'Un appel de 15 minutes pour faire le tour ensemble, ou une question par écrit. Comme vous préférez.',
  'aide.texte.equipe': 'Une question par écrit, ou un appel à convenir ensemble. Comme vous préférez.',
  'aide.creneaux': 'Créneaux libres aujourd’hui',
  'aide.reserver': 'Réserver {heure}',
  'aide.ecrire': 'Lui écrire',
  'aide.ecrire.equipe': 'Écrire à l’équipe',
  'aide.reserve': 'Rendez-vous avec {nom} à {heure}',

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
  'metier.sous': 'Choisissez le plus proche : on active les bons modules, vous n’avez rien d’autre à régler',
  'metier.passer': 'Passer',
  'metier.continuer': 'Continuer',
  'metier.continuer.avec': 'Continuer avec {metier}',
  'metier.continuer.info': 'Choisissez un métier ou utilisez Passer',
  'metier.miette': 'Votre métier',
  'metier.ajmani': 'Décrivez votre activité en une phrase, Ajmani compose l’espace',

  /* ── H47 · les cartes de métier ── */
  'metier.grille': 'Familles de métiers',
  'carte.autres': '+ {n} autres modules, {total} en tout',
  'carte.autres.zero': '{total} modules en tout',
  'carte.bande': 'Composition par famille',
  'carte.module': '{module} dans la barre',
  'carte.toujours': 'Toujours disponible',
  'carte.dernier': 'Au moins un module reste activé',

  /* ── H47 · « Votre espace, demain matin » ── */
  'barre.titre': 'Votre barre latérale',
  'apercu.titre': 'Votre espace, demain matin',
  'apercu.avec': 'aperçu avec {metier}',
  'apercu.phrase': '{nombre} modules dans votre barre, {autres} autres prêts à servir. Tout se change plus tard.',
  'apercu.phrase.sans': '{nombre} modules dans votre barre. Tout se change plus tard.',
  'apercu.phrase.un': 'Un module dans votre barre, {autres} autres prêts à servir. Tout se change plus tard.',
  'apercu.phrase.un.sans': 'Un module dans votre barre. Tout se change plus tard.',
  'nombre.2': 'Deux',
  'nombre.3': 'Trois',
  'nombre.4': 'Quatre',
  'nombre.5': 'Cinq',
  'nombre.6': 'Six',
  'apercu.exemple.aide': 'Des exemples livrés avec le métier, pas vos données',
  'apercu.mention': 'Les {n} modules restent dans « Tous les modules », rien n’est supprimé.',
  'apercu.vide': 'Choisissez un métier pour voir votre espace',

  /* ── H47 · la taille de l'équipe ── */
  'taille.titre': 'Combien êtes-vous ?',
  'taille.aide': 'Pour préparer les accès et les rôles',
  'taille.seul': 'Seul',
  'taille.2-5': '2 à 5',
  'taille.6-20': '6 à 20',
  'taille.plus': 'Plus',

  /* ── H47 · « Pas dans la liste ? » ── */
  'decrire.titre': 'Pas dans la liste ?',
  'decrire.texte': 'Décrivez votre activité en une phrase, Ajmani compose l’espace.',
  'decrire.bouton': 'Décrire mon activité',
  'decrire.champ': 'Décrivez votre activité en une phrase',
  'decrire.placeholder': 'Par exemple : je répare des vélos et j’en vends quelques-uns',
  'decrire.composer': 'Composer l’espace',
  'decrire.fermer': 'Échap pour fermer',
  'decrire.envoye': 'Ajmani vous répond dans son panneau. Choisissez ensuite le métier le plus proche ci-dessus.',
  'decrire.consigne': 'Voici mon activité : « {phrase} ». Parmi ces huit familles de métiers, laquelle est la plus proche : {familles} ? Liste ensuite les modules à activer. Ne modifie rien toi-même : je ferai le choix dans la page.',
  'erreur.enregistrement': 'Votre choix n’a pas pu être enregistré.',
};

export const { useMots, traduire } = definirMots(EN, FR);
export type CleMot = keyof typeof EN;
export const MOTS_FR: Readonly<Record<CleMot, string>> = FR;
export const MOTS_EN: Readonly<Record<CleMot, string>> = EN;
