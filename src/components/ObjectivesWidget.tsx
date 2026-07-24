import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Target } from 'lucide-react';
import { useSync, useCollection, stripMeta } from '../state/SyncContext';

interface ObjectiveData {
  label: string;
  unit: string;
  targetValue: number;
  currentValue: number;
  periodLabel: string;
}
type SyncObjective = ObjectiveData & { id: string; updatedAt: string };

function formatValue(value: number, unit: string): string {
  if (unit === '€') return `${value.toLocaleString('fr-FR')} €`;
  return `${value.toLocaleString('fr-FR')} ${unit}`;
}

function defaultObjectives(): { id: string; data: ObjectiveData }[] {
  const period = new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  return [
    { id: 'obj-revenue', data: { label: 'Chiffre d’affaires visé', unit: '€', targetValue: 6000, currentValue: 2400, periodLabel: period } },
    { id: 'obj-clients', data: { label: 'Nouveaux clients visés', unit: 'clients', targetValue: 3, currentValue: 1, periodLabel: period } },
  ];
}

/** Monthly objectives with a manually-editable current value. Synced + home widget. */
export function ObjectivesWidget() {
  const { upsert, ready } = useSync();
  const objectivesRaw = useCollection<ObjectiveData>('objectives');
  const objectives = useMemo(
    () => [...objectivesRaw].sort((a, b) => a.id.localeCompare(b.id)),
    [objectivesRaw],
  );

  // Seed the two default objectives once the store is ready and empty. Fixed
  // ids make the upsert idempotent, so both operators converge to the same two
  // rows even if they seed concurrently.
  useEffect(() => {
    if (ready && objectivesRaw.length === 0) {
      for (const { id, data } of defaultObjectives()) upsert('objectives', id, { ...data });
    }
  }, [ready, objectivesRaw.length, upsert]);

  const setCurrent = (objective: SyncObjective, value: number) =>
    upsert('objectives', objective.id, { ...stripMeta(objective), currentValue: value });

  return (
    <div className="border border-border bg-surface">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Target size={14} strokeWidth={1.75} className="text-text-secondary" />
        <h2 className="font-mono text-[11px] uppercase tracking-widest text-text-secondary">
          Objectifs {objectives[0]?.periodLabel ? `· ${objectives[0].periodLabel}` : ''}
        </h2>
      </div>
      {!ready ? (
        <p className="p-4 text-sm text-text-secondary">Chargement…</p>
      ) : objectives.length === 0 ? (
        <p className="p-4 text-sm text-text-secondary">Préparation des objectifs…</p>
      ) : (
        <div className="divide-y divide-border/60">
          {objectives.map((objective) => (
            <ObjectiveRow key={objective.id} objective={objective} onChange={setCurrent} />
          ))}
        </div>
      )}
    </div>
  );
}

function ObjectiveRow({
  objective,
  onChange,
}: {
  objective: SyncObjective;
  onChange: (objective: SyncObjective, value: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(objective.currentValue));
  const pct =
    objective.targetValue > 0
      ? Math.min(100, Math.round((objective.currentValue / objective.targetValue) * 100))
      : 0;
  const reached = objective.currentValue >= objective.targetValue;

  useEffect(() => setDraft(String(objective.currentValue)), [objective.currentValue]);

  const commit = () => {
    setEditing(false);
    const parsed = Number(draft.replace(',', '.'));
    if (!Number.isNaN(parsed) && parsed !== objective.currentValue) onChange(objective, parsed);
  };

  return (
    <div className="p-4">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-medium text-text-primary">{objective.label}</p>
        {editing ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
              if (e.key === 'Escape') {
                setDraft(String(objective.currentValue));
                setEditing(false);
              }
            }}
            className="tnum w-20 border-b border-border-strong bg-transparent text-right text-sm text-text-primary outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="tnum border-b border-transparent text-sm text-text-secondary hover:border-border hover:text-text-primary"
            title="Modifier la valeur actuelle"
          >
            {formatValue(objective.currentValue, objective.unit)} / {formatValue(objective.targetValue, objective.unit)}
          </button>
        )}
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/5">
        <motion.div
          className={`h-full rounded-full ${reached ? 'bg-success' : 'bg-accent'}`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
      <p className="tnum mt-1 text-[10px] text-text-muted">{pct}%</p>
    </div>
  );
}
