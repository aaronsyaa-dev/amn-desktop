import type React from 'react';
import type { VaultCategory } from '../shared/api';
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
export const VAULT_PRODUCT_CATEGORIES: { value: VaultCategory; label: string }[] = [];

/* ------------------ Sorties produit dans l'écran Rapports ----------------- */

/**
 * L'écran Rapports mêle, chez nous, les rapports écrits aux scans Elite et aux
 * contrôles RGPD terminés. Ici, il n'y a que des rapports — et surtout, ce
 * fichier n'importe ni `Scan`, ni `ComplyCheck`, ni `scanSeverity`, ni les
 * canaux `listScans` / `listComplyChecks`. Rien de tout cela n'entre dans le
 * bundle d'une cliente : ce ne sont pas des sorties masquées, elles n'existent
 * pas.
 *
 * `enabled: false` plutôt qu'une simple liste vide : l'écran s'en sert pour
 * choisir sa phrase d'invite (« générez-en un depuis une tâche ou un client »
 * sans parler d'un scan Elite qu'elle ne peut pas lancer).
 */
export interface ProductReportEntry {
  id: string;
  at: string;
  row: React.ReactNode;
  detail: React.ReactNode;
}

export interface ProductReports {
  filters: { value: string; label: string }[];
  entries: ProductReportEntry[];
  enabled: boolean;
}

const NO_PRODUCT_REPORTS: ProductReports = { filters: [], entries: [], enabled: false };

/**
 * Signature identique à la face interne — c'est `npm run typecheck:business`
 * qui le tient : un écran partagé qui appellerait le hook autrement compilerait
 * en interne et casserait ici.
 */
/* eslint-disable @typescript-eslint/no-unused-vars */
export function useProductReports(_typeFilter: string, _cutoffMs: number): ProductReports {
  return NO_PRODUCT_REPORTS;
}
/* eslint-enable @typescript-eslint/no-unused-vars */

const NO_SITES: DerivedSite[] = [];

export function useLinkedSites(): { sites: DerivedSite[] } {
  return { sites: NO_SITES };
}

export function useSitePanelLink(): { openSite: (siteId: string) => void } {
  return { openSite: () => undefined };
}

export function OllamaSection(): null {
  return null;
}
