import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  CheckCircle2,
  Contact,
  Download,
  Flame,
  Globe,
  Lightbulb,
  MessageSquare,
  Newspaper,
  Plus,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useRemoteSites } from '../state/RemoteSitesContext';
import { useProfiles } from '../state/ProfilesContext';
import { useMessages } from '../state/useMessages';
import { useTrackers } from '../state/useTrackers';
import { bridge } from '../lib/bridge';
import { getDailyBrief, getInsights } from '../assistant/engine';
import type { WatchItem } from '../shared/api';
import { buildActivityFeed, type FeedItem } from '../lib/activityFeed';
import { countRecentAlerts } from '../lib/eventStats';
import { relativeTime } from '../lib/time';
import { useStreak } from '../lib/useStreak';
import { Typewriter } from '../components/Typewriter';
import { AnimatedCounter } from '../components/AnimatedCounter';
import { StaggerGroup, StaggerItem } from '../components/Stagger';
import { ChecklistWidget } from '../components/ChecklistWidget';
import { ObjectivesWidget } from '../components/ObjectivesWidget';
import { useSitePanel } from '../components/site-panel/SitePanelContext';
import { useAssistant } from '../assistant/AssistantContext';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** Time-aware greeting for a bit of personality. */
function greeting(hour: number): string {
  if (hour < 5) return 'Encore debout';
  if (hour < 12) return 'Bonjour';
  if (hour < 18) return 'Bon après-midi';
  return 'Bonsoir';
}

