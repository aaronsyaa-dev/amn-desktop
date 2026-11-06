import { useMemo } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { useLangue, libelleNav } from '../../i18n';
import { useCollection, useSync } from '../../state/SyncContext';
import { useClients } from '../../state/useClients';
import { useInvoices, isOverdue, isoDay, invoiceTotals, netDueCents } from '../../state/useInvoices';
import { useAppointments, appointmentEnd } from '../../state/useAppointments';
import { useAttention } from '../../state/useAttention';
import { useActivity } from '../../state/ActivityContext';
import { toutesLesSections } from '../../data/spaces';
import type { NavItem } from '../../data/navigation';
import { daysBetween, type AttentionKind } from '../../lib/attention';
import { FAMILLES, type Famille } from '../../socle/familles';
import { familleDe } from '../navigation/registre';
import { traduireAccueil, type CleAccueil } from './i18n';
import { actionPrincipale, type ActionPrincipale, type LigneFil, type RetouchesFil } from './filDuJour';
import { calculerTuiles, lundiDe, type Tuile } from './tuiles';
import { filDActivite, type LigneActivite } from './activite';
import { useAujourdhui } from '../coquille/aujourdhui';
import type { Journee, TypeAlerte } from './scenes';

/**
 * TOUT CE QUE L'ACCUEIL SAIT — lu dans les accès existants, rien d'inventé.
 * ═════════════════════════════════════════════════════════════════════════
 *
 * Aucune requête nouvelle : les collections synchronisées (rendez-vous,
 * factures, tâches, priorités du jour, revues hebdo, journal de bord,
 * clients), le journal d'activité de l'équipe (`useActivity`) et le moteur
 * d'attention.
 *
 * « AUJOURD'HUI » (le fil du jour et ce qui y est coché, la série, le prochain
 * rendez-vous, la présence, les gestes `cocher` et `retoucher`) vient de
 * `useAujourdhui` (`src/refonte/coquille/aujourdhui/`) : UN SEUL calcul,
 * partagé avec la carte de la barre latérale (§1.10 point 3). Rien de tout
 * cela n'est recalculé ici ; les règles restent celles de `filDuJour.ts` et
 * `tuiles.ts`.
 */

interface LigneTache {
  title?: string;
  status?: string;
  assigneeEmail?: string;
}
interface JourPriorites {
  email: string;
  day: string;
  items: { doneAt: string | null }[];
}

/** Les modules qu'on ouvre peu : un par jour, à tour de rôle (il n'existe pas de trace des visites). */
export const MODULES_OUBLIES: { route: string; nom: { fr: string; en: string } }[] = [
  { route: '/revue-hebdo', nom: { fr: 'la revue hebdo', en: 'the weekly review' } },
  { route: '/routines', nom: { fr: 'les routines', en: 'your routines' } },
  { route: '/journal-de-bord', nom: { fr: 'le journal de bord', en: 'the logbook' } },
  { route: '/objectifs-resultats', nom: { fr: 'les objectifs', en: 'your objectives' } },
];

function typeAlerte(kind: AttentionKind): TypeAlerte {
  if (kind === 'invoice-overdue') return 'facture';
  if (kind === 'incident-critical' || kind === 'incident-stale' || kind === 'scan-regression') return 'site';
  if (kind === 'certificate-expired' || kind === 'certificate-expiring' || kind === 'certificate-unknown') return 'securite';
  return 'autre';
}

export interface ModuleBarre {
  item: NavItem;
  libelle: string;
  badge: number;
}
export interface FamilleBarre {
  famille: Famille;
  modules: ModuleBarre[];
  badge: number;
}

