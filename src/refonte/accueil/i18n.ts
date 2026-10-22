import { useLangue, type Langue } from '../../i18n';
import { remplir, type Parametres } from './modele';

/**
 * LES MOTS DE L'ACCUEIL — fr et en, à part des dictionnaires communs.
 *
 * Même modèle que `src/socle/i18n.ts` : l'anglais est le schéma, le français
 * est typé contre lui (une clé oubliée ne compile pas). Rien d'ici n'entre
 * dans le paquet de l'édition cliente : seul le code interne l'importe.
 *
 * Le français VOUVOIE, partout (décision de Harun, 2026-10-22) : `check:ajmani`
 * refuse « tu », « ton », « ta », « tes », « toi » et « t’ » dans ce fichier.
 * `{n#ligne|lignes}` accorde le pluriel (voir `modele.ts`).
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

  'etat.horsligne': 'Sync is unavailable. You see what this device already has; the rest arrives when the connection is back.',
  'etat.horsligne.court': 'Data unavailable for now.',
  'etat.chargement': 'Loading your day…',

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

  'pastille.serie': 'Streak · {n#day|days}',
  'pastille.serie.aide': 'Your best routine, ticked {n#day|days} in a row.',
  'pastille.boite': 'Inbox zero',
  'pastille.boite.aide': 'Nothing new from the team is waiting for you.',

  'jour.titre': 'Today',
  'jour.progres': '{x} of {y} done',
  'jour.vide': 'Nothing planned today. Add a line, or pick your priorities.',
  'jour.etapes.aide': 'Three steps to set up your space. Each one ticks itself once it is done.',
  'jour.cocher': 'Mark as done: {titre}',
  'jour.decocher': 'Mark as not done: {titre}',
  'jour.lecture': '{titre}, ticked by its owner',
  'jour.masquer': 'Hide for today: {titre}',
  'jour.reafficher': 'Show {n} hidden',
  'jour.ajouter': 'Add a line',
  'jour.ajouter.aide': 'Something of your own, for today only, on this device.',
  'jour.ajouter.ok': 'Add',
  'jour.annuler': 'Cancel',
  'jour.enCours': 'in progress',
  'jour.aFaire': 'to do',
  'jour.faite': 'done',
  'jour.etape.client': 'Add your first client',
  'jour.etape.rdv': 'Plan an appointment',
  'jour.etape.visite': 'Take the two-minute tour',
  'jour.responsable': 'Owner',
  'action.relancer': 'Chase {nom}',
  'action.ouvrir': 'Open: {titre}',
  'action.commencer': 'Start: {titre}',
  'action.priorites': 'Pick my priorities',

  'activite.titre': 'Team activity',
  'activite.vide': 'Nothing new from the team yet. Changes, payments and decisions will show up here.',
  'activite.modif': '{nom}: {texte}',
  'activite.encaissee': 'Invoice {numero} paid',
  'activite.client': 'New client: {nom}',
  'activite.jalon': 'Milestone',

  'message.ouvrir': 'Open',
  'ajmani.barre': 'Ask Ajmani, or say what you want to do',
  'ajmani.barre.court': 'Ask Ajmani…',
  'ajmani.barre.aide': 'Opens the assistant ({raccourci})',
  'ajmani.barre.envoyer': 'Send to Ajmani',
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

  'etat.horsligne': 'Synchronisation indisponible. Vous voyez ce que ce poste a déjà ; le reste arrive au retour de la connexion.',
  'etat.horsligne.court': 'Données indisponibles pour l’instant.',
  'etat.chargement': 'Chargement de votre journée…',

  'tuiles.titre': 'Les chiffres',
  'tuile.ca': 'Chiffre d’affaires',
  'tuile.ca.sous': 'encaissé en {mois}',
  'tuile.ca.evol': '{signe}{n} % par rapport à {mois}',
  'tuile.attente': 'Factures en attente',
  'tuile.attente.sous': '{n} à encaisser · {r} en retard',
  'tuile.attente.aucune': 'plus rien à encaisser',
  'tuile.equipe': 'Tâches d’équipe',
  'tuile.equipe.sous': '{c} en cours · {f#faite|faites} cette semaine',
  'tuile.objectif': 'Objectif de la semaine',
  'tuile.objectif.sous': 'Fixé à la revue hebdo',

  'pastille.serie': 'Série · {n#jour|jours}',
  'pastille.serie.aide': 'Votre meilleure routine, cochée {n#jour|jours} de suite.',
  'pastille.boite': 'Boîte à zéro',
  'pastille.boite.aide': 'Rien de neuf de l’équipe ne vous attend.',

  'jour.titre': 'Aujourd’hui',
  'jour.progres': '{x} sur {y} fait',
  'jour.vide': 'Rien de prévu aujourd’hui. Ajoutez une ligne, ou choisissez vos priorités.',
  'jour.etapes.aide': 'Trois étapes pour installer votre espace. Chacune se coche toute seule une fois faite.',
  'jour.cocher': 'Marquer comme fait : {titre}',
  'jour.decocher': 'Marquer comme pas fait : {titre}',
  'jour.lecture': '{titre}, cochée par son responsable',
  'jour.masquer': 'Masquer pour aujourd’hui : {titre}',
  'jour.reafficher': 'Réafficher {n#ligne masquée|lignes masquées}',
  'jour.ajouter': 'Ajouter une ligne',
  'jour.ajouter.aide': 'Une chose à vous, pour aujourd’hui, sur ce poste.',
  'jour.ajouter.ok': 'Ajouter',
  'jour.annuler': 'Annuler',
  'jour.enCours': 'en cours',
  'jour.aFaire': 'à faire',
  'jour.faite': 'faite',
  'jour.etape.client': 'Ajoutez votre premier client',
  'jour.etape.rdv': 'Prévoyez un rendez-vous',
  'jour.etape.visite': 'Faites la visite de deux minutes',
  'jour.responsable': 'Responsable',
  'action.relancer': 'Relancer {nom}',
  'action.ouvrir': 'Ouvrir : {titre}',
  'action.commencer': 'Commencer : {titre}',
  'action.priorites': 'Choisir mes priorités',

  'activite.titre': 'Activité de l’équipe',
  'activite.vide': 'Rien de neuf dans l’équipe pour l’instant. Les modifications, encaissements et décisions apparaîtront ici.',
  'activite.modif': '{nom} : {texte}',
  'activite.encaissee': 'Facture {numero} encaissée',
  'activite.client': 'Nouveau client : {nom}',
  'activite.jalon': 'Jalon',

  'message.ouvrir': 'Ouvrir',
  'ajmani.barre': 'Demandez à Ajmani, ou dites ce que vous voulez faire',
  'ajmani.barre.court': 'Demandez à Ajmani…',
  'ajmani.barre.aide': 'Ouvre l’assistant ({raccourci})',
  'ajmani.barre.envoyer': 'Envoyer à Ajmani',
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

export function traduireAccueil(langue: Langue, cle: CleAccueil, params: Parametres = {}): string {
  return remplir(DICTIONNAIRES_ACCUEIL[langue][cle] ?? EN[cle], params, langue);
}

/** Comme `useLangue`, pour les mots de l'Accueil : re-rend quand la langue change. */
export function useAccueilLangue(): { langue: Langue; ta: (cle: CleAccueil, params?: Parametres) => string } {
  const { langue } = useLangue();
  return { langue, ta: (cle, params) => traduireAccueil(langue, cle, params) };
}