export function HomeScreen() {
  const { user } = useAuth();
  const { sites, eventsBySite, ensureEventsLoaded } = useRemoteSites();
  const { profileFor } = useProfiles();
  const { messages } = useMessages();
  const { totalInstalled } = useTrackers();
  const streak = useStreak();

  useEffect(() => {
    for (const site of sites) ensureEventsLoaded(site.id);
  }, [sites, ensureEventsLoaded]);

  const feedMessages = useMemo(
    () =>
      messages.map((m) => ({
        id: m.id,
        createdAt: m.createdAt,
        author: profileFor(m.authorEmail).name,
        body: m.body,
      })),
    [messages, profileFor],
  );

  const brief = useMemo(() => getDailyBrief(sites, eventsBySite), [sites, eventsBySite]);
  const insights = useMemo(() => getInsights(sites, eventsBySite), [sites, eventsBySite]);
  const [watchItems, setWatchItems] = useState<WatchItem[]>([]);
  useEffect(() => {
    let active = true;
    bridge()
      .watch.list()
      .then((r) => active && setWatchItems(r.items.slice(0, 6)))
      .catch(() => {
        /* feed still renders without watch entries */
      });
    return () => {
      active = false;
    };
  }, []);
  const feed = useMemo(
    () => buildActivityFeed({ sites, eventsBySite, insights, watchItems, messages: feedMessages }),
    [sites, eventsBySite, insights, watchItems, feedMessages],
  );

  const online = sites.filter((s) => s.status === 'online').length;
  const degraded = sites.filter((s) => s.status === 'degraded').length;
  const offline = sites.filter((s) => s.status === 'offline').length;
  const totalAlerts = sites.reduce(
    (n, s) => n + (eventsBySite[s.id]?.filter((e) => e.type === 'security_alert').length ?? 0),
    0,
  );

  const displayName = user?.name ?? 'opérateur';
  // Live clock: ticks every 30s so the header time (and greeting) stay current.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  const dateLabel = now.toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long' });
  const timeLabel = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  // Onboarding progress: the workspace is "live" once a site is registered AND
  // a tracker is installed. Until then we show the energetic getting-started hero.
  const hasPhoto = Boolean(user && profileFor(user.email).photoDataUrl);
  const steps = [
    { done: sites.length > 0, label: 'Enregistrer votre premier site', to: '/sites', icon: Globe },
    { done: totalInstalled > 0, label: 'Installer un tracker de supervision', to: '/tracker', icon: Download },
    { done: hasPhoto, label: 'Personnaliser votre profil', to: '/settings', icon: Contact },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const showOnboarding = sites.length === 0 || totalInstalled === 0;

  return (
    <StaggerGroup className="flex flex-col gap-6">
      {/* Header — livelier greeting + momentum */}
      <StaggerItem>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <motion.h1
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="text-4xl font-bold tracking-tight text-text-primary"
            >
              {greeting(now.getHours())}, {displayName}
            </motion.h1>
            <p className="mt-1.5 flex items-center gap-2.5 font-mono text-xs uppercase tracking-widest text-text-muted">
              <span>{dateLabel} · {timeLabel}</span>
              {streak.count > 1 && (
                <span className="flex items-center gap-1 text-text-secondary" title={`Meilleure série : ${streak.best} jours`}>
                  <Flame size={12} strokeWidth={2} className="text-warning" />
                  {streak.count} jours d’affilée
                </span>
              )}
            </p>
          </div>
          <StatusPill offline={offline} online={online} total={sites.length} />
        </div>
      </StaggerItem>

      {/* Onboarding hero (empty/early workspace) */}
      {showOnboarding && (
        <StaggerItem>
          <Onboarding steps={steps} doneCount={doneCount} name={displayName} />
        </StaggerItem>
      )}

      {/* Quick actions */}
      <StaggerItem>
        <QuickActions />
      </StaggerItem>

      {/* Asymmetric top band: brief (wide) + system state (narrow) */}
      <StaggerItem>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <BriefHero brief={brief} date={dateLabel} className="lg:col-span-2" />
          <SystemState online={online} total={sites.length} degraded={degraded} offline={offline} alerts={totalAlerts} />
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
            <WeeklySummary sites={sites} eventsBySite={eventsBySite} />
          </div>
        </div>
      </StaggerItem>

      {/* Bottom band: recurring checks (wide) + monthly objectives (narrow) */}
      <StaggerItem>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <ChecklistWidget />
          </div>
          <ObjectivesWidget />
        </div>
      </StaggerItem>
    </StaggerGroup>
  );
}

function StatusPill({ offline, online, total }: { offline: number; online: number; total: number }) {
  const critical = offline > 0;
  const label = critical ? `${offline} site${offline > 1 ? 's' : ''} hors ligne` : total > 0 ? 'Système nominal' : 'En attente de données';
  return (
    <div
      className={`hidden items-center gap-2 border px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest sm:flex ${
        critical ? 'border-danger/40 bg-danger-muted text-danger' : 'border-border text-text-secondary'
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${critical ? 'animate-pulse bg-danger' : total > 0 ? 'bg-success' : 'bg-text-muted'}`} />
      {label}
      {total > 0 && !critical && <span className="text-text-muted">· {online}/{total}</span>}
    </div>
  );
}

/* --------------------------- Onboarding hero --------------------------- */

function Onboarding({
  steps,
  doneCount,
  name,
}: {
  steps: { done: boolean; label: string; to: string; icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }> }[];
  doneCount: number;
  name: string;
}) {
  const navigate = useNavigate();
  const pct = Math.round((doneCount / steps.length) * 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="corner-cut relative overflow-hidden border border-border-strong bg-surface p-6"
    >
      {/* subtle moving highlight for life */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        initial={{ backgroundPosition: '0% 50%' }}
        animate={{ backgroundPosition: '100% 50%' }}
        transition={{ duration: 8, repeat: Infinity, repeatType: 'reverse', ease: 'linear' }}
        style={{
          background: 'radial-gradient(50% 60% at 20% 0%, rgba(255,255,255,0.05), transparent 70%)',
          backgroundSize: '200% 200%',
        }}
      />
      <div className="relative">
        <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-text-secondary">
          <Sparkles size={13} strokeWidth={2} className="text-text-primary" />
          Prise en main
        </div>
        <h2 className="mt-2 text-2xl font-bold tracking-tight text-text-primary">
          {doneCount === steps.length ? `Tout est prêt, ${name}.` : `Mettons votre poste de commandement en route.`}
        </h2>
        <p className="mt-1 text-sm text-text-secondary">
          {doneCount}/{steps.length} étapes · quelques minutes pour superviser votre premier site.
        </p>

        {/* progress bar */}
        <div className="mt-4 h-1.5 w-full max-w-md overflow-hidden rounded-full bg-white/[0.06]">
          <motion.div
            className="h-full bg-accent"
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          />
        </div>

        <div className="mt-5 grid gap-2.5 sm:grid-cols-3">
          {steps.map((step, i) => (
            <motion.button
              key={step.label}
              type="button"
              onClick={() => navigate(step.to)}
              whileHover={{ y: -2 }}
              className={`group flex flex-col gap-2 rounded-xl border p-3.5 text-left transition-colors ${
                step.done ? 'border-border bg-bg/50' : 'border-border-strong bg-bg hover:border-accent'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface text-text-secondary">
                  <step.icon size={15} strokeWidth={1.75} />
                </span>
                {step.done ? (
                  <CheckCircle2 size={16} className="text-success" />
                ) : (
                  <span className="font-mono text-[10px] text-text-muted">{i + 1}</span>
                )}
              </div>
              <span className={`text-sm font-medium ${step.done ? 'text-text-muted line-through' : 'text-text-primary'}`}>
                {step.label}
              </span>
              {!step.done && (
                <span className="flex items-center gap-1 text-xs text-text-muted transition-colors group-hover:text-text-primary">
                  Commencer <ArrowRight size={12} className="transition-transform group-hover:translate-x-0.5" />
                </span>
              )}
            </motion.button>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

/* --------------------------- Quick actions --------------------------- */

function QuickActions() {
  const navigate = useNavigate();
  const { open: openAssistant } = useAssistant();

  const actions = [
    { label: 'Nouveau site', icon: Globe, onClick: () => navigate('/sites') },
    { label: 'Installer un tracker', icon: Download, onClick: () => navigate('/tracker') },
    { label: 'Nouvelle tâche', icon: Plus, onClick: () => navigate('/tasks') },
    { label: 'Message équipe', icon: MessageSquare, onClick: () => navigate('/team') },
    { label: 'Assistant', icon: Sparkles, onClick: () => openAssistant() },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((a) => (
        <motion.button
          key={a.label}
          type="button"
          onClick={a.onClick}
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.97 }}
          className="flex items-center gap-2 border border-border bg-surface px-3.5 py-2 text-sm text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
        >
          <a.icon size={15} strokeWidth={1.75} />
          {a.label}
        </motion.button>
      ))}
    </div>
  );
}

function BriefHero({ brief, date, className }: { brief: string; date: string; className?: string }) {
  return (
    <div className={`corner-cut relative border border-border-strong bg-surface p-6 ${className ?? ''}`}>
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
  alerts,
}: {
  online: number;
  total: number;
  degraded: number;
  offline: number;
  alerts: number;
}) {
  const rows = [
    { label: 'Dégradés', value: degraded, danger: false },
    { label: 'Hors ligne', value: offline, danger: offline > 0 },
    { label: 'Alertes', value: alerts, danger: false },
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
        <span className="tnum text-2xl font-medium leading-none text-text-muted">/{total}</span>
        <span className="ml-auto self-end font-mono text-[10px] uppercase tracking-widest text-text-muted">
          Opérationnels
        </span>
      </div>
      <div className="mt-auto">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between border-t border-border px-5 py-2.5">
            <span className="font-mono text-[11px] uppercase tracking-wider text-text-secondary">{row.label}</span>
            <span className={`tnum text-sm font-semibold ${row.danger ? 'text-danger' : 'text-text-primary'}`}>
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
        <h2 className="font-mono text-[11px] uppercase tracking-widest text-text-secondary">Fil d’activité</h2>
        <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-text-muted">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-text-secondary" />
          Live
        </span>
      </div>
      {feed.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-5 py-16 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-bg">
            <Globe size={18} strokeWidth={1.5} className="text-text-muted" />
          </span>
          <p className="max-w-xs text-sm text-text-secondary">
            Le fil s’animera dès votre premier site supervisé — alertes, messages et veille cyber en direct.
          </p>
          <button
            type="button"
            onClick={() => navigate('/sites')}
            className="flex items-center gap-1.5 bg-accent px-3 py-1.5 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover"
          >
            <Plus size={14} strokeWidth={2.25} /> Enregistrer un site
          </button>
        </div>
      ) : (
        <div className="max-h-[560px] flex-1 divide-y divide-border/60 overflow-y-auto">
          {feed.map((item) => (
            <LogRow key={item.id} item={item} onOpenSite={openSite} onOpenTeam={() => navigate('/team')} />
          ))}
        </div>
      )}
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
          critical ? 'border-danger/40 bg-danger-muted text-danger' : 'border-border text-text-secondary'
        }`}
      >
        {FEED_TAG[item.kind]}
      </span>
      <div className="min-w-0 flex-1">
        <p className={`truncate text-sm font-medium ${critical ? 'text-danger' : 'text-text-primary'}`}>{title}</p>
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

function InsightsPanel({ insights }: { insights: ReturnType<typeof getInsights> }) {
  const { openSite } = useSitePanel();

  return (
    <div className="border border-border bg-surface">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Lightbulb size={14} strokeWidth={1.75} className="text-text-secondary" />
        <h2 className="font-mono text-[11px] uppercase tracking-widest text-text-secondary">Insights</h2>
      </div>
      {insights.length === 0 ? (
        <p className="p-4 text-sm text-text-secondary">
          Les insights apparaîtront ici dès que vos sites remonteront des données — tendances, anomalies et recommandations.
        </p>
      ) : (
        <div className="divide-y divide-border/60">
          {insights.map((insight) => {
            const clickable = Boolean(insight.siteId);
            return (
              <button
                key={insight.id}
                type="button"
                disabled={!clickable}
                onClick={clickable ? () => openSite(insight.siteId as string) : undefined}
                className={`block w-full p-4 text-left ${clickable ? 'transition-colors hover:bg-surface-hover' : 'cursor-default'}`}
              >
                <p className="text-sm font-medium text-text-primary">{insight.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-text-secondary">{insight.body}</p>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function WeeklySummary({
  sites,
  eventsBySite,
}: {
  sites: ReturnType<typeof useRemoteSites>['sites'];
  eventsBySite: ReturnType<typeof useRemoteSites>['eventsBySite'];
}) {
  const alerts7d = sites.reduce((n, s) => n + countRecentAlerts(eventsBySite[s.id] ?? [], WEEK_MS), 0);
  const activeVisitors = sites.reduce((n, s) => n + (s.state?.activeVisitors ?? 0), 0);
  const activeSites = sites.filter((s) => s.status !== 'unknown').length;

  const figures = [
    { label: 'Alertes 7j', value: String(alerts7d).padStart(2, '0') },
    { label: 'Sites actifs', value: `${activeSites}/${sites.length}` },
    { label: 'Visiteurs', value: activeVisitors.toLocaleString('fr-FR') },
  ];

  return (
    <div className="border border-border bg-surface">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Newspaper size={14} strokeWidth={1.75} className="text-text-secondary" />
        <h2 className="font-mono text-[11px] uppercase tracking-widest text-text-secondary">Cette semaine</h2>
      </div>
      <div className="grid grid-cols-3 divide-x divide-border/60">
        {figures.map((f) => (
          <div key={f.label} className="px-3 py-4 text-center">
            <p className="tnum text-xl font-bold text-text-primary">{f.value}</p>
            <p className="mt-1 font-mono text-[9px] uppercase tracking-wider text-text-muted">{f.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
