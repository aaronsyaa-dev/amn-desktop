import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lightbulb, Newspaper } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { mockSites } from '../data/mockSites';
import { getDailyBrief, getInsights } from '../assistant/engine';
import { buildActivityFeed, type FeedItem } from '../lib/activityFeed';
import { relativeTime } from '../lib/time';
import { Typewriter } from '../components/Typewriter';
import { AnimatedCounter } from '../components/AnimatedCounter';
import { StaggerGroup, StaggerItem } from '../components/Stagger';
import { useSitePanel } from '../components/site-panel/SitePanelContext';

export function HomeScreen() {
  const { user } = useAuth();
  const brief = useMemo(() => getDailyBrief(), []);
  const insights = useMemo(() => getInsights(), []);
  const feed = useMemo(() => buildActivityFeed(), []);

  const online = mockSites.filter((s) => s.status === 'online').length;
  const degraded = mockSites.filter((s) => s.status === 'degraded').length;
  const offline = mockSites.filter((s) => s.status === 'offline').length;
  const vulns = mockSites.reduce((n, s) => n + s.openVulnerabilities, 0);

  const displayName = user?.name ?? 'opérateur';
  const now = new Date();
  const dateLabel = now.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  });
  const timeLabel = now.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <StaggerGroup className="flex flex-col gap-6">
      {/* Header */}
      <StaggerItem>
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-text-primary">
              Bonjour, {displayName}
            </h1>
            <p className="mt-1 font-mono text-xs uppercase tracking-widest text-text-muted">
              {dateLabel} · {timeLabel}
            </p>
          </div>
          <div
            className={`hidden items-center gap-2 border px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest sm:flex ${
              offline > 0
                ? 'border-danger/40 bg-danger-muted text-danger'
                : 'border-border text-text-secondary'
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                offline > 0 ? 'animate-pulse bg-danger' : 'bg-success'
              }`}
            />
            {offline > 0 ? `${offline} site hors ligne` : 'Système nominal'}
          </div>
        </div>
      </StaggerItem>

      {/* Asymmetric top band: brief (wide) + system state (narrow) */}
      <StaggerItem>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <BriefHero brief={brief} date={dateLabel} className="lg:col-span-2" />
          <SystemState
            online={online}
            total={mockSites.length}
            degraded={degraded}
            offline={offline}
            vulns={vulns}
          />
        </div>
      </StaggerItem>

      {/* Main: activity log (wide) + side column */}
      <StaggerItem>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <ActivityLog feed={feed} />
          </div>
          <div className="flex flex-col gap-4">
            <InsightsPanel insights={insights} />
            <WeeklySummary />
          </div>
        </div>
      </StaggerItem>
    </StaggerGroup>
  );
}

function BriefHero({
  brief,
  date,
  className,
}: {
  brief: string;
  date: string;
  className?: string;
}) {
  return (
    <div
      className={`corner-cut relative border border-border-strong bg-surface p-6 ${className ?? ''}`}
    >
      <div className="mb-3 flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-text-secondary">
        <span className="text-text-primary">BRIEF</span>
        <span className="text-text-muted">// {date}</span>
      </div>
      <p className="text-[15px] leading-relaxed text-text-primary">
        <Typewriter text={brief} durationMs={1300} />
      </p>
    </div>
  );
}

