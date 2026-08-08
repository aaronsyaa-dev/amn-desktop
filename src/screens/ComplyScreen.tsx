import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, BadgeCheck, Clock, Loader2 } from 'lucide-react';
import { bridge } from '../lib/bridge';
import { useSync } from '../state/SyncContext';
import { ComplyDetail } from '../components/comply/ComplyDetail';
import { scoreColor } from '../lib/scanSeverity';
import { relativeTime } from '../lib/time';
import type { ComplyCheck, ComplyProgress } from '../shared/api';

/**
 * Comply — basic RGPD conformity check of a public URL (produit AMN DevSec).
 *
 * Same shape as the Scanner: the analysis runs on amn-api, the operator follows
 * it through `comply:progress` frames on the shared WebSocket, and the history
 * is read back from amn-api so both operators see the same checks.
 */
export function ComplyScreen() {
  const { configured } = useSync();
  const [url, setUrl] = useState('');
  const [history, setHistory] = useState<ComplyCheck[]>([]);
  const [selected, setSelected] = useState<ComplyCheck | null>(null);
  const [progress, setProgress] = useState<ComplyProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Id of the check this screen follows, so frames for a check launched by the
  // other operator don't hijack the view.
  const runningId = useRef<string | null>(null);

  const refreshHistory = useCallback(async () => {
    try {
      setHistory(await bridge().remote.listComplyChecks());
    } catch {
      /* offline: keep whatever list we already have */
    }
  }, []);

  useEffect(() => {
    if (configured) void refreshHistory();
  }, [configured, refreshHistory]);

  useEffect(() => {
    return bridge().remote.onComplyProgress((frame) => {
      if (frame.checkId !== runningId.current) return;
      setProgress(frame);
      if (frame.status === 'done') {
        runningId.current = null;
        setBusy(false);
        if (frame.check) setSelected(frame.check);
        void refreshHistory();
      } else if (frame.status === 'error') {
        runningId.current = null;
        setBusy(false);
        setError(frame.error ?? 'L’analyse a échoué.');
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
    setProgress({ checkId: '', status: 'pending', step: 'Envoi de la demande…', pct: 0 });
    try {
      const check = await bridge().remote.startComply(target);
      runningId.current = check.id;
      setProgress({ checkId: check.id, status: 'pending', step: 'Analyse en file d’attente…', pct: 0 });
      void refreshHistory();
    } catch (err) {
      setBusy(false);
      setProgress(null);
      setError(err instanceof Error ? err.message : 'Impossible de lancer l’analyse.');
    }
  };

  const openCheck = async (check: ComplyCheck) => {
    setError(null);
    setProgress(null);
    try {
      setSelected(await bridge().remote.getComplyCheck(check.id));
    } catch {
      setSelected(check);
    }
  };

  if (!configured) {
    return (
      <div className="mx-auto max-w-2xl py-20 text-center">
        <BadgeCheck size={28} className="mx-auto mb-4 text-text-muted" strokeWidth={1.5} />
        <h1 className="text-xl font-semibold text-text-primary">Comply indisponible</h1>
        <p className="mt-2 text-sm text-text-secondary">
          L’analyse de conformité s’exécute sur amn-api. Cette instance n’est pas reliée à l’API
          centrale — renseignez l’URL de l’API dans la configuration pour l’activer.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-text-primary">Comply</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Conformité RGPD de base — analyse passive d’une page publique. Indicateur de première
          ligne, pas un audit juridique.
        </p>
      </header>

      {/* Launch form — stacked on mobile, inline from md up. */}
      <section className="border border-border bg-surface p-4 sm:p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <label className="flex-1">
            <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-widest text-text-muted">
              URL à analyser
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

          <button
            type="button"
            onClick={() => void launch()}
            disabled={busy || !url.trim()}
            className="flex w-full items-center justify-center gap-2 border border-border-strong bg-text-primary px-5 py-2.5 text-sm font-medium text-bg transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 md:w-auto"
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : <BadgeCheck size={15} />}
            {busy ? 'Analyse en cours…' : 'Analyser'}
          </button>
        </div>

        <p className="mt-2.5 text-xs text-text-muted">
          Bannière de consentement, politique de confidentialité, mentions légales, formulaires
          chiffrés, traceurs tiers.
        </p>

        {error && (
          <p className="mt-3 flex items-start gap-2 border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
            <AlertTriangle size={14} className="mt-px flex-shrink-0" />
            {error}
          </p>
        )}
      </section>

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

      {selected && <ComplyDetail check={selected} />}

      <section>
        <h2 className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-text-muted">
          Historique
        </h2>
        {history.length === 0 ? (
          <p className="border border-border bg-surface px-4 py-6 text-center text-sm text-text-muted">
            Aucune analyse pour l’instant.
          </p>
        ) : (
          <div className="flex flex-col divide-y divide-border border border-border bg-surface">
            {history.map((check) => (
              <button
                key={check.id}
                type="button"
                onClick={() => void openCheck(check)}
                className={`flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-hover ${
                  selected?.id === check.id ? 'bg-surface-hover' : ''
                }`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-text-primary">{check.url}</span>
                  <span className="mt-0.5 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-text-muted">
                    <Clock size={10} />
                    {relativeTime(check.createdAt)}
                  </span>
                </span>
                {check.status === 'error' ? (
                  <span className="flex-shrink-0 font-mono text-[10px] uppercase tracking-wider text-danger">
                    Échec
                  </span>
                ) : check.status === 'done' ? (
                  <span className={`flex-shrink-0 font-mono text-sm font-semibold ${scoreColor(check.score)}`}>
                    {check.score}
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
