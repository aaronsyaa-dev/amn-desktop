import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, Check, Copy, Globe2, ShieldCheck } from 'lucide-react';
import { bridge } from '../../lib/bridge';
import { relativeTime } from '../../lib/time';
import type { OrgOverview, SiteBadge } from '../../shared/api';

/**
 * Cross-site SOC control desk (BLOC 4).
 *
 * Four panels over one server-side aggregation: the live incident feed, the
 * country breakdown, the day × hour activity heatmap, and a scrubber that
 * replays the window a day at a time.
 *
 * Everything is computed by amn-api and scoped to the operator's organization
 * (see `orgOverview` in the DB drivers) — the desk never assembles an aggregate
 * from several tenants, and never receives another tenant's rows to begin with.
 */

const WINDOWS = [7, 30] as const;
const SEVERITIES = ['critical', 'warning', 'info'] as const;
type Severity = (typeof SEVERITIES)[number];

const SEVERITY_LABEL: Record<Severity, string> = {
  critical: 'Critique',
  warning: 'Avertissement',
  info: 'Information',
};

/** Red is reserved for critical — everything else stays in the grey scale. */
const SEVERITY_DOT: Record<Severity, string> = {
  critical: 'bg-danger',
  warning: 'bg-text-secondary',
  info: 'bg-text-muted',
};

const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

/**
 * Country code → display name + flag. Built from the codes actually present in
 * the data rather than shipping a full ISO table: the desk labels what it
 * observes, and an unknown code is shown as the code itself instead of being
 * dropped.
 */
function countryLabel(code: string): string {
  try {
    const names = new Intl.DisplayNames(['fr'], { type: 'region' });
    return names.of(code) ?? code;
  } catch {
    return code;
  }
}

