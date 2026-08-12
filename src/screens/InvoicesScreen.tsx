import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  Building2,
  Check,
  FileSpreadsheet,
  Plus,
  Printer,
  Send,
  Trash2,
  Undo2,
  X,
} from 'lucide-react';
import { useClients } from '../state/useClients';
import {
  emptyLine,
  formatDay,
  formatShortDay,
  invoiceTotals,
  isOverdue,
  isoDay,
  partyFromClient,
  useInvoices,
  VAT_RATES,
} from '../state/useInvoices';
import {
  centsToInput,
  eurosToCents,
  formatCents,
  formatCentsCompact,
  formatVatRate,
  lineAmounts,
} from '../lib/money';
import { InvoicePrintPortal } from '../assistant/InvoicePrintPortal';
import { FecExportModal } from '../components/invoices/FecExportModal';
import { ProjectPicker, ProjectTag } from '../components/projects/ProjectPicker';
import { staggerContainer, staggerItem } from '../lib/transitions';
import type { BillingIdentity, Client, Invoice, InvoiceLine, InvoiceStatus } from '../shared/api';
import { metaOf } from '../lib/records';

/**
 * Facturation.
 *
 * L'écran est construit autour d'une seule idée : à tout moment, on doit
 * pouvoir répondre à « qui me doit de l'argent, et depuis quand ». D'où le
 * bandeau de trois chiffres en tête — encaissé sur l'année, en attente, en
 * retard — avant même la liste, et d'où le fait que « en retard » se calcule à
 * l'affichage plutôt que de dormir dans un champ qui serait faux dès le
 * lendemain.
 *
 * Le rouge n'apparaît qu'à un seul endroit, les impayés dont l'échéance est
 * passée : c'est la seule situation de cet écran qui appelle une action.
 */

const STATUS_LABEL: Record<InvoiceStatus, string> = {
  draft: 'Brouillon',
  issued: 'À encaisser',
  paid: 'Encaissée',
  cancelled: 'Annulée',
};

type Filter = 'all' | InvoiceStatus | 'overdue';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'Toutes' },
  { value: 'draft', label: 'Brouillons' },
  { value: 'issued', label: 'À encaisser' },
  { value: 'overdue', label: 'En retard' },
  { value: 'paid', label: 'Encaissées' },
  { value: 'cancelled', label: 'Annulées' },
];

