import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSauvegardeDifferee } from '../lib/useSauvegardeDifferee';
import { ScreenHeader } from '../components/ScreenHeader';
import { motion } from 'framer-motion';
import { BookOpen, Plus, Trash2 } from 'lucide-react';
import { useSync, useCollection, uid, stripMeta } from '../state/SyncContext';
import { useUndo } from '../state/UndoContext';
import { Skeleton } from '../components/Skeleton';
import { SaveIndicator } from '../components/SaveIndicator';
import { useHaloSignal } from '../components/EtatEcran';
import { staggerContainer, staggerItem } from '../lib/transitions';
import { relativeTime } from '../lib/time';

/**
 * COLLECTIF · CONNAISSANCES — le document à deux mains.
 *
 * Dans une base de connaissances, l'objet est LA PROCÉDURE, pas la liste : le
 * document prend la pleine largeur et l'index se réduit à une gouttière
 * étroite. On ne vient pas ici parcourir un catalogue, on vient lire une chose
 * qu'on sait déjà nommer.
 *
 * CE QUI EST RENDU VISIBLE ET QUI NE L'EST JAMAIS : LA RÈGLE DES DEUX MAINS.
 * Ce qui arrive d'un autre poste et qu'on n'a pas touché est ADOPTÉ ; ce qu'on
 * tape ne l'est jamais. La règle existait déjà dans `DocEditor` — elle était
 * juste invisible, donc invérifiable. Un passage qui vient d'arriver de
 * l'autre poste porte désormais un filet à sa gauche et une encre pleine, le
 * temps qu'on le voie, puis le filet s'efface.
 *
 * L'AMBRE, unique : le passage arrivé de l'autre poste — son filet et son
 * encre. Deux nœuds dans le document. Rien n'est arrivé, pas d'ambre.
 *
 * L'INDEX EST ALPHABÉTIQUE, PAS CHRONOLOGIQUE. On vient chercher une chose
 * qu'on sait nommer ; un classement par fraîcheur déplacerait sous les doigts
 * ce qu'on cherche au même endroit chaque fois.
 *
 * LA SUPPRESSION PASSE PAR L'ANNULATION DIFFÉRÉE — `scheduleDelete`, comme
 * partout dans le poste. (La direction la décrit comme irréversible et sans
 * annulation ; le produit dit l'inverse, et c'est lui qui fait foi.) La cible
 * reste élargie à 27 px pour une icône de 15, parce qu'elle est posée à côté
 * du titre qu'on est en train d'éditer.
 */

interface KnowledgeData {
  title: string;
  body: string;
  createdAt: string;
}
type SyncDoc = KnowledgeData & { id: string; updatedAt: string };

/**
 * La gouttière de l'index : 212 px, et le document prend tout le reste. La
 * classe est écrite en toutes lettres plus bas — une classe Tailwind construite
 * par interpolation n'est jamais générée, et la grille retomberait en une
 * colonne.
 */
