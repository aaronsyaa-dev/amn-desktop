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
  'famille.contacts': 'People',
  'famille.ecrire': 'Write',
  'famille.argent': 'Money',
  'famille.echanger': 'Talk',
  'famille.creer': 'Create',
  'famille.outils': 'Tools',

  'bouton.chargement': 'Loading…',
  'modale.fermer': 'Close',

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
  'famille.contacts': 'Mes contacts',
  'famille.ecrire': 'Écrire',
  'famille.argent': 'Argent',
  'famille.echanger': 'Échanger',
  'famille.creer': 'Créer',
  'famille.outils': 'Outils',

  'bouton.chargement': 'Chargement…',
  'modale.fermer': 'Fermer',

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

export function traduireSocle(langue: Langue, cle: CleSocle): string {
  return DICTIONNAIRES_SOCLE[langue][cle] ?? EN[cle];
}

/** Comme `useLangue`, pour les mots du socle : re-rend quand la langue change. */
export function useSocleLangue(): { langue: Langue; ts: (cle: CleSocle) => string } {
  const { langue } = useLangue();
  return { langue, ts: (cle) => traduireSocle(langue, cle) };
}
