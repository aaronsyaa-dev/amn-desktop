/**
 * CE QU'AMN DEVSEC VEND. Une seule liste, et elle doit dire la même chose que
 * la page prix du site.
 *
 * ## Pourquoi ce fichier existe
 *
 * Le devis tirait ses offres de `trackerCatalog` — le catalogue des paliers du
 * tracker. Deux listes différentes se sont donc mises à décrire la même vente :
 *
 *   le site   : Solo 35 €, Petite équipe 109 €, Agence 249 €, sur-mesure
 *   le devis  : AMN Sentinel, AMN Sentinel+, AMN Suite
 *
 * Une prospecte lisait un forfait sur le site et recevait un devis nommant
 * autre chose. Pire : `trackerCatalog` marque lui-même Sentinel+ « à venir » et
 * Suite « verrouillé » — donc deux des trois choix proposés au moment de faire
 * un devis étaient des produits qui n'existent pas. Rien n'empêchait de les
 * vendre : la liste de choix ne regardait pas `availability`.
 *
 * `trackerCatalog` reste ce qu'il est — la trajectoire du tracker, avec son
 * extrait d'installation — mais il ne décide plus d'un prix. Ce qui est
 * proposé à la vente est ici, et nulle part ailleurs.
 *
 * ## Où ce fichier a le droit d'aller
 *
 * Nulle part hors de l'édition interne. Il porte nos prix et les noms de nos
 * paliers Tracker ; `check:business` refuse un bundle cliente qui contient
 * « Sentinel » ou « AMN Suite ». Il n'est donc importé que par
 * `edition/exclusive.internal.tsx`. Les écrans, eux, passent par
 * `lib/offers.ts`, qui ne contient aucune donnée.
 *
 * ## La règle
 *
 * Ces valeurs sont la RECOPIE de `prix.html` dans amn-site. Le site est le
 * document public : c'est lui qui engage. Si un prix change, il change là-bas
 * d'abord, ici ensuite — et `scripts/check-offers.ts` échoue tant que les deux
 * ne coïncident pas.
 *
 * ## Ce qui n'est PAS décidé ici
 *
 * La période facturée. Les forfaits sont mensuels ; un devis, lui, porte un
 * montant. Combien de mois d'avance, avec quel engagement, avec quelle
 * résiliation : le site répond aujourd'hui « je n'ai pas de réponse préparée,
 * et je ne vais pas en inventer une ». Tant que ce n'est pas tranché, aucun
 * montant n'est pré-rempli — le prix mensuel est AFFICHÉ à celui qui rédige,
 * pour que le chiffre qu'il tape soit celui que la prospecte a lu, et c'est
 * tout.
 */

/** Ce qu'il faut d'une offre pour l'afficher : ce que partage `lib/offers.ts`. */
export interface OfferLike {
  id: string;
  name: string;
  tagline: string;
}

/** Une table d'intitulés indexée par identifiant d'offre. */
export type OfferNames = Record<string, { name: string; tagline: string }>;

export interface Offer extends OfferLike {
  /** Prix mensuel HT, en centimes. `null` = sur devis. */
  monthlyCents: number | null;
  /**
   * Une OPTION s'ajoute à un forfait, elle ne se vend pas seule. Elle n'a donc
   * rien à faire dans la liste où l'on choisit le sujet d'un devis : elle est
   * une LIGNE de ce devis. Gardée ici quand même, parce que c'est ici qu'on
   * vient lire ce qu'on vend et à quel prix.
   */
  addon?: true;
}

export const offerCatalog: Offer[] = [
  {
    id: 'solo',
    name: 'Solo',
    tagline: 'Une personne — poste de travail et supervision',
    monthlyCents: 3500,
  },
  {
    id: 'equipe',
    name: 'Petite équipe',
    tagline: 'De deux à cinq personnes — comptes nominatifs',
    monthlyCents: 10900,
  },
  {
    id: 'agence',
    name: 'Agence',
    tagline: 'Vous gérez des accès pour vos propres clients',
    monthlyCents: 24900,
  },
  {
    id: 'sur-mesure',
    name: 'Sur-mesure',
    tagline: 'À partir de six personnes — chiffré au cas par cas',
    monthlyCents: null,
  },
  {
    id: 'option-commerce',
    name: 'Option commerce',
    tagline: 'Boutique et paiements — s’ajoute au forfait',
    monthlyCents: 2500,
    addon: true,
  },
];

/** Ce qu'on peut choisir comme SUJET d'un devis : les forfaits, pas les options. */
export const sellableOffers: Offer[] = offerCatalog.filter((offer) => !offer.addon);

/**
 * Ce que portaient les devis d'AVANT — affichage seulement.
 *
 * Un devis déjà envoyé garde son identifiant d'offre. Le retirer du catalogue
 * sans ce repli ferait réimprimer « sentinel » en toutes lettres sur un
 * document qui affichait « AMN Sentinel ». Aucun document existant ne change ;
 * ces trois-là ne sont simplement plus proposés.
 */
export const legacyOffers: OfferNames = {
  sentinel: { name: 'AMN Sentinel', tagline: 'Sécurité de base, temps réel' },
  'sentinel-plus': { name: 'AMN Sentinel+', tagline: 'Détection avancée' },
  suite: { name: 'AMN Suite', tagline: 'Sécurité + analytics business' },
};
