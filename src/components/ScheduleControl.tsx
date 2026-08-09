import React, { useCallback, useEffect, useState } from 'react';
import { CalendarClock, Check, X } from 'lucide-react';
import { bridge } from '../lib/bridge';
import { useToast } from '../state/ToastContext';
import { hostOf } from '../state/useRemediation';
import type { ProductSchedule, ProductScheduleKind, ScanTier } from '../shared/api';

/**
 * Arms a recurring Scanner / Comply run for one URL (BLOC 5).
 *
 * Shared by both products because the behaviour is identical: one schedule per
 * (product, URL), a cadence in days, and a clear statement of when the next run
 * lands. The comparison that produces an alert happens server-side — see
 * `sweepSchedules` in amn-api — so a scheduled run still fires while every
 * desktop is closed.
 */

const INTERVALS = [
  { days: 7, label: 'Chaque semaine' },
  { days: 14, label: 'Toutes les 2 semaines' },
  { days: 30, label: 'Chaque mois' },
] as const;

export function ScheduleControl({
  kind,
  url,
  tier,
}: {
  kind: ProductScheduleKind;
  /** URL to watch. Empty disables the control. */
  url: string;
  /** Scanner tier to re-run at; ignored for Comply. */
  tier?: ScanTier;
}) {
  const { notify } = useToast();
  const [schedule, setSchedule] = useState<ProductSchedule | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!url) return;
    try {
      const all = await bridge().remote.listSchedules();
      const host = hostOf(url);
      setSchedule(all.find((s) => s.kind === kind && hostOf(s.url) === host) ?? null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Planification indisponible.');
    }
  }, [kind, url]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const arm = async (intervalDays: number) => {
    setBusy(true);
    setError(null);
    try {
      const created = await bridge().remote.createSchedule({
        kind,
        url,
        tier,
        intervalDays,
      });
      setSchedule(created);
      notify({
        title: 'Analyse récurrente activée',
        body: `${hostOf(url)} sera réanalysé tous les ${intervalDays} jours.`,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "La planification n'a pas pu être enregistrée.");
    } finally {
      setBusy(false);
    }
  };

  const disarm = async () => {
    if (!schedule) return;
    setBusy(true);
    setError(null);
    try {
      await bridge().remote.deleteSchedule(schedule.id);
      setSchedule(null);
      notify({ title: 'Analyse récurrente désactivée', body: hostOf(url) });
    } catch (err) {
      setError(err instanceof Error ? err.message : "La planification n'a pas pu être supprimée.");
    } finally {
      setBusy(false);
    }
  };

  if (!url) return null;

  return (
    <div className="elev-1 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3">
      <CalendarClock size={15} strokeWidth={1.75} className="flex-shrink-0 text-text-secondary" />
      <div className="mr-auto min-w-0">
        <p className="text-sm text-text-primary">
          {schedule ? 'Analyse récurrente active' : 'Analyse récurrente'}
        </p>
        <p className="mt-0.5 font-mono text-[10px] uppercase tracking-widest text-text-muted">
          {schedule
            ? `Tous les ${schedule.intervalDays} j · prochaine le ${new Date(
                schedule.nextRunAt,
              ).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`
            : `${hostOf(url)} · alerte si le résultat régresse`}
        </p>
        {schedule?.lastRunAt && (
          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-widest text-text-muted">
            Dernière automatique : {new Date(schedule.lastRunAt).toLocaleDateString('fr-FR')}
            {schedule.lastScore != null ? ` · ${schedule.lastScore}/100` : ''}
          </p>
        )}
      </div>

      {error && <p className="w-full text-xs text-danger">{error}</p>}

      {schedule ? (
        <button
          type="button"
          onClick={() => void disarm()}
          disabled={busy}
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-text-secondary transition-colors hover:text-text-primary disabled:opacity-40"
        >
          <X size={13} strokeWidth={2} />
          Désactiver
        </button>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {INTERVALS.map((option) => (
            <button
              key={option.days}
              type="button"
              onClick={() => void arm(option.days)}
              disabled={busy}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary disabled:opacity-40"
            >
              <Check size={13} strokeWidth={2} />
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
