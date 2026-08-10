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
import { bridge } from '../lib/bridge';
import { scoreColor } from '../lib/scanSeverity';
import { relativeTime } from '../lib/time';
import type { ComplyCheck, Scan, VaultCategory } from '../shared/api';

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
 * Rubriques du coffre-fort propres à nos produits et à notre métier. Reste une
 * constante : le coffre-fort est local au poste et n'est pas monté dans un
 * contexte client — il n'y a donc pas de seconde face à lui donner.
 *
 * « Organisations clientes » range les accès émis à la création d'une
 * organisation : nom, adresse du compte propriétaire, et le secret remis (mot
 * de passe temporaire ou jeton d'activation) au moment où il existe. Ces
 * secrets ne s'affichent qu'une fois — amn-api n'en garde que l'empreinte — et
 * ils vivaient jusqu'ici dans un presse-papiers, donc nulle part.
 */
export const VAULT_PRODUCT_CATEGORIES: { value: VaultCategory; label: string }[] = [
  { value: 'trackers', label: 'Trackers installés' },
  { value: 'orgs', label: 'Organisations clientes' },
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

/* ------------------ Sorties produit dans l'écran Rapports ----------------- */

/**
 * Une sortie produit (scan Elite terminé, contrôle RGPD terminé) mêlée à la
 * liste des rapports.
 *
 * L'écran Rapports est partagé, et il montrait ces trois choses en une seule
 * liste chronologique — ce qui est le bon comportement chez nous. Le problème
 * était la façon dont il s'en abstenait chez la cliente : un drapeau runtime
 * (`PRODUCTS_ENABLED`) sautait les appels, mais les chaînes `"comply"`,
 * `"scanner"`, `"rgpd"` et les appels `listScans()` / `listComplyChecks()`
 * restaient compilés dans SON bundle. Rollup ne peut pas supprimer une branche
 * dont la condition n'est connue qu'à l'exécution. Une recherche de texte dans
 * le fichier servi par HTTPS lui apprenait donc l'existence de nos produits.
 *
 * Tout est passé derrière cette couture : l'écran partagé ne connaît plus que
 * des entrées opaques (`id`, `at`, une ligne, un panneau). La variante Business
 * rend une liste vide et n'importe rien — les noms ne sont plus dans le bundle,
 * ils ne sont plus nulle part.
 */
export interface ProductReportEntry {
  /** Unique dans la liste, produits et rapports confondus. */
  id: string;
  /** ISO — sert au tri chronologique commun. */
  at: string;
  /** Le contenu de la ligne de liste. L'écran fournit le bouton autour. */
  row: React.ReactNode;
  /** Le panneau de droite quand cette entrée est sélectionnée. */
  detail: React.ReactNode;
}

export interface ProductReports {
  /** Onglets de filtre ajoutés à ceux des rapports. */
  filters: { value: string; label: string }[];
  /** Les entrées à mêler, déjà filtrées. */
  entries: ProductReportEntry[];
  /** Ce build a-t-il des sorties produit du tout ? Une liste vide ne le dit pas. */
  enabled: boolean;
}

export const PRODUCT_REPORT_FILTERS = [
  { value: 'scanner', label: 'Scanner' },
  { value: 'rgpd', label: 'RGPD' },
];

export function useProductReports(typeFilter: string, cutoffMs: number): ProductReports {
  const enabled = useExclusive().PRODUCTS_ENABLED;

  // Scans Elite terminés, lus depuis amn-api pour que les deux opérateurs
  // voient le même historique. Rafraîchis quand un scan se termine n'importe où
  // dans l'app, plutôt qu'au rechargement.
  const [scans, setScans] = React.useState<Scan[]>([]);
  React.useEffect(() => {
    if (!enabled) return undefined;
    let active = true;
    const refresh = () => {
      bridge()
        .remote.listScans()
        .then((all) => {
          if (active) setScans(all.filter((s) => s.tier === 'elite' && s.status === 'done'));
        })
        .catch(() => undefined);
    };
    refresh();
    const off = bridge().remote.onScanProgress((p) => {
      if (p.status === 'done') refresh();
    });
    return () => {
      active = false;
      off();
    };
  }, [enabled]);

  // Contrôles RGPD terminés, même contrat de rafraîchissement.
  const [checks, setChecks] = React.useState<ComplyCheck[]>([]);
  React.useEffect(() => {
    if (!enabled) return undefined;
    let active = true;
    const refresh = () => {
      bridge()
        .remote.listComplyChecks()
        .then((all) => {
          if (active) setChecks(all.filter((c) => c.status === 'done'));
        })
        .catch(() => undefined);
    };
    refresh();
    const off = bridge().remote.onComplyProgress((p) => {
      if (p.status === 'done') refresh();
    });
    return () => {
      active = false;
      off();
    };
  }, [enabled]);

  const entries = React.useMemo<ProductReportEntry[]>(() => {
    if (!enabled) return [];
    const within = (iso: string) => (cutoffMs ? new Date(iso).getTime() >= cutoffMs : true);
    const out: ProductReportEntry[] = [];
    if (typeFilter === 'all' || typeFilter === 'scanner') {
      for (const scan of scans) {
        if (!within(scan.createdAt)) continue;
        out.push({
          id: `scan:${scan.id}`,
          at: scan.createdAt,
          row: (
            <ProductRow
              chip={<ScanChip />}
              title={scan.results.target?.host ?? scan.url}
              score={scan.score}
              at={scan.createdAt}
            />
          ),
          detail: <ScanDetailPanel scan={scan} />,
        });
      }
    }
    if (typeFilter === 'all' || typeFilter === 'rgpd') {
      for (const check of checks) {
        if (!within(check.createdAt)) continue;
        out.push({
          id: `comply:${check.id}`,
          at: check.createdAt,
          row: (
            <ProductRow
              chip={<ComplyChip />}
              title={check.results.target?.host ?? check.url}
              score={check.score}
              at={check.createdAt}
            />
          ),
          detail: <ComplyDetailPanel check={check} />,
        });
      }
    }
    return out;
  }, [enabled, typeFilter, cutoffMs, scans, checks]);

  return { filters: enabled ? PRODUCT_REPORT_FILTERS : [], entries, enabled };
}

/**
 * Étiquettes des deux sorties. Locales, plus exportées : elles ne servent qu'à
 * la ligne ci-dessous, et un écran partagé n'a plus de raison de les recevoir.
 */
function ComplyChip() {
  return (
    <span className="flex flex-shrink-0 items-center gap-1 rounded-sm border border-border bg-bg px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-text-muted">
      <BadgeCheck size={9} strokeWidth={2} />
      RGPD
    </span>
  );
}

function ScanChip() {
  return (
    <span className="flex flex-shrink-0 items-center gap-1 rounded-sm border border-border bg-bg px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-text-muted">
      <ScanLine size={9} strokeWidth={2} />
      Scanner
    </span>
  );
}

/** Ligne de liste commune aux deux sorties produit — même forme, même place. */
function ProductRow({
  chip,
  title,
  score,
  at,
}: {
  chip: React.ReactNode;
  title: string;
  score: number | null;
  at: string;
}) {
  return (
    <>
      <div className="flex items-center gap-2">
        {chip}
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-text-primary">{title}</span>
        <span className={`flex-shrink-0 font-mono text-xs font-semibold ${scoreColor(score)}`}>
          {score}
        </span>
      </div>
      <span className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
        {relativeTime(at)}
      </span>
    </>
  );
}

/*
 * Note : `ScanDetail`, `ComplyDetail`, `ScanChip` et `ComplyChip` ne passent
 * plus par cette couture. Ils ne servaient qu'à l'écran Rapports, qui les
 * recevait pour rendre lui-même des lignes et des panneaux produit — et qui
 * gardait de ce fait leurs noms et leurs formes dans le bundle d'une cliente.
 * C'est maintenant `useProductReports` ci-dessus qui rend ces morceaux tout
 * faits, et les écrans exclusifs (Scanner, Comply, Sites) importent les
 * composants directement : ils ne sont compilés que dans l'édition interne.
 */

export function OllamaSection() {
  if (useClientView()) return null;
  return <OllamaSettingsSection />;
}
