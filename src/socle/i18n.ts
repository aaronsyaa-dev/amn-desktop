import { useLangue, type Langue } from '../i18n';

/**
 * LES MOTS DU SOCLE — fr et en, à part des dictionnaires communs.
 *
 * Pourquoi pas dans `src/i18n/fr.ts` : ces dictionnaires entrent dans le
 * paquet de l'édition cliente, et rien de ce que le socle affiche n'y est
 * encore montré. Ici, ces mots n'y entrent que le jour où une brique y est
 * importée. Même schéma que les dictionnaires communs : l'anglais est la
 * base, le français est typé contre elle (une clé oubliée ne compile pas).
 *
 * Les noms de familles sont PROVISOIRES — c'est l'endroit où les changer.
 */
const EN = {
  'famille.jour': 'My day',
  'famille.contacts': 'People and clients',
  'famille.ecrire': 'Write and remember',
  'famille.argent': 'Money',
  'famille.echanger': 'Talk',
  'famille.creer': 'Create and produce',
  'famille.outils': 'Tools and settings',

  'bouton.chargement': 'Loading…',
  'modale.fermer': 'Close',

  'coquille.produit.sous': 'Team space',
  'coquille.recherche': 'Search…',
  'coquille.recherche.aide': 'Search a module, a client, an action',
  'coquille.menu.ouvrir': 'Open the menu',
  'coquille.menu.fermer': 'Close the menu',
  'coquille.evitement': 'Skip to the content',
  'coquille.nav': 'Main navigation',
  'coquille.famille.deplier': 'Show the modules of {nom}',
  'coquille.famille.replier': 'Hide the modules of {nom}',
  'coquille.badge': '{n} to see',
  'coquille.garde': 'The Guard and supervision',
  'coquille.tous': 'All modules ({n})',
  'coquille.enLigne': 'Online',
  'coquille.enLigne.sur': 'on {lieu}',
  'coquille.personne': 'No one else is online right now.',
  'coquille.presenceCoupee': 'Presence is switched off on this device.',

  'coquille.tous.court': 'All modules',
  'coquille.accueil': 'Home',
  'coquille.reglage.titre': 'New shell',
  'coquille.reglage.texte': 'One navigation, a breadcrumb, ⌘K to search and ⌘J for Ajmani, in black and grey. Applies right away, on this device only.',
  'coquille.reglage.allumee': 'On',
  'coquille.reglage.eteinte': 'Off',
  'coquille.reglage.allumer': 'Turn on the new shell',
  'coquille.reglage.eteindre': 'Back to the previous shell',

  'entete.fil': 'Breadcrumb',
  'entete.enLigne': '{n} online',
  'entete.enLigne.aucun': 'No one online',
  'entete.cloche': 'Notifications',
  'entete.cloche.nombre': 'Notifications, {n} to see',
  'entete.cloche.titre': 'To see',
  'entete.cloche.vide': 'Nothing is waiting for you. Inbox zero.',
  'entete.cloche.tout': 'See everything',
  'entete.garde.calme': 'The Guard is watching, all is in order',
  'entete.garde.attention': 'The Guard flags {n} to look at',
  'entete.garde.critique': 'The Guard has a critical alert',
  'entete.garde.inconnu': 'The Guard is not answering',

  'ajmani.barre': 'Ask Ajmani, or say what you want to do',
  'ajmani.barre.aide': 'Opens the Ajmani palette',
  'palette.titre': 'Ajmani palette',
  'palette.champ': 'Say what you want to do…',
  'palette.demander': 'Ask Ajmani: “{texte}”',
  'palette.demander.aide': 'Ajmani answers in the side panel',
  'palette.suggestions': 'Suggestions',
  'palette.resultats': 'Go to',
  'palette.aucun': 'No module matches. Ajmani can look for you.',
  'palette.aide': '↑↓ to choose · Enter to confirm · Esc to close',
  'palette.liste': 'Proposals',

  'mouvement.titre': 'Motion',
  'mouvement.texte': 'How much the interface moves. Applies right away, on this device only.',
  'mouvement.complet': 'Full',
  'mouvement.complet.aide': 'Panels slide, cards lift, counters roll.',
  'mouvement.reduit': 'Reduced',
  'mouvement.reduit.aide': 'Gentle fades only: nothing slides or zooms.',
  'mouvement.aucun': 'None',
  'mouvement.aucun.aide': 'Nothing moves. Every change appears at once.',
  'mouvement.systeme': 'Your system asks for less motion, so Reduced is the default here.',
  'mouvement.revenirSysteme': 'Follow the system',
} as const;

export type CleSocle = keyof typeof EN;

