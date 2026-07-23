import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { mockSites } from '../data/mockSites';
import { StatusBadge } from '../components/StatusBadge';
import { Sparkline } from '../components/Sparkline';
import type { SiteStatus } from '../types/site';

const TREND_COLOR: Record<SiteStatus, string> = {
  online: 'var(--color-success)',
  degraded: 'var(--color-warning)',
  offline: 'var(--color-danger)',
};

export function SitesDashboardScreen() {
  return (
    <section className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Sites surveillés</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Statut, disponibilité et vulnérabilités des sites que vous supervisez.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {mockSites.map((site) => (
          <Link
            key={site.id}
            to={`/sites/${site.id}`}
            className="group flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-border hover:shadow-[0_12px_24px_rgba(0,0,0,0.35)]"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h2 className="truncate text-base font-semibold text-text-primary">
                  {site.name}
                </h2>
                <p className="truncate text-xs text-text-muted">{site.url}</p>
              </div>
              <StatusBadge status={site.status} />
            </div>

            <div className="flex items-end justify-between gap-2">
              <div className="flex gap-6">
                <div>
                  <p className="text-xs text-text-secondary">Disponibilité</p>
                  <p className="mt-0.5 text-lg font-semibold text-text-primary">
                    {site.uptimePercentage}%
                  </p>
                </div>
                <div>
                  <p className="flex items-center gap-1 text-xs text-text-secondary">
                    <ShieldAlert size={12} strokeWidth={1.75} />
                    Vulnérabilités
                  </p>
                  <p className="mt-0.5 text-lg font-semibold text-text-primary">
                    {site.openVulnerabilities}
                  </p>
                </div>
              </div>
              <Sparkline data={site.trend} color={TREND_COLOR[site.status]} />
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
