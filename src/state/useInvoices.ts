import { useCallback, useMemo } from 'react';
import { useSync, useCollection, uid, stripMeta } from './SyncContext';
import { documentTotals, eurosToCents } from '../lib/money';
import { oneOf } from '../lib/records';
import type {
  BillingIdentity,
  Client,
  Invoice,
  InvoiceLine,
  InvoiceParty,
  InvoiceStatus,
  Quote,
} from '../shared/api';

/**
 * La facturation.
 *
 * L'application savait déjà proposer (les devis) et suivre le travail ; elle
 * ne savait pas ENCAISSER. Un devis marqué « payé » n'est pas une facture : il
 * n'a ni numéro légal, ni date d'échéance, ni TVA, ni les mentions
 * obligatoires sans lesquelles le document ne vaut rien devant un comptable ou
 * un contrôle. Ce module comble exactement ce trou, et se branche sur ce qui
 * existe : un devis accepté devient une facture en un clic, sans ressaisie.
 *
 * ## Deux règles qui gouvernent tout le reste
 *
 * 1. **Une facture émise ne bouge plus.** Ni son montant, ni son client, ni sa
 *    date. C'est la loi, et c'est aussi le seul moyen qu'un document envoyé
 *    corresponde encore à lui-même six mois plus tard. Les coordonnées du
 *    client sont donc FIGÉES dans la facture à l'émission (`billTo`) plutôt que
 *    relues depuis la fiche.
 * 2. **La numérotation est continue et sans trou.** Le numéro n'est attribué
 *    qu'à l'émission — un brouillon abandonné ne consomme rien — et une
 *    facture annulée garde le sien.
 *
 * ## La limite honnête de la numérotation
 *
 * Le numéro suivant se calcule à partir des factures déjà connues de
 * l'appareil. Deux appareils qui émettraient une facture au même moment, hors
 * ligne tous les deux, pourraient donc tomber sur le même numéro. Plutôt que de
 * faire semblant que le cas n'existe pas, `duplicateNumbers` le détecte et
 * l'écran l'affiche en clair : c'est une anomalie rare, mais elle doit se voir
 * et se corriger, pas se découvrir à la déclaration de TVA.
 */

/** Ce qui est stocké : `id` est la clé de l'enregistrement, pas un champ. */
type InvoiceData = Omit<Invoice, 'id'>;

/** Le domaine des statuts, à l'exécution : un statut hérité ou mal écrit
 *  redevient un brouillon plutôt que de traverser jusqu'aux tables d'affichage. */
const INVOICE_STATUSES: InvoiceStatus[] = ['draft', 'issued', 'paid', 'cancelled'];

/** L'id réservé de l'unique enregistrement d'identité légale. */
const IDENTITY_ID = 'identity';

export const EMPTY_IDENTITY: BillingIdentity = {
  legalName: '',
  address: '',
  legalForm: '',
  siret: '',
  vatNumber: '',
  rcsCity: '',
  capital: '',
  email: '',
  phone: '',
  iban: '',
  bic: '',
  vatExempt: false,
  paymentTermDays: 30,
  latePenaltyRate: 10,
};

/** Les taux français en vigueur, plus l'exonération. */
export const VAT_RATES = [20, 10, 5.5, 2.1, 0];

/** Jour ISO (`2026-08-11`) — les dates de facture n'ont pas d'heure. */
export function isoDay(date: Date = new Date()): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

/** `2026-08-11` → « 11 août 2026 ». Chaîne vide pour une date absente. */
export function formatDay(iso: string): string {
  if (!iso) return '';
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
}

/**
 * « 11 août » — pour les listes, où l'année encombre plus qu'elle n'informe.
 * Accepte un horodatage complet aussi bien qu'un jour ISO.
 */
