import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Bold,
  CheckSquare,
  Code2,
  Contact,
  Eye,
  FileText,
  Heading1,
  Italic,
  Link2,
  List,
  Pencil,
  Plus,
  ScanLine,
  Scale,
  Trash2,
  X,
} from 'lucide-react';
import { useCollection } from '../state/SyncContext';
import { useReports, type Report, type ReportDraft, type ReportLink, type ReportType } from '../state/useReports';
import { useProfiles } from '../state/ProfilesContext';
import { useUndo } from '../state/UndoContext';
import { bridge } from '../lib/bridge';
import { Markdown } from '../lib/markdown';
import { relativeTime } from '../lib/time';
import { ScanDetail } from '../components/scanner/ScanDetail';
import { scoreColor } from '../lib/scanSeverity';
import type { Client, Scan } from '../shared/api';

const TYPES: { value: ReportType; label: string }[] = [
  { value: 'task', label: 'Tâche' },
  { value: 'client', label: 'Client' },
  { value: 'decision', label: 'Décision' },
  { value: 'manual', label: 'Manuel' },
];

function typeLabel(t: ReportType): string {
  return TYPES.find((x) => x.value === t)?.label ?? 'Manuel';
}

/** The report type filter, plus the pseudo-type covering finished Elite scans. */
type ListFilter = ReportType | 'all' | 'scanner';

type DateFilter = 'all' | '7' | '30' | '90';

/** Selects either a real report or a scan out of the shared left-hand list. */
type Selection = { kind: 'report'; id: string } | { kind: 'scan'; id: string } | null;

const emptyDraft = (): ReportDraft => ({ type: 'manual', title: '', body: '', links: [] });

/** State shape while creating/editing: `id` present ⇒ editing an existing report. */
interface EditState {
  id?: string;
  draft: ReportDraft;
}

