import { useCallback, useMemo, useState, useSyncExternalStore } from 'react';
import { useAuth } from '../../../auth/AuthContext';
import { NAV_ITEMS } from '../../../data/navigation';
import { isModuleEnabled, toutesLesSections } from '../../../data/spaces';
import { indiceNav, libelleNav, useLangue } from '../../../i18n';
import { assignUniqueIds } from '../../../lib/records';
import { useCollection, useSync } from '../../../state/SyncContext';
import { useAppointments } from '../../../state/useAppointments';
import { invoiceTotals, isOverdue, isoDay, netDueCents, useInvoices } from '../../../state/useInvoices';
import { useNavAlleges } from '../../../state/useNavAlleges';
import { useNotes } from '../../../state/useNotes';
import { entreeDuRegistre, familleDe } from '../../navigation/registre';
import type { SourcesApercu } from './apercu';
import { construireIndex, type DonneesIndex, type IndexConstruit } from './construire';
import { ajouterRecent, compterOuverture, ecrireFrequences, ecrireRecents, lireFrequences, lireRecents, type Frequences, type Recent } from './memoire';
import { useMots } from './i18n';
import type { LigneRecherche } from './moteur';

/**
 * L'INDEX RÉEL DE LA RECHERCHE ⌘K — ce que l'application sait, lu là où elle le sait.
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Aucune donnée n'est recopiée ici : le hook lit les mêmes collections que les
 * écrans (clients, devis, factures, tâches, notes, documents, décisions) et les
 * pages du catalogue, et `construire.ts` en fait des entrées de recherche. Un
 * module fermé à l'organisation n'apparaît pas, ni ses éléments ; un module que la
 * personne a allégé de sa barre n'apparaît pas non plus comme page (les éléments
 * qu'il porte, eux, restent trouvables).
 *
 * Le coffre-fort n'est pas indexé : « Coffre-fort » s'ouvre comme une page, et ses
 * entrées ne sont lues nulle part ici.
 *
 * Le hook ne s'abonne qu'à ce que la palette lit : la palette n'est montée que
 * pendant qu'elle est ouverte, l'index se reconstruit à l'ouverture (quelques
 * millisecondes) et reste mémoïsé tant que les collections ne bougent pas.
 */

interface LigneClient {
  name?: string;
  company?: string;
  email?: string;
  createdAt?: string;
  events?: readonly { title?: string; date?: string }[];
}
interface LigneDevis {
  title?: string;
  clientId?: number;
  clientSyncId?: string;
}
interface LigneTache {
  title?: string;
  clientId?: number | null;
}
interface LigneTitre {
  title?: string;
}

const VIDE: IndexConstruit = { entrees: [], actions: [], erreurs: [] };

export interface IndexRecherche {
  index: IndexConstruit;
  /** Les collections ont été lues au moins une fois : sinon, des squelettes. */
  pret: boolean;
  /** Une source n'a pas pu être lue, ou rien n'a pu être récupéré du serveur : la recherche est partielle. */
  erreur: boolean;
  /** Reconstruit l'index (« Réessayer »). */
  recharger: () => void;
}

