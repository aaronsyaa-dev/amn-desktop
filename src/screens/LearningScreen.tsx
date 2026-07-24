import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { GraduationCap, Plus, Trash2, X } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { bridge } from '../lib/bridge';
import { StaggerGroup, StaggerItem } from '../components/Stagger';
import { staggerContainer, staggerItem } from '../lib/transitions';
import type { CreateLearningGoalInput, LearningGoal } from '../shared/api';

const TEAM = [
  { email: 'aaron@amn-devsec.com', name: 'Aaron' },
  { email: 'mohamed@amn-devsec.com', name: 'Mohamed' },
];

export function LearningScreen() {
  const { user } = useAuth();
  const [goals, setGoals] = useState<LearningGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    let active = true;
    bridge()
      .learning.list()
      .then((list) => active && setGoals(list))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const replaceGoal = (updated: LearningGoal) =>
    setGoals((prev) => prev.map((g) => (g.id === updated.id ? updated : g)));

  const setProgress = async (goal: LearningGoal, pct: number) => {
    replaceGoal({ ...goal, progressPct: pct });
    const updated = await bridge().learning.update(goal.id, { progressPct: pct });
    replaceGoal(updated);
  };

  const removeGoal = async (id: number) => {
    setGoals((prev) => prev.filter((g) => g.id !== id));
    await bridge().learning.remove(id);
  };

  const createGoal = async (input: CreateLearningGoalInput) => {
    const created = await bridge().learning.create(input);
    setGoals((prev) => [...prev, created]);
    setAdding(false);
  };

  const grouped = useMemo(() => {
    const map = new Map<string, LearningGoal[]>();
    for (const g of goals) {
      const list = map.get(g.ownerEmail) ?? [];
      list.push(g);
      map.set(g.ownerEmail, list);
    }
    return TEAM.map((m) => ({ member: m, goals: map.get(m.email) ?? [] }));
  }, [goals]);

  return (
    <StaggerGroup className="flex flex-col gap-6">
      <StaggerItem>
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-text-primary">Progression</h1>
            <p className="mt-1 font-mono text-xs uppercase tracking-widest text-text-muted">
              Montée en compétence de l’équipe · saisie manuelle
            </p>
          </div>
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex items-center gap-2 bg-accent px-3 py-2 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover"
          >
            <Plus size={16} strokeWidth={2.25} />
            Nouvel objectif
          </button>
        </div>
      </StaggerItem>

      {loading ? (
        <p className="font-mono text-xs uppercase tracking-widest text-text-muted">Chargement…</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {grouped.map(({ member, goals: memberGoals }) => (
            <StaggerItem key={member.email}>
              <div className="border border-border bg-surface">
                <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-muted text-xs font-semibold text-accent">
                    {member.name.slice(0, 2).toUpperCase()}
                  </span>
                  <h2 className="text-sm font-semibold text-text-primary">
                    {member.name}
                    {member.email === user?.email && <span className="text-text-muted"> (vous)</span>}
                  </h2>
                </div>
                {memberGoals.length === 0 ? (
                  <p className="p-4 text-sm text-text-secondary">Aucun objectif renseigné.</p>
                ) : (
                  <motion.div variants={staggerContainer} initial="initial" animate="animate" className="divide-y divide-border/60">
                    {memberGoals.map((goal) => (
                      <motion.div key={goal.id} variants={staggerItem} className="group/goal p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-text-primary">{goal.title}</p>
                            {goal.platform && (
                              <p className="font-mono text-[11px] text-text-muted">{goal.platform}</p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => removeGoal(goal.id)}
                            aria-label="Supprimer l’objectif"
                            className="flex-shrink-0 text-text-muted opacity-0 transition-opacity hover:text-danger group-hover/goal:opacity-100"
                          >
                            <Trash2 size={13} strokeWidth={1.75} />
                          </button>
                        </div>
                        <div className="mt-3 flex items-center gap-3">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/5">
                            <motion.div
                              className="h-full rounded-full bg-accent"
                              initial={{ width: 0 }}
                              animate={{ width: `${goal.progressPct}%` }}
                              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                            />
                          </div>
                          <span className="tnum w-10 flex-shrink-0 text-right text-xs font-semibold text-text-primary">
                            {goal.progressPct}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={goal.progressPct}
                          onChange={(e) => setProgress(goal, Number(e.target.value))}
                          className="mt-2 w-full accent-white"
                          aria-label={`Progression — ${goal.title}`}
                        />
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              </div>
            </StaggerItem>
          ))}
        </div>
      )}

      {adding && (
        <NewGoalModal defaultOwner={user?.email ?? TEAM[0].email} onClose={() => setAdding(false)} onCreate={createGoal} />
      )}
    </StaggerGroup>
  );
}

function NewGoalModal({
  defaultOwner,
  onClose,
  onCreate,
}: {
  defaultOwner: string;
  onClose: () => void;
  onCreate: (input: CreateLearningGoalInput) => Promise<void>;
}) {
  const [title, setTitle] = useState('');
  const [platform, setPlatform] = useState('');
  const [ownerEmail, setOwnerEmail] = useState(defaultOwner);

  const submit = () => {
    if (!title.trim()) return;
    onCreate({ title: title.trim(), platform: platform.trim(), ownerEmail, progressPct: 0 });
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={onClose} className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />
      <motion.div
        initial={{ opacity: 0, scale: 0.98, y: -6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 420, damping: 32 }}
        className="relative w-full max-w-md border border-border-strong bg-surface"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-text-secondary">
            <GraduationCap size={14} strokeWidth={1.75} />
            Nouvel objectif
          </h2>
          <button type="button" onClick={onClose} aria-label="Fermer" className="text-text-secondary hover:text-text-primary">
            <X size={18} strokeWidth={2} />
          </button>
        </div>
        <div className="flex flex-col gap-3 p-5">
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
              Certification / compétence visée *
            </span>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              placeholder="ex. Certification OSCP"
              className="input-focus border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">Plateforme (optionnel)</span>
            <input
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              placeholder="ex. TryHackMe"
              className="input-focus border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none"
            />
          </label>
          <div className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">Pour</span>
            <div className="flex border border-border">
              {TEAM.map((m) => (
                <button
                  key={m.email}
                  type="button"
                  onClick={() => setOwnerEmail(m.email)}
                  className={`flex-1 py-2 text-sm transition-colors ${
                    ownerEmail === m.email ? 'bg-accent-muted text-text-primary' : 'text-text-muted hover:text-text-secondary'
                  }`}
                >
                  {m.name}
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={submit}
            disabled={!title.trim()}
            className="mt-1 bg-accent px-3 py-2.5 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover disabled:opacity-40"
          >
            Ajouter
          </button>
        </div>
      </motion.div>
    </div>
  );
}
