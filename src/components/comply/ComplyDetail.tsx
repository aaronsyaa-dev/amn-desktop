import React, { useState } from 'react';
import { Check, ChevronDown, ShieldCheck, X } from 'lucide-react';
import {
  SEVERITY_CHIP,
  SEVERITY_LABEL,
  SEVERITY_ORDER,
  SEVERITY_TEXT,
  scoreColor,
} from '../../lib/scanSeverity';
import { relativeTime } from '../../lib/time';
import type { ComplyCheck, ComplyFinding, ComplyResults, ScanSeverity } from '../../shared/api';

/**
 * A completed RGPD check's full detail: score, per-point pass/fail list, the
 * detected third-party trackers, and the expandable finding list.
 *
 * Self-contained (it only needs the `check` row) so it renders identically from
 * ComplyScreen and from the "RGPD" filter in ReportsScreen — same reasoning as
 * ScanDetail for the Scanner.
 */
export function ComplyDetail({ check }: { check: ComplyCheck }) {
  const results = check.results as ComplyResults;
  const findings = results?.findings ?? [];

  if (!results?.target) {
    return (
      <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-text-muted">
        {check.status === 'error' ? check.error ?? 'Cette analyse a échoué.' : 'Analyse en cours…'}
      </div>
    );
  }

  const counters = SEVERITY_ORDER.map((sev) => ({ sev, n: results.summary?.[sev] ?? 0 }));

  return (
    <section className="border border-border bg-surface">
      <header className="flex flex-col gap-4 border-b border-border p-4 sm:p-5 md:flex-row md:items-center">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-text-primary">{results.target.host}</p>
          <p className="mt-0.5 truncate font-mono text-[10px] uppercase tracking-wider text-text-muted">
            Conformité RGPD · {relativeTime(check.createdAt)}
          </p>
        </div>

        <div className="flex items-center gap-5">
          <div className="text-right">
            <span className={`font-mono text-3xl font-semibold leading-none ${scoreColor(check.score)}`}>
              {check.score}
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
      </header>

      {/* Per-point checklist — shows what passed, not only what failed. */}
      {results.checks?.length > 0 && (
        <ul className="grid grid-cols-1 gap-x-6 gap-y-1.5 border-b border-border px-4 py-3.5 sm:grid-cols-2 sm:px-5">
          {results.checks.map((c) => (
            <li key={c.key} className="flex items-center gap-2 text-xs">
              {c.passed ? (
                <Check size={13} className="flex-shrink-0 text-success" strokeWidth={2.5} />
              ) : (
                <X size={13} className="flex-shrink-0 text-danger" strokeWidth={2.5} />
              )}
              <span className={c.passed ? 'text-text-secondary' : 'text-text-primary'}>{c.label}</span>
            </li>
          ))}
        </ul>
      )}

      {results.trackers?.length > 0 && (
        <div className="border-b border-border px-4 py-3 sm:px-5">
          <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
            Traceurs tiers détectés
          </span>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {results.trackers.map((t) => (
              <span
                key={t}
                className="border border-border bg-bg px-1.5 py-0.5 font-mono text-[10px] text-text-secondary"
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      )}

      {findings.length === 0 ? (
        <p className="flex items-center justify-center gap-2 px-4 py-10 text-center text-sm text-success">
          <ShieldCheck size={16} />
          Aucun manquement détecté sur les points vérifiés.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {findings.map((f) => (
            <ComplyFindingRow key={f.id} finding={f} />
          ))}
        </ul>
      )}
    </section>
  );
}

/** One RGPD gap: severity chip + title, expandable to explanation + fix. */
function ComplyFindingRow({ finding }: { finding: ComplyFinding }) {
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
          {finding.article && (
            <span className="mt-0.5 block font-mono text-[10px] uppercase tracking-wider text-text-muted">
              {finding.article}
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