export function useIndexRecherche(): IndexRecherche {
  const { langue } = useLangue();
  const { tm } = useMots();
  const { ready, configured, pullFailed } = useSync();
  const alleges = useNavAlleges();
  const clients = useCollection<LigneClient>('clients');
  const devis = useCollection<LigneDevis>('quotes');
  const taches = useCollection<LigneTache>('tasks');
  const documents = useCollection<LigneTitre>('knowledge');
  const decisions = useCollection<LigneTitre>('decisions');
  const { invoices } = useInvoices();
  const { notes } = useNotes();
  const [relance, setRelance] = useState(0);

  const index = useMemo<IndexConstruit>(() => {
    // Les relectures qui changent l'index sans changer ses entrées : la langue, les modules allégés, « Réessayer ».
    void langue;
    void alleges;
    void relance;
    try {
      const aujourdhui = isoDay();
      const idsClients = assignUniqueIds(clients, (r) => r.id);
      const idsDevis = assignUniqueIds(devis, (r) => r.id);
      const donnees: DonneesIndex = {
        pages: toutesLesSections()
          .flatMap((s) => s.items)
          .map((item) => {
            const entree = entreeDuRegistre(item.key);
            return { key: item.key, libelle: libelleNav(item), indice: indiceNav(item), route: item.to, verbes: entree?.verbes, motsCles: entree?.motsCles };
          }),
        clients: clients.map((c) => ({ id: idsClients.get(c.id) ?? 0, name: c.name ?? '', company: c.company ?? '', email: c.email ?? '', updatedAt: c.updatedAt })),
        devis: devis.map((q) => ({
          id: idsDevis.get(q.id) ?? 0,
          clientId: (typeof q.clientSyncId === 'string' ? idsClients.get(q.clientSyncId) : undefined) ?? Number(q.clientId ?? 0),
          title: q.title ?? '',
          updatedAt: q.updatedAt,
        })),
        factures: invoices.map((f) => ({ id: f.id, number: f.number, clientId: f.clientId, billTo: { name: f.billTo.name, company: f.billTo.company }, enRetard: isOverdue(f, aujourdhui, invoices), updatedAt: f.updatedAt })),
        taches: taches.map((t) => ({ id: t.id, title: t.title ?? '', clientId: t.clientId, updatedAt: t.updatedAt })),
        notes: notes.map((n) => ({ id: n.id, title: n.title, body: n.body, updatedAt: n.updatedAt })),
        documents: documents.map((d) => ({ id: d.id, title: d.title ?? '', updatedAt: d.updatedAt })),
        decisions: decisions.map((d) => ({ id: d.id, title: d.title ?? '', updatedAt: d.updatedAt })),
      };
      return construireIndex(donnees, {
        ouvert: (module) => NAV_ITEMS.some((i) => i.key === module) && isModuleEnabled(module),
        familleDe,
        mots: { brouillon: tm('facture.brouillon'), sansTitre: tm('sanstitre'), facture: tm('facture.libelle') },
      });
    } catch {
      return { ...VIDE, erreurs: ['index'] };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clients, devis, taches, documents, decisions, invoices, notes, langue, alleges, relance]);

  const elements = index.entrees.filter((e) => e.type !== 'page').length;
  const recharger = useCallback(() => setRelance((n) => n + 1), []);
  return {
    index,
    pret: ready,
    erreur: index.erreurs.length > 0 || (configured && pullFailed && elements === 0),
    recharger,
  };
}

/* ─────────────────────────────── Les sources de l'aperçu ─────────────────────────────── */

/**
 * Ce que le volet de droite lit : les fiches clients (création, événements), les factures (montants, échéances,
 * encaissements, avoirs déduits) et les rendez-vous. Les mêmes collections que les écrans, rien de recopié ;
 * les calculs sont dans `apercu.ts`.
 */
export function useSourcesApercu(): SourcesApercu {
  const clients = useCollection<LigneClient>('clients');
  const { invoices } = useInvoices();
  const { appointments } = useAppointments();
  return useMemo<SourcesApercu>(() => {
    const ids = assignUniqueIds(clients, (r) => r.id);
    return {
      clients: clients.map((c) => ({
        id: ids.get(c.id) ?? 0,
        creeLe: c.createdAt,
        evenements: (Array.isArray(c.events) ? c.events : []).flatMap((e) => (e && typeof e.title === 'string' && typeof e.date === 'string' ? [{ titre: e.title, date: e.date }] : [])),
      })),
      factures: invoices.map((f) => ({
        id: f.id,
        numero: f.number,
        clientId: f.clientId,
        statut: f.status,
        avoir: f.kind === 'creditNote',
        emiseLe: f.issuedAt,
        echeance: f.dueAt,
        payeeLe: f.paidAt,
        totalCentimes: invoiceTotals(f).grossCents,
        resteDuCentimes: netDueCents(f, invoices),
      })),
      rendezVous: appointments.map((r) => ({ clientId: r.clientId, debut: r.startAt, statut: r.status })),
    };
  }, [clients, invoices, appointments]);
}

/* ─────────────────────────────── Mémoire des ouvertures ─────────────────────────────── */

function stockageLocal(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export interface MemoireRecherche {
  /** Les clés des 5 derniers éléments ouverts, le plus récent d'abord. */
  recents: readonly string[];
  frequences: Readonly<Frequences>;
  /** Une ligne de résultat vient d'être ouverte. Les actions ne se mémorisent pas. */
  noter: (ligne: LigneRecherche) => void;
}

export function useMemoireRecherche(): MemoireRecherche {
  const { user } = useAuth();
  const email = user?.email ?? '';
  const [recents, setRecents] = useState<Recent[]>(() => lireRecents(stockageLocal(), email));
  const [frequences, setFrequences] = useState<Frequences>(() => lireFrequences(stockageLocal(), email));

  const noter = useCallback(
    (ligne: LigneRecherche) => {
      if (ligne.genre !== 'resultat' || ligne.cible.k !== 'aller' || !ligne.type) return;
      const nouveau: Recent = { cle: ligne.cle, type: ligne.type, route: ligne.cible.route };
      const stockage = stockageLocal();
      setRecents((courants) => {
        const suivants = ajouterRecent(courants, nouveau);
        ecrireRecents(stockage, email, suivants);
        return suivants;
      });
      setFrequences((courantes) => {
        const suivantes = compterOuverture(courantes, ligne.cle);
        ecrireFrequences(stockage, email, suivantes);
        return suivantes;
      });
    },
    [email],
  );

  return useMemo(() => ({ recents: recents.map((r) => r.cle), frequences, noter }), [recents, frequences, noter]);
}

/* ─────────────────────────────── Réseau ─────────────────────────────── */

function abonnerReseau(rappel: () => void): () => void {
  window.addEventListener('online', rappel);
  window.addEventListener('offline', rappel);
  return () => {
    window.removeEventListener('online', rappel);
    window.removeEventListener('offline', rappel);
  };
}

/** Faux quand le navigateur dit qu'il n'y a plus de réseau (c'est un indice, pas une preuve : il se trompe vers le « oui »). */
export function useEnLigne(): boolean {
  return useSyncExternalStore(abonnerReseau, () => (typeof navigator === 'undefined' ? true : navigator.onLine), () => true);
}
