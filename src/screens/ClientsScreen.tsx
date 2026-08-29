import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScreenHeader } from '../components/ScreenHeader';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  ArrowUpRight,
  FileText,
  Globe,
  ImagePlus,
  Info,
  Mail,
  Phone,
  Plus,
  Printer,
  ReceiptEuro,
  X,
} from 'lucide-react';
import { useClients } from '../state/useClients';
import { relativeTime } from '../lib/time';
import { staggerContainer, staggerItem } from '../lib/transitions';
import type { DerivedSite } from '../state/RemoteSitesContext';
import { useExclusive, useLinkedSites, useSitePanelLink } from '@edition/exclusive';
import { StatusBadge } from '../components/StatusBadge';
import {
  computeClientHealth,
  computeClientHealthBreakdown,
  CLIENT_HEALTH_META,
  CLIENT_HEALTH_EXPLAINER,
} from '../lib/clientHealth';
import { Skeleton } from '../components/Skeleton';
import { SaveIndicator } from '../components/SaveIndicator';
import { ConfirmDelete } from '../components/ConfirmDelete';
import type { ReportDraft } from '../state/useReports';
import { QuotePrintPortal } from '../assistant/QuotePrintPortal';
import { useInvoices } from '../state/useInvoices';
import { metaOf } from '../lib/records';
import type {
  Client,
  ClientStatus,
  CreateClientInput,
  CreateQuoteInput,
  Invoice,
  PaymentStatus,
  Quote,
  QuoteStatus,
  UpdateClientInput,
} from '../shared/api';
import { FirstRun } from '../components/EmptyState';
import { useFermetureEchap } from '../lib/useFermetureEchap';

const STATUS_META: Record<
  ClientStatus,
  { label: string; dot: string; text: string }
> = {
  active: { label: 'ACTIF', dot: 'bg-success', text: 'text-text-primary' },
  paused: {
    label: 'EN PAUSE',
    dot: 'border border-text-muted bg-transparent',
    text: 'text-text-secondary',
  },
  prospect: { label: 'PROSPECT', dot: 'bg-text-muted', text: 'text-text-secondary' },
};

const STATUS_ORDER: ClientStatus[] = ['active', 'paused', 'prospect'];

const QUOTE_STATUS_META: Record<QuoteStatus, { label: string; dot: string }> = {
  draft: { label: 'BROUILLON', dot: 'bg-text-muted' },
  sent: { label: 'ENVOYÉ', dot: 'border border-text-secondary bg-transparent' },
  accepted: { label: 'ACCEPTÉ', dot: 'bg-success' },
  refused: { label: 'REFUSÉ', dot: 'bg-danger' },
};
const QUOTE_STATUS_ORDER: QuoteStatus[] = ['draft', 'sent', 'accepted', 'refused'];

const PAYMENT_META: Record<PaymentStatus, { label: string; dot: string; text: string }> = {
  unpaid: { label: 'Non facturé', dot: 'bg-text-muted', text: 'text-text-secondary' },
  pending: { label: 'En attente', dot: 'bg-warning', text: 'text-text-secondary' },
  paid: { label: 'Payé', dot: 'bg-success', text: 'text-text-primary' },
  late: { label: 'En retard', dot: 'bg-danger', text: 'text-danger' },
};
const PAYMENT_ORDER: PaymentStatus[] = ['unpaid', 'pending', 'paid', 'late'];

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

