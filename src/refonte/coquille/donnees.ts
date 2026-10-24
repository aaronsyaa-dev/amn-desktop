import { useCallback, useMemo } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { useLangue, libelleNav } from '../../i18n';
import { useCollection } from '../../state/SyncContext';
import { useInvoices, isOverdue, isoDay } from '../../state/useInvoices';
import { useAppointments, appointmentEnd } from '../../state/useAppointments';
import { useAttention } from '../../state/useAttention';
import { useActivity } from '../../state/ActivityContext';
import { moduleDuChemin, useRegards } from '../../state/RegardsContext';
import { useProfilesOptionnel } from '../../state/ProfilesContext';
import { useNavAlleges } from '../../state/useNavAlleges';
import { toutesLesSections } from '../../data/spaces';
import type { NavItem } from '../../data/navigation';
import { cheminLePlusPrecis } from '../../lib/cheminCourant';
import type { AttentionItem } from '../../lib/attention';
import type { FamilleLaterale, ModuleLateral, MiettePain, PersonneEnLigne } from '../../socle/coquille';
import { REGISTRE_MODULES } from '../modules/registre';
import type { Libelle } from '../modules/declarer';
import { construireFil } from './fil';

/**
 * CE QUE LA COQUILLE SAIT — lu dans les accès existants, rien d'inventé.
 * ═════════════════════════════════════════════════════════════════════
 *
 * Les familles viennent du REGISTRE de S5 (`src/refonte/modules/`) : une entrée
 * par module, regroupant ses vues. Seules celles que l'organisation a ouvertes
 * et que la personne n'a pas allégées apparaissent (le catalogue de
 * `toutesLesSections()` le sait déjà). Les entrées « avancées » ne s'écrivent
 * pas dans la barre — « Tous les modules » les montre — sauf celle où l'on est.
 *
 * Les compteurs sont les mêmes que ceux de l'Accueil : activité non vue, ce
 * qui reste de la journée (agenda, priorités), les tâches qu'on m'a confiées,
 * les factures en retard. Un compteur à zéro ne s'affiche pas.
 */
export interface DonneesCoquille {
  familles: FamilleLaterale[];
  /** La huitième famille, ou `null` quand l'organisation n'a aucun de ses modules. */
  garde: FamilleLaterale | null;
  nombreModules: number;
  enLigne: PersonneEnLigne[];
  presenceMontree: boolean;
  fil: MiettePain[];
  attention: AttentionItem[];
  attentionEvaluee: boolean;
  /** Les modules ouverts à l'organisation et non allégés. */
  catalogue: NavItem[];
}

interface LigneTache {
  status?: string;
  assigneeEmail?: string;
}
interface JourPriorites {
  email: string;
  day: string;
  items?: { doneAt: string | null }[];
}

