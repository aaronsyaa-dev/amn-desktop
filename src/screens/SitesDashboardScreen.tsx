import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Copy, Check, Pencil, Plus, Search, SlidersHorizontal, Trash2, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { useRemoteSites, type DerivedSite } from '../state/RemoteSitesContext';
import { useUndo } from '../state/UndoContext';
import { useTrackers } from '../state/useTrackers';
import type { DerivedStatus } from '../lib/siteStatus';
import { StatusBadge } from '../components/StatusBadge';
import { Sparkline } from '../components/Sparkline';
import { buildActivitySeries, countRecentAlerts } from '../lib/eventStats';
import { relativeTime } from '../lib/time';
import { staggerContainer, staggerItem } from '../lib/transitions';
import { useSitePanel } from '../components/site-panel/SitePanelContext';
import type { RegisterSiteResult } from '../shared/api';

type SortKey = 'urgent' | 'alerts' | 'alpha';

const SORT_LABELS: Record<SortKey, string> = {
  urgent: 'Priorité',
  alerts: 'Alertes 24h',
  alpha: 'Alphabétique',
};

const STATUS_ORDER: Record<DerivedStatus, number> = {
  offline: 0,
  degraded: 1,
  unknown: 2,
  online: 3,
};

const STATUS_FILTERS: Array<{ key: DerivedStatus | 'all'; label: string }> = [
  { key: 'all', label: 'Tous' },
  { key: 'online', label: 'En ligne' },
  { key: 'degraded', label: 'Dégradés' },
  { key: 'offline', label: 'Hors ligne' },
];

const TREND_COLOR: Record<DerivedStatus, string> = {
  online: 'var(--color-success)',
  degraded: 'var(--color-warning)',
  offline: 'var(--color-danger)',
  unknown: 'var(--color-text-muted)',
};

