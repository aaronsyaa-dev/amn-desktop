import { useCallback, useMemo } from 'react';
import { useSync, useCollection, uid, stripMeta } from './SyncContext';
import {
  dayOf,
  defaultTimeConfig,
  durationMs,
  isRunning,
  manualRange,
  normalizeTimeConfig,
  totalMs,
  weekStart,
  type TimeConfig,
  type TimeEntry,
  type TimeEntryData,
} from './timeEngine';

/**
 * Le temps passé.
 *
 * ## Une seule période en cours, garantie ici
 *
 * `start()` arrête d'abord ce qui tournait. C'est la règle qui rend le module
 * utilisable au pouce : on appuie sur « Démarrer » sans avoir à se demander si
 * on avait pensé à arrêter le précédent. Deux chronomètres simultanés ne sont
 * pas une fonctionnalité manquante — c'est un total de la semaine faux, et
 * personne ne le remarquerait.
 */

const CONFIG_ID = 'config';

export function useTimeTracking() {
  const { upsert, remove } = useSync();
  const rawEntries = useCollection<Partial<TimeEntryData>>('timeEntries');
  const rawConfig = useCollection<Partial<TimeConfig>>('timeConfig');

  const config = useMemo<TimeConfig>(() => {
    const row = rawConfig.find((r) => r.id === CONFIG_ID);
    return row ? normalizeTimeConfig(row) : defaultTimeConfig();
  }, [rawConfig]);

  const entries = useMemo<TimeEntry[]>(
    () =>
      rawEntries
        .map((row) => ({
          id: row.id,
          label: row.label ?? '',
          projectId: row.projectId,
          startedAt: row.startedAt ?? row.createdAt ?? row.updatedAt,
          endedAt: row.endedAt ?? '',
          invoicedAt: row.invoicedAt ?? '',
          createdAt: row.createdAt ?? row.updatedAt,
          updatedAt: row.updatedAt,
        }))
        .sort((a, b) => b.startedAt.localeCompare(a.startedAt)),
    [rawEntries],
  );

  /**
   * La période en cours, s'il y en a une.
   *
   * S'il y en avait plusieurs — deux appareils hors ligne ayant démarré chacun
   * de leur côté — on retient la plus récente : c'est la seule sur laquelle
   * l'utilisatrice travaille vraiment, et `start()`/`stop()` referment les
   * autres au geste suivant.
   */
  const running = useMemo(() => entries.find((e) => isRunning(e)) ?? null, [entries]);

  const saveConfig = useCallback(
    (next: TimeConfig) => upsert('timeConfig', CONFIG_ID, { ...next }),
    [upsert],
  );

  const closeEntry = useCallback(
    (entry: TimeEntry, endedAt: string) => {
      const raw = rawEntries.find((r) => r.id === entry.id);
      if (!raw) return;
      upsert('timeEntries', entry.id, { ...stripMeta(raw), endedAt });
    },
    [rawEntries, upsert],
  );

  /** Arrête TOUT ce qui tourne. Appelé par `stop()` comme par `start()`. */
  const stopAll = useCallback(() => {
    const now = new Date().toISOString();
    for (const entry of entries.filter((e) => isRunning(e))) closeEntry(entry, now);
  }, [entries, closeEntry]);

  const start = useCallback(
    (input: { label?: string; projectId?: string } = {}): string => {
      stopAll();
      const id = uid('time');
      const now = new Date().toISOString();
      upsert('timeEntries', id, {
        label: input.label ?? '',
        projectId: input.projectId,
        startedAt: now,
        endedAt: '',
        invoicedAt: '',
        createdAt: now,
      } satisfies TimeEntryData);
      return id;
    },
    [stopAll, upsert],
  );

  const stop = useCallback(() => stopAll(), [stopAll]);

  /** La saisie de secours : un jour et une durée, quand on a oublié le chrono. */
  const addManual = useCallback(
    (input: { day: string; minutes: number; label?: string; projectId?: string }): string => {
      const id = uid('time');
      const { startedAt, endedAt } = manualRange(input.day, input.minutes);
      upsert('timeEntries', id, {
        label: input.label ?? '',
        projectId: input.projectId,
        startedAt,
        endedAt,
        invoicedAt: '',
        createdAt: new Date().toISOString(),
      } satisfies TimeEntryData);
      return id;
    },
    [upsert],
  );

  const updateEntry = useCallback(
    (id: string, patch: Partial<TimeEntryData>) => {
      const current = rawEntries.find((e) => e.id === id);
      if (!current) return;
      upsert('timeEntries', id, { ...stripMeta(current), ...patch });
    },
    [rawEntries, upsert],
  );

  const deleteEntry = useCallback((id: string) => remove('timeEntries', id), [remove]);

  /** Marque des périodes comme reportées sur une facture — jamais automatique. */
  const markInvoiced = useCallback(
    (ids: string[]) => {
      const now = new Date().toISOString();
      for (const id of ids) {
        const current = rawEntries.find((e) => e.id === id);
        if (!current) continue;
        upsert('timeEntries', id, { ...stripMeta(current), invoicedAt: now });
      }
    },
    [rawEntries, upsert],
  );

  /**
   * Les périodes TERMINÉES d'un projet, jamais facturées.
   *
   * Terminées seulement : facturer le chronomètre qui tourne figerait une
   * durée qui continue d'augmenter, et la facture serait fausse à la seconde
   * où elle est émise.
   */
  const billableOf = useCallback(
    (projectId: string) =>
      entries.filter((e) => e.projectId === projectId && !isRunning(e) && !e.invoicedAt),
    [entries],
  );

  const countForProject = useCallback(
    (projectId: string) => entries.filter((e) => e.projectId === projectId).length,
    [entries],
  );

  /** Regroupement par jour, du plus récent au plus ancien — la forme de la liste. */
  const byDay = useMemo(() => {
    const groups = new Map<string, TimeEntry[]>();
    for (const entry of entries) {
      const day = dayOf(entry.startedAt);
      const list = groups.get(day) ?? [];
      list.push(entry);
      groups.set(day, list);
    }
    return [...groups.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([day, rows]) => ({ day, rows }));
  }, [entries]);

  /**
   * Ce que l'écran affiche en tête : aujourd'hui et cette semaine.
   *
   * `now` est un paramètre parce que le total d'une période en cours dépend de
   * l'instant — l'écran le rafraîchit à chaque seconde, et la fonction doit
   * suivre sans être recréée.
   */
  const summary = useCallback(
    (now = Date.now()) => {
      const today = dayOf(new Date(now).toISOString());
      const monday = weekStart(today);
      return {
        todayMs: totalMs(entries.filter((e) => dayOf(e.startedAt) === today), now),
        weekMs: totalMs(entries.filter((e) => dayOf(e.startedAt) >= monday), now),
        weekStartDay: monday,
      };
    },
    [entries],
  );

  /** Temps par projet sur une fenêtre de jours ISO, pour la vue d'ensemble. */
  const byProject = useCallback(
    (fromDay: string, now = Date.now()) => {
      const totals = new Map<string, number>();
      for (const entry of entries) {
        if (dayOf(entry.startedAt) < fromDay) continue;
        const key = entry.projectId ?? '';
        totals.set(key, (totals.get(key) ?? 0) + durationMs(entry, now));
      }
      return [...totals.entries()]
        .map(([projectId, ms]) => ({ projectId, ms }))
        .sort((a, b) => b.ms - a.ms);
    },
    [entries],
  );

  return {
    config,
    saveConfig,
    entries,
    running,
    byDay,
    summary,
    byProject,
    start,
    stop,
    addManual,
    updateEntry,
    deleteEntry,
    markInvoiced,
    billableOf,
    countForProject,
  };
}
