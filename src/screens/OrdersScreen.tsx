import React, { useMemo, useState } from 'react';
import { ScreenHeader } from '../components/ScreenHeader';
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
      <motion.div variants={staggerItem}>
        {/*
          « À traiter » porte l'emphase UNIQUEMENT s'il y en a. C'est le même
          principe que la pastille pulsante qu'il remplace : une mise en avant
          permanente cesse d'être une information au bout de dix minutes, elle
          devient un fond d'écran.
        */}
        <ScreenHeader
          eyebrow="Poste de travail · Commandes"
          title="Commandes"
          description={
            waiting > 0
              ? 'Ce qui attend une réponse, en premier.'
              : 'Rien en attente — tout est traité.'
          }
          stats={[
            { label: 'À traiter', value: waiting, emphasis: waiting > 0 },
            { label: 'Total', value: orders.length },
            { label: 'Affichées', value: shown.length, title: 'Après le filtre ci-dessous.' },
          ]}
        />
      </motion.div>

      {orders.length > 0 && (
        <motion.div variants={staggerItem}>
          <ChaineDeTraitement
            orders={orders}
            counts={counts}
            onFiltrer={setFilter}
            onConfirmer={(order) => setStatus(order, 'confirmed')}
            onFacturer={invoice}
          />
        </motion.div>
      )}

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

/*
  LA CHAÎNE DE TRAITEMENT — l'objet dominant de l'écran Commandes.

  Une commande passe par cinq états, dans un ordre que le moteur déclare
  (`STATUS_ORDER`, `NEXT_STATUSES`). L'écran les montrait comme six filtres
  côte à côte, tous du même poids : une commande arrivée il y a dix minutes et
  une livrée le mois dernier avaient exactement la même apparence.

  La chaîne les remet dans leur ordre, chacune avec son compte et sa somme, et
  donne au PREMIER MAILLON — ce qui vient d'arriver et n'a encore reçu aucune
  réponse — le poids qui lui revient.

  L'AMBRE de cet écran, nommé par la table du paquet : le badge « à traiter ».
  Il est ici la plaque entière du premier maillon, en encre de signal, ce qui
  respecte la règle 2 (l'ambre est une plaque pleine, pas un texte teinté) et
  n'en fait qu'UN objet : tout ce qui est dedans en descend. Quand rien
  n'attend, la plaque redevient une colonne comme les autres et l'écran n'a
  plus d'ambre du tout — ce qui est exactement ce qu'il faut lire.
*/
const MAILLONS: OrderStatus[] = ['new', 'confirmed', 'preparing', 'shipped', 'delivered'];

