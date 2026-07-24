import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { bridge } from '../lib/bridge';
import { StaggerGroup, StaggerItem } from '../components/Stagger';
import { ConfirmDelete } from '../components/ConfirmDelete';
import { staggerContainer, staggerItem } from '../lib/transitions';
import { relativeTime } from '../lib/time';
import type { Decision } from '../shared/api';

export function DecisionsScreen() {
  const { user } = useAuth();
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [detail, setDetail] = useState('');
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let active = true;
    bridge()
      .decisions.list()
      .then((list) => active && setDecisions(list))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const remove = async (id: number) => {
    setDecisions((prev) => prev.filter((d) => d.id !== id));
    await bridge().decisions.remove(id);
  };

  const submit = async () => {
    if (!title.trim() || !user) return;
    const created = await bridge().decisions.create({
      title: title.trim(),
      detail: detail.trim(),
      authorEmail: user.email,
    });
    setDecisions((prev) => [created, ...prev]);
    setTitle('');
    setDetail('');
    setExpanded(false);
  };

  return (
    <StaggerGroup className="flex flex-col gap-6">
      <StaggerItem>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-text-primary">Journal de décisions</h1>
          <p className="mt-1 font-mono text-xs uppercase tracking-widest text-text-muted">
            Choix techniques et business, horodatés · {decisions.length} entrée{decisions.length > 1 ? 's' : ''}
          </p>
        </div>
      </StaggerItem>

      <StaggerItem>
        <div className="border border-border-strong bg-surface p-4">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onFocus={() => setExpanded(true)}
            placeholder="Quelle décision venez-vous de prendre ?"
            className="input-focus w-full border border-border bg-bg px-3 py-2.5 text-sm text-text-primary outline-none placeholder:text-text-muted"
          />
          {expanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              transition={{ duration: 0.2 }}
              className="mt-2 flex flex-col gap-2 overflow-hidden"
            >
              <textarea
                value={detail}
                onChange={(e) => setDetail(e.target.value)}
                placeholder="Contexte, raisonnement… (optionnel)"
                rows={2}
                className="input-focus resize-none border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none placeholder:text-text-muted"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setExpanded(false);
                    setTitle('');
                    setDetail('');
                  }}
                  className="px-3 py-2 font-mono text-[11px] uppercase tracking-wider text-text-muted hover:text-text-secondary"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={submit}
                  disabled={!title.trim()}
                  className="flex items-center gap-1.5 bg-accent px-3 py-2 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover disabled:opacity-40"
                >
                  <Plus size={14} strokeWidth={2.25} />
                  Ajouter au journal
                </button>
              </div>
            </motion.div>
          )}
        </div>
      </StaggerItem>

      <StaggerItem>
        {loading ? (
          <p className="font-mono text-xs uppercase tracking-widest text-text-muted">Chargement…</p>
        ) : decisions.length === 0 ? (
          <p className="border border-border bg-surface p-6 text-center text-sm text-text-secondary">
            Aucune décision consignée pour l’instant.
          </p>
        ) : (
          <motion.ol variants={staggerContainer} initial="initial" animate="animate" className="relative flex flex-col gap-0">
            {decisions.map((decision, i) => (
              <motion.li key={decision.id} variants={staggerItem} className="relative flex gap-4 pb-6 last:pb-0">
                {i !== decisions.length - 1 && (
                  <span className="absolute left-[5px] top-4 bottom-0 w-px bg-border" />
                )}
                <span className="mt-1.5 h-2.5 w-2.5 flex-shrink-0 rounded-full border-2 border-border-strong bg-surface" />
                <div className="group/dec min-w-0 flex-1 border border-border bg-surface p-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-sm font-medium text-text-primary">{decision.title}</p>
                    <div className="flex flex-shrink-0 items-center gap-2">
                      <time className="font-mono text-[10px] uppercase tracking-wide text-text-muted">
                        {relativeTime(decision.createdAt)}
                      </time>
                      <span className="opacity-0 transition-opacity group-hover/dec:opacity-100">
                        <ConfirmDelete onConfirm={() => remove(decision.id)} label="Supprimer la décision" />
                      </span>
                    </div>
                  </div>
                  {decision.detail && (
                    <p className="mt-1.5 text-sm leading-relaxed text-text-secondary">{decision.detail}</p>
                  )}
                  <p className="mt-2 font-mono text-[10px] uppercase tracking-widest text-text-muted">
                    Décidé par {decision.authorName}
                  </p>
                </div>
              </motion.li>
            ))}
          </motion.ol>
        )}
      </StaggerItem>
    </StaggerGroup>
  );
}
