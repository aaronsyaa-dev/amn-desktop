import React, { useMemo, useState } from 'react';
import { ScreenHeader } from '../components/ScreenHeader';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  CalendarDays,
  CheckSquare,
  ExternalLink,
  FileText,
  NotebookPen,
  Plus,
  ReceiptEuro,
  Settings2,
  Timer,
  Trash2,
  Wallet,
} from 'lucide-react';
import { useProjects } from '../state/useProjects';
import { useExpenses } from '../state/useExpenses';
import { useClients } from '../state/useClients';
import { isModuleEnabled } from '../data/spaces';
import { formatCents } from '../lib/money';
import {
  fieldEnabled,
  fieldLabel,
  isDone,
  statusLabel,
  type OptionalFieldKey,
  type Project,
  type ProjectPriority,
} from '../state/projectEngine';
import { ProjectConfigPanel } from '../components/projects/ProjectConfigPanel';
import { formatDay, isoDay } from '../state/useInvoices';
import { staggerContainer, staggerItem } from '../lib/transitions';
import { EmptyState, FirstRun } from '../components/EmptyState';

/**
 * Projets — la première application concrète du moteur (BLOC A).
 *
 * L'écran ne connaît aucun statut, aucune structure, aucun intitulé : il lit
 * la configuration de l'organisation et se dessine à partir d'elle. C'est ce
 * qui fait qu'un second profil métier ne demande pas une seconde version de
 * cet écran.
 *
 * Le panneau de détail montre, à côté des champs du projet, CE QUI S'Y
 * RATTACHE — tâches, rendez-vous, notes, factures. Ces éléments ne sont pas
 * stockés ici : ils vivent dans leurs collections et portent l'identifiant du
 * projet. Le projet est une vue, pas une base parallèle.
 */

const PRIORITY_LABEL: Record<ProjectPriority, string> = {
  low: 'Basse',
  normal: 'Normale',
  high: 'Haute',
};

