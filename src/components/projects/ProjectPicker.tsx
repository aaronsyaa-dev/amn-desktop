import React from 'react';
import { useProjectPicker } from '../../state/useProjects';
import { isModuleEnabled } from '../../data/spaces';

/**
 * Le sélecteur « projet lié », partagé par Tâches, Agenda, Notes et
 * Facturation (A.3).
 *
 * C'est TOUT ce que le rattachement demande côté écran : un identifiant posé
 * sur l'enregistrement qui existe déjà. Rien n'est recopié vers le projet, et
 * le projet ne tient aucune liste — il retrouve ce qui le concerne en filtrant
 * les collections. Une tâche a donc toujours exactement un endroit où elle
 * vit, et le projet en est une lecture.
 *
 * Le composant se retire de lui-même quand le module Projets est fermé pour
 * l'organisation : proposer de rattacher à des projets qui n'existent pas
 * serait une impasse, et c'est le genre de détail qu'on oublie en activant les
 * modules un par un.
 */
export function ProjectPicker({
  value,
  onChange,
  label = 'Projet lié',
  className = '',
}: {
  value: string | undefined;
  onChange: (projectId: string) => void;
  label?: string;
  className?: string;
}) {
  const projects = useProjectPicker();

  if (!isModuleEnabled('projects')) return null;
  // Aucun projet : un menu déroulant vide n'apprend rien et occupe une ligne
  // dans un formulaire déjà dense.
  if (projects.length === 0 && !value) return null;

  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-text-muted">
        {label}
      </span>
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="input-focus min-h-11 w-full border border-border bg-bg px-3 text-sm text-text-primary outline-none md:min-h-0 md:py-2"
      >
        <option value="">— Aucun</option>
        {projects.map((project) => (
          <option key={project.id} value={project.id}>
            {project.structure ? `${project.structure} · ` : ''}
            {project.title || 'Sans titre'}
            {project.done ? ' (terminé)' : ''}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * L'étiquette d'un projet rattaché, pour les listes.
 * Rend `null` si l'enregistrement n'est rattaché à rien — le cas courant.
 */
export function ProjectTag({ projectId }: { projectId: string | undefined }) {
  const projects = useProjectPicker();
  if (!projectId || !isModuleEnabled('projects')) return null;
  const project = projects.find((p) => p.id === projectId);
  // Un projet supprimé laisse un identifiant orphelin : on le dit, plutôt que
  // de faire disparaître silencieusement le rattachement.
  const text = project ? project.title || 'Sans titre' : 'Projet supprimé';
  return (
    <span className="max-w-[14rem] truncate border border-border px-1.5 py-px font-mono text-[9px] uppercase tracking-widest text-text-muted">
      {text}
    </span>
  );
}
