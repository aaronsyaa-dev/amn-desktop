import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Contact, FileText, Globe, MapPin, MessageSquare, Pencil, Plus, Send, Trash2, X } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useProfiles } from '../state/ProfilesContext';
import { useExclusive, useLinkedSites, useSitePanelLink } from '@edition/exclusive';
import { useSync, useCollection, uid, stripMeta } from '../state/SyncContext';
import { useUndo } from '../state/UndoContext';
import { UserAvatar } from '../components/UserAvatar';
import { SkeletonBoard } from '../components/Skeleton';
import { StaggerGroup, StaggerItem } from '../components/Stagger';
import { ScreenHeader } from '../components/ScreenHeader';
import { serieStock } from '../lib/serieVitale';
import { staggerContainer, staggerItem } from '../lib/transitions';
import { relativeTime } from '../lib/time';
import { oneOf } from '../lib/records';
import { useClients } from '../state/useClients';
import { useTags } from '../components/tags/TagProvider';
import type { TaskMarker } from '../lib/taskMarkers';
import type { ReportDraft } from '../state/useReports';
import type { Client, SharedTaskStatus } from '../shared/api';
import { useFermetureEchap } from '../lib/useFermetureEchap';
import { useLangue, t as tr } from '../i18n';

const COLUMNS: { status: SharedTaskStatus; label: string }[] = [
  { status: 'todo', label: tr('hist.tasks.aFaire') },
  { status: 'doing', label: 'En cours' },
  { status: 'done', label: 'Fait' },
];

export type TaskPriority = 'low' | 'normal' | 'high';

const PRIORITIES: { value: TaskPriority; label: string; dot: string; text: string }[] = [
  { value: 'low', label: 'Basse', dot: 'bg-text-muted', text: 'text-text-muted' },
  { value: 'normal', label: 'Normale', dot: 'bg-accent', text: 'text-text-secondary' },
  // Une priorité haute n'est pas un incident : le point porte le rouge,
  // le mot reste de l'encre (docs/ROUGE.md, F3).
  { value: 'high', label: 'Haute', dot: 'bg-danger', text: 'text-text-secondary' },
];

function priorityMeta(p: TaskPriority | undefined) {
  return PRIORITIES.find((x) => x.value === (p ?? 'normal')) ?? PRIORITIES[1];
}

