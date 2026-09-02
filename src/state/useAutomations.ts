import { useEffect, useMemo, useRef } from 'react';
import { useSync, useCollection } from './SyncContext';

/**
 * LE MOTEUR DES AUTOMATISATIONS — « si X alors Y », sur ce qui existe déjà.
 *
 * Une règle observe une collection (réponses de formulaire, factures,
 * SAV, prospects, stock) et, pour chaque enregistrement qui remplit la
 * condition, crée UNE tâche ou UNE entrée de journal. L'identifiant du
 * résultat est déterministe (`auto-<règle>-<source>`) : deux postes ouverts
 * en même temps écrivent le même enregistrement, jamais deux. Aucune liste
 * « déjà traité » à tenir, donc aucune dérive possible entre postes.
 *
 * Le moteur tourne dans la mise en page, pas dans l'écran : les règles
 * s'appliquent tant qu'un poste de l'organisation est ouvert, pas seulement
 * quand quelqu'un regarde l'écran Automatisations.
 */
export type Declencheur = 'formAnswer' | 'invoiceOverdue' | 'ticketOpened' | 'prospectWon' | 'stockLow';
export type Action = 'task' | 'logbook';
export interface AutomationData {
  trigger: Declencheur;
  action: Action;
  enabled: boolean;
  assigneeEmail: string;
  createdAt: string;
}
export const DECLENCHEURS: Declencheur[] = ['formAnswer', 'invoiceOverdue', 'ticketOpened', 'prospectWon', 'stockLow'];
export const ACTIONS: Action[] = ['task', 'logbook'];

interface Source {
  id: string;
  titre: string;
  detail: string;
}
const isoJour = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Les enregistrements qui remplissent la condition d'un déclencheur, avec un titre lisible. */
export function sourcesPour(
  trigger: Declencheur,
  donnees: {
    formAnswers: { id: string; formId: string; answers: Record<string, string> }[];
    forms: { id: string; title: string }[];
    invoices: { id: string; number: string; status: string; paidAt: string; dueAt: string; billTo?: { name?: string } }[];
    tickets: { id: string; subject: string; client: string; status: string }[];
    prospects: { id: string; name: string; company: string; stage: string }[];
    stockItems: { id: string; name: string; quantity: number; minQuantity: number | null }[];
  },
  libelles: Record<Declencheur, (a: string, b: string) => string>,
): Source[] {
  const aujourdhui = isoJour(new Date());
  switch (trigger) {
    case 'formAnswer':
      return donnees.formAnswers.map((r) => {
        const form = donnees.forms.find((f) => f.id === r.formId);
        const premiere = Object.values(r.answers)[0] ?? '';
        return { id: r.id, titre: libelles.formAnswer(form?.title ?? '', premiere), detail: Object.values(r.answers).join(' · ') };
      });
    case 'invoiceOverdue':
      return donnees.invoices
        .filter((f) => f.status === 'issued' && !f.paidAt && f.dueAt && f.dueAt < aujourdhui)
        .map((f) => ({ id: f.id, titre: libelles.invoiceOverdue(f.billTo?.name ?? '', f.number), detail: f.dueAt }));
    case 'ticketOpened':
      return donnees.tickets.filter((tk) => tk.status === 'ouvert').map((tk) => ({ id: tk.id, titre: libelles.ticketOpened(tk.subject, tk.client), detail: '' }));
    case 'prospectWon':
      return donnees.prospects.filter((p) => p.stage === 'gagne').map((p) => ({ id: p.id, titre: libelles.prospectWon(p.name, p.company), detail: '' }));
    case 'stockLow':
      return donnees.stockItems
        .filter((s) => s.minQuantity !== null && s.quantity <= s.minQuantity)
        .map((s) => ({ id: s.id, titre: libelles.stockLow(s.name, String(s.quantity)), detail: '' }));
    default:
      return [];
  }
}

export function useAutomations(libelles: Record<Declencheur, (a: string, b: string) => string>) {
  const { upsert } = useSync();
  const regles = useCollection<AutomationData>('automations');
  const formAnswers = useCollection<{ formId: string; answers: Record<string, string> }>('formAnswers');
  const forms = useCollection<{ title: string }>('forms');
  const invoices = useCollection<{ number: string; status: string; paidAt: string; dueAt: string; billTo?: { name?: string } }>('invoices');
  const tickets = useCollection<{ subject: string; client: string; status: string }>('tickets');
  const prospects = useCollection<{ name: string; company: string; stage: string }>('prospects');
  const stockItems = useCollection<{ name: string; quantity: number; minQuantity: number | null }>('stockItems');
  const tasks = useCollection<{ title: string }>('tasks');
  const logbook = useCollection<{ text: string }>('logbook');
  const enCours = useRef(new Set<string>());

  const aFaire = useMemo(() => {
    const existants = new Set([...tasks.map((x) => x.id), ...logbook.map((x) => x.id)]);
    const liste: { id: string; regle: AutomationData & { id: string }; source: Source }[] = [];
    for (const regle of regles) {
      if (!regle.enabled) continue;
      for (const source of sourcesPour(regle.trigger, { formAnswers, forms, invoices, tickets, prospects, stockItems }, libelles)) {
        const id = `auto-${regle.id}-${source.id}`;
        if (!existants.has(id)) liste.push({ id, regle, source });
      }
    }
    return liste;
  }, [regles, formAnswers, forms, invoices, tickets, prospects, stockItems, tasks, logbook, libelles]);

  useEffect(() => {
    for (const { id, regle, source } of aFaire) {
      if (enCours.current.has(id)) continue;
      enCours.current.add(id);
      const now = new Date().toISOString();
      const ecriture = regle.action === 'logbook'
        ? upsert('logbook', id, { text: source.titre, kind: 'note', byEmail: 'automatisation', at: now })
        : upsert('tasks', id, { title: source.titre, detail: source.detail, assigneeEmail: regle.assigneeEmail, status: 'todo', siteId: null, clientId: null, createdAt: now });
      void Promise.resolve(ecriture).finally(() => enCours.current.delete(id));
    }
  }, [aFaire, upsert]);

  const produits = useMemo(() => [...tasks, ...logbook].filter((x) => x.id.startsWith('auto-')).length, [tasks, logbook]);
  return { regles, produits, enAttente: aFaire.length };
}
