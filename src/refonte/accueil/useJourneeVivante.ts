import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { useCollection } from '../../state/SyncContext';
import { useClients } from '../../state/useClients';
import { useInvoices, isOverdue, isoDay } from '../../state/useInvoices';
import { useAppointments, appointmentEnd } from '../../state/useAppointments';
import { useAttention } from '../../state/useAttention';
import { daysBetween } from '../../lib/attention';
import type { AttentionKind } from '../../lib/attention';
import { jourDe } from './ajmani/parole';
import { traduireAccueil, type CleAccueil } from './i18n';
import { useLangue } from '../../i18n';
import { appliquerRetouches, construireFil, retouchesVides, type LigneFil, type RetouchesFil, type SourcesFil } from './filDuJour';
import type { Journee, TypeAlerte } from './scenes';

/**
 * CE QUE L'ACCUEIL SAIT DE LA JOURNÉE — lu dans les accès existants.
 *
 * Aucune requête nouvelle : les collections synchronisées (`useAppointments`,
 * `useInvoices`, la collection `tasks`, `useClients`) et le moteur
 * d'attention (`useAttention`). Les retouches du fil (fait, masqué, ajouté)
 * restent sur ce poste, pour la journée.
 */

interface LigneTache {
  title?: string;
  status?: string;
  assigneeEmail?: string;
}

/** Les modules qu'on oublie : un par jour, à tour de rôle (il n'existe pas de trace des visites — voir le rapport S2). */
export const MODULES_OUBLIES: { cle: CleAccueil; vers: string }[] = [
  { cle: 'module.weekly', vers: '/revue-hebdo' },
  { cle: 'module.routines', vers: '/routines' },
  { cle: 'module.logbook', vers: '/journal-de-bord' },
  { cle: 'module.okr', vers: '/objectifs-resultats' },
  { cle: 'module.priorities', vers: '/priorites' },
];

export function moduleDuJour(jour: string): (typeof MODULES_OUBLIES)[number] {
  const n = [...jour].reduce((s, c) => s + c.charCodeAt(0), 0);
  return MODULES_OUBLIES[n % MODULES_OUBLIES.length];
}

function typeAlerte(kind: AttentionKind): TypeAlerte {
  if (kind === 'invoice-overdue') return 'facture';
  if (kind === 'incident-critical' || kind === 'incident-stale' || kind === 'scan-regression') return 'site';
  if (kind === 'certificate-expired' || kind === 'certificate-expiring' || kind === 'certificate-unknown') return 'securite';
  return 'autre';
}

const CLE_RETOUCHES = (email: string) => `amn.ajmani.fil.${email || 'anonyme'}`;

function lireRetouches(email: string, jour: string): RetouchesFil {
  try {
    const v = JSON.parse(window.localStorage.getItem(CLE_RETOUCHES(email)) ?? 'null') as RetouchesFil | null;
    if (v && v.jour === jour && Array.isArray(v.faits) && Array.isArray(v.masques) && Array.isArray(v.ajouts)) return v;
  } catch {
    /* illisible : on repart d'un fil sans retouches */
  }
  return retouchesVides(jour);
}

export interface JourneeVivante {
  pret: boolean;
  /** Le moteur d'attention a tout relu : avant, on ne sait pas s'il y a une alerte. */
  attentionLue: boolean;
  email: string;
  jour: string;
  journee: Journee;
  fil: (LigneFil & { fait: boolean })[];
  masquees: number;
  /** Le premier point critique, pour le bouton d'alerte. */
  alerte: { titre: string; detail: string; vers: string } | null;
  module: (typeof MODULES_OUBLIES)[number];
  etapes: { client: boolean; rdv: boolean };
  retoucher: (fn: (r: RetouchesFil, jour: string) => RetouchesFil) => void;
}

