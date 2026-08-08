import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  ChevronDown,
  Clock,
  FileDown,
  Loader2,
  ScanLine,
  ShieldCheck,
} from 'lucide-react';
import { bridge } from '../lib/bridge';
import { useSync } from '../state/SyncContext';
import {
  SEVERITY_CHIP,
  SEVERITY_LABEL,
  SEVERITY_ORDER,
  SEVERITY_TEXT,
  TIER_BLURB,
  TIER_LABEL,
  scoreColor,
} from '../lib/scanSeverity';
import { relativeTime } from '../lib/time';
import type { Scan, ScanFinding, ScanProgress, ScanResults, ScanSeverity, ScanTier } from '../shared/api';

const TIERS: ScanTier[] = ['lite', 'pro', 'elite'];

/**
 * Scanner — passive security audit of a public URL (produit AMN DevSec).
 *
 * The scan itself runs on amn-api, never from this machine: the operator types
 * a URL, picks a tier, and follows the run through `scan:progress` frames
 * pushed over the same WebSocket that carries the workspace sync. Results,
 * history and the Elite PDF are all read back from amn-api, so both operators
 * see the same scan history.
 */
export function ScannerScreen() {
  const { configured } = useSync();
  const [url, setUrl] = useState('');
  const [tier, setTier] = useState<ScanTier>('pro');
  const [history, setHistory] = useState<Scan[]>([]);
  const [selected, setSelected] = useState<Scan | null>(null);
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Id of the scan this screen is currently following, so progress frames for
  // a scan launched by the *other* operator don't hijack the view.
  const runningId = useRef<string | null>(null);

  const refreshHistory = useCallback(async () => {
    try {
      setHistory(await bridge().remote.listScans());
    } catch {
      /* offline: keep whatever list we already have */
    }
  }, []);

  useEffect(() => {
    if (configured) void refreshHistory();
  }, [configured, refreshHistory]);

  // Live progress. Subscribing unconditionally keeps the hook order stable;
  // frames for other scans are filtered by id below.
  useEffect(() => {
    return bridge().remote.onScanProgress((frame) => {
      if (frame.scanId !== runningId.current) return;
      setProgress(frame);
      if (frame.status === 'done') {
        runningId.current = null;
        setBusy(false);
        if (frame.scan) setSelected(frame.scan);
        void refreshHistory();
      } else if (frame.status === 'error') {
        runningId.current = null;
        setBusy(false);
        setError(frame.error ?? 'Le scan a échoué.');
        void refreshHistory();
      }
    });
  }, [refreshHistory]);

  const launch = async () => {
    const target = url.trim();
    if (!target || busy) return;
    setError(null);
    setSelected(null);
    setBusy(true);
    setProgress({ scanId: '', status: 'pending', step: 'Envoi de la demande…', pct: 0 });
    try {
      const scan = await bridge().remote.startScan(target, tier);
      runningId.current = scan.id;
      setProgress({ scanId: scan.id, status: 'pending', step: 'Scan en file d’attente…', pct: 0 });
      void refreshHistory();
    } catch (err) {
      setBusy(false);
      setProgress(null);
      setError(err instanceof Error ? err.message : 'Impossible de lancer le scan.');
    }
  };

  const openScan = async (scan: Scan) => {
    setError(null);
    setProgress(null);
    try {
      setSelected(await bridge().remote.getScan(scan.id));
    } catch {
      setSelected(scan);
    }
  };

  const results = selected?.results as ScanResults | undefined;
  const findings = results?.findings ?? [];

  if (!configured) {
    return (
      <div className="mx-auto max-w-2xl py-20 text-center">
        <ScanLine size={28} className="mx-auto mb-4 text-text-muted" strokeWidth={1.5} />
        <h1 className="text-xl font-semibold text-text-primary">Scanner indisponible</h1>
        <p className="mt-2 text-sm text-text-secondary">
          Le scanner s’exécute sur amn-api. Cette instance n’est pas reliée à l’API centrale —
          renseignez l’URL de l’API dans la configuration pour l’activer.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-text-primary">Scanner</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Audit de sécurité passif — détection sans exploitation. Le scan part d’amn-api, jamais de ce poste.
        </p>
      </header>

      {/* ---------------------------- Launch form ---------------------------- */}
      <section className="border border-border bg-surface p-4 sm:p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <label className="flex-1">
            <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-widest text-text-muted">
              URL à auditer
            </span>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void launch();
              }}
              placeholder="https://exemple.com"
              disabled={busy}
              className="input-focus w-full border border-border bg-bg px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted disabled:opacity-50"
            />
          </label>

          <label className="md:w-44">
            <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-widest text-text-muted">
              Palier
            </span>
            <div className="relative">
              <select
                value={tier}
                onChange={(e) => setTier(e.target.value as ScanTier)}
                disabled={busy}
                className="input-focus w-full appearance-none border border-border bg-bg px-3 py-2.5 pr-9 text-sm text-text-primary disabled:opacity-50"
              >
                {TIERS.map((t) => (
                  <option key={t} value={t}>
                    {TIER_LABEL[t]}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={15}
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-muted"
              />
            </div>
          </label>

          <button
            type="button"
            onClick={() => void launch()}
            disabled={busy || !url.trim()}
            className="flex items-center justify-center gap-2 border border-border-strong bg-text-primary px-5 py-2.5 text-sm font-medium text-bg transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : <ScanLine size={15} />}
            {busy ? 'Scan en cours…' : 'Lancer le scan'}
          </button>
        </div>

        <p className="mt-2.5 text-xs text-text-muted">{TIER_BLURB[tier]}</p>

        {error && (
          <p className="mt-3 flex items-start gap-2 border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
            <AlertTriangle size={14} className="mt-px flex-shrink-0" />
            {error}
          </p>
        )}
      </section>

      {/* ----------------------------- Progress ------------------------------ */}
      {progress && busy && (
        <section className="border border-border bg-surface p-4 sm:p-5">
          <div className="mb-2.5 flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-sm text-text-primary">
              <Loader2 size={14} className="animate-spin text-text-secondary" />
              {progress.step}
            </span>
            <span className="font-mono text-xs text-text-muted">{progress.pct}%</span>
          </div>
          <div className="h-1 w-full overflow-hidden bg-bg">
            <motion.div
              className="h-full bg-text-primary"
              animate={{ width: `${progress.pct}%` }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
        </section>
      )}

      {/* ------------------------------ Results ------------------------------ */}
      {selected && results?.target && (
        <ScanResultsPanel scan={selected} results={results} findings={findings} />
      )}

      {/* ------------------------------ History ------------------------------ */}
      <section>
        <h2 className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-text-muted">
          Historique
        </h2>
        {history.length === 0 ? (
          <p className="border border-border bg-surface px-4 py-6 text-center text-sm text-text-muted">
            Aucun scan pour l’instant.
          </p>
        ) : (
          <div className="flex flex-col divide-y divide-border border border-border bg-surface">
            {history.map((scan) => (
              <button
                key={scan.id}
                type="button"
                onClick={() => void openScan(scan)}
                className={`flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-hover ${
                  selected?.id === scan.id ? 'bg-surface-hover' : ''
                }`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-text-primary">{scan.url}</span>
                  <span className="mt-0.5 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-text-muted">
                    <Clock size={10} />
                    {relativeTime(scan.createdAt)} · {TIER_LABEL[scan.tier] ?? scan.tier}
                  </span>
                </span>
                {scan.status === 'error' ? (
                  <span className="flex-shrink-0 font-mono text-[10px] uppercase tracking-wider text-danger">
                    Échec
                  </span>
                ) : scan.status === 'done' ? (
                  <span className={`flex-shrink-0 font-mono text-sm font-semibold ${scoreColor(scan.score)}`}>
                    {scan.score}
                    <span className="text-[10px] text-text-muted">/100</span>
                  </span>
                ) : (
                  <Loader2 size={13} className="flex-shrink-0 animate-spin text-text-muted" />
                )}
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/** Score, severity counters, Elite PDF button, then the finding list. */
function ScanResultsPanel({
  scan,
  results,
  findings,
}: {
  scan: Scan;
  results: ScanResults;
  findings: ScanFinding[];
}) {
  const [downloading, setDownloading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  const counters = useMemo(
    () => SEVERITY_ORDER.map((sev) => ({ sev, n: results.summary?.[sev] ?? 0 })),
    [results.summary],
  );

  const openReport = async () => {
    setDownloading(true);
    setReportError(null);
    try {
      const href = await bridge().remote.scanReportUrl(scan.id);
      // Opened in a new window: the operator prints it to PDF from there, the
      // same "Save as PDF" path the other AMN reports already use.
      window.open(href, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setReportError(err instanceof Error ? err.message : 'Rapport indisponible.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <section className="border border-border bg-surface">
      <header className="flex flex-col gap-4 border-b border-border p-4 sm:p-5 md:flex-row md:items-center">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-text-primary">{results.target.host}</p>
          <p className="mt-0.5 truncate font-mono text-[10px] uppercase tracking-wider text-text-muted">
            {TIER_LABEL[scan.tier] ?? scan.tier} · {relativeTime(scan.createdAt)}
            {results.cms ? ` · ${results.cms.name}${results.cms.version ? ` ${results.cms.version}` : ''}` : ''}
          </p>
        </div>

        <div className="flex items-center gap-5">
          <div className="text-right">
            <span className={`font-mono text-3xl font-semibold leading-none ${scoreColor(scan.score)}`}>
              {scan.score}
            </span>
            <span className="font-mono text-xs text-text-muted">/100</span>
          </div>
          <div className="flex gap-3">
            {counters.map(({ sev, n }) => (
              <div key={sev} className="text-center">
                <span className={`block font-mono text-base font-semibold leading-none ${SEVERITY_TEXT[sev]}`}>
                  {n}
                </span>
                <span className="mt-1 block font-mono text-[8px] uppercase tracking-widest text-text-muted">
                  {SEVERITY_LABEL[sev]}
                </span>
              </div>
            ))}
          </div>
        </div>

        {scan.tier === 'elite' && (
          <button
            type="button"
            onClick={() => void openReport()}
            disabled={downloading}
            className="flex flex-shrink-0 items-center justify-center gap-2 border border-border px-3.5 py-2 text-xs text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary disabled:opacity-50"
          >
            {downloading ? <Loader2 size={13} className="animate-spin" /> : <FileDown size={13} />}
            Rapport PDF
          </button>
        )}
      </header>

      {reportError && (
        <p className="border-b border-border px-4 py-2 text-xs text-danger sm:px-5">{reportError}</p>
      )}

      {/* Elite before/after against the previous scan of the same URL. */}
      {results.comparison && (
        <div className="border-b border-border px-4 py-3 text-xs text-text-secondary sm:px-5">
          <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
            Depuis le scan précédent
          </span>
          <p className="mt-1.5">
            <span className="text-success">{results.comparison.resolved.length} corrigée(s)</span>
            {' · '}
            <span className="text-danger">{results.comparison.introduced.length} nouvelle(s)</span>
            {' · '}
            <span>{results.comparison.unchangedCount} inchangée(s)</span>
            {results.comparison.previousScore != null && (
              <span className="text-text-muted"> · score précédent {results.comparison.previousScore}/100</span>
            )}
          </p>
        </div>
      )}

      {findings.length === 0 ? (
        <p className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-success">
          <ShieldCheck size={16} />
          Aucune faille détectée sur ce périmètre.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {findings.map((f) => (
            <FindingRow key={f.id} finding={f} />
          ))}
        </ul>
      )}
    </section>
  );
}

/** One finding: severity chip + title, expandable to detail + fix. */
function FindingRow({ finding }: { finding: ScanFinding }) {
  const [open, setOpen] = useState(false);
  const severity = finding.severity as ScanSeverity;

  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-hover sm:px-5"
      >
        <span
          className={`mt-0.5 flex-shrink-0 border px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider ${SEVERITY_CHIP[severity]}`}
        >
          {SEVERITY_LABEL[severity]}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm text-text-primary">{finding.title}</span>
          {finding.owasp && (
            <span className="mt-0.5 block font-mono text-[10px] uppercase tracking-wider text-text-muted">
              {finding.owasp}
              {finding.cve ? ` · ${finding.cve}` : ''}
            </span>
          )}
        </span>
        <ChevronDown
          size={14}
          className={`mt-1 flex-shrink-0 text-text-muted transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="space-y-2.5 border-t border-border bg-bg/40 px-4 py-3 sm:px-5">
          <p className="text-xs leading-relaxed text-text-secondary">{finding.detail}</p>
          {finding.evidence && (
            <p className="break-all border-l-2 border-border pl-2.5 font-mono text-[10px] text-text-muted">
              {finding.evidence}
            </p>
          )}
          <div>
            <span className="font-mono text-[9px] uppercase tracking-widest text-text-muted">
              Recommandation
            </span>
            <p className="mt-1 text-xs leading-relaxed text-text-primary">{finding.recommendation}</p>
          </div>
        </div>
      )}
    </li>
  );
}
