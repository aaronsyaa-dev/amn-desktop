import type { Famille } from '../../../socle/familles';
import { courrielValide, type ActionIndex, type EntreeIndex, type Index } from './moteur';

/**
 * CONSTRUIRE L'INDEX — des données simples en entrées de recherche. Pur, sans React.
 * ═════════════════════════════════════════════════════════════════════════════
 *
 * Le hook (`index.ts`) lit les collections de l'application et les passe ici sous
 * une forme plate ; ce fichier décide, pour chaque sorte d'élément, ce qui se
 * cherche, ce qui s'affiche et où il mène. Il se teste donc sur des jeux de
 * données de test, sans application.
 *
 * ## Ce qui n'entre JAMAIS dans l'index
 *
 *   · le coffre-fort : ses entrées ne sont pas lues (le module s'ouvre comme page,
 *     rien de plus) ;
 *   · les téléphones, les adresses postales, le détail d'une tâche, les notes d'une
 *     fiche client, le contenu d'un message ;
 *   · tout élément d'un module que l'organisation n'a pas ouvert.
 *
 * Une note garde son corps (cherché, jamais affiché) : il vient du poste, il y reste.
 */

export interface PageSource {
  /** La clé du module au catalogue. */
  key: string;
  libelle: string;
  indice?: string;
  route: string;
  verbes?: readonly string[];
  motsCles?: readonly string[];
}

export interface ClientSource {
  id: number;
  name: string;
  company: string;
  email: string;
  updatedAt?: string;
}
export interface DevisSource {
  id: number;
  clientId: number;
  title: string;
  updatedAt?: string;
}
export interface FactureSource {
  id: string;
  number: string;
  clientId: number;
  billTo: { name: string; company: string };
  /** Échue et encore due (calculé par l'appelant, qui connaît le jour et les avoirs). */
  enRetard?: boolean;
  updatedAt?: string;
}
export interface TacheSource {
  id: string;
  title: string;
  clientId?: number | null;
  updatedAt?: string;
}
export interface NoteSource {
  id: string;
  title: string;
  body: string;
  updatedAt?: string;
}
export interface TitreSource {
  id: string;
  title: string;
  updatedAt?: string;
}

export interface DonneesIndex {
  pages: readonly PageSource[];
  clients: readonly ClientSource[];
  devis: readonly DevisSource[];
  factures: readonly FactureSource[];
  taches: readonly TacheSource[];
  notes: readonly NoteSource[];
  /** Les documents de la base de connaissances. */
  documents: readonly TitreSource[];
  decisions: readonly TitreSource[];
}

export interface OptionsIndex {
  /** Le module est-il ouvert à l'organisation ? Un élément d'un module fermé n'entre pas. */
  ouvert: (cleModule: string) => boolean;
  /** La famille d'un module (elle colore la tuile). */
  familleDe: (cleModule: string) => Famille;
  /** Les libellés que l'index compose : « Brouillon … », « Sans titre », « Facture F-… · client ». */
  mots: { brouillon: string; sansTitre: string; facture: string };
}

export interface IndexConstruit extends Index {
  /** Les sources dont la lecture a échoué : l'index reste utilisable, sans elles. */
  erreurs: readonly string[];
}

/** Les modules qui portent chaque sorte d'élément (clés du catalogue). */
export const MODULE_DE = {
  clients: 'clients',
  devis: 'clients',
  factures: 'invoices',
  taches: 'tasks',
  notes: 'notes',
  documents: 'knowledge',
  decisions: 'decisions',
} as const;

const NB_MAX_LIBELLE = 120;

const temps = (iso?: string): number | undefined => {
  if (!iso) return undefined;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : undefined;
};

const propre = (texte: unknown): string => (typeof texte === 'string' ? texte.replace(/\s+/g, ' ').trim().slice(0, NB_MAX_LIBELLE) : '');

const majuscule = (texte: string): string => (texte ? texte[0].toUpperCase() + texte.slice(1) : texte);

/** Les morceaux d'une adresse (« a.b@c.fr » → a, b, c, fr) : on retrouve une personne par son adresse. */
const morceauxDe = (courriel: string): string[] => (courriel ? courriel.split(/[@.]/).filter((m) => m.length > 1) : []);

