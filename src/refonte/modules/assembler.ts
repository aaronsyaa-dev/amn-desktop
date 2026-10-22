import { FAMILLES as TEINTES, type Famille as Teinte } from '../../socle/familles';
import {
  NIVEAUX,
  type Declaration,
  type EcranNeuf,
  type Libelle,
  type ModuleDeclare,
  type Niveau,
  type VueDeclaree,
  type VueRemplacee,
} from './declarer';

/**
 * ASSEMBLER LE REGISTRE — pur, sans React ni Vite.
 *
 * Reçoit les fichiers de `declarations/` (chemin et export par défaut), les
 * vérifie et les range. Un module mal déclaré (sans famille, sans action,
 * action inconnue de sa famille, vue sans verbe…) est ÉCARTÉ et sa faute
 * notée : l'application ne plante pas, et `check:navigation` échoue tant
 * qu'une faute reste.
 *
 * L'ordre : les familles par `ordre`, puis, dans une famille, les modules de
 * son fichier dans l'ordre écrit, puis les modules seuls, par nom de fichier.
 */

export interface FichierDeclaration {
  chemin: string;
  declaration: unknown;
}

export interface ActionRegistre {
  id: string;
  /** `famille.action` */
  cle: string;
  libelle: Libelle;
}

export interface VueRegistre {
  /** La clé de la vue au catalogue. */
  id: string;
  route: string;
  /** L'identifiant de l'entrée qui la range (celui de sa vue principale). */
  entree: string;
  principale: boolean;
  famille: string;
  teinte: Teinte;
  /** `famille.action` */
  action: string;
  niveau: Niveau;
  verbes: readonly string[];
  motsCles: readonly string[];
  etiquette?: Libelle;
  nouveau?: EcranNeuf;
}

export interface EntreeRegistre {
  /** L'identifiant de la vue principale. */
  id: string;
  famille: string;
  teinte: Teinte;
  amnSeulement: boolean;
  /** `famille.action` */
  action: string;
  niveau: Niveau;
  nom?: Libelle;
  vues: readonly VueRegistre[];
  /** Le fichier qui la déclare, pour les messages. */
  source: string;
}

export interface FamilleRegistre {
  id: string;
  ordre: number;
  teinte: Teinte;
  nom: Libelle;
  amnSeulement: boolean;
  actions: readonly ActionRegistre[];
  entrees: readonly EntreeRegistre[];
  remplacees: readonly VueRemplacee[];
  source: string;
}

export interface Registre {
  familles: readonly FamilleRegistre[];
  entrees: readonly EntreeRegistre[];
  /** Toutes les vues, à plat : ce que la recherche et les contrôles lisent. */
  vues: readonly VueRegistre[];
  remplacees: readonly VueRemplacee[];
  /** Ce qui a été écarté, et pourquoi. Vide quand tout est bien déclaré. */
  fautes: readonly string[];
}

const estObjet = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null;
const estTexte = (x: unknown): x is string => typeof x === 'string' && x.trim().length > 0;
const estLibelle = (x: unknown): x is Libelle => estObjet(x) && estTexte(x.fr) && estTexte(x.en);
const estListeDeTextes = (x: unknown): x is readonly string[] => Array.isArray(x) && x.length > 0 && x.every(estTexte);

function fauteDeVue(v: unknown, ou: string): string | null {
  if (!estObjet(v)) return `${ou} : vue illisible`;
  const id = estTexte(v.id) ? v.id : '?';
  if (!estTexte(v.id)) return `${ou} : vue sans identifiant`;
  if (!estTexte(v.route) || !v.route.startsWith('/')) return `${ou} › ${id} : route absente ou sans « / »`;
  if (!estListeDeTextes(v.verbes)) return `${ou} › ${id} : sans verbe`;
  if (!estListeDeTextes(v.motsCles)) return `${ou} › ${id} : sans mot-clé`;
  if (v.etiquette !== undefined && !estLibelle(v.etiquette)) return `${ou} › ${id} : étiquette sans fr ou en`;
  if (v.nouveau !== undefined) {
    const n = v.nouveau;
    if (!estObjet(n) || typeof n.ecran !== 'function' || !n.icone || !estLibelle(n.indice)) {
      return `${ou} › ${id} : écran neuf sans écran, icône ou indice`;
    }
  }
  return null;
}

