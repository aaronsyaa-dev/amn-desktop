import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowUpRight,
  Activity,
  AlertTriangle,
  ArrowLeft,
  FileText,
  Globe,
  Layers,
  Lock,
  RefreshCw,
  Sparkles,
  ShieldAlert,
  Users,
} from 'lucide-react';
import { bridge } from '../lib/bridge';
import { formatDateTime } from '../lib/time';
import { useRemoteSites } from '../state/RemoteSitesContext';
import { useReports } from '../state/useReports';
import { useToast } from '../state/ToastContext';
import { useAssistant } from '../assistant/AssistantContext';
import { StaggerGroup, StaggerItem } from '../components/Stagger';
import {
  SCORE_TONE_STYLES,
  SEVERITY_LABELS,
  SEVERITY_STYLES,
  TIER_LABELS,
  alertIp,
  alertKindLabel,
  severityOf,
} from '../lib/trackerAlerts';
import type { RemoteEvent, SiteDigest, SiteSummary, SslStatus, TrackerTier } from '../shared/api';
import { sslSummary, toneFor } from './SslScreen';

/**
 * Per-site control desk: the traffic curve, the alert history and the security
 * score for one supervised site, plus one-click report generation.
 *
 * Everything shown here comes from a single `GET /v1/sites/:id/summary`. The
 * score in particular is computed by amn-api rather than here on purpose — the
 * same figure then appears in the control desk, in a generated report and in
 * the weekly digest without three formulas drifting apart.
 */

const REFRESH_MS = 60 * 1000;