const FR: Record<CleSocle, string> = {
  'famille.jour': 'Ma journée',
  'famille.contacts': 'Mes contacts et clients',
  'famille.ecrire': 'Écrire et retenir',
  'famille.argent': 'L’argent',
  'famille.echanger': 'Échanger',
  'famille.creer': 'Créer et produire',
  'famille.outils': 'Outils et réglages',

  'bouton.chargement': 'Chargement…',
  'modale.fermer': 'Fermer',

  'coquille.produit.sous': 'Espace de l’équipe',
  'coquille.recherche': 'Rechercher…',
  'coquille.recherche.aide': 'Chercher un module, un client, une action',
  'coquille.menu.ouvrir': 'Ouvrir le menu',
  'coquille.menu.fermer': 'Fermer le menu',
  'coquille.evitement': 'Aller au contenu',
  'coquille.nav': 'Navigation principale',
  'coquille.famille.deplier': 'Afficher les modules de {nom}',
  'coquille.famille.replier': 'Masquer les modules de {nom}',
  'coquille.badge': '{n} à voir',
  'coquille.garde': 'La Garde et la supervision',
  'coquille.tous': 'Tous les modules ({n})',
  'coquille.enLigne': 'En ligne',
  'coquille.enLigne.sur': 'sur {lieu}',
  'coquille.personne': 'Personne d’autre n’est en ligne pour l’instant.',
  'coquille.presenceCoupee': 'La présence est coupée sur ce poste.',

  'coquille.tous.court': 'Tous les modules',
  'coquille.accueil': 'Accueil',
  'coquille.reglage.titre': 'Nouvelle coquille',
  'coquille.reglage.texte': 'Une seule navigation, un fil d’Ariane, ⌘K pour chercher et ⌘J pour Ajmani, en noir et gris. S’applique à l’instant, sur ce poste seulement.',
  'coquille.reglage.allumee': 'Allumée',
  'coquille.reglage.eteinte': 'Éteinte',
  'coquille.reglage.allumer': 'Allumer la nouvelle coquille',
  'coquille.reglage.eteindre': 'Revenir à la coquille précédente',

  'entete.fil': 'Fil d’Ariane',
  'entete.enLigne': '{n} en ligne',
  'entete.enLigne.aucun': 'Personne en ligne',
  'entete.cloche': 'Notifications',
  'entete.cloche.nombre': 'Notifications, {n} à voir',
  'entete.cloche.titre': 'À voir',
  'entete.cloche.vide': 'Rien ne vous attend. Boîte à zéro.',
  'entete.cloche.tout': 'Tout voir',
  'entete.garde.calme': 'La Garde veille, tout est en ordre',
  'entete.garde.attention': 'La Garde signale {n} point(s) à regarder',
  'entete.garde.critique': 'La Garde a une alerte critique',
  'entete.garde.inconnu': 'La Garde ne répond pas',

  'ajmani.barre': 'Demandez à Ajmani, ou dites ce que vous voulez faire',
  'ajmani.barre.aide': 'Ouvre la palette Ajmani',
  'palette.titre': 'Palette Ajmani',
  'palette.champ': 'Dites ce que vous voulez faire…',
  'palette.demander': 'Demander à Ajmani : « {texte} »',
  'palette.demander.aide': 'Ajmani répond dans le panneau latéral',
  'palette.suggestions': 'Suggestions',
  'palette.resultats': 'Aller à',
  'palette.aucun': 'Aucun module ne correspond. Ajmani peut chercher pour vous.',
  'palette.aide': '↑↓ pour choisir · Entrée pour valider · Échap pour fermer',
  'palette.liste': 'Propositions',

  'mouvement.titre': 'Mouvement',
  'mouvement.texte': 'Ce qui bouge dans l’interface. S’applique à l’instant, sur ce poste seulement.',
  'mouvement.complet': 'Complet',
  'mouvement.complet.aide': 'Les panneaux glissent, les cartes se soulèvent, les compteurs défilent.',
  'mouvement.reduit': 'Réduit',
  'mouvement.reduit.aide': 'Des fondus doux seulement : rien ne glisse ni ne grandit.',
  'mouvement.aucun': 'Aucun',
  'mouvement.aucun.aide': 'Plus rien ne bouge. Chaque changement apparaît d’un coup.',
  'mouvement.systeme': 'Votre système demande moins de mouvement : « Réduit » est donc le réglage par défaut.',
  'mouvement.revenirSysteme': 'Suivre le système',
};

export const DICTIONNAIRES_SOCLE: Record<Langue, Record<CleSocle, string>> = { en: EN, fr: FR };

export type ParamsSocle = Record<string, string | number>;

export function traduireSocle(langue: Langue, cle: CleSocle, params?: ParamsSocle): string {
  const texte = DICTIONNAIRES_SOCLE[langue][cle] ?? EN[cle];
  return params ? texte.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k]) : m)) : texte;
}

/** Comme `useLangue`, pour les mots du socle : re-rend quand la langue change. */
export function useSocleLangue(): { langue: Langue; ts: (cle: CleSocle, params?: ParamsSocle) => string } {
  const { langue } = useLangue();
  return { langue, ts: (cle, params) => traduireSocle(langue, cle, params) };
}
