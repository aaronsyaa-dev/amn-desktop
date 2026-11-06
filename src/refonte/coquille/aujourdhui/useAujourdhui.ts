import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../../auth/AuthContext';
import { useLangue } from '../../../i18n';
import { useCollection, useSync, stripMeta } from '../../../state/SyncContext';
import { useClients } from '../../../state/useClients';
import { useInvoices } from '../../../state/useInvoices';
import { useAppointments, appointmentEnd } from '../../../state/useAppointments';
import { useRegards } from '../../../state/RegardsContext';
import { useProfilesOptionnel } from '../../../state/ProfilesContext';
import { toutesLesSections } from '../../../data/spaces';
import { emit } from '../../../socle/moments';
import { guideVu } from '../../../guide/memoire';
import { jourDe } from '../../accueil/ajmani/parole';
import { traduireAccueil } from '../../accueil/i18n';
import { basculerFait, retouchesVides, type LigneFil, type RetouchesFil } from '../../accueil/filDuJour';
import { libelleDuLieu } from '../lieu';
import { libellePageSysteme } from '../pagesSysteme';
import { calculerAujourdhui, type AujourdhuiCalcule } from './calculer';

/**
 * `useAujourdhui` — UN SEUL CALCUL pour la carte « Aujourd'hui » de la barre
 * latérale et pour l'Accueil (N01), consigne du CO (§1.10 point 3).
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Le hook lit les accès existants (tâches, priorités du jour, routines,
 * rendez-vous, clients et factures pour savoir si le compte est vide, la
 * présence) et confie le calcul à `calculerAujourdhui` (pur). Les seules
 * écritures sont celles que les écrans d'origine font déjà : cocher sa
 * priorité du jour, cocher une tâche ; et, sur ce poste, les retouches du fil
 * (masquer, ajouter, cocher une ligne à soi), rangées pour la journée.
 *
 * UNE SEULE INSTANCE : `FournisseurAujourdhui` (monté une fois dans la coque
 * interne, `AppLayout`) calcule et partage l'objet ; la barre latérale et
 * l'Accueil le lisent par `useAujourdhui()`. Cocher une ligne à l'Accueil met
 * la carte de la barre à jour sans second calcul. Sans fournisseur (contrôles,
 * aperçus), `useAujourdhui()` calcule localement.
 */

export interface PersonneAujourdhui {
  email: string;
  nom: string;
  /** Le libellé du module où elle est (`null` : inconnu — jamais une adresse). */
  module: string | null;
}

export interface Aujourdhui extends AujourdhuiCalcule {
  pret: boolean;
  email: string;
  /** L'horloge, à la minute. */
  maintenant: Date;
  /** Le jour, « AAAA-MM-JJ » local. */
  jour: string;
  /** Les collègues en ligne et le libellé du module où chacun se trouve. */
  enLigne: PersonneAujourdhui[];
  presenceMontree: boolean;
  /** Les retouches du jour sur ce poste. */
  retouches: RetouchesFil;
  retoucher: (fn: (r: RetouchesFil, jour: string) => RetouchesFil) => void;
  /** Cocher une ligne : dans la donnée (priorité, tâche) ou sur ce poste (ligne à soi). */
  cocher: (ligne: LigneFil) => void;
  /** Le nom d'une personne d'après son profil, sinon le début de son adresse. */
  nomDe: (email: string) => string;
}

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

const RIEN: AujourdhuiCalcule = { faites: 0, total: 0, serie: 0, prochainRdv: null, fil: [], masquees: 0, compteVide: false };

export const ContexteAujourdhui = createContext<Aujourdhui | null>(null);

/**
 * Le calcul lui-même. `actif` à faux (un fournisseur est déjà là) : les accès
 * sont lus, rien n'est calculé — les hooks restent appelés dans le même ordre.
 */
export function useCalculAujourdhui(actif = true): Aujourdhui {
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
  const { autres, montree } = useRegards();
  const profils = useProfilesOptionnel();

  // L'horloge : la minute suffit.
  const [maintenant, setMaintenant] = useState(() => new Date());
  useEffect(() => {
    if (!actif) return undefined;
    const t = setInterval(() => setMaintenant(new Date()), 60_000);
    return () => clearInterval(t);
  }, [actif]);
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
        const rec = priorites.find((d) => d.day === jour && d.email.toLowerCase() === moi);
        const idPriorite = ligne.cle.split(':').slice(2).join(':');
        if (!rec) return undefined;
        const items = rec.items.map((p) => (p.id === idPriorite ? { ...p, doneAt: p.doneAt ? null : new Date().toISOString() } : p));
        void upsert('dailyPriorities', rec.id, { email: rec.email, day: rec.day, items, updatedAt: new Date().toISOString() });
      }
      return undefined;
    },
    [retoucher, taches, upsert, priorites, jour, moi],
  );

  const calcule = useMemo<AujourdhuiCalcule>(() => {
    if (!actif) return RIEN;
    const ta = (cle: Parameters<typeof traduireAccueil>[1]) => traduireAccueil(langue, cle);
    return calculerAujourdhui(
      {
        moi: email,
        pret: ready,
        jour,
        taches,
        priorites,
        rdv: appointments.map((a) => ({ id: a.id, title: a.title, clientName: a.clientName, startAt: a.startAt, fin: appointmentEnd(a), status: a.status })),
        routines,
        clients: clients.length,
        factures: invoices.length,
        visiteFaite: guideVu('general', email),
        retouches,
      },
      maintenant,
      {
        enCours: ta('jour.enCours'),
        aFaire: ta('jour.aFaire'),
        faite: ta('jour.faite'),
        etapeClient: ta('jour.etape.client'),
        etapeRdv: ta('jour.etape.rdv'),
        etapeVisite: ta('jour.etape.visite'),
        heure: (iso) => new Date(iso).toLocaleTimeString(langue === 'en' ? 'en-GB' : 'fr-FR', { hour: '2-digit', minute: '2-digit' }),
      },
    );
  }, [actif, langue, email, ready, jour, taches, priorites, appointments, routines, clients, invoices, retouches, maintenant]);

  /* Qui est en ligne, et où : le libellé du module, jamais l'adresse (écart C7). Inconnu, on n'écrit rien. */
  const enLigne = useMemo<PersonneAujourdhui[]>(() => {
    if (!actif) return [];
    const catalogue = toutesLesSections().flatMap((s) => s.items);
    return autres.filter((r) => !r.parti).map((r) => ({ email: r.email, nom: nomDe(r.email), module: libelleDuLieu(r.module, catalogue, (c) => libellePageSysteme(c, langue)) }));
  }, [actif, autres, nomDe, langue]);

  return useMemo(
    () => ({ ...calcule, pret: ready, email, maintenant, jour, enLigne, presenceMontree: montree, retouches, retoucher, cocher, nomDe }),
    [calcule, ready, email, maintenant, jour, enLigne, montree, retouches, retoucher, cocher, nomDe],
  );
}

/** Les chiffres d'« Aujourd'hui » : ceux du fournisseur quand il y en a un (la coque), sinon calculés ici. */
export function useAujourdhui(): Aujourdhui {
  const partage = useContext(ContexteAujourdhui);
  const local = useCalculAujourdhui(partage === null);
  return partage ?? local;
}