export function InvoicesScreen() {
  const { clients } = useClients();
  const {
    invoices,
    identity,
    identityComplete,
    duplicateNumbers,
    summary,
    saveIdentity,
    createDraft,
    updateDraft,
    issue,
    markPaid,
    markUnpaid,
    cancel,
    deleteDraft,
  } = useInvoices();

  const location = useLocation();
  const navigate = useNavigate();

  const [filter, setFilter] = useState<Filter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingIdentity, setEditingIdentity] = useState(false);
  const [exportingFec, setExportingFec] = useState(false);
  const [printing, setPrinting] = useState<Invoice | null>(null);

  /*
    Une facture créée depuis la fiche client (« Facturer ce devis ») arrive
    avec son id dans l'état de navigation : l'ouvrir directement évite de
    demander à quelqu'un qui vient de cliquer « facturer » de retrouver dans
    une liste ce qu'il vient de créer.
  */
  useEffect(() => {
    const state = location.state as { openInvoiceId?: string } | null;
    if (state?.openInvoiceId) {
      setSelectedId(state.openInvoiceId);
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.state, location.pathname, navigate]);

  const today = isoDay();

  const visible = useMemo(() => {
    if (filter === 'all') return invoices;
    if (filter === 'overdue') return invoices.filter((inv) => isOverdue(inv, today));
    return invoices.filter((inv) => inv.status === filter);
  }, [invoices, filter, today]);

  const selected = useMemo(
    () => invoices.find((inv) => inv.id === selectedId) ?? null,
    [invoices, selectedId],
  );

  const newInvoice = () => {
    const first = clients[0];
    const id = createDraft({
      clientId: first?.id ?? 0,
      billTo: partyFromClient(first),
    });
    setSelectedId(id);
    setFilter('all');
  };

  return (
    <section className="screen-h flex flex-col gap-4">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">
            Facturation
          </h1>
          {/*
            Deux longueurs plutôt qu'une coupée : « DEVIS, ENCAI… » sur
            téléphone n'informait de rien et donnait l'impression d'un texte
            qui déborde.
          */}
          <p className="mt-1 truncate font-mono text-[10px] uppercase tracking-widest text-text-muted sm:text-xs">
            {invoices.length} document{invoices.length > 1 ? 's' : ''}
            <span className="hidden sm:inline"> · devis, encaissements, relances</span>
          </p>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          {/*
            L'export comptable vit à côté des coordonnées de facturation plutôt
            que dans les Paramètres : c'est ici qu'on est quand le comptable
            réclame l'exercice, et un export enterré dans un autre écran ne se
            retrouve pas le jour où il devient urgent.
          */}
          <button
            type="button"
            onClick={() => setExportingFec(true)}
            title="Export comptable (FEC)"
            aria-label="Export comptable (FEC)"
            className="flex h-11 w-11 items-center justify-center border border-border text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary md:h-9 md:w-9"
          >
            <FileSpreadsheet size={16} strokeWidth={1.75} />
          </button>
          <button
            type="button"
            onClick={() => setEditingIdentity(true)}
            title="Coordonnées de facturation"
            aria-label="Coordonnées de facturation"
            className="flex h-11 w-11 items-center justify-center border border-border text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary md:h-9 md:w-9"
          >
            <Building2 size={16} strokeWidth={1.75} />
          </button>
          <button
            type="button"
            onClick={newInvoice}
            disabled={clients.length === 0}
            className="flex h-11 items-center gap-2 bg-accent px-3 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover disabled:opacity-40 md:h-9"
          >
            <Plus size={16} strokeWidth={2.25} />
            <span className="hidden sm:inline">Nouvelle facture</span>
            <span className="sm:hidden">Facture</span>
          </button>
        </div>
      </div>

      <MoneyStrip summary={summary} />

      {!identityComplete && (
        <button
          type="button"
          onClick={() => setEditingIdentity(true)}
          className="flex items-center gap-2.5 border border-warning/50 bg-warning-muted px-3 py-2 text-left transition-colors hover:border-warning"
        >
          <AlertTriangle size={15} strokeWidth={2} className="flex-shrink-0 text-warning" />
          <span className="min-w-0 flex-1 text-xs leading-tight text-text-primary">
            <strong className="font-semibold">Coordonnées de facturation incomplètes.</strong> Raison
            sociale, adresse et SIRET sont obligatoires sur une facture — sans eux, l’émission reste
            bloquée.
          </span>
        </button>
      )}

      {duplicateNumbers.length > 0 && (
        <div
          role="alert"
          className="flex items-center gap-2.5 border border-danger/50 bg-danger-muted px-3 py-2"
        >
          <AlertTriangle size={15} strokeWidth={2} className="flex-shrink-0 text-danger" />
          <span className="min-w-0 flex-1 text-xs leading-tight text-text-primary">
            <strong className="font-semibold">
              Numéro{duplicateNumbers.length > 1 ? 's' : ''} en double :{' '}
              {duplicateNumbers.join(', ')}.
            </strong>{' '}
            Deux appareils ont émis en même temps hors ligne. Annulez l’une des deux et réémettez-la.
          </span>
        </div>
      )}

      <div className="flex flex-shrink-0 gap-1.5 overflow-x-auto pb-0.5">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            // 44 px de haut sur téléphone : un filtre se tape au pouce comme
            // le reste. La hauteur retombe à l'aise du curseur au-delà de `md`.
            className={`flex min-h-11 flex-shrink-0 items-center border px-2.5 font-mono text-[10px] uppercase tracking-widest transition-colors md:min-h-0 md:py-1.5 ${
              filter === f.value
                ? 'border-border-strong bg-accent-muted text-text-primary'
                : 'border-border text-text-muted hover:text-text-secondary'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 md:grid-cols-[320px_1fr]">
        {/*
          Sur téléphone la liste occupe tout l'écran et le détail vient
          par-dessus : une grille à une colonne empilerait un formulaire de
          facture sous une liste de factures, et il faudrait défiler à l'aveugle
          entre les deux.
        */}
        {/*
          Une seule classe d'affichage à la fois. Écrire `flex … hidden md:flex`
          ne marche PAS : `hidden` et `flex` ont la même spécificité, et c'est
          l'ordre dans la feuille générée qui tranche, pas l'ordre dans
          l'attribut — mesuré, la liste restait affichée sous le détail sur
          téléphone.
        */}
        <div
          className={`min-h-0 flex-col border border-border bg-surface ${
            selected ? 'hidden md:flex' : 'flex'
          }`}
        >
          <div className="flex-shrink-0 border-b border-border px-4 py-3 font-mono text-[11px] uppercase tracking-widest text-text-secondary">
            {visible.length} document{visible.length > 1 ? 's' : ''}
          </div>
          <motion.div
            variants={staggerContainer}
            initial="initial"
            animate="animate"
            className="min-h-0 flex-1 divide-y divide-border/60 overflow-y-auto"
          >
            {visible.length === 0 ? (
              <p className="p-4 font-mono text-[11px] uppercase tracking-widest text-text-muted">
                {clients.length === 0
                  ? 'Créez d’abord une fiche client'
                  : filter === 'all'
                    ? 'Aucune facture'
                    : 'Rien dans ce filtre'}
              </p>
            ) : (
              visible.map((invoice) => (
                <InvoiceRow
                  key={invoice.id}
                  invoice={invoice}
                  today={today}
                  active={invoice.id === selectedId}
                  onSelect={() => setSelectedId(invoice.id)}
                />
              ))
            )}
          </motion.div>
        </div>

        {selected ? (
          <InvoiceDetail
            key={selected.id}
            invoice={selected}
            identity={identity}
            identityComplete={identityComplete}
            clients={clients}
            today={today}
            onBack={() => setSelectedId(null)}
            onUpdate={(patch) => updateDraft(selected.id, patch)}
            onIssue={() => issue(selected.id)}
            onMarkPaid={(date, method) => markPaid(selected.id, date, method)}
            onMarkUnpaid={() => markUnpaid(selected.id)}
            onCancel={(reason) => cancel(selected.id, reason)}
            onDelete={() => {
              deleteDraft(selected.id);
              setSelectedId(null);
            }}
            onPrint={() => setPrinting(selected)}
            onEditIdentity={() => setEditingIdentity(true)}
          />
        ) : (
          <div className="hidden items-center justify-center border border-border bg-surface font-mono text-xs uppercase tracking-widest text-text-muted md:flex">
            Sélectionnez une facture
          </div>
        )}
      </div>

      <AnimatePresence>
        {editingIdentity && (
          <IdentityModal
            identity={identity}
            onSave={saveIdentity}
            onClose={() => setEditingIdentity(false)}
          />
        )}
        {exportingFec && (
          <FecExportModal
            invoices={invoices}
            identity={identity}
            onClose={() => setExportingFec(false)}
          />
        )}
      </AnimatePresence>

      {printing && (
        <InvoicePrintPortal
          invoice={printing}
          identity={identity}
          onDone={() => setPrinting(null)}
        />
      )}
    </section>
  );
}

/* ----------------------------------------------------------------- résumé -- */

function MoneyStrip({
  summary,
}: {
  summary: {
    collectedCents: number;
    outstandingCents: number;
    overdueCents: number;
    overdueCount: number;
    year: string;
  };
}) {
  return (
    <div className="grid flex-shrink-0 grid-cols-3 gap-px border border-border bg-border">
      <Tile label={`Encaissé ${summary.year}`} value={formatCentsCompact(summary.collectedCents)} />
      <Tile label="En attente" value={formatCentsCompact(summary.outstandingCents)} />
      <Tile
        label={summary.overdueCount > 0 ? `En retard · ${summary.overdueCount}` : 'En retard'}
        value={formatCentsCompact(summary.overdueCents)}
        alert={summary.overdueCents > 0}
      />
    </div>
  );
}

function Tile({ label, value, alert = false }: { label: string; value: string; alert?: boolean }) {
  return (
    <div className="bg-surface px-3 py-2.5">
      <p className="truncate font-mono text-[9px] uppercase tracking-[0.18em] text-text-muted">
        {label}
      </p>
      <p
        className={`mt-1 truncate text-base font-semibold tabular-nums sm:text-lg ${
          alert ? 'text-danger' : 'text-text-primary'
        }`}
      >
        {value}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ liste -- */

function InvoiceRow({
  invoice,
  today,
  active,
  onSelect,
}: {
  invoice: Invoice;
  today: string;
  active: boolean;
  onSelect: () => void;
}) {
  const totals = invoiceTotals(invoice);
  const late = isOverdue(invoice, today);

  return (
    <motion.button
      variants={staggerItem}
      type="button"
      onClick={onSelect}
      className={`flex w-full min-h-11 items-center gap-3 px-4 py-3 text-left transition-colors ${
        active ? 'bg-accent-muted' : 'hover:bg-surface-hover'
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {/*
            Un brouillon n'a pas de numéro, et répéter « Brouillon » ici alors
            que la pastille le dit déjà juste à côté ne renseignait sur rien.
            Sa date de création, elle, répond à la question qu'on se pose
            devant une liste de brouillons : lequel date de quand.
          */}
          <span className="truncate font-mono text-[11px] text-text-secondary">
            {invoice.number || `Créée le ${formatShortDay(invoice.createdAt)}`}
          </span>
          <StatusPill invoice={invoice} late={late} />
        </div>
        <p className="mt-0.5 truncate text-sm text-text-primary">
          {invoice.billTo.company || invoice.billTo.name || 'Sans client'}
        </p>
        <p className="mt-0.5 truncate font-mono text-[10px] uppercase tracking-widest text-text-muted">
          {invoice.status === 'paid'
            ? `Encaissée le ${formatDay(invoice.paidAt)}`
            : invoice.dueAt
              ? `Échéance ${formatDay(invoice.dueAt)}`
              : '—'}
        </p>
      </div>
      <span
        className={`flex-shrink-0 text-sm font-semibold tabular-nums ${
          late ? 'text-danger' : 'text-text-primary'
        }`}
      >
        {formatCentsCompact(totals.grossCents)}
      </span>
    </motion.button>
  );
}

function StatusPill({ invoice, late }: { invoice: Invoice; late: boolean }) {
  const label = late ? 'En retard' : metaOf(STATUS_LABEL, invoice.status, 'Brouillon');
  const tone = late
    ? 'border-danger/60 text-danger'
    : invoice.status === 'paid'
      ? 'border-success/60 text-success'
      : invoice.status === 'cancelled'
        ? 'border-border text-text-muted line-through'
        : 'border-border text-text-muted';
  return (
    <span
      className={`flex-shrink-0 border px-1.5 py-px font-mono text-[9px] uppercase tracking-widest ${tone}`}
    >
      {label}
    </span>
  );
}

/* ----------------------------------------------------------------- détail -- */

function InvoiceDetail({
  invoice,
  identity,
  identityComplete,
  clients,
  today,
  onBack,
  onUpdate,
  onIssue,
  onMarkPaid,
  onMarkUnpaid,
  onCancel,
  onDelete,
  onPrint,
  onEditIdentity,
}: {
  invoice: Invoice;
  identity: BillingIdentity;
  identityComplete: boolean;
  clients: Client[];
  today: string;
  onBack: () => void;
  onUpdate: (patch: Partial<Invoice>) => void;
  onIssue: () => string | null;
  onMarkPaid: (date: string, method: string) => void;
  onMarkUnpaid: () => void;
  onCancel: (reason: string) => void;
  onDelete: () => void;
  onPrint: () => void;
  onEditIdentity: () => void;
}) {
  const draft = invoice.status === 'draft';
  const totals = invoiceTotals(invoice);
  const late = isOverdue(invoice, today);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [paying, setPaying] = useState(false);
  const [paidAt, setPaidAt] = useState(today);
  const [paymentMethod, setPaymentMethod] = useState('Virement');
  const [issueError, setIssueError] = useState('');

  const setLine = (id: string, patch: Partial<InvoiceLine>) => {
    onUpdate({ lines: invoice.lines.map((l) => (l.id === id ? { ...l, ...patch } : l)) });
  };

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
        <div className="min-w-0 flex-1">
          <p className="truncate font-mono text-[11px] uppercase tracking-widest text-text-secondary">
            {invoice.number ? `Facture ${invoice.number}` : 'Brouillon'}
          </p>
          <p className="truncate font-mono text-[9px] uppercase tracking-widest text-text-muted">
            {draft
              ? 'Modifiable — non émise'
              : `Émise le ${formatDay(invoice.issuedAt)} · document figé`}
          </p>
        </div>
        {!draft && (
          <button
            type="button"
            onClick={onPrint}
            title="Imprimer / exporter en PDF"
            aria-label="Imprimer / exporter en PDF"
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center border border-border text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary md:h-9 md:w-9"
          >
            <Printer size={15} strokeWidth={1.75} />
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3 md:p-4">
        {late && (
          <p className="mb-3 border border-danger/50 bg-danger-muted px-3 py-2 text-xs leading-tight text-text-primary">
            <strong className="font-semibold">Échéance dépassée</strong> — attendue le{' '}
            {formatDay(invoice.dueAt)}.
          </p>
        )}
        {invoice.status === 'cancelled' && (
          <p className="mb-3 border border-border px-3 py-2 text-xs leading-tight text-text-secondary">
            <strong className="font-semibold text-text-primary">Facture annulée.</strong> Son numéro
            reste pris : la séquence légale ne doit pas comporter de trou.
            {invoice.cancelReason && ` Motif : ${invoice.cancelReason}`}
          </p>
        )}
        {invoice.status === 'paid' && (
          <p className="mb-3 border border-success/50 px-3 py-2 text-xs leading-tight text-text-secondary">
            <strong className="font-semibold text-text-primary">Encaissée</strong> le{' '}
            {formatDay(invoice.paidAt)}
            {invoice.paymentMethod ? ` — ${invoice.paymentMethod}` : ''}.
          </p>
        )}

        {/* -------------------------------------------------------- client -- */}
        <Field label="Client">
          {draft ? (
            <select
              value={invoice.clientId}
              onChange={(e) => {
                const client = clients.find((c) => c.id === Number(e.target.value));
                onUpdate({
                  clientId: Number(e.target.value),
                  // L'adresse déjà saisie sur la facture survit au changement
                  // de client : elle n'existe pas sur la fiche client, donc la
                  // recopier depuis `partyFromClient` l'effacerait.
                  billTo: { ...partyFromClient(client), address: invoice.billTo.address },
                });
              }}
              className="input-focus min-h-11 w-full border border-border bg-bg px-3 text-sm text-text-primary outline-none"
            >
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.company ? `${c.company} — ${c.name}` : c.name}
                </option>
              ))}
            </select>
          ) : (
            <p className="text-sm text-text-primary">
              {invoice.billTo.company || invoice.billTo.name || '—'}
            </p>
          )}
        </Field>

        {draft && (
          <Field label="Adresse de facturation du client">
            <textarea
              rows={2}
              value={invoice.billTo.address}
              onChange={(e) => onUpdate({ billTo: { ...invoice.billTo, address: e.target.value } })}
              placeholder="12 rue …, 75000 Paris"
              className="input-focus w-full resize-none border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none"
            />
          </Field>
        )}

        <Field label={draft ? 'Échéance de règlement' : 'Échéance'}>
          {draft ? (
            <input
              type="date"
              value={invoice.dueAt}
              onChange={(e) => onUpdate({ dueAt: e.target.value })}
              className="input-focus min-h-11 w-full border border-border bg-bg px-3 text-sm text-text-primary outline-none"
            />
          ) : (
            <p className="text-sm text-text-primary">{formatDay(invoice.dueAt) || '—'}</p>
          )}
        </Field>

        {/* --------------------------------------------------------- lignes -- */}
        <p className="mb-2 mt-4 font-mono text-[10px] uppercase tracking-widest text-text-muted">
          Prestations
        </p>
        <div className="flex flex-col gap-2">
          {invoice.lines.map((line) => (
            <LineEditor
              key={line.id}
              line={line}
              editable={draft}
              vatExempt={identity.vatExempt}
              onChange={(patch) => setLine(line.id, patch)}
              onRemove={
                invoice.lines.length > 1
                  ? () => onUpdate({ lines: invoice.lines.filter((l) => l.id !== line.id) })
                  : undefined
              }
            />
          ))}
        </div>

        {draft && (
          <button
            type="button"
            onClick={() => onUpdate({ lines: [...invoice.lines, emptyLine()] })}
            className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 border border-dashed border-border font-mono text-[10px] uppercase tracking-widest text-text-muted transition-colors hover:border-border-strong hover:text-text-secondary"
          >
            <Plus size={13} strokeWidth={2} />
            Ajouter une ligne
          </button>
        )}

        {/* --------------------------------------------------------- totaux -- */}
        <div className="mt-4 border-t border-border pt-3">
          <Row label="Total HT" value={formatCents(totals.netCents)} />
          {!identity.vatExempt &&
            totals.vatBuckets.map((bucket) => (
              <Row
                key={bucket.rate}
                label={`TVA ${formatVatRate(bucket.rate)}`}
                value={formatCents(bucket.vatCents)}
                muted
              />
            ))}
          <Row
            label={identity.vatExempt ? 'Total net' : 'Total TTC'}
            value={formatCents(identity.vatExempt ? totals.netCents : totals.grossCents)}
            strong
          />
          {identity.vatExempt && (
            <p className="mt-1 text-right font-mono text-[9px] uppercase tracking-widest text-text-muted">
              TVA non applicable · art. 293 B du CGI
            </p>
          )}
        </div>

        {/*
          Sur une facture émise SANS note, la section entière disparaît : un
          intitulé suivi d'un tiret n'apprend rien et fait juste descendre le
          reste de l'écran.
        */}
        {/*
          Rattachement au projet (A.3). Modifiable tant que la facture est un
          brouillon ; une facture émise est figée, celui-ci compris.
        */}
        {draft ? (
          <div className="mt-3">
            <ProjectPicker
              value={invoice.projectId}
              onChange={(projectId) => onUpdate({ projectId: projectId || undefined })}
            />
          </div>
        ) : (
          invoice.projectId && (
            <Field label="Projet">
              <ProjectTag projectId={invoice.projectId} />
            </Field>
          )
        )}

        {draft ? (
          <Field label="Notes portées sur la facture">
            <textarea
              rows={3}
              value={invoice.notes}
              onChange={(e) => onUpdate({ notes: e.target.value })}
              placeholder="Conditions particulières, référence de commande…"
              className="input-focus w-full resize-none border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none"
            />
          </Field>
        ) : (
          invoice.notes && (
            <Field label="Notes portées sur la facture">
              <p className="whitespace-pre-wrap text-sm text-text-secondary">{invoice.notes}</p>
            </Field>
          )
        )}
      </div>

      {/* --------------------------------------------------------- actions -- */}
      <div className="flex flex-shrink-0 flex-col gap-2 border-t border-border p-3 md:p-4">
        {issueError && <p className="text-xs leading-tight text-danger">{issueError}</p>}

        {draft && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                if (!identityComplete) {
                  setIssueError(
                    'Complétez d’abord vos coordonnées de facturation : raison sociale, adresse et SIRET.',
                  );
                  onEditIdentity();
                  return;
                }
                if (invoice.lines.every((l) => !l.label.trim())) {
                  setIssueError('Chaque ligne doit porter une désignation.');
                  return;
                }
                setIssueError('');
                if (!onIssue()) setIssueError('Émission refusée : la facture est incomplète.');
              }}
              className="flex min-h-11 flex-1 items-center justify-center gap-2 bg-accent px-3 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover"
            >
              <Send size={15} strokeWidth={2.25} />
              Émettre la facture
            </button>
            <button
              type="button"
              onClick={() => (confirmDelete ? onDelete() : setConfirmDelete(true))}
              onBlur={() => setConfirmDelete(false)}
              aria-label="Supprimer le brouillon"
              title="Supprimer le brouillon"
              className={`flex min-h-11 items-center justify-center gap-2 border px-3 text-xs uppercase tracking-wider transition-colors ${
                confirmDelete
                  ? 'border-danger bg-danger-muted text-danger'
                  : 'border-border text-text-muted hover:text-danger'
              }`}
            >
              <Trash2 size={14} strokeWidth={2} />
              {confirmDelete ? 'Confirmer' : ''}
            </button>
          </div>
        )}

        {invoice.status === 'issued' && !paying && !cancelling && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPaying(true)}
              className="flex min-h-11 flex-1 items-center justify-center gap-2 bg-accent px-3 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover"
            >
              <Check size={15} strokeWidth={2.5} />
              Marquer encaissée
            </button>
            <button
              type="button"
              onClick={() => setCancelling(true)}
              className="flex min-h-11 items-center justify-center gap-2 border border-border px-3 text-xs uppercase tracking-wider text-text-muted transition-colors hover:text-text-primary"
            >
              <Ban size={14} strokeWidth={2} />
              Annuler
            </button>
          </div>
        )}

        {paying && (
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <input
                type="date"
                value={paidAt}
                onChange={(e) => setPaidAt(e.target.value)}
                aria-label="Date d’encaissement"
                className="input-focus min-h-11 flex-1 border border-border bg-bg px-3 text-sm text-text-primary outline-none"
              />
              <input
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                aria-label="Moyen de règlement"
                placeholder="Virement"
                className="input-focus min-h-11 flex-1 border border-border bg-bg px-3 text-sm text-text-primary outline-none"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  onMarkPaid(paidAt, paymentMethod);
                  setPaying(false);
                }}
                className="flex min-h-11 flex-1 items-center justify-center bg-accent px-3 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover"
              >
                Confirmer l’encaissement
              </button>
              <button
                type="button"
                onClick={() => setPaying(false)}
                className="flex min-h-11 items-center justify-center border border-border px-3 text-xs uppercase tracking-wider text-text-muted hover:text-text-primary"
              >
                Retour
              </button>
            </div>
          </div>
        )}

        {cancelling && (
          <div className="flex flex-col gap-2">
            <input
              autoFocus
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Motif de l’annulation (obligatoire)"
              className="input-focus min-h-11 w-full border border-border bg-bg px-3 text-sm text-text-primary outline-none"
            />
            <div className="flex gap-2">
              <button
                type="button"
                disabled={!cancelReason.trim()}
                onClick={() => {
                  onCancel(cancelReason.trim());
                  setCancelling(false);
                  setCancelReason('');
                }}
                className="flex min-h-11 flex-1 items-center justify-center border border-danger bg-danger-muted px-3 text-sm font-semibold text-danger transition-colors disabled:opacity-40"
              >
                Annuler la facture
              </button>
              <button
                type="button"
                onClick={() => setCancelling(false)}
                className="flex min-h-11 items-center justify-center border border-border px-3 text-xs uppercase tracking-wider text-text-muted hover:text-text-primary"
              >
                Retour
              </button>
            </div>
          </div>
        )}

        {invoice.status === 'paid' && (
          <button
            type="button"
            onClick={onMarkUnpaid}
            className="flex min-h-11 items-center justify-center gap-2 border border-border px-3 text-xs uppercase tracking-wider text-text-muted transition-colors hover:text-text-primary"
          >
            <Undo2 size={14} strokeWidth={2} />
            Repasser en attente
          </button>
        )}
      </div>
    </div>
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

