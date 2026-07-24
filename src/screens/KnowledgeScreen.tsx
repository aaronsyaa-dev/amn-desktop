import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, Plus, Trash2 } from 'lucide-react';
import { bridge } from '../lib/bridge';
import { staggerContainer, staggerItem } from '../lib/transitions';
import { relativeTime } from '../lib/time';
import type { KnowledgeDoc } from '../shared/api';

export function KnowledgeScreen() {
  const [docs, setDocs] = useState<KnowledgeDoc[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    bridge()
      .knowledge.list()
      .then((list) => {
        if (!active) return;
        setDocs(list);
        setSelectedId((prev) => prev ?? list[0]?.id ?? null);
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const selected = useMemo(() => docs.find((d) => d.id === selectedId) ?? null, [docs, selectedId]);

  const replaceDoc = (updated: KnowledgeDoc) =>
    setDocs((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));

  const createDoc = async () => {
    const created = await bridge().knowledge.create({ title: 'Nouveau document', body: '' });
    setDocs((prev) => [...prev, created].sort((a, b) => a.title.localeCompare(b.title, 'fr')));
    setSelectedId(created.id);
  };

  const removeDoc = async (id: number) => {
    await bridge().knowledge.remove(id);
    setDocs((prev) => prev.filter((d) => d.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  return (
    <section className="flex h-[calc(100vh-8rem)] flex-col gap-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-text-primary">Base de connaissances</h1>
          <p className="mt-1 font-mono text-xs uppercase tracking-widest text-text-muted">
            Procédures et modèles réutilisables · {docs.length} document{docs.length > 1 ? 's' : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={createDoc}
          className="flex items-center gap-2 bg-accent px-3 py-2 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover"
        >
          <Plus size={16} strokeWidth={2.25} />
          Nouveau document
        </button>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 md:grid-cols-[280px_1fr]">
        <div className="flex min-h-0 flex-col border border-border bg-surface">
          <div className="border-b border-border px-4 py-3 font-mono text-[11px] uppercase tracking-widest text-text-secondary">
            Documents
          </div>
          <motion.div variants={staggerContainer} initial="initial" animate="animate" className="flex-1 divide-y divide-border/60 overflow-y-auto">
            {loading ? (
              <p className="px-4 py-6 font-mono text-xs text-text-muted">Chargement…</p>
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
          <DocEditor key={selected.id} doc={selected} onSave={replaceDoc} onRemove={removeDoc} />
        ) : (
          <div className="flex items-center justify-center border border-border bg-surface font-mono text-xs uppercase tracking-widest text-text-muted">
            {loading ? 'Chargement…' : 'Sélectionnez ou créez un document'}
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
  doc: KnowledgeDoc;
  onSave: (doc: KnowledgeDoc) => void;
  onRemove: (id: number) => void;
}) {
  const [title, setTitle] = useState(doc.title);
  const [body, setBody] = useState(doc.body);
  const [saved, setSaved] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleSave = (nextTitle: string, nextBody: string) => {
    setSaved(false);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const updated = await bridge().knowledge.update(doc.id, { title: nextTitle, body: nextBody });
      onSave(updated);
      setSaved(true);
    }, 600);
  };

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
        <span className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
          {saved ? 'Enregistré' : '…'}
        </span>
        <button
          type="button"
          onClick={() => onRemove(doc.id)}
          aria-label="Supprimer le document"
          className="text-text-muted hover:text-danger"
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
