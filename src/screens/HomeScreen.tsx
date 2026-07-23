import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  ShieldAlert,
  TriangleAlert,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { getGlobalAlerts, mockSites } from '../data/mockSites';
import { StatusBadge } from '../components/StatusBadge';
import { useSitePanel } from '../components/site-panel/SitePanelContext';
import { ALERT_SEVERITY_CONFIG, ALERT_TYPE_CONFIG } from '../lib/alerts';
import { relativeTime } from '../lib/time';

export function HomeScreen() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { openSite } = useSitePanel();

  const onlineCount = mockSites.filter((s) => s.status === 'online').length;
  const degradedCount = mockSites.filter((s) => s.status === 'degraded').length;
  const offlineCount = mockSites.filter((s) => s.status === 'offline').length;
  const totalVulnerabilities = mockSites.reduce(
    (sum, s) => sum + s.openVulnerabilities,
    0,
  );

  const attentionSites = mockSites
    .filter((s) => s.status !== 'online')
    .sort(
      (a, b) =>
        (a.status === 'offline' ? 0 : 1) - (b.status === 'offline' ? 0 : 1),
    );

  const recentAlerts = getGlobalAlerts()
    .filter((a) => a.severity !== 'info')
    .slice(0, 6);

  const stats = [
    { label: 'Sites en ligne', value: onlineCount, icon: CheckCircle2, color: 'text-success' },
    { label: 'Sites dégradés', value: degradedCount, icon: TriangleAlert, color: 'text-warning' },
    { label: 'Sites hors ligne', value: offlineCount, icon: XCircle, color: 'text-danger' },
    { label: 'Vulnérabilités', value: totalVulnerabilities, icon: ShieldAlert, color: 'text-accent' },
  ];

  const displayName = user?.email?.split('@')[0] ?? 'opérateur';

  return (
    <section className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">
          Bonjour, {displayName}
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          Voici l'état de vos {mockSites.length} sites supervisés.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="rounded-2xl border border-border bg-surface p-5"
            >
              <Icon size={20} strokeWidth={1.75} className={stat.color} />
              <p className="mt-3 text-2xl font-bold text-text-primary">
                {stat.value}
              </p>
              <p className="mt-1 text-sm text-text-secondary">{stat.label}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel
          title="Sites à surveiller"
          action={
            <button
              type="button"
              onClick={() => navigate('/sites')}
              className="flex items-center gap-1 text-xs font-medium text-accent transition-colors hover:text-accent-hover"
            >
              Tout voir <ArrowRight size={13} strokeWidth={2} />
            </button>
          }
        >
          {attentionSites.length === 0 ? (
            <EmptyRow label="Tous les sites sont en ligne 🎉" />
          ) : (
            attentionSites.map((site) => (
              <button
                key={site.id}
                type="button"
                onClick={() => openSite(site.id)}
                className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left transition-colors duration-150 hover:bg-surface-hover"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-text-primary">
                    {site.name}
                  </p>
                  <p className="truncate text-xs text-text-muted">{site.url}</p>
                </div>
                <StatusBadge status={site.status} />
              </button>
            ))
          )}
        </Panel>

        <Panel title="Activité récente">
          {recentAlerts.map((alert) => {
            const severity = ALERT_SEVERITY_CONFIG[alert.severity];
            const Icon = ALERT_TYPE_CONFIG[alert.type].icon;
            return (
              <button
                key={`${alert.site.id}-${alert.id}`}
                type="button"
                onClick={() => openSite(alert.site.id)}
                className="flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors duration-150 hover:bg-surface-hover"
              >
                <span
                  className={`mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg ${severity.bg} ${severity.text}`}
                >
                  <Icon size={14} strokeWidth={1.75} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium text-text-primary">
                      {alert.title}
                    </p>
                    <time className="flex-shrink-0 text-xs text-text-muted">
                      {relativeTime(alert.timestamp)}
                    </time>
                  </div>
                  <p className="truncate text-xs text-text-secondary">
                    {alert.site.name}
                  </p>
                </div>
              </button>
            );
          })}
        </Panel>
      </div>
    </section>
  );
}

function Panel({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
        {action}
      </div>
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  );
}

function EmptyRow({ label }: { label: string }) {
  return (
    <p className="px-3 py-6 text-center text-sm text-text-secondary">{label}</p>
  );
}