/** La faute d'un module, ou `null`. `actions` : celles de sa famille. */
function fauteDeModule(m: unknown, ou: string, actions: readonly string[] | null): string | null {
  if (!estObjet(m)) return `${ou} : module illisible`;
  if (actions === null) return `${ou} : module sans famille (ou famille inconnue)`;
  if (!estTexte(m.action)) return `${ou} : module sans action`;
  if (!actions.includes(m.action)) return `${ou} : action « ${m.action} » inconnue de sa famille (${actions.join(', ')})`;
  if (!(NIVEAUX as readonly unknown[]).includes(m.niveau)) return `${ou} : niveau « ${String(m.niveau)} » (attendu : ${NIVEAUX.join(', ')})`;
  if (m.nom !== undefined && !estLibelle(m.nom)) return `${ou} : nom sans fr ou en`;
  if (!Array.isArray(m.vues) || m.vues.length === 0) return `${ou} : module sans vue`;
  for (const v of m.vues) {
    const f = fauteDeVue(v, ou);
    if (f) return f;
  }
  const ids = (m.vues as VueDeclaree[]).map((v) => v.id);
  if (new Set(ids).size !== ids.length) return `${ou} : une vue revient deux fois dans le même module`;
  if ((m.vues as VueDeclaree[]).some((v) => v.nouveau) && !estLibelle(m.nom)) {
    return `${ou} : un écran neuf n'a pas de nom au catalogue, l'entrée doit en déclarer un`;
  }
  return null;
}

function fauteDeFamille(f: Record<string, unknown>, ou: string): string | null {
  if (!estTexte(f.id) || f.id !== f.id.toLowerCase()) return `${ou} : famille sans identifiant en minuscules`;
  if (typeof f.ordre !== 'number' || !Number.isFinite(f.ordre)) return `${ou} : famille sans ordre`;
  if (!(TEINTES as readonly unknown[]).includes(f.teinte)) return `${ou} : teinte « ${String(f.teinte)} » hors du socle (${TEINTES.join(', ')})`;
  if (!estLibelle(f.nom)) return `${ou} : famille sans nom fr et en`;
  if (!estObjet(f.actions) || Object.keys(f.actions).length === 0) return `${ou} : famille sans action`;
  for (const [a, l] of Object.entries(f.actions)) if (!estLibelle(l)) return `${ou} : action « ${a} » sans libellé fr et en`;
  if (!Array.isArray(f.modules)) return `${ou} : famille sans liste de modules`;
  if (f.remplacees !== undefined) {
    if (!Array.isArray(f.remplacees)) return `${ou} : « remplacees » n'est pas une liste`;
    for (const r of f.remplacees as unknown[]) {
      if (!estObjet(r) || !estTexte(r.id) || !estTexte(r.route) || !estLibelle(r.par)) return `${ou} : vue remplacée sans id, route ou « par »`;
    }
  }
  return null;
}