export function ClientsScreen() {
  const { sites } = useLinkedSites();
  const location = useLocation();
  // A @client mention (or any navigation) can request a specific client be
  // opened via router state: navigate('/clients', { state: { focusClientId } }).
  const focusClientId = (location.state as { focusClientId?: number } | null)?.focusClientId ?? null;
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);

  // One implementation for both platforms — see src/state/useClients.ts. The
  // previous version read `bridge().clients`, which was SQLite on Electron and
  // localStorage on the web: two different databases, never the same data.
  const {
    clients,
    quotes,
    ready,
    createClient: createClientRecord,
    updateClient,
    addClientEvent,
    removeClient: removeClientRecord,
    createQuote: createQuoteRecord,
    updateQuote,
    removeQuote: removeQuoteRecord,
  } = useClients();
  const loading = !ready;

  // Select the first client once the list arrives, without fighting a choice
  // the operator has already made.
  useEffect(() => {
    setSelectedId((prev) => prev ?? clients[0]?.id ?? null);
  }, [clients]);

  // Honour a requested client focus once the list is loaded (and again if the
  // navigation target changes while the screen stays mounted).
  useEffect(() => {
    if (focusClientId != null && clients.some((c) => c.id === focusClientId)) {
      setSelectedId(focusClientId);
    }
  }, [focusClientId, clients]);

  const selected = useMemo(
    () => clients.find((c) => c.id === selectedId) ?? null,
    [clients, selectedId],
  );

  const patch = async (id: number, p: UpdateClientInput) => {
    await updateClient(id, p);
  };

  const addEvent = async (id: number, title: string, detail: string) => {
    await addClientEvent({ clientId: id, title, detail });
  };

  const createClient = async (input: CreateClientInput) => {
    const created = await createClientRecord(input);
    setSelectedId(created.id);
    setAdding(false);
  };

  const createQuote = async (input: CreateQuoteInput) => createQuoteRecord(input);

  const patchQuote = async (id: number, p: { status?: QuoteStatus; paymentStatus?: PaymentStatus }) => {
    await updateQuote(id, p);
  };

  const removeQuote = async (id: number) => {
    await removeQuoteRecord(id);
  };

  const removeClient = async (id: number) => {
    setSelectedId((prev) => (prev === id ? null : prev));
    await removeClientRecord(id);
  };

  return (
    <section className={`flex flex-col gap-4 ${clients.length === 0 ? '' : 'screen-h'}`}>
      <ScreenHeader
        eyebrow="Poste de travail · Clients"
        title="Clients"
        description="La relation et les missions, fiche par fiche."
        stats={[
          { label: 'Fiches', value: clients.length },
          {
            label: 'Actifs',
            value: clients.filter((c) => c.status === 'active').length,
          },
          {
            label: 'Prospects',
            value: clients.filter((c) => c.status === 'prospect').length,
            title: 'Des fiches ouvertes qui ne sont pas encore devenues des missions.',
          },
        ]}
        actions={
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover"
          >
            <Plus size={16} strokeWidth={2.25} />
            Nouveau client
          </button>
        }
      />

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 md:grid-cols-[300px_1fr]">
        <ClientList
          clients={clients}
          sites={sites}
          loading={loading}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
        {selected ? (
          <ClientDetail
            key={selected.id}
            client={selected}
            sites={sites}
            quotes={quotes.filter((q) => q.clientId === selected.id)}
            onPatch={patch}
            onAddEvent={addEvent}
            onCreateQuote={createQuote}
            onPatchQuote={patchQuote}
            onRemoveQuote={removeQuote}
            onRemoveClient={removeClient}
          />
        ) : (
          /*
            CLIENTS (BLOC A) — « AUCUN CLIENT » en capitales monospace, centré
            dans un panneau qui occupait toute la colonne de détail. Le vide
            avait la taille et le poids d'une fiche client remplie. Il devient
            une ligne, et il dit ce que l'écran sert à faire.
          */
          <div className="p-4">
            {loading ? (
              <p className="eyebrow">Chargement…</p>
            ) : (
              <FirstRun
                title="Aucune fiche client"
                action={{ label: 'Créer une fiche', onClick: () => setAdding(true) }}
              >
                Une fiche rassemble les coordonnées, les échanges, les devis et l’état des
                paiements. C’est le point de rattachement de la facturation.
              </FirstRun>
            )}
          </div>
        )}
      </div>

      {adding && (
        <NewClientModal onClose={() => setAdding(false)} onCreate={createClient} />
      )}
    </section>
  );
}

