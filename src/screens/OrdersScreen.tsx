import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronRight, Package, ReceiptEuro } from 'lucide-react';
import { useOrders, ORDER_STATUS_LABELS, NEXT_STATUSES, STATUS_ORDER, orderTotals } from '../state/useOrders';
import { useInvoices } from '../state/useInvoices';
import { useToast } from '../state/ToastContext';
import { formatCents } from '../lib/money';
import { staggerContainer, staggerItem } from '../lib/transitions';
import type { Order, OrderStatus } from '../shared/api';
import { EmptyState, FirstRun } from '../components/EmptyState';

/**
 * Commandes reçues du site public.
 *
 * ## Ce que cet écran fait, et ce qu'il ne fait pas
 *
 * Il ne crée rien. Les commandes ARRIVENT (voir `docs/COMMANDES.md` dans
 * amn-api) ; ici on les traite. C'est ce qui décide de toute sa forme : une
 * liste ordonnée par ce qui demande une action, et UN bouton par commande —
 * celui de l'étape suivante.
 *
 * ## Le concurrent, et la précision
 *
 * Shopify fait ça, et bien. Sa gestion de commandes présente à chaque ligne un
 * sélecteur de statut complet : on peut marquer « livrée » une commande jamais
 * confirmée, et rien ne proteste. L'erreur se découvre quand le client
 * réclame.
 *
 * Ici les transitions sont déclarées (`NEXT_STATUSES`), et l'écran ne propose
 * QUE l'étape suivante possible : une commande nouvelle se confirme ou
 * s'annule, rien d'autre. Une commande livrée ou annulée est terminée — on
 * n'en ressort pas. Moins de choix, moins d'erreurs silencieuses, et un geste
 * de moins par commande.
 *
 * La seconde précision est le lien avec la facturation : « Créer un brouillon
 * de facture » ne peut être fait qu'une fois, parce que la commande retient
 * l'identifiant de la facture qu'elle a produite. Chez Shopify, rien n'empêche
 * d'émettre deux fois — c'est à l'humain de s'en souvenir.
 */
export function OrdersScreen() {
  const { orders, counts, setStatus, attachInvoice } = useOrders();
  const { createDraft } = useInvoices();
  const { notify } = useToast();
  const [filter, setFilter] = useState<OrderStatus | 'all'>('all');

  const shown = useMemo(
    () => (filter === 'all' ? orders : orders.filter((o) => o.status === filter)),
    [orders, filter],
  );

  const waiting = counts.new;

  const invoice = (order: Order) => {
    if (order.invoiceId) return;
    const id = createDraft({
      // Aucune fiche client n'existe pour un acheteur du site : il a commandé,
      // il n'est pas (encore) au fichier. `0` dit « pas de fiche liée » plutôt
      // que d'en inventer une à chaque commande.
      clientId: 0,
      billTo: {
        name: order.customer.name,
        company: '',
        email: order.customer.email,
        address: order.customer.address,
        vatNumber: '',
      },
      notes: order.reference ? `Commande ${order.reference}` : 'Commande du site',
      lines: order.lines.map((line, index) => ({
        id: `ord-${index}`,
        label: line.sku ? `${line.label} (${line.sku})` : line.label,
        quantity: line.quantity,
        unitPriceCents: line.unitPriceCents,
        vatRate: line.vatRate,
      })),
    });
    attachInvoice(order, id);
    notify({
      title: 'Brouillon de facture créé',
      body: `Commande de ${order.customer.name} — à compléter dans Facturation.`,
    });
  };

  return (
    <motion.section variants={staggerContainer} initial="hidden" animate="show" className="flex flex-col gap-5">
      <motion.header variants={staggerItem}>
        <h1 className="text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">Commandes</h1>
        <p className="mt-1 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-text-muted sm:text-xs">
          {/*
            La pastille ne pulse QUE s'il y a réellement des commandes à
            traiter. Une animation permanente cesse d'être une information au
            bout de dix minutes — elle devient un fond d'écran.
          */}
          {waiting > 0 && (
            <span className="relative flex h-1.5 w-1.5" aria-hidden>
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-70" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
            </span>
          )}
          {waiting > 0
            ? `${waiting} commande${waiting > 1 ? 's' : ''} à traiter`
            : `${orders.length} commande${orders.length > 1 ? 's' : ''} · rien en attente`}
        </p>
      </motion.header>

      <motion.div variants={staggerItem} className="flex flex-wrap gap-1.5">
        <Chip label="Toutes" count={orders.length} active={filter === 'all'} onClick={() => setFilter('all')} />
        {STATUS_ORDER.filter((s) => counts[s] > 0).map((status) => (
          <Chip
            key={status}
            label={ORDER_STATUS_LABELS[status]}
            count={counts[status]}
            active={filter === status}
            onClick={() => setFilter(status)}
          />
        ))}
      </motion.div>

      {shown.length === 0 ? (
        /*
          COMMANDES (BLOC A) — un cadre en pointillés de 12 rem, une icône et
          deux paragraphes. C'est le module le plus souvent vide de tous (une
          organisation sans boutique n'en recevra jamais), donc celui où le vide
          coûtait le plus cher.

          La distinction ici est utile et vaut d'être gardée : « jamais reçu de
          commande » n'est pas une absence, c'est une chaîne pas encore branchée
          — et la clé de réception se demande aux Paramètres. « Aucune dans ce
          statut » n'a rien à expliquer.
        */
        <motion.div variants={staggerItem}>
          {orders.length === 0 ? (
            <FirstRun title="Aucune commande reçue">
              Les commandes passées sur votre site arrivent ici toutes seules, en temps réel. Le
              site a besoin d’une clé de réception — elle s’obtient dans les Paramètres.
            </FirstRun>
          ) : (
            <EmptyState quiet>Aucune commande dans ce statut.</EmptyState>
          )}
        </motion.div>
      ) : (
        <motion.ul variants={staggerItem} className="flex flex-col gap-px bg-border">
          {shown.map((order) => (
            <OrderRow
              key={order.id}
              order={order}
              onStatus={(status) => setStatus(order, status)}
              onInvoice={() => invoice(order)}
            />
          ))}
        </motion.ul>
      )}
    </motion.section>
  );
}

