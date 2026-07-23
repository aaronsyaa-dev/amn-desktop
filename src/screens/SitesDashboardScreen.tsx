import React, { useMemo, useState } from 'react';
import { ChevronDown, Search, SlidersHorizontal } from 'lucide-react';
import { mockSites } from '../data/mockSites';
import type { Site, SiteStatus } from '../types/site';
import { SiteCard } from '../components/SiteCard';

type SortKey = 'urgent' | 'vulns' | 'alpha';

const SORT_LABELS: Record<SortKey, string> = {
  urgent: 'Priorité',
  vulns: 'Vulnérabilités',
  alpha: 'Alphabétique',
};

const STATUS_ORDER: Record<SiteStatus, number> = {
  offline: 0,
  degraded: 1,
  online: 2,
};

const STATUS_FILTERS: Array<{ key: SiteStatus | 'all'; label: string }> = [
  { key: 'all', label: 'Tous' },
  { key: 'online', label: 'En ligne' },
  { key: 'degraded', label: 'Dégradés' },
  { key: 'offline', label: 'Hors ligne' },
];

function sortSites(sites: Site[], key: SortKey): Site[] {
  const copy = [...sites];
  switch (key) {
    case 'urgent':
      return copy.sort(
        (a, b) =>
          STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
          b.openVulnerabilities - a.openVulnerabilities,
      );
    case 'vulns':
      return copy.sort((a, b) => b.openVulnerabilities - a.openVulnerabilities);
    case 'alpha':
      return copy.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  }
}

export function SitesDashboardScreen() {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('urgent');
  const [statusFilter, setStatusFilter] = useState<SiteStatus | 'all'>('all');

  const sites = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = mockSites.filter((site) => {
      const matchesQuery =
        !q ||
        site.name.toLowerCase().includes(q) ||
        site.url.toLowerCase().includes(q);
      const matchesStatus =
        statusFilter === 'all' || site.status === statusFilter;
      return matchesQuery && matchesStatus;
    });
    return sortSites(filtered, sort);
  }, [query, sort, statusFilter]);

  return (
    <section className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Sites surveillés</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Statut, disponibilité et vulnérabilités des {mockSites.length} sites que
          vous supervisez.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search
            size={16}
            strokeWidth={1.75}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un site…"
            className="input-focus w-full rounded-lg border border-border bg-surface py-2 pl-9 pr-3 text-sm text-text-primary placeholder:text-text-muted"
          />
        </div>

        <div className="flex items-center gap-1 rounded-lg border border-border bg-surface p-1">
          {STATUS_FILTERS.map((filter) => (
            <button
              key={filter.key}
              type="button"
              onClick={() => setStatusFilter(filter.key)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors duration-150 ${
                statusFilter === filter.key
                  ? 'bg-accent-muted text-text-primary'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        <div className="relative flex items-center">
          <SlidersHorizontal
            size={15}
            strokeWidth={1.75}
            className="pointer-events-none absolute left-3 text-text-muted"
          />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="input-focus cursor-pointer appearance-none rounded-lg border border-border bg-surface py-2 pl-9 pr-8 text-sm text-text-secondary"
            aria-label="Trier les sites"
          >
            {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
              <option key={key} value={key}>
                {SORT_LABELS[key]}
              </option>
            ))}
          </select>
          <ChevronDown
            size={15}
            strokeWidth={1.75}
            className="pointer-events-none absolute right-3 text-text-muted"
          />
        </div>
      </div>

      {sites.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sites.map((site) => (
            <SiteCard key={site.id} site={site} />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border py-16 text-center text-sm text-text-secondary">
          Aucun site ne correspond à votre recherche.
        </div>
      )}
    </section>
  );
}
