import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, ClipboardCheck, Circle } from 'lucide-react';
import { bridge } from '../lib/bridge';
import { CHECKLIST_CATALOG, isChecklistItemDue } from '../data/checklistCatalog';
import type { ChecklistStateEntry } from '../shared/api';

const FREQUENCY_LABEL: Record<'weekly' | 'monthly', string> = {
  weekly: 'Chaque semaine',
  monthly: 'Chaque mois',
};

/**
 * Recurring verification checklist — "toujours quelque chose à faire". The
 * catalog of checks is hardcoded (src/data/checklistCatalog.ts, no real
 * scanning yet, as requested); only the "last checked" timestamp is
 * persisted. An item reappears as due once its frequency window elapses —
 * see isChecklistItemDue().
 */
export function ChecklistWidget() {
  const [state, setState] = useState<ChecklistStateEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [justChecked, setJustChecked] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    bridge()
      .checklist.getState()
      .then((s) => active && setState(s))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const lastCheckedFor = (itemId: string) =>
    state.find((s) => s.itemId === itemId)?.lastCheckedAt ?? null;

  const check = async (itemId: string) => {
    setJustChecked(itemId);
    const entry = await bridge().checklist.check(itemId);
    setState((prev) => [...prev.filter((s) => s.itemId !== itemId), entry]);
    window.setTimeout(() => setJustChecked((cur) => (cur === itemId ? null : cur)), 900);
  };

  const dueItems = CHECKLIST_CATALOG.filter((item) => isChecklistItemDue(item, lastCheckedFor(item.id)));
  const doneItems = CHECKLIST_CATALOG.filter((item) => !isChecklistItemDue(item, lastCheckedFor(item.id)));

  return (
    <div className="border border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <ClipboardCheck size={14} strokeWidth={1.75} className="text-text-secondary" />
          <h2 className="font-mono text-[11px] uppercase tracking-widest text-text-secondary">
            Vérifications récurrentes
          </h2>
        </div>
        <span className="tnum text-xs text-text-muted">{dueItems.length} à faire</span>
      </div>

      {loading ? (
        <p className="p-4 text-sm text-text-secondary">Chargement…</p>
      ) : dueItems.length === 0 && doneItems.length === CHECKLIST_CATALOG.length ? (
        <p className="p-4 text-sm text-text-secondary">
          Tout est à jour. Prochaines vérifications à venir automatiquement.
        </p>
      ) : (
        <div className="divide-y divide-border/60">
          <AnimatePresence initial={false}>
            {dueItems.map((item) => (
              <motion.button
                key={item.id}
                type="button"
                layout
                initial={{ opacity: 1 }}
                exit={{ opacity: 0, height: 0 }}
                onClick={() => check(item.id)}
                className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-hover"
              >
                <motion.span animate={{ scale: justChecked === item.id ? [1, 1.3, 1] : 1 }} className="mt-0.5 flex-shrink-0 text-text-muted">
                  {justChecked === item.id ? (
                    <CheckCircle2 size={16} strokeWidth={1.75} className="text-success" />
                  ) : (
                    <Circle size={16} strokeWidth={1.75} />
                  )}
                </motion.span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-text-primary">{item.label}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-text-secondary">{item.detail}</p>
                  <p className="mt-1 font-mono text-[9px] uppercase tracking-wider text-text-muted">
                    {FREQUENCY_LABEL[item.frequency]}
                  </p>
                </div>
              </motion.button>
            ))}
          </AnimatePresence>
          {doneItems.length > 0 && (
            <div className="px-4 py-2.5 font-mono text-[10px] uppercase tracking-widest text-text-muted">
              {doneItems.length} vérifiée{doneItems.length > 1 ? 's' : ''} récemment
            </div>
          )}
        </div>
      )}
    </div>
  );
}
