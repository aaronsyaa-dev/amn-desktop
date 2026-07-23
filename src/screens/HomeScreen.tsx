import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  CheckCircle2,
  Lightbulb,
  MessageSquare,
  Newspaper,
  Send,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  TriangleAlert,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { mockSites } from '../data/mockSites';
import { getDailyBrief, getInsights } from '../assistant/engine';
import { buildActivityFeed, type FeedItem } from '../lib/activityFeed';
import { relativeTime } from '../lib/time';
import { Typewriter } from '../components/Typewriter';
import { AnimatedCounter } from '../components/AnimatedCounter';
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

  const stats = [
    { label: 'Sites en ligne', value: online, icon: CheckCircle2, color: 'text-success' },
    { label: 'Sites dégradés', value: degraded, icon: TriangleAlert, color: 'text-warning' },
    { label: 'Sites hors ligne', value: offline, icon: XCircle, color: 'text-danger' },
    { label: 'Vulnérabilités', value: vulns, icon: ShieldAlert, color: 'text-accent' },
  ];

  const displayName = user?.name ?? 'opérateur';

  return (
    <section className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">
          Bonjour, {displayName}
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          Votre quartier général du jour.
        </p>
      </div>

      <BriefCard brief={brief} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="rounded-2xl border border-border bg-surface p-5">
              <Icon size={20} strokeWidth={1.75} className={stat.color} />
              <p className="mt-3 text-2xl font-bold text-text-primary">
                <AnimatedCounter value={stat.value} />
              </p>
              <p className="mt-1 text-sm text-text-secondary">{stat.label}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ActivityFeed feed={feed} />
        </div>
        <div className="flex flex-col gap-4">
          <InsightsPanel insights={insights} />
          <WeeklySummary />
        </div>
      </div>
    </section>
  );
}

function BriefCard({ brief }: { brief: string }) {
  const today = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <div className="relative overflow-hidden rounded-2xl border border-accent/25 bg-surface p-5">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(120% 100% at 0% 0%, rgba(124,92,255,0.10), transparent 55%)',
        }}
      />
      <div className="relative">
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-accent">
          <Sparkles size={14} strokeWidth={2} />
          Brief du jour
          <span className="font-normal capitalize text-text-muted">· {today}</span>
        </div>
        <p className="text-[15px] leading-relaxed text-text-primary">
          <Typewriter text={brief} durationMs={1300} />
        </p>
      </div>
    </div>
  );
}

const feedVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' as const } },
};

function ActivityFeed({ feed }: { feed: FeedItem[] }) {
  const navigate = useNavigate();
  const { openSite } = useSitePanel();

  return (
    <div className="flex h-full flex-col rounded-2xl border border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
        <h2 className="text-sm font-semibold text-text-primary">Fil d’activité</h2>
        <span className="text-xs text-text-muted">Temps réel</span>
      </div>
      <motion.div
        variants={feedVariants}
        initial="hidden"
        animate="show"
        className="max-h-[560px] flex-1 space-y-1 overflow-y-auto p-2"
      >
        {feed.map((item) => (
          <motion.div key={item.id} variants={itemVariants}>
            <FeedRow
              item={item}
              onOpenSite={openSite}
              onOpenTeam={() => navigate('/team')}
            />
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}

const SEVERITY_COLOR = {
  critical: 'bg-danger-muted text-danger',
  warning: 'bg-warning-muted text-warning',
  info: 'bg-white/5 text-text-secondary',
};

function FeedRow({
  item,
  onOpenSite,
  onOpenTeam,
}: {
  item: FeedItem;
  onOpenSite: (id: string) => void;
  onOpenTeam: () => void;
}) {
  const shared =
    'flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors duration-150 hover:bg-surface-hover';

  if (item.kind === 'alert') {
    return (
      <button type="button" className={shared} onClick={() => onOpenSite(item.siteId)}>
        <FeedIcon className={SEVERITY_COLOR[item.severity]}>
          <ShieldAlert size={15} strokeWidth={1.75} />
        </FeedIcon>
        <FeedText
          title={item.title}
          subtitle={`${item.siteName} · ${item.detail}`}
          timestamp={item.timestamp}
        />
      </button>
    );
  }

  if (item.kind === 'message') {
    return (
      <button type="button" className={shared} onClick={onOpenTeam}>
        <FeedIcon className="bg-accent-muted text-accent">
          <MessageSquare size={15} strokeWidth={1.75} />
        </FeedIcon>
        <FeedText title={`${item.author}`} subtitle={item.body} timestamp={item.timestamp} />
      </button>
    );
  }

  if (item.kind === 'insight') {
    const clickable = Boolean(item.siteId);
    const Tag = clickable ? 'button' : 'div';
    return (
      <Tag
        type={clickable ? 'button' : undefined}
        className={shared}
        onClick={clickable ? () => onOpenSite(item.siteId as string) : undefined}
      >
        <FeedIcon className="bg-success-muted text-success">
          {item.tone === 'positive' ? (
            <TrendingUp size={15} strokeWidth={1.75} />
          ) : (
            <Lightbulb size={15} strokeWidth={1.75} />
          )}
        </FeedIcon>
        <FeedText title={item.title} subtitle={item.body} timestamp={item.timestamp} />
      </Tag>
    );
  }

  // news
  return (
    <div className={shared}>
      <FeedIcon className="bg-white/5 text-text-secondary">
        <Newspaper size={15} strokeWidth={1.75} />
      </FeedIcon>
      <FeedText title={item.title} subtitle={item.category} timestamp={item.timestamp} />
    </div>
  );
}

function FeedIcon({
  className,
  children,
}: {
  className: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg ${className}`}
    >
      {children}
    </span>
  );
}

function FeedText({
  title,
  subtitle,
  timestamp,
}: {
  title: string;
  subtitle: string;
  timestamp: string;
}) {
  return (
    <div className="min-w-0 flex-1">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-sm font-medium text-text-primary">{title}</p>
        <time className="flex-shrink-0 text-xs text-text-muted">
          {relativeTime(timestamp)}
        </time>
      </div>
      <p className="truncate text-xs text-text-secondary">{subtitle}</p>
    </div>
  );
}

function InsightsPanel({
  insights,
}: {
  insights: ReturnType<typeof getInsights>;
}) {
  const { openSite } = useSitePanel();

  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="mb-2 flex items-center gap-2 px-1">
        <Lightbulb size={15} strokeWidth={1.75} className="text-accent" />
        <h2 className="text-sm font-semibold text-text-primary">Insights</h2>
      </div>
      <div className="flex flex-col gap-2">
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
              className={`rounded-xl border border-border bg-bg p-3 text-left ${
                clickable ? 'transition-colors hover:border-white/15' : 'cursor-default'
              }`}
            >
              <p className="text-sm font-medium text-text-primary">{insight.title}</p>
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
    { label: 'Incidents traités', value: blocked },
    { label: 'Dispo. moyenne', value: `${avgUptime.toFixed(1)} %` },
    { label: 'Visiteurs actifs', value: activeVisitors.toLocaleString('fr-FR') },
  ];

  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="mb-3 flex items-center gap-2 px-1">
        <Send size={14} strokeWidth={1.75} className="text-text-secondary" />
        <h2 className="text-sm font-semibold text-text-primary">Cette semaine</h2>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {figures.map((f) => (
          <div key={f.label} className="rounded-xl border border-border bg-bg p-3 text-center">
            <p className="text-lg font-semibold text-text-primary">{f.value}</p>
            <p className="mt-0.5 text-[11px] leading-tight text-text-secondary">
              {f.label}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