/** Pre-fills a report draft from a finished task's context (B1). */
function taskReportDraft(
  task: SyncTask,
  nameOf: (email: string) => string,
  teamEnabled: boolean,
): ReportDraft {
  const date = task.createdAt
    ? new Date(task.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    : '';
  const lines: string[] = teamEnabled ? [`**Assigné à :** ${nameOf(task.assigneeEmail)}`] : [];
  if (date) lines.push(`**Créée le :** ${date}`);
  lines.push('', task.detail || '_Pas de description._');
  const comments = task.comments ?? [];
  if (comments.length > 0) {
    lines.push('', '## Échanges');
    for (const c of comments) lines.push(`- **${nameOf(c.authorEmail)}** — ${c.body}`);
  }
  return {
    type: 'task',
    title: task.title ? `Rapport — ${task.title}` : 'Rapport de tâche',
    body: lines.join('\n'),
    links: [{ kind: 'task', id: task.id, label: task.title || 'Tâche' }],
  };
}

export interface TaskComment {
  id: string;
  authorEmail: string;
  body: string;
  createdAt: string;
}

interface TaskData {
  title: string;
  detail: string;
  assigneeEmail: string;
  status: SharedTaskStatus;
  siteId: string | null;
  clientId: number | null;
  createdAt: string;
  priority?: TaskPriority;
  /** Contextual "repères" pinning spots in the app to this task (A4). */
  markers?: TaskMarker[];
  /** Discussion thread scoped to this task (A5.1). */
  comments?: TaskComment[];
  /** Posée par la Garde (Bloc 6) : qui, pourquoi, avec quelle preuve, quelle action. Absente sur une tâche humaine. */
  garde?: TacheDeLaGarde;
  /**
   * CE QUE CETTE TÂCHE ATTEND — l'identifiant d'une autre tâche, ou absent.
   *
   * ARBITRAGE ENTRE LE PAQUET DE DESIGN ET LE MODÈLE DE DONNÉES, ET POURQUOI
   * C'EST LE MODÈLE QUI A EU TORT.
   *
   * Le système de design donne à ce module un arbre des blocages pour objet
   * dominant : « une liste à cases dit "5 bloquées" ; l'arbre dit PAR QUOI, et
   * montre qu'une seule réponse en libère quatre ». Or la tâche n'avait aucun
   * champ pour dire ce qu'elle attend : l'instrument décrivait quelque chose
   * que le produit ne savait pas représenter.
   *
   * Deux issues possibles. Composer autre chose, et le module reste une liste
   * à trois colonnes — ce qu'il est déjà, et ce que le paquet reproche
   * explicitement. Ou ajouter le champ, et l'instrument devient vrai. C'est
   * le second : la dépendance entre tâches n'est pas une facilité de dessin,
   * c'est la seule information qui transforme « cinq choses en retard » en
   * « une réponse à aller chercher ». Le paquet a raison, le modèle rattrape.
   *
   * Un simple identifiant, comme `projectId` juste au-dessus : la tâche
   * bloquante ne tient aucune liste de ce qu'elle bloque, et l'arbre se
   * reconstruit en lisant la collection. Un seul endroit où la relation vit,
   * donc aucune liste à tenir à jour de l'autre côté.
   */
  blockedBy?: string;
}
export interface TacheDeLaGarde {
  agent: string;
  equipe: string;
  dossier?: string;
  famille?: string;
  orgId?: string | null;
  orgNom?: string | null;
  gravite: 'critique' | 'haute' | 'normale';
  n?: number;
  vues?: number;
  pourquoi: string;
  preuve: string;
  action: string;
  reste?: boolean;
}
/** Le nom de chaque équipe de la Garde, au génitif — « par la Garde des Sites ». */
const GARDE_EQUIPE: Record<string, string> = { sites: 'des Sites', securite: 'de la Sécurité', comptes: 'des Comptes', registre: 'du Registre', clientes: 'des Clientes', produit: 'du Produit', taches: 'des Tâches', memoire: 'de la Mémoire' };
export type SyncTask = TaskData & { id: string; updatedAt: string };

/** Le domaine des statuts, à l'exécution (voir src/lib/records.ts). */
const TASK_STATUSES: SharedTaskStatus[] = ['todo', 'doing', 'done'];
/** Cartes posées par colonne avant le bouton « en afficher davantage ». */
const LOT_CARTES = 100;

export function TasksScreen() {
  const { TEAM_ENABLED } = useExclusive();
  const { user } = useAuth();
  /* Le nom d'une personne, pour la barre de charge : `profileFor` est la
     source unique, ici comme dans le panneau de tâche. */
  const { profileFor } = useProfiles();
  const { sites } = useLinkedSites();
  const { upsert, remove, ready } = useSync();
  const { isPending, scheduleDelete } = useUndo();
  const tasksRaw = useCollection<TaskData>('tasks');
  /*
    Le statut est ramené dans son domaine AVANT tout affichage.

    Le tableau est fait de trois colonnes filtrées par `status`, et le compteur
    de chaque colonne est un `map[t.status] += 1`. Une tâche portant un statut
    inconnu — une valeur d'une version antérieure, une écriture interrompue —
    n'appartenait donc à AUCUNE colonne : elle existait, comptait `NaN`, et
    n'apparaissait nulle part. Invisible, elle était par construction
    impossible à rouvrir comme à supprimer. C'est exactement la forme du bug
    « Elie Sy », sur un autre écran.
  */
  const tasks = useMemo(
    () =>
      tasksRaw
        .map((t) => ({ ...t, status: oneOf(t.status, TASK_STATUSES, 'todo') }))
        .filter((t) => !isPending(`tasks:${t.id}`))
        .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')),
    [tasksRaw, isPending],
  );
  const [creating, setCreating] = useState(false);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const openTask = useMemo(() => tasks.find((t) => t.id === openTaskId) ?? null, [tasks, openTaskId]);

  // Open a task directly when arriving from a #task mention in chat (A5.3).
  const location = useLocation();
  useEffect(() => {
    const wanted = (location.state as { openTaskId?: string } | null)?.openTaskId;
    if (wanted) setOpenTaskId(wanted);
  }, [location.state]);

  // Synced collection, so the client list is the same on every platform.
  const { clients } = useClients();

  const moveTask = (task: SyncTask, status: SharedTaskStatus) =>
    upsert('tasks', task.id, { ...stripMeta(task), status });

  const addMarker = (task: SyncTask, marker: TaskMarker) =>
    upsert('tasks', task.id, { ...stripMeta(task), markers: [...(task.markers ?? []), marker] });

  const removeMarker = (task: SyncTask, markerId: string) =>
    upsert('tasks', task.id, {
      ...stripMeta(task),
      markers: (task.markers ?? []).filter((m) => m.id !== markerId),
    });

  const patchTask = (task: SyncTask, patch: Partial<TaskData>) =>
    upsert('tasks', task.id, { ...stripMeta(task), ...patch });

  const addComment = (task: SyncTask, body: string) => {
    if (!user) return;
    const comment: TaskComment = {
      id: uid('cmt'),
      authorEmail: user.email,
      body,
      createdAt: new Date().toISOString(),
    };
    upsert('tasks', task.id, { ...stripMeta(task), comments: [...(task.comments ?? []), comment] });
  };

  const removeTask = (id: string) => {
    const task = tasks.find((t) => t.id === id);
    scheduleDelete({
      key: `tasks:${id}`,
      label: task?.title ? `Tâche « ${task.title} »` : 'Tâche',
      commit: () => remove('tasks', id),
    });
  };

  const createTask = (input: Omit<TaskData, 'createdAt' | 'status'>) => {
    upsert('tasks', uid('task'), { ...input, status: 'todo', createdAt: new Date().toISOString() });
    setCreating(false);
  };

  const counts = useMemo(() => {
    const map: Record<SharedTaskStatus, number> = { todo: 0, doing: 0, done: 0 };
    for (const t of tasks) map[t.status] += 1;
    return map;
  }, [tasks]);

  /*
    LA CHARGE — l'objet dominant, et la seule chose que cet écran sait et que
    les autres ignorent.

    Le tableau à trois colonnes range par STATUT, ce qui est juste : le statut
    est le flux de travail d'une tâche, et c'est le seul écran de
    l'application où une colonne par état a un sens. Mais il ne répond pas à la
    question qu'on pose devant une liste d'équipe — QUI PORTE QUOI, et qu'est-ce
    qui n'est porté par personne.

    Les terminées sont exclues : une tâche faite ne pèse sur personne.
  */
  const ouvertes = useMemo(() => tasks.filter((t) => t.status !== 'done'), [tasks]);
  const sansPersonne = useMemo(() => ouvertes.filter((t) => !t.assigneeEmail?.trim()), [ouvertes]);
  const charge = useMemo(() => {
    const par = new Map<string, SyncTask[]>();
    for (const t of ouvertes) {
      const qui = t.assigneeEmail?.trim();
      if (!qui) continue;
      par.set(qui, [...(par.get(qui) ?? []), t]);
    }
    return [...par.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [ouvertes]);
  /* La plus lourde donne l'échelle des barres : comparer des charges entre
     elles, pas à un total qui ne veut rien dire. */
  const plusLourde = Math.max(1, ...charge.map(([, l]) => l.length));
  /* En solo, « qui porte quoi » n'a pas de sens : il n'y a qu'une personne.
     L'écran range alors par PRIORITÉ, qui est l'autre axe du modèle. */
  /*
    L'ARBRE DES BLOCAGES — calculé ici, dessiné plus bas.

    Il ne remplace pas le tableau à colonnes : il se pose AU-DESSUS quand il y
    a quelque chose à débloquer, et disparaît quand il n'y a rien. C'est la
    règle du paquet : « si aucune tâche n'est bloquée, l'écran bascule sur la
    liste simple et n'a pas d'objet dominant ambre ».
  */
  const arbre = useMemo(() => calculerArbre(ouvertes, Date.now()), [ouvertes]);

  /* Les tâches libres de tout blocage — ni bloquées, ni bloquantes. Ce sont
     les seules sur lesquelles on peut avancer tout de suite. */
  const libres = useMemo(() => {
    const bloquantes = new Set(ouvertes.map((t) => t.blockedBy).filter(Boolean) as string[]);
    return ouvertes.filter((t) => !t.blockedBy && !bloquantes.has(t.id));
  }, [ouvertes]);

  /*
    LA DURÉE DES BLOCAGES — mesurée, pas estimée.

    Une attente se compte depuis la création de la tâche bloquante : c'est le
    jour où quelqu'un a écrit « il faut ça d'abord ». On ne garde pas
    d'historique des blocages résolus, donc la moyenne porte sur ceux qui
    durent encore — et la phrase le dit, plutôt que de laisser croire à une
    moyenne du trimestre qu'on n'a pas.
  */
  const attentes = useMemo(() => {
    const bloquantes = new Set(ouvertes.map((t) => t.blockedBy).filter(Boolean) as string[]);
    const jours = ouvertes
      .filter((t) => bloquantes.has(t.id) && t.createdAt)
      .map((t) => Math.floor((Date.now() - new Date(t.createdAt).getTime()) / 86_400_000));
    if (jours.length === 0) return null;
    return {
      nombre: jours.length,
      moyenne: Math.round(jours.reduce((a, b) => a + b, 0) / jours.length),
      pire: Math.max(...jours),
    };
  }, [ouvertes]);

  const parPriorite = useMemo(() => {
    const ordre: TaskPriority[] = ['high', 'normal', 'low'];
    return ordre.map((p) => ({ p, liste: ouvertes.filter((t) => (t.priority ?? 'normal') === p) }));
  }, [ouvertes]);

  return (
    <StaggerGroup className="flex flex-col gap-4 md:h-[calc(100dvh-8rem)]">
      <StaggerItem>
        {/*
          « Qui fait quoi · partagé en équipe » décrivait AMN DevSec, pas une
          cliente qui travaille seule : il n'y a personne d'autre à qui la
          liste serait partagée. La description suit donc l'édition, comme tout
          le reste de cet écran (`TEAM_ENABLED`).
        */}
        <ScreenHeader
          eyebrow={tr('hist.surtitre', { module: tr('hist.tasks.titre') })}
          title={tr('hist.tasks.titre')}
          description={
            TEAM_ENABLED
              ? 'Qui fait quoi, partagé en équipe.'
              : 'Ce qu’il reste à faire, du premier jet au terminé.'
          }
          stats={[
            {
              label: tr('hist.tasks.aFaire'),
              value: counts.todo,
              emphasis: counts.todo > 0,
              serie: serieStock(
                tasks.filter((t) => t.status === 'todo').map((t) => t.createdAt),
                7,
                new Date(),
              ),
              brut: counts.todo,
            },
            { label: 'En cours', value: counts.doing },
            { label: tr('hist.tasks.terminees'), value: counts.done },
          ]}
          actions={
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover"
            >
              <Plus size={16} strokeWidth={2.25} />{tr('hist.tasks.nouvelleTache')}</button>
          }
        />
      </StaggerItem>

      {/* ── L'OBJET DOMINANT : l'arbre des blocages ─────────────────────── */}
      {ready && arbre && (
        <StaggerItem>
          <div className="flex flex-col gap-[18px]">
            <ArbreDesBlocages arbre={arbre} onOuvrir={setOpenTaskId} />
            <div className="grid grid-cols-1 items-stretch gap-[18px] lg:grid-cols-[1fr_340px]">
              {/* Les tâches libres, en deux colonnes de cases. Les deux
                  premières en encre claire : ce sont celles sur lesquelles on
                  peut avancer aujourd'hui sans attendre personne. */}
              <section className="panel min-w-0 px-[22px] pb-[18px] pt-5">
                <div className="mb-[18px] flex items-baseline justify-between">
                  <span className="eyebrow text-text-secondary">Libres de tout blocage</span>
                  <span className="font-mono text-[10px] tracking-[0.1em] text-text-muted">
                    {libres.length > 0 ? `${libres.length} SANS ATTENTE` : 'AUCUNE'}
                  </span>
                </div>
                {libres.length > 0 ? (
                  <ul className="grid grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2">
                    {libres.slice(0, 8).map((t, i) => (
                      <li key={t.id}>
                        <button
                          type="button"
                          onClick={() => setOpenTaskId(t.id)}
                          className="flex w-full items-center gap-2.5 text-left"
                        >
                          <span
                            className={`h-3 w-3 flex-none border ${i < 2 ? 'border-text-primary' : 'border-border-strong'}`}
                            aria-hidden
                          />
                          <span
                            className={`min-w-0 truncate text-[13.5px] ${i < 2 ? 'text-text-primary' : 'text-text-muted'}`}
                          >
                            {t.title}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="py-3 text-[13.5px] leading-[1.7] text-text-secondary">
                    Tout ce qui reste attend quelque chose : l’arbre au-dessus dit quoi.
                  </p>
                )}
              </section>

              <section className="panel flex flex-col px-5 pb-[18px] pt-5">
                <span className="eyebrow mb-5 text-text-secondary">Ce que ça coûte</span>
                {attentes ? (
                  <>
                    <span className="tnum block font-mono text-[40px] font-bold leading-[.95] tracking-[-0.04em] text-text-primary">
                      {attentes.moyenne}
                      <span className="ml-1 align-baseline text-[21px] font-semibold text-text-secondary">j</span>
                    </span>
                    <span className="mt-2.5 block text-[13.5px] leading-[1.55] text-text-secondary">
                      d’attente en moyenne sur les {attentes.nombre} blocage
                      {attentes.nombre > 1 ? 's' : ''} en cours.
                    </span>
                    <span className="mt-4 block border-t border-border pt-4 font-mono text-[10px] tracking-[0.1em] text-text-muted">
                      LE PLUS LONG · {attentes.pire} J
                    </span>
                  </>
                ) : (
                  <p className="text-[13.5px] leading-[1.7] text-text-secondary">
                    Rien n’attend encore assez longtemps pour se mesurer.
                  </p>
                )}
              </section>
            </div>
          </div>
        </StaggerItem>
      )}

      {/*
        LA CHARGE — l'objet dominant TANT QU'IL N'Y A PAS DE BLOCAGE. Voir le calcul plus haut pour le pourquoi,
        et pourquoi le tableau à colonnes SURVIT ici alors qu'il a été retiré du
        SAV, du Tableau des projets et des Prospects : sur ces trois écrans les
        colonnes rangeaient par un état qui n'était pas le sujet. Ici le statut
        EST le flux de travail d'une tâche. Ce qui manquait n'était pas le
        tableau, c'était ce qu'il ne dit pas — qui porte quoi.
      */}
      {ready && ouvertes.length > 0 && !arbre && (
        <StaggerItem>
          <section className="panel-raised p-5 sm:p-6" data-signal-groupe="sans-personne">
            {sansPersonne.length > 0 ? (
              <>
                <p className="signal-plate mb-3 inline-flex px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider">{tr('hist.tasks.sansPersonne')}</p>
                <p className="text-[21px] font-semibold leading-tight text-text-primary sm:text-[27px]">
                  {sansPersonne.length === 1
                    ? tr('hist.tasks.personneNePorte')
                    : tr('hist.tasks.personneNePorteN', { n: sansPersonne.length })}
                </p>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-text-secondary">{tr('hist.tasks.personneNePorteAide')}</p>
                <ul className="mt-4 flex flex-wrap gap-2">
                  {sansPersonne.slice(0, 6).map((t) => (
                    <li key={t.id}>
                      <button type="button" onClick={() => setOpenTaskId(t.id)} className="input-focus flex min-h-11 items-center gap-2 border border-border-strong px-3 text-sm text-text-primary hover:bg-surface-hover md:min-h-0 md:py-2">
                        <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${priorityMeta(t.priority).dot}`} aria-hidden />
                        {t.title}
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <>
                <p className="eyebrow mb-3">{TEAM_ENABLED ? tr('hist.tasks.laCharge') : tr('hist.tasks.parPriorite')}</p>
                <p className="text-[21px] font-semibold leading-tight text-text-primary sm:text-[27px]">{tr('hist.tasks.toutEstPorte')}</p>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-text-secondary">{tr('hist.tasks.toutEstPorteAide')}</p>
              </>
            )}

            {/* La répartition elle-même : des barres par personne en équipe,
                par priorité quand on travaille seul. */}
            <div className="mt-6">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="eyebrow">{TEAM_ENABLED ? tr('hist.tasks.laCharge') : tr('hist.tasks.parPriorite')}</p>
                <p className="text-[11px] text-text-muted">{TEAM_ENABLED ? tr('hist.tasks.laChargeAide') : tr('hist.tasks.parPrioriteAide')}</p>
              </div>
              <ul className="mt-3 flex flex-col gap-2">
                {TEAM_ENABLED
                  ? charge.map(([email, liste]) => (
                      <li key={email} className="flex items-center gap-3">
                        <span className="flex w-36 flex-shrink-0 items-center gap-2">
                          <UserAvatar email={email} size={22} />
                          <span className="min-w-0 truncate text-sm text-text-primary">{profileFor(email).name}</span>
                        </span>
                        <span className="relative flex h-7 min-w-0 flex-1 items-center border border-border">
                          <span className="absolute inset-y-0 left-0 bg-border-strong" style={{ width: `${(liste.length / plusLourde) * 100}%` }} aria-hidden />
                          <span className="relative px-2.5 text-sm tabular-nums text-text-primary">{liste.length}</span>
                        </span>
                      </li>
                    ))
                  : parPriorite
                      .filter((x) => x.liste.length > 0)
                      .map(({ p, liste }) => (
                        <li key={p} className="flex items-center gap-3">
                          <span className="flex w-36 flex-shrink-0 items-center gap-2">
                            <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${priorityMeta(p).dot}`} aria-hidden />
                            <span className="min-w-0 truncate text-sm text-text-primary">{priorityMeta(p).label}</span>
                          </span>
                          <span className="relative flex h-7 min-w-0 flex-1 items-center border border-border">
                            <span className="absolute inset-y-0 left-0 bg-border-strong" style={{ width: `${(liste.length / Math.max(1, ...parPriorite.map((x) => x.liste.length))) * 100}%` }} aria-hidden />
                            <span className="relative px-2.5 text-sm tabular-nums text-text-primary">{liste.length}</span>
                          </span>
                        </li>
                      ))}
              </ul>
            </div>
          </section>
        </StaggerItem>
      )}

      <StaggerItem className="min-h-0 md:flex-1">
        {!ready ? (
          <SkeletonBoard />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:h-full md:grid-cols-3">
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
                onAddMarker={addMarker}
                onRemoveMarker={removeMarker}
                onOpen={setOpenTaskId}
                tableauVide={tasks.length === 0}
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

      <AnimatePresence>
        {openTask && (
          <TaskDetailModal
            task={openTask}
            sites={sites}
            clients={clients}
            candidats={ouvertes}
            onClose={() => setOpenTaskId(null)}
            onPatch={patchTask}
            onAddComment={addComment}
            onRemove={(id) => {
              setOpenTaskId(null);
              removeTask(id);
            }}
            onAddMarker={addMarker}
            onRemoveMarker={removeMarker}
          />
        )}
      </AnimatePresence>
    </StaggerGroup>
  );
}

/**
 * L'ARBRE DES BLOCAGES — l'objet dominant de Tâches (système de design, `16a`)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Trois colonnes lues de gauche à droite : la RACINE du blocage, CE QU'ELLE
 * BLOQUE, et CE QUI SUIT derrière. L'écran ne dit pas « 5 tâches bloquées » —
 * il montre qu'une seule réponse en libère quatre, et deux de plus derrière.
 *
 * LA GÉOMÉTRIE, et pourquoi elle est calculée et non posée.
 *
 * Les plaques sont en POURCENTAGES du conteneur (25,5 % / 28 % / 30 %, aux
 * abscisses 0 / 35 / 70 %), et les connecteurs sont un `<svg viewBox>` en
 * `width:100%` avec `vector-effect="non-scaling-stroke"`. Si les plaques
 * étaient en pixels, la troisième colonne sortirait de la carte dès qu'on
 * réduit la fenêtre ; si le trait n'avait pas `non-scaling-stroke`, le
 * `preserveAspectRatio="none"` l'étirerait horizontalement et les traits
 * verticaux seraient plus fins que les horizontaux.
 *
 * Le `viewBox` fait 1000 unités de large : une abscisse en unités de vue est
 * donc dix fois le pourcentage, ce qui rend les deux systèmes de coordonnées
 * vérifiables l'un contre l'autre (255 ↔ 25,5 %). Les ordonnées, elles, sont
 * en pixels réels : la hauteur du `viewBox` vaut exactement la hauteur du
 * conteneur, donc une unité de vue verticale EST un pixel.
 */

/** La hauteur d'une plaque : deux lignes et leur rembourrage. Constante, donc le centre aussi. */
const ARBRE_H_NOEUD = 52;
/** L'écart vertical d'une plaque à la suivante dans la colonne du milieu. */
const ARBRE_PAS = 64;
/** La marge haute et basse — la bande des légendes de colonne vit dans la basse. */
const ARBRE_MARGE = 22;
const ARBRE_BAS = 30;

interface NoeudArbre {
  id: string;
  titre: string;
  mention: string;
  /** Le haut de la plaque, en pixels depuis le haut du conteneur. */
  haut: number;
}

/**
 * Le calcul de l'arbre : qui bloque quoi, et où chaque plaque se pose.
 *
 * Il n'y a qu'une racine montrée — celle qui bloque le plus de monde. En
 * montrer plusieurs referait la liste que l'instrument remplace : l'écran
 * répond à « qu'est-ce que je débloque en premier », pas à « qu'est-ce qui
 * est bloqué ».
 */
function calculerArbre(
  ouvertes: { id: string; title: string; createdAt: string; blockedBy?: string }[],
  maintenant: number,
): {
  racine: NoeudArbre & { jours: number | null };
  bloquees: NoeudArbre[];
  suivantes: (NoeudArbre & { parent: string; rang: number })[];
  hauteur: number;
  total: number;
} | null {
  const parId = new Map(ouvertes.map((t) => [t.id, t]));
  /* Qui bloque qui — lu dans la collection, jamais tenu à deux endroits. */
  const bloqueesPar = new Map<string, typeof ouvertes>();
  for (const t of ouvertes) {
    const cle = t.blockedBy;
    if (!cle || !parId.has(cle) || cle === t.id) continue;
    const liste = bloqueesPar.get(cle) ?? [];
    liste.push(t);
    bloqueesPar.set(cle, liste);
  }
  if (bloqueesPar.size === 0) return null;

  /* La racine : celle qui libère le plus de monde. À égalité, la plus ancienne. */
  const racineId = [...bloqueesPar.entries()].sort((a, b) => {
    if (b[1].length !== a[1].length) return b[1].length - a[1].length;
    return (parId.get(a[0])?.createdAt ?? '').localeCompare(parId.get(b[0])?.createdAt ?? '');
  })[0][0];
  const racineTache = parId.get(racineId);
  if (!racineTache) return null;

  const directes = (bloqueesPar.get(racineId) ?? []).slice(0, 6);
  const hauteur = Math.max(
    286,
    ARBRE_MARGE + directes.length * ARBRE_PAS - (ARBRE_PAS - ARBRE_H_NOEUD) + ARBRE_BAS,
  );

  const bloquees: NoeudArbre[] = directes.map((t, i) => ({
    id: t.id,
    titre: t.title,
    mention: 'BLOQUÉE',
    haut: ARBRE_MARGE + i * ARBRE_PAS,
  }));

  /* La racine se pose au centre vertical de ce qu'elle bloque : le trait part
     d'elle vers le haut ET vers le bas, ce qui se lit comme une distribution
     et non comme une file. */
  const centreBloquees =
    bloquees.length > 0
      ? (bloquees[0].haut + bloquees[bloquees.length - 1].haut) / 2 + ARBRE_H_NOEUD / 2
      : hauteur / 2;

  /* Ce qui suit : les tâches bloquées par une tâche déjà bloquée. Décalées de
     30 px sous leur parent, comme dans la maquette — le décalage dit que le
     nœud descend d'un cran, pas qu'il vit sur sa propre rangée. */
  const suivantes: (NoeudArbre & { parent: string; rang: number })[] = [];
  for (const b of bloquees) {
    for (const t of (bloqueesPar.get(b.id) ?? []).slice(0, 2)) {
      /* « EN ATTENTE DE LA 2ᵉ » et non le titre recopié : la colonne fait
         30 % de la carte, et un titre y arrive tronqué au milieu d'un mot.
         Le rang renvoie à la plaque juste à gauche, que l'œil suit déjà par
         le trait — l'ordinal suffit à la nommer. */
      const rang = bloquees.indexOf(b);
      suivantes.push({
        id: t.id,
        titre: t.title,
        mention: `EN ATTENTE DE LA ${rang === 0 ? '1ʳᵉ' : `${rang + 1}ᵉ`}`,
        haut: b.haut + 30,
        parent: b.id,
        rang,
      });
    }
  }

  const jours = racineTache.createdAt
    ? Math.floor((maintenant - new Date(racineTache.createdAt).getTime()) / 86_400_000)
    : null;

  return {
    racine: {
      id: racineId,
      titre: racineTache.title,
      mention: jours !== null ? `RACINE · ATTENDUE DEPUIS ${jours} J` : 'RACINE',
      haut: centreBloquees - ARBRE_H_NOEUD / 2,
      jours,
    },
    bloquees,
    suivantes,
    hauteur,
    total: bloquees.length + suivantes.length,
  };
}

function ArbreDesBlocages({
  arbre,
  onOuvrir,
}: {
  arbre: NonNullable<ReturnType<typeof calculerArbre>>;
  onOuvrir: (id: string) => void;
}) {
  const { racine, bloquees, suivantes, hauteur } = arbre;
  const centre = (haut: number) => haut + ARBRE_H_NOEUD / 2;
  return (
    <section className="panel-raised panel-raised-wide px-[30px] pb-[26px] pt-[30px]">
      <div className="mb-[22px] flex items-baseline justify-between">
        <span className="eyebrow text-text-secondary">Ce qui attend quoi</span>
        <span className="font-mono text-[10px] tracking-[0.1em] text-text-muted">
          {arbre.total} TÂCHE{arbre.total > 1 ? 'S' : ''} BLOQUÉE{arbre.total > 1 ? 'S' : ''} · 1 RACINE
        </span>
      </div>

      <div className="relative" style={{ height: `${hauteur}px` }}>
        {/* Les connecteurs. Un seul svg pour tout l'arbre : des traits posés
            en bordures CSS ne sauraient pas faire un coude. */}
        <svg
          viewBox={`0 0 1000 ${hauteur}`}
          preserveAspectRatio="none"
          className="absolute left-0 top-0 w-full"
          style={{ height: `${hauteur}px` }}
          fill="none"
          stroke="#4a4a48"
          strokeWidth={1.5}
          aria-hidden
        >
          {bloquees.map((b) => (
            <path
              key={`c-${b.id}`}
              d={`M255 ${centre(racine.haut)} H302 V${centre(b.haut)} H350`}
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {suivantes.map((s) => {
            const parent = bloquees.find((b) => b.id === s.parent);
            if (!parent) return null;
            return (
              <path
                key={`c2-${s.id}`}
                d={`M630 ${centre(parent.haut)} H665 V${centre(s.haut)} H700`}
                stroke="#2e2e2e"
                vectorEffect="non-scaling-stroke"
              />
            );
          })}
        </svg>

        {/* LA RACINE — le seul point de l'arbre sur lequel on peut agir, donc
            le seul en ambre. Tous les autres ne font qu'attendre. */}
        <button
          type="button"
          onClick={() => onOuvrir(racine.id)}
          data-signal-groupe="racine-blocage"
          className="absolute box-border border border-signal bg-signal px-[11px] py-[9px] text-left shadow-[0_0_30px_-6px_var(--color-signal-glow)]"
          style={{ left: '0%', top: `${racine.haut}px`, width: '25.5%' }}
        >
          <span className="block truncate text-[12.5px] font-semibold text-signal-ink">{racine.titre}</span>
          <span className="mt-1 block font-mono text-[9.5px] tracking-[0.1em] text-[#3a2a0e]">
            {racine.mention}
          </span>
        </button>

        {bloquees.map((b) => (
          <button
            key={b.id}
            type="button"
            onClick={() => onOuvrir(b.id)}
            className="absolute box-border border border-[#2b2b2b] bg-[#171717] px-[11px] py-[9px] text-left transition-colors hover:border-border-strong"
            style={{ left: '35%', top: `${b.haut}px`, width: '28%' }}
          >
            <span className="block truncate text-[12.5px] font-semibold text-text-primary">{b.titre}</span>
            <span className="mt-1 block font-mono text-[9.5px] tracking-[0.1em] text-text-muted">{b.mention}</span>
          </button>
        ))}

        {suivantes.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onOuvrir(s.id)}
            className="absolute box-border border border-[#2b2b2b] bg-[#171717] px-[11px] py-[9px] text-left transition-colors hover:border-border-strong"
            style={{ left: '70%', top: `${s.haut}px`, width: '30%' }}
          >
            <span className="block truncate text-[12.5px] font-semibold text-text-primary">{s.titre}</span>
            <span className="mt-1 block truncate font-mono text-[9.5px] tracking-[0.1em] text-text-muted">
              {s.mention}
            </span>
          </button>
        ))}

        <span className="absolute bottom-2 left-0 font-mono text-[9.5px] tracking-[0.1em] text-text-muted">
          LA RACINE
        </span>
        <span className="absolute bottom-2 font-mono text-[9.5px] tracking-[0.1em] text-text-muted" style={{ left: '35%' }}>
          CE QU’ELLE BLOQUE
        </span>
        {suivantes.length > 0 && (
          <span className="absolute bottom-2 font-mono text-[9.5px] tracking-[0.1em] text-text-muted" style={{ left: '70%' }}>
            CE QUI SUIT
          </span>
        )}
      </div>
    </section>
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
  onAddMarker,
  onRemoveMarker,
  onOpen,
  tableauVide,
}: {
  label: string;
  status: SharedTaskStatus;
  count: number;
  tasks: SyncTask[];
  sites: ReturnType<typeof useLinkedSites>['sites'];
  clients: Client[];
  onMove: (task: SyncTask, status: SharedTaskStatus) => void;
  onRemove: (id: string) => void;
  onAddMarker: (task: SyncTask, marker: TaskMarker) => void;
  onRemoveMarker: (task: SyncTask, markerId: string) => void;
  onOpen: (id: string) => void;
  /** Vrai quand AUCUNE des trois colonnes n'a de tâche — le premier jour. */
  tableauVide: boolean;
}) {
  /*
    LA COLONNE NE DESSINE PAS TROIS MILLE CARTES.

    Chaque carte pèse une trentaine de nœuds ; un téléphone qui en reçoit
    trois mille d'un coup passe plus d'une seconde à les poser avant de
    répondre au premier geste (mesuré, suite « casser »). On en pose cent,
    puis cent de plus à la demande — la liste reste complète, et le compteur
    de la colonne dit le vrai total dès le premier rendu.
  */
  const [visibles, setVisibles] = useState(LOT_CARTES);
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
          /*
            TROIS FOIS « RIEN ICI » N'EST PAS UN ÉTAT VIDE, C'EST UN ÉCHO.

            Vu en ouvrant l'application avec une organisation neuve : les trois
            colonnes répétaient la même phrase, et le premier module de la
            navigation ne disait rien de ce qu'il sert à faire — au moment
            précis où quelqu'un décide si l'outil lui parle.

            Le tableau vide parle donc UNE FOIS, dans la colonne où l'on
            commence. Les deux autres se taisent : une colonne « Fait » qui
            annonce son vide avant qu'on ait rien fait est du bruit, et le
            composant `EmptyState` porte déjà cette règle — un état vide muet
            pour les zones secondaires d'un écran déjà vide ailleurs.
          */
          tableauVide && status !== 'todo' ? (
            <p className="px-1 py-4 font-mono text-xs text-text-muted/50">—</p>
          ) : tableauVide ? (
            <div className="px-1 py-4">
              <p className="text-[13px] leading-relaxed text-text-secondary">{tr('hist.tasks.uneTacheCEst')}</p>
              <p className="mt-2 text-[13px] leading-relaxed text-text-muted">{tr('hist.tasks.commencezParLaPlus')}</p>
            </div>
          ) : (
            <p className="px-1 py-4 font-mono text-xs text-text-muted">{tr('hist.tasks.rienIci')}</p>
          )
        ) : (
          <>
            {tasks.slice(0, visibles).map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                status={status}
                sites={sites}
                clients={clients}
                onMove={onMove}
                onRemove={onRemove}
                onAddMarker={onAddMarker}
                onRemoveMarker={onRemoveMarker}
                onOpen={onOpen}
              />
            ))}
            {tasks.length > visibles && (
              <button
                type="button"
                onClick={() => setVisibles((v) => v + LOT_CARTES)}
                className="mt-1 min-h-11 w-full border border-dashed border-border px-3 py-2 font-mono text-[11px] uppercase tracking-wider text-text-secondary hover:bg-surface-hover hover:text-text-primary"
              >
                {tr('hist.tasks.afficherLaSuite').replace('{n}', String(Math.min(LOT_CARTES, tasks.length - visibles)))}
              </button>
            )}
          </>
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
  onAddMarker,
  onRemoveMarker,
  onOpen,
}: {
  task: SyncTask;
  status: SharedTaskStatus;
  sites: ReturnType<typeof useLinkedSites>['sites'];
  clients: Client[];
  onMove: (task: SyncTask, status: SharedTaskStatus) => void;
  onRemove: (id: string) => void;
  onAddMarker: (task: SyncTask, marker: TaskMarker) => void;
  onRemoveMarker: (task: SyncTask, markerId: string) => void;
  onOpen: (id: string) => void;
}) {
  const { TEAM_ENABLED } = useExclusive();
  const { openSite } = useSitePanelLink();
  const { capturing, beginCapture, showMarker } = useTags();
  const { profileFor } = useProfiles();
  const navigate = useNavigate();
  const site = task.siteId ? sites.find((s) => s.id === task.siteId) : undefined;
  const client = task.clientId ? clients.find((c) => c.id === task.clientId) : undefined;
  const otherStatuses = COLUMNS.filter((c) => c.status !== status);
  const markers = task.markers ?? [];
  const commentCount = task.comments?.length ?? 0;
  const prio = priorityMeta(task.priority);

  return (
    <motion.div variants={staggerItem} className="group/card border border-border bg-bg p-3">
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={() => onOpen(task.id)}
          // `-my-1.5 py-1.5` : la zone cliquable passe de 19 à 31 px sans rien
          // déplacer. C'est la cible principale de la carte — celle qu'on vise
          // pour ouvrir la tâche — et elle était la plus petite.
          className="-my-1.5 flex min-w-0 items-start gap-1.5 py-1.5 text-left"
          title={tr('hist.tasks.ouvrirLaTache')}
        >
          <span
            className={`mt-1 h-2 w-2 flex-shrink-0 rounded-full ${prio.dot}`}
            title={`Priorité ${prio.label.toLowerCase()}`}
          />
          <span className="text-sm font-medium leading-snug text-text-primary hover:underline">{task.title}</span>
        </button>
        <button
          type="button"
          onClick={() => onRemove(task.id)}
          aria-label={tr('hist.tasks.supprimerLaTache')}
          className="flex-shrink-0 text-text-muted opacity-0 transition-opacity hover:text-danger group-hover/card:opacity-100"
        >
          <Trash2 size={13} strokeWidth={1.9} />
        </button>
      </div>
      {task.garde?.pourquoi ? (
        /* Deux lignes au plus (Bloc 1 de l'Automatique) : qui l'a posée, et l'action ; le pourquoi complet est dans la fiche. */
        <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-text-muted" data-garde={task.garde.agent} title={task.garde.pourquoi}>
          {tr('hist.tasks.parLaGardeCourt', { equipe: GARDE_EQUIPE[task.garde.equipe] ?? task.garde.equipe })}
          {task.garde.action ? <> · <span className="text-text-secondary">{task.garde.action}</span></> : null}
        </p>
      ) : (
        task.detail && <p className="mt-1 text-xs leading-relaxed text-text-secondary">{task.detail}</p>
      )}

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

      {/* Contextual markers (A4): clickable repères + add button */}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {markers.map((m) => (
          <span
            key={m.id}
            className="group/mark flex items-center gap-1 rounded-sm bg-accent/10 px-1.5 py-0.5 font-mono text-[10px] text-accent"
          >
            <button
              type="button"
              onClick={() => showMarker(m)}
              className="-my-1.5 flex items-center gap-1 py-1.5 hover:underline"
              title={`Voir le repère · ${m.label}`}
            >
              <MapPin size={10} strokeWidth={2} />
              {m.label}
            </button>
            <button
              type="button"
              onClick={() => onRemoveMarker(task, m.id)}
              aria-label={tr('hist.tasks.retirerLeRepere')}
              className="opacity-0 transition-opacity hover:text-danger group-hover/mark:opacity-100"
            >
              <X size={9} strokeWidth={2.5} />
            </button>
          </span>
        ))}
        <button
          type="button"
          onClick={() => beginCapture((marker) => onAddMarker(task, marker))}
          disabled={capturing}
          className="flex items-center gap-1 rounded-sm border border-dashed border-border px-1.5 py-1 font-mono text-[10px] text-text-muted transition-colors hover:border-accent/50 hover:text-accent disabled:opacity-40"
          title={tr('hist.tasks.pointerUnEndroitDe')}
        >
          <MapPin size={10} strokeWidth={2} />{tr('hist.tasks.ajouterUnRepere')}</button>
      </div>

      <div className="mt-3 flex items-center justify-between">
        {TEAM_ENABLED ? <UserAvatar email={task.assigneeEmail} size={24} /> : <span />}
        <div className="flex items-center gap-2 font-mono text-[10px] text-text-muted">
          {commentCount > 0 && (
            <button
              type="button"
              onClick={() => onOpen(task.id)}
              className="flex items-center gap-0.5 hover:text-text-secondary"
              title={`${commentCount} commentaire${commentCount > 1 ? 's' : ''}`}
            >
              <MessageSquare size={11} strokeWidth={2} />
              {commentCount}
            </button>
          )}
          <span>{relativeTime(task.updatedAt)}</span>
        </div>
      </div>

      <div className="mt-2 flex gap-1 opacity-0 transition-opacity group-hover/card:opacity-100">
        {otherStatuses.map((col) => (
          <button
            key={col.status}
            type="button"
            onClick={() => onMove(task, col.status)}
            className="flex-1 border border-border py-1.5 font-mono text-[9px] uppercase tracking-wider text-text-secondary hover:border-border-strong hover:text-text-primary"
          >
            → {col.label}
          </button>
        ))}
      </div>

      {/* Finished task → offer a pre-filled report (B1). */}
      {status === 'done' && (
        <button
          type="button"
          onClick={() =>
            navigate('/reports', {
              state: { reportDraft: taskReportDraft(task, (e) => profileFor(e).name, TEAM_ENABLED) },
            })
          }
          className="mt-2 flex w-full items-center justify-center gap-1.5 border border-accent/40 bg-accent/10 py-1.5 font-mono text-[10px] uppercase tracking-wider text-accent transition-colors hover:bg-accent/20"
        >
          <FileText size={11} strokeWidth={2} />{tr('hist.tasks.faireUnRapport')}</button>
      )}
    </motion.div>
  );
}

function NewTaskModal({
  sites,
  clients,
  onClose,
  onCreate,
}: {
  sites: ReturnType<typeof useLinkedSites>['sites'];
  clients: Client[];
  onClose: () => void;
  onCreate: (input: {
    title: string;
    detail: string;
    assigneeEmail: string;
    siteId: string | null;
    clientId: number | null;
    priority: TaskPriority;
  }) => void;
}) {
  const { user } = useAuth();
  const { TEAM_ENABLED, TEAM_MEMBERS, SITES_ENABLED } = useExclusive();
  // Échap ferme, comme partout ailleurs. Voir lib/useFermetureEchap.
  useFermetureEchap(true, onClose);

  const [title, setTitle] = useState('');
  const [detail, setDetail] = useState('');
  // Sans équipe, une tâche appartient forcément à celle qui la crée.
  const [assigneeEmail, setAssigneeEmail] = useState(
    TEAM_MEMBERS[0]?.email ?? user?.email ?? '',
  );
  const [siteId, setSiteId] = useState<string>('');
  const [clientId, setClientId] = useState<string>('');
  const [priority, setPriority] = useState<TaskPriority>('normal');

  const submit = () => {
    if (!title.trim()) return;
    onCreate({
      title: title.trim(),
      detail: detail.trim(),
      assigneeEmail,
      siteId: siteId || null,
      clientId: clientId ? Number(clientId) : null,
      priority,
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
        <div className="flex items-center justify-between gap-2 border-b border-border px-5 py-3">
          <h2 className="font-mono text-[11px] uppercase tracking-widest text-text-secondary">{tr('hist.tasks.nouvelleTache')}</h2>
          <button type="button" onClick={onClose} aria-label="Fermer" className="flex h-9 w-9 items-center justify-center text-text-secondary hover:text-text-primary">
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
            <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">{tr('hist.tasks.detail')}</span>
            <textarea
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              rows={2}
              className="input-focus resize-none border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none"
            />
          </label>
          {TEAM_ENABLED && (
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">{tr('hist.tasks.assigneA')}</span>
            <div className="flex border border-border">
              {TEAM_MEMBERS.map((m) => (
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
          )}
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">{tr('hist.tasks.priorite')}</span>
            <div className="flex border border-border">
              {PRIORITIES.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPriority(p.value)}
                  className={`flex flex-1 items-center justify-center gap-1.5 py-2 text-sm transition-colors ${
                    priority === p.value ? 'bg-accent-muted text-text-primary' : 'text-text-muted hover:text-text-secondary'
                  }`}
                >
                  <span className={`h-2 w-2 rounded-full ${p.dot}`} />
                  {p.label}
                </button>
              ))}
            </div>
          </label>
          {SITES_ENABLED && (
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">{tr('hist.tasks.lierAUnSite')}</span>
            <select
              value={siteId}
              onChange={(e) => setSiteId(e.target.value)}
              className="input-focus border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none"
            >
              <option value="">{tr('hist.tasks.aucun')}</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          )}
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">{tr('hist.tasks.lierAUnClient')}</span>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="input-focus border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none"
            >
              <option value="">{tr('hist.tasks.aucun')}</option>
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
          >{tr('hist.tasks.creerLaTache')}</button>
        </div>
      </motion.div>
    </div>
  );
}

/**
 * Task detail (A5): full view with priority/assignee/links, the contextual
 * markers (A4), an inline "Modifier" edit form (A5.2) and a scoped discussion
 * thread (A5.1).
 */
function TaskDetailModal({
  task,
  sites,
  clients,
  candidats,
  onClose,
  onPatch,
  onAddComment,
  onRemove,
  onAddMarker,
  onRemoveMarker,
}: {
  task: SyncTask;
  sites: ReturnType<typeof useLinkedSites>['sites'];
  clients: Client[];
  /** Les tâches ouvertes autres que celle-ci — ce qu'elle peut attendre. */
  candidats: SyncTask[];
  onClose: () => void;
  onPatch: (task: SyncTask, patch: Partial<TaskData>) => void;
  onAddComment: (task: SyncTask, body: string) => void;
  onRemove: (id: string) => void;
  onAddMarker: (task: SyncTask, marker: TaskMarker) => void;
  onRemoveMarker: (task: SyncTask, markerId: string) => void;
}) {
  const { user } = useAuth();
  // Échap ferme, comme partout ailleurs. Voir lib/useFermetureEchap.
  useFermetureEchap(true, onClose);

  const { TEAM_ENABLED, TEAM_MEMBERS } = useExclusive();
  const { profileFor } = useProfiles();
  const { beginCapture, showMarker } = useTags();

  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [detail, setDetail] = useState(task.detail);
  const [assigneeEmail, setAssigneeEmail] = useState(task.assigneeEmail);
  const [priority, setPriority] = useState<TaskPriority>(task.priority ?? 'normal');
  const [blockedBy, setBlockedBy] = useState<string>(task.blockedBy ?? '');
  const [draft, setDraft] = useState('');

  const site = task.siteId ? sites.find((s) => s.id === task.siteId) : undefined;
  const client = task.clientId ? clients.find((c) => c.id === task.clientId) : undefined;
  const markers = task.markers ?? [];
  const comments = task.comments ?? [];
  const prio = priorityMeta(task.priority);
  const autresOuvertes = candidats.filter((t) => t.id !== task.id);

  const saveEdit = () => {
    if (!title.trim()) return;
    onPatch(task, {
      title: title.trim(),
      detail: detail.trim(),
      assigneeEmail,
      priority,
      /* La chaîne vide veut dire « plus rien » : on écrit `undefined` pour
         que le champ disparaisse de l'enregistrement plutôt que d'y rester
         vide, sinon l'arbre continuerait de chercher une tâche « ». */
      blockedBy: blockedBy || undefined,
    });
    setEditing(false);
  };

  const sendComment = () => {
    const body = draft.trim();
    if (!body) return;
    onAddComment(task, body);
    setDraft('');
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.98, y: -6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: -6 }}
        transition={{ type: 'spring', stiffness: 420, damping: 32 }}
        className="relative flex max-h-[85vh] w-full max-w-lg flex-col border border-border-strong bg-surface"
      >
        <div className="flex items-center justify-between gap-2 border-b border-border px-5 py-3">
          <h2 className="font-mono text-[11px] uppercase tracking-widest text-text-secondary">Tâche</h2>
          <div className="flex items-center gap-2">
            {!editing && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="flex min-h-9 items-center gap-1.5 rounded-sm px-2 py-1 text-xs text-text-secondary hover:text-text-primary"
              >
                <Pencil size={13} strokeWidth={1.9} /> Modifier
              </button>
            )}
            <button type="button" onClick={onClose} aria-label="Fermer" className="flex h-9 w-9 items-center justify-center text-text-secondary hover:text-text-primary">
              <X size={18} strokeWidth={2} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {editing ? (
            <div className="flex flex-col gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">Titre *</span>
                <input
                  autoFocus
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="input-focus border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">{tr('hist.tasks.detail')}</span>
                <textarea
                  value={detail}
                  onChange={(e) => setDetail(e.target.value)}
                  rows={3}
                  className="input-focus resize-none border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none"
                />
              </label>
              {TEAM_ENABLED && (
              <label className="flex flex-col gap-1.5">
                <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">{tr('hist.tasks.assigneA')}</span>
                <div className="flex border border-border">
                  {TEAM_MEMBERS.map((m) => (
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
              )}
              <label className="flex flex-col gap-1.5">
                <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">{tr('hist.tasks.priorite')}</span>
                <div className="flex border border-border">
                  {PRIORITIES.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => setPriority(p.value)}
                      className={`flex flex-1 items-center justify-center gap-1.5 py-2 text-sm transition-colors ${
                        priority === p.value ? 'bg-accent-muted text-text-primary' : 'text-text-muted hover:text-text-secondary'
                      }`}
                    >
                      <span className={`h-2 w-2 rounded-full ${p.dot}`} />
                      {p.label}
                    </button>
                  ))}
                </div>
              </label>
              {/*
                CE QUE LA TÂCHE ATTEND — le champ qui fait exister l'arbre.

                Une liste déroulante et rien d'autre : une tâche n'attend
                qu'une chose à la fois. Proposer plusieurs blocages
                transformerait l'arbre en graphe, et un graphe ne répond plus
                à « qu'est-ce que je débloque en premier ».

                Les tâches terminées et la tâche elle-même sont exclues de la
                liste : attendre une chose déjà faite, ou s'attendre soi-même,
                sont les deux seules façons de produire un arbre qui ne se
                résout jamais.
              */}
              <label className="flex flex-col gap-1.5">
                <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">En attente de</span>
                <select
                  value={blockedBy}
                  onChange={(e) => setBlockedBy(e.target.value)}
                  className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none"
                >
                  <option value="">Rien — elle peut avancer</option>
                  {autresOuvertes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </select>
              </label>
              <div className="mt-1 flex gap-2">
                <button
                  type="button"
                  onClick={saveEdit}
                  disabled={!title.trim()}
                  className="flex-1 bg-accent px-3 py-2 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover disabled:opacity-40"
                >{tr('hist.tasks.enregistrer')}</button>
                <button
                  type="button"
                  onClick={() => {
                    setEditing(false);
                    setTitle(task.title);
                    setDetail(task.detail);
                    setAssigneeEmail(task.assigneeEmail);
                    setPriority(task.priority ?? 'normal');
                    setBlockedBy(task.blockedBy ?? '');
                  }}
                  className="border border-border px-3 py-2 text-sm text-text-secondary transition-colors hover:text-text-primary"
                >
                  Annuler
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-start gap-2">
                <span className={`mt-1.5 h-2.5 w-2.5 flex-shrink-0 rounded-full ${prio.dot}`} />
                <h3 className="text-lg font-semibold leading-snug text-text-primary">{task.title}</h3>
              </div>
              {task.detail && <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-text-secondary">{task.detail}</p>}

              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-text-muted">
                {TEAM_ENABLED && (
                  <span className="flex items-center gap-1.5">
                    <UserAvatar email={task.assigneeEmail} size={20} />
                    {profileFor(task.assigneeEmail).name}
                  </span>
                )}
                <span className={`flex items-center gap-1.5 ${prio.text}`}>
                  <span className={`h-2 w-2 rounded-full ${prio.dot}`} /> Priorité {prio.label.toLowerCase()}
                </span>
                {site && (
                  <span className="flex items-center gap-1">
                    <Globe size={11} strokeWidth={2} /> {site.name}
                  </span>
                )}
                {client && (
                  <span className="flex items-center gap-1">
                    <Contact size={11} strokeWidth={2} /> {client.name}
                  </span>
                )}
              </div>

              {/* Markers (A4) */}
              <div className="mt-4">
                <p className="mb-1.5 font-mono text-[10px] uppercase tracking-widest text-text-muted">{tr('hist.tasks.reperes')}</p>
                <div className="flex flex-wrap items-center gap-1.5">
                  {markers.map((m) => (
                    <span key={m.id} className="group/mk flex items-center gap-1 rounded-sm bg-accent/10 px-1.5 py-0.5 font-mono text-[10px] text-accent">
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          showMarker(m);
                        }}
                        className="-my-1.5 flex items-center gap-1 py-1.5 hover:underline"
                      >
                        <MapPin size={10} strokeWidth={2} /> {m.label}
                      </button>
                      <button
                        type="button"
                        onClick={() => onRemoveMarker(task, m.id)}
                        aria-label={tr('hist.tasks.retirerLeRepere')}
                        className="opacity-0 transition-opacity hover:text-danger group-hover/mk:opacity-100"
                      >
                        <X size={9} strokeWidth={2.5} />
                      </button>
                    </span>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      // Close so the app is navigable while picking the spot.
                      onClose();
                      beginCapture((marker) => onAddMarker(task, marker));
                    }}
                    className="flex items-center gap-1 rounded-sm border border-dashed border-border px-1.5 py-1 font-mono text-[10px] text-text-muted transition-colors hover:border-accent/50 hover:text-accent"
                  >
                    <MapPin size={10} strokeWidth={2} />{tr('hist.tasks.ajouterUnRepere')}</button>
                </div>
              </div>

              {/* Comments (A5.1) */}
              <div className="mt-5 border-t border-border pt-4">
                <p className="mb-2 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-text-muted">
                  <MessageSquare size={11} strokeWidth={2} /> Discussion · {comments.length}
                </p>
                <div className="flex flex-col gap-3">
                  {comments.length === 0 ? (
                    <p className="text-xs text-text-muted">{tr('hist.tasks.aucunCommentaireLancezLa')}</p>
                  ) : (
                    comments.map((c) => (
                      <div key={c.id} className="flex gap-2">
                        <UserAvatar email={c.authorEmail} size={24} className="mt-0.5" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline gap-2">
                            <span className="text-xs font-medium text-text-primary">{profileFor(c.authorEmail).name}</span>
                            <span className="font-mono text-[9px] text-text-muted">{relativeTime(c.createdAt)}</span>
                          </div>
                          <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-text-secondary">{c.body}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {!editing && (
          <div className="flex items-center gap-2 border-t border-border p-3">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendComment();
                }
              }}
              placeholder={user ? 'Écrire un commentaire…' : 'Connexion requise'}
              disabled={!user}
              className="input-focus flex-1 border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none"
            />
            <button
              type="button"
              onClick={sendComment}
              disabled={!draft.trim()}
              aria-label={tr('hist.tasks.envoyerLeCommentaire')}
              className="flex h-9 w-9 items-center justify-center bg-accent text-bg transition-colors hover:bg-accent-hover disabled:opacity-40"
            >
              <Send size={15} strokeWidth={2} />
            </button>
            <button
              type="button"
              onClick={() => onRemove(task.id)}
              aria-label={tr('hist.tasks.supprimerLaTache')}
              className="flex h-9 w-9 items-center justify-center border border-border text-text-muted transition-colors hover:border-danger/50 hover:text-danger"
            >
              <Trash2 size={15} strokeWidth={1.9} />
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