export function formatShortDay(iso: string): string {
  if (!iso) return '';
  const date = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

export function emptyLine(): InvoiceLine {
  return { id: uid('line'), label: '', quantity: 1, unitPriceCents: 0, vatRate: 20 };
}

function toInvoice(row: InvoiceData & { id: string; updatedAt: string }): Invoice {
  return {
    id: row.id,
    number: row.number ?? '',
    clientId: Number(row.clientId ?? 0),
    billTo: {
      name: row.billTo?.name ?? '',
      company: row.billTo?.company ?? '',
      email: row.billTo?.email ?? '',
      address: row.billTo?.address ?? '',
      vatNumber: row.billTo?.vatNumber ?? '',
    },
    issuedAt: row.issuedAt ?? '',
    dueAt: row.dueAt ?? '',
    lines: Array.isArray(row.lines)
      ? row.lines.map((line) => ({
          id: line?.id ?? uid('line'),
          label: line?.label ?? '',
          quantity: Number(line?.quantity ?? 0),
          unitPriceCents: Number(line?.unitPriceCents ?? 0),
          vatRate: Number(line?.vatRate ?? 0),
        }))
      : [],
    status: oneOf(row.status, INVOICE_STATUSES, 'draft'),
    paidAt: row.paidAt ?? '',
    paymentMethod: row.paymentMethod ?? '',
    cancelReason: row.cancelReason ?? '',
    notes: row.notes ?? '',
    quoteId: row.quoteId === null || row.quoteId === undefined ? null : Number(row.quoteId),
    projectId: row.projectId,
    createdAt: row.createdAt ?? row.updatedAt,
    updatedAt: row.updatedAt,
  };
}

/** Les totaux d'une facture, en centimes, TVA ventilée par taux. */
export function invoiceTotals(invoice: Invoice) {
  return documentTotals(invoice.lines);
}

/**
 * Une facture émise, non payée, non annulée, dont l'échéance est dépassée.
 *
 * Calculé et jamais stocké : un statut « en retard » écrit en base serait faux
 * dès le lendemain de son écriture, puisque rien ne repasse dessus.
 */
export function isOverdue(invoice: Invoice, today: string = isoDay()): boolean {
  return invoice.status === 'issued' && Boolean(invoice.dueAt) && invoice.dueAt < today;
}

/** Numéro suivant : `AAAA-NNNN`, la séquence repartant à 1 chaque année. */
export function nextNumber(existing: Invoice[], year: number = new Date().getFullYear()): string {
  const prefix = `${year}-`;
  let highest = 0;
  for (const invoice of existing) {
    if (!invoice.number.startsWith(prefix)) continue;
    const tail = Number.parseInt(invoice.number.slice(prefix.length), 10);
    if (Number.isFinite(tail) && tail > highest) highest = tail;
  }
  return `${prefix}${String(highest + 1).padStart(4, '0')}`;
}

/** Les coordonnées de facturation tirées d'une fiche client, au moment T. */
export function partyFromClient(client: Client | undefined): InvoiceParty {
  return {
    name: client?.name ?? '',
    company: client?.company ?? '',
    email: client?.email ?? '',
    address: '',
    vatNumber: '',
  };
}

export function useInvoices() {
  const { upsert, remove } = useSync();
  const rawInvoices = useCollection<InvoiceData>('invoices');
  const rawBilling = useCollection<BillingIdentity>('billing');

  const invoices = useMemo<Invoice[]>(
    () =>
      rawInvoices
        .map(toInvoice)
        // Les émises d'abord, par numéro décroissant ; les brouillons, qui n'ont
        // pas de numéro, restent en tête par date de création.
        .sort((a, b) => {
          if (a.status === 'draft' && b.status !== 'draft') return -1;
          if (b.status === 'draft' && a.status !== 'draft') return 1;
          if (a.status === 'draft' && b.status === 'draft') {
            return (b.createdAt || '').localeCompare(a.createdAt || '');
          }
          return b.number.localeCompare(a.number);
        }),
    [rawInvoices],
  );

  const identity = useMemo<BillingIdentity>(() => {
    const row = rawBilling.find((r) => r.id === IDENTITY_ID);
    if (!row) return EMPTY_IDENTITY;
    return {
      ...EMPTY_IDENTITY,
      ...row,
      vatExempt: Boolean(row.vatExempt),
      paymentTermDays: Number.isFinite(Number(row.paymentTermDays))
        ? Number(row.paymentTermDays)
        : EMPTY_IDENTITY.paymentTermDays,
      latePenaltyRate: Number.isFinite(Number(row.latePenaltyRate))
        ? Number(row.latePenaltyRate)
        : EMPTY_IDENTITY.latePenaltyRate,
    };
  }, [rawBilling]);

  /**
   * L'identité est-elle suffisante pour ÉMETTRE ?
   *
   * Émettre une facture sans raison sociale ni SIRET produit un document qui
   * n'a aucune valeur — autant l'empêcher au moment de l'émission plutôt que
   * de le découvrir quand le client le refuse.
   */
  const identityComplete = useMemo(
    () => Boolean(identity.legalName.trim() && identity.address.trim() && identity.siret.trim()),
    [identity],
  );

  /** Numéros portés par deux factures ou plus — anomalie de synchronisation. */
  const duplicateNumbers = useMemo(() => {
    const counts = new Map<string, number>();
    for (const invoice of invoices) {
      if (!invoice.number) continue;
      counts.set(invoice.number, (counts.get(invoice.number) ?? 0) + 1);
    }
    return [...counts.entries()].filter(([, count]) => count > 1).map(([number]) => number);
  }, [invoices]);

  const saveIdentity = useCallback(
    (patch: Partial<BillingIdentity>) => {
      upsert('billing', IDENTITY_ID, { ...identity, ...patch });
    },
    [identity, upsert],
  );

  const createDraft = useCallback(
    (input: {
      clientId: number;
      billTo: InvoiceParty;
      lines?: InvoiceLine[];
      notes?: string;
      quoteId?: number | null;
      dueAt?: string;
      projectId?: string;
    }): string => {
      const id = uid('inv');
      const now = new Date();
      const due =
        input.dueAt ??
        isoDay(new Date(now.getTime() + Math.max(0, identity.paymentTermDays) * 86400000));
      upsert('invoices', id, {
        number: '',
        clientId: input.clientId,
        billTo: input.billTo,
        issuedAt: '',
        dueAt: due,
        lines: input.lines && input.lines.length > 0 ? input.lines : [emptyLine()],
        status: 'draft',
        paidAt: '',
        paymentMethod: '',
        cancelReason: '',
        notes: input.notes ?? '',
        quoteId: input.quoteId ?? null,
        projectId: input.projectId,
        createdAt: now.toISOString(),
      } satisfies Omit<InvoiceData, 'updatedAt'>);
      return id;
    },
    [identity.paymentTermDays, upsert],
  );

  /**
   * Convertit un devis en brouillon de facture.
   *
   * Le devis porte un prix unique en euros TTC-indéterminés ; il devient une
   * ligne unique, au taux par défaut, que l'utilisatrice peut détailler avant
   * d'émettre. Le lien `quoteId` est conservé : c'est ce qui permet de ne pas
   * facturer deux fois le même devis, et de le dire dans l'écran.
   */
  const createFromQuote = useCallback(
    (quote: Quote, client: Client | undefined): string =>
      createDraft({
        clientId: quote.clientId,
        billTo: partyFromClient(client),
        quoteId: quote.id,
        notes: quote.detail,
        lines: [
          {
            id: uid('line'),
            label: quote.title || quote.trackerTier || 'Prestation',
            quantity: 1,
            unitPriceCents: eurosToCents(quote.priceEuro),
            vatRate: identity.vatExempt ? 0 : 20,
          },
        ],
      }),
    [createDraft, identity.vatExempt],
  );

  /** Modifie un BROUILLON. Refuse en silence sur une facture déjà émise. */
  const updateDraft = useCallback(
    (id: string, patch: Partial<Omit<Invoice, 'id' | 'status' | 'number'>>) => {
      const current = rawInvoices.find((r) => r.id === id);
      if (!current || (current.status ?? 'draft') !== 'draft') return;
      upsert('invoices', id, { ...stripMeta(current), ...patch });
    },
    [rawInvoices, upsert],
  );

  /**
   * Émet la facture : lui attribue son numéro et sa date, et la fige.
   *
   * Renvoie le numéro attribué, ou `null` si l'émission est refusée (identité
   * légale incomplète, aucune ligne, ou facture déjà émise).
   */
  const issue = useCallback(
    (id: string): string | null => {
      const current = rawInvoices.find((r) => r.id === id);
      if (!current || (current.status ?? 'draft') !== 'draft') return null;
      if (!identityComplete) return null;
      const lines = Array.isArray(current.lines) ? current.lines : [];
      if (lines.length === 0) return null;

      const today = isoDay();
      const number = nextNumber(invoices, new Date().getFullYear());
      const due =
        current.dueAt ||
        isoDay(new Date(Date.now() + Math.max(0, identity.paymentTermDays) * 86400000));
      upsert('invoices', id, {
        ...stripMeta(current),
        number,
        issuedAt: today,
        dueAt: due,
        status: 'issued' satisfies InvoiceStatus,
      });
      return number;
    },
    [rawInvoices, invoices, identityComplete, identity.paymentTermDays, upsert],
  );

  const markPaid = useCallback(
    (id: string, paidAt: string, paymentMethod: string) => {
      const current = rawInvoices.find((r) => r.id === id);
      if (!current || (current.status ?? 'draft') !== 'issued') return;
      upsert('invoices', id, {
        ...stripMeta(current),
        status: 'paid' satisfies InvoiceStatus,
        paidAt: paidAt || isoDay(),
        paymentMethod,
      });
    },
    [rawInvoices, upsert],
  );

  /** Repasse une facture encaissée en « émise » — le remède à un clic de trop. */
  const markUnpaid = useCallback(
    (id: string) => {
      const current = rawInvoices.find((r) => r.id === id);
      if (!current || (current.status ?? 'draft') !== 'paid') return;
      upsert('invoices', id, {
        ...stripMeta(current),
        status: 'issued' satisfies InvoiceStatus,
        paidAt: '',
        paymentMethod: '',
      });
    },
    [rawInvoices, upsert],
  );

  /**
   * Annule une facture émise. Le numéro RESTE pris : c'est précisément ce qui
   * distingue une annulation d'une suppression, et ce qui garde la séquence
   * continue.
   */
  const cancel = useCallback(
    (id: string, reason: string) => {
      const current = rawInvoices.find((r) => r.id === id);
      if (!current) return;
      const status = current.status ?? 'draft';
      if (status === 'draft' || status === 'cancelled') return;
      upsert('invoices', id, {
        ...stripMeta(current),
        status: 'cancelled' satisfies InvoiceStatus,
        cancelReason: reason,
      });
    },
    [rawInvoices, upsert],
  );

  /** Supprime — un BROUILLON seulement. Une facture émise ne s'efface pas. */
  const deleteDraft = useCallback(
    (id: string) => {
      const current = rawInvoices.find((r) => r.id === id);
      if (!current || (current.status ?? 'draft') !== 'draft') return;
      remove('invoices', id);
    },
    [rawInvoices, remove],
  );

  /**
   * Ce que l'écran affiche en tête : l'argent, en trois chiffres.
   *
   * Les annulées ne comptent nulle part — c'est le sens même de l'annulation —
   * et les brouillons non plus, puisqu'ils n'ont rien réclamé à personne.
   */
  const summary = useMemo(() => {
    const today = isoDay();
    const year = String(new Date().getFullYear());
    let collectedCents = 0;
    let outstandingCents = 0;
    let overdueCents = 0;
    let overdueCount = 0;

    for (const invoice of invoices) {
      if (invoice.status === 'cancelled' || invoice.status === 'draft') continue;
      const { grossCents } = documentTotals(invoice.lines);
      if (invoice.status === 'paid') {
        if (invoice.paidAt.startsWith(year)) collectedCents += grossCents;
      } else {
        outstandingCents += grossCents;
        if (isOverdue(invoice, today)) {
          overdueCents += grossCents;
          overdueCount += 1;
        }
      }
    }

    return { collectedCents, outstandingCents, overdueCents, overdueCount, year };
  }, [invoices]);

  return {
    invoices,
    identity,
    identityComplete,
    duplicateNumbers,
    summary,
    saveIdentity,
    createDraft,
    createFromQuote,
    updateDraft,
    issue,
    markPaid,
    markUnpaid,
    cancel,
    deleteDraft,
  };
}