function OrderRow({
  order,
  onStatus,
  onInvoice,
}: {
  order: Order;
  onStatus: (status: OrderStatus) => void;
  onInvoice: () => void;
}) {
  const [open, setOpen] = useState(false);
  const totals = orderTotals(order.lines);
  const next = NEXT_STATUSES[order.status];

  return (
    <li className="bg-surface">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="input-focus flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <ChevronRight
            size={14}
            strokeWidth={2}
            aria-hidden
            className={`flex-shrink-0 text-text-muted transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
          />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm text-text-primary">
              {order.customer.name}
              {order.reference && (
                <span className="ml-2 font-mono text-[11px] text-text-muted">{order.reference}</span>
              )}
            </span>
            <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
              {new Date(order.placedAt).toLocaleDateString('fr-FR', {
                day: '2-digit',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })}
              {' · '}
              {order.lines.length} article{order.lines.length > 1 ? 's' : ''}
            </span>
          </span>
        </button>

        <StatusBadge status={order.status} />

        <span className="flex-shrink-0 font-mono text-sm tabular-nums text-text-primary">
          {formatCents(totals.grossCents)}
        </span>
      </div>

      {open && (
        <div className="border-t border-border bg-bg px-4 py-3">
          <dl className="mb-3 grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
            {order.customer.email && <Field label="Email" value={order.customer.email} />}
            {order.customer.phone && <Field label="Téléphone" value={order.customer.phone} />}
            {order.customer.address && <Field label="Adresse" value={order.customer.address} />}
            {order.paidCents > 0 && <Field label="Déjà réglé" value={formatCents(order.paidCents)} />}
          </dl>

          <ul className="mb-3 flex flex-col gap-1">
            {order.lines.map((line, index) => (
              <li key={index} className="flex items-baseline justify-between gap-3 text-xs">
                <span className="min-w-0 flex-1 truncate text-text-secondary">
                  {line.quantity} × {line.label}
                  {line.sku && <span className="ml-1 font-mono text-[10px] text-text-muted">{line.sku}</span>}
                </span>
                <span className="font-mono tabular-nums text-text-secondary">
                  {formatCents(line.quantity * line.unitPriceCents)}
                </span>
              </li>
            ))}
          </ul>

          {order.note && (
            <p className="mb-3 border-l-2 border-border pl-3 text-xs italic leading-relaxed text-text-muted">
              {order.note}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-1.5">
            {next.map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => onStatus(status)}
                className={`input-focus flex min-h-11 items-center gap-1.5 border px-3 text-xs transition-colors md:min-h-0 md:py-2 ${
                  status === 'cancelled'
                    ? 'border-border text-text-muted hover:text-danger'
                    : 'border-border-strong bg-accent-muted text-text-primary'
                }`}
              >
                <Package size={13} strokeWidth={1.75} aria-hidden />
                Marquer {ORDER_STATUS_LABELS[status].toLowerCase()}
              </button>
            ))}

            {/*
              Facturable une seule fois, et le garde-fou est la commande
              elle-même : elle retient l'identifiant de la facture qu'elle a
              produite. Le bouton disparaît ensuite, remplacé par le constat.
            */}
            {order.invoiceId ? (
              <span className="flex items-center gap-1.5 px-1 font-mono text-[10px] uppercase tracking-widest text-text-muted">
                <ReceiptEuro size={13} strokeWidth={1.75} aria-hidden />
                Facture créée
              </span>
            ) : (
              order.status !== 'cancelled' && (
                <button
                  type="button"
                  onClick={onInvoice}
                  className="input-focus flex min-h-11 items-center gap-1.5 border border-border px-3 text-xs text-text-secondary transition-colors hover:text-text-primary md:min-h-0 md:py-2"
                >
                  <ReceiptEuro size={13} strokeWidth={1.75} aria-hidden />
                  Créer un brouillon de facture
                </button>
              )
            )}
          </div>
        </div>
      )}
    </li>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="flex-shrink-0 font-mono text-[10px] uppercase tracking-widest text-text-muted">
        {label}
      </dt>
      <dd className="min-w-0 text-text-secondary">{value}</dd>
    </div>
  );
}

function StatusBadge({ status }: { status: OrderStatus }) {
  const tone =
    status === 'new'
      ? 'border-accent text-text-primary'
      : status === 'cancelled'
        ? 'border-border text-text-muted line-through'
        : status === 'delivered'
          ? 'border-border text-text-muted'
          : 'border-border-strong text-text-secondary';
  return (
    <span
      className={`flex-shrink-0 border px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest ${tone}`}
    >
      {ORDER_STATUS_LABELS[status]}
    </span>
  );
}

function Chip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex min-h-11 items-center gap-1.5 border px-3 text-xs transition-colors md:min-h-0 md:py-2 ${
        active
          ? 'border-border-strong bg-accent-muted text-text-primary'
          : 'border-border text-text-muted hover:text-text-secondary'
      }`}
    >
      {label}
      <span className="font-mono text-[10px] tabular-nums text-text-muted">{count}</span>
    </button>
  );
}
