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
import { useCollection } from '../state/SyncContext';
import { useClients } from '../state/useClients';
import { useHaloSignal } from '../components/EtatEcran';

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

  /*
    LA PILE : les commandes NON TRAITÉES, LA PLUS ANCIENNE SUR LE DESSUS.

    C'est l'inverse d'une pile de comptoir, où le dernier arrivé se pose au
    sommet — et c'est voulu. Le bon du dessus est celui qu'ON TRAITE, donc
    celui qui attend depuis le plus longtemps ; le plus récent peut attendre
    une journée de plus sans que personne s'en plaigne.

    Ça règle aussi une divergence, vue sur capture : la chaîne de traitement,
    plus bas, propose depuis toujours « Confirmer #1835 » — la plus ancienne.
    Avec la plus récente sur le dessus, l'écran désignait DEUX commandes
    différentes comme « celle qu'on traite ». Un écran ne peut pas avoir deux
    avis sur la même question.
  */
  const aTraiter = useMemo(
    () => orders.filter((o) => o.status === 'new').sort((a, b) => a.placedAt.localeCompare(b.placedAt)),
    [orders],
  );
  /* Le stock se rapproche des lignes par NOM d'article : le modèle de stock
     n'a pas de référence, seulement un `name`. Dit ici plutôt que découvert
     devant une réservation qui ne trouve rien. */
  const stockItems = useCollection<{ name: string; quantity: number; minQuantity: number | null }>(
    'stockItems',
  );
  const { clients } = useClients();

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

      {/* ───────────────────────────── LA PILE DE BONS — la dominante (`14c`) */}
      {aTraiter.length > 0 && (
        <motion.div variants={staggerItem}>
          <PileDeBons
            aTraiter={aTraiter}
            stock={stockItems}
            clients={clients}
            onConfirmer={(order) => setStatus(order, 'confirmed')}
            onAnnuler={(order) => setStatus(order, 'cancelled')}
            onFacturer={invoice}
          />
        </motion.div>
      )}

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
        /*
          LE PREMIER MAILLON N'EST PLUS AMBRE.

          Il l'était — plaque pleine, chiffre en encre de signal — et c'était
          juste tant que la chaîne était l'objet dominant. Elle ne l'est plus :
          la PILE DE BONS l'est (`14c`), et son unique ambre est la mention
          « à traiter » sur le bon du dessus. Deux plaques ambres sur le même
          écran, c'est zéro plaque ambre. La chaîne garde son relief — plan
          levé, filet, chiffre en encre claire — ce qui suffit à dire qu'elle
          commence là.
        */
        const premier = status === 'new' && siennes.length > 0;
        return (
          <div
            key={status}
            className={`flex flex-col gap-4 border-b border-border p-5 last:border-b-0 sm:border-r lg:border-b-0 lg:last:border-r-0 ${
              premier ? 'bg-raised shadow-[inset_0_1px_0_rgba(255,255,255,.06)]' : 'bg-surface'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span
                className={`flex h-[22px] w-[22px] flex-shrink-0 items-center justify-center font-mono text-[10px] font-bold ${
                  premier ? 'bg-elevated text-text-primary' : 'bg-raised text-text-muted'
                }`}
              >
                {String(index + 1).padStart(2, '0')}
              </span>
              <span
                className={`font-mono text-[9.5px] font-bold uppercase leading-[1.4] tracking-[0.2em] ${
                  premier ? 'text-text-secondary' : 'text-text-muted'
                }`}
              >
                {ORDER_STATUS_LABELS[status]}
              </span>
              {/*
                PAS DE SECONDE MENTION « À TRAITER ». Elle est sur le bon du
                dessus, dans la pile, et c'est le seul ambre de l'écran.
              */}
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
                  premier ? 'text-[56px] text-text-primary' : 'text-[36px] text-text-secondary'
                }`}
              >
                {siennes.length}
              </p>
              <p
                className={`tnum mt-2 font-mono text-[12.5px] tracking-[0.1em] ${
                  premier ? 'text-text-secondary' : 'text-text-muted'
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
                      premier ? 'border-t border-border-row first:border-t-0' : ''
                    }`}
                  >
                    <span
                      className={`tnum flex-shrink-0 font-mono text-[11px] ${
                        premier ? 'text-text-muted' : 'text-text-muted'
                      }`}
                    >
                      {order.reference || '—'}
                    </span>
                    <span
                      className={`min-w-0 flex-1 truncate text-[12.5px] ${
                        premier ? 'font-semibold text-text-primary' : 'text-text-secondary'
                      }`}
                    >
                      {order.customer.name}
                    </span>
                    {premier && (
                      <span className="tnum flex-shrink-0 font-mono text-[11px] text-text-primary">
                        {formatCents(orderTotals(order.lines).grossCents)}
                      </span>
                    )}
                  </li>
                ))}
                {siennes.length > 3 && (
                  <li className={`pt-2 font-mono text-[11px] ${premier ? 'text-text-muted' : 'text-text-muted'}`}>
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
            {premier && tete && (
              <div className="mt-auto flex flex-col gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => onConfirmer(tete)}
                  className="min-h-11 bg-accent px-4 text-[12.5px] font-semibold text-bg transition-colors hover:bg-accent-hover"
                >
                  Confirmer {tete.reference || 'la plus ancienne'}
                </button>
                <button
                  type="button"
                  onClick={() => onFacturer(tete)}
                  disabled={Boolean(tete.invoiceId)}
                  className="font-mono text-[9.5px] font-bold uppercase leading-[1.5] tracking-[0.2em] text-text-muted underline-offset-4 transition-opacity hover:underline disabled:no-underline disabled:opacity-50"
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

            {siennes.length > 0 && !premier && (
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

/* ------------------------------------------------ la pile de bons (`14c`) -- */

/**
 * LA PILE DE BONS — l'objet dominant de Commandes (`14c`).
 *
 * C'est le seul objet du produit qui ne soit PAS une mesure. Le module ne
 * calcule rien : la **profondeur de la pile est le retard**. Quatre feuilles
 * posées en biais disent « il y en a un paquet » avant qu'on ait lu un
 * chiffre, et c'est exactement ce qu'on veut savoir en ouvrant l'écran.
 *
 * Celle du dessus est complète et lisible — c'est celle qu'on traite. Les
 * trois autres sont réduites à leur silhouette : les rendre lisibles aussi
 * ferait quatre documents à lire, c'est-à-dire une liste, et une liste ne dit
 * pas la profondeur.
 *
 * DEUX RÈGLES DU PAQUET :
 *
 *   1. **Rien ne se crée ici.** Les commandes arrivent du site public ; le
 *      module n'a pas de bouton « nouvelle commande », et n'en aura pas.
 *   2. **Quatre épaisseurs au maximum**, et le reste est annoncé en texte.
 *      Une pile de quarante feuilles ne se lit pas mieux qu'une pile de
 *      quatre — elle devient une masse, et on perd le bon du dessus.
 */
const BON_L = 228;
const BON_H = 268;
const BON_DX = 13;
const BON_DY = 10;
const BON_MAX = 4;

/** Normalise un intitulé pour le rapprocher d'un article de stock. */
function nomNormalise(v: string): string {
  return v.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function PileDeBons({
  aTraiter,
  stock,
  clients,
  onConfirmer,
  onAnnuler,
  onFacturer,
}: {
  aTraiter: Order[];
  stock: { id: string; name: string; quantity: number; minQuantity: number | null }[];
  clients: { id: number; name: string; email: string; status: string }[];
  onConfirmer: (order: Order) => void;
  onAnnuler: (order: Order) => void;
  onFacturer: (order: Order) => void;
}) {
  const halo = useHaloSignal(aTraiter.length > 0);
  const dessus = aTraiter[0];
  const dessous = aTraiter.slice(1, BON_MAX);
  const reste = Math.max(0, aTraiter.length - BON_MAX);

  /*
    CE QUE L'ACCEPTATION DÉCLENCHE. Trois faits, tous LUS dans les données :
    ce qu'il faut sortir du stock, si l'acheteur a une fiche, et depuis quand
    le bon attend. Le modèle de commande n'a PAS de date souhaitée — le site
    public ne la demande pas — donc l'écran dit la date d'arrivée et le délai,
    et ne prétend pas connaître une échéance qu'il n'a pas.
  */
  const besoins = useMemo(
    () =>
      dessus.lines.map((ligne) => {
        const article = stock.find((a) => nomNormalise(a.name) === nomNormalise(ligne.label));
        return {
          ligne,
          article,
          manque: article ? Math.max(0, ligne.quantity - article.quantity) : 0,
          inconnu: !article,
        };
      }),
    [dessus, stock],
  );
  const fiche = useMemo(
    () =>
      clients.find(
        (c) =>
          (dessus.customer.email && c.email?.toLowerCase() === dessus.customer.email.toLowerCase()) ||
          nomNormalise(c.name) === nomNormalise(dessus.customer.name),
      ) ?? null,
    [clients, dessus],
  );
  const attenteJours = Math.max(
    0,
    Math.round((Date.now() - new Date(dessus.placedAt).getTime()) / 86_400_000),
  );

  return (
    <section className="panel-raised panel-raised-wide panel-ticks px-6 py-6">
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <p className="eyebrow">Bons reçus du site · non traités</p>
        <p className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-text-muted">
          la profondeur de la pile est le retard
        </p>
      </div>

      <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
        {/* LA PILE. Les silhouettes d'abord, décalées ; le bon lisible dessus. */}
        <div
          className="relative flex-shrink-0"
          style={{ width: BON_L + (BON_MAX - 1) * BON_DX, height: BON_H + (BON_MAX - 1) * BON_DY }}
        >
          {dessous
            .slice()
            .reverse()
            .map((o, i) => {
              /* L'index inversé : la feuille la plus profonde est la plus
                 décalée, et se dessine EN PREMIER pour passer dessous. */
              const rang = dessous.length - i;
              return (
                <div
                  key={o.id}
                  aria-hidden
                  className="absolute border border-border-sheet bg-sheet"
                  style={{
                    left: rang * BON_DX,
                    top: rang * BON_DY,
                    width: BON_L,
                    height: BON_H,
                  }}
                >
                  <span className="mt-6 block h-px w-1/2 bg-border" />
                  <span className="mt-4 block h-px w-3/4 bg-border" />
                  <span className="mt-3 block h-px w-2/3 bg-border" />
                </div>
              );
            })}

          <div
            className="panel-sheet absolute flex flex-col"
            style={{ left: 0, top: 0, width: BON_L, height: BON_H }}
          >
            <div className="flex items-center justify-between gap-2 border-b border-border-sheet px-4 py-3">
              <span className="tnum font-mono text-[10px] uppercase tracking-[0.14em] text-text-secondary">
                {dessus.reference || 'sans référence'}
              </span>
              {/*
                L'UNIQUE AMBRE DE L'ÉCRAN : la mention « à traiter » sur le bon
                du dessus. Plaque pleine, encre noire — un nœud, et c'est assez.
              */}
              <span
                className={`signal-plate px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.2em] ${halo}`}
                data-signal-groupe="a-traiter"
              >
                À traiter
              </span>
            </div>
            <div className="flex min-h-0 flex-1 flex-col gap-2 px-4 py-3">
              <p className="truncate text-[16px] font-semibold text-text-primary">
                {dessus.customer.name}
              </p>
              <p className="tnum font-mono text-[9.5px] uppercase tracking-[0.14em] text-text-muted">
                arrivé le {formatJourCourt(dessus.placedAt)} · {attenteJours} j
              </p>
              <div className="mt-1 flex min-h-0 flex-1 flex-col gap-1.5 overflow-hidden">
                {dessus.lines.slice(0, 4).map((l, i) => (
                  <div key={i} className="flex items-baseline justify-between gap-2">
                    <span className="min-w-0 flex-1 truncate text-[12.5px] text-text-body">
                      {l.label}
                    </span>
                    <span className="tnum flex-shrink-0 font-mono text-[11px] text-text-muted">
                      × {l.quantity}
                    </span>
                  </div>
                ))}
                {dessus.lines.length > 4 && (
                  <p className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-text-muted">
                    et {dessus.lines.length - 4} lignes de plus
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-baseline justify-between gap-2 border-t border-border-sheet px-4 py-3">
              <span className="eyebrow">Total</span>
              <span className="tnum font-mono text-[20px] font-semibold tracking-[-0.03em] text-text-primary">
                {formatCents(dessus.totalCents)}
              </span>
            </div>
          </div>
        </div>

        {/* CE QUE L'ACCEPTATION DÉCLENCHE. */}
        <div className="min-w-0 flex-1">
          <p className="eyebrow mb-4">Ce que l’acceptation déclenche</p>

          <div className="flex flex-col divide-y divide-border-row">
            <div className="flex items-baseline justify-between gap-4 py-2.5">
              <span className="text-[13px] text-text-secondary">Une intervention à caler</span>
              <span className="tnum flex-shrink-0 font-mono text-[12.5px] text-text-primary">
                bon reçu le {formatJourCourt(dessus.placedAt)}
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-4 py-2.5">
              <span className="text-[13px] text-text-secondary">Le statut de l’acheteur</span>
              <span className="flex-shrink-0 font-mono text-[12.5px] text-text-primary">
                {fiche ? `au fichier · ${fiche.status}` : 'pas encore au fichier'}
              </span>
            </div>
          </div>

          <p className="eyebrow mb-2 mt-5">Réservation de stock</p>
          <div className="flex flex-col divide-y divide-border-row">
            {besoins.map((b, i) => (
              <div key={i} className="flex items-baseline justify-between gap-4 py-2.5">
                <span className="min-w-0 flex-1 truncate text-[13px] text-text-secondary">
                  {b.ligne.label}
                </span>
                <span className="tnum flex-shrink-0 font-mono text-[12.5px] text-text-muted">
                  × {b.ligne.quantity}
                </span>
                {/*
                  LE ROUGE, ET SEULEMENT LÀ. Un article qui manque empêche de
                  livrer : c'est la seule situation de cet écran qui appelle un
                  geste immédiat, et le rationnement du rouge (docs/ROUGE.md)
                  la réserve à ça.
                */}
                <span
                  className={`tnum w-[132px] flex-shrink-0 text-right font-mono text-[12.5px] ${
                    b.manque > 0 ? 'text-danger' : 'text-text-primary'
                  }`}
                >
                  {b.inconnu
                    ? 'hors stock suivi'
                    : b.manque > 0
                      ? `il manque ${b.manque}`
                      : `${b.article?.quantity} en stock`}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => onConfirmer(dessus)}
              className="min-h-11 bg-accent px-4 text-[12.5px] font-semibold text-bg shadow-[0_12px_26px_-12px_rgba(0,0,0,.9)] transition-colors hover:bg-accent-hover md:min-h-0 md:py-2.5"
            >
              Confirmer la commande
            </button>
            <button
              type="button"
              onClick={() => onFacturer(dessus)}
              disabled={!!dessus.invoiceId}
              className="min-h-11 border border-border-strong px-4 text-[12.5px] font-semibold text-text-primary transition-colors hover:bg-surface-hover disabled:opacity-40 md:min-h-0 md:py-2.5"
            >
              {dessus.invoiceId ? 'Facture déjà tirée' : 'Tirer une facture'}
            </button>
            <button
              type="button"
              onClick={() => onAnnuler(dessus)}
              className="min-h-11 px-2 font-mono text-[9.5px] font-bold uppercase tracking-[0.2em] text-text-muted underline-offset-4 transition-colors hover:text-text-primary hover:underline md:min-h-0"
            >
              Annuler
            </button>
          </div>

          <p className="mt-5 border-t border-border-row pt-3 text-[12.5px] leading-relaxed text-text-muted">
            {reste > 0
              ? `La pile en montre quatre ; ${reste} autre${reste > 1 ? 's' : ''} attend${reste > 1 ? 'ent' : ''} derrière, dans le tableau plus bas.`
              : `${aTraiter.length} bon${aTraiter.length > 1 ? 's' : ''} en attente — la pile les montre tous.`}{' '}
            Rien ne se crée ici : les commandes arrivent du site public.
          </p>
        </div>
      </div>

      {/* LES BONS DE DESSOUS, en tableau — la pile les cache, le tableau les nomme. */}
      {dessous.length > 0 && (
        <div className="mt-7 border-t border-border-raised pt-5">
          <p className="eyebrow mb-3">Sous celui du dessus</p>
          <div className="flex flex-col divide-y divide-border-row">
            {dessous.map((o) => (
              <div key={o.id} className="flex flex-wrap items-baseline gap-x-5 gap-y-1 py-2.5">
                <span className="tnum w-[104px] flex-shrink-0 font-mono text-[11px] uppercase tracking-[0.14em] text-text-muted">
                  {o.reference || '—'}
                </span>
                <span className="min-w-0 flex-1 truncate text-[13.5px] text-text-primary">
                  {o.customer.name}
                </span>
                <span className="tnum w-[92px] flex-shrink-0 text-right font-mono text-[11px] uppercase tracking-[0.14em] text-text-muted">
                  {formatJourCourt(o.placedAt)}
                </span>
                <span className="tnum w-[104px] flex-shrink-0 text-right font-mono text-[13px] font-semibold text-text-primary">
                  {formatCents(o.totalCents)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

/** « 12 sept. » — une date de bon se lit d'un coup d'œil, l'année ne sert pas. */
function formatJourCourt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}