function ClientList({
  clients,
  sites,
  loading,
  selectedId,
  onSelect,
}: {
  clients: Client[];
  sites: DerivedSite[];
  loading: boolean;
  selectedId: number | null;
  onSelect: (id: number) => void;
}) {
  return (
    <div className="flex min-h-0 flex-col border border-border bg-surface">
      <div className="border-b border-border px-4 py-3 font-mono text-[11px] uppercase tracking-widest text-text-secondary">
        Répertoire
      </div>
      <motion.div
        variants={staggerContainer}
        initial="initial"
        animate="animate"
        className="flex-1 divide-y divide-border/60 overflow-y-auto"
      >
        {loading ? (
          <div className="space-y-2 p-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-1 py-1.5">
                <Skeleton className="h-9 w-9 flex-shrink-0 rounded-sm" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-2/3 rounded-sm" />
                  <Skeleton className="h-2.5 w-1/3 rounded-sm" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          clients.map((client) => {
            // Seconde ligne de défense : le décodage garantit déjà un statut du
            // domaine (voir useClients), mais un écran ne doit jamais mourir sur
            // une table absente — c'est ce `undefined.label` qui faisait tomber
            // TOUT l'écran Clients sur une seule fiche abîmée.
            const meta = metaOf(STATUS_META, client.status, STATUS_META.prospect);
            const health = CLIENT_HEALTH_META[computeClientHealth(client, sites)];
            const active = client.id === selectedId;
            return (
              <motion.button
                key={client.id}
                variants={staggerItem}
                type="button"
                onClick={() => onSelect(client.id)}
                className={`relative flex w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-150 ${
                  active ? 'bg-surface-hover' : 'hover:bg-surface-hover'
                }`}
              >
                {active && (
                  <span className="absolute left-0 top-0 h-full w-0.5 bg-accent" />
                )}
                <Avatar client={client} size={38} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-text-primary">
                    {client.name}
                  </p>
                  <p className="truncate font-mono text-[11px] text-text-muted">
                    {client.company || '—'}
                  </p>
                </div>
                <span
                  className="flex flex-col items-center gap-1.5"
                  title={`Statut : ${meta.label}\nSanté relation : ${health.label} — ${health.hint}`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                  <span className={`h-1.5 w-1.5 rounded-full ${health.dot}`} />
                </span>
              </motion.button>
            );
          })
        )}
      </motion.div>
    </div>
  );
}

function Avatar({ client, size }: { client: Client; size: number }) {
  if (client.imageDataUrl) {
    return (
      <img
        src={client.imageDataUrl}
        alt={client.name}
        style={{ width: size, height: size }}
        className="flex-shrink-0 rounded-sm object-cover"
      />
    );
  }
  return (
    <span
      style={{ width: size, height: size }}
      className="flex flex-shrink-0 items-center justify-center rounded-sm border border-border bg-bg font-mono text-xs font-semibold text-text-secondary"
    >
      {initials(client.name)}
    </span>
  );
}

function ClientDetail({
  client,
  sites,
  quotes,
  onPatch,
  onAddEvent,
  onCreateQuote,
  onPatchQuote,
  onRemoveQuote,
  onRemoveClient,
}: {
  client: Client;
  sites: DerivedSite[];
  quotes: Quote[];
  onPatch: (id: number, p: UpdateClientInput) => Promise<void>;
  onAddEvent: (id: number, title: string, detail: string) => Promise<void>;
  onCreateQuote: (input: CreateQuoteInput) => Promise<Quote>;
  onPatchQuote: (id: number, p: { status?: QuoteStatus; paymentStatus?: PaymentStatus }) => Promise<void>;
  onRemoveQuote: (id: number) => Promise<void>;
  onRemoveClient: (id: number) => Promise<void>;
}) {
  const { SITES_ENABLED } = useExclusive();
  return (
    <div className="min-h-0 overflow-y-auto border border-border bg-surface">
      <ClientHeader client={client} sites={sites} onPatch={onPatch} onRemove={onRemoveClient} />
      <div className="grid grid-cols-1 gap-6 p-6 lg:grid-cols-2">
        <div className="flex flex-col gap-6">
          <ContactBlock client={client} onPatch={onPatch} />
          {SITES_ENABLED && <LinkedSitesBlock client={client} sites={sites} onPatch={onPatch} />}
          <NotesBlock client={client} onPatch={onPatch} />
        </div>
        <div className="flex flex-col gap-6">
          <QuotesBlock client={client} quotes={quotes} onCreate={onCreateQuote} onPatch={onPatchQuote} onRemove={onRemoveQuote} />
          <TimelineBlock client={client} onAddEvent={onAddEvent} />
        </div>
      </div>
    </div>
  );
}

/** Pre-fills a report draft from a client's fiche (B1). */
function clientReportDraft(client: Client): ReportDraft {
  const lines: string[] = [];
  if (client.company) lines.push(`**Société :** ${client.company}`);
  if (client.email) lines.push(`**Email :** ${client.email}`);
  if (client.phone) lines.push(`**Téléphone :** ${client.phone}`);
  lines.push('', client.notes?.trim() ? client.notes.trim() : '_Pas de notes._');
  return {
    type: 'client',
    title: `Rapport — ${client.name}`,
    body: lines.join('\n'),
    links: [{ kind: 'client', id: String(client.id), label: client.name }],
  };
}

function ClientHeader({
  client,
  sites,
  onPatch,
  onRemove,
}: {
  client: Client;
  sites: DerivedSite[];
  onPatch: (id: number, p: UpdateClientInput) => Promise<void>;
  onRemove: (id: number) => Promise<void>;
}) {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const breakdown = computeClientHealthBreakdown(client, sites);
  const health = CLIENT_HEALTH_META[breakdown.health];
  const [healthOpen, setHealthOpen] = useState(false);

  const onFile = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () =>
      onPatch(client.id, { imageDataUrl: String(reader.result) });
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex flex-col gap-4 border-b border-border p-6 sm:flex-row sm:items-center">
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className="group relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-sm border border-border-strong bg-bg"
        title="Changer l’image"
      >
        {client.imageDataUrl ? (
          <img
            src={client.imageDataUrl}
            alt={client.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center font-mono text-xl font-semibold text-text-secondary">
            {initials(client.name)}
          </span>
        )}
        <span className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 transition-opacity group-hover:opacity-100">
          <ImagePlus size={18} strokeWidth={1.75} className="text-white" />
        </span>
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0])}
      />

      {/*
        UN ÉCART ENTRE DEUX CHAMPS MODIFIABLES SUR PLACE.

        Voir `docs/PRINCIPE-CONFORT.md`. Le nom et la société se suivaient sans
        le moindre espace : deux zones cliquables collées, 0 px mesuré. On
        atteignait les 24 px de WCAG par une hauteur minimale, mais cliquer
        entre les deux restait un tirage au sort entre « modifier le nom » et
        « modifier la société ».
      */}
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <InlineField
          value={client.name}
          onSave={(v) => onPatch(client.id, { name: v })}
          className="text-xl font-bold text-text-primary"
          placeholder="Nom du client"
        />
        <InlineField
          value={client.company}
          onSave={(v) => onPatch(client.id, { company: v })}
          className="font-mono text-sm text-text-secondary"
          placeholder="Société"
        />
        <button
          type="button"
          onClick={() => setHealthOpen((v) => !v)}
          className="group/health mt-2 inline-flex items-center gap-1.5 border border-border px-2 py-1 transition-colors hover:border-border-strong"
          title={CLIENT_HEALTH_EXPLAINER}
        >
          <span className={`h-2 w-2 rounded-full ${health.dot}`} />
          <span className="font-mono text-[10px] uppercase tracking-wider text-text-muted">Santé relation</span>
          <span className={`text-xs font-semibold ${health.text}`}>{health.label}</span>
          <Info size={11} strokeWidth={2} className="text-text-muted" />
        </button>

        {healthOpen && (
          <div className="mt-2 max-w-md border border-border bg-bg p-3">
            <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-text-muted">{CLIENT_HEALTH_EXPLAINER}</p>
            <div className="flex flex-col gap-1.5">
              {breakdown.factors.map((f) => (
                <div key={f.label} className="flex items-center justify-between gap-3 text-xs">
                  <span className="text-text-secondary">{f.label}</span>
                  <span
                    className={`flex items-center gap-1.5 font-medium ${
                      f.tone === 'bad' ? 'text-danger' : f.tone === 'medium' ? 'text-warning' : 'text-text-primary'
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        f.tone === 'bad' ? 'bg-danger' : f.tone === 'medium' ? 'bg-warning' : 'bg-success'
                      }`}
                    />
                    {f.value}
                  </span>
                </div>
              ))}
            </div>
            {breakdown.toImprove.length > 0 && (
              <div className="mt-2.5 border-t border-border/60 pt-2">
                <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-text-muted">Pour l’améliorer</p>
                <ul className="flex flex-col gap-1">
                  {breakdown.toImprove.map((t, i) => (
                    <li key={i} className="flex gap-1.5 text-[11px] leading-snug text-text-secondary">
                      <ArrowRight size={11} strokeWidth={2} className="mt-0.5 flex-shrink-0 text-text-muted" />
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {breakdown.toImprove.length === 0 && (
              <p className="mt-2 text-[11px] text-success">Relation au vert — rien à faire pour l’instant.</p>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-shrink-0 flex-col items-end gap-2">
        <StatusSelector
          value={client.status}
          onChange={(status) => onPatch(client.id, { status })}
        />
        <button
          type="button"
          onClick={() => navigate('/reports', { state: { reportDraft: clientReportDraft(client) } })}
          className="flex items-center gap-1.5 border border-accent/40 bg-accent/10 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wider text-accent transition-colors hover:bg-accent/20"
        >
          <FileText size={11} strokeWidth={2} />
          Faire un rapport
        </button>
        <ConfirmDelete
          onConfirm={() => onRemove(client.id)}
          label="Supprimer le client"
          className="border border-border px-1"
        />
      </div>
    </div>
  );
}

function LinkedSitesBlock({
  client,
  sites,
  onPatch,
}: {
  client: Client;
  sites: DerivedSite[];
  onPatch: (id: number, p: UpdateClientInput) => Promise<void>;
}) {
  const { openSite } = useSitePanelLink();

  const toggle = (siteId: string) => {
    const next = client.linkedSiteIds.includes(siteId)
      ? client.linkedSiteIds.filter((id) => id !== siteId)
      : [...client.linkedSiteIds, siteId];
    onPatch(client.id, { linkedSiteIds: next });
  };

  return (
    <div>
      <BlockTitle>Sites liés</BlockTitle>
      {sites.length === 0 ? (
        <p className="text-xs text-text-muted">
          Aucun site enregistré. La santé du client se base uniquement sur la date du dernier contact.
        </p>
      ) : (
        /*
          UNE LIGNE PAR SITE, PAS UNE SOUPE DE PUCES
          ══════════════════════════════════════════

          Voir `docs/PRINCIPE-CONFORT.md`. Cette liste était une rangée de
          puces qui passaient à la ligne, et chaque puce contenait DEUX cibles
          collées l'une à l'autre : le nom (qui lie ou délie le site) et la
          flèche (qui ouvre sa fiche). 0 px d'écart horizontal mesuré. On
          atteignait les 24 px de WCAG en agrandissant les zones, mais deux
          cibles collées ne se visent pas confortablement pour autant — on vise
          juste, ou on déclenche la voisine. Le seuil est un plancher légal, pas
          un objectif de confort.

          Une puce ne tenait de toute façon pas la charge : douze sites
          donnaient trois lignes de pastilles où plus rien ne se lisait.

          Chaque site est donc une LIGNE : le geste principal — lier ou délier —
          prend toute la largeur disponible à gauche, l'ouverture de la fiche
          est un bouton séparé à droite, et un vrai écart les sépare. Les lignes
          sont espacées entre elles, et l'état se lit en bout de ligne, toujours
          au même endroit.
        */
        <ul className="flex flex-col gap-1.5">
          {sites.map((site) => {
            const linked = client.linkedSiteIds.includes(site.id);
            return (
              <li
                key={site.id}
                className={`flex items-center gap-2 rounded-lg border px-1 py-1 ${
                  linked ? 'border-border-strong bg-accent-muted' : 'border-border'
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggle(site.id)}
                  aria-pressed={linked}
                  title={linked ? 'Délier ce site de la fiche' : 'Lier ce site à la fiche'}
                  className={`flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-md px-2 text-left text-xs transition-colors hover:bg-surface-hover ${
                    linked ? 'text-text-primary' : 'text-text-muted'
                  }`}
                >
                  <Globe size={13} strokeWidth={1.75} className="flex-shrink-0" />
                  <span className="truncate">{site.name}</span>
                </button>
                {linked && (
                  <>
                    <StatusBadge status={site.status} />
                    {/*
                      Séparé du nom par l'écart de la ligne, et assez grand pour
                      qu'on le vise sans réfléchir : c'est le seul moyen
                      d'ouvrir la fiche d'un site depuis ici.
                    */}
                    <button
                      type="button"
                      onClick={() => openSite(site.id)}
                      aria-label={`Voir la fiche du site ${site.name ?? ''}`.trim()}
                      title="Voir la fiche du site"
                      className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-surface-hover hover:text-text-primary"
                    >
                      <ArrowUpRight size={16} strokeWidth={1.75} />
                    </button>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function StatusSelector({
  value,
  onChange,
}: {
  value: ClientStatus;
  onChange: (s: ClientStatus) => void;
}) {
  return (
    <div className="flex flex-shrink-0 border border-border">
      {STATUS_ORDER.map((status) => {
        const meta = STATUS_META[status];
        const active = status === value;
        return (
          <button
            key={status}
            type="button"
            onClick={() => onChange(status)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wider transition-colors ${
              active
                ? 'bg-accent-muted text-text-primary'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
            {meta.label}
          </button>
        );
      })}
    </div>
  );
}

function ContactBlock({
  client,
  onPatch,
}: {
  client: Client;
  onPatch: (id: number, p: UpdateClientInput) => Promise<void>;
}) {
  return (
    <div>
      <BlockTitle>Contact</BlockTitle>
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2.5 border border-border bg-bg px-3 py-2">
          <Mail size={14} strokeWidth={1.75} className="flex-shrink-0 text-text-muted" />
          <InlineField
            value={client.email}
            onSave={(v) => onPatch(client.id, { email: v })}
            className="w-full font-mono text-sm text-text-primary"
            placeholder="email@exemple.com"
          />
        </div>
        <div className="flex items-center gap-2.5 border border-border bg-bg px-3 py-2">
          <Phone size={14} strokeWidth={1.75} className="flex-shrink-0 text-text-muted" />
          <InlineField
            value={client.phone}
            onSave={(v) => onPatch(client.id, { phone: v })}
            className="w-full font-mono text-sm text-text-primary"
            placeholder="+33 …"
          />
        </div>
      </div>
    </div>
  );
}

function NotesBlock({
  client,
  onPatch,
}: {
  client: Client;
  onPatch: (id: number, p: UpdateClientInput) => Promise<void>;
}) {
  const [notes, setNotes] = useState(client.notes);
  const [saved, setSaved] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setNotes(client.notes);
    setSaved(true);
  }, [client.id, client.notes]);

  const onChange = (value: string) => {
    setNotes(value);
    setSaved(false);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      onPatch(client.id, { notes: value }).then(() => setSaved(true));
    }, 600);
  };

  return (
    <div className="flex flex-1 flex-col">
      <BlockTitle aside={<SaveIndicator saved={saved} />}>
        Notes
      </BlockTitle>
      <textarea
        value={notes}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Notes libres sur le client…"
        className="input-focus min-h-[120px] flex-1 resize-none border border-border bg-bg p-3 text-sm leading-relaxed text-text-primary outline-none placeholder:text-text-muted"
      />
    </div>
  );
}

function TimelineBlock({
  client,
  onAddEvent,
}: {
  client: Client;
  onAddEvent: (id: number, title: string, detail: string) => Promise<void>;
}) {
  const [title, setTitle] = useState('');

  const submit = () => {
    const t = title.trim();
    if (!t) return;
    onAddEvent(client.id, t, '');
    setTitle('');
  };

  return (
    <div className="flex flex-col">
      <BlockTitle>Historique</BlockTitle>
      <div className="mb-3 flex gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="Ajouter un échange / une mission…"
          className="input-focus flex-1 border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none placeholder:text-text-muted"
        />
        <button
          type="button"
          onClick={submit}
          disabled={!title.trim()}
          // Un « + » seul ne dit rien à l'oreille : le champ à côté porte le
          // sens, mais un lecteur d'écran annonce les deux séparément.
          aria-label="Ajouter cet échange"
          className="flex items-center justify-center border border-border-strong bg-surface px-3 text-text-primary transition-colors hover:bg-surface-hover disabled:opacity-40"
        >
          <Plus size={16} strokeWidth={2} />
        </button>
      </div>

      <ol className="relative">
        {client.events.length === 0 && (
          <li className="font-mono text-xs text-text-muted">Aucun échange.</li>
        )}
        {client.events.map((event, i) => (
          <li key={event.id} className="relative flex gap-3 pb-4 last:pb-0">
            {i !== client.events.length - 1 && (
              <span className="absolute left-[3px] top-3 bottom-0 w-px bg-border" />
            )}
            <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-text-secondary" />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <p className="truncate text-sm font-medium text-text-primary">
                  {event.title}
                </p>
                <time className="flex-shrink-0 font-mono text-[10px] uppercase tracking-wide text-text-muted">
                  {relativeTime(event.date).replace('il y a ', '')}
                </time>
              </div>
              {event.detail && (
                <p className="text-xs text-text-secondary">{event.detail}</p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function QuotesBlock({
  client,
  quotes,
  onCreate,
  onPatch,
  onRemove,
}: {
  client: Client;
  quotes: Quote[];
  onCreate: (input: CreateQuoteInput) => Promise<Quote>;
  onPatch: (id: number, p: { status?: QuoteStatus; paymentStatus?: PaymentStatus }) => Promise<void>;
  onRemove: (id: number) => Promise<void>;
}) {
  const [creating, setCreating] = useState(false);
  const [printing, setPrinting] = useState<Quote | null>(null);
  const navigate = useNavigate();
  const { invoices, createFromQuote } = useInvoices();

  /*
    La facture née d'un devis, s'il y en a une. C'est elle qui décide de ce que
    montre la ligne de devis : tant qu'elle n'existe pas, le devis propose de
    facturer ; dès qu'elle existe, c'est ELLE qui dit où en est l'argent, et le
    suivi de paiement du devis n'a plus voix au chapitre — deux réponses
    différentes à « est-ce payé ? » sur le même écran, c'est une de trop.
  */
  const invoiceOf = (quote: Quote) => invoices.find((inv) => inv.quoteId === quote.id);

  return (
    <div>
      <BlockTitle
        aside={
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="-my-1.5 flex items-center gap-1 py-1.5 font-mono text-[10px] uppercase tracking-widest text-text-secondary hover:text-text-primary"
          >
            <Plus size={12} strokeWidth={2.25} />
            Nouveau devis
          </button>
        }
      >
        Devis
      </BlockTitle>
      {quotes.length === 0 ? (
        <p className="text-xs text-text-muted">Aucun devis pour ce client.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {quotes.map((quote) => (
            <QuoteRow
              key={quote.id}
              quote={quote}
              invoice={invoiceOf(quote)}
              onPatch={onPatch}
              onPrint={() => setPrinting(quote)}
              onRemove={() => onRemove(quote.id)}
              onInvoice={() => {
                const existing = invoiceOf(quote);
                const id = existing ? existing.id : createFromQuote(quote, client);
                navigate('/facturation', { state: { openInvoiceId: id } });
              }}
            />
          ))}
        </div>
      )}

      {creating && (
        <NewQuoteModal client={client} onClose={() => setCreating(false)} onCreate={onCreate} />
      )}
      {printing && (
        <QuotePrintPortal quote={printing} client={client} onDone={() => setPrinting(null)} />
      )}
    </div>
  );
}

function QuoteRow({
  quote,
  invoice,
  onPatch,
  onPrint,
  onRemove,
  onInvoice,
}: {
  quote: Quote;
  invoice: Invoice | undefined;
  onPatch: (id: number, p: { status?: QuoteStatus; paymentStatus?: PaymentStatus }) => Promise<void>;
  onPrint: () => void;
  onRemove: () => void;
  onInvoice: () => void;
}) {
  const { QUOTE_OFFERS } = useExclusive();
  const offer = QUOTE_OFFERS.find((o) => o.id === quote.trackerTier);
  const statusMeta = metaOf(QUOTE_STATUS_META, quote.status, QUOTE_STATUS_META.draft);
  const paymentMeta = metaOf(PAYMENT_META, quote.paymentStatus, PAYMENT_META.unpaid);

  return (
    <div className="border border-border bg-bg p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-text-primary">{quote.title}</p>
          <p className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
            {offer?.name ?? quote.trackerTier} · {quote.priceEuro.toLocaleString('fr-FR')} €
          </p>
        </div>
        <div className="flex flex-shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={onPrint}
            aria-label="Imprimer / exporter en PDF"
            className="flex h-6 w-6 items-center justify-center rounded text-text-muted hover:bg-surface-hover hover:text-text-primary"
          >
            <Printer size={14} strokeWidth={1.75} />
          </button>
          <ConfirmDelete onConfirm={onRemove} label="Supprimer le devis" />
        </div>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-1.5">
          <span className="font-mono text-[9px] uppercase tracking-widest text-text-muted">Statut</span>
          <select
            value={quote.status}
            onChange={(e) => onPatch(quote.id, { status: e.target.value as QuoteStatus })}
            className="input-focus border border-border bg-surface px-1.5 py-1 font-mono text-[10px] uppercase tracking-wider text-text-secondary outline-none"
          >
            {QUOTE_STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {QUOTE_STATUS_META[s].label}
              </option>
            ))}
          </select>
          <span className={`h-1.5 w-1.5 rounded-full ${statusMeta.dot}`} />
        </label>

        {/*
          Le suivi de paiement du devis disparaît dès qu'une facture existe :
          c'est la facture qui fait foi, et laisser les deux côte à côte
          reviendrait à proposer de contredire un document comptable depuis un
          menu déroulant.
        */}
        {invoice ? (
          <button
            type="button"
            onClick={onInvoice}
            className="flex items-center gap-1.5 border border-border px-1.5 py-1 font-mono text-[10px] uppercase tracking-wider text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
          >
            <ReceiptEuro size={11} strokeWidth={2} />
            {invoice.number ? `Facture ${invoice.number}` : 'Facture (brouillon)'}
          </button>
        ) : (
          <label className="flex items-center gap-1.5">
            <span className="font-mono text-[9px] uppercase tracking-widest text-text-muted">Paiement</span>
            <select
              value={quote.paymentStatus}
              onChange={(e) => onPatch(quote.id, { paymentStatus: e.target.value as PaymentStatus })}
              className="input-focus border border-border bg-surface px-1.5 py-1 font-mono text-[10px] uppercase tracking-wider text-text-secondary outline-none"
            >
              {PAYMENT_ORDER.map((s) => (
                <option key={s} value={s}>
                  {PAYMENT_META[s].label}
                </option>
              ))}
            </select>
            <span className={`h-1.5 w-1.5 rounded-full ${paymentMeta.dot}`} />
          </label>
        )}

        {/*
          Facturer n'est proposé qu'une fois le devis ACCEPTÉ : émettre une
          facture sur une proposition encore en discussion est une erreur qu'on
          ne peut pas défaire, puisqu'une facture émise ne s'efface pas.
        */}
        {!invoice && quote.status === 'accepted' && (
          <button
            type="button"
            onClick={onInvoice}
            className="ml-auto flex items-center gap-1.5 border border-border-strong px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-text-primary transition-colors hover:bg-accent-muted"
          >
            <ReceiptEuro size={11} strokeWidth={2} />
            Facturer
          </button>
        )}
      </div>
    </div>
  );
}

function NewQuoteModal({
  client,
  onClose,
  onCreate,
}: {
  client: Client;
  onClose: () => void;
  onCreate: (input: CreateQuoteInput) => Promise<Quote>;
}) {
  // Échap ferme, comme partout ailleurs. Voir lib/useFermetureEchap.
  useFermetureEchap(true, onClose);

  const { QUOTE_OFFERS } = useExclusive();
  const [step, setStep] = useState(0);
  const [trackerTier, setTrackerTier] = useState(QUOTE_OFFERS[0]?.id ?? '');
  const [priceEuro, setPriceEuro] = useState('');
  const [title, setTitle] = useState('');
  const [detail, setDetail] = useState('');

  const steps = ['Offre', 'Tarif', 'Mission'];

  const submit = async () => {
    if (!title.trim() || !priceEuro) return;
    await onCreate({
      clientId: client.id,
      title: title.trim(),
      detail: detail.trim(),
      trackerTier,
      priceEuro: Number(priceEuro),
    });
    onClose();
  };

  /*
    LA FENÊTRE PREND LE FOCUS EN S'OUVRANT.

    MESURÉ : elle s'ouvrait sans le prendre. La personne au clavier restait
    derrière le voile, à tabuler dans une page qu'elle ne voit plus, sans rien
    pour lui dire où elle se trouve — et le piège de `pileCalques.ts` ne peut
    pas la rattraper : il ne retient le focus que lorsqu'il y est déjà entré.

    Pas d'`autoFocus` sur un champ : la première étape n'en a pas, elle propose
    des offres à choisir. C'est donc le conteneur qui reçoit la main, comme
    dans `AppLauncher` — même motif, même délai, le temps que l'animation
    d'ouverture ait posé l'élément.
  */
  const panneauRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const t = window.setTimeout(() => panneauRef.current?.focus(), 60);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
      />
      <motion.div
        ref={panneauRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={`Nouveau devis pour ${client.name}`}
        initial={{ opacity: 0, scale: 0.98, y: -6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 420, damping: 32 }}
        className="relative w-full max-w-lg border border-border-strong bg-surface outline-none"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-text-secondary">
            <FileText size={14} strokeWidth={1.75} />
            Nouveau devis · {client.name}
          </h2>
          <button type="button" onClick={onClose} aria-label="Fermer" className="flex h-9 w-9 items-center justify-center text-text-secondary hover:text-text-primary">
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        <div className="flex border-b border-border">
          {steps.map((s, i) => (
            <div
              key={s}
              className={`flex-1 px-3 py-2 text-center font-mono text-[10px] uppercase tracking-widest ${
                i === step ? 'bg-accent-muted text-text-primary' : 'text-text-muted'
              }`}
            >
              {i + 1}. {s}
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-3 p-5">
          {step === 0 && (
            <div className="flex flex-col gap-2">
              <p className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
                {QUOTE_OFFERS.length > 0 ? 'Quelle offre proposer ?' : 'Quel type de prestation ?'}
              </p>
              {/*
                Sans catalogue d'offres — le cas d'une organisation cliente qui
                facture ses propres prestations — l'étape devient un intitulé
                libre. Proposer une liste vide, ou pire une liste de paliers de
                supervision, n'aurait aucun sens sur son devis.
              */}
              {QUOTE_OFFERS.length > 0 ? (
                QUOTE_OFFERS.map((offer) => (
                  <button
                    key={offer.id}
                    type="button"
                    onClick={() => setTrackerTier(offer.id)}
                    className={`flex flex-col items-start gap-0.5 border px-3 py-2.5 text-left transition-colors ${
                      trackerTier === offer.id
                        ? 'border-border-strong bg-accent-muted'
                        : 'border-border hover:border-border-strong'
                    }`}
                  >
                    <span className="text-sm font-medium text-text-primary">{offer.name}</span>
                    <span className="text-xs text-text-secondary">{offer.tagline}</span>
                  </button>
                ))
              ) : (
                <input
                  autoFocus
                  value={trackerTier}
                  onChange={(e) => setTrackerTier(e.target.value)}
                  placeholder="ex. Prestation à la journée, forfait…"
                  className="input-focus border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none"
                />
              )}
            </div>
          )}

          {step === 1 && (
            <label className="flex flex-col gap-1.5">
              <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
                Tarif de la mission (€) *
              </span>
              <input
                autoFocus
                type="number"
                min={0}
                value={priceEuro}
                onChange={(e) => setPriceEuro(e.target.value)}
                placeholder="ex. 1800"
                className="input-focus border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none"
              />
            </label>
          )}

          {step === 2 && (
            <>
              <label className="flex flex-col gap-1.5">
                <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
                  Titre de la mission *
                </span>
                <input
                  autoFocus
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="ex. Supervision annuelle + audit initial"
                  className="input-focus border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
                  Description (optionnel)
                </span>
                <textarea
                  value={detail}
                  onChange={(e) => setDetail(e.target.value)}
                  rows={3}
                  className="input-focus resize-none border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none"
                />
              </label>
            </>
          )}

          <div className="mt-1 flex justify-between gap-2">
            <button
              type="button"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0}
              className="px-3 py-2 font-mono text-[11px] uppercase tracking-wider text-text-muted hover:text-text-secondary disabled:opacity-0"
            >
              Précédent
            </button>
            {step < steps.length - 1 ? (
              <button
                type="button"
                onClick={() => setStep((s) => Math.min(steps.length - 1, s + 1))}
                disabled={step === 1 && !priceEuro}
                className="bg-accent px-4 py-2 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover disabled:opacity-40"
              >
                Suivant
              </button>
            ) : (
              <button
                type="button"
                onClick={submit}
                disabled={!title.trim() || !priceEuro}
                className="bg-accent px-4 py-2 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover disabled:opacity-40"
              >
                Créer le devis
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function BlockTitle({
  children,
  aside,
}: {
  children: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <div className="mb-2.5 flex items-center justify-between">
      <h3 className="font-mono text-[11px] uppercase tracking-widest text-text-secondary">
        {children}
      </h3>
      {aside}
    </div>
  );
}

/** Text that turns into an input on click and saves on blur/Enter. */
function InlineField({
  value,
  onSave,
  className,
  placeholder,
}: {
  value: string;
  onSave: (value: string) => void;
  className?: string;
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => setDraft(value), [value]);

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          setEditing(false);
          if (draft !== value) onSave(draft);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') {
            setDraft(value);
            setEditing(false);
          }
        }}
        placeholder={placeholder}
        className={`w-full border-b border-border-strong bg-transparent outline-none ${className ?? ''}`}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      /*
        `min-h-9` — 36 px, et non les 24 px du plancher WCAG.

        Un champ qu'on modifie en cliquant dessus est une cible qu'on vise
        plusieurs fois par fiche. `min-h-6` le faisait passer le seuil légal ;
        il ne le rendait pas confortable. Voir `docs/PRINCIPE-CONFORT.md` : le
        seuil est un plancher, pas un objectif.

        Une hauteur minimale grandit l'élément lui-même, donc elle ne mord sur
        aucun voisin — et le conteneur, lui, pose un vrai écart entre deux
        champs qui se suivent.
      */
      className={`flex min-h-9 w-full items-center truncate border-b border-transparent text-left hover:border-border ${className ?? ''} ${
        value ? '' : 'text-text-muted'
      }`}
    >
      {value || placeholder}
    </button>
  );
}

function NewClientModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (input: CreateClientInput) => Promise<void>;
}) {
  // Échap ferme, comme partout ailleurs. Voir lib/useFermetureEchap.
  useFermetureEchap(true, onClose);

  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [status, setStatus] = useState<ClientStatus>('prospect');

  const submit = () => {
    if (!name.trim()) return;
    onCreate({ name: name.trim(), company: company.trim(), status });
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
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="font-mono text-[11px] uppercase tracking-widest text-text-secondary">
            Nouveau client
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
        <div className="flex flex-col gap-3 p-5">
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
              Nom *
            </span>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              className="input-focus border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
              Société
            </span>
            <input
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              className="input-focus border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none"
            />
          </label>
          <div className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
              Statut
            </span>
            <StatusSelector value={status} onChange={setStatus} />
          </div>
          <button
            type="button"
            onClick={submit}
            disabled={!name.trim()}
            className="mt-1 bg-accent px-3 py-2.5 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover disabled:opacity-40"
          >
            Créer la fiche
          </button>
        </div>
      </motion.div>
    </div>
  );
}