export function construireIndex(donnees: DonneesIndex, options: OptionsIndex): IndexConstruit {
  const entrees: EntreeIndex[] = [];
  const actions: ActionIndex[] = [];
  const erreurs: string[] = [];

  const section = (nom: string, fn: () => void) => {
    try {
      fn();
    } catch {
      erreurs.push(nom);
    }
  };
  const ouvre = (module: string) => options.ouvert(module);

  section('pages', () => {
    for (const p of donnees.pages) {
      if (!p.route || !propre(p.libelle)) continue;
      const famille = options.familleDe(p.key);
      entrees.push({
        cle: `page:${p.key}`,
        type: 'page',
        libelle: propre(p.libelle),
        aussi: [...(p.verbes ?? []), ...(p.motsCles ?? [])],
        route: p.route,
        famille,
        module: p.key,
        indice: p.indice,
      });
      (p.verbes ?? []).forEach((verbe, i) => {
        if (!propre(verbe)) return;
        actions.push({ cle: `verbe:${p.key}:${i}`, libelle: majuscule(propre(verbe)), famille, route: p.route, aussi: [propre(p.libelle), ...(p.motsCles ?? [])] });
      });
    }
  });

  /* Les noms des clients, pour retrouver un devis, une facture ou une tâche par le nom de son client. */
  const nomDuClient = new Map<number, string>();
  section('noms', () => {
    for (const c of donnees.clients) nomDuClient.set(c.id, propre(c.company) || propre(c.name));
  });

  section('clients', () => {
    if (!ouvre(MODULE_DE.clients)) return;
    const famille = options.familleDe(MODULE_DE.clients);
    for (const c of donnees.clients) {
      const societe = propre(c.company);
      const personne = propre(c.name);
      const libelle = societe || personne;
      if (!libelle) continue;
      const courriel = courrielValide(c.email) ? c.email : undefined;
      entrees.push({
        cle: `client:${c.id}`,
        type: 'client',
        libelle,
        aussi: [personne, societe, ...morceauxDe(courriel ?? '')].filter(Boolean),
        route: '/clients',
        state: { focusClientId: c.id },
        famille,
        maj: temps(c.updatedAt),
        contact: personne || societe,
        courriel,
      });
    }
  });

  section('devis', () => {
    if (!ouvre(MODULE_DE.devis)) return;
    const famille = options.familleDe(MODULE_DE.devis);
    for (const q of donnees.devis) {
      const connu = nomDuClient.has(q.clientId);
      entrees.push({
        cle: `devis:${q.id}`,
        type: 'devis',
        libelle: propre(q.title) || options.mots.sansTitre,
        aussi: connu ? [nomDuClient.get(q.clientId) as string] : [],
        route: '/clients',
        state: connu ? { focusClientId: q.clientId } : undefined,
        famille,
        maj: temps(q.updatedAt),
      });
    }
  });

  section('factures', () => {
    if (!ouvre(MODULE_DE.factures)) return;
    const famille = options.familleDe(MODULE_DE.factures);
    for (const f of donnees.factures) {
      const tiers = propre(f.billTo?.company) || propre(f.billTo?.name);
      const numero = propre(f.number);
      entrees.push({
        cle: `facture:${f.id}`,
        type: 'facture',
        // « Facture F-… · le client » : le numéro et le tiers, pour qu'on la reconnaisse dans la liste.
        libelle: numero ? [`${options.mots.facture} ${numero}`, tiers].filter(Boolean).join(' · ') : `${options.mots.brouillon} ${tiers}`.trim(),
        enRetard: f.enRetard || undefined,
        aussi: [propre(f.billTo?.name), propre(f.billTo?.company), nomDuClient.get(f.clientId) ?? ''].filter(Boolean),
        route: '/facturation',
        state: { openInvoiceId: f.id },
        famille,
        maj: temps(f.updatedAt),
      });
    }
  });

  section('taches', () => {
    if (!ouvre(MODULE_DE.taches)) return;
    const famille = options.familleDe(MODULE_DE.taches);
    for (const t of donnees.taches) {
      const libelle = propre(t.title);
      if (!libelle) continue;
      entrees.push({
        cle: `tache:${t.id}`,
        type: 'tache',
        libelle,
        aussi: t.clientId != null && nomDuClient.has(t.clientId) ? [nomDuClient.get(t.clientId) as string] : [],
        route: '/tasks',
        state: { openTaskId: t.id },
        famille,
        maj: temps(t.updatedAt),
      });
    }
  });

  section('notes', () => {
    if (!ouvre(MODULE_DE.notes)) return;
    const famille = options.familleDe(MODULE_DE.notes);
    for (const n of donnees.notes) {
      const corps = typeof n.body === 'string' ? n.body : '';
      const libelle = propre(n.title) || propre(corps.split('\n')[0]) || options.mots.sansTitre;
      entrees.push({ cle: `note:${n.id}`, type: 'note', libelle, corps: corps.slice(0, 2000), route: '/notes', famille, maj: temps(n.updatedAt) });
    }
  });

  section('documents', () => {
    if (!ouvre(MODULE_DE.documents)) return;
    const famille = options.familleDe(MODULE_DE.documents);
    for (const d of donnees.documents) {
      const libelle = propre(d.title);
      if (libelle) entrees.push({ cle: `document:${d.id}`, type: 'document', libelle, route: '/knowledge', famille, maj: temps(d.updatedAt) });
    }
  });

  section('decisions', () => {
    if (!ouvre(MODULE_DE.decisions)) return;
    const famille = options.familleDe(MODULE_DE.decisions);
    for (const d of donnees.decisions) {
      const libelle = propre(d.title);
      if (libelle) entrees.push({ cle: `decision:${d.id}`, type: 'decision', libelle, route: '/decisions', famille, maj: temps(d.updatedAt) });
    }
  });

  return { entrees, actions, erreurs };
}
