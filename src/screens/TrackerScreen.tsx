import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Activity, BarChart3, Check, ChevronDown, Copy, Download, Globe, Layers, Radar, Settings2, Terminal } from 'lucide-react';
import { useRemoteSites, type DerivedSite } from '../state/RemoteSitesContext';
import { useTrackers } from '../state/useTrackers';
import { TRACKER_MODULES, moduleByKey, modulesByKeys, type TrackerModule } from '../data/trackerModules';
import { MaturityBadge } from '../components/tracker/MaturityBadge';
import { InstallWizard } from '../components/tracker/InstallWizard';
import { ConfirmDelete } from '../components/ConfirmDelete';
import { StaggerGroup, StaggerItem } from '../components/Stagger';
import { relativeTime } from '../lib/time';
import { postureScore, type PostureScore } from '../lib/trackerScore';

/** Freshness of a site's tracker data flow, derived from its last heartbeat. */
type Flow = { tone: 'live' | 'stale' | 'never'; label: string };

const STALE_AFTER_MS = 3 * 60 * 1000; // ~6x the default 30s heartbeat

function dataFlow(site: DerivedSite): Flow {
  const lastSeenAt = site.state?.lastSeenAt ?? null;
  const last = lastSeenAt ? new Date(lastSeenAt).getTime() : null;
  if (!last) return { tone: 'never', label: 'En attente de première remontée' };
  if (Date.now() - last > STALE_AFTER_MS) return { tone: 'stale', label: `Ne remonte plus (${relativeTime(lastSeenAt as string)})` };
  return { tone: 'live', label: 'Remonte des données en temps réel' };
}

const FLOW_DOT: Record<Flow['tone'], string> = {
  live: 'bg-success',
  stale: 'bg-danger animate-pulse',
  never: 'border border-text-muted bg-transparent',
};

export function TrackerScreen() {
  const { sites } = useRemoteSites();
  const { modulesForSite, totalInstalled } = useTrackers();
  const [wizard, setWizard] = useState<{ open: boolean; siteId?: string }>({ open: false });

  const installCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const site of sites) for (const key of modulesForSite(site.id)) counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, [sites, modulesForSite]);

  const equippedSites = sites.filter((s) => modulesForSite(s.id).length > 0);

  return (
    <StaggerGroup className="flex flex-col gap-6">
      <StaggerItem>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-text-primary">Trackers</h1>
            <p className="mt-1 font-mono text-xs uppercase tracking-widest text-text-muted">
              Modules de supervision installables · {totalInstalled} module{totalInstalled > 1 ? 's' : ''} déployé
              {totalInstalled > 1 ? 's' : ''} sur {equippedSites.length} site{equippedSites.length > 1 ? 's' : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setWizard({ open: true })}
            className="flex items-center gap-2 bg-accent px-4 py-2.5 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover"
          >
            <Download size={16} strokeWidth={2} />
            Installer un tracker
          </button>
        </div>
      </StaggerItem>

      {/* Modular catalog */}
      <StaggerItem>
        <div className="grid gap-3 md:grid-cols-3">
          {TRACKER_MODULES.map((mod) => (
            <ModuleCatalogCard key={mod.key} mod={mod} installCount={installCounts[mod.key] ?? 0} />
          ))}
        </div>
      </StaggerItem>

      {/* Site comparator */}
      {sites.length > 1 && (
        <StaggerItem>
          <SiteComparator />
        </StaggerItem>
      )}

      {/* Control desk */}
      <StaggerItem>
        <div className="flex items-center gap-2">
          <Radar size={16} strokeWidth={1.75} className="text-text-secondary" />
          <h2 className="text-sm font-semibold uppercase tracking-widest text-text-secondary">Bureau de contrôle</h2>
        </div>
      </StaggerItem>

      <StaggerItem>
        {sites.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-surface py-12 text-center">
            <Globe size={22} strokeWidth={1.5} className="text-text-muted" />
            <p className="text-sm font-medium text-text-primary">Aucun site enregistré</p>
            <p className="max-w-sm text-sm text-text-secondary">
              Enregistrez un site dans l’onglet Sites, puis installez un tracker pour le superviser ici.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {sites.map((site) => (
              <SiteControlRow key={site.id} site={site} onManage={() => setWizard({ open: true, siteId: site.id })} />
            ))}
          </div>
        )}
      </StaggerItem>

      <AnimatePresence>
        {wizard.open && <InstallWizard initialSiteId={wizard.siteId} onClose={() => setWizard({ open: false })} />}
      </AnimatePresence>
    </StaggerGroup>
  );
}

