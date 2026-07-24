import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Contact, Globe, Plus, Trash2, X } from 'lucide-react';
import { bridge } from '../lib/bridge';
import { useRemoteSites } from '../state/RemoteSitesContext';
import { StaggerGroup, StaggerItem } from '../components/Stagger';
import { staggerContainer, staggerItem } from '../lib/transitions';
import { relativeTime } from '../lib/time';
import { useSitePanel } from '../components/site-panel/SitePanelContext';
import type { Client, CreateSharedTaskInput, SharedTask, SharedTaskStatus } from '../shared/api';

const TEAM = [
  { email: 'aaron@amn-devsec.com', name: 'Aaron' },
  { email: 'mohamed@amn-devsec.com', name: 'Mohamed' },
];

const COLUMNS: { status: SharedTaskStatus; label: string }[] = [
  { status: 'todo', label: 'À faire' },
  { status: 'doing', label: 'En cours' },
  { status: 'done', label: 'Fait' },
];

function nameFor(email: string): string {
  return TEAM.find((m) => m.email === email)?.name ?? email;
}

export function TasksScreen() {
  const { sites } = useRemoteSites();
  const [tasks, setTasks] = useState<SharedTask[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([bridge().tasks.list(), bridge().clients.list()]).then(([t, c]) => {
      if (!active) return;
      setTasks(t);
      setClients(c);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const replaceTask = (updated: SharedTask) =>
    setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));

  const moveTask = async (task: SharedTask, status: SharedTaskStatus) => {
    // Optimistic update — the board should feel instant, not wait on IPC.
    replaceTask({ ...task, status });
    const updated = await bridge().tasks.update(task.id, { status });
    replaceTask(updated);
  };

  const removeTask = async (id: number) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    await bridge().tasks.remove(id);
  };

  const createTask = async (input: CreateSharedTaskInput) => {
    const created = await bridge().tasks.create(input);
    setTasks((prev) => [created, ...prev]);
    setCreating(false);
  };

  const counts = useMemo(() => {
    const map: Record<SharedTaskStatus, number> = { todo: 0, doing: 0, done: 0 };
    for (const t of tasks) map[t.status] += 1;
    return map;
  }, [tasks]);

  return (
    <StaggerGroup className="flex h-[calc(100vh-8rem)] flex-col gap-4">
      <StaggerItem>
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-text-primary">Tâches</h1>
            <p className="mt-1 font-mono text-xs uppercase tracking-widest text-text-muted">
              Qui fait quoi · {tasks.length} tâche{tasks.length > 1 ? 's' : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex items-center gap-2 bg-accent px-3 py-2 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover"
          >
            <Plus size={16} strokeWidth={2.25} />
            Nouvelle tâche
          </button>
        </div>
      </StaggerItem>

      <StaggerItem className="min-h-0 flex-1">
        {loading ? (
          <div className="flex h-full items-center justify-center font-mono text-xs uppercase tracking-widest text-text-muted">
            Chargement…
          </div>
        ) : (
          <div className="grid h-full grid-cols-1 gap-4 md:grid-cols-3">
            {COLUMNS.map((col) => (
              <TaskColumn
                key={col.status}
                label={col.label}
                status={col.status}
                count={counts[col.status]}
                tasks={tasks.filter((t) => t.status === col.status)}
                sites={sites}
                clients={clients}
                onMove={moveTask}
                onRemove={removeTask}
              />
            ))}
          </div>
        )}
      </StaggerItem>

      {creating && (
        <NewTaskModal
          sites={sites}
          clients={clients}
          onClose={() => setCreating(false)}
          onCreate={createTask}
        />
      )}
    </StaggerGroup>
  );
}

function TaskColumn({
  label,
  status,
  count,
  tasks,
  sites,
  clients,
  onMove,
  onRemove,
}: {
  label: string;
  status: SharedTaskStatus;
  count: number;
  tasks: SharedTask[];
  sites: ReturnType<typeof useRemoteSites>['sites'];
  clients: Client[];
  onMove: (task: SharedTask, status: SharedTaskStatus) => void;
  onRemove: (id: number) => void;
}) {
  return (
    <div className="flex min-h-0 flex-col border border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="font-mono text-[11px] uppercase tracking-widest text-text-secondary">{label}</h2>
        <span className="tnum text-xs text-text-muted">{String(count).padStart(2, '0')}</span>
      </div>
      <motion.div
        variants={staggerContainer}
        initial="initial"
        animate="animate"
        className="flex-1 space-y-2 overflow-y-auto p-3"
      >
        {tasks.length === 0 ? (
          <p className="px-1 py-4 font-mono text-xs text-text-muted">Rien ici.</p>
        ) : (
          tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              status={status}
              sites={sites}
              clients={clients}
              onMove={onMove}
              onRemove={onRemove}
            />
          ))
        )}
      </motion.div>
    </div>
  );
}