export function assembler(fichiers: readonly FichierDeclaration[]): Registre {
  const fautes: string[] = [];
  const tries = [...fichiers].sort((a, b) => a.chemin.localeCompare(b.chemin));

  type Brouillon = { decl: Record<string, unknown>; source: string; modules: { m: ModuleDeclare; ou: string }[] };
  const familles = new Map<string, Brouillon>();
  const seuls: { m: Record<string, unknown>; ou: string }[] = [];

  for (const { chemin, declaration: d } of tries) {
    if (!estObjet(d)) {
      fautes.push(`${chemin} : pas de déclaration par défaut`);
      continue;
    }
    if (d.type === 'famille') {
      const f = fauteDeFamille(d, chemin);
      if (f) {
        fautes.push(f);
        continue;
      }
      if (familles.has(d.id as string)) {
        fautes.push(`${chemin} : la famille « ${String(d.id)} » est déjà déclarée par ${familles.get(d.id as string)?.source}`);
        continue;
      }
      familles.set(d.id as string, {
        decl: d,
        source: chemin,
        modules: (d.modules as ModuleDeclare[]).map((m, i) => ({ m, ou: `${chemin} › module ${i + 1}` })),
      });
    } else if (d.type === 'module') {
      seuls.push({ m: d, ou: chemin });
    } else {
      fautes.push(`${chemin} : ni famille ni module (déclarez-le avec declarerFamille ou declarerModule)`);
    }
  }

  // Les modules seuls rejoignent leur famille, après ceux du fichier de la famille.
  for (const { m, ou } of seuls) {
    const famille = estTexte(m.famille) ? familles.get(m.famille) : undefined;
    if (!famille) {
      fautes.push(fauteDeModule(m, ou, null) ?? `${ou} : module sans famille`);
      continue;
    }
    famille.modules.push({ m: m as unknown as ModuleDeclare, ou });
  }

  const vuesVues = new Map<string, string>();
  const routesVues = new Map<string, string>();
  const resultat: FamilleRegistre[] = [];

  for (const { decl, source, modules } of [...familles.values()].sort((a, b) => (a.decl.ordre as number) - (b.decl.ordre as number))) {
    const id = decl.id as string;
    const teinte = decl.teinte as Teinte;
    const amnSeulement = decl.amnSeulement === true;
    const nomsActions = Object.keys(decl.actions as object);
    const entrees: EntreeRegistre[] = [];

    for (const { m, ou } of modules) {
      const faute = fauteDeModule(m, ou, nomsActions);
      if (faute) {
        fautes.push(faute);
        continue;
      }
      const doublon = m.vues.find((v) => vuesVues.has(v.id) || routesVues.has(v.route));
      if (doublon) {
        fautes.push(
          vuesVues.has(doublon.id)
            ? `${ou} › ${doublon.id} : vue déjà rangée par ${vuesVues.get(doublon.id)}`
            : `${ou} › ${doublon.id} : route ${doublon.route} déjà prise par ${routesVues.get(doublon.route)}`,
        );
        continue;
      }
      const cle = `${id}.${m.action}`;
      const principal = m.vues[0].id;
      for (const v of m.vues) {
        vuesVues.set(v.id, ou);
        routesVues.set(v.route, v.id);
      }
      entrees.push({
        id: principal,
        famille: id,
        teinte,
        amnSeulement,
        action: cle,
        niveau: m.niveau,
        ...(m.nom ? { nom: m.nom } : {}),
        source: ou,
        vues: m.vues.map((v, i) => ({
          id: v.id,
          route: v.route,
          entree: principal,
          principale: i === 0,
          famille: id,
          teinte,
          action: cle,
          niveau: m.niveau,
          verbes: v.verbes,
          motsCles: v.motsCles,
          ...(v.etiquette ? { etiquette: v.etiquette } : {}),
          ...(v.nouveau ? { nouveau: v.nouveau } : {}),
        })),
      });
    }

    const remplacees = ((decl.remplacees as VueRemplacee[] | undefined) ?? []).filter((r) => {
      if (vuesVues.has(r.id)) {
        fautes.push(`${source} : « ${r.id} » est à la fois remplacée et rangée par ${vuesVues.get(r.id)}`);
        return false;
      }
      return true;
    });

    resultat.push({
      id,
      ordre: decl.ordre as number,
      teinte,
      nom: decl.nom as Libelle,
      amnSeulement,
      actions: nomsActions.map((a) => ({ id: a, cle: `${id}.${a}`, libelle: (decl.actions as Record<string, Libelle>)[a] })),
      entrees,
      remplacees,
      source,
    });
  }

  const entrees = resultat.flatMap((f) => f.entrees);
  return {
    familles: resultat,
    entrees,
    vues: entrees.flatMap((e) => e.vues),
    remplacees: resultat.flatMap((f) => f.remplacees),
    fautes,
  };
}

export type { Declaration };
