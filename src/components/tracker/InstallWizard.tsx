import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check, Copy, Globe, KeyRound, Layers, Terminal, X } from 'lucide-react';
import { useRemoteSites, type DerivedSite } from '../../state/RemoteSitesContext';
import { useTrackers } from '../../state/useTrackers';
import { TRACKER_MODULES, MATURITY_META, moduleByKey } from '../../data/trackerModules';
import { MaturityBadge } from './MaturityBadge';

type Step = 0 | 1 | 2;

const STEPS = ['Site cible', 'Modules', 'Installation'];

/**
 * Guided, premium install flow: choose a registered site → choose the modules
 * (paliers) to activate → get a personalized install script with the API key
 * baked in and step-by-step instructions. Confirming persists the site's
 * module set (via useTrackers) so the control desk reflects it.
 */
export function InstallWizard({ initialSiteId, onClose }: { initialSiteId?: string; onClose: () => void }) {
  const { sites } = useRemoteSites();
  const { modulesForSite, setModules } = useTrackers();

  const [step, setStep] = useState<Step>(initialSiteId ? 1 : 0);
  const [siteId, setSiteId] = useState<string | null>(initialSiteId ?? null);
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(initialSiteId ? modulesForSite(initialSiteId) : ['sentinel']),
  );
  const [apiUrl, setApiUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [copied, setCopied] = useState(false);
  const [done, setDone] = useState(false);

  const site = sites.find((s) => s.id === siteId) ?? null;

  const toggleModule = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      const mod = moduleByKey(key);
      if (next.has(key)) {
        next.delete(key);
        // Remove modules that depend on this one.
        for (const m of TRACKER_MODULES) {
          if (m.requires.includes(key)) next.delete(m.key);
        }
      } else {
        // Pull in required modules.
        for (const req of mod?.requires ?? []) next.add(req);
        next.add(key);
      }
      return next;
    });
  };

  const selectedKeys = useMemo(
    () => TRACKER_MODULES.filter((m) => selected.has(m.key)).map((m) => m.key),
    [selected],
  );

  const script = useMemo(
    () => buildScript({ modules: selectedKeys, apiUrl, apiKey }),
    [selectedKeys, apiUrl, apiKey],
  );

  const canNext = step === 0 ? Boolean(siteId) : step === 1 ? selectedKeys.length > 0 : true;

  const copyScript = async () => {
    try {
      await navigator.clipboard.writeText(script);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable */
    }
  };

  const confirm = () => {
    if (!siteId) return;
    setModules(siteId, selectedKeys);
    setDone(true);
    window.setTimeout(onClose, 900);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[190] flex items-center justify-center bg-black/70 px-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.98 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="relative flex max-h-[86vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl"
      >
        {/* Header + stepper */}
        <div className="border-b border-border px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold tracking-tight text-text-primary">Installer un tracker</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fermer"
              className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-white/5 hover:text-text-primary"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-4 flex items-center gap-2">
            {STEPS.map((label, i) => (
              <React.Fragment key={label}>
                <div className="flex items-center gap-2">
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-semibold transition-colors ${
                      i < step
                        ? 'border-accent bg-accent text-bg'
                        : i === step
                          ? 'border-accent text-text-primary'
                          : 'border-border text-text-muted'
                    }`}
                  >
                    {i < step ? <Check size={12} strokeWidth={2.5} /> : i + 1}
                  </span>
                  <span className={`text-xs ${i === step ? 'text-text-primary' : 'text-text-muted'}`}>{label}</span>
                </div>
                {i < STEPS.length - 1 && <span className="h-px flex-1 bg-border" />}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            >
              {step === 0 && <StepSite sites={sites} siteId={siteId} onPick={setSiteId} />}
              {step === 1 && <StepModules selected={selected} onToggle={toggleModule} />}
              {step === 2 && (
                <StepInstall
                  site={site}
                  selectedKeys={selectedKeys}
                  apiUrl={apiUrl}
                  apiKey={apiKey}
                  onApiUrl={setApiUrl}
                  onApiKey={setApiKey}
                  script={script}
                  copied={copied}
                  onCopy={copyScript}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer nav */}
        <div className="flex items-center justify-between border-t border-border px-6 py-4">
          <button
            type="button"
            onClick={() => (step === 0 ? onClose() : setStep((s) => (s - 1) as Step))}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-white/5 hover:text-text-primary"
          >
            <ArrowLeft size={14} />
            {step === 0 ? 'Annuler' : 'Retour'}
          </button>
          {step < 2 ? (
            <button
              type="button"
              disabled={!canNext}
              onClick={() => setStep((s) => (s + 1) as Step)}
              className="flex items-center gap-1.5 bg-accent px-4 py-2 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover disabled:opacity-40"
            >
              Continuer
              <ArrowRight size={14} />
            </button>
          ) : (
            <button
              type="button"
              onClick={confirm}
              disabled={done}
              className="flex items-center gap-1.5 bg-accent px-4 py-2 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover disabled:opacity-60"
            >
              {done ? <Check size={15} strokeWidth={2.5} /> : <Layers size={15} />}
              {done ? 'Enregistré' : 'Confirmer l’installation'}
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function StepSite({
  sites,
  siteId,
  onPick,
}: {
  sites: DerivedSite[];
  siteId: string | null;
  onPick: (id: string) => void;
}) {
  if (sites.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-10 text-center">
        <Globe size={22} strokeWidth={1.5} className="text-text-muted" />
        <p className="text-sm font-medium text-text-primary">Aucun site enregistré</p>
        <p className="max-w-sm text-sm text-text-secondary">
          Enregistrez d’abord un site dans l’onglet <span className="text-text-primary">Sites</span> pour obtenir sa clé
          API, puis revenez ici.
        </p>
      </div>
    );
  }
  return (
    <div>
      <p className="mb-3 text-sm text-text-secondary">Sur quel site installer le tracker ?</p>
      <div className="flex flex-col gap-2">
        {sites.map((site) => (
          <button
            key={site.id}
            type="button"
            onClick={() => onPick(site.id)}
            className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
              siteId === site.id ? 'border-accent bg-accent-muted' : 'border-border hover:bg-white/[0.03]'
            }`}
          >
            <span className="flex items-center gap-2.5">
              <Globe size={15} strokeWidth={1.75} className="text-text-muted" />
              <span className="text-sm font-medium text-text-primary">{site.name}</span>
            </span>
            <span
              className={`flex h-4 w-4 items-center justify-center rounded-full border ${
                siteId === site.id ? 'border-accent bg-accent' : 'border-border-strong'
              }`}
            >
              {siteId === site.id && <Check size={11} strokeWidth={3} className="text-bg" />}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function StepModules({ selected, onToggle }: { selected: Set<string>; onToggle: (key: string) => void }) {
  return (
    <div>
      <p className="mb-3 text-sm text-text-secondary">
        Choisissez les modules à activer. Chaque module est indépendant — vous pourrez en ajouter ou en retirer plus
        tard.
      </p>
      <div className="flex flex-col gap-2.5">
        {TRACKER_MODULES.map((mod) => {
          const on = selected.has(mod.key);
          const requiredBy = TRACKER_MODULES.filter((m) => selected.has(m.key) && m.requires.includes(mod.key));
          const lockedOn = on && requiredBy.length > 0;
          return (
            <button
              key={mod.key}
              type="button"
              onClick={() => !lockedOn && onToggle(mod.key)}
              className={`rounded-xl border p-4 text-left transition-colors ${
                on ? 'border-accent bg-accent-muted' : 'border-border hover:bg-white/[0.03]'
              } ${lockedOn ? 'cursor-not-allowed opacity-90' : ''}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
                      Palier {mod.tier}
                    </span>
                    <MaturityBadge maturity={mod.maturity} />
                  </div>
                  <h3 className="mt-0.5 text-sm font-semibold text-text-primary">{mod.name}</h3>
                  <p className="mt-0.5 text-xs text-text-secondary">{mod.tagline}</p>
                </div>
                <span
                  className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border ${
                    on ? 'border-accent bg-accent' : 'border-border-strong'
                  }`}
                >
                  {on && <Check size={13} strokeWidth={3} className="text-bg" />}
                </span>
              </div>
              {mod.requires.length > 0 && (
                <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-text-muted">
                  Nécessite : {mod.requires.map((r) => moduleByKey(r)?.name ?? r).join(', ')}
                </p>
              )}
              {lockedOn && (
                <p className="mt-1 text-[11px] text-text-muted">
                  Requis par {requiredBy.map((m) => m.name).join(', ')} — retirez-le d’abord.
                </p>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StepInstall({
  site,
  selectedKeys,
  apiUrl,
  apiKey,
  onApiUrl,
  onApiKey,
  script,
  copied,
  onCopy,
}: {
  site: DerivedSite | null;
  selectedKeys: string[];
  apiUrl: string;
  apiKey: string;
  onApiUrl: (v: string) => void;
  onApiKey: (v: string) => void;
  script: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-border bg-bg p-3">
        <p className="text-xs text-text-secondary">
          <span className="text-text-primary">{site?.name ?? 'Site'}</span> ·{' '}
          {selectedKeys.map((k) => moduleByKey(k)?.name ?? k).join(', ')}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-text-muted">
            <Globe size={11} /> URL de l’API AMN
          </span>
          <input
            value={apiUrl}
            onChange={(e) => onApiUrl(e.target.value)}
            placeholder="https://votre-amn-api…"
            className="input-focus border border-border bg-bg px-3 py-2 font-mono text-xs text-text-primary outline-none placeholder:text-text-muted"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-text-muted">
            <KeyRound size={11} /> Clé API du site
          </span>
          <input
            value={apiKey}
            onChange={(e) => onApiKey(e.target.value)}
            placeholder="clé fournie à l’enregistrement"
            className="input-focus border border-border bg-bg px-3 py-2 font-mono text-xs text-text-primary outline-none placeholder:text-text-muted"
          />
        </label>
      </div>
      <p className="-mt-1 text-[11px] text-text-muted">
        La clé API n’est affichée qu’une seule fois, au moment de l’enregistrement du site. Collez-la ici pour l’intégrer
        directement au script ; sinon un espace réservé est laissé.
      </p>

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-text-muted">
            <Terminal size={11} /> Script d’installation personnalisé
          </span>
          <button
            type="button"
            onClick={onCopy}
            className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs text-text-secondary transition-colors hover:bg-white/5 hover:text-text-primary"
          >
            {copied ? <Check size={12} strokeWidth={2.5} /> : <Copy size={12} />}
            {copied ? 'Copié' : 'Copier'}
          </button>
        </div>
        <pre className="max-h-64 overflow-auto rounded-xl border border-border bg-bg p-3 font-mono text-[11px] leading-relaxed text-text-secondary">
          {script}
        </pre>
      </div>

      <p className="text-[11px] text-text-muted">
        Cliquez sur « Confirmer l’installation » pour enregistrer les modules choisis sur ce site : ils apparaîtront dans
        le bureau de contrôle et remonteront leurs données une fois le script déployé.
      </p>
    </div>
  );
}

function buildScript({ modules, apiUrl, apiKey }: { modules: string[]; apiUrl: string; apiKey: string }): string {
  const url = apiUrl.trim() || 'https://votre-amn-api';
  const key = apiKey.trim() || '<VOTRE_CLÉ_API_AMN>';
  return `# 1 — Installer le tracker AMN
npm install @amn-devsec/security-monitor

# 2 — Configurer l'environnement (.env)
AMN_API_URL=${url}
AMN_API_KEY=${key}
AMN_MODULES=${modules.join(',')}

# 3 — Brancher dans votre application (Express / Node)
import { createTracker } from '@amn-devsec/security-monitor';

const tracker = createTracker();  // lit AMN_MODULES depuis .env
app.use(tracker.middleware());    // active uniquement les modules choisis
tracker.start();                  // heartbeat + remontée vers AMN`;
}

export { MATURITY_META };
