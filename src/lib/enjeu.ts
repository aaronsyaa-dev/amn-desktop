import type { Appointment } from '../state/useAppointments';
import type { Invoice, Quote } from '../shared/api';
import { isOverdue } from '../state/useInvoices';

/**
 * L'ENJEU NON TRANCHÉ — la règle de l'Accueil 2a, partagée par toutes les
 * variantes (ACCUEILS.md : « le prochain rendez-vous À ENJEU, pas le prochain
 * tout court »).
 *
 * Un rendez-vous porte un enjeu quand son client a soit un devis parti et
 * sans réponse, soit une facture échue : ce sont les deux seules choses qui,
 * dans ce produit, attendent une décision d'un tiers et que le rendez-vous
 * permet de trancher en main propre. Sans aucun, `null` — et pas d'ambre.
 */
export interface Enjeu {
  rdv: Appointment;
  motif: 'devis' | 'facture';
  jours: number | null;
  devis?: Quote;
  facture?: Invoice;
}

export function enjeuDuJour(duJour: Appointment[], quotes: Quote[], invoices: Invoice[], jourIso: string, maintenant: Date): Enjeu | null {
  const aVenir = duJour.filter((a) => new Date(a.startAt).getTime() > maintenant.getTime());
  for (const rdv of aVenir) {
    const e = enjeuDe(rdv, quotes, invoices, jourIso, maintenant);
    if (e) return e;
  }
  return null;
}

/** L'enjeu d'UN rendez-vous, s'il en porte un. */
export function enjeuDe(rdv: Appointment, quotes: Quote[], invoices: Invoice[], jourIso: string, maintenant: Date): Enjeu | null {
  if (rdv.clientId === null) return null;
  const devis = quotes.find((q) => q.clientId === rdv.clientId && q.status === 'sent');
  if (devis) {
    const jours = devis.sentAt ? Math.floor((maintenant.getTime() - new Date(devis.sentAt).getTime()) / 86_400_000) : null;
    return { rdv, motif: 'devis', jours, devis };
  }
  const facture = invoices.find((f) => f.clientId === rdv.clientId && isOverdue(f, jourIso));
  if (facture) {
    const jours = facture.dueAt ? Math.floor((maintenant.getTime() - new Date(facture.dueAt).getTime()) / 86_400_000) : null;
    return { rdv, motif: 'facture', jours, facture };
  }
  return null;
}