export function SitesDashboardScreen() {
  const { sites, loading, connectionStatus, eventsBySite, ensureEventsLoaded } =
    useRemoteSites();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('urgent');
  const [statusFilter, setStatusFilter] = useState<DerivedStatus | 'all'>('all');
  const [registering, setRegistering] = useState(false);

  useEffect(() => {
    for (const site of sites) ensureEventsLoaded(site.id);
  }, [sites, ensureEventsLoaded]);

  const alertCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const site of sites) {
      counts[site.id] = countRecentAlerts(eventsBySite[site.id] ?? []);
    }
    return counts;
  }, [sites, eventsBySite]);

  const { isPending } = useUndo();
  const filteredSites = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = sites.filter((site) => {
      if (isPending(`site:${site.id}`)) return false; // hidden during undo window
      const matchesQuery = !q || site.name.toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'all' || site.status === statusFilter;
      return matchesQuery && matchesStatus;
    });
    const copy = [...filtered];
    switch (sort) {
      case 'urgent':
        return copy.sort(
          (a, b) =>
            STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
            (alertCounts[b.id] ?? 0) - (alertCounts[a.id] ?? 0),
        );
      case 'alerts':
        return copy.sort((a, b) => (alertCounts[b.id] ?? 0) - (alertCounts[a.id] ?? 0));
      case 'alpha':
        return copy.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    }
  }, [sites, query, statusFilter, sort, alertCounts, isPending]);

  const offlineCount = sites.filter((s) => s.status === 'offline').length;

  return (
    <section className="flex flex-col gap-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-text-primary">
            Registre des sites
          </h1>
          <p className="mt-1 font-mono text-xs uppercase tracking-widest text-text-muted">
            {loading ? (
              'Chargement…'
            ) : (
              <>
                {sites.length} site{sites.length > 1 ? 's' : ''} supervisé
                {sites.length > 1 ? 's' : ''}
                {offlineCount > 0 && (
                  <>
                    {' · '}
                    <span className="text-danger">{offlineCount} hors ligne</span>
                  </>
                )}
              </>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setRegistering(true)}
          className="flex items-center gap-2 bg-accent px-3 py-2.5 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover"
        >
          <Plus size={16} strokeWidth={2.25} />
          Nouveau site
        </button>
      </div>

      <ConnectionBanner status={connectionStatus} />

      {sites.length > 0 && (
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
      )}

      {/* Register */}
      {sites.length === 0 && !loading ? (
        <EmptyRegistry onRegister={() => setRegistering(true)} />
      ) : (
        <div className="border border-border bg-surface">
          <div className="hidden grid-cols-[1.6fr_auto_6rem_5rem_5rem_6rem_auto] items-center gap-4 border-b border-border px-5 py-2.5 font-mono text-[10px] uppercase tracking-widest text-text-muted md:grid">
            <span>Site</span>
            <span>Statut</span>
            <span className="text-right">Visiteurs</span>
            <span className="text-right">Alertes 24h</span>
            <span className="text-right">Activité</span>
            <span className="text-right">Dernier heartbeat</span>
          </div>

          {filteredSites.length > 0 ? (
            <motion.div
              variants={staggerContainer}
              initial="initial"
              animate="animate"
              className="divide-y divide-border/60"
            >
              {filteredSites.map((site) => (
                <motion.div key={site.id} variants={staggerItem}>
                  <SiteRow
                    site={site}
                    events={eventsBySite[site.id] ?? []}
                    alertCount={alertCounts[site.id] ?? 0}
                  />
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <div className="px-5 py-16 text-center font-mono text-xs uppercase tracking-widest text-text-muted">
              Aucun site ne correspond au filtre
            </div>
          )}
        </div>
      )}

      {registering && <RegisterSiteModal onClose={() => setRegistering(false)} />}
    </section>
  );
}

function ConnectionBanner({
  status,
}: {
  status: ReturnType<typeof useRemoteSites>['connectionStatus'];
}) {
  if (status === 'online') return null;

  const copy: Record<Exclude<typeof status, 'online'>, string> = {
    connecting: 'Connexion à amn-api en cours…',
    offline:
      'amn-api est injoignable — les données affichées peuvent être obsolètes. Reconnexion automatique en cours.',
    unconfigured:
      "amn-api n'est pas configuré (AMN_API_URL / AMN_API_OPERATOR_TOKEN manquants dans .env).",
  };

  return (
    <div className="flex items-center gap-2 border border-border bg-surface px-4 py-2.5 font-mono text-xs text-text-secondary">
      <span
        className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${
          status === 'connecting' ? 'animate-pulse bg-text-muted' : 'bg-danger'
        }`}
      />
      {copy[status]}
    </div>
  );
}

function EmptyRegistry({ onRegister }: { onRegister: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 border border-dashed border-border px-6 py-16 text-center">
      <p className="text-sm font-medium text-text-primary">
        Aucun site enregistré pour l’instant
      </p>
      <p className="max-w-sm text-sm text-text-secondary">
        Enregistrez votre premier site pour obtenir sa clé API, puis installez
        le tracker (onglet « Tracker ») pour commencer à recevoir des
        données réelles.
      </p>
      <button
        type="button"
        onClick={onRegister}
        className="mt-2 flex items-center gap-2 bg-accent px-3 py-2 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover"
      >
        <Plus size={15} strokeWidth={2.25} />
        Enregistrer un site
      </button>
    </div>
  );
}

function SiteRow({
  site,
  events,
  alertCount,
}: {
  site: DerivedSite;
  events: ReturnType<typeof useRemoteSites>['eventsBySite'][string];
  alertCount: number;
}) {
  const { openSite } = useSitePanel();
  const { updateSite, deleteSite } = useRemoteSites();
  const { scheduleDelete } = useUndo();
  const { setModules } = useTrackers();
  const activity = useMemo(() => buildActivitySeries(events), [events]);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(site.name);
  const inputRef = useRef<HTMLInputElement>(null);

  const startEdit = () => {
    setDraft(site.name);
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  };
  const commitEdit = () => {
    const name = draft.trim();
    setEditing(false);
    if (name && name !== site.name) updateSite(site.id, name).catch(() => {/* error surfaced via revert */});
  };

  const remove = () => {
    scheduleDelete({
      key: `site:${site.id}`,
      label: `Site « ${site.name} »`,
      commit: () => {
        deleteSite(site.id).catch(() => {/* error surfaced via revert */});
        setModules(site.id, []); // cascade: drop this site's tracker config
      },
    });
  };

  return (
    <div className="group relative grid w-full grid-cols-[1fr_auto] items-center gap-4 px-5 py-3.5 transition-colors duration-150 hover:bg-surface-hover md:grid-cols-[1.6fr_auto_6rem_5rem_5rem_6rem_auto]">
      {/* hover accent bar */}
      <span className="absolute left-0 top-0 h-full w-0.5 scale-y-0 bg-accent transition-transform duration-150 group-hover:scale-y-100" />

      <div className="min-w-0">
        {editing ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitEdit();
              if (e.key === 'Escape') setEditing(false);
            }}
            onClick={(e) => e.stopPropagation()}
            className="input-focus w-full max-w-xs border border-border bg-bg px-2 py-1 text-sm text-text-primary outline-none"
          />
        ) : (
          <button type="button" onClick={() => openSite(site.id)} className="block max-w-full text-left">
            <p className="truncate text-sm font-medium text-text-primary">{site.name}</p>
            <p className="truncate font-mono text-[11px] text-text-muted">#{site.id.slice(0, 8)}</p>
          </button>
        )}
      </div>

      <div className="md:justify-self-start">
        <StatusBadge status={site.status} />
      </div>

      <p className="hidden text-right md:block">
        <span className="tnum text-sm text-text-primary">{site.state?.activeVisitors ?? 0}</span>
      </p>

      <p className="hidden text-right md:block">
        <span className={`tnum text-sm ${alertCount > 0 ? 'text-danger' : 'text-text-muted'}`}>
          {String(alertCount).padStart(2, '0')}
        </span>
      </p>

      <div className="hidden justify-self-end md:block">
        <Sparkline data={activity} color={TREND_COLOR[site.status]} width={64} height={20} />
      </div>

      <p className="hidden text-right font-mono text-[10px] uppercase tracking-wide text-text-muted md:block">
        {site.state?.lastSeenAt ? relativeTime(site.state.lastSeenAt).replace('il y a ', '') : '—'}
      </p>

      {/* Row actions — revealed on hover */}
      <div className="flex items-center gap-1 justify-self-end opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
        <button
          type="button"
          onClick={startEdit}
          aria-label="Renommer le site"
          title="Renommer"
          className="flex h-7 w-7 items-center justify-center rounded text-text-muted transition-colors hover:bg-white/5 hover:text-text-primary"
        >
          <Pencil size={14} strokeWidth={1.75} />
        </button>
        <button
          type="button"
          onClick={remove}
          aria-label="Supprimer le site"
          title="Supprimer"
          className="flex h-7 w-7 items-center justify-center rounded text-text-muted transition-colors hover:bg-danger-muted hover:text-danger"
        >
          <Trash2 size={14} strokeWidth={1.75} />
        </button>
      </div>
    </div>
  );
}

function RegisterSiteModal({ onClose }: { onClose: () => void }) {
  const { registerSite } = useRemoteSites();
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RegisterSiteResult | null>(null);

  const submit = async () => {
    if (!name.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const created = await registerSite(name.trim());
      setResult(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Échec de l’enregistrement.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.98, y: -6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 420, damping: 32 }}
        className="relative w-full max-w-md border border-border-strong bg-surface"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="font-mono text-[11px] uppercase tracking-widest text-text-secondary">
            {result ? 'Site enregistré' : 'Nouveau site'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="text-text-secondary hover:text-text-primary"
          >
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        {result ? (
          <RegisteredSiteResult result={result} onClose={onClose} />
        ) : (
          <div className="flex flex-col gap-3 p-5">
            <label className="flex flex-col gap-1.5">
              <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
                Nom du site *
              </span>
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submit()}
                placeholder="Ex : Boutique Mohamed"
                className="input-focus border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none"
              />
            </label>
            {error && (
              <p className="border border-danger/40 bg-danger-muted px-3 py-2 font-mono text-xs text-danger">
                {error}
              </p>
            )}
            <button
              type="button"
              onClick={submit}
              disabled={!name.trim() || submitting}
              className="mt-1 bg-accent px-3 py-2.5 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover disabled:opacity-40"
            >
              {submitting ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}

function RegisteredSiteResult({
  result,
  onClose,
}: {
  result: RegisterSiteResult;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(result.apiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard unavailable — the key remains selectable manually.
    }
  };

  return (
    <div className="flex flex-col gap-3 p-5">
      <p className="text-sm text-text-secondary">
        <strong className="text-text-primary">{result.name}</strong> est
        enregistré. Copiez la clé API ci-dessous — elle ne sera plus jamais
        affichée.
      </p>
      <div className="relative border border-border-strong bg-bg p-3">
        <p className="break-all pr-16 font-mono text-xs text-text-primary">{result.apiKey}</p>
        <button
          type="button"
          onClick={copy}
          className="absolute right-2 top-2 flex items-center gap-1.5 border border-border-strong bg-surface px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-text-secondary transition-colors hover:bg-surface-hover"
        >
          {copied ? (
            <>
              <Check size={11} strokeWidth={2.5} />
              Copié
            </>
          ) : (
            <>
              <Copy size={11} strokeWidth={2} />
              Copier
            </>
          )}
        </button>
      </div>
      <p className="font-mono text-[11px] text-text-muted">
        AMN_API_KEY à coller dans le .env du site cible — voir l’onglet
        Tracker pour le reste de l’installation.
      </p>
      <button
        type="button"
        onClick={onClose}
        className="mt-1 border border-border-strong bg-surface px-3 py-2.5 text-sm font-medium text-text-primary transition-colors hover:bg-surface-hover"
      >
        Terminé
      </button>
    </div>
  );
}
