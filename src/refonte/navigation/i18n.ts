import { langueActive, useLangue, type Langue } from '../../i18n';
import type { CleAction } from './registre';

/**
 * LES MOTS DE LA NAVIGATION (refonte S1) — fr et en, hors des dictionnaires communs.
 *
 * Même modèle que `src/socle/i18n.ts` : l'anglais est le schéma, le français
 * est typé contre lui (une clé oubliée ne compile pas). Rien d'ici n'entre
 * dans le paquet de l'édition cliente : seul l'interne importe ce dossier, par
 * la couture `@edition/navigation`.
 *
 * Les noms des familles ne sont pas ici : ils vivent dans le socle
 * (`famille.*`), et se changent là-bas.
 */
const ACTIONS_EN = {
  'action.jour.organiser': 'Plan my day',
  'action.jour.suivre': 'Track progress',
  'action.jour.equipe': 'Run the team',
  'action.jour.perso': 'Just for me',
  'action.contacts.clients': 'My customers',
  'action.contacts.prospecter': 'Find customers',
  'action.contacts.ecouter': 'Listen to customers',
  'action.contacts.fideliser': 'Keep customers',
  'action.contacts.partenaires': 'Suppliers and colleagues',
  'action.ecrire.noter': 'Take notes',
  'action.ecrire.rediger': 'Write',
  'action.ecrire.documents': 'File documents',
  'action.ecrire.signer': 'Get it signed',
  'action.argent.facturer': 'Invoice',
  'action.argent.vendre': 'Sell and get paid',
  'action.argent.depenser': 'Spending',
  'action.argent.prevoir': 'Forecast',
  'action.argent.comptabilite': 'Accounting',
  'action.echanger.discuter': 'Chat',
  'action.echanger.reunir': 'Meet and call',
  'action.echanger.annoncer': 'Tell everyone',
  'action.echanger.public': 'Welcome the public',
  'action.creer.video': 'Video and audio',
  'action.creer.visuels': 'Images and visuals',
  'action.creer.publier': 'Publish',
  'action.outils.pratique': 'Handy tools',
  'action.outils.automatiser': 'Automate and import',
  'action.outils.terrain': 'In the field',
  'action.outils.stock': 'Stock and purchasing',
  'action.outils.conformite': 'Compliance',
  'action.outils.reglages': 'Settings and account',
  'action.outils.deleguer': 'Delegate to the Guard',
  'action.outils.superviser': 'Oversee clients',
  'action.outils.securiser': 'Cybersecurity',
} as const satisfies Record<`action.${CleAction}`, string>;

const EN = {
  ...ACTIONS_EN,

  'rail.nav': 'Main navigation',
  'rail.recherche': 'What do you want to do?',
  'rail.accueil.raccourci': 'G then A',
  'rail.accueil.aide': 'Back to Home (G then A)',
  'rail.essentiels': 'Essentials',
  'rail.epingles': 'Pinned',
  'rail.recents': 'Recent',
  'rail.maintenant': 'Right now',
  'rail.garde': 'Guard and oversight',
  'rail.tous': 'All modules',
  'rail.epingler': 'Pin {nom}',
  'rail.detacher': 'Unpin {nom}',

  'tous.titre': 'All modules',
  'tous.texte': 'Sorted by family, then by what you want to do.',
  'tous.filtre': 'Find an action or a module',
  'tous.filtre.aide': 'For example: send an invoice',
  'tous.aucun': 'No module matches “{q}”.',
  'tous.compte': '{n} modules',

  'palette.placeholder': 'What do you want to do? A page, an action, a site, a note…',
} as const;

export type CleNav = keyof typeof EN;

const FR: Record<CleNav, string> = {
  'action.jour.organiser': 'Organiser ma journée',
  'action.jour.suivre': 'Suivre l’avancement',
  'action.jour.equipe': 'Gérer l’équipe',
  'action.jour.perso': 'Pour moi',
  'action.contacts.clients': 'Mes clients',
  'action.contacts.prospecter': 'Trouver des clients',
  'action.contacts.ecouter': 'Écouter les clients',
  'action.contacts.fideliser': 'Fidéliser',
  'action.contacts.partenaires': 'Fournisseurs et collègues',
  'action.ecrire.noter': 'Noter',
  'action.ecrire.rediger': 'Rédiger',
  'action.ecrire.documents': 'Ranger les documents',
  'action.ecrire.signer': 'Faire signer',
  'action.argent.facturer': 'Facturer',
  'action.argent.vendre': 'Vendre et encaisser',
  'action.argent.depenser': 'Dépenses',
  'action.argent.prevoir': 'Prévoir',
  'action.argent.comptabilite': 'Comptabilité',
  'action.echanger.discuter': 'Discuter',
  'action.echanger.reunir': 'Se réunir et appeler',
  'action.echanger.annoncer': 'Annoncer à tous',
  'action.echanger.public': 'Accueillir le public',
  'action.creer.video': 'Vidéo et son',
  'action.creer.visuels': 'Images et visuels',
  'action.creer.publier': 'Publier',
  'action.outils.pratique': 'Petits outils',
  'action.outils.automatiser': 'Automatiser et importer',
  'action.outils.terrain': 'Sur le terrain',
  'action.outils.stock': 'Stock et achats',
  'action.outils.conformite': 'Conformité',
  'action.outils.reglages': 'Réglages et compte',
  'action.outils.deleguer': 'Déléguer à la Garde',
  'action.outils.superviser': 'Superviser les clientes',
  'action.outils.securiser': 'Cybersécurité',

  'rail.nav': 'Navigation principale',
  'rail.recherche': 'Que voulez-vous faire ?',
  'rail.accueil.raccourci': 'G puis A',
  'rail.accueil.aide': 'Revenir à l’Accueil (G puis A)',
  'rail.essentiels': 'Essentiels',
  'rail.epingles': 'Épinglés',
  'rail.recents': 'Récents',
  'rail.maintenant': 'Pour ce moment',
  'rail.garde': 'Garde et supervision',
  'rail.tous': 'Tous les modules',
  'rail.epingler': 'Épingler {nom}',
  'rail.detacher': 'Détacher {nom}',

  'tous.titre': 'Tous les modules',
  'tous.texte': 'Rangés par famille, puis par ce que vous voulez faire.',
  'tous.filtre': 'Chercher une action ou un module',
  'tous.filtre.aide': 'Par exemple : envoyer une facture',
  'tous.aucun': 'Aucun module ne correspond à « {q} ».',
  'tous.compte': '{n} modules',

  'palette.placeholder': 'Que voulez-vous faire ? Une page, une action, un site, une note…',
};

export const DICTIONNAIRES_NAV: Record<Langue, Record<CleNav, string>> = { en: EN, fr: FR };

export function traduireNav(langue: Langue, cle: CleNav, vars?: Record<string, string | number>): string {
  const brut = DICTIONNAIRES_NAV[langue][cle] ?? EN[cle];
  return vars ? brut.replace(/\{(\w+)\}/g, (tout, nom: string) => (nom in vars ? String(vars[nom]) : tout)) : brut;
}

/** Hors React (la palette lit le placeholder au rendu) : la langue active. */
export function tn(cle: CleNav, vars?: Record<string, string | number>): string {
  return traduireNav(langueActive(), cle, vars);
}

/** Comme `useLangue`, pour les mots de la navigation : re-rend quand la langue change. */
export function useNavLangue(): { langue: Langue; tn: (cle: CleNav, vars?: Record<string, string | number>) => string } {
  const { langue } = useLangue();
  return { langue, tn: (cle, vars) => traduireNav(langue, cle, vars) };
}
