import { useEffect, useMemo, useRef, useState } from 'react';
import { useCollection } from './SyncContext';
import { useClients } from './useClients';
import { useInvoices } from './useInvoices';
import { useAppointments } from './useAppointments';
import {
  attentionItems,
  type AttentionCertificate,
  type AttentionIncident,
  type AttentionItem,
  type AttentionScan,
} from '../lib/attention';
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

export interface AttentionState {
  items: AttentionItem[];
  /**
   * L'instant de la dernière évaluation COMPLÈTE, ou `null` si aucune n'a
   * encore eu lieu.
   *
   * C'est la distinction qui compte, et elle a été trouvée en usage réel :
   * une liste vide peut vouloir dire « rien à signaler » ou « je n'ai pas
   * encore regardé », et un écran qui affiche la même chose dans les deux cas
   * laisse croire qu'il est cassé. `checkedAt` n'est posé que lorsque TOUTES
   * les sources ont répondu — la synchronisation des collections ET la lecture
   * des certificats.
   */
  checkedAt: string | null;
}

export function useAttention(): AttentionState {
  const { clients, ready: clientsReady } = useClients();
  const { invoices } = useInvoices();
  const { appointments } = useAppointments();
  const tasks = useCollection<TaskRow>('tasks');
  const { certificates, settled: certificatesSettled } = useCertificates();
  const { incidents, settled: incidentsSettled } = useIncidentsOuverts();
  const { scans, settled: scansSettled } = useBalayagesRecents();

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
      incidents,
      scans,
    });
  }, [invoices, tasks, clients, appointments, certificates, incidents, scans]);

  /*
    Horodater l'évaluation, et seulement quand elle vaut quelque chose.

    `useRef` plutôt qu'un état : le rendu n'a pas besoin de se relancer parce
    que l'heure a changé, et un `setState` à chaque recalcul d'`items`
    rejouerait le rendu une fois de plus pour rien.
  */
  const complete = clientsReady && certificatesSettled && incidentsSettled && scansSettled;
  const checkedAt = useRef<string | null>(null);
  if (complete) checkedAt.current = new Date().toISOString();

  return { items, checkedAt: complete ? checkedAt.current : null };
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
function useCertificates(): { certificates: AttentionCertificate[]; settled: boolean } {
  const [certificates, setCertificates] = useState<AttentionCertificate[]>([]);
  // `settled` vaut « la question a été posée et tranchée », pas « il y a des
  // certificats ». Un échec de lecture est une réponse : il ne doit pas laisser
  // l'écran croire indéfiniment qu'il n'a pas fini de regarder.
  const [settled, setSettled] = useState(IS_BUSINESS);

  useEffect(() => {
    // Édition Business : aucune organisation cliente n'a de parc de sites,
    // donc pas de `/v1/ssl` à interroger. Déjà « tranché » à l'initialisation.
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
        // Les alertes de facturation et de tâches n'ont aucune raison de
        // disparaître parce que le serveur SSL ne répond pas.
        if (!cancelled) setCertificates([]);
      } finally {
        if (!cancelled) setSettled(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { certificates, settled };
}

/**
 * Les incidents de supervision ENCORE OUVERTS.
 *
 * Même forme que les certificats, et pour les mêmes raisons : absent de
 * l'édition Business (une cliente n'a pas de parc à superviser), un échec de
 * lecture rend une liste vide plutôt que de faire tomber le panneau, et
 * `settled` distingue « rien à signaler » de « je n'ai pas encore regardé ».
 *
 * La ronde est plus fréquente que celle des certificats — une minute — parce
 * qu'un incident vit à une autre échelle : un certificat expire dans trois
 * semaines, une intrusion se joue dans l'heure.
 */
/**
 * LES BALAYAGES RÉCENTS, pour la seule question qu'on leur pose : le score
 * a-t-il baissé.
 *
 * Lu UNE FOIS, sans ronde, contrairement aux incidents. Un balayage est
 * hebdomadaire ou mensuel : le relire toutes les minutes interrogerait le
 * serveur mille fois pour une valeur qui change six fois par an. La liste se
 * rafraîchit au prochain montage de l'écran, ce qui est amplement à l'échelle
 * de la chose observée.
 *
 * La comparaison, elle, vit dans `lib/attention.ts` — ce hook ne fait que
 * traduire, comme les deux autres.
 */
function useBalayagesRecents(): { scans: AttentionScan[]; settled: boolean } {
  const [scans, setScans] = useState<AttentionScan[]>([]);
  const [settled, setSettled] = useState(IS_BUSINESS);

  useEffect(() => {
    // Le Scanner est un produit de l'édition interne : une organisation
    // cliente n'a pas de `/v1/scans` à interroger.
    if (IS_BUSINESS) return;
    let cancelled = false;
    (async () => {
      try {
        const liste = await bridge().remote.listScans();
        if (cancelled) return;
        setScans(
          liste.map((s) => ({
            id: s.id,
            url: s.url,
            tier: s.tier,
            score: s.score,
            finishedAt: s.finishedAt,
          })),
        );
      } catch {
        if (!cancelled) setScans([]);
      } finally {
        if (!cancelled) setSettled(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { scans, settled };
}

function useIncidentsOuverts(): { incidents: AttentionIncident[]; settled: boolean } {
  const [incidents, setIncidents] = useState<AttentionIncident[]>([]);
  const [settled, setSettled] = useState(IS_BUSINESS);

  useEffect(() => {
    if (IS_BUSINESS) return;
    let cancelled = false;

    const lire = async () => {
      try {
        const liste = await bridge().remote.listIncidents({ status: 'open' });
        if (cancelled) return;
        setIncidents(
          liste.map((i) => ({
            id: i.id,
            title: i.title,
            siteName: i.siteName ?? null,
            severity: i.severity,
            status: i.status,
            firstSeenAt: i.firstSeenAt,
          })),
        );
      } catch {
        // Un serveur de supervision muet ne doit pas effacer les rappels de
        // facturation : ils n'ont rien à voir.
        if (!cancelled) setIncidents([]);
      } finally {
        if (!cancelled) setSettled(true);
      }
    };

    void lire();
    const t = window.setInterval(() => {
      if (!document.hidden) void lire();
    }, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, []);

  return { incidents, settled };
}
