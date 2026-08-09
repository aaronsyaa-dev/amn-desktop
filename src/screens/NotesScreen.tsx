import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Bold,
  Code2,
  Eye,
  Heading1,
  Italic,
  List,
  Lock,
  Pencil,
  Pin,
  PinOff,
  Plus,
  Search,
  Trash2,
  Users,
} from 'lucide-react';
import { useNotes, type Note } from '../state/useNotes';
import { TEAM_ENABLED } from '@edition/exclusive';
import { useUndo } from '../state/UndoContext';
import { SaveIndicator } from '../components/SaveIndicator';
import { Markdown } from '../lib/markdown';
import { staggerContainer, staggerItem } from '../lib/transitions';
import { relativeTime } from '../lib/time';

type ScopeFilter = 'all' | 'team' | 'personal';

export function NotesScreen() {
  const { notes, createNote, updateNote, togglePin, deleteNote } = useNotes();
  const { isPending, scheduleDelete } = useUndo();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<ScopeFilter>('all');
  const [newMenuOpen, setNewMenuOpen] = useState(false);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return notes.filter((n) => {
      if (isPending(`notes:${n.id}`)) return false;
      if (scope !== 'all' && n.scope !== scope) return false;
      if (!q) return true;
      return n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q);
    });
  }, [notes, query, scope, isPending]);

  useEffect(() => {
    if (selectedId && !notes.some((n) => n.id === selectedId)) setSelectedId(null);
  }, [notes, selectedId]);

  const selected = useMemo(() => notes.find((n) => n.id === selectedId) ?? null, [notes, selectedId]);

  const startNew = (s: 'team' | 'personal') => {
    setNewMenuOpen(false);
    const id = createNote(s);
    setScope('all');
    setSelectedId(id);
  };

  const removeNote = (note: Note) => {
    scheduleDelete({
      key: `notes:${note.id}`,
      label: note.title ? `Note « ${note.title} »` : 'Note',
      commit: () => deleteNote(note.id),
    });
    if (selectedId === note.id) setSelectedId(null);
  };

  return (
    <section className="flex h-[calc(100dvh-8rem)] flex-col gap-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-text-primary">Notes</h1>
          <p className="mt-1 font-mono text-xs uppercase tracking-widest text-text-muted">
            Bloc-notes · {notes.length} note{notes.length > 1 ? 's' : ''}
            {TEAM_ENABLED ? ' · perso & équipe' : ''}
          </p>
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={() => (TEAM_ENABLED ? setNewMenuOpen((v) => !v) : startNew('team'))}
            className="flex items-center gap-2 bg-accent px-3 py-2 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover"
          >
            <Plus size={16} strokeWidth={2.25} />
            Nouvelle note
          </button>
          {TEAM_ENABLED && newMenuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setNewMenuOpen(false)} />
              <div className="absolute right-0 z-20 mt-1 w-56 overflow-hidden rounded-xl border border-border bg-surface elev-2">
                <button
                  type="button"
                  onClick={() => startNew('personal')}
                  className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
                >
                  <Lock size={14} strokeWidth={1.75} className="text-text-muted" />
                  <span className="flex-1">Note personnelle</span>
                  <span className="font-mono text-[9px] uppercase tracking-widest text-text-muted">Privé</span>
                </button>
                <button
                  type="button"
                  onClick={() => startNew('team')}
                  className="flex w-full items-center gap-2.5 border-t border-border px-3 py-2.5 text-left text-sm text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
                >
                  <Users size={14} strokeWidth={1.75} className="text-text-muted" />
                  <span className="flex-1">Note d’équipe</span>
                  <span className="font-mono text-[9px] uppercase tracking-widest text-text-muted">Partagé</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 md:grid-cols-[300px_1fr]">
        {/* List */}
        <div className="flex min-h-0 flex-col border border-border bg-surface">
          <div className="border-b border-border p-3">
            <div className="input-focus mb-2 flex items-center gap-2 rounded-lg border border-border bg-bg px-2.5 py-1.5">
              <Search size={14} strokeWidth={1.75} className="text-text-muted" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Rechercher…"
                className="min-w-0 flex-1 bg-transparent text-sm text-text-primary outline-none placeholder:text-text-muted"
              />
            </div>
            {TEAM_ENABLED && (
            <div className="flex items-center gap-1">
              {(['all', 'personal', 'team'] as ScopeFilter[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setScope(s)}
                  className={`flex-1 rounded-md px-2 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors ${
                    scope === s ? 'bg-accent-muted text-text-primary' : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {s === 'all' ? 'Toutes' : s === 'personal' ? 'Perso' : 'Équipe'}
                </button>
              ))}
            </div>
            )}
          </div>
          <motion.div
            variants={staggerContainer}
            initial="initial"
            animate="animate"
            className="flex-1 divide-y divide-border/60 overflow-y-auto"
          >
            {visible.length === 0 ? (
              <p className="px-4 py-6 font-mono text-xs text-text-muted">
                {query || scope !== 'all' ? 'Aucune note ne correspond.' : 'Aucune note. Créez-en une.'}
              </p>
            ) : (
              visible.map((note) => (
                <motion.button
                  key={note.id}
                  variants={staggerItem}
                  type="button"
                  onClick={() => setSelectedId(note.id)}
                  className={`relative flex w-full items-start gap-2.5 px-4 py-3 text-left transition-colors duration-150 ${
                    note.id === selectedId ? 'bg-surface-hover' : 'hover:bg-surface-hover'
                  }`}
                >
                  {note.id === selectedId && <span className="absolute left-0 top-0 h-full w-0.5 bg-accent" />}
                  {!TEAM_ENABLED ? null : note.scope === 'personal' ? (
                    <Lock size={13} strokeWidth={1.75} className="mt-0.5 flex-shrink-0 text-text-muted" />
                  ) : (
                    <Users size={13} strokeWidth={1.75} className="mt-0.5 flex-shrink-0 text-text-muted" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate text-sm font-medium text-text-primary">
                      {note.pinned && <Pin size={11} strokeWidth={2} className="flex-shrink-0 fill-accent text-accent" />}
                      <span className="truncate">{note.title || 'Sans titre'}</span>
                    </p>
                    <p className="font-mono text-[10px] text-text-muted">Modifié {relativeTime(note.updatedAt)}</p>
                  </div>
                </motion.button>
              ))
            )}
          </motion.div>
        </div>

        {/* Editor */}
        {selected ? (
          <NoteEditor
            key={selected.id}
            note={selected}
            onSave={(patch) => updateNote(selected.id, patch)}
            onTogglePin={() => togglePin(selected)}
            onRemove={() => removeNote(selected)}
          />
        ) : (
          <div className="flex items-center justify-center border border-border bg-surface font-mono text-xs uppercase tracking-widest text-text-muted">
            Sélectionnez ou créez une note
          </div>
        )}
      </div>
    </section>
  );
}

function NoteEditor({
  note,
  onSave,
  onTogglePin,
  onRemove,
}: {
  note: Note;
  onSave: (patch: { title?: string; body?: string }) => void;
  onTogglePin: () => void;
  onRemove: () => void;
}) {
  const [title, setTitle] = useState(note.title);
  const [body, setBody] = useState(note.body);
  const [saved, setSaved] = useState(true);
  const [preview, setPreview] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const scheduleSave = (nextTitle: string, nextBody: string) => {
    setSaved(false);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      onSave({ title: nextTitle, body: nextBody });
      setSaved(true);
    }, 600);
  };

  /** Wraps the current selection with markdown markers (bold/italic/code). */
  const wrap = (before: string, after = before) => {
    const el = bodyRef.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e } = el;
    const sel = body.slice(s, e) || 'texte';
    const next = body.slice(0, s) + before + sel + after + body.slice(e);
    setBody(next);
    scheduleSave(title, next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(s + before.length, s + before.length + sel.length);
    });
  };

  /** Prefixes the current line(s) with a marker (heading / list). */
  const prefixLine = (marker: string) => {
    const el = bodyRef.current;
    if (!el) return;
    const { selectionStart: s } = el;
    const lineStart = body.lastIndexOf('\n', s - 1) + 1;
    const next = body.slice(0, lineStart) + marker + body.slice(lineStart);
    setBody(next);
    scheduleSave(title, next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(s + marker.length, s + marker.length);
    });
  };

  const codeBlock = () => {
    const el = bodyRef.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e } = el;
    const sel = body.slice(s, e) || 'code';
    const insert = `\n\`\`\`\n${sel}\n\`\`\`\n`;
    const next = body.slice(0, s) + insert + body.slice(e);
    setBody(next);
    scheduleSave(title, next);
    requestAnimationFrame(() => el.focus());
  };

  const tools: Array<{ icon: typeof Bold; label: string; run: () => void }> = [
    { icon: Bold, label: 'Gras', run: () => wrap('**') },
    { icon: Italic, label: 'Italique', run: () => wrap('*') },
    { icon: Heading1, label: 'Titre', run: () => prefixLine('# ') },
    { icon: List, label: 'Liste', run: () => prefixLine('- ') },
    { icon: Code2, label: 'Bloc de code', run: codeBlock },
  ];

  return (
    <div className="flex min-h-0 flex-col border border-border bg-surface">
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        {TEAM_ENABLED && (
          <span
            className="flex items-center gap-1 rounded-md border border-border bg-bg px-2 py-1 font-mono text-[9px] uppercase tracking-widest text-text-muted"
            title={note.scope === 'personal' ? 'Visible par vous seul' : 'Partagée avec l’équipe'}
          >
            {note.scope === 'personal' ? <Lock size={10} /> : <Users size={10} />}
            {note.scope === 'personal' ? 'Perso' : 'Équipe'}
          </span>
        )}
        <input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            scheduleSave(e.target.value, body);
          }}
          placeholder="Titre de la note"
          className="min-w-0 flex-1 bg-transparent text-lg font-semibold text-text-primary outline-none placeholder:text-text-muted"
        />
        <SaveIndicator saved={saved} />
        <button
          type="button"
          onClick={onTogglePin}
          aria-label={note.pinned ? 'Désépingler' : 'Épingler'}
          className={`flex h-7 w-7 items-center justify-center rounded ${note.pinned ? 'text-accent' : 'text-text-muted hover:text-text-primary'}`}
        >
          {note.pinned ? <PinOff size={15} strokeWidth={1.75} /> : <Pin size={15} strokeWidth={1.75} />}
        </button>
        <button
          type="button"
          onClick={onRemove}
          aria-label="Supprimer la note"
          className="flex h-7 w-7 items-center justify-center rounded text-text-muted hover:text-danger"
        >
          <Trash2 size={15} strokeWidth={1.75} />
        </button>
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
        <div className="ml-auto">
          <button
            type="button"
            onClick={() => setPreview((v) => !v)}
            className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
          >
            {preview ? <Pencil size={12} strokeWidth={1.75} /> : <Eye size={12} strokeWidth={1.75} />}
            {preview ? 'Éditer' : 'Aperçu'}
          </button>
        </div>
      </div>

      {preview ? (
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {body.trim() ? (
            <Markdown text={body} />
          ) : (
            <p className="font-mono text-xs text-text-muted">Note vide.</p>
          )}
        </div>
      ) : (
        <textarea
          ref={bodyRef}
          value={body}
          onChange={(e) => {
            setBody(e.target.value);
            scheduleSave(title, e.target.value);
          }}
          placeholder="Écrivez ici… **gras**, *italique*, # titre, - liste, ``` bloc de code ```"
          className="min-h-0 flex-1 resize-none bg-transparent p-4 font-mono text-sm leading-relaxed text-text-primary outline-none placeholder:text-text-muted"
        />
      )}
    </div>
  );
}
