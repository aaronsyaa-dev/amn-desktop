import { useCallback, useMemo } from 'react';
import { useCollection, useSync } from './SyncContext';
import { lineAmounts } from '../lib/money';
import type { Order, OrderData, OrderLine, OrderStatus } from '../shared/api';

/**
 * Les commandes reçues du site public.
 *
 * Rien n'est créé ici : les commandes ARRIVENT (voir `docs/COMMANDES.md` dans
 * amn-api). Ce module sert à les suivre — changer leur statut, en tirer une
 * facture — et il est délibérément mince pour cette raison.
 *
 * ## Le cycle de vie, et pourquoi il est fermé
 *
 *   nouvelle → confirmée → en préparation → expédiée → livrée
 *        └──────────────── annulée ────────────────┘
 *
 * Les transitions sont DÉCLARÉES (`NEXT_STATUSES`) plutôt que laissées libres.
 * Un menu qui propose les six statuts à tout moment laisse marquer « livrée »
 * une commande jamais confirmée — et personne ne s'en aperçoit avant que le
 * client ne réclame. Ici l'écran ne propose que ce qui a un sens ensuite.
 *
 * Une commande annulée ou livrée est TERMINÉE : on n'en ressort pas. Se
 * tromper reste possible, mais demande de le dire — pas un clic de trop dans
 * une liste déroulante.
 */

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  new: 'Nouvelle',
  confirmed: 'Confirmée',
  preparing: 'En préparation',
  shipped: 'Expédiée',
  delivered: 'Livrée',
  cancelled: 'Annulée',
};

/** Ce qu'on peut faire APRÈS chaque statut. Voir l'en-tête. */
export const NEXT_STATUSES: Record<OrderStatus, OrderStatus[]> = {
  new: ['confirmed', 'cancelled'],
  confirmed: ['preparing', 'cancelled'],
  preparing: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
};

/** L'ordre d'affichage : ce qui demande une action d'abord. */
export const STATUS_ORDER: OrderStatus[] = [
  'new',
  'confirmed',
  'preparing',
  'shipped',
  'delivered',
  'cancelled',
];

/** Une commande à traiter — ni livrée, ni annulée. */
export function isOpen(order: Order): boolean {
  return order.status !== 'delivered' && order.status !== 'cancelled';
}

/**
 * Le total d'une commande, recalculé depuis ses lignes.
 *
 * Le serveur l'a déjà calculé et rangé dans `totalCents` ; on le recalcule ici
 * plutôt que de le croire, parce que c'est le même `lineAmounts` qui servira à
 * la facture. Si les deux nombres divergeaient un jour, c'est ici qu'on le
 * verrait — et non chez le client, sur une facture qui ne correspond pas à sa
 * commande.
 */
export function orderTotals(lines: OrderLine[]): { netCents: number; vatCents: number; grossCents: number } {
  return lines.reduce(
    (sum, line) => {
      const amounts = lineAmounts(line.quantity, line.unitPriceCents, line.vatRate);
      return {
        netCents: sum.netCents + amounts.netCents,
        vatCents: sum.vatCents + amounts.vatCents,
        grossCents: sum.grossCents + amounts.grossCents,
      };
    },
    { netCents: 0, vatCents: 0, grossCents: 0 },
  );
}

export function useOrders() {
  const records = useCollection<OrderData>('orders');
  const { upsert } = useSync();

  const orders = useMemo<Order[]>(
    () =>
      records
        // `useCollection` rend déjà les données à plat, `id` compris.
        .slice()
        // La plus récente en tête : une commande qui vient d'arriver est celle
        // qu'on ouvre.
        .sort((a, b) => String(b.placedAt).localeCompare(String(a.placedAt))),
    [records],
  );

  /** Combien de commandes attendent, par statut. */
  const counts = useMemo(() => {
    const out = Object.fromEntries(STATUS_ORDER.map((s) => [s, 0])) as Record<OrderStatus, number>;
    for (const order of orders) out[order.status] = (out[order.status] ?? 0) + 1;
    return out;
  }, [orders]);

  const setStatus = useCallback(
    (order: Order, status: OrderStatus) => {
      // Le garde-fou est ici, pas seulement dans l'écran : une transition
      // interdite ne doit pas pouvoir passer par un autre chemin d'appel.
      if (!NEXT_STATUSES[order.status].includes(status)) return;
      const { id, ...data } = order;
      upsert('orders', id, { ...data, status });
    },
    [upsert],
  );

  /** Enregistre la facture tirée d'une commande. */
  const attachInvoice = useCallback(
    (order: Order, invoiceId: string) => {
      const { id, ...data } = order;
      upsert('orders', id, { ...data, invoiceId });
    },
    [upsert],
  );

  return { orders, counts, setStatus, attachInvoice };
}