export function ProjectsScreen() {
  const {
    config,
    saveConfig,
    projects,
    createProject,
    updateProject,
    deleteProject,
    attachmentsOf,
    attachmentCount,
  } = useProjects();
  const { clients } = useClients();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [configOpen, setConfigOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const today = isoDay();

  const visible = useMemo(
    () => (statusFilter === 'all' ? projects : projects.filter((p) => p.status === statusFilter)),
    [projects, statusFilter],
  );
  const selected = useMemo(
    () => projects.find((p) => p.id === selectedId) ?? null,
    [projects, selectedId],
  );

  const newProject = () => {
    const id = createProject({ title: 'Nouveau projet' });
    setSelectedId(id);
    setStatusFilter('all');
  };

  return (
    /*
      La hauteur pleine ne se justifie que s'il y a une liste à faire défiler
      (BLOC A). `screen-h` force la section à occuper tout l'écran ; avec une
      liste vide, ça produit un panneau bordé de 700 px contenant une phrase.
      Sans liste, la section se dimensionne sur son contenu.
    */
    <section className={`flex flex-col gap-4 ${projects.length === 0 ? '' : 'screen-h'}`}>
      <ScreenHeader
        eyebrow="Poste de travail · Projets"
        title="Projets"
        description="Tout ce qui s’y rattache, au même endroit."
        stats={[
          { label: 'Projets', value: projects.length },
          /*
            Le premier statut configuré est celui d'un projet qui DÉMARRE, et
            le dernier celui d'un projet fini : c'est l'ordre dans lequel la
            configuration les présente. On compte donc « en cours » comme tout
            ce qui n'est pas au dernier statut, plutôt que de coder en dur un
            libellé que chaque organisation peut renommer.
          */
          {
            label: 'En cours',
            value: projects.filter((p) => p.status !== config.statuses[config.statuses.length - 1]?.key)
              .length,
            emphasis: true,
          },
          { label: 'Affichés', value: visible.length, title: 'Après le filtre de statut ci-dessous.' },
        ]}
        actions={
        <div className="flex flex-shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setConfigOpen(true)}
            title="Configurer le module"
            aria-label="Configurer le module"
            className="flex h-11 w-11 items-center justify-center border border-border text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary md:h-9 md:w-9"
          >
            <Settings2 size={16} strokeWidth={1.75} />
          </button>
          <button
            type="button"
            onClick={newProject}
            className="flex h-11 items-center gap-2 bg-accent px-3 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover md:h-9"
          >
            <Plus size={16} strokeWidth={2.25} />
            <span className="hidden sm:inline">Nouveau projet</span>
            <span className="sm:hidden">Projet</span>
          </button>
        </div>
        }
      >
      <div className="flex flex-shrink-0 gap-1.5 overflow-x-auto pb-0.5">
        <FilterChip active={statusFilter === 'all'} onClick={() => setStatusFilter('all')}>
          Tous
        </FilterChip>
        {config.statuses.map((status) => (
          <FilterChip
            key={status.key}
            active={statusFilter === status.key}
            onClick={() => setStatusFilter(status.key)}
          >
            {status.label}
          </FilterChip>
        ))}
      </div>
      </ScreenHeader>

      {/*
        LA COLONNE DE DÉTAIL DISPARAÎT QUAND IL N'Y A RIEN À DÉTAILLER (BLOC A).

        C'est le vide le plus grand de toute l'application, et il ne venait
        d'aucun « état vide » : il venait de la MISE EN PAGE. Une grille
        maître/détail réserve les deux tiers de l'écran au détail, même quand la
        liste est vide — et on se retrouve devant 900 × 700 px de rien portant
        « SÉLECTIONNEZ UN PROJET », c'est-à-dire une consigne impossible à
        suivre puisqu'il n'y a rien à sélectionner.

        Liste vide → une seule colonne, la largeur d'une colonne de lecture. Le
        détail revient à la seconde où un premier projet existe. Rien n'est
        ajouté ; une colonne est retirée quand elle n'a pas de sujet.
      */}
      <div
        className={`grid min-h-0 flex-1 gap-4 ${
          projects.length === 0 ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-[340px_1fr]'
        }`}
      >
        <div
          className={`min-h-0 flex-col border border-border bg-surface ${
            selected ? 'hidden md:flex' : 'flex'
          }`}
        >
          <div className="flex-shrink-0 border-b border-border px-4 py-3 font-mono text-[11px] uppercase tracking-widest text-text-secondary">
            {visible.length} projet{visible.length > 1 ? 's' : ''}
          </div>
          <motion.div
            variants={staggerContainer}
            initial="initial"
            animate="animate"
            className="min-h-0 flex-1 divide-y divide-border/60 overflow-y-auto"
          >
            {visible.length === 0 ? (
              /*
                PROJETS (BLOC A) — une étiquette en capitales là où il fallait
                une phrase. « AUCUN PROJET » ne dit ni ce qu'est un projet ici,
                ni comment en ouvrir un.
              */
              <div className="px-4">
                {projects.length === 0 ? (
                  <FirstRun title="Aucun projet ouvert">
                    Un projet rassemble ce qui avance et ce qui bloque : ses tâches, son temps, ses
                    dépenses et ses factures s’y rattachent.
                  </FirstRun>
                ) : (
                  <EmptyState quiet>Rien dans ce filtre.</EmptyState>
                )}
              </div>
            ) : (
              visible.map((project) => (
                <ProjectRow
                  key={project.id}
                  project={project}
                  label={statusLabel(config, project.status)}
                  done={isDone(config, project)}
                  late={Boolean(project.deadline) && project.deadline < today && !isDone(config, project)}
                  attachments={attachmentCount(project.id)}
                  showStructure={fieldEnabled(config, 'structure')}
                  showNextAction={fieldEnabled(config, 'nextAction')}
                  active={project.id === selectedId}
                  onSelect={() => setSelectedId(project.id)}
                />
              ))
            )}
          </motion.div>
        </div>

        {selected ? (
          <ProjectDetail
            key={selected.id}
            project={selected}
            clients={clients}
            attachments={attachmentsOf(selected.id)}
            today={today}
            onBack={() => setSelectedId(null)}
            onPatch={(patch) => updateProject(selected.id, patch)}
            onDelete={() => {
              deleteProject(selected.id);
              setSelectedId(null);
            }}
          />
        ) : projects.length === 0 ? null : (
          <div className="hidden items-center justify-center border border-border bg-surface font-mono text-xs uppercase tracking-widest text-text-muted md:flex">
            Sélectionnez un projet
          </div>
        )}
      </div>

      <AnimatePresence>
        {configOpen && (
          <ProjectConfigPanel
            config={config}
            onSave={saveConfig}
            onClose={() => setConfigOpen(false)}
          />
        )}
      </AnimatePresence>
    </section>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-11 flex-shrink-0 items-center border px-2.5 font-mono text-[10px] uppercase tracking-widest transition-colors md:min-h-0 md:py-1.5 ${
        active
          ? 'border-border-strong bg-accent-muted text-text-primary'
          : 'border-border text-text-muted hover:text-text-secondary'
      }`}
    >
      {children}
    </button>
  );
}

function ProjectRow({
  project,
  label,
  done,
  late,
  attachments,
  showStructure,
  showNextAction,
  active,
  onSelect,
}: {
  project: Project;
  label: string;
  done: boolean;
  late: boolean;
  attachments: number;
  showStructure: boolean;
  showNextAction: boolean;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <motion.button
      variants={staggerItem}
      type="button"
      onClick={onSelect}
      className={`flex min-h-11 w-full flex-col gap-1 px-4 py-3 text-left transition-colors ${
        active ? 'bg-accent-muted' : 'hover:bg-surface-hover'
      }`}
    >
      <div className="flex items-center gap-2">
        <span
          className={`flex-shrink-0 border px-1.5 py-px font-mono text-[9px] uppercase tracking-widest ${
            done ? 'border-border text-text-muted' : 'border-border-strong text-text-secondary'
          }`}
        >
          {label}
        </span>
        {showStructure && project.structure && (
          <span className="truncate font-mono text-[9px] uppercase tracking-[0.18em] text-text-muted">
            {project.structure}
          </span>
        )}
        {attachments > 0 && (
          <span className="ml-auto flex-shrink-0 font-mono text-[9px] uppercase tracking-widest text-text-muted">
            {attachments} lié{attachments > 1 ? 's' : ''}
          </span>
        )}
      </div>

      <p className={`truncate text-sm ${done ? 'text-text-muted' : 'text-text-primary'}`}>
        {project.title || 'Sans titre'}
      </p>

      {/*
        La prochaine action est le champ le plus utile de l'écran : c'est la
        seule ligne qui dit quoi faire, donc elle est lisible sans ouvrir le
        projet.
      */}
      {showNextAction && project.nextAction && !done && (
        <p className="truncate text-xs text-text-secondary">→ {project.nextAction}</p>
      )}

      {project.deadline && (
        <p
          className={`font-mono text-[10px] uppercase tracking-widest ${
            late ? 'text-danger' : 'text-text-muted'
          }`}
        >
          {late ? 'En retard · ' : 'Échéance '}
          {formatDay(project.deadline)}
        </p>
      )}
    </motion.button>
  );
}

/* -------------------------------- Le détail ------------------------------- */

interface Attachments {
  tasks: { id: string; title?: string }[];
  appointments: { id: string; title?: string; startsAt?: string }[];
  notes: { id: string; title?: string }[];
  invoices: { id: string; number?: string }[];
  expenses: { id: string }[];
  timeEntries: { id: string }[];
}

function ProjectDetail({
  project,
  clients,
  attachments,
  today,
  onBack,
  onPatch,
  onDelete,
}: {
  project: Project;
  clients: { id: number; name: string; company: string }[];
  attachments: Attachments;
  today: string;
  onBack: () => void;
  onPatch: (patch: Partial<Project>) => void;
  onDelete: () => void;
}) {
  const { config } = useProjects();
  const { projectBudget } = useExpenses();
  const navigate = useNavigate();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const spent = projectBudget(project.id);

  const late = Boolean(project.deadline) && project.deadline < today && !isDone(config, project);

  const show = (key: OptionalFieldKey) => fieldEnabled(config, key);
  const label = (key: OptionalFieldKey) => fieldLabel(config, key);

  return (
    <div className="flex min-h-0 flex-col border border-border bg-surface">
      <div className="flex flex-shrink-0 items-center gap-2 border-b border-border px-3 py-2.5 md:px-4">
        <button
          type="button"
          onClick={onBack}
          aria-label="Retour à la liste"
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center text-text-secondary transition-colors hover:text-text-primary md:hidden"
        >
          <ArrowLeft size={18} strokeWidth={2} />
        </button>
        <input
          value={project.title}
          onChange={(e) => onPatch({ title: e.target.value })}
          placeholder="Titre du projet"
          className="input-focus min-w-0 flex-1 border border-transparent bg-transparent px-1 text-base font-semibold text-text-primary outline-none hover:border-border focus:border-border"
        />
        <button
          type="button"
          onClick={() => (confirmDelete ? onDelete() : setConfirmDelete(true))}
          onBlur={() => setConfirmDelete(false)}
          /* Bouton sans texte tant qu'il n'est pas armé : sans nom
             accessible, il était invisible pour un lecteur d'écran comme
             pour un balayage automatique — un bouton destructeur ne peut
             pas être anonyme. */
          aria-label="Supprimer le projet"
          title="Supprimer le projet"
          className={`flex h-11 flex-shrink-0 items-center gap-1.5 border px-2.5 font-mono text-[10px] uppercase tracking-wider transition-colors md:h-9 ${
            confirmDelete
              ? 'border-danger bg-danger-muted text-danger'
              : 'border-border text-text-muted hover:text-danger'
          }`}
        >
          <Trash2 size={14} strokeWidth={2} />
          {confirmDelete ? 'Confirmer' : ''}
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3 md:p-4">
        {late && (
          <p className="mb-3 border border-danger/50 bg-danger-muted px-3 py-2 text-xs leading-tight text-text-primary">
            <strong className="font-semibold">Échéance dépassée</strong> — attendue le{' '}
            {formatDay(project.deadline)}.
          </p>
        )}

        <Field label="Statut">
          <select
            value={project.status}
            onChange={(e) => onPatch({ status: e.target.value })}
            className="input-focus min-h-11 w-full border border-border bg-bg px-3 text-sm text-text-primary outline-none"
          >
            {config.statuses.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>

        {show('nextAction') && (
          <Field label={label('nextAction')}>
            <input
              value={project.nextAction}
              onChange={(e) => onPatch({ nextAction: e.target.value })}
              placeholder="La prochaine chose à faire, en une ligne"
              className="input-focus min-h-11 w-full border border-border bg-bg px-3 text-sm text-text-primary outline-none"
            />
          </Field>
        )}

        {show('structure') && (
          <Field label={label('structure')}>
            <select
              value={project.structure}
              onChange={(e) => onPatch({ structure: e.target.value })}
              className="input-focus min-h-11 w-full border border-border bg-bg px-3 text-sm text-text-primary outline-none"
            >
              <option value="">—</option>
              {config.structures.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
              {/* Une valeur héritée d'une structure retirée de la liste reste
                  affichable : elle disparaîtrait sinon sans que personne ne
                  s'en aperçoive. */}
              {project.structure && !config.structures.includes(project.structure) && (
                <option value={project.structure}>{project.structure} (retirée)</option>
              )}
            </select>
          </Field>
        )}

        {show('client') && (
          <Field label={label('client')}>
            <select
              value={project.clientId || 0}
              onChange={(e) => onPatch({ clientId: Number(e.target.value) })}
              className="input-focus min-h-11 w-full border border-border bg-bg px-3 text-sm text-text-primary outline-none"
            >
              <option value={0}>—</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.company ? `${c.company} — ${c.name}` : c.name}
                </option>
              ))}
            </select>
          </Field>
        )}

        <div className="grid grid-cols-2 gap-3">
          {show('deadline') && (
            <Field label={label('deadline')}>
              <input
                type="date"
                value={project.deadline}
                onChange={(e) => onPatch({ deadline: e.target.value })}
                className="input-focus min-h-11 w-full border border-border bg-bg px-3 text-sm text-text-primary outline-none"
              />
            </Field>
          )}
          {show('priority') && (
            <Field label={label('priority')}>
              <select
                value={project.priority}
                onChange={(e) => onPatch({ priority: e.target.value as ProjectPriority })}
                className="input-focus min-h-11 w-full border border-border bg-bg px-3 text-sm text-text-primary outline-none"
              >
                {(Object.keys(PRIORITY_LABEL) as ProjectPriority[]).map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_LABEL[p]}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </div>

        {show('link') && (
          <Field label={label('link')}>
            <div className="flex gap-2">
              <input
                value={project.link}
                onChange={(e) => onPatch({ link: e.target.value })}
                placeholder="https://drive.google.com/…"
                className="input-focus min-h-11 min-w-0 flex-1 border border-border bg-bg px-3 text-sm text-text-primary outline-none"
              />
              {project.link && (
                <a
                  href={project.link}
                  target="_blank"
                  rel="noreferrer noopener"
                  aria-label="Ouvrir le lien"
                  className="flex h-11 w-11 flex-shrink-0 items-center justify-center border border-border text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
                >
                  <ExternalLink size={15} strokeWidth={1.75} />
                </a>
              )}
            </div>
          </Field>
        )}

        {config.extraFields.map((field) => (
          <Field key={field.key} label={field.label}>
            <input
              value={project.extra[field.key] ?? ''}
              onChange={(e) => onPatch({ extra: { ...project.extra, [field.key]: e.target.value } })}
              className="input-focus min-h-11 w-full border border-border bg-bg px-3 text-sm text-text-primary outline-none"
            />
          </Field>
        ))}

        <Field label="Notes du projet">
          <textarea
            rows={3}
            value={project.notes}
            onChange={(e) => onPatch({ notes: e.target.value })}
            className="input-focus w-full resize-none border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none"
          />
        </Field>

        {/* ------------------------------------------------- rattachés ----- */}
        <div className="mt-5 border-t border-border pt-4">
          <p className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
            Rattaché à ce projet
          </p>
          <p className="mt-1 text-xs leading-relaxed text-text-secondary">
            Ces éléments vivent dans leurs propres modules et portent l’identifiant de ce projet.
            Rien n’est recopié ici — les modifier là-bas les modifie ici.
          </p>

          <div className="mt-3 flex flex-col gap-2">
            <AttachmentGroup
              icon={CheckSquare}
              label="Tâches"
              count={attachments.tasks.length}
              onOpen={() => navigate('/tasks')}
            />
            <AttachmentGroup
              icon={CalendarDays}
              label="Rendez-vous"
              count={attachments.appointments.length}
              onOpen={() => navigate('/agenda')}
            />
            <AttachmentGroup
              icon={NotebookPen}
              label="Notes"
              count={attachments.notes.length}
              onOpen={() => navigate('/notes')}
            />
            <AttachmentGroup
              icon={ReceiptEuro}
              label="Factures"
              count={attachments.invoices.length}
              onOpen={() => navigate('/facturation')}
            />
            {isModuleEnabled('expenses') && (
              <AttachmentGroup
                icon={Wallet}
                label="Dépenses"
                count={attachments.expenses.length}
                onOpen={() => navigate('/depenses')}
              />
            )}
            {isModuleEnabled('time') && (
              <AttachmentGroup
                icon={Timer}
                label="Temps passé"
                count={attachments.timeEntries.length}
                onOpen={() => navigate('/temps')}
              />
            )}
          </div>

          {/* L'enveloppe du projet, quand il en a une. Réglée dans Dépenses →
              Catégories et budgets : ce qui la consomme est ici, mais elle se
              décide là-bas, avec les autres budgets. */}
          {isModuleEnabled('expenses') && spent.state !== 'none' && (
            <div className="mt-4 border border-border p-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
                  Enveloppe du projet
                </span>
                <span className="font-mono text-xs tabular-nums text-text-secondary">
                  {formatCents(spent.spentCents)} / {formatCents(spent.budgetCents)}
                </span>
              </div>
              <div className="mt-2 h-2 w-full bg-bg">
                <div
                  className={`h-full ${spent.state === 'over' ? 'bg-danger' : 'bg-accent'}`}
                  style={{ width: `${Math.round(spent.ratio * 100)}%` }}
                />
              </div>
              <p
                className={`mt-1.5 font-mono text-[10px] uppercase tracking-widest ${
                  spent.state === 'over' ? 'text-danger' : 'text-text-muted'
                }`}
              >
                {spent.state === 'over'
                  ? `Dépassé de ${formatCents(spent.deltaCents)}`
                  : `Il reste ${formatCents(spent.deltaCents)}`}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AttachmentGroup({
  icon: Icon,
  label,
  count,
  onOpen,
}: {
  icon: typeof FileText;
  label: string;
  count: number;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex min-h-11 items-center gap-3 border border-border px-3 text-left transition-colors hover:border-border-strong"
    >
      <Icon size={15} strokeWidth={1.75} className="flex-shrink-0 text-text-muted" />
      <span className="flex-1 text-sm text-text-primary">{label}</span>
      <span
        className={`font-mono text-[11px] tabular-nums ${
          count > 0 ? 'text-text-primary' : 'text-text-muted'
        }`}
      >
        {count}
      </span>
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mt-3 block first:mt-0">
      <span className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-text-muted">
        {label}
      </span>
      {children}
    </label>
  );
}
