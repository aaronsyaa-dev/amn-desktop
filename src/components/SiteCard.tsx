import React from 'react';
import { ShieldAlert } from 'lucide-react';
import type { Site, SiteStatus } from '../types/site';
import { StatusBadge } from './StatusBadge';
import { Sparkline } from './Sparkline';
import { relativeTime } from '../lib/time';
import { useSitePanel } from './site-panel/SitePanelContext';

const TREND_COLOR: Record<SiteStatus, string> = {
  online: 'var(--color-success)',
  degraded: 'var(--color-warning)',
  offline: 'var(--color-danger)',
};

export function SiteCard({ site }: { site: Site }) {
  const { openSite } = useSitePanel();

  return (
    <button
      type="button"
      onClick={() => openSite(site.id)}
      className="card-interactive group flex flex-col gap-4 rounded-2xl p-5 text-left"
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
            <p
              className={`mt-0.5 text-lg font-semibold ${
                site.openVulnerabilities > 0 ? 'text-warning' : 'text-text-primary'
              }`}
            >
              {site.openVulnerabilities}
            </p>
          </div>
        </div>
        <Sparkline data={site.trend} color={TREND_COLOR[site.status]} />
      </div>

      <div className="flex items-center gap-1.5 border-t border-border pt-3 text-xs text-text-muted">
        <HeartbeatDot status={site.status} />
        Vérifié {relativeTime(site.lastCheckedAt)}
      </div>
    </button>
  );
}

function HeartbeatDot({ status }: { status: SiteStatus }) {
  const color =
    status === 'online'
      ? 'bg-success'
      : status === 'degraded'
        ? 'bg-warning'
        : 'bg-danger';

  return (
    <span className="relative flex h-1.5 w-1.5">
      {status === 'online' && (
        <span
          className={`absolute inline-flex h-full w-full animate-ping rounded-full ${color} opacity-70`}
        />
      )}
      <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${color}`} />
    </span>
  );
}
