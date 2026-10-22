import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { useLangue, libelleNav } from '../../i18n';
import { useCollection, useSync, stripMeta } from '../../state/SyncContext';
import { useClients } from '../../state/useClients';
import { useInvoices, isOverdue, isoDay, invoiceTotals, netDueCents } from '../../state/useInvoices';
import { useAppointments, appointmentEnd } from '../../state/useAppointments';
import { useAttention } from '../../state/useAttention';
import { useActivity } from '../../state/ActivityContext';
import { moduleDuChemin, useRegards } from '../../state/RegardsContext';
import { useProfilesOptionnel } from '../../state/ProfilesContext';
import { toutesLesSections } from '../../data/spaces';
import type { NavItem } from '../../data/navigation';
import { daysBetween, type AttentionKind } from '../../lib/attention';
import { emit } from '../../socle/moments';
import { FAMILLES, type Famille } from '../../socle/familles';
import { guideVu } from '../../guide/memoire';
import { familleDe } from '../navigation/registre';
import { jourDe } from './ajmani/parole';
import { traduireAccueil, type CleAccueil } from './i18n';
import { appliquerRetouches, actionPrincipale, basculerFait, construireFil, retouchesVides, type ActionPrincipale, type LigneFil, type RetouchesFil } from './filDuJour';
import { calculerTuiles, lundiDe, meilleureSerie, type Tuile } from './tuiles';
import { filDActivite, type LigneActivite } from './activite';
import type { Journee, TypeAlerte } from './scenes';

/**
 * TOUT CE QUE L'ACCUEIL SAIT — lu dans les accès existants, rien d'inventé.
 * ═════════════════════════════════════════════════════════════════════════
 *
 * Aucune requête nouvelle : les collections synchronisées (rendez-vous,
 * factures, tâches, priorités du jour, routines, revues hebdo, journal de
 * bord, clients), le journal d'activité de l'équipe (`useActivity`), la
 * présence sur les modules (`useRegards`) et le moteur d'attention. Les
 * seules écritures sont celles que les écrans d'origine font déjà : cocher
 * sa priorité du jour, cocher une tâche.
 */

