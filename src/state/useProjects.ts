import { useCallback, useMemo } from 'react';
import { useSync, useCollection, uid, stripMeta } from './SyncContext';
import {
  defaultConfig,
  isDone,
  normalizeConfig,
  type Project,
  type ProjectConfig,
  type ProjectData,
} from './projectEngine';

/**
 * Les projets, et surtout ce qui s'y rattache.
 *
 * Le point de tout le module tient dans `attachmentsOf` : un projet ne stocke
 * NI tâche, NI rendez-vous, NI note, NI facture. Il porte un identifiant, et
 * ce sont les collections existantes qui portent le sien. La vue d'un projet
 * est donc un filtre, jamais une copie.
 *
 * C'est ce qui répond au vrai problème — l'information éparpillée entre des
 * modules qui ne se parlent pas — sans créer le problème inverse : deux
 * endroits qui prétendent chacun dire la vérité sur la même tâche.
 */

const CONFIG_ID = 'config';

/** Ce qu'une collection rattachable expose au moteur. */
interface Attachable {
  id: string;
  projectId?: string;
  title?: string;
  status?: string;
  dueAt?: string;
  startsAt?: string;
  number?: string;
  updatedAt: string;
}

export function useProjects() {
  const { upsert, remove } = useSync();
  const rawProjects = useCollection<ProjectData>('projects');
  const rawConfig = useCollection<Partial<ProjectConfig>>('projectConfig');

  // Les collections rattachables, lues telles quelles. Aucune n'est modifiée
  // par ce hook : il ne fait que les regarder.
  const tasks = useCollection<Attachable>('tasks');
  const appointments = useCollection<Attachable>('appointments');
  const notes = useCollection<Attachable>('notes');
  const invoices = useCollection<Attachable>('invoices');

  const config = useMemo<ProjectConfig>(() => {
    const row = rawConfig.find((r) => r.id === CONFIG_ID);
    return row ? normalizeConfig(row) : defaultConfig();
  }, [rawConfig]);

  const projects = useMemo<Project[]>(
    () =>
      rawProjects
        .map((row) => ({
          id: row.id,
          title: row.title ?? '',
          status: row.status ?? config.statuses[0]?.key ?? '',
          structure: row.structure ?? '',
          clientId: Number(row.clientId ?? 0),
          priority: row.priority ?? 'normal',
          nextAction: row.nextAction ?? '',
          deadline: row.deadline ?? '',
          link: row.link ?? '',
          notes: row.notes ?? '',
          extra: typeof row.extra === 'object' && row.extra ? row.extra : {},
          createdAt: row.createdAt ?? row.updatedAt,
          updatedAt: row.updatedAt,
        }))
        // Les projets vivants d'abord, puis par échéance : c'est l'ordre dans
        // lequel on se pose la question « qu'est-ce que je fais maintenant ».
        .sort((a, b) => {
          const aDone = isDone(config, a);
          const bDone = isDone(config, b);
          if (aDone !== bDone) return aDone ? 1 : -1;
          if (a.deadline && b.deadline) return a.deadline.localeCompare(b.deadline);
          if (a.deadline) return -1;
          if (b.deadline) return 1;
          return (b.updatedAt || '').localeCompare(a.updatedAt || '');
        }),
    [rawProjects, config],
  );

  const saveConfig = useCallback(
    (next: ProjectConfig) => upsert('projectConfig', CONFIG_ID, { ...next }),
    [upsert],
  );

  const createProject = useCallback(
    (input: Partial<ProjectData> & { title: string }): string => {
      const id = uid('proj');
      upsert('projects', id, {
        title: input.title,
        status: input.status ?? config.statuses[0]?.key ?? '',
        structure: input.structure ?? '',
        clientId: input.clientId ?? 0,
        priority: input.priority ?? 'normal',
        nextAction: input.nextAction ?? '',
        deadline: input.deadline ?? '',
        link: input.link ?? '',
        notes: input.notes ?? '',
        extra: input.extra ?? {},
        createdAt: new Date().toISOString(),
      } satisfies Omit<ProjectData, never>);
      return id;
    },
    [config.statuses, upsert],
  );

  const updateProject = useCallback(
    (id: string, patch: Partial<ProjectData>) => {
      const current = rawProjects.find((p) => p.id === id);
      if (!current) return;
      upsert('projects', id, { ...stripMeta(current), ...patch });
    },
    [rawProjects, upsert],
  );

  const deleteProject = useCallback((id: string) => remove('projects', id), [remove]);

  /**
   * Ce qui est rattaché à un projet, par collection.
   *
   * Volontairement en lecture seule et calculé à la demande : matérialiser ces
   * listes dans le projet en ferait une copie, et deux copies finissent
   * toujours par diverger — c'est précisément le problème qu'on cherche à
   * supprimer, pas à déplacer.
   */
  const attachmentsOf = useCallback(
    (projectId: string) => ({
      tasks: tasks.filter((t) => t.projectId === projectId),
      appointments: appointments.filter((a) => a.projectId === projectId),
      notes: notes.filter((n) => n.projectId === projectId),
      invoices: invoices.filter((i) => i.projectId === projectId),
    }),
    [tasks, appointments, notes, invoices],
  );

  /** Combien d'éléments sont rattachés, sans construire les listes. */
  const attachmentCount = useCallback(
    (projectId: string) =>
      tasks.filter((t) => t.projectId === projectId).length +
      appointments.filter((a) => a.projectId === projectId).length +
      notes.filter((n) => n.projectId === projectId).length +
      invoices.filter((i) => i.projectId === projectId).length,
    [tasks, appointments, notes, invoices],
  );

  const active = useMemo(() => projects.filter((p) => !isDone(config, p)), [projects, config]);

  return {
    config,
    saveConfig,
    projects,
    active,
    createProject,
    updateProject,
    deleteProject,
    attachmentsOf,
    attachmentCount,
  };
}

/** La liste des projets, pour les sélecteurs « projet lié » des autres écrans. */
export function useProjectPicker() {
  const rawProjects = useCollection<ProjectData>('projects');
  const rawConfig = useCollection<Partial<ProjectConfig>>('projectConfig');
  const config = useMemo(() => {
    const row = rawConfig.find((r) => r.id === CONFIG_ID);
    return row ? normalizeConfig(row) : defaultConfig();
  }, [rawConfig]);

  return useMemo(
    () =>
      rawProjects
        .map((row) => ({
          id: row.id,
          title: row.title ?? '',
          structure: row.structure ?? '',
          done: config.statuses.find((s) => s.key === row.status)?.done === true,
        }))
        // Les projets terminés restent sélectionnables — on rattache parfois
        // une facture après coup — mais ils descendent en bas de liste.
        .sort((a, b) => (a.done === b.done ? a.title.localeCompare(b.title) : a.done ? 1 : -1)),
    [rawProjects, config],
  );
}