/** A self-contained install snippet for one module — copy-paste, no site required. */
function moduleSnippet(mod: TrackerModule): string {
  const mods = [...mod.requires, mod.key].join(',');
  return `# ${mod.name} — installation (Mode 1 : Express / Node)
# Le paquet n'est pas sur npm public : installation depuis GitHub.
npm install github:aaronsyaa-dev/security-monitor

# .env du site
AMN_API_URL=https://votre-amn-api
AMN_API_KEY=<clé fournie à l'enregistrement du site>
AMN_MODULES=${mods}

# Dans votre app (Express / Node)
import { createTracker } from '@amn-devsec/security-monitor';
const tracker = createTracker();
app.use(tracker.middleware());
tracker.start();

# Site serverless (Vercel/Netlify/Lambda) ? Mode 2 :
#   import { createServerlessMonitor } from '@amn-devsec/security-monitor/serverless';
#   export default createServerlessMonitor().withMonitor(handler);
# Site 100 % statique ? Mode 3 : inclure browser/amn-monitor.js via <script>.
# Le tracker ne transmet que des métadonnées (IP, endpoint, fréquence) —
# jamais le contenu des formulaires ni d'emails.`;
}

function ModuleCatalogCard({ mod, installCount }: { mod: TrackerModule; installCount: number }) {
  const [showCode, setShowCode] = useState(false);
  const [copied, setCopied] = useState(false);
  const snippet = moduleSnippet(mod);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="flex flex-col border border-border bg-surface p-4">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">Palier {mod.tier}</span>
        <MaturityBadge maturity={mod.maturity} />
      </div>
      <h2 className="mt-1.5 text-lg font-bold text-text-primary">{mod.name}</h2>
      <p className="text-xs font-medium text-text-secondary">{mod.tagline}</p>
      <p className="mt-3 text-xs leading-relaxed text-text-secondary">{mod.description}</p>
      <ul className="mt-3 flex flex-1 flex-col gap-1">
        {mod.capabilities.map((c) => (
          <li key={c} className="flex items-start gap-2 text-[11px] text-text-muted">
            <span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-current" />
            {c}
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() => setShowCode((v) => !v)}
        className="mt-3 flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-text-secondary transition-colors hover:bg-white/5 hover:text-text-primary"
      >
        <Terminal size={12} strokeWidth={1.75} />
        {showCode ? 'Masquer le code' : 'Voir le code d’installation'}
      </button>

      {showCode && (
        <div className="mt-2">
          <div className="mb-1 flex justify-end">
            <button
              type="button"
              onClick={copy}
              className="flex items-center gap-1.5 rounded-md border border-border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-text-secondary transition-colors hover:bg-white/5 hover:text-text-primary"
            >
              {copied ? <Check size={11} strokeWidth={2.5} /> : <Copy size={11} />}
              {copied ? 'Copié' : 'Copier'}
            </button>
          </div>
          <pre className="max-h-52 overflow-auto rounded-lg border border-border bg-bg p-2.5 font-mono text-[10px] leading-relaxed text-text-secondary">
            {snippet}
          </pre>
        </div>
      )}

      <p className="mt-3 border-t border-border pt-2 font-mono text-[10px] uppercase tracking-wider text-text-muted">
        {installCount ? `Installé sur ${installCount} site${installCount > 1 ? 's' : ''}` : 'Non installé'}
      </p>
    </div>
  );
}

const SCORE_TONE: Record<PostureScore['tone'], { bar: string; text: string }> = {
  good: { bar: 'bg-success', text: 'text-success' },
  watch: { bar: 'bg-warning', text: 'text-warning' },
  risk: { bar: 'bg-danger', text: 'text-danger' },
};

/**
 * Ranks all supervised sites by security posture (coverage + health − recent
 * incidents), worst first, so the site needing attention surfaces at a glance.
 * The score is transparent: each site lists the reasons behind its number.
 */
function SiteComparator() {
  const { sites } = useRemoteSites();
  const { modulesForSite } = useTrackers();

  const ranked = useMemo(
    () =>
      sites
        .map((site) => ({ site, posture: postureScore(site, modulesForSite(site.id)) }))
        .sort((a, b) => a.posture.score - b.posture.score),
    [sites, modulesForSite],
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <BarChart3 size={16} strokeWidth={1.75} className="text-text-secondary" />
        <h2 className="text-sm font-semibold uppercase tracking-widest text-text-secondary">Comparateur de sites</h2>
        <span className="font-mono text-[10px] uppercase tracking-wider text-text-muted">à surveiller en premier</span>
      </div>
      <div className="flex flex-col divide-y divide-border/60 rounded-xl border border-border bg-surface">
        {ranked.map(({ site, posture }, i) => (
          <div key={site.id} className="flex items-center gap-4 px-4 py-3">
            <span className="w-5 flex-shrink-0 font-mono text-xs text-text-muted">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <Globe size={13} strokeWidth={1.75} className="text-text-muted" />
                <span className="truncate text-sm font-medium text-text-primary">{site.name}</span>
              </div>
              <p className="mt-1 truncate text-xs text-text-muted">{posture.reasons.join(' · ')}</p>
            </div>
            <div className="hidden w-32 flex-shrink-0 sm:block">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                <div className={`h-full ${SCORE_TONE[posture.tone].bar}`} style={{ width: `${posture.score}%` }} />
              </div>
            </div>
            <span className={`w-10 flex-shrink-0 text-right font-mono text-sm font-semibold ${SCORE_TONE[posture.tone].text}`}>
              {posture.score}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SiteControlRow({ site, onManage }: { site: DerivedSite; onManage: () => void }) {
  const { modulesForSite, removeModule } = useTrackers();
  const [expanded, setExpanded] = useState(false);
  const installed = modulesForSite(site.id);
  const flow = dataFlow(site);
  const hasModules = installed.length > 0;

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.02]"
      >
        <span className={`h-2 w-2 flex-shrink-0 rounded-full ${hasModules ? FLOW_DOT[flow.tone] : 'bg-text-muted/40'}`} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Globe size={14} strokeWidth={1.75} className="text-text-muted" />
            <span className="truncate text-sm font-semibold text-text-primary">{site.name}</span>
          </div>
          <p className="mt-0.5 text-xs text-text-muted">
            {hasModules ? flow.label : 'Aucun module installé'}
          </p>
        </div>
        {/* Installed module chips */}
        <div className="hidden flex-shrink-0 items-center gap-1.5 sm:flex">
          {hasModules ? (
            modulesByKeys(installed).map((m) => (
              <span
                key={m.key}
                className="rounded-full border border-border-strong bg-bg px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-text-secondary"
              >
                {m.name.replace('AMN ', '')}
              </span>
            ))
          ) : (
            <span className="font-mono text-[10px] uppercase tracking-wider text-text-muted">—</span>
          )}
        </div>
        <ChevronDown
          size={16}
          strokeWidth={2}
          className={`flex-shrink-0 text-text-muted transition-transform ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden border-t border-border"
          >
            <div className="flex flex-col gap-3 p-4">
              {!hasModules ? (
                <p className="text-sm text-text-secondary">
                  Aucun module sur ce site.{' '}
                  <button type="button" onClick={onManage} className="text-text-primary underline underline-offset-2">
                    Installer un tracker
                  </button>
                  .
                </p>
              ) : (
                <>
                  {modulesByKeys(installed).map((m) => (
                    <ModuleStatusCard
                      key={m.key}
                      moduleKey={m.key}
                      site={site}
                      flow={flow}
                      onRemove={() => removeModule(site.id, m.key)}
                    />
                  ))}
                  <button
                    type="button"
                    onClick={onManage}
                    className="flex items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-white/5 hover:text-text-primary"
                  >
                    <Settings2 size={14} />
                    Gérer les modules
                  </button>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ModuleStatusCard({
  moduleKey,
  site,
  flow,
  onRemove,
}: {
  moduleKey: string;
  site: DerivedSite;
  flow: Flow;
  onRemove: () => void;
}) {
  const mod = moduleByKey(moduleKey);
  if (!mod) return null;

  return (
    <div className="rounded-lg border border-border bg-bg p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-text-primary">{mod.name}</span>
            <MaturityBadge maturity={mod.maturity} />
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-text-secondary">
            <span className={`h-1.5 w-1.5 rounded-full ${FLOW_DOT[flow.tone]}`} />
            {flow.label}
          </div>
        </div>
        <ConfirmDelete onConfirm={onRemove} label="Retirer" />
      </div>

      {/* Module-specific data section */}
      <div className="mt-3 border-t border-border/60 pt-2.5">
        <ModuleData moduleKey={moduleKey} site={site} flow={flow} />
      </div>
    </div>
  );
}

/**
 * Per-module data view. Sentinel surfaces the real alert signal already flowing
 * from the tracker (last alert timestamp + active visitors). Sentinel+/Suite
 * expose module-specific streams that require the corresponding tracker module
 * to be deployed and reporting — until then they are honestly labelled as
 * awaiting data rather than showing fabricated results.
 */
function ModuleData({ moduleKey, site, flow }: { moduleKey: string; site: DerivedSite; flow: Flow }) {
  if (moduleKey === 'sentinel') {
    const visitors = site.state?.activeVisitors ?? 0;
    const lastAlert = site.state?.lastAlertAt;
    return (
      <div className="grid grid-cols-2 gap-3">
        <Metric icon={Activity} label="Visiteurs actifs" value={flow.tone === 'never' ? '—' : String(visitors)} />
        <Metric
          icon={Layers}
          label="Dernière alerte"
          value={lastAlert ? relativeTime(lastAlert) : 'Aucune'}
        />
      </div>
    );
  }

  // Advanced modules: data stream pending the tracker module deployment.
  const hint =
    moduleKey === 'sentinel-plus'
      ? 'Anomalies de trafic & réputation IP'
      : 'Disponibilité active & scan de dépendances';
  return (
    <div className="flex items-center gap-2 text-xs text-text-muted">
      <span className="h-1.5 w-1.5 rounded-full border border-text-muted" />
      <span>
        {hint} — <span className="text-text-secondary">en attente de remontée du module</span> (déployez le script sur le
        site pour activer ce flux).
      </span>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon size={14} strokeWidth={1.75} className="text-text-muted" />
      <div>
        <p className="font-mono text-[9px] uppercase tracking-widest text-text-muted">{label}</p>
        <p className="text-sm font-semibold text-text-primary">{value}</p>
      </div>
    </div>
  );
}