export function useJourneeVivante(): JourneeVivante {
  const { user } = useAuth();
  const email = user?.email ?? '';
  const { langue } = useLangue();
  const { clients, ready } = useClients();
  const { invoices } = useInvoices();
  const { appointments } = useAppointments();
  const taches = useCollection<LigneTache>('tasks');
  const { items, checkedAt } = useAttention();

  // L'horloge de l'Accueil : la minute suffit (scène, « à venir »).
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

  return useMemo(() => {
    const ta = (cle: CleAccueil, params?: Record<string, string | number>) => traduireAccueil(langue, cle, params);
    const aujourdhui = isoDay(maintenant);
    const moi = email.toLowerCase();
    const heure = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const rdvDuJour = appointments.filter((a) => a.status !== 'cancelled' && isoDay(new Date(a.startAt)) === aujourdhui);
    const rdvAVenir = rdvDuJour.filter((a) => a.status === 'scheduled' && appointmentEnd(a) > maintenant).sort((x, y) => x.startAt.localeCompare(y.startAt));
    const enRetard = invoices
      .filter((f) => isOverdue(f, aujourdhui, invoices))
      .map((f) => ({ id: f.id, nom: f.billTo?.company || f.billTo?.name || f.number, jours: daysBetween(f.dueAt, aujourdhui) ?? 0 }));
    const ouvertes = taches.filter((t) => (t.status === 'todo' || t.status === 'doing') && (!t.assigneeEmail || t.assigneeEmail.toLowerCase() === moi));
    const critiques = items.filter((i) => i.severity === 'critical');

    const sources: SourcesFil = {
      // Les factures critiques sont déjà des lignes « relancer » : pas de doublon.
      alertes: critiques.filter((i) => i.kind !== 'invoice-overdue').map((i) => ({ cle: i.key, titre: i.title, detail: i.evidence, vers: i.to })),
      rdv: rdvAVenir.map((a) => ({ id: a.id, titre: a.clientName ? `${a.title} · ${a.clientName}` : a.title, quand: a.startAt, heure: heure(a.startAt) })),
      factures: enRetard,
      taches: ouvertes.map((t) => ({ id: t.id, titre: t.title || '—', enCours: t.status === 'doing' })),
    };
    const lignes = construireFil(sources, {
      relancer: (nom) => ta('fil.relancer', { nom }),
      retard: (jours) => ta('fil.retard', { jours }),
      enCours: ta('fil.enCours'),
      aFaire: ta('fil.aFaire'),
    });
    const { visibles, masquees } = appliquerRetouches(lignes, retouches, jour);

    const faitsDonnees =
      taches.filter((t) => t.status === 'done' && (t.updatedAt ?? '').slice(0, 10) === aujourdhui).length +
      rdvDuJour.filter((a) => a.status === 'done' || (a.status === 'scheduled' && appointmentEnd(a) <= maintenant)).length +
      invoices.filter((f) => f.status === 'paid' && f.paidAt === aujourdhui).length;
    const faitsCoches = visibles.filter((l) => l.fait).length;

    const premiere = critiques[0] ?? null;
    const factureCritique = premiere?.kind === 'invoice-overdue' ? enRetard.find((f) => premiere.key === `invoice-overdue:${f.id}`) : undefined;
    const relance = enRetard.filter((f) => f.jours < 30).sort((x, y) => y.jours - x.jours)[0] ?? null;
    const module = moduleDuJour(jour);

    const journee: Journee = {
      heure: maintenant.getHours(),
      compteVide: ready && clients.length === 0 && invoices.length === 0 && appointments.length === 0 && taches.length === 0,
      alerte: premiere ? { type: typeAlerte(premiere.kind), jours: factureCritique?.jours } : null,
      rdvAVenir: rdvAVenir.length,
      premierRdv: rdvAVenir[0] ? rdvAVenir[0].clientName || rdvAVenir[0].title : null,
      relance: relance ? { nom: relance.nom, jours: relance.jours } : null,
      faitsAujourdhui: faitsDonnees + faitsCoches,
      restants: visibles.filter((l) => !l.fait).length,
      module: ta(module.cle),
    };

    return {
      pret: ready,
      attentionLue: checkedAt !== null,
      email,
      jour,
      journee,
      fil: visibles,
      masquees,
      alerte: premiere ? { titre: premiere.title, detail: premiere.evidence, vers: premiere.to } : null,
      module,
      etapes: { client: clients.length > 0, rdv: appointments.length > 0 },
      retoucher,
    };
  }, [maintenant, email, appointments, invoices, taches, items, checkedAt, ready, clients, retouches, jour, langue, retoucher]);
}