const GOUTTIERE = 212;
/** Le temps qu'un passage adopté garde son filet : assez pour être vu, pas assez pour devenir un décor. */
const FILET_MS = 14_000;

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
          docs.length === 0 ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-[212px_1fr]'
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
                  <BookOpen size={14} strokeWidth={1.9} className="mt-0.5 flex-shrink-0 text-text-muted" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-text-primary">{doc.title || 'Sans titre'}</p>
                    {/* Le mode d'échec du module : un document créé et jamais écrit. L'index doit permettre de le voir. */}
                    <p className="font-mono text-[10px] text-text-muted">
                      {doc.body.trim() ? `Modifié ${relativeTime(doc.updatedAt)}` : 'vide'}
                    </p>
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

      {/* LA RÈGLE DES DEUX MAINS, ÉCRITE. Elle décide de ce qui se passe sous les doigts : elle ne peut pas rester implicite. */}
      {docs.length > 0 && (
        <div className="border border-border-raised bg-elevated px-6 py-[22px] sm:px-8">
          <div className="grid gap-5 sm:grid-cols-2">
            <p className="text-[13px] leading-relaxed text-text-secondary [text-wrap:pretty]">
              <b className="font-semibold text-text-primary">Adopté.</b> Ce qui arrive de l’autre poste alors qu’on n’a rien touché depuis remplace ce qu’on lisait, et le passage porte un filet le temps qu’on le voie.
            </p>
            <p className="text-[13px] leading-relaxed text-text-secondary [text-wrap:pretty]">
              <b className="font-semibold text-text-primary">Jamais adopté.</b> Ce qu’on tape. Tant qu’on écrit, rien de ce qui arrive ne vient l’écraser — l’enregistrement part quand la frappe s’arrête, et le témoin le dit.
            </p>
          </div>
          <p className="mt-4 border-t border-border-raised pt-4 text-[12.5px] leading-relaxed text-text-muted [text-wrap:pretty]">
            L’index tient dans une gouttière de {GOUTTIERE} px et reste ALPHABÉTIQUE : on vient chercher une chose qu’on sait nommer, et un classement par fraîcheur déplacerait sous les doigts ce qu’on cherche au même endroit chaque fois. Un document créé et jamais écrit s’y lit « vide » — c’est le mode d’échec du module, et l’index doit permettre de le voir. La suppression passe par l’annulation différée, et sa cible fait 27 px pour une icône de 15, parce qu’elle est posée à côté du titre qu’on édite.
          </p>
        </div>
      )}
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
  /*
    LES PASSAGES ADOPTÉS. La règle des deux mains existait et ne se voyait pas.
    Un passage présent dans la version qui arrive et absent de celle qu'on
    avait est un passage écrit par l'autre poste : on le met sous les yeux, le
    temps qu'il soit vu, puis le filet s'efface. Ce qu'on tape soi-même ne
    passe jamais par ici — l'adoption ne se déclenche que si notre texte n'a
    pas bougé depuis la dernière version reçue.
  */
  const [adoptes, setAdoptes] = useState<string[]>([]);
  const halo = useHaloSignal(adoptes.length > 0);
  useEffect(() => {
    if (doc.title !== adopte.current.title) {
      if (title === adopte.current.title) setTitle(doc.title);
      adopte.current.title = doc.title;
    }
    if (doc.body !== adopte.current.body) {
      if (body === adopte.current.body) {
        setBody(doc.body);
        const avant = new Set(adopte.current.body.split(/\n{2,}/).map((p) => p.trim()));
        const arrives = doc.body.split(/\n{2,}/).map((p) => p.trim()).filter((p) => p && !avant.has(p));
        if (arrives.length > 0) setAdoptes(arrives);
      }
      adopte.current.body = doc.body;
    }
  }, [doc.title, doc.body]);

  /* Le filet ne reste pas : passé ce délai, le passage est du texte comme un autre. */
  useEffect(() => {
    if (adoptes.length === 0) return undefined;
    const id = window.setTimeout(() => setAdoptes([]), FILET_MS);
    return () => window.clearTimeout(id);
  }, [adoptes]);

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
          <Trash2 size={15} strokeWidth={1.9} />
        </button>
      </div>
      {adoptes.length > 0 && (
        /* L'AMBRE : le filet à gauche et l'encre pleine. Deux nœuds, dans le document. */
        <div className="border-b border-border px-4 pb-3 pt-3.5">
          <span className="block font-mono text-[9.5px] uppercase tracking-[0.14em] text-text-muted">
            {adoptes.length > 1 ? `${adoptes.length} passages viennent d’arriver de l’autre poste` : 'Un passage vient d’arriver de l’autre poste'}
          </span>
          <div className="mt-2 flex flex-col gap-2">
            {adoptes.slice(0, 3).map((p) => (
              <p key={p} data-signal-groupe="passage-adopte" className={`border-l-2 border-signal pl-3 text-[13px] leading-relaxed text-text-primary [text-wrap:pretty] ${halo}`}>
                {p}
              </p>
            ))}
          </div>
        </div>
      )}
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