function SystemState({
  online,
  total,
  degraded,
  offline,
  vulns,
}: {
  online: number;
  total: number;
  degraded: number;
  offline: number;
  vulns: number;
}) {
  const rows = [
    { label: 'Dégradés', value: degraded, danger: false },
    { label: 'Hors ligne', value: offline, danger: offline > 0 },
    { label: 'Vulnérabilités', value: vulns, danger: false },
  ];

  return (
    <div className="flex flex-col border border-border bg-surface">
      <div className="border-b border-border px-5 py-2.5 font-mono text-[11px] uppercase tracking-widest text-text-secondary">
        État système
      </div>
      <div className="flex items-baseline gap-2 px-5 pb-4 pt-5">
        <span className="tnum text-6xl font-bold leading-none text-text-primary">
          <AnimatedCounter value={online} />
        </span>
        <span className="tnum text-2xl font-medium leading-none text-text-muted">
          /{total}
        </span>
        <span className="ml-auto self-end font-mono text-[10px] uppercase tracking-widest text-text-muted">
          Opérationnels
        </span>
      </div>
      <div className="mt-auto">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between border-t border-border px-5 py-2.5"
          >
            <span className="font-mono text-[11px] uppercase tracking-wider text-text-secondary">
              {row.label}
            </span>
            <span
              className={`tnum text-sm font-semibold ${
                row.danger ? 'text-danger' : 'text-text-primary'
              }`}
            >
              {String(row.value).padStart(2, '0')}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------- Activity log ------------------------- */

const FEED_TAG: Record<FeedItem['kind'], string> = {
  alert: 'ALERTE',
  message: 'MSG',
  insight: 'INSIGHT',
  news: 'INTEL',
};

function ActivityLog({ feed }: { feed: FeedItem[] }) {
  const navigate = useNavigate();
  const { openSite } = useSitePanel();

  return (
    <div className="flex h-full flex-col border border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <h2 className="font-mono text-[11px] uppercase tracking-widest text-text-secondary">
          Fil d’activité
        </h2>
        <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-text-muted">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-text-secondary" />
          Live
        </span>
      </div>
      <div className="max-h-[560px] flex-1 divide-y divide-border/60 overflow-y-auto">
        {feed.map((item) => (
          <LogRow
            key={item.id}
            item={item}
            onOpenSite={openSite}
            onOpenTeam={() => navigate('/team')}
          />
        ))}
      </div>
    </div>
  );
}

function LogRow({
  item,
  onOpenSite,
  onOpenTeam,
}: {
  item: FeedItem;
  onOpenSite: (id: string) => void;
  onOpenTeam: () => void;
}) {
  const critical = item.kind === 'alert' && item.severity === 'critical';

  const { title, subtitle } = describe(item);
  const onClick = () => {
    if (item.kind === 'alert') onOpenSite(item.siteId);
    else if (item.kind === 'insight' && item.siteId) onOpenSite(item.siteId);
    else if (item.kind === 'message') onOpenTeam();
  };
  const clickable = item.kind !== 'news';

  return (
    <button
      type="button"
      onClick={clickable ? onClick : undefined}
      className={`flex w-full items-start gap-3 px-5 py-3 text-left transition-colors duration-150 ${
        clickable ? 'hover:bg-surface-hover' : 'cursor-default'
      }`}
    >
      <span className="w-16 flex-shrink-0 pt-0.5 font-mono text-[10px] uppercase tracking-wide text-text-muted">
        {relativeTime(item.timestamp).replace('il y a ', '')}
      </span>
      <span
        className={`mt-px flex-shrink-0 border px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider ${
          critical
            ? 'border-danger/40 bg-danger-muted text-danger'
            : 'border-border text-text-secondary'
        }`}
      >
        {FEED_TAG[item.kind]}
      </span>
      <div className="min-w-0 flex-1">
        <p
          className={`truncate text-sm font-medium ${
            critical ? 'text-danger' : 'text-text-primary'
          }`}
        >
          {title}
        </p>
        <p className="truncate text-xs text-text-secondary">{subtitle}</p>
      </div>
    </button>
  );
}

function describe(item: FeedItem): { title: string; subtitle: string } {
  switch (item.kind) {
    case 'alert':
      return { title: item.title, subtitle: `${item.siteName} · ${item.detail}` };
    case 'message':
      return { title: item.author, subtitle: item.body };
    case 'insight':
      return { title: item.title, subtitle: item.body };
    case 'news':
      return { title: item.title, subtitle: item.category };
  }
}

/* ------------------------- Side column ------------------------- */

function InsightsPanel({
  insights,
}: {
  insights: ReturnType<typeof getInsights>;
}) {
  const { openSite } = useSitePanel();

  return (
    <div className="border border-border bg-surface">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Lightbulb size={14} strokeWidth={1.75} className="text-text-secondary" />
        <h2 className="font-mono text-[11px] uppercase tracking-widest text-text-secondary">
          Insights
        </h2>
      </div>
      <div className="divide-y divide-border/60">
        {insights.map((insight) => {
          const clickable = Boolean(insight.siteId);
          return (
            <button
              key={insight.id}
              type="button"
              disabled={!clickable}
              onClick={
                clickable ? () => openSite(insight.siteId as string) : undefined
              }
              className={`block w-full p-4 text-left ${
                clickable ? 'transition-colors hover:bg-surface-hover' : 'cursor-default'
              }`}
            >
              <p className="text-sm font-medium text-text-primary">
                {insight.title}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-text-secondary">
                {insight.body}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function WeeklySummary() {
  const blocked = mockSites.reduce(
    (n, s) => n + s.alerts.filter((a) => a.severity !== 'info').length,
    0,
  );
  const avgUptime =
    mockSites.reduce((n, s) => n + s.uptimePercentage, 0) / mockSites.length;
  const activeVisitors = mockSites.reduce(
    (n, s) => n + s.analytics.activeVisitors,
    0,
  );

  const figures = [
    { label: 'Incidents', value: String(blocked).padStart(2, '0') },
    { label: 'Dispo. moy.', value: `${avgUptime.toFixed(1)}%` },
    { label: 'Visiteurs', value: activeVisitors.toLocaleString('fr-FR') },
  ];

  return (
    <div className="border border-border bg-surface">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Newspaper size={14} strokeWidth={1.75} className="text-text-secondary" />
        <h2 className="font-mono text-[11px] uppercase tracking-widest text-text-secondary">
          Cette semaine
        </h2>
      </div>
      <div className="grid grid-cols-3 divide-x divide-border/60">
        {figures.map((f) => (
          <div key={f.label} className="px-3 py-4 text-center">
            <p className="tnum text-xl font-bold text-text-primary">{f.value}</p>
            <p className="mt-1 font-mono text-[9px] uppercase tracking-wider text-text-muted">
              {f.label}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