interface LigneTache {
  title?: string;
  status?: string;
  assigneeEmail?: string;
}
interface Priorite {
  id: string;
  label: string;
  doneAt: string | null;
}
interface JourPriorites {
  email: string;
  day: string;
  items: Priorite[];
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

const CLE_RETOUCHES = (email: string) => `amn.accueil.fil.${email || 'anonyme'}`;
function lireRetouches(email: string, jour: string): RetouchesFil {
  try {
    const v = JSON.parse(window.localStorage.getItem(CLE_RETOUCHES(email)) ?? 'null') as RetouchesFil | null;
    if (v && v.jour === jour && Array.isArray(v.faits) && Array.isArray(v.masques) && Array.isArray(v.ajouts)) return v;
  } catch {
    /* illisible : on repart d'un fil sans retouches */
  }
  return retouchesVides(jour);
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
  enLigne: { email: string; nom: string; module: string }[];
  presenceMontree: boolean;
  nomDe: (email: string) => string;
  cocher: (ligne: LigneFil) => void;
  retoucher: (fn: (r: RetouchesFil, jour: string) => RetouchesFil) => void;
}

export function useAccueil(): Accueil {
  const { user } = useAuth();
  const email = user?.email ?? '';
  const moi = email.toLowerCase();
  const { langue } = useLangue();
  const { upsert, ready } = useSync();
  const { clients } = useClients();
  const { invoices } = useInvoices();
  const { appointments } = useAppointments();
  const taches = useCollection<LigneTache>('tasks');
  const priorites = useCollection<JourPriorites>('dailyPriorities');
  const routines = useCollection<{ ticks: string[] }>('routines');
  const revues = useCollection<{ week: string; prochaine?: string }>('weeklyReviews');
  const journal = useCollection<{ text: string; kind: string; byEmail: string; at: string }>('logbook');
  const { items } = useAttention();
  const { events, totalUnseen, unseen } = useActivity();
  const { autres, montree } = useRegards();
  const profils = useProfilesOptionnel();

  // L'horloge de l'Accueil : la minute suffit.
  const [maintenant, setMaintenant] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setMaintenant(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  const jour = jourDe(maintenant);

  const [retouches, setRetouches] = useState(() => lireRetouches(email, jour));
  useEffect(() => setRetouches(lireRetouches(email, jour)), [email, jour]);
  const retoucher = useCallback(
    (fn: (r: RetouchesFil, jour: string) => RetouchesFil) => {
      setRetouches((r) => {
        const suivant = fn(r, jour);
        try {
          window.localStorage.setItem(CLE_RETOUCHES(email), JSON.stringify(suivant));
        } catch {
          /* stockage refusé : la retouche vaut pour cette session */
        }
        return suivant;
      });
    },
    [email, jour],
  );

  const nomDe = useCallback(
    (e: string) => {
      const p = profils?.profileFor(e);
      return p?.name?.trim() || e.split('@')[0];
    },
    [profils],
  );

  /* Cocher dans la donnée : ce que font déjà les écrans Priorités et Tâches. */
  const cocher = useCallback(
    (ligne: LigneFil) => {
      if (ligne.case === 'poste') return retoucher((r, j) => basculerFait(r, j, ligne.cle));
      if (ligne.case !== 'donnee') return undefined;
      if (ligne.type === 'tache') {
        const id = ligne.cle.slice('tache:'.length);
        const t = taches.find((x) => x.id === id);
        if (!t) return undefined;
        const statut = ligne.fait ? 'todo' : 'done';
        void upsert('tasks', t.id, { ...stripMeta(t), status: statut });
        if (statut === 'done') emit('tache.terminee', { tacheId: t.id });
        return undefined;
      }
      if (ligne.type === 'priorite') {
        const aujourdhui = isoDay(maintenant);
        const rec = priorites.find((d) => d.day === aujourdhui && d.email.toLowerCase() === moi);
        const idPriorite = ligne.cle.split(':').slice(2).join(':');
        if (!rec) return undefined;
        const items = rec.items.map((p) => (p.id === idPriorite ? { ...p, doneAt: p.doneAt ? null : new Date().toISOString() } : p));
        void upsert('dailyPriorities', rec.id, { email: rec.email, day: rec.day, items, updatedAt: new Date().toISOString() });
      }
      return undefined;
    },
    [retoucher, taches, upsert, priorites, maintenant, moi],
  );

  return useMemo(() => {
    const ta = (cle: CleAccueil, params?: Record<string, string | number>) => traduireAccueil(langue, cle, params);
    const aujourdhui = isoDay(maintenant);
    const heure = (iso: string) => new Date(iso).toLocaleTimeString(langue === 'en' ? 'en-GB' : 'fr-FR', { hour: '2-digit', minute: '2-digit' });

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

    /* ── Aujourd'hui ── */
    const rdvDuJour = appointments.filter((a) => a.status !== 'cancelled' && isoDay(new Date(a.startAt)) === aujourdhui);
    const ouvertes = taches.filter((t) => t.status === 'todo' || t.status === 'doing');
    const faitesAujourdhui = taches.filter((t) => t.status === 'done' && (t.updatedAt ?? '').slice(0, 10) === aujourdhui);
    const compteVide = ready && clients.length === 0 && invoices.length === 0 && appointments.length === 0 && taches.length === 0;
    const lignes = construireFil(
      {
        moi: email,
        priorites: priorites.filter((d) => d.day === aujourdhui).flatMap((d) => (d.items ?? []).map((p) => ({ email: d.email, id: p.id, label: p.label, fait: Boolean(p.doneAt) }))),
        rdv: rdvDuJour.map((a) => ({
          id: a.id,
          titre: a.clientName ? `${a.title} · ${a.clientName}` : a.title,
          quand: a.startAt,
          heure: heure(a.startAt),
          fait: a.status === 'done' || appointmentEnd(a) <= maintenant,
        })),
        taches: [...ouvertes, ...faitesAujourdhui].map((t) => ({ id: t.id, titre: t.title || '—', statut: (t.status as 'todo' | 'doing' | 'done') ?? 'todo', responsable: t.assigneeEmail || null })),
        etapes: compteVide ? { client: clients.length > 0, rdv: appointments.length > 0, visite: guideVu('general', email) } : null,
      },
      { enCours: ta('jour.enCours'), aFaire: ta('jour.aFaire'), faite: ta('jour.faite'), etapeClient: ta('jour.etape.client'), etapeRdv: ta('jour.etape.rdv'), etapeVisite: ta('jour.etape.visite') },
    );
    const { visibles, masquees, faits } = appliquerRetouches(lignes, retouches, jour, email);

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

    /* ── En ligne ── */
    const libelleDuChemin = (chemin: string) => {
      const m = moduleDuChemin(chemin);
      const item = catalogue.find((i) => i.to === m) ?? catalogue.find((i) => i.to !== '/' && m.startsWith(i.to));
      return item ? libelleNav(item) : m;
    };
    const enLigne = autres.filter((r) => !r.parti).map((r) => ({ email: r.email, nom: nomDe(r.email), module: libelleDuChemin(r.module) }));

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
      serie: meilleureSerie(routines, maintenant),
      boiteAZero: ready && totalUnseen === 0,
      fil: visibles,
      faits,
      masquees,
      action: actionPrincipale(enRetard, visibles),
      activite,
      familles,
      garde,
      enLigne,
      presenceMontree: montree,
      nomDe,
      cocher,
      retoucher,
    };
  }, [langue, maintenant, invoices, ready, taches, revues, appointments, clients, priorites, email, retouches, jour, events, journal, unseen, moi, autres, nomDe, items, routines, user, totalUnseen, montree, cocher, retoucher]);
}
