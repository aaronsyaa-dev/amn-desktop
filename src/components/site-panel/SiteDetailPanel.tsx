import React, { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Ban,
  ShieldOff,
  TrendingDown,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import { getSiteById } from '../../data/mockSites';
import type { Alert, Site } from '../../types/site';
import { StatusBadge } from '../StatusBadge';
import { AreaChart } from '../AreaChart';
import { ALERT_SEVERITY_CONFIG, ALERT_TYPE_CONFIG } from '../../lib/alerts';
import { compactEuro, euro, relativeTime } from '../../lib/time';
import { useSitePanel } from './SitePanelContext';
import { ActionButton } from './ActionButton';

const STATUS_ACCENT: Record<Site['status'], string> = {
  online: 'var(--color-success)',
  degraded: 'var(--color-warning)',
  offline: 'var(--color-danger)',
};

const PANEL_SPRING = { type: 'spring' as const, stiffness: 360, damping: 34 };

export function SiteDetailPanel() {
  const { activeSiteId, close } = useSitePanel();
  const site = activeSiteId ? getSiteById(activeSiteId) : undefined;

  useEffect(() => {
    if (!site) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [site, close]);

  return (
    <AnimatePresence>
      {site && (
        <div className="fixed inset-0 z-50">
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={close}
            className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
          />
          <motion.aside
            key="panel"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={PANEL_SPRING}
            className="absolute right-0 top-0 flex h-full w-full max-w-[540px] flex-col border-l border-border bg-bg shadow-[-24px_0_60px_rgba(0,0,0,0.5)]"
          >
            <PanelHeader site={site} onClose={close} />
            <div className="flex-1 overflow-y-auto px-6 py-6">
              <AnalyticsSection site={site} />
              <SecuritySection alerts={site.alerts} />
              <ActionsSection />
            </div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}

function PanelHeader({ site, onClose }: { site: Site; onClose: () => void }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
      <div className="min-w-0">
        <div className="flex items-center gap-2.5">
          <h2 className="truncate text-lg font-semibold text-text-primary">
            {site.name}
          </h2>
          <StatusBadge status={site.status} />
        </div>
        <a
          className="mt-1 block truncate text-sm text-text-secondary transition-colors hover:text-accent"
          href={site.url}
        >
          {site.url}
        </a>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Fermer le panneau"
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-text-secondary transition-colors duration-200 hover:bg-surface-hover hover:text-text-primary"
      >
        <X size={18} strokeWidth={2} />
      </button>
    </div>
  );
}

function SectionTitle({
  children,
  aside,
}: {
  children: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
        {children}
      </h3>
      {aside}
    </div>
  );
}

function AnalyticsSection({ site }: { site: Site }) {
  const { analytics } = site;
  const revenueUp = analytics.revenueTrendPct >= 0;
  const TrendIcon = revenueUp ? TrendingUp : TrendingDown;

  return (
    <section className="mb-8">
      <SectionTitle>Analytics</SectionTitle>

      <div className="grid grid-cols-3 gap-3">
        <StatTile
          label="Visiteurs actifs"
          value={analytics.activeVisitors.toLocaleString('fr-FR')}
          accent={
            site.status !== 'offline' && analytics.activeVisitors > 0 ? (
              <LivePulse />
            ) : undefined
          }
        />
        <StatTile
          label="CA aujourd'hui"
          value={compactEuro(analytics.revenueToday)}
        />
        <StatTile label="Disponibilité" value={`${site.uptimePercentage}%`} />
      </div>

      <div className="mt-4 rounded-xl border border-border bg-surface p-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-text-secondary">
            <Users size={14} strokeWidth={1.75} />
            Visiteurs · 7 jours
          </div>
          <div
            className={`flex items-center gap-1 text-xs font-medium ${
              revenueUp ? 'text-success' : 'text-danger'
            }`}
          >
            <TrendIcon size={13} strokeWidth={2} />
            {revenueUp ? '+' : ''}
            {analytics.revenueTrendPct}%
          </div>
        </div>
        <AreaChart
          data={analytics.visitors7d}
          color={STATUS_ACCENT[site.status]}
          height={64}
        />
        <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-sm">
          <span className="text-text-secondary">CA du mois</span>
          <span className="font-semibold text-text-primary">
            {euro(analytics.revenueMonth)}
          </span>
        </div>
      </div>
    </section>
  );
}

function StatTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <div className="flex items-center gap-1.5">
        {accent}
        <p className="text-lg font-semibold text-text-primary">{value}</p>
      </div>
      <p className="mt-0.5 text-xs text-text-secondary">{label}</p>
    </div>
  );
}

function LivePulse() {
  return (
    <span className="relative flex h-2 w-2">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
    </span>
  );
}

function SecuritySection({ alerts }: { alerts: Alert[] }) {
  return (
    <section className="mb-8">
      <SectionTitle
        aside={
          <span className="text-xs text-text-muted">{alerts.length} événements</span>
        }
      >
        Sécurité
      </SectionTitle>
      <ol className="relative">
        {alerts.map((alert, index) => (
          <TimelineItem
            key={alert.id}
            alert={alert}
            isLast={index === alerts.length - 1}
          />
        ))}
      </ol>
    </section>
  );
}

function TimelineItem({ alert, isLast }: { alert: Alert; isLast: boolean }) {
  const typeConfig = ALERT_TYPE_CONFIG[alert.type];
  const severity = ALERT_SEVERITY_CONFIG[alert.severity];
  const Icon = typeConfig.icon;

  return (
    <li className="relative flex gap-3.5 pb-5 last:pb-0">
      {!isLast && (
        <span className="absolute left-[15px] top-8 bottom-0 w-px bg-border" />
      )}
      <span
        className={`relative z-10 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ring-1 ${severity.bg} ${severity.text} ${severity.ring}`}
      >
        <Icon size={15} strokeWidth={1.75} />
      </span>
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-medium text-text-primary">
            {alert.title}
          </p>
          <time className="flex-shrink-0 text-xs text-text-muted">
            {relativeTime(alert.timestamp)}
          </time>
        </div>
        <p className="mt-0.5 text-sm text-text-secondary">{alert.detail}</p>
      </div>
    </li>
  );
}

function ActionsSection() {
  return (
    <section>
      <SectionTitle>Actions</SectionTitle>
      <div className="flex flex-col gap-2.5">
        <ActionButton
          icon={Ban}
          label="Bloquer les paiements"
          activeLabel="Paiements bloqués"
        />
        <ActionButton
          icon={ShieldOff}
          label="Bloquer une connexion"
          activeLabel="Connexion bloquée"
        />
      </div>
    </section>
  );
}