function TaskCard({
  task,
  status,
  sites,
  clients,
  onMove,
  onRemove,
}: {
  task: SharedTask;
  status: SharedTaskStatus;
  sites: ReturnType<typeof useRemoteSites>['sites'];
  clients: Client[];
  onMove: (task: SharedTask, status: SharedTaskStatus) => void;
  onRemove: (id: number) => void;
}) {
  const { openSite } = useSitePanel();
  const site = task.siteId ? sites.find((s) => s.id === task.siteId) : undefined;
  const client = task.clientId ? clients.find((c) => c.id === task.clientId) : undefined;
  const otherStatuses = COLUMNS.filter((c) => c.status !== status);

  return (
    <motion.div variants={staggerItem} className="group/card border border-border bg-bg p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium leading-snug text-text-primary">{task.title}</p>
        <button
          type="button"
          onClick={() => onRemove(task.id)}
          aria-label="Supprimer la tâche"
          className="flex-shrink-0 text-text-muted opacity-0 transition-opacity hover:text-danger group-hover/card:opacity-100"
        >
          <Trash2 size={13} strokeWidth={1.75} />
        </button>
      </div>
      {task.detail && <p className="mt-1 text-xs leading-relaxed text-text-secondary">{task.detail}</p>}

      {(site || client) && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {site && (
            <button
              type="button"
              onClick={() => openSite(site.id)}
              className="flex items-center gap-1 rounded-sm bg-white/[0.06] px-1.5 py-0.5 font-mono text-[10px] text-text-secondary hover:text-text-primary"
            >
              <Globe size={10} strokeWidth={2} />
              {site.name}
            </button>
          )}
          {client && (
            <span className="flex items-center gap-1 rounded-sm bg-white/[0.06] px-1.5 py-0.5 font-mono text-[10px] text-text-secondary">
              <Contact size={10} strokeWidth={2} />
              {client.name}
            </span>
          )}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between">
        <span
          className="flex h-6 w-6 items-center justify-center rounded-full bg-accent-muted text-[10px] font-semibold text-accent"
          title={nameFor(task.assigneeEmail)}
        >
          {nameFor(task.assigneeEmail).slice(0, 2).toUpperCase()}
        </span>
        <span className="font-mono text-[10px] text-text-muted">{relativeTime(task.updatedAt)}</span>
      </div>

      <div className="mt-2 flex gap-1 opacity-0 transition-opacity group-hover/card:opacity-100">
        {otherStatuses.map((col) => (
          <button
            key={col.status}
            type="button"
            onClick={() => onMove(task, col.status)}
            className="flex-1 border border-border py-1 font-mono text-[9px] uppercase tracking-wider text-text-secondary hover:border-border-strong hover:text-text-primary"
          >
            → {col.label}
          </button>
        ))}
      </div>
    </motion.div>
  );
}

function NewTaskModal({
  sites,
  clients,
  onClose,
  onCreate,
}: {
  sites: ReturnType<typeof useRemoteSites>['sites'];
  clients: Client[];
  onClose: () => void;
  onCreate: (input: CreateSharedTaskInput) => Promise<void>;
}) {
  const [title, setTitle] = useState('');
  const [detail, setDetail] = useState('');
  const [assigneeEmail, setAssigneeEmail] = useState(TEAM[0].email);
  const [siteId, setSiteId] = useState<string>('');
  const [clientId, setClientId] = useState<string>('');

  const submit = () => {
    if (!title.trim()) return;
    onCreate({
      title: title.trim(),
      detail: detail.trim(),
      assigneeEmail,
      siteId: siteId || undefined,
      clientId: clientId ? Number(clientId) : undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.98, y: -6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 420, damping: 32 }}
        className="relative w-full max-w-md border border-border-strong bg-surface"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="font-mono text-[11px] uppercase tracking-widest text-text-secondary">Nouvelle tâche</h2>
          <button type="button" onClick={onClose} aria-label="Fermer" className="text-text-secondary hover:text-text-primary">
            <X size={18} strokeWidth={2} />
          </button>
        </div>
        <div className="flex flex-col gap-3 p-5">
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">Titre *</span>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              className="input-focus border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">Détail</span>
            <textarea
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              rows={2}
              className="input-focus resize-none border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">Assigné à</span>
            <div className="flex border border-border">
              {TEAM.map((m) => (
                <button
                  key={m.email}
                  type="button"
                  onClick={() => setAssigneeEmail(m.email)}
                  className={`flex-1 py-2 text-sm transition-colors ${
                    assigneeEmail === m.email ? 'bg-accent-muted text-text-primary' : 'text-text-muted hover:text-text-secondary'
                  }`}
                >
                  {m.name}
                </button>
              ))}
            </div>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">Lier à un site (optionnel)</span>
            <select
              value={siteId}
              onChange={(e) => setSiteId(e.target.value)}
              className="input-focus border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none"
            >
              <option value="">— Aucun —</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">Lier à un client (optionnel)</span>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="input-focus border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none"
            >
              <option value="">— Aucun —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={submit}
            disabled={!title.trim()}
            className="mt-1 bg-accent px-3 py-2.5 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover disabled:opacity-40"
          >
            Créer la tâche
          </button>
        </div>
      </motion.div>
    </div>
  );
}
