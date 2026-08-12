import { useEffect, useMemo, useState } from 'react';
import { useCollection } from './SyncContext';
import { useClients } from './useClients';
import { useInvoices } from './useInvoices';
import { useAppointments } from './useAppointments';
import { attentionItems, type AttentionCertificate, type AttentionItem } from '../lib/attention';
import { documentTotals } from '../lib/money';
import { bridge } from '../lib/bridge';
import { IS_BUSINESS } from '../edition/edition';
import { oneOf } from '../lib/records';
import type { SharedTaskStatus } from '../shared/api';

/**
 * Branche le moteur des points d'attention sur les données réellement
 * synchronisées.
 *
 * Tout le raisonnement vit dans `src/lib/attention.ts`, qui ne dépend de rien
 * et se contrôle hors application (`npm run check:attention`). Ce fichier ne
 * fait que traduire : il lit les collections, en extrait les quelques champs
 * qui comptent, et laisse le moteur décider. C'est volontaire — dès qu'une
 * règle métier remonte dans un hook React, elle cesse d'être testable
 * autrement qu'en montant un écran.
 */

const TASK_STATUSES: SharedTaskStatus[] = ['todo', 'doing', 'done'];

interface TaskRow {
  title?: string;
  status?: string;
  createdAt?: string;
}

export function useAttention(): { items: AttentionItem[]; ready: boolean } {
  const { clients, ready: clientsReady } = useClients();
  const { invoices } = useInvoices();
  const { appointments } = useAppointments();
  const tasks = useCollection<TaskRow>('tasks');
  const certificates = useCertificates();

  const items = useMemo(() => {
    /*
      Les traces d'un client : tout ce qui prouve qu'il s'est passé quelque
      chose avec lui. Rassemblées ici plutôt que dans le moteur parce que
      c'est un travail de jointure entre collections, pas une règle.
    */
    const tracesByClient = new Map<number, string[]>();
    const push = (clientId: number | null | undefined, date: string | undefined) => {
      if (typeof clientId !== 'number' || !date) return;
      const list = tracesByClient.get(clientId);
      if (list) list.push(date);
      else tracesByClient.set(clientId, [date]);
    };
    for (const appointment of appointments) push(appointment.clientId, appointment.startAt);
    for (const invoice of invoices) {
      push(invoice.clientId, invoice.issuedAt);
      push(invoice.clientId, invoice.paidAt);
      push(invoice.clientId, invoice.updatedAt);
    }
    for (const client of clients) {
      for (const event of client.events ?? []) push(client.id, event.date);
    }

    return attentionItems({
      invoices: invoices.map((invoice) => ({
        id: invoice.id,
        number: invoice.number,
        status: invoice.status,
        issuedAt: invoice.issuedAt,
        dueAt: invoice.dueAt,
        clientName: invoice.billTo.company || invoice.billTo.name,
        totalCents: documentTotals(invoice.lines).grossCents,
      })),
      tasks: tasks.map((task) => ({
        id: task.id,
        title: task.title ?? '',
        // Un statut hérité ou mal écrit doit redevenir « à faire » et non
        // disparaître : sans ce garde-fou, une tâche au statut inconnu ne
        // serait jamais signalée, précisément parce qu'elle est cassée.
        status: oneOf(task.status, TASK_STATUSES, 'todo'),
        createdAt: task.createdAt ?? task.updatedAt,
        updatedAt: task.updatedAt,
      })),
      clients: clients.map((client) => ({
        id: client.id,
        label: client.company || client.name,
        status: client.status,
        createdAt: client.createdAt,
        updatedAt: client.updatedAt,
        traces: tracesByClient.get(client.id) ?? [],
      })),
      certificates,
    });
  }, [invoices, tasks, clients, appointments, certificates]);

  return { items, ready: clientsReady };
}

/**
 * Les certificats des sites supervisés.
 *
 * Absents de l'édition Business : une organisation cliente n'a pas de parc de
 * sites, donc pas de `/v1/ssl` à interroger. Le garde-fou évite une requête
 * qui ne pourrait au mieux que rendre une liste vide.
 *
 * Un échec de lecture laisse la liste vide plutôt que de faire tomber
 * l'écran : les alertes de facturation et de tâches n'ont aucune raison de
 * disparaître parce que le serveur SSL ne répond pas.
 */
function useCertificates(): AttentionCertificate[] {
  const [certificates, setCertificates] = useState<AttentionCertificate[]>([]);

  useEffect(() => {
    if (IS_BUSINESS) return;
    let cancelled = false;
    (async () => {
      try {
        const statuses = await bridge().remote.listSslStatus();
        if (cancelled) return;
        setCertificates(
          statuses.map((status) => ({
            host: status.host,
            daysLeft: status.daysLeft,
            error: status.error,
            lastCheckedAt: status.lastCheckedAt,
          })),
        );
      } catch {
        if (!cancelled) setCertificates([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return certificates;
}
