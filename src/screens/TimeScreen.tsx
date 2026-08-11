import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Pencil, Play, Plus, ReceiptEuro, Square, Timer, Trash2 } from 'lucide-react';
import { useTimeTracking } from '../state/useTimeTracking';
import { useProjects } from '../state/useProjects';
import { useClients } from '../state/useClients';
import { useInvoices, partyFromClient } from '../state/useInvoices';
import { useToast } from '../state/ToastContext';
import { isModuleEnabled } from '../data/spaces';
import {
  dayOf,
  formatClock,
  formatDayHeading,
  formatDuration,
  formatStopwatch,
  durationMs,
  isRunning,
  weekStart,
  type TimeEntry,
} from '../state/timeEngine';
import { ProjectPicker, ProjectTag } from '../components/projects/ProjectPicker';
import { ManualEntryDialog } from '../components/time/ManualEntryDialog';
import { TimeInvoiceDialog } from '../components/time/TimeInvoiceDialog';
import { uid } from '../state/SyncContext';
import { staggerContainer, staggerItem } from '../lib/transitions';

/**
 * Temps — le chronomètre d'abord, la feuille d'heures jamais.
 *
 * ## Le geste, avant tout le reste
 *
 * L'écran s'ouvre sur UN bouton, occupant toute la largeur et haut de 64 px :
 * démarrer, ou arrêter. C'est la seule chose qu'on fait dix fois par jour, et
 * c'est donc la seule chose qui a droit à cette place. Le « sur quoi » se
 * remplit avant, ou après — un chrono qu'on ne peut pas lancer sans avoir
 * rempli un formulaire est un chrono qu'on ne lance pas.
 *
 * ## Ce qui tourne est visible partout
 *
 * La période en cours est un enregistrement synchronisé (voir `timeEngine`) :
 * démarrée sur le téléphone, elle s'affiche et s'arrête depuis le poste. C'est
 * ce qui évite le classique « j'ai laissé tourner sur l'autre appareil » et
 * les huit heures fantômes du lendemain.
 */
