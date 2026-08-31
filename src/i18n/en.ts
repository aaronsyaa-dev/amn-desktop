/**
 * ENGLISH — the base dictionary, and the SCHEMA of every other language.
 *
 * Every translatable string in the product has exactly one key here. The
 * French dictionary is typed against this object (`Dictionnaire`), so a
 * missing translation is a COMPILE error, not a runtime surprise — and any
 * future language gets the same guarantee for free.
 *
 * Keys are flat, dot-namespaced by surface (`connexion.*`, `accueil.*`…).
 * Interpolations use `{nom}` placeholders; `check:langue` verifies that both
 * languages carry the same placeholders — a translation that drops `{n}`
 * would silently show a hole.
 *
 * Grammar rules of the house apply in EVERY language: no exclamation marks,
 * calm errors in three parts, small numbers spelled out where the Relève
 * speaks (see `releve.ts`, which has its own per-language grammar — these
 * dictionaries never carry Relève templates: word-for-word template
 * translation is exactly what the brief forbids).
 */
export const en = {
  /* ── Login ──────────────────────────────────────────────────────────── */
  'connexion.console': 'Access console',
  'connexion.espace': 'Your space',
  'connexion.identifiant': 'Username',
  'connexion.motDePasse': 'Password',
  'connexion.seConnecter': 'Sign in',
  'connexion.verification': 'Checking…',
  'connexion.bienvenue': 'Welcome…',
  'connexion.afficherMdp': 'Show password',
  'connexion.masquerMdp': 'Hide password',
  'connexion.verrMaj': 'Caps Lock is on',
  'connexion.champsRequis': 'Please enter your email and your password.',
  'connexion.erreurGenerique': 'Something went wrong while signing in.',
  'connexion.enLigne': 'Online',
  'connexion.horsLigne': 'Offline',
  'connexion.lieuInterne': '{marque} · Supervision centre',
  'connexion.lieuCliente': '{produit} · Workspace',
  'connexion.mfa.titre': 'Two-factor authentication',
  'connexion.mfa.consigne': 'Open your authenticator app and enter the six-digit code.',
  'connexion.mfa.consigneSecours': 'Enter one of your backup codes. It only works once.',
  'connexion.mfa.code': 'Six-digit code',
  'connexion.mfa.codeSecours': 'Backup code',
  'connexion.mfa.valider': 'Confirm',
  'connexion.mfa.utiliserApp': 'Use the authenticator app',
  'connexion.mfa.utiliserSecours': 'Use a backup code',
  'connexion.mfa.codeInvalide': 'Invalid code.',

  /* ── Welcome curtain ────────────────────────────────────────────────── */
  'bienvenue.titre': 'Welcome to {produit}',
  'bienvenue.salut': 'Hello {nom}',
  'bienvenue.voix': 'Welcome to {produit}. Hello {nom}.',

  /* ── Chrome: top bar, status rail, sync, thumb bar ──────────────────── */
  'chrome.rechercher': 'Search…',
  'chrome.notifications': 'Notifications',
  'chrome.aideRapide': 'Quick help',
  'chrome.monProfil': 'My profile',
  'chrome.parametresCompte': 'Account settings',
  'chrome.ouvrirMenu': 'Open the menu',
  'chrome.deconnexion': 'Sign out',
  'chrome.seDeconnecter': 'Sign out',
  'chrome.replier': 'Collapse',
  'chrome.replierBarre': 'Collapse the sidebar',
  'chrome.deplierBarre': 'Expand the sidebar',
  'chrome.modules': 'Modules',
  'chrome.tousModules': 'All modules',
  'chrome.fermer': 'Close',
  'chrome.epingler': 'Pin {nom}',
  'chrome.detacher': 'Unpin {nom}',
  'chrome.lienActif': 'Live link',
  'chrome.espaceTravail': 'Workspace',
  'chrome.changerEspace': '{espace} — click to switch space',
  'sync.synchronise': 'Synced',
  'sync.synchroniseTitre': 'Connected to amn-api — changes are shared in real time.',
  'sync.connexion': 'Connecting…',
  'sync.connexionTitre': 'Connecting to the sync server.',
  'sync.horsLigne': 'Offline',
  'sync.horsLigneTitre':
    'Server unreachable — your changes are saved locally and will sync back automatically when the connection returns.',
  'sync.local': 'Local',
  'sync.localTitre': 'Local mode (no sync server configured).',

  /* ── Status rail (bottom line, both editions) ───────────────────────── */
  'rail.lienActifTitre': 'Connected to the server — changes are shared in real time.',
  'rail.connexion': 'Connecting',
  'rail.connexionTitre': 'Connecting to the server.',
  'rail.horsLigne': 'Offline',
  'rail.horsLigneTitre':
    'Server unreachable — changes are saved on this workstation and will sync back when the network returns.',
  'rail.local': 'Local',
  'rail.localTitre': 'Local mode: no sync server configured.',
  'rail.tourControle': 'Control tower',
  'rail.posteTravail': 'Workstation',
  'rail.sessionSupport': 'Support session',
  'rail.heureLocale': 'Local time',

  /* ── Settings: language ─────────────────────────────────────────────── */
  'reglages.langue.titre': 'Language',
  'reglages.langue.description':
    'The language of this workstation, for you. It changes nothing for anyone else.',
  'reglages.langue.francais': 'Français',
  'reglages.langue.anglais': 'English',
  'reglages.langue.suitOrganisation': 'Follow the organisation ({langue})',

  /* ── Welcome curtain (skip line) ────────────────────────────────────── */
  'bienvenue.passer': 'Click to skip',

  /* ── Internal home: counters and destinations ───────────────────────── */
  'accueil.stats.sitesSupervises': 'Sites monitored',
  'accueil.stats.jamaisVus': 'Never seen',
  'accueil.stats.enLigne': 'Online',
  'accueil.stats.tachesOuvertes': 'Open tasks',
  'accueil.dest.sites': 'Sites',
  'accueil.dest.sites.hint': 'Monitored estate',
  'accueil.dest.taches': 'Tasks',
  'accueil.dest.taches.hint': 'Who does what',
  'accueil.dest.clients': 'Clients',
  'accueil.dest.clients.hint': 'Records & relations',
  'accueil.dest.equipe': 'Team',
  'accueil.dest.equipe.hint': 'Messaging',
  'accueil.dest.assistant.hint': 'AI assistant',
  'accueil.dest.trackers': 'Trackers',
  'accueil.dest.trackers.hint': 'Monitoring',
  'accueil.sec.notes': 'Notes',
  'accueil.sec.decisions': 'Decisions',
  'accueil.sec.connaissances': 'Knowledge',

  /* ── Attention panel (both editions) ────────────────────────────────── */
  'attention.titre': 'Attention points',
  'attention.un': 'One attention point',
  'attention.n': '{n} attention points',
  'attention.reduire': 'Collapse',
  'attention.dePlus': '{n} more',
  'attention.rien': 'Attention points · nothing to report · checked at {heure}',

  /* ── Org switch (internal chrome) ───────────────────────────────────── */
  'chrome.organisation': 'Organisation',

  /* ── Client home ────────────────────────────────────────────────────── */
  'accueil.relev.aria': 'While you were away',
  'relev.facture.un': 'an invoice created',
  'relev.facture.des': 'invoices created',
  'relev.rdv.un': 'an appointment booked',
  'relev.rdv.des': 'appointments booked',
  'relev.fiche.un': 'a new client record',
  'relev.fiche.des': 'new client records',
  'relev.tache.un': 'a task added',
  'relev.tache.des': 'tasks added',
  'relev.incident.un': 'an incident appeared',
  'relev.incident.des': 'incidents appeared',
} as const;

/*
  Les CLÉS sont littérales (une faute de frappe ne compile pas), les VALEURS
  sont des chaînes libres — sans quoi `as const` exigerait du français
  identique à l'anglais, ce qui est le contraire d'une traduction.
*/
export type CleTraduction = keyof typeof en;
export type Dictionnaire = Record<CleTraduction, string>;
