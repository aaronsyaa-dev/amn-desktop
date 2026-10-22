import { useLangue, type Langue } from '../../i18n';

/**
 * LES MOTS DE L'ACCUEIL — fr et en, à part des dictionnaires communs.
 *
 * Même modèle que `src/socle/i18n.ts` : l'anglais est le schéma, le français
 * est typé contre lui (une clé oubliée ne compile pas). Rien d'ici n'entre
 * dans le paquet de l'édition cliente : seul le code interne l'importe.
 *
 * Ce que dit Ajmani (ses messages, par situation et par registre) vit à
 * côté, dans `ajmani/phrases.ts` : une bibliothèque à variantes, pas des clés.
 */
const EN = {
  'accueil.titre': 'Home',
  'salut.matin': 'Good morning, {prenom}',
  'salut.jour': 'Good afternoon, {prenom}',
  'salut.soir': 'Good evening, {prenom}',
  'salut.anonyme': 'Hello',

  'tuiles.titre': 'Key figures',
  'tuile.ca': 'Revenue',
  'tuile.ca.sous': 'collected in {mois}',
  'tuile.ca.evol': '{signe}{n} % vs {mois}',
  'tuile.attente': 'Pending invoices',
  'tuile.attente.sous': '{n} unpaid · {r} overdue',
  'tuile.attente.aucune': 'nothing left to collect',
  'tuile.equipe': 'Team tasks',
  'tuile.equipe.sous': '{c} in progress · {f} done this week',
  'tuile.objectif': 'This week’s goal',
  'tuile.objectif.sous': 'Set in last week’s review',

  'pastille.serie': 'Streak · {n} days',
  'pastille.serie.aide': 'Your best routine, ticked {n} days in a row.',
  'pastille.boite': 'Inbox zero',
  'pastille.boite.aide': 'Nothing new from the team is waiting for you.',

  'jour.titre': 'Today',
  'jour.progres': '{x} of {y} done',
  'jour.vide': 'Nothing planned today. Add a line, or pick your priorities.',
  'jour.cocher': 'Mark as done: {titre}',
  'jour.decocher': 'Mark as not done: {titre}',
  'jour.lecture': '{titre}, handled by its owner',
  'jour.masquer': 'Hide for today: {titre}',
  'jour.reafficher': 'Show {n} hidden',
  'jour.ajouter': 'Add a line',
  'jour.ajouter.aide': 'Something of your own, for today only, on this device.',
  'jour.ajouter.ok': 'Add',
  'jour.annuler': 'Cancel',
  'jour.enCours': 'in progress',
  'jour.aFaire': 'to do',
  'jour.faite': 'done today',
  'jour.etape.client': 'Add your first client',
  'jour.etape.rdv': 'Plan an appointment',
  'jour.etape.visite': 'Take the two-minute tour',
  'jour.responsable': 'Owner',
  'action.relancer': 'Chase {nom}',
  'action.ouvrir': 'Open: {titre}',
  'action.priorites': 'Pick my priorities',

  'activite.titre': 'Team activity',
  'activite.vide': 'Nothing new from the team yet.',
  'activite.modif': '{nom}: {texte}',
  'activite.encaissee': 'Invoice {numero} paid',
  'activite.client': 'New client: {nom}',
  'activite.jalon': 'Milestone',

  'barre.titre': 'Families',
  'barre.garde': 'The Guard',
  'barre.tous': 'All modules',
  'barre.deplier': 'Show {nom} modules',
  'barre.replier': 'Hide {nom} modules',
  'barre.badge': '{n} to look at',
  'barre.enLigne': 'Online',
  'barre.personne': 'Nobody else online right now.',
  'barre.presenceCoupee': 'Presence is hidden (Settings).',
  'barre.sur': 'on {module}',

  'ajmani.barre': 'Ask Ajmani, or say what you want to do',
  'ajmani.barre.aide': 'Opens the assistant (⌘J)',
  'astuce.masquer': 'Don’t show me this again',
  'astuce.fermer': 'Close',

  'registre.titre': 'Ajmani’s tone',
  'registre.texte': 'How Ajmani’s messages read. Alerts are always serious. On this device only.',
  'registre.serieux': 'Serious',
  'registre.serieux.aide': 'Short and factual.',
  'registre.chill': 'Chill',
  'registre.chill.aide': 'Relaxed and friendly. The default.',
  'registre.taquin': 'Cheeky',
  'registre.taquin.aide': 'A little teasing, never preachy.',

  'lancement.passer': 'Click to skip',
} as const;

export type CleAccueil = keyof typeof EN;

