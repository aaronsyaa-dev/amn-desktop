import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSauvegardeDifferee } from '../lib/useSauvegardeDifferee';
import { ScreenHeader } from '../components/ScreenHeader';
import { motion } from 'framer-motion';
import { BookOpen, Plus, Trash2 } from 'lucide-react';
import { useSync, useCollection, uid, stripMeta } from '../state/SyncContext';
import { useUndo } from '../state/UndoContext';
import { Skeleton } from '../components/Skeleton';
import { SaveIndicator } from '../components/SaveIndicator';
import { staggerContainer, staggerItem } from '../lib/transitions';
import { relativeTime } from '../lib/time';

interface KnowledgeData {
  title: string;
  body: string;
  createdAt: string;
}
type SyncDoc = KnowledgeData & { id: string; updatedAt: string };

export function KnowledgeScreen() {
  const { upsert, remove, ready } = useSync();
  const { isPending, scheduleDelete } = useUndo();
  const docsRaw = useCollection<KnowledgeData>('knowledge');
  const docs = useMemo(
    () =>
      [...docsRaw]
        .filter((d) => !isPending(`knowledge:${d.id}`))
        .sort((a, b) => (a.title || '').localeCompare(b.title || '', 'fr')),
    [docsRaw, isPending],
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (selectedId === null && docs.length > 0) setSelectedId(docs[0].id);
  }, [docs, selectedId]);

  const selected = useMemo(() => docs.find((d) => d.id === selectedId) ?? null, [docs, selectedId]);

  const createDoc = () => {
    const id = uid('kb');
    upsert('knowledge', id, { title: 'Nouveau document', body: '', createdAt: new Date().toISOString() });
    setSelectedId(id);
  };

  const removeDoc = (id: string) => {
    const doc = docs.find((d) => d.id === id);
    scheduleDelete({
      key: `knowledge:${id}`,
      label: doc?.title ? `Document « ${doc.title} »` : 'Document',
      commit: () => remove('knowledge', id),
    });
    if (selectedId === id) setSelectedId(null);
  };

  return (
    <section className={`flex flex-col gap-4 ${docs.length === 0 ? '' : 'screen-h'}`}>
      <ScreenHeader
        eyebrow="Poste de travail · Connaissances"
        title="Base de connaissances"
        description="Les procédures et les modèles réutilisables, partagés."
        stats={[{ label: 'Documents', value: docs.length }]}
        actions={
          <button
            type="button"
            onClick={createDoc}
            className="flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover"
          >
            <Plus size={16} strokeWidth={2.25} />
            Nouveau document
          </button>
        }
      />

      {/* Même règle : pas de colonne de détail sans sujet (BLOC A). */}
      <div
        className={`grid min-h-0 flex-1 gap-4 ${
          docs.length === 0 ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-[280px_1fr]'
        }`}
      >
        <div className="flex min-h-0 flex-col border border-border bg-surface">
          <div className="border-b border-border px-4 py-3 font-mono text-[11px] uppercase tracking-widest text-text-secondary">
            Documents
          </div>
          <motion.div variants={staggerContainer} initial="initial" animate="animate" className="flex-1 divide-y divide-border/60 overflow-y-auto">
            {!ready ? (
              <div className="space-y-3 p-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <Skeleton className="mt-0.5 h-4 w-4 flex-shrink-0 rounded-sm" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3 w-2/3 rounded-sm" />
                      <Skeleton className="h-2.5 w-1/3 rounded-sm" />
                    </div>
                  </div>
                ))}
              </div>
            ) : docs.length === 0 ? (
              <p className="px-4 py-6 font-mono text-xs text-text-muted">Aucun document.</p>
            ) : (
              docs.map((doc) => (
                <motion.button
                  key={doc.id}
                  variants={staggerItem}
                  type="button"
                  onClick={() => setSelectedId(doc.id)}
                  className={`group/doc relative flex w-full items-start gap-2.5 px-4 py-3 text-left transition-colors duration-150 ${
                    doc.id === selectedId ? 'bg-surface-hover' : 'hover:bg-surface-hover'
                  }`}
                >
                  {doc.id === selectedId && <span className="absolute left-0 top-0 h-full w-0.5 bg-accent" />}
                  <BookOpen size={14} strokeWidth={1.75} className="mt-0.5 flex-shrink-0 text-text-muted" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-text-primary">{doc.title || 'Sans titre'}</p>
                    <p className="font-mono text-[10px] text-text-muted">Modifié {relativeTime(doc.updatedAt)}</p>
                  </div>
                </motion.button>
              ))
            )}
          </motion.div>
        </div>

        {selected ? (
          <DocEditor
            key={selected.id}
            doc={selected}
            onSave={(id, patch) => upsert('knowledge', id, { ...stripMeta(selected), ...patch })}
            onRemove={removeDoc}
          />
        ) : docs.length === 0 && ready ? null : (
          <div className="flex items-center justify-center border border-border bg-surface font-mono text-xs uppercase tracking-widest text-text-muted">
            {!ready ? 'Chargement…' : 'Sélectionnez un document'}
          </div>
        )}
      </div>
    </section>
  );
}

function DocEditor({
  doc,
  onSave,
  onRemove,
}: {
  doc: SyncDoc;
  onSave: (id: string, patch: { title?: string; body?: string }) => void;
  onRemove: (id: string) => void;
}) {
  const [title, setTitle] = useState(doc.title);
  const [body, setBody] = useState(doc.body);
  const { programmer, saved } = useSauvegardeDifferee<{ title: string; body: string }>((v) => onSave(doc.id, v));
  const scheduleSave = (nextTitle: string, nextBody: string) => programmer({ title: nextTitle, body: nextBody });

  // Même règle que les Notes : ce qui arrive d'un autre poste et qu'on n'a
  // pas touché depuis est adopté ; ce qu'on tape ne l'est jamais.
  const adopte = useRef({ title: doc.title, body: doc.body });
  useEffect(() => {
    if (doc.title !== adopte.current.title) {
      if (title === adopte.current.title) setTitle(doc.title);
      adopte.current.title = doc.title;
    }
    if (doc.body !== adopte.current.body) {
      if (body === adopte.current.body) setBody(doc.body);
      adopte.current.body = doc.body;
    }
  }, [doc.title, doc.body]);

  return (
    <div className="flex min-h-0 flex-col border border-border bg-surface">
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            scheduleSave(e.target.value, body);
          }}
          placeholder="Titre du document"
          className="flex-1 bg-transparent text-lg font-semibold text-text-primary outline-none placeholder:text-text-muted"
        />
        <SaveIndicator saved={saved} />
        <button
          type="button"
          onClick={() => onRemove(doc.id)}
          aria-label="Supprimer le document"
          // 15 × 15 px mesurés, pour un geste IRRÉVERSIBLE posé juste à côté du
          // titre qu'on est en train d'éditer. `-m-1.5 p-1.5` porte la zone à
          // 27 px sans déplacer quoi que ce soit sur la ligne.
          className="-m-1.5 p-1.5 text-text-muted hover:text-danger"
        >
          <Trash2 size={15} strokeWidth={1.75} />
        </button>
      </div>
      <textarea
        value={body}
        onChange={(e) => {
          setBody(e.target.value);
          scheduleSave(title, e.target.value);
        }}
        placeholder="Contenu du document — procédure, modèle d’email, étapes d’un audit type…"
        className="min-h-0 flex-1 resize-none bg-transparent p-4 text-sm leading-relaxed text-text-primary outline-none placeholder:text-text-muted"
      />
    </div>
  );
}