export function ReportsScreen() {
  const { reports, createReport, updateReport, deleteReport } = useReports();
  const { isPending, scheduleDelete } = useUndo();
  const location = useLocation();

  const [typeFilter, setTypeFilter] = useState<ListFilter>('all');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [selection, setSelection] = useState<Selection>(null);
  const [editing, setEditing] = useState<EditState | null>(null);

  // Finished Elite scans, read from amn-api so both operators see the same
  // history. Refreshed on mount and whenever a scan completes anywhere in the
  // app (Scanner tab or the other operator), so a fresh Elite result shows up
  // here live instead of requiring a reload.
  const [scans, setScans] = useState<Scan[]>([]);
  useEffect(() => {
    let active = true;
    const refresh = () => {
      bridge()
        .remote.listScans()
        .then((all) => {
          if (active) setScans(all.filter((s) => s.tier === 'elite' && s.status === 'done'));
        })
        .catch(() => undefined);
    };
    refresh();
    const off = bridge().remote.onScanProgress((p) => {
      if (p.status === 'done') refresh();
    });
    return () => {
      active = false;
      off();
    };
  }, []);

  // A "Faire un rapport" trigger from Tasks/Clients/Décisions arrives as a
  // prefilled draft in the navigation state — open the editor on it.
  useEffect(() => {
    const draft = (location.state as { reportDraft?: ReportDraft } | null)?.reportDraft;
    if (draft) {
      setEditing({ draft });
      setSelection(null);
    }
  }, [location.state]);

  const visibleReports = useMemo(() => {
    const cutoff = dateFilter === 'all' ? 0 : Date.now() - Number(dateFilter) * 86400000;
    return reports
      .filter((r) => !isPending(`reports:${r.id}`))
      .filter((r) => (typeFilter === 'all' ? true : typeFilter === 'scanner' ? false : r.type === typeFilter))
      .filter((r) => (cutoff ? new Date(r.createdAt).getTime() >= cutoff : true));
  }, [reports, typeFilter, dateFilter, isPending]);

  const visibleScans = useMemo(() => {
    if (typeFilter !== 'all' && typeFilter !== 'scanner') return [];
    const cutoff = dateFilter === 'all' ? 0 : Date.now() - Number(dateFilter) * 86400000;
    return scans.filter((s) => (cutoff ? new Date(s.createdAt).getTime() >= cutoff : true));
  }, [scans, typeFilter, dateFilter]);

  // One chronological list mixing both kinds, newest first — "Tous" reads as
  // a genuine unified history rather than reports-then-scans.
  const items = useMemo(
    () =>
      [
        ...visibleReports.map((r) => ({ kind: 'report' as const, id: r.id, at: r.createdAt, report: r })),
        ...visibleScans.map((s) => ({ kind: 'scan' as const, id: s.id, at: s.createdAt, scan: s })),
      ].sort((a, b) => (b.at || '').localeCompare(a.at || '')),
    [visibleReports, visibleScans],
  );

  const selectedReport = useMemo(
    () => (selection?.kind === 'report' ? reports.find((r) => r.id === selection.id) ?? null : null),
    [reports, selection],
  );
  const selectedScan = useMemo(
    () => (selection?.kind === 'scan' ? scans.find((s) => s.id === selection.id) ?? null : null),
    [scans, selection],
  );

  const save = (state: EditState) => {
    if (state.id) {
      updateReport(state.id, state.draft);
      setSelection({ kind: 'report', id: state.id });
    } else {
      const id = createReport(state.draft);
      setSelection({ kind: 'report', id });
    }
    setEditing(null);
  };

  const remove = (report: Report) => {
    setSelection(null);
    scheduleDelete({
      key: `reports:${report.id}`,
      label: report.title ? `Rapport « ${report.title} »` : 'Rapport',
      commit: () => deleteReport(report.id),
    });
  };

  return (
    <section className="flex h-[calc(100dvh-8rem)] flex-col gap-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-text-primary">Rapports</h1>
          <p className="mt-1 font-mono text-xs uppercase tracking-widest text-text-muted">
            Mémoire de l’équipe · {reports.length} rapport{reports.length > 1 ? 's' : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditing({ draft: emptyDraft() });
            setSelection(null);
          }}
          className="flex items-center gap-2 bg-accent px-3 py-2 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover"
        >
          <Plus size={16} strokeWidth={2.25} />
          Nouveau rapport
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <Segmented
          value={typeFilter}
          onChange={(v) => setTypeFilter(v as ListFilter)}
          options={[
            { value: 'all', label: 'Tous' },
            ...TYPES.map((t) => ({ value: t.value, label: t.label })),
            { value: 'scanner', label: 'Scanner' },
          ]}
        />
        <Segmented
          value={dateFilter}
          onChange={(v) => setDateFilter(v as DateFilter)}
          options={[
            { value: 'all', label: 'Toujours' },
            { value: '90', label: '90 j' },
            { value: '30', label: '30 j' },
            { value: '7', label: '7 j' },
          ]}
        />
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,20rem)_1fr]">
        {/* List */}
        <div className="flex min-h-0 flex-col overflow-y-auto rounded-lg border border-border bg-surface">
          {items.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
              <FileText size={22} strokeWidth={1.5} className="text-text-muted" />
              <p className="text-sm text-text-secondary">
                {reports.length === 0 && scans.length === 0
                  ? 'Aucun rapport pour l’instant.'
                  : 'Aucun rapport pour ces filtres.'}
              </p>
            </div>
          ) : (
            items.map((item) =>
              item.kind === 'report' ? (
                <button
                  key={`report:${item.id}`}
                  type="button"
                  onClick={() => {
                    setSelection({ kind: 'report', id: item.id });
                    setEditing(null);
                  }}
                  className={`flex flex-col gap-1 border-b border-border px-4 py-3 text-left transition-colors hover:bg-surface-hover ${
                    selection?.kind === 'report' && selection.id === item.id && !editing ? 'bg-surface-hover' : ''
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <TypeChip type={item.report.type} />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-text-primary">
                      {item.report.title || 'Sans titre'}
                    </span>
                  </div>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
                    {relativeTime(item.report.createdAt)}
                  </span>
                </button>
              ) : (
                <button
                  key={`scan:${item.id}`}
                  type="button"
                  onClick={() => {
                    setSelection({ kind: 'scan', id: item.id });
                    setEditing(null);
                  }}
                  className={`flex flex-col gap-1 border-b border-border px-4 py-3 text-left transition-colors hover:bg-surface-hover ${
                    selection?.kind === 'scan' && selection.id === item.id && !editing ? 'bg-surface-hover' : ''
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <ScanChip />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-text-primary">
                      {item.scan.results.target?.host ?? item.scan.url}
                    </span>
                    <span className={`flex-shrink-0 font-mono text-xs font-semibold ${scoreColor(item.scan.score)}`}>
                      {item.scan.score}
                    </span>
                  </div>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
                    {relativeTime(item.scan.createdAt)}
                  </span>
                </button>
              ),
            )
          )}
        </div>

        {/* Detail / editor */}
        <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-surface">
          {editing ? (
            <ReportEditor
              state={editing}
              onChange={setEditing}
              onSave={() => save(editing)}
              onCancel={() => setEditing(null)}
            />
          ) : selectedReport ? (
            <ReportReader
              report={selectedReport}
              onEdit={() =>
                setEditing({
                  id: selectedReport.id,
                  draft: {
                    type: selectedReport.type,
                    title: selectedReport.title,
                    body: selectedReport.body,
                    links: selectedReport.links,
                  },
                })
              }
              onRemove={() => remove(selectedReport)}
            />
          ) : selectedScan ? (
            <div className="min-h-0 flex-1 overflow-y-auto">
              <ScanDetail scan={selectedScan} />
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
              <FileText size={26} strokeWidth={1.5} className="text-text-muted" />
              <p className="text-sm font-medium text-text-primary">Sélectionnez un rapport</p>
              <p className="max-w-sm text-sm text-text-secondary">
                Ou générez-en un depuis une tâche terminée, un client, une décision, ou un scan Elite.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/* --------------------------------- Reader -------------------------------- */

function ReportReader({
  report,
  onEdit,
  onRemove,
}: {
  report: Report;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const { profileFor } = useProfiles();
  return (
    <>
      <div className="flex items-start justify-between gap-3 border-b border-border px-6 py-4">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2">
            <TypeChip type={report.type} />
            <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
              {new Date(report.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
              {report.authorEmail && ` · ${profileFor(report.authorEmail).name}`}
            </span>
          </div>
          <h2 className="text-2xl font-semibold leading-tight text-text-primary">{report.title || 'Sans titre'}</h2>
        </div>
        <div className="flex flex-shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={onEdit}
            className="flex items-center gap-1.5 rounded-sm px-2 py-1 text-xs text-text-secondary hover:text-text-primary"
          >
            <Pencil size={13} strokeWidth={1.75} /> Éditer
          </button>
          <button
            type="button"
            onClick={onRemove}
            aria-label="Supprimer"
            className="flex h-7 w-7 items-center justify-center rounded text-text-muted hover:text-danger"
          >
            <Trash2 size={15} strokeWidth={1.75} />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        {report.links.length > 0 && (
          <div className="mb-5 flex flex-wrap gap-2">
            {report.links.map((l) => (
              <LinkChip key={`${l.kind}:${l.id}`} link={l} />
            ))}
          </div>
        )}
        {report.body.trim() ? (
          <div className="max-w-2xl leading-relaxed">
            <Markdown text={report.body} />
          </div>
        ) : (
          <p className="font-mono text-xs text-text-muted">Rapport vide.</p>
        )}
      </div>
    </>
  );
}

/** A clickable reference chip navigating back to the origin entity. */
function LinkChip({ link }: { link: ReportLink }) {
  const navigate = useNavigate();
  const go = () => {
    if (link.kind === 'task') navigate('/tasks', { state: { openTaskId: link.id } });
    else if (link.kind === 'client') navigate('/clients', { state: { focusClientId: Number(link.id) } });
    else navigate('/decisions', { state: { focusDecisionId: link.id } });
  };
  const Icon = link.kind === 'task' ? CheckSquare : link.kind === 'client' ? Contact : Scale;
  return (
    <button
      type="button"
      onClick={go}
      className="flex items-center gap-1.5 rounded-md border border-border bg-bg px-2 py-1 text-xs text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
    >
      <Icon size={12} strokeWidth={2} />
      {link.label}
    </button>
  );
}

/* --------------------------------- Editor -------------------------------- */

function ReportEditor({
  state,
  onChange,
  onSave,
  onCancel,
}: {
  state: EditState;
  onChange: (s: EditState) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const { draft } = state;
  const setDraft = (patch: Partial<ReportDraft>) => onChange({ ...state, draft: { ...draft, ...patch } });
  const [preview, setPreview] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const wrap = (before: string, after = before) => {
    const el = bodyRef.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e } = el;
    const sel = draft.body.slice(s, e) || 'texte';
    setDraft({ body: draft.body.slice(0, s) + before + sel + after + draft.body.slice(e) });
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(s + before.length, s + before.length + sel.length);
    });
  };
  const prefixLine = (marker: string) => {
    const el = bodyRef.current;
    if (!el) return;
    const { selectionStart: s } = el;
    const lineStart = draft.body.lastIndexOf('\n', s - 1) + 1;
    setDraft({ body: draft.body.slice(0, lineStart) + marker + draft.body.slice(lineStart) });
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(s + marker.length, s + marker.length);
    });
  };
  const codeBlock = () => {
    const el = bodyRef.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e } = el;
    const sel = draft.body.slice(s, e) || 'code';
    setDraft({ body: `${draft.body.slice(0, s)}\n\`\`\`\n${sel}\n\`\`\`\n${draft.body.slice(e)}` });
    requestAnimationFrame(() => el.focus());
  };
  const tools = [
    { icon: Bold, label: 'Gras', run: () => wrap('**') },
    { icon: Italic, label: 'Italique', run: () => wrap('*') },
    { icon: Heading1, label: 'Titre', run: () => prefixLine('## ') },
    { icon: List, label: 'Liste', run: () => prefixLine('- ') },
    { icon: Code2, label: 'Bloc de code', run: codeBlock },
  ];

  return (
    <>
      <div className="flex items-center gap-3 border-b border-border px-5 py-3">
        <input
          autoFocus
          value={draft.title}
          onChange={(e) => setDraft({ title: e.target.value })}
          placeholder="Titre du rapport"
          className="min-w-0 flex-1 bg-transparent text-lg font-semibold text-text-primary outline-none placeholder:text-text-muted"
        />
        <select
          value={draft.type}
          onChange={(e) => setDraft({ type: e.target.value as ReportType })}
          aria-label="Type de rapport"
          className="input-focus cursor-pointer border border-border bg-bg px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-text-secondary"
        >
          {TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-1 border-b border-border px-3 py-1.5">
        {tools.map((t) => (
          <button
            key={t.label}
            type="button"
            onClick={t.run}
            disabled={preview}
            aria-label={t.label}
            title={t.label}
            className="flex h-7 w-7 items-center justify-center rounded text-text-muted transition-colors hover:bg-surface-hover hover:text-text-primary disabled:opacity-30"
          >
            <t.icon size={15} strokeWidth={1.75} />
          </button>
        ))}
        <button
          type="button"
          onClick={() => setPreview((v) => !v)}
          className="ml-auto flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
        >
          {preview ? <Pencil size={12} strokeWidth={1.75} /> : <Eye size={12} strokeWidth={1.75} />}
          {preview ? 'Éditer' : 'Aperçu'}
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {preview ? (
          <div className="max-w-2xl px-5 py-4 leading-relaxed">
            {draft.body.trim() ? <Markdown text={draft.body} /> : <p className="font-mono text-xs text-text-muted">Rapport vide.</p>}
          </div>
        ) : (
          <textarea
            ref={bodyRef}
            value={draft.body}
            onChange={(e) => setDraft({ body: e.target.value })}
            placeholder="Rédigez le rapport… **gras**, *italique*, ## titre, - liste, ``` bloc de code ```"
            className="h-full min-h-[12rem] w-full resize-none bg-transparent px-5 py-4 font-mono text-sm leading-relaxed text-text-primary outline-none placeholder:text-text-muted"
          />
        )}
      </div>

      {/* Linked elements */}
      <LinkManager links={draft.links} onChange={(links) => setDraft({ links })} />

      <div className="flex items-center gap-2 border-t border-border p-3">
        <button
          type="button"
          onClick={onSave}
          disabled={!draft.title.trim() && !draft.body.trim()}
          className="bg-accent px-4 py-2 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover disabled:opacity-40"
        >
          Enregistrer
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="border border-border px-3 py-2 text-sm text-text-secondary transition-colors hover:text-text-primary"
        >
          Annuler
        </button>
      </div>
    </>
  );
}

/* ------------------------------ Link manager ----------------------------- */

function LinkManager({ links, onChange }: { links: ReportLink[]; onChange: (links: ReportLink[]) => void }) {
  const [open, setOpen] = useState(false);
  const tasks = useCollection<{ title?: string }>('tasks');
  const decisions = useCollection<{ title?: string }>('decisions');
  const [clients, setClients] = useState<Client[]>([]);

  useEffect(() => {
    let active = true;
    bridge()
      .clients.list()
      .then((c) => active && setClients(c))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const has = (kind: ReportLink['kind'], id: string) => links.some((l) => l.kind === kind && l.id === id);
  const add = (link: ReportLink) => {
    if (!has(link.kind, link.id)) onChange([...links, link]);
    setOpen(false);
  };
  const removeLink = (link: ReportLink) => onChange(links.filter((l) => !(l.kind === link.kind && l.id === link.id)));

  const candidates: ReportLink[] = [
    ...tasks.map((t) => ({ kind: 'task' as const, id: t.id, label: t.title || 'Tâche' })),
    ...decisions.map((d) => ({ kind: 'decision' as const, id: d.id, label: d.title || 'Décision' })),
    ...clients.map((c) => ({ kind: 'client' as const, id: String(c.id), label: c.name })),
  ].filter((c) => !has(c.kind, c.id));

  return (
    <div className="border-t border-border px-3 py-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">Éléments liés</span>
        {links.map((l) => {
          const Icon = l.kind === 'task' ? CheckSquare : l.kind === 'client' ? Contact : Scale;
          return (
            <span key={`${l.kind}:${l.id}`} className="group/l flex items-center gap-1 rounded-sm bg-white/[0.06] px-1.5 py-0.5 text-[11px] text-text-secondary">
              <Icon size={11} strokeWidth={2} />
              {l.label}
              <button
                type="button"
                onClick={() => removeLink(l)}
                aria-label="Retirer le lien"
                className="opacity-0 transition-opacity hover:text-danger group-hover/l:opacity-100"
              >
                <X size={10} strokeWidth={2.5} />
              </button>
            </span>
          );
        })}
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-1 rounded-sm border border-dashed border-border px-1.5 py-0.5 text-[11px] text-text-muted transition-colors hover:border-accent/50 hover:text-accent"
          >
            <Link2 size={11} strokeWidth={2} /> Lier
          </button>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute bottom-full left-0 z-20 mb-1 max-h-64 w-64 overflow-y-auto rounded-lg border border-border bg-surface shadow-2xl"
            >
              {candidates.length === 0 ? (
                <p className="px-3 py-2 text-xs text-text-muted">Rien à lier.</p>
              ) : (
                candidates.slice(0, 40).map((c) => {
                  const Icon = c.kind === 'task' ? CheckSquare : c.kind === 'client' ? Contact : Scale;
                  return (
                    <button
                      key={`${c.kind}:${c.id}`}
                      type="button"
                      onClick={() => add(c)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
                    >
                      <Icon size={13} strokeWidth={1.75} className="text-text-muted" />
                      <span className="min-w-0 flex-1 truncate">{c.label}</span>
                      <span className="font-mono text-[9px] uppercase tracking-widest text-text-muted">
                        {typeLabel(c.kind)}
                      </span>
                    </button>
                  );
                })
              )}
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}

/* --------------------------------- Bits ---------------------------------- */

function TypeChip({ type }: { type: ReportType }) {
  return (
    <span className="flex-shrink-0 rounded-sm border border-border bg-bg px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-text-muted">
      {typeLabel(type)}
    </span>
  );
}

/** Same visual as TypeChip, with an icon — scans aren't a ReportType. */
function ScanChip() {
  return (
    <span className="flex flex-shrink-0 items-center gap-1 rounded-sm border border-border bg-bg px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-text-muted">
      <ScanLine size={9} strokeWidth={2} />
      Scanner
    </span>
  );
}

function Segmented({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div className="flex items-center border border-border bg-surface">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`px-3 py-2 font-mono text-[11px] uppercase tracking-wider transition-colors duration-150 ${
            value === opt.value ? 'bg-accent-muted text-text-primary' : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