export interface Accueil {
  pret: boolean;
  email: string;
  prenom: string;
  maintenant: Date;
  jour: string;
  journee: Journee;
  tuiles: Tuile[];
  serie: number;
  boiteAZero: boolean;
  fil: LigneFil[];
  faits: number;
  masquees: number;
  action: ActionPrincipale;
  activite: LigneActivite[];
  familles: FamilleBarre[];
  garde: ModuleBarre[];
  /** Les collègues en ligne et le libellé du module où chacun se trouve (`null` : inconnu — jamais une adresse). */
  enLigne: { email: string; nom: string; module: string | null }[];
  /** Le prochain rendez-vous du jour (pas encore fini), pour la carte « Aujourd'hui » de la coquille. */
  prochainRdv: { titre: string; debut: string } | null;
  presenceMontree: boolean;
  nomDe: (email: string) => string;
  cocher: (ligne: LigneFil) => void;
  retoucher: (fn: (r: RetouchesFil, jour: string) => RetouchesFil) => void;
}

export function useAccueil(): Accueil {
  const { user } = useAuth();
  const { langue } = useLangue();
  const { ready } = useSync();
  const { clients } = useClients();
  const { invoices } = useInvoices();
  const { appointments } = useAppointments();
  const taches = useCollection<LigneTache>('tasks');
  const priorites = useCollection<JourPriorites>('dailyPriorities');
  const revues = useCollection<{ week: string; prochaine?: string }>('weeklyReviews');
  const journal = useCollection<{ text: string; kind: string; byEmail: string; at: string }>('logbook');
  const { items } = useAttention();
  const { events, totalUnseen, unseen } = useActivity();

  /* « Aujourd'hui » : le même objet que la carte de la barre latérale (un seul calcul, une seule horloge). */
  const { email, maintenant, jour, fil: visibles, faites: faits, masquees, serie, prochainRdv, compteVide, enLigne, presenceMontree, nomDe, cocher, retoucher } = useAujourdhui();
  const moi = email.toLowerCase();

  return useMemo(() => {
    const ta = (cle: CleAccueil, params?: Record<string, string | number>) => traduireAccueil(langue, cle, params);
    const aujourdhui = jour;

    /* ── Factures ── */
    const enRetard = invoices
      .filter((f) => isOverdue(f, aujourdhui, invoices))
      .map((f) => ({ id: f.id, nom: f.billTo?.company || f.billTo?.name || f.number, jours: daysBetween(f.dueAt, aujourdhui) ?? 0 }));
    const tuiles = calculerTuiles({
      pret: ready,
      maintenant,
      factures: invoices.map((f) => ({
        kind: f.kind,
        status: f.status,
        paidAt: f.paidAt || '',
        brutCents: invoiceTotals(f).grossCents,
        duCents: netDueCents(f, invoices),
        enRetard: isOverdue(f, aujourdhui, invoices),
      })),
      taches: taches.map((t) => ({ status: t.status ?? '', updatedAt: t.updatedAt })),
      // L'objectif de cette semaine : le « semaine prochaine » de la revue de la semaine passée.
      objectif: (() => {
        const lundi = new Date(`${lundiDe(maintenant)}T12:00:00`);
        lundi.setDate(lundi.getDate() - 7);
        const passee = lundiDe(lundi);
        return revues.find((r) => r.week === passee && r.prochaine?.trim())?.prochaine ?? null;
      })(),
    });

    /* ── Le reste de la journée : ce que le message d'Ajmani et la barre comptent encore ── */
    const rdvDuJour = appointments.filter((a) => a.status !== 'cancelled' && isoDay(new Date(a.startAt)) === aujourdhui);
    const ouvertes = taches.filter((t) => t.status === 'todo' || t.status === 'doing');

    /* ── Activité de l'équipe ── */
    const activite = filDActivite(
      {
        evenements: events,
        journal,
        encaissements: invoices.filter((f) => f.status === 'paid' && f.paidAt).map((f) => ({ id: f.id, numero: f.number, paidAt: f.paidAt })),
        clients: clients.map((c) => ({ id: c.recordId, nom: c.company || c.name, createdAt: c.createdAt })),
        familleDeRoute: (route) => {
          const item = toutesLesSections().flatMap((s) => s.items).find((i) => i.to === route);
          return item ? familleDe(item.key) : 'jour';
        },
      },
      {
        modif: (nom, texte) => ta('activite.modif', { nom, texte }),
        encaissee: (numero) => ta('activite.encaissee', { numero }),
        client: (nom) => ta('activite.client', { nom }),
      },
    );

    /* ── La barre : sept familles, la Garde à part ── */
    const catalogue = toutesLesSections().flatMap((s) => s.items);
    const compteurs: Record<string, number> = {
      ...unseen,
      '/agenda': rdvDuJour.filter((a) => a.status === 'scheduled' && appointmentEnd(a) > maintenant).length,
      '/tasks': ouvertes.filter((t) => (t.assigneeEmail ?? '').toLowerCase() === moi).length,
      '/relances': enRetard.length,
      '/priorites': priorites.filter((d) => d.day === aujourdhui && d.email.toLowerCase() === moi).flatMap((d) => d.items ?? []).filter((p) => !p.doneAt).length,
    };
    const versModule = (item: NavItem): ModuleBarre => ({ item, libelle: libelleNav(item), badge: compteurs[item.to] ?? 0 });
    const estGarde = (item: NavItem) => item.to === '/garde' || item.to.startsWith('/garde/');
    const familles: FamilleBarre[] = FAMILLES.map((famille) => {
      const modules = catalogue.filter((i) => !estGarde(i) && familleDe(i.key) === famille).map(versModule);
      return { famille, modules, badge: modules.reduce((n, m) => n + m.badge, 0) };
    });
    const garde = catalogue.filter(estGarde).map(versModule);

    /* ── Le message d'Ajmani ── */
    const critique = items.find((i) => i.severity === 'critical') ?? null;
    const factureCritique = critique?.kind === 'invoice-overdue' ? enRetard.find((f) => critique.key === `invoice-overdue:${f.id}`) : undefined;
    const relance = enRetard.filter((f) => f.jours < 30).sort((x, y) => y.jours - x.jours)[0] ?? null;
    const oublie = MODULES_OUBLIES[[...jour].reduce((s, c) => s + c.charCodeAt(0), 0) % MODULES_OUBLIES.length];
    const rdvAVenir = rdvDuJour.filter((a) => a.status === 'scheduled' && appointmentEnd(a) > maintenant).sort((x, y) => x.startAt.localeCompare(y.startAt));
    const journee: Journee = {
      heure: maintenant.getHours(),
      compteVide,
      alerte: critique ? { type: typeAlerte(critique.kind), jours: factureCritique?.jours } : null,
      rdvAVenir: rdvAVenir.length,
      premierRdv: rdvAVenir[0] ? rdvAVenir[0].clientName || rdvAVenir[0].title : null,
      relance: relance ? { nom: relance.nom, jours: relance.jours } : null,
      faitsAujourdhui: faits,
      restants: visibles.length - faits,
      module: oublie.nom[langue],
    };

    return {
      pret: ready,
      email,
      prenom: (user?.name ?? '').trim().split(/\s+/)[0] ?? '',
      maintenant,
      jour,
      journee,
      tuiles,
      serie,
      prochainRdv,
      boiteAZero: ready && totalUnseen === 0,
      fil: visibles,
      faits,
      masquees,
      action: actionPrincipale(enRetard, visibles),
      activite,
      familles,
      garde,
      enLigne,
      presenceMontree,
      nomDe,
      cocher,
      retoucher,
    };
  }, [langue, maintenant, invoices, ready, taches, revues, appointments, clients, priorites, email, jour, events, journal, unseen, moi, nomDe, items, user, totalUnseen, visibles, faits, masquees, serie, prochainRdv, compteVide, enLigne, presenceMontree, cocher, retoucher]);
}
