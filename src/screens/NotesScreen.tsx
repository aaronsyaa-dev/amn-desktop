import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScreenHeader } from '../components/ScreenHeader';
import { motion } from 'framer-motion';
import {
  CalendarDays,
  Bold,
  Code2,
  CornerUpLeft,
  Eye,
  Heading1,
  Italic,
  Link2 as LinkIcon,
  List,
  Lock,
  Pencil,
  Pin,
  PinOff,
  Plus,
  Network,
  Rows3,
  Search,
  Trash2,
  Users,
} from 'lucide-react';
import { useNotes, type Note } from '../state/useNotes';
import { useExclusive } from '@edition/exclusive';
import { useUndo } from '../state/UndoContext';
import { SaveIndicator } from '../components/SaveIndicator';
import { Markdown } from '../lib/markdown';
import { staggerContainer, staggerItem } from '../lib/transitions';
import { relativeTime } from '../lib/time';
import { EmptyState } from '../components/EmptyState';
import { useFermetureEchap } from '../lib/useFermetureEchap';
import {
  extraireTags,
  insererLien,
  lierMention,
  mentionsNonLiees,
  resoudre,
  retroliens,
  saisieEnCours,
  sousGraphe,
  suggestions,
  type Graphe,
} from '../lib/notesLiens';
import { NotesGraphe } from '../components/NotesGraphe';

/*
  L'ordre d'ancienneté, pour trancher les homonymes (voir `notesLiens.ts`).
  Recalculé ici parce que l'éditeur résout un titre à la volée pour l'aperçu,
  sur une note fabriquée qui n'est pas dans le carnet.
*/
const ordreDe = (notes: Note[]) =>
  new Map(
    [...notes]
      .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''))
      .map((n, i) => [n.id, i]),
  );

type ScopeFilter = 'all' | 'team' | 'personal';