export function useDonneesCoquille(pathname: string, routeTousLesModules: string, libelleTous: string, libelleAccueil: string): DonneesCoquille {
  const { langue } = useLangue();
  const { user } = useAuth();
  const moi = (user?.email ?? '').toLowerCase();
  const alleges = useNavAlleges();
  const { invoices } = useInvoices();
  const { appointments } = useAppointments();
  const taches = useCollection<LigneTache>('tasks');
  const priorites = useCollection<JourPriorites>('dailyPriorities');
  const { unseen } = useActivity();
  const { autres, montree } = useRegards();
  const profils = useProfilesOptionnel();
  const { items: attention, checkedAt } = useAttention();

  const nomDe = useCallback(
    (e: string) => {
      const p = profils?.profileFor(e);
      return p?.name?.trim() || e.split('@')[0];
    },
    [profils],
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const catalogue = useMemo(() => toutesLesSections().flatMap((s) => s.items), [alleges]);
  const cheminCourant = useMemo(() => cheminLePlusPrecis(pathname, catalogue), [pathname, catalogue]);

  return useMemo(() => {
    const dire = (l: Libelle) => l[langue];
    const maintenant = new Date();
    const aujourdhui = isoDay(maintenant);

    /* ── Les compteurs, par adresse ── */
    const compteurs: Record<string, number> = {
      ...unseen,
      '/agenda': appointments.filter((a) => a.status === 'scheduled' && isoDay(new Date(a.startAt)) === aujourdhui && appointmentEnd(a) > maintenant).length,
      '/tasks': taches.filter((t) => (t.status === 'todo' || t.status === 'doing') && (t.assigneeEmail ?? '').toLowerCase() === moi).length,
      '/relances': invoices.filter((f) => isOverdue(f, aujourdhui, invoices)).length,
      '/priorites': priorites.filter((d) => d.day === aujourdhui && d.email.toLowerCase() === moi).flatMap((d) => d.items ?? []).filter((p) => !p.doneAt).length,
    };

    /* ── Les familles, d'après le registre ── */
    const ouverts = new Map(catalogue.map((i) => [i.key, i]));
    const toutes = REGISTRE_MODULES.familles.map((famille) => {
      const entrees = famille.entrees
        .map((entree) => ({ entree, vues: entree.vues.flatMap((v) => ouverts.get(v.id) ?? []) }))
        .filter((e) => e.vues.length > 0);
      const modules: (ModuleLateral & { avance: boolean })[] = entrees.map(({ entree, vues }) => {
        const badge = vues.reduce((n, v) => n + (compteurs[v.to] ?? 0), 0);
        return {
          cle: entree.id,
          libelle: entree.nom ? dire(entree.nom) : libelleNav(vues[0]),
          vers: vues[0].to,
          badge,
          courant: vues.some((v) => v.to === cheminCourant),
          avance: entree.niveau === 'avance',
        };
      });
      const active = modules.some((m) => m.courant);
      const montres = modules.filter((m) => !m.avance || m.courant);
      return {
        entrees: entrees.length,
        lateral: {
          cle: famille.id,
          nom: dire(famille.nom),
          famille: famille.teinte,
          modules: montres.map((m) => ({ cle: m.cle, libelle: m.libelle, vers: m.vers, badge: m.badge, courant: m.courant })),
          badge: montres.reduce((n, m) => n + m.badge, 0),
          active,
        } satisfies FamilleLaterale,
        amnSeulement: famille.amnSeulement,
      };
    });
    const familles = toutes.filter((f) => !f.amnSeulement && f.lateral.modules.length > 0).map((f) => f.lateral);
    const gardeFam = toutes.find((f) => f.amnSeulement && f.lateral.modules.length > 0)?.lateral ?? null;
    const nombreModules = toutes.reduce((n, f) => n + f.entrees, 0);

    /* ── Qui est en ligne, et où ── */
    const libelleDuChemin = (chemin: string) => {
      const m = moduleDuChemin(chemin);
      const item = catalogue.find((i) => i.to === m) ?? catalogue.find((i) => i.to !== '/' && m.startsWith(i.to));
      return item ? libelleNav(item) : m;
    };
    const enLigne: PersonneEnLigne[] = montree
      ? [
          { cle: moi || 'moi', nom: nomDe(moi), lieu: libelleDuChemin(pathname) },
          ...autres.filter((r) => !r.parti).map((r) => ({ cle: r.email, nom: nomDe(r.email), lieu: libelleDuChemin(r.module) })),
        ]
      : [];

    /* ── Le fil d'Ariane ── */
    const familleCourante = toutes.find((f) => f.lateral.active)?.lateral.nom;
    const courant = catalogue.find((i) => i.to === cheminCourant);
    const fil = construireFil(
      pathname,
      familleCourante && courant ? { famille: familleCourante, module: libelleNav(courant) } : null,
      libelleAccueil,
      { route: routeTousLesModules, libelle: libelleTous },
    );

    return {
      familles,
      garde: gardeFam,
      nombreModules,
      enLigne,
      presenceMontree: montree,
      fil,
      attention,
      attentionEvaluee: checkedAt !== null,
      catalogue,
    };
  }, [langue, catalogue, cheminCourant, unseen, appointments, taches, invoices, priorites, moi, autres, montree, nomDe, pathname, attention, checkedAt, routeTousLesModules, libelleTous, libelleAccueil]);
}
