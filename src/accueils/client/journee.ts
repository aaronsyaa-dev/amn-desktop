import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { useClients } from '../../state/useClients';
import { useCollection } from '../../state/SyncContext';
import { appointmentEnd, useAppointments, type Appointment } from '../../state/useAppointments';
import { invoiceTotals, isOverdue, isoDay, netDueCents, useInvoices } from '../../state/useInvoices';
import { useAttention } from '../../state/useAttention';
import type { AttentionItem } from '../../lib/attention';
import { dayKey } from '../../lib/calendar';
import { type Enjeu, enjeuDe, enjeuDuJour } from '../../lib/enjeu';

/**
 * LA JOURNÉE — ce que lisent les dix Accueils de l'édition cliente.
 *
 * Une seule source, calculée une fois : les variantes changent la STRUCTURE,
 * jamais la donnée (ACCUEILS.md). Deux variantes qui liraient le « prochain
 * rendez-vous à enjeu » chacune à sa façon finiraient par ne plus désigner le
 * même — la règle vit donc dans `lib/enjeu`, partagée avec l'Accueil 2a.
 */

interface ArticleStock {
  name: string;
  quantity?: number;
  minQuantity?: number | null;
}
interface Intervention {
  title: string;
  clientName: string;
  at: string;
  closedAt: string;
}
interface AppelStandard {
  kind: string;
  appelant?: string;
  debutLe?: string;
  objet?: string;
}
interface Pointage {
  label: string;
  startedAt: string;
  endedAt: string;
}

/** Une action du jour, tous domaines confondus, avec son poids de rang. */
export interface ActionDuJour {
  cle: string;
  titre: string;
  detail: string;
  to: string;
  geste: string;
  poids: number;
  montantCents?: number;
}

/** Un fait de la main courante : une heure, un fait, un détail. */
export interface Evenement {
  cle: string;
  at: Date;
  fait: string;
  detail: string;
  famille: 'rdv' | 'intervention' | 'appel' | 'paiement' | 'temps';
}

export const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
export const OUVERTURE = { debutH: 8, finH: 20 } as const;