const FR: Record<CleAccueil, string> = {
  'accueil.titre': 'Accueil',
  'salut.matin': 'Bonjour {prenom}',
  'salut.jour': 'Bon après-midi {prenom}',
  'salut.soir': 'Bonsoir {prenom}',
  'salut.anonyme': 'Bonjour',

  'tuiles.titre': 'Les chiffres',
  'tuile.ca': 'Chiffre d’affaires',
  'tuile.ca.sous': 'encaissé en {mois}',
  'tuile.ca.evol': '{signe}{n} % par rapport à {mois}',
  'tuile.attente': 'Factures en attente',
  'tuile.attente.sous': '{n} à encaisser · {r} en retard',
  'tuile.attente.aucune': 'plus rien à encaisser',
  'tuile.equipe': 'Tâches d’équipe',
  'tuile.equipe.sous': '{c} en cours · {f} faites cette semaine',
  'tuile.objectif': 'Objectif de la semaine',
  'tuile.objectif.sous': 'Fixé à la revue hebdo',

  'pastille.serie': 'Série · {n} jours',
  'pastille.serie.aide': 'Ta meilleure routine, cochée {n} jours de suite.',
  'pastille.boite': 'Boîte à zéro',
  'pastille.boite.aide': 'Rien de neuf de l’équipe ne t’attend.',

  'jour.titre': 'Aujourd’hui',
  'jour.progres': '{x} sur {y} fait',
  'jour.vide': 'Rien de prévu aujourd’hui. Ajoute une ligne, ou choisis tes priorités.',
  'jour.cocher': 'Marquer comme fait : {titre}',
  'jour.decocher': 'Marquer comme pas fait : {titre}',
  'jour.lecture': '{titre}, cochée par son responsable',
  'jour.masquer': 'Masquer pour aujourd’hui : {titre}',
  'jour.reafficher': 'Réafficher {n} masquée(s)',
  'jour.ajouter': 'Ajouter une ligne',
  'jour.ajouter.aide': 'Une chose à toi, pour aujourd’hui, sur ce poste.',
  'jour.ajouter.ok': 'Ajouter',
  'jour.annuler': 'Annuler',
  'jour.enCours': 'en cours',
  'jour.aFaire': 'à faire',
  'jour.faite': 'faite aujourd’hui',
  'jour.etape.client': 'Ajoute ton premier client',
  'jour.etape.rdv': 'Prévois un rendez-vous',
  'jour.etape.visite': 'Fais la visite de deux minutes',
  'jour.responsable': 'Responsable',
  'action.relancer': 'Relancer {nom}',
  'action.ouvrir': 'Ouvrir : {titre}',
  'action.priorites': 'Choisir mes priorités',

  'activite.titre': 'Activité de l’équipe',
  'activite.vide': 'Rien de neuf dans l’équipe pour l’instant.',
  'activite.modif': '{nom} : {texte}',
  'activite.encaissee': 'Facture {numero} encaissée',
  'activite.client': 'Nouveau client : {nom}',
  'activite.jalon': 'Jalon',

  'barre.titre': 'Familles',
  'barre.garde': 'La Garde',
  'barre.tous': 'Tous les modules',
  'barre.deplier': 'Afficher les modules de {nom}',
  'barre.replier': 'Masquer les modules de {nom}',
  'barre.badge': '{n} à regarder',
  'barre.enLigne': 'En ligne',
  'barre.personne': 'Personne d’autre en ligne pour l’instant.',
  'barre.presenceCoupee': 'Présence masquée (Réglages).',
  'barre.sur': 'sur {module}',

  'ajmani.barre': 'Demandez à Ajmani, ou dites ce que vous voulez faire',
  'ajmani.barre.aide': 'Ouvre l’assistant (⌘J)',
  'astuce.masquer': 'Ne plus me montrer ça',
  'astuce.fermer': 'Fermer',

  'registre.titre': 'Le ton d’Ajmani',
  'registre.texte': 'Comment se lisent les messages d’Ajmani. Les alertes restent toujours sérieuses. Sur ce poste seulement.',
  'registre.serieux': 'Sérieux',
  'registre.serieux.aide': 'Court et factuel.',
  'registre.chill': 'Chill',
  'registre.chill.aide': 'Détendu et amical. Le réglage par défaut.',
  'registre.taquin': 'Taquin',
  'registre.taquin.aide': 'Un peu moqueur, jamais moralisateur.',

  'lancement.passer': 'Cliquer pour passer',
};

export const DICTIONNAIRES_ACCUEIL: Record<Langue, Record<CleAccueil, string>> = { en: EN, fr: FR };

export function traduireAccueil(langue: Langue, cle: CleAccueil, params: Record<string, string | number> = {}): string {
  const brut = DICTIONNAIRES_ACCUEIL[langue][cle] ?? EN[cle];
  return brut.replace(/\{(\w+)\}/g, (tout, k: string) => (k in params ? String(params[k]) : tout));
}

/** Comme `useLangue`, pour les mots de l'Accueil : re-rend quand la langue change. */
export function useAccueilLangue(): { langue: Langue; ta: (cle: CleAccueil, params?: Record<string, string | number>) => string } {
  const { langue } = useLangue();
  return { langue, ta: (cle, params) => traduireAccueil(langue, cle, params) };
}
