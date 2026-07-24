import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Target } from 'lucide-react';
import { bridge } from '../lib/bridge';
import type { Objective } from '../shared/api';

function formatValue(value: number, unit: string): string {
  if (unit === '€') return `${value.toLocaleString('fr-FR')} €`;
  return `${value.toLocaleString('fr-FR')} ${unit}`;
}

/** Monthly objectives with a manually-editable current value. Home widget. */
export function ObjectivesWidget() {
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    bridge()
      .objectives.list()
      .then((list) => active && setObjectives(list))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const setCurrent = async (objective: Objective, value: number) => {
    setObjectives((prev) => prev.map((o) => (o.id === objective.id ? { ...o, currentValue: value } : o)));
    const updated = await bridge().objectives.update(objective.id, { currentValue: value });
    setObjectives((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
  };

  return (
    <div className="border border-border bg-surface">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Target size={14} strokeWidth={1.75} className="text-text-secondary" />
        <h2 className="font-mono text-[11px] uppercase tracking-widest text-text-secondary">
          Objectifs {objectives[0]?.periodLabel ? `· ${objectives[0].periodLabel}` : ''}
        </h2>
      </div>
      {loading ? (
        <p className="p-4 text-sm text-text-secondary">Chargement…</p>
      ) : objectives.length === 0 ? (
        <p className="p-4 text-sm text-text-secondary">Aucun objectif défini.</p>
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
  objective: Objective;
  onChange: (objective: Objective, value: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(objective.currentValue));
  const pct = objective.targetValue > 0 ? Math.min(100, Math.round((objective.currentValue / objective.targetValue) * 100)) : 0;
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
