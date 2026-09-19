import React, { useEffect, useMemo, useState } from 'react';
import { ScreenHeader } from '../components/ScreenHeader';
import { serieStock } from '../lib/serieVitale';
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
  creditNotesFor,
  emptyLine,
  formatDay,
  formatShortDay,
  invoiceTotals,
  isOverdue,
  isoDay,
  netDueCents,
  partyFromClient,
  useInvoices,
  VAT_RATES,
} from '../state/useInvoices';
import { useAjmaniFocus } from '../assistant/ecranContexte';
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
import { EmptyState, FirstRun } from '../components/EmptyState';
import { useHaloSignal } from '../components/EtatEcran';
import { useFermetureEchap } from '../lib/useFermetureEchap';
import { useLangue, t as tr } from '../i18n';

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
  { value: 'issued', label: tr('hist.invoices.aEncaisser') },
  { value: 'overdue', label: 'En retard' },
  { value: 'paid', label: tr('hist.invoices.encaissees') },
  { value: 'cancelled', label: tr('hist.invoices.annulees') },
];

export function InvoicesScreen() {
  // Abonnement à la langue : les textes ci-dessous passent par `tr`, lu au rendu.
  useLangue();
  const { clients } = useClients();
  const {
    invoices,
    identity,
    identityComplete,
    duplicateNumbers,
    summary,
    saveIdentity,
    createDraft,
    createCreditNote,
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
    <section className={`flex flex-col gap-4 ${invoices.length === 0 ? '' : 'screen-h'}`}>
      {/*
        LE RELEVÉ D'ARGENT REMONTE DANS L'EN-TÊTE.

        Il vivait dans une bande de trois tuiles juste en dessous — donc deux
        rangées de chiffres l'une sur l'autre dès que l'en-tête a eu les
        siennes. Or c'est exactement ce que l'en-tête est fait pour porter :
        « ce que l'écran vaut MAINTENANT ». La bande disparaît, les trois
        chiffres restent, et la liste remonte d'autant.
      */}
      <ScreenHeader
        eyebrow={tr('hist.surtitre', { module: tr('hist.invoices.titre') })}
        title={tr('hist.invoices.titre')}
        description={tr('hist.invoices.devisEncaissementsEtRelances')}
        stats={[
          { label: `Encaissé ${summary.year}`, value: formatCentsCompact(summary.collectedCents) },
          {
            /*
              L'ATTENTE EST NETTE DU RETARD.

              `outstandingCents` contient le retard — l'en-tête affichait donc
              « en attente 10 199 » au-dessus d'une dominante qui dit
              « en attente 3 439 », deux comptes divergents sous le même mot
              sur le même écran. Les trois chiffres de l'en-tête partitionnent
              maintenant le total émis exactement comme les trois arcs.
            */
            label: 'En attente',
            value: formatCentsCompact(Math.max(0, summary.outstandingCents - summary.overdueCents)),
          },
          {
            label: summary.overdueCount > 0 ? `En retard · ${summary.overdueCount}` : 'En retard',
            value: formatCentsCompact(summary.overdueCents),
            emphasis: summary.overdueCents > 0,
            title: tr('hist.invoices.desDocumentsDontL'),
          },
          {
            // Les montants restent des nombres seuls — une somme d'euros n'est
            // pas un compte d'arrivées. C'est le NOMBRE de documents qui porte
            // la mémoire de l'activité.
            label: 'Documents',
            value: invoices.length,
            serie: serieStock(invoices.map((f) => f.createdAt), 7, new Date()),
            brut: invoices.length,
          },
        ]}
        actions={
        <div className="flex flex-shrink-0 items-center gap-2">
          {/*
            L'export comptable vit à côté des coordonnées de facturation plutôt
            que dans les Paramètres : c'est ici qu'on est quand le comptable
            réclame l'exercice, et un export enterré dans un autre écran ne se
            retrouve pas le jour où il devient urgent.
          */}
          {/*
            L'ENTRÉE VERS LES DEVIS — ici et nulle part ailleurs.

            `MODULES.md` : « Devis n'est pas un module de premier niveau : il
            vit dans Facturation. » La barre latérale ne reçoit donc PAS
            d'entrée « Devis » ; c'est cet écran qui y mène, et la barre garde
            Facturation en actif sur `/facturation/devis` (son `isActive`
            compare par préfixe de chemin).
          */}
          <button
            type="button"
            onClick={() => navigate('/facturation/devis')}
            className="flex h-11 items-center gap-2 border border-border px-3 text-sm font-semibold text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary md:h-9"
          >
            Devis
          </button>
          <button
            type="button"
            onClick={() => setExportingFec(true)}
            title="Export comptable (FEC)"
            aria-label="Export comptable (FEC)"
            className="flex h-11 w-11 items-center justify-center border border-border text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary md:h-9 md:w-9"
          >
            <FileSpreadsheet size={16} strokeWidth={1.9} />
          </button>
          <button
            type="button"
            onClick={() => setEditingIdentity(true)}
            title={tr('hist.invoices.coordonneesDeFacturation')}
            aria-label={tr('hist.invoices.coordonneesDeFacturation')}
            className="flex h-11 w-11 items-center justify-center border border-border text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary md:h-9 md:w-9"
          >
            <Building2 size={16} strokeWidth={1.9} />
          </button>
          <button
            type="button"
            onClick={newInvoice}
            disabled={clients.length === 0}
            className="flex h-11 items-center gap-2 bg-accent px-3 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover disabled:opacity-40 md:h-9"
          >
            <Plus size={16} strokeWidth={2.25} />
            <span className="hidden sm:inline">{tr('hist.invoices.nouvelleFacture')}</span>
            <span className="sm:hidden">Facture</span>
          </button>
        </div>
        }
      />

      {!identityComplete && (
        <button
          type="button"
          onClick={() => setEditingIdentity(true)}
          className="flex items-center gap-2.5 border border-warning/50 bg-warning-muted px-3 py-2 text-left transition-colors hover:border-warning"
        >
          <AlertTriangle size={15} strokeWidth={2} className="flex-shrink-0 text-warning" />
          <span className="min-w-0 flex-1 text-xs leading-tight text-text-primary">
            {/*
              L'espace entre les deux phrases est POSÉ, il ne peut pas venir du
              JSX : deux expressions collées se rendent collées, et le bandeau
              lisait « incomplètes.Raison sociale ». Repéré sur une capture de
              revue, pas à la relecture du code — l'absence d'espace ne se voit
              pas dans une ligne de 130 caractères.
            */}
            <strong className="font-semibold">{tr('hist.invoices.coordonneesDeFacturationIncompletes')}</strong>{' '}
            {tr('hist.invoices.raisonSocialeAdresseEt')}
          </span>
        </button>
      )}

      {duplicateNumbers.length > 0 && (
        <div
          role="alert"
          className="flex items-center gap-2.5 border border-border border-l-2 border-l-danger bg-surface px-3 py-2"
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

      {/*
        LA RÉPARTITION DE L'ANNÉE — l'objet dominant de cet écran (4a).

        L'en-tête portait déjà les trois montants en relevés, et c'était juste :
        ils disent ce que l'écran vaut maintenant. Mais trois nombres alignés ne
        disent pas leur PROPORTION — or c'est toute la question qu'on pose à
        Facturation : « est-ce que ça rentre ? ». La barre de masses répond d'un
        regard, et le seul ambre de l'écran marque le segment en retard, parce
        que c'est le seul des trois qui demande un geste.
      */}
      {invoices.length > 0 && !selected && (
        <MassesDeLAnnee summary={summary} invoices={invoices} today={today} onOuvrir={setSelectedId} />
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

      {/* Même correction que Projets : pas de colonne de détail sans sujet. */}
      <div
        className={`grid min-h-0 flex-1 gap-4 ${
          invoices.length === 0 ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-[320px_1fr]'
        }`}
      >
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
              /*
                FACTURATION (BLOC A) — trois cas différents disaient tous la
                même chose : une étiquette en capitales. Le premier est une
                DÉPENDANCE (pas de client, donc rien à facturer) et mérite d'être
                expliqué ; le dernier est un filtre, et n'a rien à expliquer.
              */
              <div className="px-4">
                {clients.length === 0 ? (
                  <FirstRun title={tr('hist.invoices.creezDAbordUne')}>{tr('hist.invoices.uneFactureEstToujours')}</FirstRun>
                ) : filter === 'all' ? (
                  <EmptyState>{tr('hist.invoices.aucuneFactureEmiseUn')}</EmptyState>
                ) : (
                  <EmptyState quiet>{tr('hist.invoices.rienDansCeFiltre')}</EmptyState>
                )}
              </div>
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
            invoices={invoices}
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
            onCreateCreditNote={() => setSelectedId(createCreditNote(selected))}
          />
        ) : invoices.length === 0 ? null : (
          <div className="hidden items-center justify-center border border-border bg-surface font-mono text-xs uppercase tracking-widest text-text-muted md:flex">{tr('hist.invoices.selectionnezUneFacture')}</div>
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

/**
 * LE DEMI-CERCLE DES MASSES — l'objet dominant de Facturation (11a).
 *
 * Trois montants alignés ne disent pas leur PROPORTION, et c'est toute la
 * question qu'on pose en ouvrant cet écran : « est-ce que ça rentre ? ». Les
 * trois masses de l'exercice — encaissé, en attente, en retard — sont donc
 * posées sur UN SEUL chemin, à longueur proportionnelle, épaisseur 30 px. On
 * voit la part avant de lire le montant.
 *
 * La géométrie, dans l'ordre où elle se déduit :
 *   • le tracé fait 340 px de large, épaisseur 30 px ;
 *   • le rayon est donc (340 − 30) / 2, pour que le trait ne déborde pas ;
 *   • les deux extrémités reposent à y = rayon + épaisseur/2, et la boîte
 *     descend d'une demi-épaisseur en dessous.
 *
 * Le conteneur est contraint à 340 px et centré : les calques posés en
 * `left:0; right:0` (la gravure centrale) se centreraient sinon sur une autre
 * boîte que l'arc, et la gravure partirait à côté de son cercle.
 */
const ARC_L = 340;
const ARC_EP = 30;
const ARC_R = (ARC_L - ARC_EP) / 2;
const ARC_BASE = ARC_R + ARC_EP / 2;
const ARC_H = ARC_BASE + ARC_EP / 2;
const ARC_LONGUEUR = Math.PI * ARC_R;
const ARC_CHEMIN = `M ${ARC_EP / 2} ${ARC_BASE} A ${ARC_R} ${ARC_R} 0 0 1 ${ARC_L - ARC_EP / 2} ${ARC_BASE}`;

/**
 * Découpe le chemin en arcs proportionnels.
 *
 * Le dernier arc prend EXACTEMENT ce qui reste plutôt que sa propre part
 * arrondie : sans ça, les arrondis des précédents laissent un cheveu de fond
 * entre deux masses ou font déborder le dernier. Les `stroke-dasharray`
 * somment donc rigoureusement la longueur du chemin.
 */
function decouperArc(masses: number[]): { debut: number; longueur: number }[] {
  const total = masses.reduce((s, m) => s + m, 0);
  if (total <= 0) return masses.map(() => ({ debut: 0, longueur: 0 }));
  const parts: { debut: number; longueur: number }[] = [];
  let pose = 0;
  for (let i = 0; i < masses.length; i += 1) {
    const longueur =
      i === masses.length - 1 ? ARC_LONGUEUR - pose : (masses[i] / total) * ARC_LONGUEUR;
    parts.push({ debut: pose, longueur });
    pose += longueur;
  }
  return parts;
}

/** Les douze mois glissants, en montants réellement émis. */
function douzeMois(invoices: Invoice[], aujourdHui: Date) {
  const mois: { cle: string; libelle: string; cents: number }[] = [];
  for (let i = 11; i >= 0; i -= 1) {
    const d = new Date(aujourdHui.getFullYear(), aujourdHui.getMonth() - i, 1);
    mois.push({
      cle: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      libelle: d.toLocaleDateString('fr-FR', { month: 'narrow' }),
      cents: 0,
    });
  }
  const index = new Map(mois.map((m, i) => [m.cle, i]));
  for (const inv of invoices) {
    if (inv.status === 'draft' || inv.status === 'cancelled' || inv.kind === 'creditNote') continue;
    if (!inv.issuedAt) continue;
    const i = index.get(inv.issuedAt.slice(0, 7));
    if (i === undefined) continue;
    mois[i].cents += netDueCents(inv, invoices) + (inv.status === 'paid' ? invoiceTotals(inv).grossCents - netDueCents(inv, invoices) : 0);
  }
  return mois;
}

const MOIS_H = 92;

/**
 * La gravure centrale, à la largeur du demi-disque creux.
 *
 * Le creux fait 2 × (rayon − épaisseur/2) = 280 px, et une ligne de
 * JetBrains Mono à 42 px avance d'environ 25 px par glyphe : onze caractères
 * la remplissent. Au-delà — un exercice au-dessus de cent mille euros — les
 * centimes sautent plutôt que la gravure ne déborde sur l'arc. Réduire le
 * corps serait pire : la taille de ce chiffre est ce qui en fait le sujet.
 */
const GRAVURE_MAX = 11;

function graverTotal(cents: number): string {
  const plein = formatCents(cents);
  return plein.length > GRAVURE_MAX ? formatCentsCompact(Math.round(cents / 100) * 100) : plein;
}

/**
 * LES MASSES DE L'ANNÉE.
 *
 * L'UNIQUE AMBRE de l'écran : la masse en retard — son arc, son libellé, son
 * montant et sa barre dans le relevé. Quatre nœuds, tous dans la carte
 * dominante. La même donnée rappelée plus bas dans le registre reste en encre
 * claire : un rappel n'est pas un second sujet.
 */
function MassesDeLAnnee({
  summary,
  invoices,
  today,
  onOuvrir,
}: {
  summary: { collectedCents: number; outstandingCents: number; overdueCents: number; overdueCount: number; year: string };
  invoices: Invoice[];
  today: string;
  onOuvrir: (id: string) => void;
}) {
  const halo = useHaloSignal(summary.overdueCents > 0);

  /* `outstandingCents` contient déjà le retard : les trois masses disjointes
     sont donc encaissé / attente nette / retard, et leur somme est le total
     émis gravé au centre. */
  const attenteCents = Math.max(0, summary.outstandingCents - summary.overdueCents);
  const totalEmis = summary.collectedCents + summary.outstandingCents;

  const comptes = useMemo(() => {
    let encaisse = 0;
    let attente = 0;
    for (const inv of invoices) {
      if (inv.status === 'cancelled' || inv.status === 'draft' || inv.kind === 'creditNote') continue;
      if (inv.status === 'paid') {
        if (inv.paidAt.startsWith(summary.year)) encaisse += 1;
      } else if (netDueCents(inv, invoices) > 0 && !isOverdue(inv, today, invoices)) {
        attente += 1;
      }
    }
    return { encaisse, attente, retard: summary.overdueCount };
  }, [invoices, summary.year, summary.overdueCount, today]);

  const arcs = decouperArc([summary.collectedCents, attenteCents, summary.overdueCents]);

  const releves = [
    {
      cle: 'encaisse',
      label: tr('hist.invoices.encaisse'),
      cents: summary.collectedCents,
      compte: comptes.encaisse,
      trait: '#4a4a48',
      signal: false,
    },
    {
      cle: 'attente',
      label: tr('hist.invoices.enAttente'),
      cents: attenteCents,
      compte: comptes.attente,
      trait: '#2b2b2b',
      signal: false,
    },
    {
      cle: 'retard',
      label: 'En retard',
      cents: summary.overdueCents,
      compte: comptes.retard,
      trait: 'var(--color-signal)',
      signal: summary.overdueCents > 0,
    },
  ];

  /* Les dépassées, la plus ancienne d'abord : c'est celle qui coûte le plus. */
  const enRetard = useMemo(
    () =>
      invoices
        .filter((inv) => isOverdue(inv, today, invoices))
        .sort((a, b) => (a.dueAt ?? '').localeCompare(b.dueAt ?? ''))
        .slice(0, 2),
    [invoices, today],
  );
  const brouillons = useMemo(() => invoices.filter((inv) => inv.status === 'draft'), [invoices]);
  const enJeuCents = useMemo(
    () => brouillons.reduce((n, inv) => n + invoiceTotals(inv).grossCents, 0),
    [brouillons],
  );
  const joursDepuis = (jour: string) =>
    Math.round((new Date(`${today}T00:00:00`).getTime() - new Date(`${jour}T00:00:00`).getTime()) / 86_400_000);

  /* Les douze mois, et le prévisionnel du mois courant : ce qui est émis à ce
     jour, ramené au mois entier. Ce n'est pas une prédiction — c'est la même
     cadence tenue jusqu'au 31, et le filet pointillé dit bien que ce n'est pas
     une mesure. */
  const maintenant = useMemo(() => new Date(`${today}T00:00:00`), [today]);
  const mois = useMemo(() => douzeMois(invoices, maintenant), [invoices, maintenant]);
  const joursDuMois = new Date(maintenant.getFullYear(), maintenant.getMonth() + 1, 0).getDate();
  const fraction = maintenant.getDate() / joursDuMois;
  const courant = mois[mois.length - 1];
  const previsionnel = fraction > 0 ? Math.round(courant.cents / fraction) : courant.cents;
  const hautMois = Math.max(previsionnel, ...mois.map((m) => m.cents), 1);

  return (
    <section className="flex flex-shrink-0 flex-col gap-6">
      <div className="panel-raised panel-raised-wide panel-ticks px-6 py-6">
        <p className="eyebrow mb-5">
          {tr('hist.surtitre', { module: tr('hist.invoices.titre') })} · exercice {summary.year}
        </p>
        <div className="grid items-center gap-8 lg:grid-cols-[340px_1fr]">
          {/*
            Le conteneur fait la largeur du <svg> et rien de plus : la gravure
            centrale est posée en `left:0; right:0`, elle se centre donc sur
            CETTE boîte. Élargie, la boîte emporterait le total ailleurs que
            sur son cercle.
          */}
          <div className="relative mx-auto w-full" style={{ maxWidth: ARC_L }}>
            <svg
              viewBox={`0 0 ${ARC_L} ${ARC_H}`}
              style={{ width: '100%', height: 'auto', display: 'block' }}
              aria-hidden
            >
              {/* La piste : ce qui resterait si tout était à zéro. */}
              <path
                d={ARC_CHEMIN}
                fill="none"
                stroke="var(--color-border)"
                strokeWidth={ARC_EP}
              />
              {releves.map((r, i) => (
                <path
                  key={r.cle}
                  d={ARC_CHEMIN}
                  fill="none"
                  stroke={r.trait}
                  strokeWidth={ARC_EP}
                  strokeDasharray={`${arcs[i].longueur} ${ARC_LONGUEUR - arcs[i].longueur}`}
                  strokeDashoffset={-arcs[i].debut}
                  className={r.signal ? halo : undefined}
                  data-signal-groupe={r.signal ? 'retard' : undefined}
                />
              ))}
            </svg>
            {/*
              La gravure est remontée d'une demi-épaisseur : posée sur le bord
              bas de la boîte, sa dernière lettre tombait dans le trait des
              extrémités de l'arc. Elle tient maintenant dans le demi-disque
              creux, qui fait 280 px de large (2 × (rayon − épaisseur)).
            */}
            <div
              className="absolute inset-x-0 text-center"
              style={{ bottom: ARC_EP / 2 + 14 }}
            >
              <p className="eyebrow mb-1.5">Total émis</p>
              <p className="tnum font-mono text-[42px] font-bold leading-none tracking-[-0.04em] text-text-primary">
                {graverTotal(totalEmis)}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            {releves.map((r) => (
              <div key={r.cle} className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between gap-4">
                  <p
                    className={r.signal ? 'eyebrow-signal' : 'eyebrow'}
                    data-signal-groupe={r.signal ? 'retard' : undefined}
                  >
                    {r.label}
                  </p>
                  <p className="tnum font-mono text-[10px] uppercase tracking-[0.2em] text-text-muted">
                    {r.compte} {r.compte > 1 ? 'factures' : 'facture'}
                  </p>
                </div>
                <p
                  className={`tnum font-mono text-[27px] font-semibold leading-none tracking-[-0.03em] ${
                    r.signal ? 'text-signal' : 'text-text-primary'
                  }`}
                  data-signal-groupe={r.signal ? 'retard' : undefined}
                >
                  {formatCents(r.cents)}
                </p>
                <div className="h-1.5 w-full bg-border">
                  <span
                    className="block h-full"
                    style={{
                      width: `${totalEmis > 0 ? (r.cents / totalEmis) * 100 : 0}%`,
                      background: r.trait,
                    }}
                    data-signal-groupe={r.signal ? 'retard' : undefined}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        {/* LES DOUZE MOIS — l'histogramme réel, et le mois courant en encre vive. */}
        <div className="panel px-5 py-4">
          <div className="mb-4 flex items-baseline justify-between gap-4">
            <p className="eyebrow">Douze mois émis</p>
            <p className="tnum font-mono text-[10px] uppercase tracking-[0.2em] text-text-muted">
              prévisionnel du mois · {formatCentsCompact(previsionnel)}
            </p>
          </div>
          <div className="grid grid-cols-12 items-end gap-1.5" style={{ height: MOIS_H }}>
            {mois.map((m, i) => {
              const vif = i === mois.length - 1;
              return (
                <div key={m.cle} className="relative flex h-full items-end" title={`${m.cle} · ${formatCents(m.cents)}`}>
                  {/*
                    Le prévisionnel n'existe que pour le mois en cours : un mois
                    clos n'a pas d'avenir, et un filet pointillé sur un mois
                    passé serait un chiffre inventé.
                  */}
                  {vif && previsionnel > m.cents && (
                    <span
                      className="absolute inset-x-0 bottom-0 border border-dashed border-border-strong"
                      style={{ height: `${(previsionnel / hautMois) * 100}%` }}
                    />
                  )}
                  <span
                    className={`relative block w-full ${vif ? 'bg-[#4a4a48]' : 'bg-[#2b2b2b]'}`}
                    style={{ height: `${Math.max(m.cents > 0 ? 2 : 0, (m.cents / hautMois) * 100)}%` }}
                  />
                </div>
              );
            })}
          </div>
          <div className="mt-1.5 grid grid-cols-12 gap-1.5">
            {mois.map((m, i) => (
              <span
                key={m.cle}
                className={`text-center font-mono text-[9.5px] uppercase tracking-[0.1em] ${
                  i === mois.length - 1 ? 'text-text-primary' : 'text-text-muted'
                }`}
              >
                {m.libelle}
              </span>
            ))}
          </div>
        </div>

        {/* LES BROUILLONS — ce qui n'existe encore pour personne, et son montant en jeu. */}
        <div className="panel flex flex-col px-5 py-4">
          <p className="eyebrow mb-3">Brouillons non émis</p>
          {brouillons.length === 0 ? (
            <p className="text-[13px] leading-relaxed text-text-secondary">
              Rien en attente d’émission. Tout ce qui a été rédigé est parti.
            </p>
          ) : (
            <>
              <p className="tnum font-mono text-[27px] font-semibold leading-none tracking-[-0.03em] text-text-primary">
                {formatCents(enJeuCents)}
              </p>
              <p className="mt-1.5 text-[12.5px] text-text-muted">
                {tr('hist.invoices.nBrouillons', { n: brouillons.length })} ·{' '}
                {tr('hist.invoices.brouillonSansNumero')}
              </p>
              <div className="mt-3 flex flex-col divide-y divide-border-row">
                {brouillons.slice(0, 3).map((inv) => (
                  <button
                    key={inv.id}
                    type="button"
                    onClick={() => onOuvrir(inv.id)}
                    className="flex min-h-11 items-center justify-between gap-3 py-2 text-left text-[13px] text-text-secondary transition-colors hover:text-text-primary md:min-h-0"
                  >
                    <span className="truncate">
                      {inv.billTo?.name || tr('hist.invoices.clientSansNom')}
                    </span>
                    <span className="tnum flex-shrink-0 font-mono text-text-muted">
                      {formatCents(invoiceTotals(inv).grossCents)}
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Les dépassées : nommées, chiffrées, avec le geste qui les referme. */}
      {enRetard.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {enRetard.map((inv) => (
            <div key={inv.id} className="panel flex flex-col gap-3 px-5 py-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="tnum font-mono text-[12.5px] text-text-secondary">{inv.number || '—'}</span>
                <span className="eyebrow text-text-secondary">
                  {tr('hist.invoices.echeanceDepuis', {
                    date: inv.dueAt ? formatShortDay(inv.dueAt) : '—',
                    n: inv.dueAt ? joursDepuis(inv.dueAt) : 0,
                  })}
                </span>
              </div>
              <p className="truncate text-[18px] font-semibold text-text-primary">
                {inv.billTo?.name || tr('hist.invoices.clientSansNom')}
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <p className="tnum mr-auto font-mono text-[23px] font-semibold tracking-[-0.03em] text-text-primary">
                  {formatCents(netDueCents(inv, invoices))}
                </p>
                <button
                  type="button"
                  onClick={() => onOuvrir(inv.id)}
                  className="min-h-11 border border-border-strong px-3 py-2 text-[12.5px] font-semibold text-text-primary transition-colors hover:bg-surface-hover md:min-h-0"
                >
                  {tr('hist.invoices.ouvrirLaFacture')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

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
      {/*
        LA BARRE D'ÉTAT DE LA LIGNE.

        Le registre se lit d'abord sans lire : un rail de 2 px par ligne, dont
        la matière dit l'état avant que la pastille ne le nomme. Il n'y a PAS
        d'ambre ici — la masse en retard est le sujet de la carte dominante, et
        la même donnée rappelée plus bas ne redevient pas un second sujet.
      */}
      <span
        aria-hidden
        className={`-my-3 w-0.5 flex-shrink-0 self-stretch ${
          late
            ? 'bg-danger'
            : invoice.status === 'paid'
              ? 'bg-[#4a4a48]'
              : invoice.status === 'cancelled'
                ? 'bg-transparent'
                : 'bg-[#2b2b2b]'
        }`}
      />
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
          {invoice.kind === 'creditNote' && (
            <span className="flex-shrink-0 border border-border-strong px-1.5 py-px font-mono text-[9px] uppercase tracking-widest text-text-secondary">
              Avoir
            </span>
          )}
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
      {/*
        Le montant reste en ENCRE CLAIRE même en retard. Le rail et la pastille
        portent déjà l'état ; teinter aussi le chiffre en ferait le troisième
        rappel d'un fait dont la carte du haut est le sujet, et deux zones de
        l'écran se disputeraient la même urgence.
      */}
      <span className="flex-shrink-0 text-sm font-semibold tabular-nums text-text-primary">
        {invoice.kind === 'creditNote' ? '−' : ''}
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
  invoices,
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
  onCreateCreditNote,
}: {
  invoice: Invoice;
  invoices: Invoice[];
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
  onCreateCreditNote: () => void;
}) {
  const draft = invoice.status === 'draft';
  const isAvoir = invoice.kind === 'creditNote';
  const totals = invoiceTotals(invoice);
  const late = isOverdue(invoice, today, invoices);
  const due = netDueCents(invoice, invoices);
  const avoirs = creditNotesFor(invoice.id, invoices);
  const factureOrigine = isAvoir ? invoices.find((i) => i.id === invoice.creditNoteFor) : undefined;

  // Ajmani sait déjà lire une facture (« facture » → collection `invoices`, voir
  // amn-api/garde/capitaine.js) : cette fiche le lui dit, comme ClientsScreen le
  // fait pour une fiche client — le contexte de l'écran, pas un outil séparé.
  useAjmaniFocus(useMemo(() => ({ type: 'facture', id: invoice.id, label: invoice.number || 'brouillon' }), [invoice.id, invoice.number]));

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
          aria-label={tr('hist.invoices.retourALaListe')}
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center text-text-secondary transition-colors hover:text-text-primary md:hidden"
        >
          <ArrowLeft size={18} strokeWidth={2} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate font-mono text-[11px] uppercase tracking-widest text-text-secondary">
            {invoice.number ? `${isAvoir ? 'Avoir' : 'Facture'} ${invoice.number}` : isAvoir ? 'Avoir en brouillon' : 'Brouillon'}
          </p>
          <p className="truncate font-mono text-[9px] uppercase tracking-widest text-text-muted">
            {draft
              ? 'Modifiable — non émis' + (isAvoir ? '' : 'e')
              : `Émis${isAvoir ? '' : 'e'} le ${formatDay(invoice.issuedAt)} · document figé`}
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
            <Printer size={15} strokeWidth={1.9} />
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3 md:p-4">
        {isAvoir && (
          <p className="mb-3 border border-border px-3 py-2 text-xs leading-tight text-text-secondary">
            <strong className="font-semibold text-text-primary">Avoir</strong> — réduit ce qui reste dû sur{' '}
            {factureOrigine ? `la facture ${factureOrigine.number || factureOrigine.id}` : 'une facture qui n’existe plus'}.
          </p>
        )}
        {!isAvoir && avoirs.length > 0 && (
          <div className="mb-3 border border-border px-3 py-2 text-xs leading-tight text-text-secondary">
            <p>
              <strong className="font-semibold text-text-primary">
                {avoirs.length === 1 ? 'Un avoir' : `${avoirs.length} avoirs`}
              </strong>{' '}
              émis sur cette facture — {formatCents(totals.grossCents - due)} déduits, {formatCents(due)} restant dû.
            </p>
            <ul className="mt-1 flex flex-col gap-0.5 font-mono text-[10px] text-text-muted">
              {avoirs.map((a) => (
                <li key={a.id}>
                  {a.number} · {formatCents(invoiceTotals(a).grossCents)} · {formatDay(a.issuedAt)}
                </li>
              ))}
            </ul>
          </div>
        )}
        {late && (
          <p className="mb-3 border border-border border-l-2 border-l-danger bg-surface px-3 py-2 text-xs leading-tight text-text-primary">
            <strong className="font-semibold">{tr('hist.invoices.echeanceDepassee')}</strong> — attendue le{' '}
            {formatDay(invoice.dueAt)}.
          </p>
        )}
        {invoice.status === 'cancelled' && (
          <p className="mb-3 border border-border px-3 py-2 text-xs leading-tight text-text-secondary">
            <strong className="font-semibold text-text-primary">{tr('hist.invoices.factureAnnulee')}</strong> Son numéro
            reste pris : la séquence légale ne doit pas comporter de trou.
            {invoice.cancelReason && ` Motif : ${invoice.cancelReason}`}
          </p>
        )}
        {invoice.status === 'paid' && (
          <p className="mb-3 border border-success/50 px-3 py-2 text-xs leading-tight text-text-secondary">
            <strong className="font-semibold text-text-primary">{tr('hist.invoices.encaissee')}</strong> le{' '}
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
            <Plus size={13} strokeWidth={2} />{tr('hist.invoices.ajouterUneLigne')}</button>
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
          <Field label={tr('hist.invoices.notesPorteesSurLa')}>
            <textarea
              rows={3}
              value={invoice.notes}
              onChange={(e) => onUpdate({ notes: e.target.value })}
              placeholder={tr('hist.invoices.conditionsParticulieresReferenceDe')}
              className="input-focus w-full resize-none border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none"
            />
          </Field>
        ) : (
          invoice.notes && (
            <Field label={tr('hist.invoices.notesPorteesSurLa')}>
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
              <Send size={15} strokeWidth={2.25} />{tr('hist.invoices.emettreLaFacture')}</button>
            <button
              type="button"
              onClick={() => (confirmDelete ? onDelete() : setConfirmDelete(true))}
              onBlur={() => setConfirmDelete(false)}
              aria-label={tr('hist.invoices.supprimerLeBrouillon')}
              title={tr('hist.invoices.supprimerLeBrouillon')}
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
              <Check size={15} strokeWidth={2.5} />{tr('hist.invoices.marquerEncaissee')}</button>
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
                aria-label={tr('hist.invoices.moyenDeReglement')}
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
              >{tr('hist.invoices.annulerLaFacture')}</button>
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

        {!isAvoir && (invoice.status === 'issued' || invoice.status === 'paid') && !paying && !cancelling && (
          <button
            type="button"
            onClick={onCreateCreditNote}
            title="Émettre un avoir sur cette facture"
            className="flex min-h-11 items-center justify-center gap-2 border border-border px-3 text-xs uppercase tracking-wider text-text-muted transition-colors hover:text-text-primary"
          >
            <Undo2 size={14} strokeWidth={2} />
            Émettre un avoir
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
          placeholder={tr('hist.invoices.designationDeLaPrestation')}
          className="input-focus min-h-11 min-w-0 flex-1 border border-border bg-bg px-2.5 text-sm text-text-primary outline-none"
        />
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={tr('hist.invoices.retirerLaLigne')}
            className="flex h-11 w-9 flex-shrink-0 items-center justify-center text-text-muted transition-colors hover:text-danger"
          >
            <X size={15} strokeWidth={2} />
          </button>
        )}
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2">
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[9px] uppercase tracking-widest text-text-muted">{tr('hist.invoices.qte')}</span>
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
  /*
    Le nom du champ tel qu'il se dit DANS UNE PHRASE, avec son article.

    Écrit plutôt que dérivé : mettre l'étiquette en minuscules donnait « il
    manque raison sociale, adresse et siret » — sans articles, et avec un
    acronyme décapitalisé. Le français ne se fabrique pas à coups de
    `toLowerCase()`, et seuls les champs obligatoires entrent dans la phrase.
  */
  nomDitDansUnePhrase?: string;
}[] = [
  {
    key: 'legalName',
    label: 'Raison sociale',
    placeholder: 'Syraagensy',
    required: true,
    nomDitDansUnePhrase: 'la raison sociale',
  },
  {
    key: 'address',
    label: 'Adresse',
    placeholder: '12 rue …\n75000 Paris',
    required: true,
    multiline: true,
    nomDitDansUnePhrase: 'l’adresse',
  },
  { key: 'siret', label: 'SIRET', placeholder: '14 chiffres', required: true, nomDitDansUnePhrase: 'le SIRET' },
  { key: 'legalForm', label: 'Forme juridique', placeholder: 'SASU, EI, auto-entrepreneur…' },
  { key: 'capital', label: 'Capital social', placeholder: '1 000 €' },
  { key: 'rcsCity', label: 'RCS (ville)', placeholder: 'Paris' },
  { key: 'vatNumber', label: 'N° TVA intracommunautaire', placeholder: 'FR00000000000' },
  { key: 'email', label: 'E-mail', placeholder: 'contact@…' },
  { key: 'phone', label: tr('hist.invoices.telephone') },
  { key: 'iban', label: 'IBAN' },
  { key: 'bic', label: 'BIC' },
];

/*
  CE QUI MANQUE POUR POUVOIR ÉMETTRE.

  Trois mentions sont obligatoires — raison sociale, adresse, SIRET — et sans
  elles le bouton « Émettre » reste refusé. Le formulaire présentait pourtant
  onze champs d'un même gris, marqués d'une astérisque, sans dire lesquels
  BLOQUAIENT ni ce qu'ils bloquaient. On remplissait donc au jugé, on fermait,
  et on découvrait le refus au moment d'émettre — c'est-à-dire au pire moment,
  devant un client qui attend sa facture.

  Le relevé est calculé sur les champs eux-mêmes, jamais tenu à part : une
  seconde liste des mentions obligatoires se serait désynchronisée de
  `IDENTITY_FIELDS` au premier ajout.
*/
function completudeLegale(form: BillingIdentity): {
  exiges: typeof IDENTITY_FIELDS;
  manquants: typeof IDENTITY_FIELDS;
  remplis: number;
} {
  const exiges = IDENTITY_FIELDS.filter((f) => f.required);
  const manquants = exiges.filter((f) => String(form[f.key] ?? '').trim() === '');
  return { exiges, manquants, remplis: exiges.length - manquants.length };
}

/** « le SIRET », « le SIRET et l'adresse », « la raison sociale, l'adresse et le SIRET ». */
function enumerer(libelles: string[]): string {
  if (libelles.length <= 1) return libelles[0] ?? '';
  return `${libelles.slice(0, -1).join(', ')} et ${libelles[libelles.length - 1]}`;
}

function IdentityModal({
  identity,
  onSave,
  onClose,
}: {
  identity: BillingIdentity;
  onSave: (patch: Partial<BillingIdentity>) => void;
  onClose: () => void;
}) {
  // Échap ferme, comme partout ailleurs. Voir lib/useFermetureEchap.
  useFermetureEchap(true, onClose);

  const [form, setForm] = useState<BillingIdentity>(identity);
  const { exiges, manquants, remplis } = completudeLegale(form);

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
            <Building2 size={14} strokeWidth={1.9} />{tr('hist.invoices.coordonneesDeFacturation')}</h2>
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
            Ce qui figurera sur chaque facture émise. Une facture émise ne bouge plus : ces
            informations y sont figées au moment de l’émission.
          </p>

          {/*
            LA BANDE DE COMPLÉTUDE — L'UNIQUE AMBRE DE CE FORMULAIRE.

            Elle nomme ce qui manque, dit ce que ça bloque, et compte : deux
            mentions sur trois se voit d'un coup d'œil là où onze champs gris
            ne se comptent pas.

            L'ambre marque une DÉCISION à prendre, et c'en est une : tant qu'il
            manque une mention, aucune facture ne peut sortir. La bande, le
            relevé, le libellé du champ et sa bordure disent tous la même chose
            — d'où le groupe, qui les compte pour un.

            Le formulaire s'ouvre au-dessus de Facturation, qui porte son propre
            ambre (le segment en retard). Il est derrière le voile pendant que
            la fenêtre est là, et la règle vaut par surface lisible : ce qu'on
            lit ici, c'est une seule chose en ambre.
          */}
          {manquants.length > 0 && (
            <div
              className="relative mb-4 border border-border bg-sunken p-3.5"
              data-signal-groupe="identite-incomplete"
            >
              <span className="absolute inset-y-0 left-0 w-[2px] bg-signal" aria-hidden />
              <div className="flex flex-wrap items-start justify-between gap-3 pl-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-semibold leading-snug text-text-primary">
                    Il manque {enumerer(manquants.map((f) => f.nomDitDansUnePhrase ?? f.label))} pour pouvoir
                    émettre.
                  </p>
                  <p className="mt-1 max-w-md text-xs leading-relaxed text-text-secondary">
                    Sans {manquants.length > 1 ? 'ces mentions' : 'cette mention'}, le bouton
                    « Émettre » reste refusé — un document sans mention légale ne vaut rien devant
                    un comptable.
                  </p>
                </div>
                <div className="flex flex-shrink-0 items-center gap-2">
                  <span className="flex gap-1" aria-hidden>
                    {exiges.map((f) => (
                      <span
                        key={f.key}
                        className={`h-1 w-8 ${
                          String(form[f.key] ?? '').trim() === '' ? 'bg-signal' : 'bg-text-secondary'
                        }`}
                      />
                    ))}
                  </span>
                  <span className="tnum font-mono text-xs text-text-secondary">
                    {remplis} / {exiges.length}
                  </span>
                </div>
              </div>
            </div>
          )}

          {IDENTITY_FIELDS.map((field) => {
            /*
              Le champ dit son propre statut, à la place de l'astérisque.

              Une astérisque suppose qu'on a lu sa légende, et ne distingue pas
              « exigé » de « exigé ET vide » — or c'est cette différence-là
              qu'on vient chercher.
            */
            const vide = String(form[field.key] ?? '').trim() === '';
            const bloquant = field.required === true && vide;
            return (
              <label key={field.key} className="mt-3 block first:mt-0">
                <span
                  className={`mb-1 block font-mono text-[10px] uppercase tracking-widest ${
                    bloquant ? 'text-signal' : 'text-text-muted'
                  }`}
                >
                  {field.label}
                  {field.required && (bloquant ? ' · exigé, manquant' : ' · exigé')}
                </span>
                {field.multiline ? (
                  <textarea
                    rows={2}
                    value={String(form[field.key] ?? '')}
                    onChange={(e) => set({ [field.key]: e.target.value } as Partial<BillingIdentity>)}
                    placeholder={field.placeholder}
                    className={`input-focus w-full resize-none border bg-bg px-3 py-2 text-sm text-text-primary outline-none ${
                      bloquant ? 'border-signal-line' : 'border-border'
                    }`}
                  />
                ) : (
                  <input
                    value={String(form[field.key] ?? '')}
                    onChange={(e) => set({ [field.key]: e.target.value } as Partial<BillingIdentity>)}
                    placeholder={field.placeholder}
                    className={`input-focus min-h-11 w-full border bg-bg px-3 text-sm text-text-primary outline-none ${
                      bloquant ? 'border-signal-line' : 'border-border'
                    }`}
                  />
                )}
              </label>
            );
          })}

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
                <span className="block text-text-muted">{tr('hist.invoices.aucuneTvaSurLes')}</span>
              </span>
            </button>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-text-muted">{tr('hist.invoices.delaiDeReglementJours')}</span>
              <input
                type="number"
                min={0}
                value={form.paymentTermDays}
                onChange={(e) => set({ paymentTermDays: Number(e.target.value) })}
                className="input-focus min-h-11 w-full border border-border bg-bg px-3 text-sm tabular-nums text-text-primary outline-none"
              />
            </label>
            <label className="block">
              <span className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-text-muted">{tr('hist.invoices.penalitesDeRetardAn')}</span>
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
          >{tr('hist.invoices.enregistrer')}</button>
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