export function useJournee(tickMs = 30_000) {
  const { org, user } = useAuth();
  const { appointments } = useAppointments();
  const { quotes, clients } = useClients();
  const { invoices } = useInvoices();
  const attention = useAttention();
  const stock = useCollection<ArticleStock>('stockItems');
  const interventions = useCollection<Intervention>('interventions');
  const appels = useCollection<AppelStandard>('switchboardCalls');
  const temps = useCollection<Pointage>('timeEntries');

  const [maintenant, setMaintenant] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setMaintenant(new Date()), tickMs);
    return () => clearInterval(t);
  }, [tickMs]);

  const cle = dayKey(maintenant);
  const jourIso = isoDay(maintenant);

  const duJour = useMemo(
    () => appointments.filter((a) => dayKey(new Date(a.startAt)) === cle).sort((a, b) => a.startAt.localeCompare(b.startAt)),
    [appointments, cle],
  );
  const aVenir = duJour.filter((a) => appointmentEnd(a).getTime() > maintenant.getTime());
  const prochain = aVenir[0] ?? null;
  const enJeu: Enjeu | null = useMemo(() => enjeuDuJour(duJour, quotes, invoices, jourIso, maintenant), [duJour, quotes, invoices, jourIso, maintenant]);
  const enjeuDeRdv = (a: Appointment) => enjeuDe(a, quotes, invoices, jourIso, maintenant);

  /** La fin du rendez-vous qui précède `a` aujourd'hui (ou le début de la journée ouvrée). */
  const finPrecedent = (a: Appointment): Date => {
    const avant = duJour.filter((x) => appointmentEnd(x).getTime() <= new Date(a.startAt).getTime());
    const d = avant.length ? appointmentEnd(avant[avant.length - 1]) : new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate(), OUVERTURE.debutH);
    return d;
  };

  const factures = invoices.filter((f) => f.kind !== 'creditNote');
  const enRetard = factures.filter((f) => isOverdue(f, jourIso, invoices));
  const retard = { n: enRetard.length, cents: enRetard.reduce((s, f) => s + netDueCents(f, invoices), 0), factures: enRetard };
  const encaisseJour = factures.filter((f) => f.status === 'paid' && f.paidAt === jourIso).reduce((s, f) => s + invoiceTotals(f).grossCents, 0);
  const ruptures = stock.filter((a) => typeof a.minQuantity === 'number' && (a.quantity ?? 0) <= 0);

  /*
    LES ACTIONS DU JOUR, TOUS DOMAINES CONFONDUS — « le rang est calculé
    (échéance, montant, blocages en aval), jamais réordonné à la main ».
    L'enjeu du prochain rendez-vous passe devant (il a une heure), puis les
    ruptures (elles bloquent des interventions), puis le moteur d'attention
    dans son propre ordre de poids.
  */
  const actions: ActionDuJour[] = useMemo(() => {
    const r: ActionDuJour[] = [];
    if (enJeu) {
      const h = hhmm(new Date(enJeu.rdv.startAt));
      r.push({
        cle: `enjeu-${enJeu.rdv.id}`,
        titre: enJeu.motif === 'devis' ? `Trancher le devis de ${enJeu.rdv.clientName} à ${h}` : `Parler de la facture échue de ${enJeu.rdv.clientName} à ${h}`,
        detail: enJeu.motif === 'devis' ? `${enJeu.devis?.title ?? 'Devis'} · ${enJeu.jours ?? '?'} j sans réponse` : `échue depuis ${enJeu.jours ?? '?'} j`,
        to: '/agenda',
        geste: 'Ouvrir le rendez-vous',
        poids: 1_000_000,
      });
    }
    for (const a of ruptures) r.push({ cle: `stock-${a.name}`, titre: `${a.name} en rupture`, detail: `stock épuisé · seuil ${a.minQuantity ?? 0}`, to: '/stock', geste: 'Commander', poids: 100_000 });
    for (const i of attention.items as AttentionItem[]) r.push({ cle: i.key, titre: i.title, detail: i.evidence, to: i.to, geste: i.action || 'Ouvrir', poids: i.weight, montantCents: i.amountCents });
    return r.sort((a, b) => b.poids - a.poids);
  }, [enJeu, ruptures, attention.items]);

  /* La main courante : tout ce qui a une heure aujourd'hui, toutes familles mêlées. */
  const evenements: Evenement[] = useMemo(() => {
    const e: Evenement[] = [];
    for (const a of duJour) e.push({ cle: `rdv-${a.id}`, at: new Date(a.startAt), fait: `${a.title || 'Rendez-vous'}${a.clientName ? ` · ${a.clientName}` : ''}`, detail: [`${a.durationMin} min`, a.location].filter(Boolean).join(' · '), famille: 'rdv' });
    for (const i of interventions) if (dayKey(new Date(i.at)) === cle) e.push({ cle: `int-${i.title}-${i.at}`, at: new Date(i.at), fait: i.title, detail: i.closedAt ? `intervention close · ${i.clientName}` : `intervention · ${i.clientName}`, famille: 'intervention' });
    for (const c of appels) if (c.kind === 'appel' && c.debutLe && dayKey(new Date(c.debutLe)) === cle) e.push({ cle: `appel-${c.debutLe}`, at: new Date(c.debutLe), fait: `Appel${c.appelant ? ` de ${c.appelant}` : ''}`, detail: c.objet ?? 'standard', famille: 'appel' });
    for (const t of temps) if (dayKey(new Date(t.startedAt)) === cle) e.push({ cle: `temps-${t.startedAt}`, at: new Date(t.startedAt), fait: t.label || 'Temps pointé', detail: t.endedAt ? `pointé jusqu’à ${hhmm(new Date(t.endedAt))}` : 'en cours', famille: 'temps' });
    return e.sort((a, b) => a.at.getTime() - b.at.getTime());
  }, [duJour, interventions, appels, temps, cle]);

  /* La semaine ouvrée (et le samedi s'il porte un rendez-vous). */
  const semaine = useMemo(() => {
    const lundi = new Date(maintenant);
    lundi.setHours(0, 0, 0, 0);
    lundi.setDate(lundi.getDate() - ((lundi.getDay() + 6) % 7));
    const jours = Array.from({ length: 6 }, (_, i) => {
      const j = new Date(lundi);
      j.setDate(lundi.getDate() + i);
      const k = dayKey(j);
      const rdv = appointments.filter((a) => dayKey(new Date(a.startAt)) === k).sort((a, b) => a.startAt.localeCompare(b.startAt));
      return { date: j, cle: k, rdv, minutes: rdv.reduce((s, a) => s + Math.max(0, a.durationMin), 0), aujourdhui: k === cle };
    });
    return jours.filter((j, i) => i < 5 || j.rdv.length > 0);
  }, [appointments, maintenant, cle]);

  const vide = appointments.length === 0 && clients.length === 0 && invoices.length === 0;

  return {
    org,
    user,
    maintenant,
    jourIso,
    duJour,
    aVenir,
    prochain,
    enJeu,
    enjeuDeRdv,
    finPrecedent,
    retard,
    encaisseJour,
    ruptures,
    actions,
    evenements,
    semaine,
    attention,
    vide,
    appointments,
    invoices,
    quotes,
  };
}

export type Journee = ReturnType<typeof useJournee>;
