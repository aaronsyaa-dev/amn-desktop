import { useCallback, useMemo } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { useLangue, libelleNav } from '../../i18n';
import { useCollection } from '../../state/SyncContext';
import { useInvoices, isOverdue, isoDay } from '../../state/useInvoices';
import { useAppointments, appointmentEnd } from '../../state/useAppointments';
import { useAttention } from '../../state/useAttention';
import { useActivity } from '../../state/ActivityContext';
import { useRegards } from '../../state/RegardsContext';
import { useProfilesOptionnel } from '../../state/ProfilesContext';
import { useNavAlleges } from '../../state/useNavAlleges';
import { useNavFavorites } from '../../state/useNavFavorites';
import { toutesLesSections } from '../../data/spaces';
import type { NavItem } from '../../data/navigation';
import { cheminLePlusPrecis } from '../../lib/cheminCourant';
import type { AttentionItem } from '../../lib/attention';
import { useCyber } from '../../bureaux/donnees/cyber';
import { traduireSocle } from '../../socle/i18n';
import type { FamilleLaterale, ModuleLateral, MiettePain, PersonneEnLigne } from '../../socle/coquille';
import { REGISTRE_MODULES, vueDuRegistre } from '../modules/registre';
import type { Libelle } from '../modules/declarer';
import { construireFil } from './fil';
import { routeEnsemble } from '../systeme/ensemble';
import { choisirEpingles, choisirLesVisibles, placesDeModules } from './visibles';
import { libelleDuLieu } from './lieu';
import { libellePageSysteme, motsPagesSysteme, pageSysteme } from './pagesSysteme';
import type { PageCoquille } from './page';

/**
 * CE QUE LA COQUILLE SAIT — lu dans les accès existants, rien d'inventé.
 * ═════════════════════════════════════════════════════════════════════
 *
 * Les familles viennent du REGISTRE de S5 (`src/refonte/modules/`) : une entrée
 * par module, regroupant ses vues. Seules celles que l'organisation a ouvertes
 * et que la personne n'a pas allégées apparaissent (le catalogue de
 * `toutesLesSections()` le sait déjà). La famille où l'on est montre au plus
 * cinq lignes (§0.1) — « Vue d'ensemble » comprise —, l'entrée courante toujours.
 *
 * Les compteurs sont les mêmes que ceux de l'Accueil : activité non vue, ce
 * qui reste de la journée (agenda, priorités), les tâches qu'on m'a confiées,
 * les factures en retard. Un compteur à zéro ne s'affiche pas.
 *
 * Les ÉPINGLÉS sont les favoris de la personne (`useNavFavorites`, sur ce poste :
 * ceux qu'elle épingle depuis Tous les modules), rangés à leur entrée du
 * registre, sans le module ouvert. CYBER (toujours là) mène aux écrans du bureau
 * Cyber (`/cyber`) ; son compteur est celui de la console Cyber : les alertes
 * ouvertes du SOC (`useCyber().alertes`), rien quand la source n'a pas répondu.
 *
 * Le fil d'Ariane et la famille dépliée d'une page hors registre viennent de ce
 * qu'elle dit d'elle (`page.ts`, `pagesSysteme.ts`) ; ceux d'une page du
 * registre, du registre. Jamais d'un segment d'adresse.
 */
export interface DonneesCoquille {
  familles: FamilleLaterale[];
  /** La huitième famille, ou `null` quand l'organisation n'a aucun de ses modules. */
  garde: FamilleLaterale | null;
  /** Cyber : toujours là. */
  cyber: FamilleLaterale;
  /** Les modules épinglés par la personne, sans le module ouvert. */
  epingles: ModuleLateral[];
  /** On est sur « Tous les modules ». */
  tousLesModulesActif: boolean;
  /** Le texte de la barre Ajmani que l'écran a donné, s'il en a donné un. */
  texteAjmani?: string;
  nombreModules: number;
  enLigne: PersonneEnLigne[];
  presenceMontree: boolean;
  fil: MiettePain[];
  attention: AttentionItem[];
  attentionEvaluee: boolean;
  /** Les modules ouverts à l'organisation et non allégés. */
  catalogue: NavItem[];
  /** Ce qui attend, par adresse de module (la source des pastilles de la barre latérale). */
  compteurs: Record<string, number>;
}

