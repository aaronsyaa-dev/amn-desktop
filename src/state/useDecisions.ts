import { useMemo } from 'react';
import { useAuth } from '../auth/AuthContext';
import { isAdminRole } from '../auth/roles';
import { useCollection } from './SyncContext';
import { useProjects } from './useProjects';
import { useProfiles } from './ProfilesContext';
import { isDone } from './projectEngine';
import { chevauche } from '../lib/creneaux';
import { compteur, etatEcheance, kmParJour, type TourneeFlotte, type Vehicule } from '../lib/cinquante/ajouts';
import type { AttentionItem } from '../lib/attention';

/**
 * CE QUI ATTEND UNE DÉCISION — la hiérarchie, rendue visible (vision cliente, chantier 6).
 *
 * La simulation du Groupe Vernet l'a montré : l'Accueil disait « rien à
 * signaler » à un patron dont un projet avait dépassé son échéance, dont une
 * demande de congé attendait une réponse, dont la nacelle était réclamée par
 * deux chantiers le même jour, et dont un contrôle technique tombait dans dix
 * jours. Chaque module le savait ; personne ne le lui disait.
 *
 * Ce hook rassemble ce qui attend une DÉCISION HUMAINE — pas ce qui attend un
 * geste de routine (les factures et devis sont déjà dans `useAttention`) —
 * et le donne à qui peut décider : les absences n'apparaissent qu'à un
 * propriétaire ou un admin ; le reste à tout le monde, parce que tout le
 * monde peut aller voir.
 *
 * Aucun seuil n'est un adjectif : un projet est en retard le lendemain de son
 * échéance, une échéance de véhicule compte à 30 jours ou 1 000 km, un
 * conflit de matériel est un chevauchement réel de deux réservations.
 */
interface ReservationRow {
  resourceId: string;
  startAt: string;
  endAt: string;
  purpose?: string;
  byEmail?: string;
}
interface LeaveRow {
  email: string;
  from: string;
  to: string;
  kind: string;
  status: string;
  createdAt?: string;
}

const JOUR_MS = 86_400_000;
const HEURE = (iso: string) => iso.slice(11, 16).replace(':00', ' h').replace(':', ' h ');
const JOUR = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });

