import { langueActive, useLangue, type Langue } from '../../i18n';

/**
 * LES MOTS DE LA NAVIGATION (refonte S1) — fr et en, hors des dictionnaires communs.
 *
 * Même modèle que `src/socle/i18n.ts` : l'anglais est le schéma, le français
 * est typé contre lui (une clé oubliée ne compile pas). Rien d'ici n'entre
 * dans le paquet de l'édition cliente : seul l'interne importe ce dossier, par
 * la couture `@edition/navigation`.
 *
 * Les noms des familles, de leurs actions et des entrées regroupées ne sont
 * pas ici : chaque fichier de `src/refonte/modules/declarations/` porte les
 * siens, en français et en anglais (S5).
 */
const EN = {
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
  'tous.niveaux': 'Show',
  'tous.niveau.tous': 'All',
  'tous.niveau.essentiel': 'Essentials',
  'tous.niveau.courant': 'Everyday',
  'tous.niveau.avance': 'Advanced',
  'tous.niveau.vide': 'Nothing at this level.',
  'tous.plus': 'More',
  'tous.moins': 'Less',
  'tous.vues': 'Views of {nom}',
  'tous.remplace': '{nom} is now {par}.',

  'palette.placeholder': 'What do you want to do? A page, an action, a site, a note…',
} as const;

export type CleNav = keyof typeof EN;

const FR: Record<CleNav, string> = {

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
  'tous.niveaux': 'Afficher',
  'tous.niveau.tous': 'Tous',
  'tous.niveau.essentiel': 'Essentiels',
  'tous.niveau.courant': 'Courants',
  'tous.niveau.avance': 'Avancés',
  'tous.niveau.vide': 'Rien à ce niveau.',
  'tous.plus': 'Plus',
  'tous.moins': 'Moins',
  'tous.vues': 'Vues de {nom}',
  'tous.remplace': '{nom} est devenu {par}.',

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
