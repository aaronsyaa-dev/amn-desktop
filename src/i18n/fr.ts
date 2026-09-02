import type { Dictionnaire } from './en';

/**
 * FRANÇAIS — première classe, complet par CONSTRUCTION.
 *
 * Le type `Dictionnaire` vient de l'anglais (le schéma) : une clé oubliée ici
 * est une erreur de compilation, pas un trou à l'écran. La typographie
 * française s'applique (espaces fines insécables avant ? ! ;, guillemets
 * « français », apostrophes typographiques) — `check:langue` la vérifie.
 */
export const fr: Dictionnaire = {
  /* ── Connexion ──────────────────────────────────────────────────────── */
  'connexion.console': 'Console d’accès',
  'connexion.espace': 'Votre espace',
  'connexion.identifiant': 'Identifiant',
  'connexion.motDePasse': 'Mot de passe',
  'connexion.seConnecter': 'Se connecter',
  'connexion.verification': 'Vérification…',
  'connexion.bienvenue': 'Bienvenue…',
  'connexion.afficherMdp': 'Afficher le mot de passe',
  'connexion.masquerMdp': 'Masquer le mot de passe',
  'connexion.verrMaj': 'Verr. Maj activé',
  'connexion.champsRequis': 'Veuillez renseigner votre email et votre mot de passe.',
  'connexion.erreurGenerique': 'Une erreur est survenue lors de la connexion.',
  'connexion.enLigne': 'En ligne',
  'connexion.horsLigne': 'Hors ligne',
  'connexion.lieuInterne': '{marque} · Centre de supervision',
  'connexion.lieuCliente': '{produit} · Espace de travail',
  'connexion.mfa.titre': 'Double authentification',
  'connexion.mfa.consigne':
    'Ouvrez votre application d’authentification et saisissez le code à six chiffres.',
  'connexion.mfa.consigneSecours': 'Saisissez l’un de vos codes de secours. Il ne servira qu’une fois.',
  'connexion.mfa.code': 'Code à six chiffres',
  'connexion.mfa.codeSecours': 'Code de secours',
  'connexion.mfa.valider': 'Valider',
  'connexion.mfa.utiliserApp': 'Utiliser l’application',
  'connexion.mfa.utiliserSecours': 'Utiliser un code de secours',
  'connexion.mfa.codeInvalide': 'Code invalide.',
  'connexion.oublie': 'Mot de passe oublié ?',
  'connexion.oublie.titre': 'Mot de passe oublié',
  'connexion.oublie.consigne':
    'Indiquez votre adresse email. Votre prestataire sera prévenu et vous remettra un mot de passe temporaire.',
  'connexion.oublie.envoyer': 'Prévenir mon prestataire',
  'connexion.oublie.annuler': 'Retour à la connexion',
  'connexion.oublie.fait': 'Votre prestataire a été prévenu — vous recevrez un mot de passe temporaire.',

  /* ── Rideau de bienvenue ────────────────────────────────────────────── */
  'bienvenue.titre': 'Bienvenue sur {produit}',
  'bienvenue.salut': 'Bonjour {nom}',
  'bienvenue.voix': 'Bienvenue sur {produit}. Bonjour {nom}.',

  /* ── La coquille ────────────────────────────────────────────────────── */
  'chrome.rechercher': 'Rechercher…',
  'chrome.notifications': 'Notifications',
  'chrome.aideRapide': 'Aide rapide',
  'chrome.monProfil': 'Mon profil',
  'chrome.parametresCompte': 'Paramètres du compte',
  'chrome.ouvrirMenu': 'Ouvrir le menu',
  'chrome.deconnexion': 'Déconnexion',
  'chrome.seDeconnecter': 'Se déconnecter',
  'chrome.replier': 'Replier',
  'chrome.replierBarre': 'Replier la barre',
  'chrome.deplierBarre': 'Déplier la barre',
  'chrome.modules': 'Modules',
  'chrome.tousModules': 'Tous les modules',
  'chrome.fermer': 'Fermer',
  'chrome.epingles': 'Épinglés',
  'chrome.epingler': 'Épingler {nom}',
  'chrome.detacher': 'Détacher {nom}',
  'chrome.lienActif': 'Lien actif',
  'chrome.espaceTravail': 'Espace de travail',
  'chrome.changerEspace': '{espace} — cliquer pour changer d’espace',
  'sync.synchronise': 'Synchronisé',
  'sync.synchroniseTitre': 'Connecté à amn-api — changements partagés en temps réel.',
  'sync.connexion': 'Connexion…',
  'sync.connexionTitre': 'Connexion au serveur de synchronisation en cours.',
  'sync.horsLigne': 'Hors ligne',
  'sync.horsLigneTitre':
    'Serveur injoignable — vos changements sont enregistrés localement et se resynchroniseront automatiquement au retour de la connexion.',
  'sync.local': 'Local',
  'sync.localTitre': 'Mode local (serveur de synchronisation non configuré).',
  'sync.reprise': 'Reconnexion en cours…',
  'sync.repriseTitre': 'Le serveur redémarre — cet écran se rafraîchira de lui-même dans un instant.',

  /* ── Bandeau d'état (ligne du bas, deux éditions) ───────────────────── */
  'rail.lienActifTitre': 'Connecté au serveur — les changements sont partagés en temps réel.',
  'rail.connexion': 'Connexion',
  'rail.connexionTitre': 'Connexion au serveur en cours.',
  'rail.horsLigne': 'Hors ligne',
  'rail.horsLigneTitre':
    'Serveur injoignable — les changements sont enregistrés sur ce poste et repartiront au retour du réseau.',
  'rail.local': 'Local',
  'rail.localTitre': 'Poste en mode local : aucun serveur de synchronisation configuré.',
  'rail.reprise': 'Reconnexion en cours',
  'rail.repriseTitre': 'Le serveur redémarre — l’écran se rafraîchira de lui-même dans un instant.',
  'rail.tourControle': 'Tour de contrôle',
  'rail.posteTravail': 'Poste de travail',
  'rail.sessionSupport': 'Session de support',
  'rail.heureLocale': 'Heure locale',

  /* ── Réglages : langue ──────────────────────────────────────────────── */
  'reglages.langue.titre': 'Langue',
  'reglages.langue.description':
    'La langue de ce poste, pour vous. Elle ne change rien pour personne d’autre.',
  'reglages.langue.francais': 'Français',
  'reglages.langue.anglais': 'English',
  'reglages.langue.suitOrganisation': 'Suivre l’organisation ({langue})',

  /* ── Rideau de bienvenue (ligne de passage) ─────────────────────────── */
  'bienvenue.passer': 'Cliquez pour passer',

  /* ── Accueil interne : compteurs et destinations ────────────────────── */
  'accueil.stats.sitesSupervises': 'Sites supervisés',
  'accueil.stats.jamaisVus': 'Jamais vus',
  'accueil.stats.enLigne': 'En ligne',
  'accueil.stats.tachesOuvertes': 'Tâches ouvertes',
  'accueil.dest.sites': 'Sites',
  'accueil.dest.sites.hint': 'Parc supervisé',
  'accueil.dest.taches': 'Tâches',
  'accueil.dest.taches.hint': 'Qui fait quoi',
  'accueil.dest.clients': 'Clients',
  'accueil.dest.clients.hint': 'Fiches & relation',
  'accueil.dest.equipe': 'Équipe',
  'accueil.dest.equipe.hint': 'Messagerie',
  'accueil.dest.assistant.hint': 'Assistant IA',
  'accueil.dest.trackers': 'Trackers',
  'accueil.dest.trackers.hint': 'Supervision',
  'accueil.sec.notes': 'Notes',
  'accueil.sec.decisions': 'Décisions',
  'accueil.sec.connaissances': 'Connaissances',

  /* ── Points d'attention (deux éditions) ─────────────────────────────── */
  'attention.titre': 'Points d’attention',
  'attention.un': 'Un point d’attention',
  'attention.n': '{n} points d’attention',
  'attention.reduire': 'Réduire',
  'attention.dePlus': '{n} de plus',
  'attention.rien': 'Points d’attention · rien à signaler · vérifié à {heure}',

  /* ── Sélecteur d'organisation (coquille interne) ────────────────────── */
  'chrome.organisation': 'Organisation',

  /* ── Accueil cliente ────────────────────────────────────────────────── */
  'accueil.relev.aria': 'Pendant votre absence',
  'relev.facture.un': 'une facture créée',
  'relev.facture.des': 'factures créées',
  'relev.rdv.un': 'un rendez-vous posé',
  'relev.rdv.des': 'rendez-vous posés',
  'relev.fiche.un': 'une nouvelle fiche client',
  'relev.fiche.des': 'nouvelles fiches clients',
  'relev.tache.un': 'une tâche ajoutée',
  'relev.tache.des': 'tâches ajoutées',
  'relev.incident.un': 'un incident apparu',
  'relev.incident.des': 'incidents apparus',

  /* ── Équipe : présence et historique ───────────────────────────────── */
  'equipe.enLigne': 'En ligne',
  'equipe.connecteIlYa': 'Connecté {quand}',
  'equipe.jamaisConnecte': 'Jamais connecté',
  'equipe.presenceIndisponible': 'Présence indisponible',
  'equipe.vous': '(vous)',
  'equipe.historique': 'Historique',
  'equipe.historiqueDe': 'Historique de {nom}',
  'equipe.historiqueVide': 'Rien encore : aucune connexion, aucun geste enregistré.',
  'equipe.historiqueLecture': 'Lecture du journal…',
  'equipe.appeler': 'Appeler {nom}',
  'equipe.action.login': 'Connexion',
  'equipe.action.member_suspended': 'A suspendu un compte',
  'equipe.action.member_reactivated': 'A réactivé un compte',
  'equipe.action.member_role_changed': 'A changé un rôle',
  'equipe.action.member_removed': 'A retiré un compte',
  'equipe.action.invite': 'A invité quelqu’un',
  'equipe.action.status_page_published': 'A publié une page de statut',
  'equipe.action.status_page_revoked': 'A retiré une page de statut',
  'equipe.action.suppression_created': 'A mis une alerte en sourdine',
  'equipe.action.suppression_revoked': 'A levé une sourdine',
  'equipe.action.maintenance_declared': 'A déclaré une maintenance',
  'equipe.action.maintenance_cancelled': 'A annulé une maintenance',
  'equipe.action.welcome_consumed': 'A confirmé la réception de ses accès',

  /* ── Membres : retrait ─────────────────────────────────────────────── */
  'membres.retirer': 'Retirer',
  'membres.retirerTitre': 'Retirer ce compte',
  'membres.retirerQuestion': 'Retirer {email} ?',
  'membres.retirerConsequence':
    'Ses sessions se ferment à l’instant et sa place est libérée. Ce qu’elle a saisi reste dans l’organisation.',
  'membres.retirerConfirmer': 'Retirer ce compte',
  'membres.retirerGarder': 'Garder',
  'membres.retirerFait': '{email} a été retiré. La place est libre.',

  /* ── Bibliothèque / Découvrir ──────────────────────────────────────── */
  'biblio.titreInterne': 'Bibliothèque',
  'biblio.surtitreInterne': 'Système · Bibliothèque',
  'biblio.descriptionInterne': 'Tous les modules du produit, rangés par sections. Cherchez, puis allez-y.',
  'biblio.titreCliente': 'Découvrir',
  'biblio.surtitreCliente': 'Système · Découvrir',
  'biblio.descriptionCliente': 'Ce que votre espace contient, et ce qui existe par ailleurs. Demander écrit à votre prestataire — rien ne s’ouvre tout seul.',
  'biblio.rechercher': 'Trouver un module…',
  'biblio.rienTrouve': 'Rien ne correspond à « {recherche} ».',
  'biblio.etat.ouvert': 'Ouvert',
  'biblio.etat.inclus': 'Inclus',
  'biblio.etat.disponible': 'Disponible',
  'biblio.etat.demande': 'Demandé',
  'biblio.stat.modules': 'Modules',
  'biblio.stat.ouverts': 'Ouverts',
  'biblio.stat.disponibles': 'Disponibles',
  'biblio.demander': 'Demander',
  'biblio.demande.faite': 'Demandé',
  'biblio.demande.echec': 'La demande n’est pas partie. Réessayez dans un instant.',
  'biblio.composer.inclus': 'Inclus',
  'biblio.composer.retirer': 'Ouvert · cliquer pour fermer',
  'biblio.composer.ouvrir': 'Fermé · cliquer pour ouvrir',
};
