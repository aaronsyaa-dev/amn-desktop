import React, { useMemo, useState } from 'react';
import { ChevronDown, FileDown, Loader2, ShieldCheck } from 'lucide-react';
import { bridge } from '../../lib/bridge';
import {
  SEVERITY_CHIP,
  SEVERITY_LABEL,
  SEVERITY_ORDER,
  SEVERITY_TEXT,
  TIER_LABEL,
  scoreColor,
} from '../../lib/scanSeverity';
import { relativeTime } from '../../lib/time';
import type { Scan, ScanFinding, ScanResults, ScanSeverity } from '../../shared/api';

/**
 * A completed scan's full detail: score, severity counters, Elite PDF button,
 * the before/after comparison (Elite), and the expandable finding list.
 *
 * Self-contained on purpose — it only needs the `scan` row — so it renders
 * identically from ScannerScreen (after launching a scan) and from
 * ReportsScreen (picking a past Elite scan out of the "Scanner" filter): one
 * place owns the PDF download and the finding presentation, so the two never
 * drift apart.
 */
export function ScanDetail({ scan }: { scan: Scan }) {
  const [downloading, setDownloading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  const results = scan.results as ScanResults;
  const findings = results?.findings ?? [];

  const counters = useMemo(
    () => SEVERITY_ORDER.map((sev) => ({ sev, n: results?.summary?.[sev] ?? 0 })),
    [results?.summary],
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

  if (!results?.target) {
    return (
      <div className="flex flex-1 items-center justify-center p-6 text-sm text-text-muted">
        {scan.status === 'error' ? scan.error ?? 'Ce scan a échoué.' : 'Scan en cours…'}
      </div>
    );
  }

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
            Télécharger le rapport PDF
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