export function TimeScreen() {
  const {
    config,
    saveConfig,
    running,
    byDay,
    summary,
    byProject,
    start,
    stop,
    addManual,
    updateEntry,
    deleteEntry,
    markInvoiced,
    billableOf,
  } = useTimeTracking();
  const { projects } = useProjects();
  const { clients } = useClients();
  const { createDraft } = useInvoices();
  const { notify } = useToast();
  const navigate = useNavigate();

  const [label, setLabel] = useState('');
  const [projectId, setProjectId] = useState('');
  const [manualOpen, setManualOpen] = useState(false);
  const [invoiceFor, setInvoiceFor] = useState<string | null>(null);
  const [editing, setEditing] = useState<TimeEntry | null>(null);

  /*
    Le battement de seconde n'existe QUE pendant qu'un chrono tourne.

    Un intervalle permanent ferait rendre l'écran soixante fois par minute pour
    afficher exactement la même chose — sur un portable, c'est de la batterie
    dépensée à ne rien changer.
  */
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [running]);

  const totals = useMemo(() => summary(now), [summary, now]);
  const monday = totals.weekStartDay;
  const perProject = useMemo(() => byProject(monday, now), [byProject, monday, now]);

  const projectTitle = (id: string) =>
    projects.find((p) => p.id === id)?.title || (id ? 'Projet supprimé' : 'Sans projet');

  const toggle = () => {
    if (running) {
      stop();
      return;
    }
    start({ label: label.trim(), projectId: projectId || undefined });
    setLabel('');
  };

  /**
   * Crée le brouillon de facture et marque les périodes comme reportées.
   *
   * Le brouillon est volontairement à UNE ligne : « Temps passé — <projet> »,
   * la quantité en heures, le prix unitaire au tarif horaire. Détailler chaque
   * période produirait une facture de quarante lignes que le client ne lira
   * pas, et l'utilisatrice peut toujours l'éclater elle-même dans Facturation.
   */
  const confirmInvoice = (values: { hours: number; rateCents: number; entryIds: string[] }) => {
    const project = projects.find((p) => p.id === invoiceFor);
    const client = clients.find((c) => c.id === project?.clientId);
    createDraft({
      clientId: client?.id ?? 0,
      billTo: partyFromClient(client),
      projectId: project?.id,
      lines: [
        {
          id: uid('line'),
          label: `Temps passé — ${project?.title || 'prestation'}`,
          quantity: values.hours,
          unitPriceCents: values.rateCents,
          vatRate: 20,
        },
      ],
    });
    markInvoiced(values.entryIds);
    // Le tarif est mémorisé pour la fois suivante : le retaper à chaque
    // facture est exactement le genre de frottement qui fait abandonner.
    if (values.rateCents !== config.hourlyRateCents) {
      saveConfig({ ...config, hourlyRateCents: values.rateCents });
    }
    notify({
      title: 'Brouillon de facture créé',
      body: 'Relisez-le dans Facturation avant de l’émettre.',
      onClick: () => navigate('/facturation'),
    });
  };

  const canInvoice = isModuleEnabled('invoices');
  const invoiceProject = invoiceFor ? projects.find((p) => p.id === invoiceFor) : undefined;

  return (
    <section className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">Temps</h1>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-text-muted sm:text-xs">
            Ce que vous passez, sans le noter à la main
          </p>
        </div>
        <button
          type="button"
          onClick={() => setManualOpen(true)}
          className="flex h-11 items-center gap-2 border border-border px-3 text-sm text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary md:h-9"
        >
          <Plus size={15} strokeWidth={2} />
          <span className="hidden sm:inline">Ajouter à la main</span>
          <span className="sm:hidden">À la main</span>
        </button>
      </header>

      {/* ------------------------------------------------- le chronomètre --- */}
      <div className="border border-border bg-surface p-4">
        {running ? (
          <>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-text-muted">
              En cours depuis {formatClock(running.startedAt)}
            </p>
            <p className="mt-1 text-4xl font-bold tabular-nums tracking-tight text-text-primary sm:text-5xl">
              {formatStopwatch(durationMs(running, now))}
            </p>
            <p className="mt-1 truncate text-sm text-text-secondary">
              {running.label || 'Sans intitulé'}
              {running.projectId ? ` · ${projectTitle(running.projectId)}` : ''}
            </p>
          </>
        ) : (
          <>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-text-muted">
              Sur quoi travaillez-vous ?
            </p>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') toggle();
              }}
              placeholder="Retouches photos, appel client… (facultatif)"
              className="input-focus mt-2 min-h-11 w-full border border-border bg-bg px-3 text-sm text-text-primary outline-none"
            />
            <ProjectPicker
              value={projectId}
              onChange={setProjectId}
              label="Projet (facultatif)"
              className="mt-3"
            />
          </>
        )}

        {/*
          Le bouton du pouce : pleine largeur, 64 px de haut, un seul mot. Sur
          un téléphone tenu d'une main, c'est la cible qu'on atteint sans
          regarder — et c'est le geste qu'on répète le plus souvent.
        */}
        <button
          type="button"
          onClick={toggle}
          className={`mt-4 flex h-16 w-full items-center justify-center gap-2.5 text-lg font-bold transition-colors ${
            running
              ? 'border border-danger bg-danger-muted text-danger hover:bg-danger/20'
              : 'bg-accent text-bg hover:bg-accent-hover'
          }`}
        >
          {running ? <Square size={20} strokeWidth={2.5} /> : <Play size={20} strokeWidth={2.5} />}
          {running ? 'Arrêter' : 'Démarrer'}
        </button>
      </div>

      {/* ---------------------------------------------------- le résumé ----- */}
      <div className="grid grid-cols-2 gap-3">
        <SummaryCard label="Aujourd’hui" value={formatDuration(totals.todayMs)} />
        <SummaryCard label="Cette semaine" value={formatDuration(totals.weekMs)} />
      </div>

      {/* --------------------------------------------------- par projet ----- */}
      {perProject.length > 0 && (
        <div className="flex flex-col gap-2.5 border border-border bg-surface p-4">
          <p className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
            Cette semaine, par projet
          </p>
          {perProject.map((row, index) => {
            const billable = row.projectId ? billableOf(row.projectId) : [];
            return (
              <ProjectBar
                key={row.projectId || 'aucun'}
                title={projectTitle(row.projectId)}
                ms={row.ms}
                share={perProject[0].ms > 0 ? row.ms / perProject[0].ms : 0}
                rank={index}
                /* Facturer n'a de sens que sur un vrai projet, et seulement
                   s'il reste des périodes terminées non encore reportées. */
                onInvoice={
                  canInvoice && row.projectId && billable.length > 0
                    ? () => setInvoiceFor(row.projectId)
                    : undefined
                }
              />
            );
          })}
        </div>
      )}

      {/* --------------------------------------------------- l'historique --- */}
      {byDay.length === 0 ? (
        <div className="border border-border bg-surface p-8 text-center">
          <Timer size={22} strokeWidth={1.5} className="mx-auto text-text-muted" />
          <p className="mt-2 text-sm text-text-secondary">Aucun temps enregistré pour l’instant.</p>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-text-muted">
            Un bouton, deux fois : au début et à la fin
          </p>
        </div>
      ) : (
        <motion.div variants={staggerContainer} initial="initial" animate="animate" className="flex flex-col gap-3">
          {byDay.map((group) => (
            <motion.div key={group.day} variants={staggerItem} className="border border-border bg-surface">
              <div className="flex items-baseline justify-between gap-2 border-b border-border px-4 py-2.5">
                <span className="font-mono text-[10px] uppercase tracking-widest text-text-secondary">
                  {formatDayHeading(group.day)}
                </span>
                <span className="font-mono text-xs tabular-nums text-text-primary">
                  {formatDuration(group.rows.reduce((sum, e) => sum + durationMs(e, now), 0))}
                </span>
              </div>
              <div className="divide-y divide-border/60">
                {group.rows.map((entry) => (
                  <EntryRow
                    key={entry.id}
                    entry={entry}
                    now={now}
                    projectName={entry.projectId ? projectTitle(entry.projectId) : ''}
                    onEdit={() => setEditing(entry)}
                    onDelete={() => deleteEntry(entry.id)}
                  />
                ))}
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}

      <AnimatePresence>
        {manualOpen && (
          <ManualEntryDialog
            defaultDay={dayOf(new Date().toISOString())}
            onSubmit={addManual}
            onClose={() => setManualOpen(false)}
          />
        )}

        {editing && (
          <EditEntryDialog
            entry={editing}
            onSave={(patch) => updateEntry(editing.id, patch)}
            onClose={() => setEditing(null)}
          />
        )}

        {invoiceFor && (
          <TimeInvoiceDialog
            projectTitle={projectTitle(invoiceFor)}
            clientName={clients.find((c) => c.id === invoiceProject?.clientId)?.name ?? ''}
            entries={billableOf(invoiceFor)}
            defaultRateCents={config.hourlyRateCents}
            onConfirm={confirmInvoice}
            onClose={() => setInvoiceFor(null)}
          />
        )}
      </AnimatePresence>

      {/* Une semaine commence le lundi — dit une fois, en bas, pour que le
          total « cette semaine » ne soit pas une devinette. */}
      <p className="font-mono text-[9px] uppercase tracking-widest text-text-muted">
        Semaine du {formatDayHeading(weekStart(dayOf(new Date(now).toISOString())))}
      </p>
    </section>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-border bg-surface p-4">
      <p className="font-mono text-[10px] uppercase tracking-widest text-text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight text-text-primary sm:text-3xl">
        {value}
      </p>
    </div>
  );
}

function ProjectBar({
  title,
  ms,
  share,
  rank,
  onInvoice,
}: {
  title: string;
  ms: number;
  share: number;
  rank: number;
  onInvoice?: () => void;
}) {
  const opacity = Math.max(0.3, 1 - rank * 0.14);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-sm text-text-primary">{title}</span>
        <div className="flex flex-shrink-0 items-center gap-2">
          <span className="font-mono text-xs tabular-nums text-text-secondary">
            {formatDuration(ms)}
          </span>
          {onInvoice && (
            <button
              type="button"
              onClick={onInvoice}
              title="Créer un brouillon de facture à partir de ce temps"
              className="flex h-8 items-center gap-1 border border-border px-2 font-mono text-[9px] uppercase tracking-widest text-text-muted transition-colors hover:border-border-strong hover:text-text-primary"
            >
              <ReceiptEuro size={12} strokeWidth={2} />
              Facturer
            </button>
          )}
        </div>
      </div>
      <div className="h-2 w-full bg-bg">
        <div className="h-full bg-accent" style={{ width: `${Math.round(share * 100)}%`, opacity }} />
      </div>
    </div>
  );
}

function EntryRow({
  entry,
  now,
  projectName,
  onEdit,
  onDelete,
}: {
  entry: TimeEntry;
  now: number;
  projectName: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const live = isRunning(entry);

  return (
    <div className="flex min-h-14 items-center gap-3 px-4 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-text-primary">
          {entry.label || (projectName ? projectName : 'Sans intitulé')}
        </p>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
          <span className="font-mono text-[9px] uppercase tracking-widest text-text-muted">
            {formatClock(entry.startedAt)}
            {entry.endedAt ? ` – ${formatClock(entry.endedAt)}` : ' · en cours'}
          </span>
          <ProjectTag projectId={entry.projectId} />
          {entry.invoicedAt && (
            <span className="border border-border px-1.5 py-px font-mono text-[9px] uppercase tracking-widest text-text-muted">
              Facturé
            </span>
          )}
        </div>
      </div>

      <span
        className={`flex-shrink-0 font-mono text-sm tabular-nums ${
          live ? 'text-accent' : 'text-text-primary'
        }`}
      >
        {formatDuration(durationMs(entry, now))}
      </span>

      <button
        type="button"
        onClick={onEdit}
        aria-label="Modifier"
        className="flex h-11 w-9 flex-shrink-0 items-center justify-center text-text-muted transition-colors hover:text-text-primary"
      >
        <Pencil size={14} strokeWidth={1.75} />
      </button>
      <button
        type="button"
        onClick={() => (confirmDelete ? onDelete() : setConfirmDelete(true))}
        onBlur={() => setConfirmDelete(false)}
        aria-label={confirmDelete ? 'Confirmer la suppression' : 'Supprimer'}
        className={`flex h-11 flex-shrink-0 items-center justify-center px-2 transition-colors ${
          confirmDelete ? 'text-danger' : 'text-text-muted hover:text-danger'
        }`}
      >
        {confirmDelete ? (
          <span className="font-mono text-[9px] uppercase tracking-widest">Sûr ?</span>
        ) : (
          <Trash2 size={14} strokeWidth={1.75} />
        )}
      </button>
    </div>
  );
}

/**
 * La correction d'une période déjà enregistrée.
 *
 * On ne corrige que l'intitulé et le projet — pas les horodatages. Retoucher
 * un début et une fin à la main, c'est réintroduire la feuille d'heures : si
 * la durée est fausse, la période se supprime et se ressaisit, ce qui laisse
 * une trace honnête au lieu d'un chiffre réécrit.
 */
function EditEntryDialog({
  entry,
  onSave,
  onClose,
}: {
  entry: TimeEntry;
  onSave: (patch: { label: string; projectId?: string }) => void;
  onClose: () => void;
}) {
  const [label, setLabel] = useState(entry.label);
  const [projectId, setProjectId] = useState(entry.projectId ?? '');

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
      />
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 24 }}
        transition={{ type: 'spring', stiffness: 420, damping: 32 }}
        className="relative flex w-full max-w-md flex-col border border-border-strong bg-surface"
      >
        <div className="border-b border-border px-4 py-3">
          <h2 className="font-mono text-[11px] uppercase tracking-widest text-text-secondary">
            Modifier ce temps
          </h2>
        </div>
        <div className="p-4">
          <label className="block">
            <span className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-text-muted">
              Sur quoi ?
            </span>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              autoFocus
              className="input-focus min-h-11 w-full border border-border bg-bg px-3 text-sm text-text-primary outline-none"
            />
          </label>
          <ProjectPicker value={projectId} onChange={setProjectId} className="mt-4" />
          <p className="mt-3 text-xs leading-relaxed text-text-secondary">
            La durée n’est pas modifiable ici : si elle est fausse, supprimez cette période et
            ressaisissez-la.
          </p>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border p-3">
          <button
            type="button"
            onClick={onClose}
            className="flex min-h-11 items-center border border-border px-3 text-sm text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={() => {
              onSave({ label: label.trim(), projectId: projectId || undefined });
              onClose();
            }}
            className="flex min-h-11 items-center bg-accent px-4 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover"
          >
            Enregistrer
          </button>
        </div>
      </motion.div>
    </div>
  );
}
