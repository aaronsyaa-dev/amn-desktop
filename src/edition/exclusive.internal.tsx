import { useRemoteSitesOptional } from '../state/RemoteSitesContext';
import { useSitePanelOptional } from '../components/site-panel/SitePanelContext';
import { useClientView } from '../state/ClientViewContext';
import { trackerCatalog } from '../data/trackerCatalog';
import type { DerivedSite } from '../state/RemoteSitesContext';

import React from 'react';
import { BadgeCheck, ScanLine } from 'lucide-react';
import { ScanDetail as ScanDetailPanel } from '../components/scanner/ScanDetail';
import { ComplyDetail as ComplyDetailPanel } from '../components/comply/ComplyDetail';
import { OllamaSection as OllamaSettingsSection } from '../components/settings/OllamaSection';
import type { ComplyCheck, Scan } from '../shared/api';

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
 *
 * **Depuis le contexte client, la couture a deux faces dans un même build.**
 * L'édition interne monte désormais aussi les écrans partagés DANS le dossier
 * d'une organisation cliente, où ils doivent se comporter comme chez elle.
 * D'où `useExclusive()` : les valeurs ne sont plus des constantes importées mais
 * un instantané rendu, qui bascule sur la face Business quand `useClientView()`
 * est vrai. Ce n'est pas un raffinement cosmétique — sans ça, la fiche client
 * de la cliente proposerait de lier ses fiches à NOS sites supervisés, sa liste
 * de tâches offrirait de les assigner à aaron@amn-devsec.com, et ses devis
 * imprimés porteraient notre sous-titre commercial.
 */

export interface ExclusiveView {
  /**
   * Y a-t-il plusieurs personnes dans l'organisation ? Gouverne l'assignation
   * des tâches et la portée des notes. AMN DevSec est une équipe de deux ; une
   * cliente qui travaille seule n'a personne à qui assigner, et un sélecteur
   * « Assigné à » à une seule entrée est du bruit, pas une fonctionnalité.
   */
  TEAM_ENABLED: boolean;
  /** Membres assignables. Codés en dur tant qu'AMN DevSec reste à deux. */
  TEAM_MEMBERS: { email: string; name: string }[];
  /** Le parc de sites supervisés existe-t-il dans ce contexte ? */
  SITES_ENABLED: boolean;
  /** Scanner / Comply / SSL Monitor existent-ils dans ce contexte ? */
  PRODUCTS_ENABLED: boolean;
  /** Route de l'écran Décisions, ou `null` si le module n'existe pas ici. */
  DECISIONS_ROUTE: string | null;
  /** Offres proposables dans un devis — nos paliers Tracker, en interne. */
  QUOTE_OFFERS: { id: string; name: string; tagline: string }[];
  /** Sous-titre de l'émetteur sur un devis imprimé. */
  QUOTE_ISSUER_TAGLINE: string;
}

const AMN_VIEW: ExclusiveView = {
  TEAM_ENABLED: true,
  TEAM_MEMBERS: [
    { email: 'aaron@amn-devsec.com', name: 'Aaron' },
    { email: 'mohamed@amn-devsec.com', name: 'Mohamed' },
  ],
  SITES_ENABLED: true,
  PRODUCTS_ENABLED: true,
  DECISIONS_ROUTE: '/decisions',
  QUOTE_ISSUER_TAGLINE: 'Supervision & sécurité applicative',
  QUOTE_OFFERS: trackerCatalog.map((offer) => ({
    id: offer.id,
    name: offer.name,
    tagline: offer.tagline,
  })),
};

/**
 * Ce que voit la cliente. Identique, valeur pour valeur, à
 * `exclusive.business.tsx` — et ce n'est pas une coïncidence à surveiller : les
 * deux décrivent la même chose, l'application d'une organisation qui n'a ni
 * parc de sites, ni produits, ni équipe.
 */
const CLIENT_VIEW: ExclusiveView = {
  TEAM_ENABLED: false,
  TEAM_MEMBERS: [],
  SITES_ENABLED: false,
  PRODUCTS_ENABLED: false,
  DECISIONS_ROUTE: null,
  QUOTE_ISSUER_TAGLINE: '',
  QUOTE_OFFERS: [],
};

export function useExclusive(): ExclusiveView {
  return useClientView() ? CLIENT_VIEW : AMN_VIEW;
}

/**
 * Rubriques du coffre-fort propres à nos produits. Reste une constante : le
 * coffre-fort est local au poste et n'est pas monté dans un contexte client —
 * il n'y a donc pas de seconde face à lui donner.
 */
export const VAULT_PRODUCT_CATEGORIES: { value: 'trackers'; label: string }[] = [
  { value: 'trackers', label: 'Trackers installés' },
];

const NO_SITES: DerivedSite[] = [];

/** Sites supervisés, pour lier une fiche client ou une tâche à un site. */
export function useLinkedSites(): { sites: DerivedSite[] } {
  const clientView = useClientView();
  // Appelé inconditionnellement (règle des hooks) : dans un contexte client il
  // n'y a pas de fournisseur, d'où la variante non levante.
  const remote = useRemoteSitesOptional();
  return { sites: clientView || !remote ? NO_SITES : remote.sites };
}

/** Ouvre le panneau de détail d'un site. */
export function useSitePanelLink(): { openSite: (siteId: string) => void } {
  const clientView = useClientView();
  const panel = useSitePanelOptional();
  if (clientView || !panel) return { openSite: () => undefined };
  return { openSite: panel.openSite };
}

/* ------------------- Écrans et étiquettes des produits -------------------- */

export function ScanDetail(props: { scan: Scan }) {
  // Un rapport de scan ne peut pas apparaître dans le dossier d'une cliente :
  // elle n'a pas le produit, et le contenu est le nôtre.
  if (useClientView()) return null;
  return <ScanDetailPanel {...props} />;
}

export function ComplyDetail(props: { check: ComplyCheck }) {
  if (useClientView()) return null;
  return <ComplyDetailPanel {...props} />;
}

export function OllamaSection() {
  if (useClientView()) return null;
  return <OllamaSettingsSection />;
}

/** Same visual as ScanChip — RGPD checks aren't a ReportType either. */
export function ComplyChip() {
  if (useClientView()) return null;
  return (
    <span className="flex flex-shrink-0 items-center gap-1 rounded-sm border border-border bg-bg px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-text-muted">
      <BadgeCheck size={9} strokeWidth={2} />
      RGPD
    </span>
  );
}

/** Same visual as TypeChip, with an icon — scans aren't a ReportType. */
export function ScanChip() {
  if (useClientView()) return null;
  return (
    <span className="flex flex-shrink-0 items-center gap-1 rounded-sm border border-border bg-bg px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-text-muted">
      <ScanLine size={9} strokeWidth={2} />
      Scanner
    </span>
  );
}