function Row({
  label,
  value,
  strong = false,
  muted = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1">
      <span
        className={`font-mono text-[10px] uppercase tracking-widest ${
          muted ? 'text-text-muted' : 'text-text-secondary'
        }`}
      >
        {label}
      </span>
      <span
        className={`tabular-nums ${
          strong ? 'text-lg font-bold text-text-primary' : 'text-sm text-text-secondary'
        }`}
      >
        {value}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------- une ligne -- */

function LineEditor({
  line,
  editable,
  vatExempt,
  onChange,
  onRemove,
}: {
  line: InvoiceLine;
  editable: boolean;
  vatExempt: boolean;
  onChange: (patch: Partial<InvoiceLine>) => void;
  onRemove?: () => void;
}) {
  /*
    Le prix se saisit en euros et se stocke en centimes. Le champ garde donc sa
    propre chaîne tant qu'il est en cours de frappe : convertir à chaque touche
    ferait disparaître la virgule dès qu'on la tape, et retaper « 1 200,5 »
    donnerait « 1200.5 » puis « 1200.50 » sous les doigts.
  */
  const [priceText, setPriceText] = useState(() => centsToInput(line.unitPriceCents));
  const [editingPrice, setEditingPrice] = useState(false);
  useEffect(() => {
    if (!editingPrice) setPriceText(centsToInput(line.unitPriceCents));
  }, [line.unitPriceCents, editingPrice]);

  // Même règle d'arrondi que les totaux et que le document imprimé.
  const amount = lineAmounts(line.quantity, line.unitPriceCents, line.vatRate).netCents;

  if (!editable) {
    return (
      <div className="flex items-baseline justify-between gap-3 border-b border-border/60 pb-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-text-primary">{line.label || '—'}</p>
          <p className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
            {line.quantity.toString().replace('.', ',')} × {formatCents(line.unitPriceCents)}
            {vatExempt ? '' : ` · TVA ${formatVatRate(line.vatRate)}`}
          </p>
        </div>
        <span className="flex-shrink-0 text-sm tabular-nums text-text-primary">
          {formatCents(amount)}
        </span>
      </div>
    );
  }

  return (
    <div className="border border-border p-2">
      <div className="flex items-center gap-2">
        <input
          value={line.label}
          onChange={(e) => onChange({ label: e.target.value })}
          placeholder="Désignation de la prestation"
          className="input-focus min-h-11 min-w-0 flex-1 border border-border bg-bg px-2.5 text-sm text-text-primary outline-none"
        />
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label="Retirer la ligne"
            className="flex h-11 w-9 flex-shrink-0 items-center justify-center text-text-muted transition-colors hover:text-danger"
          >
            <X size={15} strokeWidth={2} />
          </button>
        )}
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2">
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[9px] uppercase tracking-widest text-text-muted">Qté</span>
          <input
            type="number"
            min={0}
            step="0.5"
            value={line.quantity}
            onChange={(e) => onChange({ quantity: Number(e.target.value) })}
            className="input-focus min-h-11 w-full border border-border bg-bg px-2 text-sm tabular-nums text-text-primary outline-none"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[9px] uppercase tracking-widest text-text-muted">
            P.U. HT
          </span>
          <input
            inputMode="decimal"
            value={priceText}
            onFocus={() => setEditingPrice(true)}
            onChange={(e) => {
              setPriceText(e.target.value);
              onChange({ unitPriceCents: eurosToCents(e.target.value) });
            }}
            onBlur={() => setEditingPrice(false)}
            placeholder="0,00"
            className="input-focus min-h-11 w-full border border-border bg-bg px-2 text-sm tabular-nums text-text-primary outline-none"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[9px] uppercase tracking-widest text-text-muted">TVA</span>
          <select
            value={line.vatRate}
            disabled={vatExempt}
            onChange={(e) => onChange({ vatRate: Number(e.target.value) })}
            className="input-focus min-h-11 w-full border border-border bg-bg px-2 text-sm text-text-primary outline-none disabled:opacity-50"
          >
            {VAT_RATES.map((rate) => (
              <option key={rate} value={rate}>
                {formatVatRate(rate)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="mt-1.5 text-right font-mono text-[10px] uppercase tracking-widest text-text-muted">
        Ligne : {formatCents(amount)} HT
      </p>
    </div>
  );
}

/* --------------------------------------------------------- identité légale -- */

const IDENTITY_FIELDS: {
  key: keyof BillingIdentity;
  label: string;
  placeholder?: string;
  required?: boolean;
  multiline?: boolean;
}[] = [
  { key: 'legalName', label: 'Raison sociale', placeholder: 'Syraagensy', required: true },
  { key: 'address', label: 'Adresse', placeholder: '12 rue …\n75000 Paris', required: true, multiline: true },
  { key: 'siret', label: 'SIRET', placeholder: '000 000 000 00000', required: true },
  { key: 'legalForm', label: 'Forme juridique', placeholder: 'SASU, EI, auto-entrepreneur…' },
  { key: 'capital', label: 'Capital social', placeholder: '1 000 €' },
  { key: 'rcsCity', label: 'RCS (ville)', placeholder: 'Paris' },
  { key: 'vatNumber', label: 'N° TVA intracommunautaire', placeholder: 'FR00000000000' },
  { key: 'email', label: 'E-mail', placeholder: 'contact@…' },
  { key: 'phone', label: 'Téléphone' },
  { key: 'iban', label: 'IBAN' },
  { key: 'bic', label: 'BIC' },
];

function IdentityModal({
  identity,
  onSave,
  onClose,
}: {
  identity: BillingIdentity;
  onSave: (patch: Partial<BillingIdentity>) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<BillingIdentity>(identity);

  const set = (patch: Partial<BillingIdentity>) => setForm((prev) => ({ ...prev, ...patch }));

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
      />
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 12 }}
        transition={{ type: 'spring', stiffness: 420, damping: 32 }}
        className="relative flex max-h-[88vh] w-full max-w-lg flex-col border border-border-strong bg-surface"
      >
        <div className="flex flex-shrink-0 items-center justify-between border-b border-border px-4 py-3">
          <h2 className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-text-secondary">
            <Building2 size={14} strokeWidth={1.75} />
            Coordonnées de facturation
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="flex h-9 w-9 items-center justify-center text-text-secondary hover:text-text-primary"
          >
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <p className="mb-3 text-xs leading-relaxed text-text-secondary">
            Ces informations apparaissent sur chaque facture émise. La raison sociale, l’adresse et
            le SIRET sont des mentions obligatoires : sans elles, le document n’a pas de valeur.
          </p>

          {IDENTITY_FIELDS.map((field) => (
            <label key={field.key} className="mt-3 block first:mt-0">
              <span className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-text-muted">
                {field.label}
                {field.required && <span className="text-danger"> *</span>}
              </span>
              {field.multiline ? (
                <textarea
                  rows={2}
                  value={String(form[field.key] ?? '')}
                  onChange={(e) => set({ [field.key]: e.target.value } as Partial<BillingIdentity>)}
                  placeholder={field.placeholder}
                  className="input-focus w-full resize-none border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none"
                />
              ) : (
                <input
                  value={String(form[field.key] ?? '')}
                  onChange={(e) => set({ [field.key]: e.target.value } as Partial<BillingIdentity>)}
                  placeholder={field.placeholder}
                  className="input-focus min-h-11 w-full border border-border bg-bg px-3 text-sm text-text-primary outline-none"
                />
              )}
            </label>
          ))}

          <div className="mt-4 border-t border-border pt-3">
            <button
              type="button"
              onClick={() => set({ vatExempt: !form.vatExempt })}
              className="flex min-h-11 w-full items-center gap-3 text-left"
            >
              <span
                className={`flex h-5 w-5 flex-shrink-0 items-center justify-center border ${
                  form.vatExempt ? 'border-accent bg-accent text-bg' : 'border-border'
                }`}
              >
                {form.vatExempt && <Check size={13} strokeWidth={3} />}
              </span>
              <span className="min-w-0 flex-1 text-xs leading-tight text-text-primary">
                Franchise en base de TVA
                <span className="block text-text-muted">
                  Aucune TVA sur les factures ; la mention « art. 293 B du CGI » est ajoutée.
                </span>
              </span>
            </button>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-text-muted">
                Délai de règlement (jours)
              </span>
              <input
                type="number"
                min={0}
                value={form.paymentTermDays}
                onChange={(e) => set({ paymentTermDays: Number(e.target.value) })}
                className="input-focus min-h-11 w-full border border-border bg-bg px-3 text-sm tabular-nums text-text-primary outline-none"
              />
            </label>
            <label className="block">
              <span className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-text-muted">
                Pénalités de retard (%/an)
              </span>
              <input
                type="number"
                min={0}
                step="0.1"
                value={form.latePenaltyRate}
                onChange={(e) => set({ latePenaltyRate: Number(e.target.value) })}
                className="input-focus min-h-11 w-full border border-border bg-bg px-3 text-sm tabular-nums text-text-primary outline-none"
              />
            </label>
          </div>
        </div>

        <div className="flex flex-shrink-0 gap-2 border-t border-border p-3">
          <button
            type="button"
            onClick={() => {
              onSave(form);
              onClose();
            }}
            className="min-h-11 flex-1 bg-accent px-3 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover"
          >
            Enregistrer
          </button>
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 border border-border px-4 text-xs uppercase tracking-wider text-text-muted transition-colors hover:text-text-primary"
          >
            Fermer
          </button>
        </div>
      </motion.div>
    </div>
  );
}
