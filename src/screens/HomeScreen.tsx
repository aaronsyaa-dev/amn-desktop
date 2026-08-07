import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  BookOpen,
  CheckSquare,
  Contact,
  Globe,
  NotebookPen,
  Radar,
  Scale,
  Sparkles,
  Users,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useRemoteSites } from '../state/RemoteSitesContext';
import { useAssistant } from '../assistant/AssistantContext';
import { useActivity } from '../state/ActivityContext';
import { useProfiles } from '../state/ProfilesContext';
import { useSitePins } from '../lib/useSitePins';
import { useSitePanel } from '../components/site-panel/SitePanelContext';
import { StatusBadge } from '../components/StatusBadge';
import { VeilleTicker } from '../components/VeilleTicker';
import { homeWelcome, homeNudge } from '../lib/homeGreetings';
import { relativeTime } from '../lib/time';

/**
 * Calm home. Intentionally sparse: a short, warm welcome and a clear "where to
 * start" grid — no dense stats, activity feed or insights (those live in their
 * own tabs). Soft, staggered entrance for a settled feeling on open.
 */
export function HomeScreen() {
  const { user } = useAuth();
  const { sites } = useRemoteSites();
  const { open: openAssistant } = useAssistant();
  const { isPinned } = useSitePins();
  const { openSite } = useSitePanel();
  const { events } = useActivity();
  const { profileFor } = useProfiles();
  const navigate = useNavigate();

  // A3.2 — chronological feed of what the other operator recently added or
  // changed across the shared collections. Capped to keep Accueil calm.
  const recentActivity = useMemo(() => events.slice(0, 6), [events]);

  // Personal fast lane: the sites this operator chose to follow (favoris).
  const pinnedSites = useMemo(() => sites.filter((s) => isPinned(s.id)), [sites, isPinned]);

  const displayName = user?.name?.split(' ')[0] ?? 'opérateur';
  const nudge = useMemo(() => homeNudge(), []);

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  // Varies by time of day + a per-launch pick. Recomputed from the ticking
  // clock so it stays coherent with the real hour even if the app is left open
  // across a slot boundary (e.g. midnight); the pick is stable within a slot.
  const welcome = homeWelcome(displayName, now);
  const dateLabel = now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

  const offline = sites.filter((s) => s.status === 'offline').length;

  const destinations = [
    { key: 'sites', label: 'Sites', hint: 'Parc supervisé', icon: Globe, to: () => navigate('/sites') },
    { key: 'tasks', label: 'Tâches', hint: 'Qui fait quoi', icon: CheckSquare, to: () => navigate('/tasks') },
    { key: 'clients', label: 'Clients', hint: 'Fiches & relation', icon: Contact, to: () => navigate('/clients') },
    { key: 'team', label: 'Équipe', hint: 'Messagerie', icon: Users, to: () => navigate('/team') },
    { key: 'assistant', label: 'Ajmani', hint: 'Assistant IA', icon: Sparkles, to: () => openAssistant() },
    { key: 'tracker', label: 'Trackers', hint: 'Supervision', icon: Radar, to: () => navigate('/tracker') },
  ];

  const secondary = [
    { label: 'Notes', icon: NotebookPen, to: '/notes' },
    { label: 'Décisions', icon: Scale, to: '/decisions' },
    { label: 'Connaissances', icon: BookOpen, to: '/knowledge' },
  ];

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-10rem)] max-w-3xl flex-col justify-center py-10">
      {/* Welcome */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="text-center"
      >
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-text-muted">{dateLabel}</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-text-primary sm:text-5xl">{welcome}</h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35, duration: 0.8 }}
          className="mt-3 text-base text-text-secondary"
        >
          {offline > 0 ? (
            <button
              type="button"
              onClick={() => navigate('/sites')}
              className="text-danger underline decoration-danger/40 underline-offset-4 transition-colors hover:decoration-danger"
            >
              {offline} site{offline > 1 ? 's' : ''} hors ligne — à regarder
            </button>
          ) : (
            nudge
          )}
        </motion.p>
      </motion.div>

      {/* Veille ticker (Bloc 2) — renders nothing (no margin) when there's no data */}
      <VeilleTicker />

      {/* Sites suivis — personal shortcut, only when the operator pinned some */}
      {pinnedSites.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="mt-10"
        >
          <p className="mb-2 text-center font-mono text-[10px] uppercase tracking-[0.25em] text-text-muted">
            Sites suivis
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {pinnedSites.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => openSite(s.id)}
                className="flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-text-primary transition-colors hover:border-border-strong"
              >
                <StatusBadge status={s.status} compact />
                <span className="max-w-[10rem] truncate">{s.name}</span>
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {/* Primary destinations */}
      <motion.div
        initial="hidden"
        animate="show"
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06, delayChildren: 0.3 } } }}
        className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-3"
      >
        {destinations.map((d) => (
          <motion.button
            key={d.key}
            type="button"
            onClick={d.to}
            variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            whileHover={{ y: -3 }}
            className="group flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5 text-left transition-colors hover:border-border-strong"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-bg text-text-secondary transition-colors group-hover:text-text-primary">
              <d.icon size={18} strokeWidth={1.75} />
            </span>
            <div>
              <p className="text-sm font-semibold text-text-primary">{d.label}</p>
              <p className="mt-0.5 text-xs text-text-muted">{d.hint}</p>
            </div>
            <ArrowRight
              size={15}
              className="mt-1 text-text-muted opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100"
            />
          </motion.button>
        ))}
      </motion.div>

      {/* Activité récente — what the other operator changed (A3.2) */}
      {recentActivity.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="mt-12"
        >
          <p className="mb-3 text-center font-mono text-[10px] uppercase tracking-[0.25em] text-text-muted">
            Activité récente
          </p>
          <div className="mx-auto flex max-w-xl flex-col divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
            {recentActivity.map((ev) => (
              <button
                key={ev.key}
                type="button"
                onClick={() => navigate(ev.routeKey)}
                className="flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-hover"
              >
                <span className="flex-shrink-0 rounded-md border border-border bg-bg px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-text-muted">
                  {ev.noun}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="truncate text-sm text-text-primary">{ev.text}</span>
                  <span className="mt-0.5 block text-xs text-text-muted">
                    {profileFor(ev.actorEmail).name}
                  </span>
                </span>
                <span className="flex-shrink-0 font-mono text-[10px] uppercase tracking-wider text-text-muted">
                  {relativeTime(ev.at)}
                </span>
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {/* Secondary links — quiet row */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7, duration: 0.8 }}
        className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2"
      >
        {secondary.map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={() => navigate(s.to)}
            className="flex items-center gap-1.5 text-xs text-text-muted transition-colors hover:text-text-secondary"
          >
            <s.icon size={13} strokeWidth={1.75} />
            {s.label}
          </button>
        ))}
      </motion.div>
    </div>
  );
}
