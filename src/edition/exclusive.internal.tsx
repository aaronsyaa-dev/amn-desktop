import { useRemoteSites } from '../state/RemoteSitesContext';
import { useSitePanel } from '../components/site-panel/SitePanelContext';
import { trackerCatalog } from '../data/trackerCatalog';
import type { DerivedSite } from '../state/RemoteSitesContext';

import React from 'react';
import { BadgeCheck, ScanLine } from 'lucide-react';

export { ScanDetail } from '../components/scanner/ScanDetail';
export { ComplyDetail } from '../components/comply/ComplyDetail';
export { OllamaSection } from '../components/settings/OllamaSection';

/**
 * La couture entre les écrans partagés et les produits exclusifs d'AMN DevSec.
 *
 * Clients, Tâches, Rapports et Paramètres existent dans les DEUX éditions et
 * touchent, en interne, à des choses qui n'existent pas chez une cliente : le
 * parc de sites supervisés, le panneau de détail d'un site, le catalogue
 * Tracker, les rapports de scan, l'assistant local. Plutôt que de dupliquer
 * quatre écrans de plusieurs centaines de lignes, chacun passe par ce module —
 * et l'édition Business le résout vers `exclusive.business.tsx`, qui n'importe
 * rien de tout cela.
 *
 * Règle pour la suite : un écran partagé n'importe JAMAIS directement
 * `RemoteSitesContext`, `trackerCatalog`, `scanner/*` ou `comply/*`. S'il en a
 * besoin, ça passe par ici — sinon le code réapparaît dans le bundle livré.
 */

/**
 * Y a-t-il plusieurs personnes dans l'organisation ?
 *
 * Gouverne l'assignation des tâches. AMN DevSec est une équipe de deux ; une
 * organisation cliente qui travaille seule n'a personne à qui assigner, et un
 * sélecteur « Assigné à » à une seule entrée est du bruit, pas une
 * fonctionnalité.
 */
export const TEAM_ENABLED = true;

/** Membres assignables. Codés en dur tant qu'AMN DevSec reste à deux. */
export const TEAM_MEMBERS: { email: string; name: string }[] = [
  { email: 'aaron@amn-devsec.com', name: 'Aaron' },
  { email: 'mohamed@amn-devsec.com', name: 'Mohamed' },
];

/** Rubriques du coffre-fort propres à nos produits (clés des trackers déployés). */
export const VAULT_PRODUCT_CATEGORIES: { value: 'trackers'; label: string }[] = [
  { value: 'trackers', label: 'Trackers installés' },
];

/** Route de l'écran Décisions, ou `null` si le module n'existe pas. */
export const DECISIONS_ROUTE: string | null = '/decisions';

/** Le parc de sites supervisés existe-t-il dans cette édition ? */
export const SITES_ENABLED = true;

/** Scanner / Comply / SSL Monitor existent-ils dans cette édition ? */
export const PRODUCTS_ENABLED = true;

/** Sites supervisés, pour lier une fiche client ou une tâche à un site. */
export function useLinkedSites(): { sites: DerivedSite[] } {
  const { sites } = useRemoteSites();
  return { sites };
}

/** Ouvre le panneau de détail d'un site. */
export function useSitePanelLink(): { openSite: (siteId: string) => void } {
  const { openSite } = useSitePanel();
  return { openSite };
}

/**
 * Offres proposables dans un devis. En interne, ce sont les paliers du
 * catalogue Tracker — c'est ce qu'AMN DevSec vend.
 */
/** Sous-titre de l'émetteur sur un devis imprimé. */
export const QUOTE_ISSUER_TAGLINE = 'Supervision & sécurité applicative';

export const QUOTE_OFFERS: { id: string; name: string; tagline: string }[] = trackerCatalog.map(
  (offer) => ({ id: offer.id, name: offer.name, tagline: offer.tagline }),
);

/* --------- Étiquettes des livrables produits, dans la liste Rapports -------- */

/** Same visual as ScanChip — RGPD checks aren't a ReportType either. */
export function ComplyChip() {
  return (
    <span className="flex flex-shrink-0 items-center gap-1 rounded-sm border border-border bg-bg px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-text-muted">
      <BadgeCheck size={9} strokeWidth={2} />
      RGPD
    </span>
  );
}

/** Same visual as TypeChip, with an icon — scans aren't a ReportType. */
export function ScanChip() {
  return (
    <span className="flex flex-shrink-0 items-center gap-1 rounded-sm border border-border bg-bg px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-text-muted">
      <ScanLine size={9} strokeWidth={2} />
      Scanner
    </span>
  );
}