function countryFlag(code: string): string {
  if (!/^[A-Z]{2}$/.test(code)) return '🏳️';
  return String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

export function SocDesk() {
  const [days, setDays] = useState<(typeof WINDOWS)[number]>(7);
  const [overview, setOverview] = useState<OrgOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [siteFilter, setSiteFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<'all' | Severity>('all');
  /**
   * Scrubber position, in days back from now. 0 = live (the whole window);
   * n > 0 = replay the single day that ended n days ago.
   */
  const [scrub, setScrub] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    bridge()
      .remote.getOrgOverview(days)
      .then((data) => {
        if (!active) return;
        setOverview(data);
        setError(null);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Agrégation indisponible.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [days]);

  // Changing the window must not leave the scrubber pointing past its end.
  useEffect(() => setScrub(0), [days]);

  /** The [start, end) the scrubber currently selects, or null when live. */
  const scrubRange = useMemo(() => {
    if (scrub === 0) return null;
    const end = new Date();
    end.setUTCHours(0, 0, 0, 0);
    end.setUTCDate(end.getUTCDate() - (scrub - 1));
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - 1);
    return { start: start.toISOString(), end: end.toISOString() };
  }, [scrub]);

  const incidents = useMemo(() => {
    const rows = overview?.incidents ?? [];
    return rows.filter((i) => {
      if (siteFilter !== 'all' && i.siteId !== siteFilter) return false;
      if (severityFilter !== 'all' && (i.severity ?? 'info') !== severityFilter) return false;
      if (scrubRange && !(i.occurredAt >= scrubRange.start && i.occurredAt < scrubRange.end)) {
        return false;
      }
      return true;
    });
  }, [overview, siteFilter, severityFilter, scrubRange]);

  const countries = useMemo(() => {
    const rows = overview?.countries ?? [];
    const total = rows.reduce((n, r) => n + r.count, 0);
    return { total, rows: rows.slice(0, 8) };
  }, [overview]);

  /**
   * Day-of-week × hour grid. Buckets are UTC hours from the server; they are
   * placed in the grid by the operator's LOCAL day and hour so "mardi 14 h"
   * means what the operator thinks it means.
   */
  const heatmap = useMemo(() => {
    const grid: number[][] = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
    let max = 0;
    for (const bucket of overview?.hourly ?? []) {
      if (siteFilter !== 'all' && bucket.siteId !== siteFilter) continue;
      const at = new Date(`${bucket.hour}:00:00.000Z`);
      if (Number.isNaN(at.getTime())) continue;
      if (scrubRange && !(at.toISOString() >= scrubRange.start && at.toISOString() < scrubRange.end)) {
        continue;
      }
      // getDay() is 0=dimanche; the grid starts on Monday.
      const row = (at.getDay() + 6) % 7;
      const col = at.getHours();
      grid[row][col] += bucket.count;
      if (grid[row][col] > max) max = grid[row][col];
    }
    return { grid, max };
  }, [overview, siteFilter, scrubRange]);

  const sites = overview?.sites ?? [];

  return (
    <div className="flex flex-col gap-5">
      {/* Window + scrubber */}
      <div className="elev-1 flex flex-col gap-4 rounded-2xl border border-border bg-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-text-primary">Bureau de contrôle</h2>
            <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.2em] text-text-muted">
              {loading
                ? 'Agrégation…'
                : scrubRange
                  ? `Rejeu — ${new Date(scrubRange.start).toLocaleDateString('fr-FR', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                    })}`
                  : `Direct · ${days} derniers jours`}
            </p>
          </div>
          <div className="flex gap-1">
            {WINDOWS.map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => setDays(w)}
                className={`rounded-lg px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest transition-colors ${
                  days === w
                    ? 'bg-accent-muted text-text-primary'
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                {w} j
              </button>
            ))}
          </div>
        </div>

        {/* Temporal scrubber: 0 is live, then one step per day back. */}
        <div className="flex items-center gap-3">
          <span className="font-mono text-[9px] uppercase tracking-widest text-text-muted">Direct</span>
          <input
            type="range"
            min={0}
            max={days}
            value={scrub}
            onChange={(e) => setScrub(Number(e.target.value))}
            aria-label="Rejouer la période jour par jour"
            className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-border accent-[var(--color-accent)]"
          />
          <span className="font-mono text-[9px] uppercase tracking-widest text-text-muted">
            −{days} j
          </span>
          {scrub > 0 && (
            <button
              type="button"
              onClick={() => setScrub(0)}
              className="rounded-lg border border-border px-2 py-1 font-mono text-[9px] uppercase tracking-widest text-text-secondary transition-colors hover:text-text-primary"
            >
              Revenir au direct
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-text-secondary">
          <AlertTriangle size={15} className="mt-0.5 flex-shrink-0 text-danger" strokeWidth={2} />
          <span>{error}</span>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        {/* Incident feed */}
        <section className="elev-1 flex min-h-0 flex-col rounded-2xl border border-border bg-surface">
          <header className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
            <h3 className="mr-auto text-sm font-semibold text-text-primary">
              Incidents
              <span className="ml-2 font-mono text-[10px] uppercase tracking-widest text-text-muted">
                {incidents.length}
              </span>
            </h3>
            <select
              value={siteFilter}
              onChange={(e) => setSiteFilter(e.target.value)}
              aria-label="Filtrer par site"
              className="input-focus rounded-lg border border-border bg-bg px-2 py-1.5 text-xs text-text-secondary"
            >
              <option value="all">Tous les sites</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value as 'all' | Severity)}
              aria-label="Filtrer par criticité"
              className="input-focus rounded-lg border border-border bg-bg px-2 py-1.5 text-xs text-text-secondary"
            >
              <option value="all">Toutes criticités</option>
              {SEVERITIES.map((s) => (
                <option key={s} value={s}>
                  {SEVERITY_LABEL[s]}
                </option>
              ))}
            </select>
          </header>

          <div className="max-h-[26rem] overflow-y-auto">
            {incidents.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-text-muted">
                {loading ? 'Chargement…' : 'Aucun incident sur cette période.'}
              </p>
            ) : (
              <ul className="divide-y divide-border">
                <AnimatePresence initial={false}>
                  {incidents.map((incident) => {
                    const severity = (incident.severity ?? 'info') as Severity;
                    return (
                      <motion.li
                        key={incident.id}
                        layout
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.18 }}
                        className="flex items-start gap-3 px-4 py-3"
                      >
                        <span
                          className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${SEVERITY_DOT[severity]}`}
                          aria-hidden
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm text-text-primary">
                            {incident.message || 'Alerte de sécurité'}
                          </p>
                          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-widest text-text-muted">
                            {incident.siteName} · {SEVERITY_LABEL[severity]}
                          </p>
                        </div>
                        <time className="flex-shrink-0 font-mono text-[10px] uppercase tracking-widest text-text-muted">
                          {relativeTime(incident.occurredAt)}
                        </time>
                      </motion.li>
                    );
                  })}
                </AnimatePresence>
              </ul>
            )}
          </div>
        </section>

        {/* Country breakdown */}
        <section className="elev-1 flex flex-col rounded-2xl border border-border bg-surface">
          <header className="flex items-center gap-2 border-b border-border px-4 py-3">
            <Globe2 size={15} strokeWidth={1.75} className="text-text-secondary" />
            <h3 className="text-sm font-semibold text-text-primary">Origine des visiteurs</h3>
          </header>
          <div className="flex flex-col gap-2.5 px-4 py-4">
            {countries.rows.length === 0 ? (
              <p className="py-6 text-center text-sm text-text-muted">
                {loading
                  ? 'Chargement…'
                  : 'Aucune origine relevée — le tracker du site ne transmet pas encore le pays.'}
              </p>
            ) : (
              countries.rows.map((row) => {
                const share = countries.total > 0 ? (row.count / countries.total) * 100 : 0;
                return (
                  <div key={row.country} className="flex items-center gap-3">
                    <span className="w-6 text-base leading-none" aria-hidden>
                      {countryFlag(row.country)}
                    </span>
                    <span className="w-28 truncate text-xs text-text-secondary">
                      {countryLabel(row.country)}
                    </span>
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-bg">
                      <motion.span
                        className="block h-full rounded-full bg-accent"
                        initial={{ width: 0 }}
                        animate={{ width: `${share}%` }}
                        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                      />
                    </span>
                    <span className="w-12 text-right font-mono text-[10px] text-text-muted">
                      {share.toFixed(0)} %
                    </span>
                  </div>
                );
              })
            )}
            <p className="mt-1 text-[10px] leading-relaxed text-text-muted">
              Niveau pays uniquement. Aucune géolocalisation précise n’est collectée ni stockée :
              amn-api n’effectue aucune recherche IP → localisation.
            </p>
          </div>
        </section>
      </div>

      {/* Heatmap */}
      <section className="elev-1 rounded-2xl border border-border bg-surface p-4">
        <h3 className="text-sm font-semibold text-text-primary">Activité par heure</h3>
        <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.2em] text-text-muted">
          Heure locale · maximum {heatmap.max}
        </p>
        <div className="mt-4 overflow-x-auto">
          <div className="min-w-[34rem]">
            <div className="flex">
              <span className="w-8 flex-shrink-0" />
              {Array.from({ length: 24 }, (_, h) => (
                <span
                  key={h}
                  className="flex-1 text-center font-mono text-[8px] text-text-muted"
                  aria-hidden
                >
                  {h % 6 === 0 ? h : ''}
                </span>
              ))}
            </div>
            {heatmap.grid.map((row, dayIndex) => (
              <div key={DAY_LABELS[dayIndex]} className="flex items-center gap-px py-px">
                <span className="w-8 flex-shrink-0 font-mono text-[9px] uppercase text-text-muted">
                  {DAY_LABELS[dayIndex]}
                </span>
                {row.map((count, hour) => {
                  // Square-root scaling: a single very busy hour would otherwise
                  // flatten every other cell to invisible.
                  const intensity =
                    heatmap.max > 0 ? Math.sqrt(count / heatmap.max) : 0;
                  return (
                    <span
                      key={hour}
                      title={`${DAY_LABELS[dayIndex]} ${String(hour).padStart(2, '0')} h — ${count} événement(s)`}
                      className="h-4 flex-1 rounded-[2px]"
                      style={{
                        backgroundColor:
                          count === 0
                            ? 'var(--color-bg)'
                            : `rgba(242, 242, 240, ${0.12 + intensity * 0.8})`,
                      }}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </section>

      <BadgeExport sites={sites} />
    </div>
  );
}

/**
 * The client-facing security badge. The operator picks a site, gets the embed
 * snippet, and pastes it into the client's own website.
 */
function BadgeExport({ sites }: { sites: OrgOverview['sites'] }) {
  const [siteId, setSiteId] = useState('');
  const [badge, setBadge] = useState<SiteBadge | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!siteId) {
      setBadge(null);
      return;
    }
    let active = true;
    setLoading(true);
    setBadge(null);
    setError(null);
    bridge()
      .remote.getSiteBadge(siteId)
      .then((data) => {
        if (active) setBadge(data);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Badge indisponible.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [siteId]);

  const copy = async () => {
    if (!badge) return;
    // Clear first: a failure from an earlier attempt must not sit next to a
    // "Copié" confirmation and tell the operator two opposite things.
    setError(null);
    try {
      await navigator.clipboard.writeText(badge.snippet);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Copie impossible — sélectionnez le code et copiez-le manuellement.");
    }
  };

  return (
    <section className="elev-1 rounded-2xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center gap-3">
        <ShieldCheck size={15} strokeWidth={1.75} className="text-text-secondary" />
        <h3 className="mr-auto text-sm font-semibold text-text-primary">
          Badge de sécurité à intégrer
        </h3>
        <select
          value={siteId}
          onChange={(e) => setSiteId(e.target.value)}
          aria-label="Site du badge"
          className="input-focus rounded-lg border border-border bg-bg px-2 py-1.5 text-xs text-text-secondary"
        >
          <option value="">Choisir un site…</option>
          {sites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      <p className="mt-2 text-xs leading-relaxed text-text-secondary">
        Le badge affiche le nom du site et son score de sécurité, rien d’autre. Son adresse est
        publique par nature — c’est le client qui la place sur son propre site — mais elle ne donne
        accès à aucun événement, aucun visiteur, aucune configuration.
      </p>

      {loading && <p className="mt-3 text-sm text-text-muted">Génération…</p>}
      {error && <p className="mt-3 text-sm text-danger">{error}</p>}

      {badge && (
        <div className="mt-4 flex flex-col gap-3">
          <img
            src={badge.svgUrl}
            alt="Aperçu du badge de sécurité"
            height={40}
            className="self-start"
          />
          <div className="relative">
            <pre className="overflow-x-auto rounded-xl border border-border bg-bg p-3 font-mono text-[11px] leading-relaxed text-text-secondary">
              {badge.snippet}
            </pre>
            <button
              type="button"
              onClick={() => void copy()}
              aria-label="Copier le code d’intégration"
              className="absolute right-2 top-2 flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2 py-1 text-[10px] uppercase tracking-widest text-text-secondary transition-colors hover:text-text-primary"
            >
              {copied ? <Check size={12} strokeWidth={2} /> : <Copy size={12} strokeWidth={2} />}
              {copied ? 'Copié' : 'Copier'}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