function ChaineDeTraitement({
  orders,
  counts,
  onFiltrer,
  onConfirmer,
  onFacturer,
}: {
  orders: Order[];
  counts: Record<OrderStatus, number>;
  onFiltrer: (status: OrderStatus | 'all') => void;
  onConfirmer: (order: Order) => void;
  onFacturer: (order: Order) => void;
}) {
  const parMaillon = useMemo(
    () =>
      MAILLONS.map((status) => {
        const siennes = orders.filter((o) => o.status === status);
        return {
          status,
          siennes,
          sommeCents: siennes.reduce((somme, o) => somme + orderTotals(o.lines).grossCents, 0),
        };
      }),
    [orders],
  );

  /* La tête de file : la PLUS ANCIENNE des nouvelles. `orders` arrive trié du
     plus récent au plus ancien, donc c'est la dernière du tableau — celle qui
     attend depuis le plus longtemps, et donc celle qu'on traite. */
  const nouvelles = parMaillon[0].siennes;
  const tete = nouvelles[nouvelles.length - 1] ?? null;
  const annulees = counts.cancelled ?? 0;

  return (
    /* Le premier maillon est plus large que les autres : c'est le seul qui
       porte un geste, un montant par ligne et un nom de client en entier.
       À cinq colonnes égales, « Camille Renaud » devenait « Camille R… ». */
    <div className="grid grid-cols-1 overflow-hidden border border-border sm:grid-cols-2 lg:grid-cols-[1.45fr_1fr_1fr_1fr_1fr]">
      {parMaillon.map(({ status, siennes, sommeCents }, index) => {
        const enAttente = status === 'new' && siennes.length > 0;
        return (
          <div
            key={status}
            className={`flex flex-col gap-4 border-b border-border p-5 last:border-b-0 sm:border-r lg:border-b-0 lg:last:border-r-0 ${
              enAttente ? 'signal-plate' : 'bg-surface'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span
                className={`flex h-[22px] w-[22px] flex-shrink-0 items-center justify-center font-mono text-[10px] font-bold ${
                  enAttente ? 'bg-signal-ink/15 text-signal-ink' : 'bg-raised text-text-muted'
                }`}
              >
                {String(index + 1).padStart(2, '0')}
              </span>
              <span
                className={`font-mono text-[9.5px] font-bold uppercase leading-[1.4] tracking-[0.2em] ${
                  enAttente ? 'text-signal-ink' : 'text-text-muted'
                }`}
              >
                {ORDER_STATUS_LABELS[status]}
              </span>
              {enAttente && (
                <span className="ml-auto flex-shrink-0 bg-signal-ink px-2 py-1 font-mono text-[9.5px] font-bold uppercase tracking-[0.2em] text-signal">
                  À traiter
                </span>
              )}
            </div>

            <div>
              {/*
                Le chiffre du premier maillon est à l'échelle d'un titre — la
                seconde exception écrite de la règle 2, celle qui autorise un
                chiffre en ambre plutôt qu'en plaque. Ici il est DANS la plaque,
                donc en encre de signal : la règle tient sans exception.
              */}
              <p
                className={`tnum font-mono font-bold leading-[0.92] tracking-[-0.04em] ${
                  enAttente ? 'text-[56px] text-signal-ink' : 'text-[36px] text-text-primary'
                }`}
              >
                {siennes.length}
              </p>
              <p
                className={`tnum mt-2 font-mono text-[12.5px] tracking-[0.1em] ${
                  enAttente ? 'text-signal-ink/75' : 'text-text-muted'
                }`}
              >
                {formatCents(sommeCents)}
              </p>
            </div>

            {siennes.length > 0 && (
              <ul className="flex flex-col">
                {siennes.slice(0, 3).map((order) => (
                  <li
                    key={order.id}
                    className={`flex items-baseline gap-2 py-2 ${
                      enAttente ? 'border-t border-signal-ink/15 first:border-t-0' : ''
                    }`}
                  >
                    <span
                      className={`tnum flex-shrink-0 font-mono text-[11px] ${
                        enAttente ? 'text-signal-ink/70' : 'text-text-muted'
                      }`}
                    >
                      {order.reference || '—'}
                    </span>
                    <span
                      className={`min-w-0 flex-1 truncate text-[12.5px] ${
                        enAttente ? 'font-semibold text-signal-ink' : 'text-text-secondary'
                      }`}
                    >
                      {order.customer.name}
                    </span>
                    {enAttente && (
                      <span className="tnum flex-shrink-0 font-mono text-[11px] text-signal-ink">
                        {formatCents(orderTotals(order.lines).grossCents)}
                      </span>
                    )}
                  </li>
                ))}
                {siennes.length > 3 && (
                  <li className={`pt-2 font-mono text-[11px] ${enAttente ? 'text-signal-ink/70' : 'text-text-muted'}`}>
                    + {siennes.length - 3}
                  </li>
                )}
              </ul>
            )}

            {/*
              LE GESTE NOMME SA CIBLE.

              « Marquer confirmée » sous une colonne qui compte six commandes
              ne dit pas laquelle il touche — et un bouton qui agirait sur les
              six serait une action de masse déguisée en bouton ordinaire. Il
              porte donc la référence de la tête de file.
            */}
            {enAttente && tete && (
              <div className="mt-auto flex flex-col gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => onConfirmer(tete)}
                  className="min-h-11 bg-signal-ink px-4 text-[12.5px] font-semibold text-text-primary transition-opacity hover:opacity-90"
                >
                  Confirmer {tete.reference || 'la plus ancienne'}
                </button>
                <button
                  type="button"
                  onClick={() => onFacturer(tete)}
                  disabled={Boolean(tete.invoiceId)}
                  className="font-mono text-[9.5px] font-bold uppercase leading-[1.5] tracking-[0.2em] text-signal-ink/75 underline-offset-4 transition-opacity hover:underline disabled:no-underline disabled:opacity-50"
                >
                  {tete.invoiceId ? 'Brouillon de facture déjà créé' : 'ou créer un brouillon de facture'}
                </button>
              </div>
            )}

            {status === 'delivered' && annulees > 0 && (
              <p className="mt-auto font-mono text-[9.5px] uppercase leading-[1.6] tracking-[0.2em] text-text-muted">
                {annulees} annulée{annulees > 1 ? 's' : ''} · hors chaîne
              </p>
            )}

            {siennes.length > 0 && !enAttente && (
              <button
                type="button"
                onClick={() => onFiltrer(status)}
                className="mt-auto self-start font-mono text-[9.5px] font-bold uppercase tracking-[0.2em] text-text-muted underline-offset-4 transition-colors hover:text-text-primary hover:underline"
              >
                Voir
              </button>
            )}
          </div>
        );
      })}
    </div>
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
                <Package size={13} strokeWidth={1.9} aria-hidden />
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
                <ReceiptEuro size={13} strokeWidth={1.9} aria-hidden />
                Facture créée
              </span>
            ) : (
              order.status !== 'cancelled' && (
                <button
                  type="button"
                  onClick={onInvoice}
                  className="input-focus flex min-h-11 items-center gap-1.5 border border-border px-3 text-xs text-text-secondary transition-colors hover:text-text-primary md:min-h-0 md:py-2"
                >
                  <ReceiptEuro size={13} strokeWidth={1.9} aria-hidden />
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
