import { definirMots } from '../../../socle/mots';

/**
 * LES MOTS DE LA RECHERCHE ⌘K — fr et en, à part des dictionnaires communs.
 *
 * Même schéma que `src/socle/i18n.ts` : l'anglais est la base, le français est
 * typé contre lui (une clé oubliée ne compile pas). Rien d'ici n'entre dans les
 * dictionnaires de l'édition cliente : seul le code interne importe ce dossier.
 *
 * Typographie française : espace insécable (U+00A0) avant « : » et à l'intérieur
 * des guillemets « », espace fine insécable (U+202F) avant « ? ». Les noms de
 * groupe sont écrits en casse normale ; la feuille les met en capitales.
 */
const EN = {
  'titre': 'Search',
  'champ': 'Search a client, a page, an action',
  'liste': 'Results',
  'echap': 'esc',

  'groupe.actions': 'Actions',
  'groupe.resultats': 'Clients and pages',
  'groupe.recents': 'Recent',

  'type.client': 'Client',
  'type.contact': 'Contact',
  'type.devis': 'Quote',
  'type.facture': 'Invoice',
  'type.document': 'Document',
  'type.decision': 'Decision',
  'type.tache': 'Task',
  'type.note': 'Note',
  'type.message': 'Message',
  'type.page': 'Page',
  'facture.brouillon': 'Draft',
  'sanstitre': 'Untitled',

  'ajmani.generique': 'Ask Ajmani: “{texte}”',
  'ajmani.client': 'Ask Ajmani: summarise the history of {nom}',
  'ajmani.client.demande': 'Summarise the history of {nom}',
  'action.devis': 'Create a quote for {nom}',
  'action.ecrire': 'Write to {nom}',
  'action.reseau': 'Needs a connection',

  'pied.naviguer': '↑↓ to navigate',
  'pied.ouvrir': '↵ to open',
  'pied.astuce': 'Tip: type “>” to see every action',

  'vide.invite': 'Type a name, a page or “>” to see the actions.',
  'aucun.titre': 'Nothing for “{texte}”',
  'aucun.proche': 'Did you mean {nom}? Otherwise, try another word.',
  'aucun.sans': 'Try another word or clear the search.',
  'aucun.voir': 'See {nom}',
  'aucun.effacer': 'Clear the search',

  'erreur.texte': 'The search could not complete.',
  'erreur.reessayer': 'Try again',
  'horsligne': 'Offline: recent items and pages only',

  'chargement': 'Loading the results',
  'annonce.un': '{n} result',
  'annonce.n': '{n} results',
  'annonce.aucun': 'No result',
} as const;

const FR: Readonly<Record<keyof typeof EN, string>> = {
  'titre': 'Recherche',
  'champ': 'Rechercher un client, une page, une action',
  'liste': 'Résultats',
  'echap': 'esc',

  'groupe.actions': 'Actions',
  'groupe.resultats': 'Clients et pages',
  'groupe.recents': 'Récents',

  'type.client': 'Client',
  'type.contact': 'Contact',
  'type.devis': 'Devis',
  'type.facture': 'Facture',
  'type.document': 'Document',
  'type.decision': 'Décision',
  'type.tache': 'Tâche',
  'type.note': 'Note',
  'type.message': 'Message',
  'type.page': 'Page',
  'facture.brouillon': 'Brouillon',
  'sanstitre': 'Sans titre',

  'ajmani.generique': 'Demander à Ajmani : « {texte} »',
  'ajmani.client': 'Demander à Ajmani : résumer l’historique de {nom}',
  'ajmani.client.demande': 'Résume l’historique de {nom}',
  'action.devis': 'Créer un devis pour {nom}',
  'action.ecrire': 'Écrire à {nom}',
  'action.reseau': 'Demande une connexion',

  'pied.naviguer': '↑↓ pour naviguer',
  'pied.ouvrir': '↵ pour ouvrir',
  'pied.astuce': 'Astuce : tapez « > » pour voir toutes les actions',

  'vide.invite': 'Tapez un nom, une page ou « > » pour voir les actions.',
  'aucun.titre': 'Rien pour « {texte} »',
  'aucun.proche': 'Vouliez-vous dire {nom} ? Sinon, essayez un autre mot.',
  'aucun.sans': 'Essayez un autre mot ou effacez la recherche.',
  'aucun.voir': 'Voir {nom}',
  'aucun.effacer': 'Effacer la recherche',

  'erreur.texte': 'La recherche n’a pas pu aboutir.',
  'erreur.reessayer': 'Réessayer',
  'horsligne': 'Hors ligne : éléments récents et pages seulement',

  'chargement': 'Chargement des résultats',
  'annonce.un': '{n} résultat',
  'annonce.n': '{n} résultats',
  'annonce.aucun': 'Aucun résultat',
};

export const { useMots, traduire, dictionnaires } = definirMots(EN, FR);
export type CleMot = keyof typeof EN;
