import type { OfferLike, OfferNames } from '../data/offerCatalog';

/**
 * Retrouver l'offre derrière l'identifiant porté par un devis.
 *
 * Aucun import de valeur — seulement des types — donc ce module s'exécute tel
 * quel sous Node, et surtout : le CATALOGUE ne le suit pas. C'est ce qui
 * compte ici. `ClientsScreen` et `QuotePrintPortal` existent dans les deux
 * éditions ; si la fonction et les données vivaient dans le même fichier, les
 * noms de nos paliers Tracker (« AMN Sentinel », « AMN Suite ») et notre
 * grille tarifaire partiraient dans l'application livrée à une cliente. Le
 * contrôle de bundle Business interdit d'ailleurs ces noms — et c'est lui qui
 * a attrapé la première version de ce code.
 *
 * Les données sont donc derrière la couture d'édition (`useExclusive`), et
 * seule cette fonction est partagée.
 */
export function resolveOffer(
  offers: readonly OfferLike[],
  legacy: OfferNames,
  id: string,
): { name: string; tagline: string } | null {
  const known = offers.find((offer) => offer.id === id);
  if (known) return { name: known.name, tagline: known.tagline };
  // `hasOwnProperty` et pas `legacy[id]` : dans l'édition Business
  // `trackerTier` est un intitulé libre tapé par la cliente, et « toString »
  // ou « constructor » remonteraient une FONCTION héritée d'Object.prototype —
  // que l'écran d'impression essaierait ensuite d'afficher sur un devis.
  if (!Object.prototype.hasOwnProperty.call(legacy, id)) return null;
  return legacy[id];
}
