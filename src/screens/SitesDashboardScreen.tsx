import React, { useMemo, useState } from 'react';
import { ChevronDown, Search, SlidersHorizontal } from 'lucide-react';
import { motion } from 'framer-motion';
import { mockSites } from '../data/mockSites';
import type { Site, SiteStatus } from '../types/site';
import { StatusBadge } from '../components/StatusBadge';
import { Sparkline } from '../components/Sparkline';
import { relativeTime } from '../lib/time';
import { staggerContainer, staggerItem } from '../lib/transitions';
import { useSitePanel } from '../components/site-panel/SitePanelContext';

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

const TREND_COLOR: Record<SiteStatus, string> = {
  online: 'var(--color-success)',
  degraded: 'var(--color-warning)',
  offline: 'var(--color-danger)',
};

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

  const offlineCount = mockSites.filter((s) => s.status === 'offline').length;

  return (
    <section className="flex flex-col gap-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-text-primary">
            Registre des sites
          </h1>
          <p className="mt-1 font-mono text-xs uppercase tracking-widest text-text-muted">
            {mockSites.length} sites supervisés ·{' '}
            <span className={offlineCount > 0 ? 'text-danger' : 'text-text-secondary'}>
              {offlineCount} hors ligne
            </span>
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-[220px] flex-1">
          <Search
            size={15}
            strokeWidth={1.75}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filtrer…"
            className="input-focus w-full border border-border bg-surface py-2 pl-9 pr-3 font-mono text-sm text-text-primary placeholder:text-text-muted"
          />
        </div>

        <div className="flex items-center border border-border bg-surface">
          {STATUS_FILTERS.map((filter) => (
            <button
              key={filter.key}
              type="button"
              onClick={() => setStatusFilter(filter.key)}
              className={`px-3 py-2 font-mono text-[11px] uppercase tracking-wider transition-colors duration-150 ${
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
            size={14}
            strokeWidth={1.75}
            className="pointer-events-none absolute left-3 text-text-muted"
          />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="input-focus cursor-pointer appearance-none border border-border bg-surface py-2 pl-9 pr-8 font-mono text-[11px] uppercase tracking-wider text-text-secondary"
            aria-label="Trier"
          >
            {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
              <option key={key} value={key}>
                {SORT_LABELS[key]}
              </option>
            ))}
          </select>
          <ChevronDown
            size={14}
            strokeWidth={1.75}
            className="pointer-events-none absolute right-3 text-text-muted"
          />
        </div>
      </div>

      {/* Register */}
      <div className="border border-border bg-surface">
        <div className="hidden grid-cols-[1.6fr_auto_5rem_4rem_5rem_6rem] items-center gap-4 border-b border-border px-5 py-2.5 font-mono text-[10px] uppercase tracking-widest text-text-muted md:grid">
          <span>Site</span>
          <span>Statut</span>
          <span className="text-right">Dispo</span>
          <span className="text-right">Vuln</span>
          <span className="text-right">Tendance</span>
          <span className="text-right">Dernier scan</span>
        </div>

        {sites.length > 0 ? (
          <motion.div
            variants={staggerContainer}
            initial="initial"
            animate="animate"
            className="divide-y divide-border/60"
          >
            {sites.map((site) => (
              <motion.div key={site.id} variants={staggerItem}>
                <SiteRow site={site} />
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <div className="px-5 py-16 text-center font-mono text-xs uppercase tracking-widest text-text-muted">
            Aucun site
          </div>
        )}
      </div>
    </section>
  );
}

function SiteRow({ site }: { site: Site }) {
  const { openSite } = useSitePanel();
  const critical = site.status === 'offline';

  return (
    <button
      type="button"
      onClick={() => openSite(site.id)}
      className="group relative grid w-full grid-cols-[1fr_auto] items-center gap-4 px-5 py-3.5 text-left transition-colors duration-150 hover:bg-surface-hover md:grid-cols-[1.6fr_auto_5rem_4rem_5rem_6rem]"
    >
      {/* hover accent bar */}
      <span className="absolute left-0 top-0 h-full w-0.5 scale-y-0 bg-accent transition-transform duration-150 group-hover:scale-y-100" />

      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-text-primary">
          {site.name}
        </p>
        <p className="truncate font-mono text-[11px] text-text-muted">{site.url}</p>
      </div>

      <div className="md:justify-self-start">
        <StatusBadge status={site.status} />
      </div>

      <p className="hidden text-right md:block">
        <span className="tnum text-sm text-text-primary">
          {site.uptimePercentage}%
        </span>
      </p>

      <p className="hidden text-right md:block">
        <span
          className={`tnum text-sm ${
            site.openVulnerabilities > 0
              ? critical
                ? 'text-danger'
                : 'text-text-primary'
              : 'text-text-muted'
          }`}
        >
          {String(site.openVulnerabilities).padStart(2, '0')}
        </span>
      </p>

      <div className="hidden justify-self-end md:block">
        <Sparkline data={site.trend} color={TREND_COLOR[site.status]} width={64} height={20} />
      </div>

      <p className="hidden text-right font-mono text-[10px] uppercase tracking-wide text-text-muted md:block">
        {relativeTime(site.lastCheckedAt).replace('il y a ', '')}
      </p>
    </button>
  );
}