function formatHour(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

export function SiteControlScreen() {
  const { siteId = '' } = useParams();
  const navigate = useNavigate();
  const { sites } = useRemoteSites();
  const { createReport } = useReports();
  const { notify } = useToast();
  const { open: openAssistant, sendMessage } = useAssistant();

  const [summary, setSummary] = useState<SiteSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  // Name from the already-loaded site list, so the header renders instantly
  // instead of waiting on the summary round trip.
  const knownSite = sites.find((s) => s.id === siteId);

  const load = useCallback(async () => {
    if (!siteId) return;
    try {
      const next = await bridge().remote.getSiteSummary(siteId, 24);
      setSummary(next);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de charger les données du site.');
    } finally {
      setLoading(false);
    }
  }, [siteId]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  // Live-ish refresh. The WebSocket already pushes individual events, but the
  // traffic curve and score are aggregates — recomputing them server-side on a
  // timer is simpler and cheaper than trying to fold each push into them.
  useEffect(() => {
    const timer = window.setInterval(() => void load(), REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  const generateReport = async () => {
    if (!summary) return;
    setGenerating(true);
    try {
      // The digest carries the week's aggregates and the recommendations; the
      // summary carries the live 24 h picture. The report quotes both.
      const digest = await bridge().remote.getSiteDigest(siteId).catch(() => null);
      const id = createReport({
        type: 'manual',
        title: `Rapport de supervision — ${summary.site.name}`,
        body: buildReportBody(summary, digest),
        links: [],
      });
      notify({ title: 'Rapport généré', body: `« ${summary.site.name} » est disponible dans Rapports.` });
      navigate('/reports', { state: { openReportId: id } });
    } catch (err) {
      notify({
        title: 'Rapport non généré',
        body: err instanceof Error ? err.message : 'Erreur inconnue.',
      });
    } finally {
      setGenerating(false);
    }
  };

  // Host whose certificate belongs to this site, if its URL is known.
  const sslHost = useMemo(() => {
    const url = summary?.site.url ?? '';
    try {
      return url ? new URL(url).host.toLowerCase() : '';
    } catch {
      return '';
    }
  }, [summary?.site.url]);

  const siteName = summary?.site.name ?? knownSite?.name ?? 'Site';
  const tier = (summary?.site.tier ?? knownSite?.tier ?? 'sentinel') as TrackerTier;

  /**
   * Opens Ajmani on a question about *this* site, pre-loaded with the figures
   * already on screen. Naming the site and quoting its numbers in the question
   * is what makes the answer grounded: the assistant matches the site by name
   * and can only comment on values the operator can see too.
   */
  const askAjmani = () => {
    const alerts = summary?.alerts?.length ?? 0;
    const score = summary?.score?.score;
    const parts = [
      `À propos du site « ${siteName} »`,
      score != null ? `score de sécurité ${score}/100` : null,
      `${alerts} alerte(s) sur les dernières 24 h`,
      summary?.site.url ? `URL : ${summary.site.url}` : null,
    ].filter(Boolean);
    openAssistant('chat');
    sendMessage(
      `${parts.join(', ')}. Que dois-je surveiller en priorité sur ce site, et quelles actions concrètes recommandes-tu ? Appuie-toi uniquement sur les données réelles dont tu disposes.`,
    );
  };

  return (
    <StaggerGroup className="flex flex-col gap-5">
      <StaggerItem>
        <button
          type="button"
          onClick={() => navigate('/tracker')}
          // 14 px de haut mesurés : c'est le retour en arrière, le geste le
          // plus fréquent d'un écran de détail. `-my-2 py-2` le porte à 30.
          className="-my-2 flex items-center gap-1.5 py-2 font-mono text-[10px] uppercase tracking-widest text-text-muted transition-colors hover:text-text-primary"
        >
          <ArrowLeft size={13} strokeWidth={2} />
          Bureau de contrôle
        </button>
      </StaggerItem>

      <StaggerItem>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 truncate text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">
              <Globe size={22} strokeWidth={1.75} className="flex-shrink-0 text-text-secondary" />
              {siteName}
            </h1>
            <p className="mt-1 font-mono text-xs uppercase tracking-widest text-text-muted">
              {TIER_LABELS[tier]}
              {summary?.site.url ? ` · ${summary.site.url.replace(/^https?:\/\//, '').replace(/\/$/, '')}` : ''}
            </p>
          </div>

          <div className="flex flex-shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => void load()}
              aria-label="Rafraîchir"
              className="flex items-center gap-2 border border-border px-3 py-2.5 text-sm text-text-secondary transition-colors hover:text-text-primary"
            >
              <RefreshCw size={14} strokeWidth={1.75} />
              <span className="hidden sm:inline">Rafraîchir</span>
            </button>
            {/* BLOC 3 — hands Ajmani a question already loaded with this site's
                real figures, so the operator asks about *this* desk instead of
                retyping the site name and hoping the assistant matched it. */}
            <button
              type="button"
              onClick={askAjmani}
              aria-label="Demander à Ajmani"
              title="Poser une question à Ajmani sur ce site"
              className="flex items-center gap-2 border border-border px-3 py-2.5 text-sm text-text-secondary transition-colors hover:text-text-primary"
            >
              <Sparkles size={14} strokeWidth={1.75} />
              <span className="hidden sm:inline">Demander à Ajmani</span>
            </button>
            <button
              type="button"
              onClick={() => void generateReport()}
              disabled={!summary || generating}
              className="flex items-center gap-2 bg-accent px-3 py-2.5 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover disabled:opacity-40"
            >
              <FileText size={16} strokeWidth={2} />
              {generating ? 'Génération…' : 'Générer un rapport'}
            </button>
          </div>
        </div>
      </StaggerItem>

      {error && (
        <StaggerItem>
          <div className="flex items-start gap-2 border border-border border-l-2 border-l-danger bg-surface px-4 py-3 text-sm text-text-secondary">
            <AlertTriangle size={15} className="mt-0.5 flex-shrink-0 text-danger" strokeWidth={2} />
            <span>{error}</span>
          </div>
        </StaggerItem>
      )}

      {loading && !summary ? (
        <StaggerItem>
          <div className="h-64 animate-pulse rounded-xl border border-border bg-surface" />
        </StaggerItem>
      ) : summary ? (
        <>
          <StaggerItem>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-[1.5fr_1fr_1fr_1fr_1fr]">
              <ScoreCard summary={summary} />
              <StatCard
                icon={Users}
                label="Visiteurs actifs"
                value={String(summary.state?.activeVisitors ?? 0)}
                hint={summary.state?.lastSeenAt ? `Vu ${formatDateTime(summary.state.lastSeenAt)}` : 'Jamais vu'}
              />
              <StatCard
                icon={Activity}
                label="Requêtes (24 h)"
                value={summary.totalRequests.toLocaleString('fr-FR')}
                hint={`${summary.traffic.length} h de relevé`}
              />
              <StatCard
                icon={ShieldAlert}
                label="Alertes (24 h)"
                value={String(summary.alerts.length)}
                hint={`${summary.alerts.filter((a) => a.severity === 'critical').length} critique(s)`}
                tone={summary.alerts.some((a) => a.severity === 'critical') ? 'danger' : 'default'}
              />
              {/* BLOC 6 — the certificate sits with the other live indicators
                  rather than in its own tab only: an expiry is a supervision
                  fact about this site, not a separate product to go look up. */}
              <SslCard host={sslHost} />
            </div>
          </StaggerItem>

          <StaggerItem>
            <TrafficChart summary={summary} />
          </StaggerItem>

          <StaggerItem>
            <AlertHistory alerts={summary.alerts} />
          </StaggerItem>
        </>
      ) : null}
    </StaggerGroup>
  );
}

/* -------------------------------- Score card ------------------------------ */

function ScoreCard({ summary }: { summary: SiteSummary }) {
  const { score, tone, reasons } = summary.score;
  const styles = SCORE_TONE_STYLES[tone];
  const circumference = 2 * Math.PI * 26;

  return (
    <div className="col-span-2 flex items-center gap-4 border border-border bg-surface p-4 lg:col-span-1">
      <div className="relative h-16 w-16 flex-shrink-0">
        <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90">
          <circle cx="32" cy="32" r="26" fill="none" strokeWidth="5" className="stroke-border" />
          <motion.circle
            cx="32"
            cy="32"
            r="26"
            fill="none"
            strokeWidth="5"
            strokeLinecap="round"
            className={styles.ring}
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: circumference * (1 - score / 100) }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          />
        </svg>
        <span
          className={`absolute inset-0 flex items-center justify-center text-lg font-bold ${styles.text}`}
        >
          {score}
        </span>
      </div>
      <div className="min-w-0">
        <p className="font-mono text-[9px] uppercase tracking-widest text-text-muted">Score de sécurité</p>
        <ul className="mt-1 flex flex-col gap-0.5">
          {reasons.slice(0, 3).map((reason) => (
            <li key={reason} className="line-clamp-2 text-[11px] leading-tight text-text-secondary" title={reason}>
              {reason}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = 'default',
}: {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  label: string;
  value: string;
  hint: string;
  tone?: 'default' | 'danger';
}) {
  return (
    <div className="border border-border bg-surface p-4">
      <div className="flex items-center gap-2">
        <Icon size={14} strokeWidth={1.75} className={tone === 'danger' ? 'text-danger' : 'text-text-muted'} />
        <p className="font-mono text-[9px] uppercase tracking-widest text-text-muted">{label}</p>
      </div>
      <p className={`mt-1.5 text-2xl font-bold ${tone === 'danger' ? 'text-danger' : 'text-text-primary'}`}>
        {value}
      </p>
      <p className="truncate text-[11px] text-text-muted" title={hint}>
        {hint}
      </p>
    </div>
  );
}

/* ------------------------------ Traffic chart ----------------------------- */

/**
 * 24 h traffic as an hourly bar chart. Plain SVG rather than a charting
 * dependency: it's one series of 24 bars, and the app's bundle is already
 * flagged as large.
 */
function TrafficChart({ summary }: { summary: SiteSummary }) {
  const peak = Math.max(1, ...summary.traffic.map((p) => p.count));
  const [hovered, setHovered] = useState<number | null>(null);
  const active = hovered !== null ? summary.traffic[hovered] : null;

  return (
    <section className="border border-border bg-surface p-4">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-center gap-2">
          <Activity size={15} strokeWidth={1.75} className="text-text-secondary" />
          <h2 className="text-sm font-semibold uppercase tracking-widest text-text-secondary">Trafic 24 h</h2>
        </div>
        <p className="font-mono text-[11px] text-text-muted">
          {active
            ? `${formatHour(active.at)} — ${active.count} req`
            : `Pic ${peak} req/h · ${summary.totalRequests.toLocaleString('fr-FR')} au total`}
        </p>
      </div>

      {summary.totalRequests === 0 ? (
        <div className="flex h-32 flex-col items-center justify-center gap-1 text-center">
          <p className="text-sm text-text-secondary">Aucune requête relevée sur 24 h.</p>
          <p className="max-w-sm text-xs text-text-muted">
            La courbe se remplit dès que le tracker déployé sur le site remonte des requêtes.
          </p>
        </div>
      ) : (
        <>
          <div className="flex h-32 items-end gap-[2px]" onMouseLeave={() => setHovered(null)}>
            {summary.traffic.map((point, index) => (
              <button
                key={point.hour}
                type="button"
                onMouseEnter={() => setHovered(index)}
                onFocus={() => setHovered(index)}
                aria-label={`${formatHour(point.at)} : ${point.count} requêtes`}
                className="group relative flex h-full flex-1 items-end"
              >
                <motion.span
                  initial={{ height: 0 }}
                  animate={{ height: `${Math.max((point.count / peak) * 100, point.count > 0 ? 2 : 0)}%` }}
                  transition={{ duration: 0.4, delay: index * 0.012, ease: [0.16, 1, 0.3, 1] }}
                  className={`w-full rounded-sm transition-colors ${
                    hovered === index ? 'bg-accent' : 'bg-text-muted/40 group-hover:bg-accent'
                  }`}
                />
                {/* An empty hour still needs a target to hover, and a hairline
                    baseline so the gap reads as "zero", not "missing". */}
                {point.count === 0 && <span className="absolute inset-x-0 bottom-0 h-px bg-border" />}
              </button>
            ))}
          </div>
          <div className="mt-1.5 flex justify-between font-mono text-[9px] text-text-muted">
            <span>{formatHour(summary.traffic[0].at)}</span>
            <span className="hidden sm:inline">
              {formatHour(summary.traffic[Math.floor(summary.traffic.length / 2)].at)}
            </span>
            <span>{formatHour(summary.traffic[summary.traffic.length - 1].at)}</span>
          </div>
        </>
      )}
    </section>
  );
}

/* ----------------------------- Alert history ------------------------------ */

/**
 * L'HISTORIQUE D'UN SITE, ET LE CHEMIN VERS LE GESTE.
 *
 * Cette liste était en lecture seule, et elle le reste : ce qu'on regarde ici
 * est une chronologie, pas une file de travail. Mais elle ignorait totalement
 * les incidents — on voyait passer vingt alertes d'une même campagne sans
 * pouvoir ni les relier ni agir dessus, et il fallait deviner qu'un autre
 * écran savait le faire.
 *
 * Deux choses changent, et pas une de plus :
 *
 *   · les alertes rattachées à un MÊME incident sont marquées comme telles.
 *     Vingt lignes qui se suivent ne se lisent pas comme vingt problèmes dès
 *     lors qu'on voit qu'elles n'en font qu'un ;
 *   · un raccourci mène au bureau de supervision, là où le geste existe.
 *
 * On ne recopie PAS les boutons d'acquittement ici. Deux endroits pour le même
 * geste, c'est deux endroits où l'état peut diverger sous les yeux de deux
 * opérateurs — et le bureau montre l'incident ENTIER, ce que cette liste, par
 * construction, ne montre jamais.
 */
function AlertHistory({ alerts }: { alerts: RemoteEvent[] }) {
  const ordered = useMemo(
    () => [...alerts].sort((a, b) => (b.occurredAt || '').localeCompare(a.occurredAt || '')),
    [alerts],
  );

  /*
    Combien d'INCIDENTS derrière ces alertes, et le rang de chacune dans le
    sien. C'est ce rang qui fait la différence à la lecture : « 3ᵉ alerte du
    même incident » dit « c'est la suite », là où trois lignes identiques
    disent « trois problèmes ».
  */
  const { incidents, rang } = useMemo(() => {
    const compte = new Map<string, number>();
    const rangs = new Map<number, number>();
    // Du plus ancien au plus récent : le rang doit compter dans le sens du
    // temps, pas dans celui de l'affichage.
    for (const a of [...ordered].reverse()) {
      const id = a.incidentId;
      if (!id) continue;
      const n = (compte.get(id) ?? 0) + 1;
      compte.set(id, n);
      rangs.set(a.id, n);
    }
    return { incidents: compte.size, rang: rangs };
  }, [ordered]);

  return (
    <section className="border border-border bg-surface">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Layers size={15} strokeWidth={1.75} className="text-text-secondary" />
        <h2 className="text-sm font-semibold uppercase tracking-widest text-text-secondary">
          Historique des alertes
        </h2>
        <span className="ml-auto font-mono text-[11px] text-text-muted">{ordered.length}</span>
        {incidents > 0 && (
          <Link
            to="/supervision"
            className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-text-muted transition-colors hover:bg-surface-hover hover:text-text-primary"
          >
            {incidents} incident{incidents > 1 ? 's' : ''}
            <ArrowUpRight size={12} strokeWidth={2} />
          </Link>
        )}
      </div>

      {ordered.length === 0 ? (
        <div className="flex flex-col items-center gap-1 px-4 py-10 text-center">
          <p className="text-sm font-medium text-text-primary">Aucune alerte sur 24 h</p>
          <p className="max-w-sm text-xs text-text-muted">
            Force brute, injections, rate limit et indisponibilités apparaîtront ici dès qu’ils sont détectés.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {ordered.map((alert) => {
            const severity = severityOf(alert);
            const styles = SEVERITY_STYLES[severity];
            const ip = alertIp(alert);
            return (
              <li key={alert.id} className="flex flex-col gap-1.5 px-4 py-3 sm:flex-row sm:items-start sm:gap-3">
                <div className="flex items-center gap-2 sm:w-44 sm:flex-shrink-0">
                  <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${styles.dot}`} />
                  <span className="font-mono text-[11px] text-text-muted">{formatDateTime(alert.occurredAt)}</span>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className={`rounded-sm border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider ${styles.chip}`}
                    >
                      {SEVERITY_LABELS[severity]}
                    </span>
                    <span className="text-sm font-medium text-text-primary">
                      {alertKindLabel(alert.payload?.kind)}
                    </span>
                    {ip && <span className="font-mono text-[11px] text-text-muted">{ip}</span>}
                    {(rang.get(alert.id) ?? 0) > 1 && (
                      <span
                        className="font-mono text-[10px] text-text-muted"
                        title="Cette alerte prolonge un incident déjà ouvert — ce n’est pas un problème de plus."
                      >
                        · {rang.get(alert.id)}ᵉ du même incident
                      </span>
                    )}
                  </div>
                  {alert.message && (
                    <p className="mt-0.5 break-words text-xs leading-relaxed text-text-secondary">{alert.message}</p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/* --------------------------- Report generation ---------------------------- */

/**
 * Builds the report body from the site's real data. Deliberately plain text
 * with headings rather than invented prose: every line here is traceable to a
 * figure amn-api produced, so the report can be handed to a client as-is.
 */
function buildReportBody(summary: SiteSummary, digest: SiteDigest | null): string {
  const lines: string[] = [];
  const now = new Date().toLocaleString('fr-FR');

  lines.push(`Site : ${summary.site.name}`);
  if (summary.site.url) lines.push(`URL : ${summary.site.url}`);
  lines.push(`Palier de supervision : ${TIER_LABELS[summary.site.tier]}`);
  lines.push(`Rapport généré le ${now}`);
  lines.push('');

  lines.push('## Score de sécurité');
  lines.push(`${summary.score.score}/100`);
  for (const reason of summary.score.reasons) lines.push(`- ${reason}`);
  lines.push('');

  lines.push('## Activité (dernières 24 h)');
  lines.push(`- Requêtes relevées : ${summary.totalRequests}`);
  lines.push(`- Visiteurs actifs au dernier relevé : ${summary.state?.activeVisitors ?? 0}`);
  lines.push(
    `- Dernier signe de vie : ${summary.state?.lastSeenAt ? new Date(summary.state.lastSeenAt).toLocaleString('fr-FR') : 'aucun'}`,
  );
  const peak = summary.traffic.reduce((max, p) => (p.count > max.count ? p : max), summary.traffic[0]);
  if (peak && peak.count > 0) {
    lines.push(`- Heure de pointe : ${formatHour(peak.at)} (${peak.count} requêtes)`);
  }
  lines.push('');

  lines.push('## Alertes (dernières 24 h)');
  if (summary.alerts.length === 0) {
    lines.push('Aucune alerte sur la période.');
  } else {
    const critical = summary.alerts.filter((a) => a.severity === 'critical').length;
    lines.push(`${summary.alerts.length} alerte(s), dont ${critical} critique(s).`);
    lines.push('');
    for (const alert of [...summary.alerts]
      .sort((a, b) => (b.occurredAt || '').localeCompare(a.occurredAt || ''))
      .slice(0, 40)) {
      const ip = alertIp(alert);
      lines.push(
        `- ${formatDateTime(alert.occurredAt)} · ${SEVERITY_LABELS[severityOf(alert)]} · ${alertKindLabel(
          alert.payload?.kind,
        )}${ip ? ` · ${ip}` : ''}${alert.message ? ` — ${alert.message}` : ''}`,
      );
    }
    if (summary.alerts.length > 40) lines.push(`- … et ${summary.alerts.length - 40} autre(s).`);
  }

  if (digest) {
    lines.push('');
    lines.push('## Synthèse hebdomadaire');
    lines.push(`- Événements sur 7 jours : ${digest.totalEvents}`);
    lines.push(`- Alertes sur 7 jours : ${digest.totalAlerts} (dont ${digest.criticalAlerts} critiques)`);
    if (digest.availability) {
      lines.push(
        `- Disponibilité (sondes indépendantes) : ${digest.availability.ratio}% (${digest.availability.ok}/${digest.availability.probes})`,
      );
    }
    const kinds = Object.entries(digest.alertsByKind);
    if (kinds.length > 0) {
      lines.push('- Répartition par type :');
      for (const [kind, count] of kinds) lines.push(`  - ${alertKindLabel(kind)} : ${count}`);
    }
    lines.push('');
    lines.push('## Recommandations');
    for (const recommendation of digest.recommendations) lines.push(`- ${recommendation}`);
  }

  return lines.join('\n');
}

/**
 * Certificate indicator for this site's host (BLOC 6). Reads the state amn-api
 * already holds rather than opening its own connection — the desk shows what
 * the monitor knows, and never becomes a second, disagreeing source of truth.
 */
function SslCard({ host }: { host: string }) {
  const [status, setStatus] = useState<SslStatus | null>(null);
  const [loading, setLoading] = useState(Boolean(host));

  useEffect(() => {
    if (!host) {
      setStatus(null);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    bridge()
      .remote.listSslStatus()
      .then((all) => {
        if (active) setStatus(all.find((s) => s.host === host) ?? null);
      })
      .catch(() => {
        if (active) setStatus(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [host]);

  if (!host) {
    return (
      <StatCard
        icon={Lock}
        label="Certificat TLS"
        value="—"
        hint="URL du site non renseignée"
      />
    );
  }

  const tone = status ? toneFor(status) : 'unknown';
  return (
    <StatCard
      icon={Lock}
      label="Certificat TLS"
      value={
        loading
          ? '…'
          : status?.daysLeft === null || status?.daysLeft === undefined
            ? '—'
            : status.daysLeft <= 0
              ? 'Expiré'
              : `${status.daysLeft} j`
      }
      hint={status ? sslSummary(status) : 'Pas encore vérifié'}
      tone={tone === 'expired' || tone === 'urgent' ? 'danger' : 'default'}
    />
  );
}
