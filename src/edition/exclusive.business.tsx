import type { ComplyCheck, Scan } from '../shared/api';
import type { DerivedSite } from '../state/RemoteSitesContext';

/**
 * La face Business de la couture (voir `exclusive.internal.tsx`).
 *
 * Ce fichier n'importe volontairement AUCUN des modules exclusifs : c'est ce
 * qui garantit qu'ils n'entrent pas dans le bundle livré à une organisation
 * cliente. Ce ne sont pas des écrans masqués, ce sont des écrans absents.
 *
 * Les valeurs ci-dessous ne sont pas des repli « au cas où » : les écrans
 * partagés testent `SITES_ENABLED` / `PRODUCTS_ENABLED` et ne rendent pas les
 * blocs concernés. Elles existent pour que le contrat de types tienne des deux
 * côtés, pas pour être affichées.
 */

export interface ExclusiveView {
  TEAM_ENABLED: boolean;
  TEAM_MEMBERS: { email: string; name: string }[];
  SITES_ENABLED: boolean;
  PRODUCTS_ENABLED: boolean;
  DECISIONS_ROUTE: string | null;
  QUOTE_OFFERS: { id: string; name: string; tagline: string }[];
  QUOTE_ISSUER_TAGLINE: string;
}

/**
 * Une seule face ici, et c'est tout le propos : dans un build Business il n'y a
 * pas de « contexte client » à distinguer — l'application EST celle de la
 * cliente. Une seule personne, donc pas d'assignation, et surtout aucune
 * adresse d'AMN DevSec dans le bundle livré.
 */
const VIEW: ExclusiveView = {
  TEAM_ENABLED: false,
  TEAM_MEMBERS: [],
  SITES_ENABLED: false,
  PRODUCTS_ENABLED: false,
  DECISIONS_ROUTE: null,
  /**
   * Aucune offre au catalogue : une auto-entrepreneuse facture ses propres
   * prestations, pas des paliers de supervision. Le devis demande donc un
   * intitulé libre (voir `NewQuoteModal` dans ClientsScreen).
   *
   * Et aucun sous-titre : nous ne connaissons pas son activité, et en inventer
   * un mettrait une phrase fausse sur un document qu'elle envoie.
   */
  QUOTE_OFFERS: [],
  QUOTE_ISSUER_TAGLINE: '',
};

export function useExclusive(): ExclusiveView {
  return VIEW;
}

/** Aucune rubrique produit dans le coffre-fort d'une organisation cliente. */
export const VAULT_PRODUCT_CATEGORIES: { value: 'trackers'; label: string }[] = [];

const NO_SITES: DerivedSite[] = [];

export function useLinkedSites(): { sites: DerivedSite[] } {
  return { sites: NO_SITES };
}

export function useSitePanelLink(): { openSite: (siteId: string) => void } {
  return { openSite: () => undefined };
}

/* eslint-disable @typescript-eslint/no-unused-vars */
export function ScanDetail(_props: { scan: Scan }): null {
  return null;
}

export function ComplyDetail(_props: { check: ComplyCheck }): null {
  return null;
}
/* eslint-enable @typescript-eslint/no-unused-vars */

export function OllamaSection(): null {
  return null;
}

/**
 * Étiquettes des livrables Scanner / Comply dans la liste Rapports. Sans
 * produits, rien à étiqueter — et les mots eux-mêmes disparaissent du bundle.
 */
export function ScanChip(): null {
  return null;
}

export function ComplyChip(): null {
  return null;
}