/** Où mène Cyber : l'accueil du bureau Cyber (ses écrans vivent dans la coquille de son bureau). */
export const ROUTE_CYBER = '/cyber';

interface LigneTache {
  status?: string;
  assigneeEmail?: string;
}
interface JourPriorites {
  email: string;
  day: string;
  items?: { doneAt: string | null }[];
}

export function useDonneesCoquille(pathname: string, pageDeclaree: PageCoquille | null): DonneesCoquille {
  const { langue } = useLangue();
  const { user } = useAuth();
  const moi = (user?.email ?? '').toLowerCase();
  const alleges = useNavAlleges();
  const { favorites } = useNavFavorites();
  const { invoices } = useInvoices();
  const { appointments } = useAppointments();
  const taches = useCollection<LigneTache>('tasks');
  const priorites = useCollection<JourPriorites>('dailyPriorities');
  const { unseen } = useActivity();
  const { autres, montree } = useRegards();
  const profils = useProfilesOptionnel();
  const { items: attention, checkedAt } = useAttention();
  const cyberModele = useCyber();
  const alertesCyber = cyberModele.pret ? cyberModele.alertes.length : null;

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
    const ts = (cle: Parameters<typeof traduireSocle>[1], params?: Record<string, string | number>) => traduireSocle(langue, cle, params);
    const maintenant = new Date();
    const aujourdhui = isoDay(maintenant);

    /* ── Ce que la page dit d'elle : déclaré par la page, sinon la table des pages système ── */
    const page = pageDeclaree ?? pageSysteme(pathname, motsPagesSysteme(langue));
    // `undefined` : la page ne dit rien de sa famille (le registre décide) ; `null` : aucune famille dépliée.
    const famillePage = page && page.famille !== undefined ? page.famille : undefined;
    const sousPage = page?.sousPage ?? null;
    const parPage = famillePage !== undefined;

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
    const parEntree = new Map<string, ModuleLateral>();
    const toutes = REGISTRE_MODULES.familles.map((famille) => {
      const entrees = famille.entrees
        .map((entree) => ({ entree, vues: entree.vues.flatMap((v) => ouverts.get(v.id) ?? []) }))
        .filter((e) => e.vues.length > 0);
      const modules: (ModuleLateral & { avance: boolean; niveau: string })[] = entrees.map(({ entree, vues }) => {
        const badge = vues.reduce((n, v) => n + (compteurs[v.to] ?? 0), 0);
        const courant = parPage ? famillePage === famille.id && sousPage === entree.id : vues.some((v) => v.to === cheminCourant);
        const m = {
          cle: entree.id,
          libelle: entree.nom ? dire(entree.nom) : libelleNav(vues[0]),
          vers: vues[0].to,
          badge,
          courant,
          famille: famille.id,
          avance: entree.niveau === 'avance',
          niveau: entree.niveau,
        };
        parEntree.set(entree.id, { cle: m.cle, libelle: m.libelle, vers: m.vers, badge: m.badge, courant: m.courant, famille: m.famille });
        return m;
      });
      /* La première ligne : « Vue d'ensemble », sauf pour Ma journée (son Accueil en tient lieu). Quand la vue
         d'ensemble EST l'adresse d'un module de la famille (la salle de La Garde), ce module n'est pas listé deux fois. */
      const versEnsemble = famille.id === 'jour' ? null : routeEnsemble(famille.id);
      const sansDoublon = modules.filter((m) => m.vers !== versEnsemble);
      const montres = choisirLesVisibles(sansDoublon, placesDeModules(Boolean(versEnsemble)));
      const ensembleCourant = parPage ? famillePage === famille.id && sousPage === 'ensemble' : cheminCourant === versEnsemble || pathname === versEnsemble;
      const ensemble: ModuleLateral | undefined = versEnsemble ? { cle: `ensemble-${famille.id}`, libelle: '', vers: versEnsemble, badge: 0, courant: ensembleCourant } : undefined;
      const active = parPage ? famillePage === famille.id : modules.some((m) => m.courant) || Boolean(ensemble?.courant);
      return {
        entrees: entrees.length,
        lateral: {
          cle: famille.id,
          nom: dire(famille.nom),
          famille: famille.teinte,
          modules: montres.map((m) => ({ cle: m.cle, libelle: m.libelle, vers: m.vers, badge: m.badge, courant: m.courant })),
          badge: montres.reduce((n, m) => n + m.badge, 0),
          active,
          ensemble,
          autres: sansDoublon.length - montres.length,
        } satisfies FamilleLaterale,
        amnSeulement: famille.amnSeulement,
        nomCourt: famille.amnSeulement ? ts('coquille.garde.court') : dire(famille.nom),
      };
    });
    const familles = toutes.filter((f) => !f.amnSeulement && f.lateral.modules.length > 0).map((f) => f.lateral);
    const gardeTrouvee = toutes.find((f) => f.amnSeulement && f.lateral.modules.length > 0);
    // « La Garde » en barre latérale (§0.1) : le nom court, jamais tronqué (écart C6).
    const gardeFam = gardeTrouvee ? { ...gardeTrouvee.lateral, nom: gardeTrouvee.nomCourt } : null;
    const nombreModules = toutes.reduce((n, f) => n + f.entrees, 0);

    /* ── Cyber : toujours là ── */
    const surCyber = pathname === ROUTE_CYBER || pathname.startsWith(`${ROUTE_CYBER}/`);
    const cyber: FamilleLaterale = {
      cle: 'cyber',
      nom: ts('coquille.cyber'),
      famille: 'outils',
      modules: [],
      badge: 0,
      active: surCyber,
      vers: ROUTE_CYBER,
      compteur: alertesCyber,
      compteurAide: alertesCyber ? ts('coquille.cyber.alertes', { n: alertesCyber }) : undefined,
    };

    /* ── Les épinglés : les favoris de la personne, rangés à leur entrée ── */
    const epingles = choisirEpingles(favorites, (cle) => {
      const v = vueDuRegistre(cle);
      return v ? parEntree.get(v.entree) : undefined;
    });

    /* ── Qui est en ligne, et où (le libellé du module, jamais l'adresse) ── */
    const lieu = (chemin: string) => libelleDuLieu(chemin, catalogue, (c) => libellePageSysteme(c, langue));
    const enLigne: PersonneEnLigne[] = montree
      ? [
          { cle: moi || 'moi', nom: nomDe(moi), lieu: lieu(pathname) },
          ...autres.filter((r) => !r.parti).map((r) => ({ cle: r.email, nom: nomDe(r.email), lieu: lieu(r.module) })),
        ]
      : [];

    /* ── Le fil d'Ariane : « Famille / Page » ── */
    const familleActive = toutes.find((f) => f.lateral.active);
    const courant = catalogue.find((i) => i.to === cheminCourant);
    const nomFamille = (id: string | null | undefined) => (id ? toutes.find((f) => f.lateral.cle === id)?.nomCourt ?? null : null);
    const fil = construireFil(
      page
        ? { page: { famille: nomFamille(page.famille), miettes: page.miettes }, espace: ts('coquille.section.espace') }
        : {
            famille: familleActive?.nomCourt ?? null,
            module: courant ? libelleNav(courant) : familleActive?.lateral.ensemble?.courant ? ts('coquille.ensemble') : null,
            espace: ts('coquille.section.espace'),
          },
    );

    return {
      familles,
      garde: gardeFam,
      cyber,
      epingles,
      tousLesModulesActif: Boolean(page?.tousLesModules),
      texteAjmani: page?.ajmani,
      nombreModules,
      enLigne,
      presenceMontree: montree,
      fil,
      attention,
      attentionEvaluee: checkedAt !== null,
      catalogue,
      compteurs,
    };
  }, [langue, catalogue, cheminCourant, unseen, appointments, taches, invoices, priorites, moi, autres, montree, nomDe, pathname, attention, checkedAt, pageDeclaree, favorites, alertesCyber]);
}