export function NotesScreen() {
  const { TEAM_ENABLED } = useExclusive();
  const { notes, createNote, updateNote, togglePin, deleteNote, graphe, renommer } = useNotes();
  const { isPending, scheduleDelete } = useUndo();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<ScopeFilter>('all');
  const [newMenuOpen, setNewMenuOpen] = useState(false);
  const [vue, setVue] = useState<'liste' | 'graphe'>('liste');

  /*
    Un menu déroulant se ferme à Échap comme une fenêtre : c'est le même geste
    de renoncement, et il est encore plus attendu ici — on vient d'ouvrir le
    menu par erreur et on veut juste qu'il parte. Le fond invisible qui capte
    le clic extérieur ne sert qu'à la souris.
  */
  useFermetureEchap(newMenuOpen, () => setNewMenuOpen(false));

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return notes.filter((n) => {
      if (isPending(`notes:${n.id}`)) return false;
      if (scope !== 'all' && n.scope !== scope) return false;
      if (!q) return true;
      // « #devis » : la recherche devient un filtre d'étiquette, exact et non fragmentaire.
      if (q.startsWith('#')) return extraireTags(n.body).includes(q.slice(1));
      return n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q);
    });
  }, [notes, query, scope, isPending]);

  /*
    LES ÉTIQUETTES DU CARNET. Ce qu'Obsidian appelle des tags : un mot précédé
    d'un dièse, écrit dans le corps. Elles ne sont pas une liste à tenir : on
    les lit dans les notes, et cliquer l'une d'elles filtre. Les plus
    fréquentes d'abord, douze au plus — au-delà, c'est la recherche.
  */
  const etiquettes = useMemo(() => {
    const compte = new Map<string, number>();
    for (const n of notes) for (const tag of extraireTags(n.body)) compte.set(tag, (compte.get(tag) ?? 0) + 1);
    return [...compte.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 12);
  }, [notes]);
  const tagActif = query.trim().toLowerCase().startsWith('#') ? query.trim().toLowerCase().slice(1) : null;

  /* LA NOTE DU JOUR : une par jour, titrée par la date, ouverte ou créée d'un geste. */
  const titreDuJour = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  const ouvrirNoteDuJour = () => {
    const existante = notes.find((n) => n.title.trim().toLowerCase() === titreDuJour.toLowerCase());
    if (existante) {
      setSelectedId(existante.id);
      return;
    }
    const id = createNote(TEAM_ENABLED ? 'personal' : 'team', titreDuJour);
    setScope('all');
    setSelectedId(id);
  };

  useEffect(() => {
    if (selectedId && !notes.some((n) => n.id === selectedId)) setSelectedId(null);
  }, [notes, selectedId]);

  /*
    Le dessin suit le même filtre que la liste. Sans ça, cliquer « Perso »
    laisserait le graphe montrer des notes d'équipe qui viennent de disparaître
    de la colonne d'à côté — deux vues du même carnet qui se contredisent.
  */
  const grapheVisible = useMemo(
    () => sousGraphe(graphe, new Set(visible.map((n) => n.id))),
    [graphe, visible],
  );

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
    <section className={`flex flex-col gap-4 ${notes.length === 0 ? '' : 'screen-h'}`}>
      <ScreenHeader
        eyebrow="Poste de travail · Notes"
        title="Notes"
        description={
          TEAM_ENABLED
            ? 'Le bloc-notes : ce qui est à vous, et ce qui est à l’équipe.'
            : 'Le bloc-notes — tout ce qu’on garde sous la main.'
        }
        stats={
          TEAM_ENABLED
            ? [
                { label: 'Notes', value: notes.length },
                { label: 'Personnelles', value: notes.filter((n) => n.scope === 'personal').length },
                { label: 'Équipe', value: notes.filter((n) => n.scope !== 'personal').length },
              ]
            : [{ label: 'Notes', value: notes.length }]
        }
        actions={
        <div className="flex items-center gap-3">
          {/*
            LISTE OU GRAPHE.

            Deux vues du même carnet, pas deux écrans : le filtre, la recherche
            et la note choisie survivent au passage de l'une à l'autre. On
            bascule pour retrouver quelque chose, pas pour changer de contexte.
          */}
          <button
            type="button"
            onClick={ouvrirNoteDuJour}
            title={titreDuJour}
            className="flex min-h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
          >
            <CalendarDays size={13} strokeWidth={1.75} />
            Note du jour
          </button>
          <div className="flex items-center gap-1 rounded-lg border border-border p-1" role="group" aria-label="Affichage des notes">
            {([
              ['liste', 'Liste', Rows3],
              ['graphe', 'Graphe', Network],
            ] as const).map(([v, nom, Icone]) => (
              <button
                key={v}
                type="button"
                onClick={() => setVue(v)}
                aria-pressed={vue === v}
                className={`flex min-h-8 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs transition-colors ${
                  vue === v
                    ? 'bg-accent-muted text-text-primary'
                    : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
                }`}
              >
                <Icone size={13} strokeWidth={1.75} />
                {nom}
              </button>
            ))}
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
        }
      />

      {/*
        LE GRAPHE PREND TOUTE LA PLACE.

        Un graphe dans une colonne de 300 px n'est pas un petit graphe : c'est
        un amas. Et on n'y vient pas pour lire une note — on y vient pour en
        RETROUVER une. Cliquer un point ramène donc à la liste, note ouverte :
        le graphe est un chemin vers l'éditeur, pas un endroit où rester.
      */}
      {vue === 'graphe' ? (
        <NotesGraphe
          graphe={grapheVisible}
          selectionne={selectedId}
          onOuvrir={(id) => {
            setSelectedId(id);
            setVue('liste');
          }}
          onCreer={(titre) => {
            const id = createNote(selected?.scope ?? 'team');
            updateNote(id, { title: titre });
            setSelectedId(id);
            setVue('liste');
          }}
        />
      ) : (
      <>
      {/* Même règle que Projets et Facturation : pas de colonne de détail
          sans sujet (BLOC A). */}
      <div
        className={`grid min-h-0 flex-1 gap-4 ${
          notes.length === 0 ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-[300px_1fr]'
        }`}
      >
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
            {etiquettes.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1" role="group" aria-label="Étiquettes">
                {etiquettes.map(([tag, n]) => (
                  <button
                    key={tag}
                    type="button"
                    aria-pressed={tagActif === tag}
                    onClick={() => setQuery(tagActif === tag ? '' : `#${tag}`)}
                    className={`min-h-8 rounded-md border px-2 font-mono text-[11px] transition-colors ${
                      tagActif === tag ? 'border-border-strong bg-surface-hover text-text-primary' : 'border-border text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    #{tag} <span className="text-text-muted">{n}</span>
                  </button>
                ))}
              </div>
            )}
            {TEAM_ENABLED && (
            <div className="flex items-center gap-2">
              {(['all', 'personal', 'team'] as ScopeFilter[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setScope(s)}
                  // `py-2.5` et non `py-1` : 15 px de haut au doigt, c'est en
                  // dessous du minimum tenable (WCAG 2.5.8 en demande 24).
                  className={`flex-1 rounded-lg px-2 py-2.5 font-mono text-[10px] uppercase tracking-wider transition-colors ${
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
              /*
                NOTES (BLOC A) — « Aucune note. Créez-en une. » disait le geste
                sans l'offrir : le bouton de création est ailleurs, en haut. La
                phrase porte maintenant l'action elle-même.
              */
              <div className="px-4">
                {query || scope !== 'all' ? (
                  <EmptyState quiet>Aucune note ne correspond.</EmptyState>
                ) : (
                  <EmptyState
                    action={{
                      // `startNew` et non `createNote` : la création seule
                      // écrirait une note que l'écran n'ouvrirait pas, et on
                      // resterait devant la même page vide.
                      //
                      // La portée suit l'édition (BLOC B). Ce geste-ci est le
                      // PREMIER que fait une cliente sur un compte neuf : c'est
                      // l'unique action de la page vide. Il proposait « note
                      // personnelle » — donc du localStorage, invisible depuis
                      // son téléphone et effacé par une réinstallation — alors
                      // qu'elle est seule dans son organisation et que rien à
                      // l'écran ne distingue ensuite cette note des autres.
                      label: TEAM_ENABLED ? 'Nouvelle note personnelle' : 'Nouvelle note',
                      onClick: () => startNew(TEAM_ENABLED ? 'personal' : 'team'),
                    }}
                  >
                    {/*
                      « Aucune note pour l'instant » constate, et n'invite à
                      rien. Vu en ouvrant l'application avec une organisation
                      neuve : c'était l'un des deux seuls modules à ne pas dire
                      ce qu'il sert à faire, alors que tous les autres le
                      faisaient — Clients, Projets, Dépenses et Temps se
                      présentent en une phrase.
                    */}
                    Rien de noté pour l’instant.{' '}
                    {TEAM_ENABLED
                      ? 'Une note personnelle ne quitte pas ce compte ; une note d’équipe est visible de tous.'
                      : 'De quoi garder une idée, un numéro, un brouillon — tout ce qu’on écrirait sur un coin de table.'}
                  </EmptyState>
                )}
              </div>
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
            notes={notes}
            graphe={graphe}
            onSave={(patch) => updateNote(selected.id, patch)}
            onLier={(noteId) => {
              const autre = notes.find((n) => n.id === noteId);
              if (autre) updateNote(noteId, { body: lierMention(autre.body, selected.title) });
            }}
            onRenommer={(titre) => void renommer(selected.id, titre)}
            onTogglePin={() => togglePin(selected)}
            onRemove={() => removeNote(selected)}
            onOuvrir={(id) => setSelectedId(id)}
            /*
              CRÉER DEPUIS UN LIEN MORT.

              C'est le geste qui fait d'un lien non résolu une façon de
              travailler plutôt qu'une erreur : on cite ce qu'on n'a pas encore
              écrit, et on clique quand on est prêt à l'écrire. La note naît
              dans la MÊME portée que celle qui la cite — sinon une note
              d'équipe créerait un brouillon personnel que personne d'autre ne
              verrait, et le lien resterait mort pour tout le monde.
            */
            onCreer={(titre) => {
              const id = createNote(selected.scope);
              updateNote(id, { title: titre });
              setSelectedId(id);
            }}
          />
        ) : notes.length === 0 ? null : (
          <div className="flex items-center justify-center border border-border bg-surface font-mono text-xs uppercase tracking-widest text-text-muted">
            Sélectionnez une note
          </div>
        )}
      </div>
      </>
      )}
    </section>
  );
}

function NoteEditor({
  note,
  notes,
  graphe,
  onSave,
  onRenommer,
  onTogglePin,
  onRemove,
  onOuvrir,
  onCreer,
  onLier,
}: {
  note: Note;
  notes: Note[];
  graphe: Graphe;
  onSave: (patch: { title?: string; body?: string }) => void;
  /** Renommer passe par un chemin à part : il réécrit les liens qui pointent ici. */
  onRenommer: (titre: string) => void;
  onTogglePin: () => void;
  onRemove: () => void;
  onOuvrir: (id: string) => void;
  onCreer: (titre: string) => void;
  /** Transformer une mention en clair, dans une AUTRE note, en lien vers celle-ci. */
  onLier: (noteId: string) => void;
}) {
  const [title, setTitle] = useState(note.title);
  const [body, setBody] = useState(note.body);
  const [saved, setSaved] = useState(true);
  const [preview, setPreview] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  /*
    LA SAISIE D'UN LIEN, PENDANT LA FRAPPE.

    `saisie` vaut `null` la plupart du temps ; il ne porte quelque chose que
    lorsque le curseur est dans un `[[` pas encore refermé. La règle qui le
    décide vit dans `notesLiens.ts`, avec ses trois refus — voir
    `saisieEnCours`.
  */
  const [saisie, setSaisie] = useState<{ debut: number; requete: string } | null>(null);
  const [choix, setChoix] = useState(0);

  const proposees = useMemo(
    () => (saisie ? suggestions(saisie.requete, note, notes) : []),
    [saisie, note, notes],
  );

  /** Ce que le rendu markdown a besoin de savoir pour rendre un lien cliquable. */
  const branchement = useMemo(
    () => ({
      resoudre: (titre: string) => {
        const cible = resoudre({ ...note, body: `[[${titre}]]` }, notes, ordreDe(notes))[0];
        return cible?.cibleId ?? null;
      },
      ouvrir: onOuvrir,
      creer: onCreer,
    }),
    [note, notes, onOuvrir, onCreer],
  );

  const retro = useMemo(() => retroliens(graphe, note.id), [graphe, note.id]);
  const mentions = useMemo(() => mentionsNonLiees(note, notes, graphe), [note, notes, graphe]);

  /*
    Valider le titre : c'est le seul chemin qui touche au titre, parce que
    c'est le seul qui sait réécrire les liens.

    `titreRef` porte la dernière valeur tapée pour que le nettoyage de l'effet
    ci-dessous la voie : une fonction de nettoyage capture les valeurs du rendu
    où elle a été créée, donc lire `title` directement y donnerait le titre
    d'AVANT la frappe, et le renommage serait perdu.
  */
  const titreRef = useRef(title);
  titreRef.current = title;

  const validerTitre = useCallback(() => {
    const propose = titreRef.current.trim();
    if (propose === note.title || propose === '') return;
    onRenommer(propose);
  }, [note.title, onRenommer]);

  /*
    LE FILET : quitter la note sans quitter le champ.

    On tape un titre puis on clique une autre note dans la liste. Le champ perd
    le focus… mais React démonte souvent l'éditeur avant que `blur` ne parte, et
    le renommage serait simplement perdu. Le nettoyage rattrape ce cas.
  */
  useEffect(() => () => validerTitre(), [validerTitre]);

  const choisir = (titre: string) => {
    const el = bodyRef.current;
    if (!el || !saisie) return;
    const r = insererLien(body, saisie, titre, el.selectionStart);
    setBody(r.texte);
    scheduleSave(title, r.texte);
    setSaisie(null);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(r.curseur, r.curseur);
    });
  };

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

  const { TEAM_ENABLED } = useExclusive();
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
        {/*
          LE TITRE SE VALIDE QUAND ON QUITTE LE CHAMP, PAS À CHAQUE TOUCHE.

          Renommer ne change pas que cette note : ça réécrit les `[[liens]]`
          de toutes celles qui pointent ici. Le faire à chaque frappe
          réécrirait le carnet vingt fois pour un titre de vingt lettres — et
          chaque état intermédiaire produirait des liens vers des titres qui
          n'ont jamais existé (« R », « Ré », « Réu »…).

          Le corps, lui, continue de s'enregistrer au fil de la frappe : il ne
          concerne que cette note.
        */}
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => validerTitre()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              e.currentTarget.blur();
            }
          }}
          placeholder="Titre de la note"
          className="min-w-0 flex-1 bg-transparent text-lg font-semibold text-text-primary outline-none placeholder:text-text-muted"
        />
        <SaveIndicator saved={saved} />
        <button
          type="button"
          onClick={onTogglePin}
          aria-label={note.pinned ? 'Désépingler' : 'Épingler'}
          className={`flex h-9 w-9 items-center justify-center rounded ${note.pinned ? 'text-accent' : 'text-text-muted hover:text-text-primary'}`}
        >
          {note.pinned ? <PinOff size={15} strokeWidth={1.75} /> : <Pin size={15} strokeWidth={1.75} />}
        </button>
        <button
          type="button"
          onClick={onRemove}
          aria-label="Supprimer la note"
          className="flex h-9 w-9 items-center justify-center rounded text-text-muted hover:text-danger"
        >
          <Trash2 size={15} strokeWidth={1.75} />
        </button>
      </div>

      {/* Toolbar */}
      {/*
        `gap-2` : une barre d'outils serre ses boutons par habitude, mais 36 px
        à 4 px d'écart reste une rangée de petites icônes grises qui se
        ressemblent toutes — gras, italique, titre, lien, liste. Voir
        `docs/PRINCIPE-CONFORT.md` : sous 44 px, une cible a besoin d'un vrai
        dégagement.
      */}
      <div className="flex items-center gap-2 border-b border-border px-3 py-1.5">
        {tools.map((t) => (
          <button
            key={t.label}
            type="button"
            onClick={t.run}
            disabled={preview}
            aria-label={t.label}
            title={t.label}
            className="flex h-9 w-9 items-center justify-center rounded text-text-muted transition-colors hover:bg-surface-hover hover:text-text-primary disabled:opacity-30"
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
            <Markdown text={body} liens={branchement} />
          ) : (
            <p className="font-mono text-xs text-text-muted">Note vide.</p>
          )}
        </div>
      ) : (
        <div className="relative flex min-h-0 flex-1 flex-col">
          <textarea
            ref={bodyRef}
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
              scheduleSave(title, e.target.value);
              setSaisie(saisieEnCours(e.target.value, e.target.selectionStart));
              setChoix(0);
            }}
            /*
              Le curseur peut bouger sans que le texte change — flèches, clic,
              Origine/Fin. Sans ces deux écoutes, la liste resterait ouverte
              après être sorti du `[[` à la flèche droite, ou ne s'ouvrirait
              pas en revenant dedans au clic.
            */
            onKeyUp={(e) => setSaisie(saisieEnCours(body, e.currentTarget.selectionStart))}
            onClick={(e) => setSaisie(saisieEnCours(body, e.currentTarget.selectionStart))}
            onKeyDown={(e) => {
              if (proposees.length === 0) return;
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setChoix((c) => (c + 1) % proposees.length);
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setChoix((c) => (c - 1 + proposees.length) % proposees.length);
              } else if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                choisir(proposees[choix].title);
              } else if (e.key === 'Escape') {
                /*
                  Échap ferme la liste et RIEN D'AUTRE. Sans `stopPropagation`,
                  il remonterait jusqu'au calque parent, qui se fermerait — on
                  perdrait la note pour avoir voulu annuler une suggestion.
                */
                e.stopPropagation();
                setSaisie(null);
              }
            }}
            placeholder="Écrivez ici… **gras**, *italique*, # titre, - liste, [[lien vers une note]]"
            className="min-h-0 flex-1 resize-none bg-transparent p-4 font-mono text-sm leading-relaxed text-text-primary outline-none placeholder:text-text-muted"
          />

          {proposees.length > 0 && (
            <ul
              role="listbox"
              aria-label="Notes à lier"
              className="elev-2 absolute bottom-3 left-4 right-4 z-10 max-h-56 overflow-y-auto rounded-lg border border-border bg-surface py-1"
            >
              {proposees.map((n, i) => (
                <li key={n.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={i === choix}
                    onMouseEnter={() => setChoix(i)}
                    onClick={() => choisir(n.title)}
                    className={`flex min-h-11 w-full items-center gap-2.5 px-3 text-left text-sm transition-colors ${
                      i === choix ? 'bg-accent-muted text-text-primary' : 'text-text-secondary'
                    }`}
                  >
                    <LinkIcon size={13} strokeWidth={1.75} className="flex-shrink-0 text-text-muted" />
                    <span className="truncate">{n.title || 'Sans titre'}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/*
        QUI PARLE DE CETTE NOTE.

        C'est ce qu'aucune recherche ne donne : une recherche rend les notes qui
        CONTIENNENT un mot, celle-ci rend celles qui ont décidé de pointer ici.
        Le panneau ne s'affiche que s'il a quelque chose à dire — un cadre vide
        sous chaque note apprendrait surtout à ne plus regarder à cet endroit.
      */}
      {/*
        LES MENTIONS NON LIÉES. Des notes citent ce titre en clair sans pointer
        ici : c'est le geste d'Obsidian qui relie un carnet après coup. « Lier »
        réécrit la mention en [[lien]] dans l'autre note — un clic, pas une retape.
      */}
      {mentions.length > 0 && (
        <div className="flex-shrink-0 border-t border-border px-4 py-3">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-text-muted">
            {mentions.length === 1 ? 'Une note mentionne ce titre sans lien' : `${mentions.length} notes mentionnent ce titre sans lien`}
          </p>
          <ul className="flex flex-col gap-1.5">
            {mentions.map((n) => (
              <li key={n.id} className="flex items-center gap-1">
                <button type="button" onClick={() => onOuvrir(n.id)} className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-md px-2 text-left text-sm text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary md:min-h-8">
                  <span className="truncate">{n.title || 'Sans titre'}</span>
                </button>
                <button type="button" onClick={() => onLier(n.id)} className="min-h-11 flex-shrink-0 rounded-md border border-border px-2.5 text-xs text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary md:min-h-8">
                  Lier
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {retro.length > 0 && (
        <div className="flex-shrink-0 border-t border-border px-4 py-3">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-text-muted">
            {retro.length === 1 ? 'Une note pointe ici' : `${retro.length} notes pointent ici`}
          </p>
          <ul className="flex flex-col gap-1.5">
            {retro.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => onOuvrir(n.id)}
                  className="flex min-h-11 w-full items-center gap-2 rounded-md px-2 text-left text-sm text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
                >
                  <CornerUpLeft size={13} strokeWidth={1.75} className="flex-shrink-0 text-text-muted" />
                  <span className="truncate">{n.title || 'Sans titre'}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