export function useDecisions(): { items: AttentionItem[]; total: number } {
  const { role } = useAuth();
  const { profileFor } = useProfiles();
  const { projects, config } = useProjects();
  const leaves = useCollection<LeaveRow>('leaves');
  const reservations = useCollection<ReservationRow>('resourceBookings');
  const ressources = useCollection<{ name: string }>('resources');
  const vehicules = useCollection<Vehicule>('vehicles');
  const tournees = useCollection<TourneeFlotte>('deliveryRounds');
  const admin = isAdminRole(role);

  const items = useMemo<AttentionItem[]>(() => {
    const maintenant = new Date();
    const aujourdhui = maintenant.toISOString().slice(0, 10);
    const prenom = (email: string) => profileFor(email).name?.split(' ')[0] || email.split('@')[0];
    const out: AttentionItem[] = [];

    /* Les projets : passés d'échéance sans être finis, ou en attente d'une validation. */
    for (const p of projects) {
      if (isDone(config, p)) continue;
      if (p.deadline && p.deadline < aujourdhui) {
        const jours = Math.round((maintenant.getTime() - new Date(p.deadline).getTime()) / JOUR_MS);
        out.push({
          key: `project-late-${p.id}`,
          kind: 'project-late',
          severity: 'critical',
          title: p.title || 'Projet sans titre',
          evidence: `échéance dépassée de ${jours} jour${jours > 1 ? 's' : ''}${p.ownerEmail ? ` · ${prenom(p.ownerEmail)}` : ''}`,
          action: 'Redater ou fermer',
          to: '/projets',
          weight: 60 + Math.min(40, jours),
        });
      } else if (p.status === 'validation') {
        out.push({
          key: `project-validation-${p.id}`,
          kind: 'project-validation',
          severity: 'warning',
          title: p.title || 'Projet sans titre',
          evidence: `en attente de validation${p.nextAction ? ` · ${p.nextAction}` : ''}`,
          action: 'Valider ou renvoyer',
          to: '/projets',
          weight: 40,
        });
      }
    }

    /* Les absences : seul qui peut décider les voit. */
    if (admin) {
      for (const l of leaves) {
        if (l.status !== 'pending') continue;
        const depuis = l.createdAt ? Math.max(0, Math.round((maintenant.getTime() - new Date(l.createdAt).getTime()) / JOUR_MS)) : 0;
        out.push({
          key: `leave-${l.email}-${l.from}`,
          kind: 'leave-pending',
          severity: l.from <= aujourdhui ? 'critical' : 'warning',
          title: `${prenom(l.email)} demande ${l.kind === 'conge' ? 'un congé' : l.kind === 'maladie' ? 'un arrêt' : l.kind === 'teletravail' ? 'du télétravail' : 'une absence'}`,
          evidence: `du ${JOUR(l.from)} au ${JOUR(l.to)} · demandé il y a ${depuis} jour${depuis > 1 ? 's' : ''}`,
          action: 'Accepter ou refuser',
          to: '/absences',
          weight: 50 + Math.min(30, depuis * 5),
        });
      }
    }

    /* Le matériel : deux réservations qui se chevauchent, quel que soit le jour. */
    const nomDe = new Map(ressources.map((r) => [r.id, r.name]));
    const aVenir = reservations.filter((r) => r.endAt >= aujourdhui);
    const vus = new Set<string>();
    for (const a of aVenir) {
      for (const b of aVenir) {
        if (a.id >= b.id || a.resourceId !== b.resourceId) continue;
        if (!chevauche(a.startAt, a.endAt, b.startAt, b.endAt)) continue;
        const cle = `booking-${a.id}-${b.id}`;
        if (vus.has(cle)) continue;
        vus.add(cle);
        out.push({
          key: cle,
          kind: 'booking-conflict',
          severity: 'critical',
          title: `${nomDe.get(a.resourceId) ?? 'Une ressource'} réclamée deux fois`,
          evidence: `${JOUR(a.startAt)} · ${prenom(a.byEmail ?? '')} ${HEURE(a.startAt)}–${HEURE(a.endAt)} ↔ ${prenom(b.byEmail ?? '')} ${HEURE(b.startAt)}–${HEURE(b.endAt)}`,
          action: 'Arbitrer',
          to: '/materiel',
          weight: 70,
        });
      }
    }

    /* La flotte : une échéance qui tombe dans le mois, ou dans mille kilomètres. */
    for (const v of vehicules) {
      const { km } = compteur(v, tournees);
      const rythme = kmParJour(v, tournees, maintenant);
      for (const e of v.echeances ?? []) {
        const etat = etatEcheance(e, km, rythme, maintenant);
        const proche = e.nature === 'jours' ? etat.reste <= 30 : etat.reste <= 1000;
        if (!proche) continue;
        out.push({
          key: `vehicle-${v.id}-${e.nom}`,
          kind: 'vehicle-due',
          severity: etat.reste <= 0 ? 'critical' : 'warning',
          title: `${v.nom} · ${e.nom}`,
          evidence: etat.reste <= 0 ? 'échéance dépassée' : e.nature === 'jours' ? `dans ${Math.round(etat.reste)} jour${etat.reste > 1 ? 's' : ''}` : `dans ${Math.round(etat.reste)} km`,
          action: 'Prendre rendez-vous',
          to: '/flotte',
          weight: etat.reste <= 0 ? 55 : 30,
        });
      }
    }

    return out.sort((x, y) => y.weight - x.weight);
  }, [projects, config, leaves, reservations, ressources, vehicules, tournees, admin, profileFor]);

  return { items, total: items.length };
}
