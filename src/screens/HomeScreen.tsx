import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import { useCollection } from '../state/SyncContext';
import { useProfiles } from '../state/ProfilesContext';
import { AnimatedCounter } from '../components/AnimatedCounter';
import { useSitePins } from '../lib/useSitePins';
import { useSitePanel } from '../components/site-panel/SitePanelContext';
import { StatusBadge } from '../components/StatusBadge';
import { VeilleTicker } from '../components/VeilleTicker';
import { SupervisionBand } from '../components/SupervisionBand';
import { AttentionPanel } from '../components/AttentionPanel';
import { useAttention } from '../state/useAttention';
import { homeWelcome, homeNudge, parcSerein, alerteParc } from '../lib/homeGreetings';
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

  // Which feed rows arrived *after* the screen was already on display. The
  // first batch must not flash — everything is "new" on mount and six
  // simultaneous pulses would read as a glitch — so the initial keys are
  // recorded silently and only later arrivals pulse.
  const seenActivityKeys = useRef<Set<string> | null>(null);
  const [pulsingKeys, setPulsingKeys] = useState<string[]>([]);
  useEffect(() => {
    if (seenActivityKeys.current === null) {
      seenActivityKeys.current = new Set(recentActivity.map((e) => e.key));
      return;
    }
    const seen = seenActivityKeys.current;
    const fresh = recentActivity.filter((e) => !seen.has(e.key)).map((e) => e.key);
    recentActivity.forEach((e) => seen.add(e.key));
    if (fresh.length === 0) return;
    setPulsingKeys(fresh);
    const t = setTimeout(() => setPulsingKeys([]), 1600);
    return () => clearTimeout(t);
  }, [recentActivity]);

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
  /*
    LA SALUTATION N'AFFIRME LE CALME QUE SI ON L'A VÉRIFIÉ.

    Vu sur une capture réelle : « La nuit est calme, Aaron. » au-dessus de
    « 12 sites hors ligne » et de vingt et un points d'attention. La première
    phrase que lit l'opérateur contredisait tout ce qui la suivait.

    Trois conditions, et les trois comptent :
      · `checkedAt` — on a réellement regardé. Avant, on ne dit rien ;
      · aucun point d'attention ;
      · aucun site hors ligne.

    C'est la même règle que le panneau juste en dessous applique depuis
    toujours (« on n'affirme pas tout va bien avant d'avoir regardé ») ; la
    salutation était le seul endroit qui s'en dispensait.
  */
  const attention = useAttention();
  /*
    « JAMAIS VU » COMPTE, et c'est le chiffre qui manquait.

    Un site dont le traceur n'a jamais rien envoyé n'était NI en ligne NI hors
    ligne : il n'apparaissait dans aucun des deux compteurs, et n'empêchait pas
    l'accueil d'annoncer le calme. Mesuré : dix-neuf sites, douze hors ligne,
    sept jamais vus, et aucun des sept nulle part à l'écran.

    La règle vit dans lib/homeGreetings.ts, pas ici : elle était déjà écrite de
    deux façons différentes dans les deux accueils.
  */
  const horsLigne = sites.filter((s) => s.status === 'offline').length;
  const jamaisVus = sites.filter((s) => s.status === 'unknown').length;
  const serein = parcSerein({
    attentions: attention.items.length,
    regarde: Boolean(attention.checkedAt),
    horsLigne,
    jamaisVus,
  });
  const welcome = homeWelcome(displayName, now, serein);
  const dateLabel = now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

  const alerte = alerteParc({ horsLigne, jamaisVus });

  // A three-number pulse of the workspace. Kept to counts the operator can act
  // on — nothing here is a vanity metric, and each one is a link to the screen
  // that resolves it.
  const openTasks = useCollection<{ status?: string }>('tasks');
  const stats = useMemo(
    () => [
      { key: 'sites', value: sites.length, label: 'Sites supervisés', to: '/sites' },
      /*
        « En ligne » seul laissait un trou : dix-neuf supervisés, zéro en
        ligne, et rien qui dise où sont les dix-neuf autres. Le compteur des
        sites JAMAIS VUS prend la place quand il y en a — c'est le chiffre le
        plus grave des deux, et celui qu'on ne peut lire nulle part ailleurs.
        Quand tout a déjà parlé au moins une fois, il redevient « En ligne ».
      */
      jamaisVus > 0
        ? { key: 'jamais-vus', value: jamaisVus, label: 'Jamais vus', to: '/sites' }
        : {
            key: 'online',
            value: sites.filter((s) => s.status === 'online').length,
            label: 'En ligne',
            to: '/sites',
          },
      {
        key: 'tasks',
        value: openTasks.filter((t) => t.status !== 'done').length,
        label: 'Tâches ouvertes',
        to: '/tasks',
      },
    ],
    [sites, openTasks, jamaisVus],
  );

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
          {alerte ? (
            <button
              type="button"
              onClick={() => navigate('/sites')}
              className="text-danger underline decoration-danger/40 underline-offset-4 transition-colors hover:decoration-danger"
            >
              {alerte}
            </button>
          ) : (
            nudge
          )}
        </motion.p>
      </motion.div>

      {/* Live counts. They animate on display so the screen reads as awake
          rather than as a static poster, and they re-count in place when sync
          delivers a change. */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="elev-1 mt-8 grid grid-cols-3 gap-px overflow-hidden rounded-2xl border border-border bg-border"
      >
        {stats.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => navigate(s.to)}
            className="group flex flex-col items-center gap-1 bg-surface px-3 py-4 transition-colors hover:bg-surface-hover"
          >
            <AnimatedCounter
              value={s.value}
              className="font-mono text-2xl font-semibold tabular-nums text-text-primary sm:text-3xl"
            />
            <span className="text-center text-[10px] uppercase tracking-[0.18em] text-text-muted transition-colors group-hover:text-text-secondary">
              {s.label}
            </span>
          </button>
        ))}
      </motion.div>

      {/* Veille ticker (Bloc 2) — renders nothing (no margin) when there's no data */}
      <VeilleTicker />

      {/* La veille dit ce qui se passe DEHORS ; celle-ci, ce qui se passe chez
          nous — clientes connectées, volume écrit, silences, sites en panne.
          Elle ne s'affiche que s'il y a un fait vrai à dire (BLOC K). */}
      <SupervisionBand />

      {/* Ce que l'application a remarqué toute seule. Ne s'affiche que s'il y a
          quelque chose à dire — voir AttentionPanel. */}
      <AttentionPanel state={attention} className="mt-10" />

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
            className="elev-1 elev-hover group flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5 text-left transition-colors hover:border-border-strong"
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
          <div className="elev-1 mx-auto flex max-w-xl flex-col divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
            {recentActivity.map((ev) => (
              <motion.button
                key={ev.key}
                type="button"
                onClick={() => navigate(ev.routeKey)}
                animate={
                  pulsingKeys.includes(ev.key)
                    ? { backgroundColor: ['rgba(0,0,0,0)', 'rgba(255,255,255,0.10)', 'rgba(0,0,0,0)'] }
                    : { backgroundColor: 'rgba(0,0,0,0)' }
                }
                transition={{ duration: 1.4, times: [0, 0.2, 1], ease: 'easeOut' }}
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
              </motion.button>
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
