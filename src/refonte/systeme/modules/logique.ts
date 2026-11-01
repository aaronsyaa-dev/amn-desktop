import { aplatir } from '../../navigation/recherche';

/**
 * LA LOGIQUE DE LA PAGE « TOUS LES MODULES » (D02, v3) — pure, sans React, éprouvée par `check:systeme-modules`.
 *
 * Elle répond aux questions du répertoire : quelles lignes chaque famille montre (toutes : plus de « + N autres »),
 * comment un filtre de niveau les réduit, comment une recherche les marque sans en retirer aucune (la mise en page
 * ne bouge pas), comment les familles se rangent en colonnes, quel ordre suit la sélection ; et à celles de la
 * colonne droite : les épinglés, les récents, les modules à découvrir, le compte des modules déjà ouverts.
 *
 * Aucun chiffre n'est écrit ici : les effectifs, les trois niveaux et le total se calculent depuis le registre.
 */

export type Niveau = 'essentiel' | 'courant' | 'avance';
export type FiltreNiveau = 'tous' | Niveau;
export const NIVEAUX_FILTRE: readonly FiltreNiveau[] = ['tous', 'essentiel', 'courant', 'avance'];

/** Un module du répertoire, tel que la page le lit (registre + catalogue + données de la coquille). */
export interface ModuleRepertoire {
  /** L'identifiant de l'entrée du registre. */
  id: string;
  nom: string;
  vers: string;
  niveau: Niveau;
  /** Les éléments qui demandent une action (même définition que la barre latérale). */
  badge: number;
  /** Les prénoms des collègues dans ce module en ce moment. */
  personnes: string[];
  /** Ouvert à l'espace (sinon : « non activé », la ligne reste listée). */
  active: boolean;
  /** Le rôle ne peut pas l'ouvrir : cadenas, la ligne reste listée. */
  verrouille: boolean;
  /** Un écran neuf déclaré au registre. */
  nouveau: boolean;
  /** Les clés du catalogue de ses vues (pour les épingles et le journal des ouvertures). */
  cles: string[];
}

export interface FamilleRepertoire {
  id: string;
  nom: string;
  teinte: string;
  /** Sa vue d'ensemble (clic sur l'en-tête). */
  vers: string;
  /** La Garde : un bouclier à la place de la pastille. */
  garde: boolean;
  modules: ModuleRepertoire[];
}

export interface Correspondance {
  score: number;
  /** Le verbe qui a fait trouver le module (« envoyer une facture »). */
  raison?: string;
}

export type LigneRepertoire =
  | { type: 'module'; id: string; module: ModuleRepertoire; correspond: boolean }
  | { type: 'action'; id: string; libelle: string; vers: string; module: ModuleRepertoire };

export interface FamilleComposee {
  id: string;
  nom: string;
  teinte: string;
  vers: string;
  garde: boolean;
  /** L'effectif APRÈS le filtre de niveau. */
  effectif: number;
  lignes: LigneRepertoire[];
  /** Le filtre ne laisse aucun module dans cette famille : l'en-tête reste, une ligne le dit. */
  videAuNiveau: boolean;
}

export function majuscule(texte: string): string {
  return texte.charAt(0).toLocaleUpperCase('fr-FR') + texte.slice(1);
}

/** Les effectifs de chaque niveau, sur tout le répertoire (le segmenté garde ces totaux). */
export function compterParNiveau(familles: readonly FamilleRepertoire[]): Record<FiltreNiveau, number> {
  const n: Record<FiltreNiveau, number> = { tous: 0, essentiel: 0, courant: 0, avance: 0 };
  for (const f of familles) for (const m of f.modules) {
    n.tous += 1;
    n[m.niveau] += 1;
  }
  return n;
}

/** La meilleure correspondance (score le plus haut ; à égalité, la première lue). */
export function meilleureCorrespondance(correspondances: ReadonlyMap<string, Correspondance> | null): { id: string; c: Correspondance } | null {
  let meilleur: { id: string; c: Correspondance } | null = null;
  if (correspondances) for (const [id, c] of correspondances) if (!meilleur || c.score > meilleur.c.score) meilleur = { id, c };
  return meilleur;
}

/**
 * Le répertoire à montrer. Toutes les lignes de chaque famille, dans l'ordre du registre (aucune ne remonte, aucune
 * ne disparaît) ; le filtre de niveau retire les lignes des autres niveaux et met l'effectif à jour. Avec une
 * recherche, chaque ligne dit si elle correspond ; la meilleure correspondance née d'un VERBE ajoute une ligne
 * d'action en tête de sa famille.
 */
export function composerRepertoire(
  familles: readonly FamilleRepertoire[],
  options: { niveau: FiltreNiveau; correspondances: ReadonlyMap<string, Correspondance> | null },
): FamilleComposee[] {
  const { niveau, correspondances } = options;
  const meilleur = meilleureCorrespondance(correspondances);
  return familles.map((f) => {
    const retenus = f.modules.filter((m) => niveau === 'tous' || m.niveau === niveau);
    const lignes: LigneRepertoire[] = [];
    const action = meilleur?.c.raison ? retenus.find((m) => m.id === meilleur.id) : undefined;
    if (action && meilleur?.c.raison) lignes.push({ type: 'action', id: `action:${action.id}`, libelle: majuscule(meilleur.c.raison), vers: action.vers, module: action });
    for (const m of retenus) lignes.push({ type: 'module', id: m.id, module: m, correspond: Boolean(correspondances?.has(m.id)) });
    return {
      id: f.id,
      nom: f.nom,
      teinte: f.teinte,
      vers: f.vers,
      garde: f.garde,
      effectif: retenus.length,
      lignes,
      videAuNiveau: retenus.length === 0 && f.modules.length > 0,
    };
  });
}

/**
 * Les familles rangées en `n` colonnes, dans l'ordre de la barre latérale, autant de familles par colonne
 * (les premières colonnes prennent le surplus) : 8 familles → 2, 2, 2, 2.
 */
export function repartirEnColonnes<T>(familles: readonly T[], n = 4): T[][] {
  const colonnes: T[][] = Array.from({ length: n }, () => []);
  const base = Math.floor(familles.length / n);
  let surplus = familles.length % n;
  let i = 0;
  for (const c of colonnes) {
    const prises = base + (surplus > 0 ? 1 : 0);
    if (surplus > 0) surplus -= 1;
    c.push(...familles.slice(i, i + prises));
    i += prises;
  }
  return colonnes;
}

/**
 * Les lignes que ↑ ↓ parcourent pendant une recherche : les correspondances, dans l'ordre de lecture (colonne par
 * colonne), la ligne d'action d'abord dans sa famille. `depart` : l'indice de la meilleure, sélectionnée à la frappe.
 */
export function ordreDeSelection(
  colonnes: readonly (readonly FamilleComposee[])[],
  correspondances: ReadonlyMap<string, Correspondance> | null,
): { ordre: string[]; depart: number } {
  if (!correspondances || correspondances.size === 0) return { ordre: [], depart: 0 };
  const ordre: string[] = [];
  for (const col of colonnes) for (const f of col) for (const l of f.lignes) {
    if (l.type === 'action' || l.correspond) ordre.push(l.id);
  }
  const meilleur = meilleureCorrespondance(correspondances);
  const action = ordre.findIndex((id) => id.startsWith('action:'));
  const depart = action >= 0 ? action : Math.max(0, ordre.indexOf(meilleur?.id ?? ''));
  return { ordre, depart };
}

/**
 * La partie d'un libellé qui correspond à ce qu'on a tapé : [avant, en gras, après]. Insensible aux accents, à la
 * casse et à la ponctuation ; on cherche au début du libellé, puis au début de chaque mot ; sinon tout reste courant.
 */
export function surligner(libelle: string, saisie: string): [string, string, string] {
  const cible = aplatir(saisie).replace(/ /g, '');
  if (!cible) return [libelle, '', ''];
  const departs = [0];
  for (let i = 1; i < libelle.length; i += 1) if (/[\s'’-]/.test(libelle[i - 1]) && !/[\s'’-]/.test(libelle[i])) departs.push(i);
  for (const d of departs) {
    let k = 0;
    let fin = d;
    for (let i = d; i < libelle.length && k < cible.length; i += 1) {
      const brut = aplatir(libelle[i]).replace(/ /g, '');
      if (brut === '') {
        fin = i + 1;
        continue;
      }
      if (brut[0] !== cible[k]) break;
      k += 1;
      fin = i + 1;
    }
    if (k === cible.length) return [libelle.slice(0, d), libelle.slice(d, fin), libelle.slice(fin)];
  }
  return [libelle, '', ''];
}

/* ═══ La colonne droite ═══ */

/** Au plus 8 épinglés (⌘1 à ⌘8), dans l'ordre des favoris, un seul par module. */
export const MAX_EPINGLES = 8;
export function choisirEpingles<T extends { id: string }>(favoris: readonly string[], resoudre: (cle: string) => T | undefined, max = MAX_EPINGLES): T[] {
  const vus = new Set<string>();
  const sortie: T[] = [];
  for (const cle of favoris) {
    const m = resoudre(cle);
    if (!m || vus.has(m.id)) continue;
    vus.add(m.id);
    sortie.push(m);
    if (sortie.length === max) break;
  }
  return sortie;
}

/** La date de dernière ouverture de chaque module (la plus récente de ses vues), d'après le journal du poste. */
export function dernieresOuvertures(modules: readonly ModuleRepertoire[], journal: Readonly<Record<string, string>>): Map<string, number> {
  const m = new Map<string, number>();
  for (const mod of modules) {
    let t = Number.NaN;
    for (const cle of mod.cles) {
      const d = Date.parse(journal[cle] ?? '');
      if (Number.isFinite(d) && !(d <= t)) t = d;
    }
    if (Number.isFinite(t)) m.set(mod.id, t);
  }
  return m;
}

/** Les `n` derniers modules ouverts par la personne, le plus récent d'abord. */
export function recents(modules: readonly ModuleRepertoire[], ouvertures: ReadonlyMap<string, number>, n = 4): { module: ModuleRepertoire; le: number }[] {
  return modules
    .filter((m) => ouvertures.has(m.id))
    .map((m) => ({ module: m, le: ouvertures.get(m.id) ?? 0 }))
    .sort((a, b) => b.le - a.le)
    .slice(0, n);
}

const RANG_NIVEAU: Record<Niveau, number> = { essentiel: 0, courant: 1, avance: 2 };

/**
 * Trois modules à découvrir : activés, ouvrables, jamais ouverts par la personne ; les essentiels d'abord, puis les
 * courants, puis les avancés, dans l'ordre du registre.
 */
export function aDecouvrir(modules: readonly ModuleRepertoire[], ouvertures: ReadonlyMap<string, number>, n = 3): ModuleRepertoire[] {
  return modules
    .map((m, i) => ({ m, i }))
    .filter(({ m }) => m.active && !m.verrouille && !ouvertures.has(m.id))
    .sort((a, b) => RANG_NIVEAU[a.m.niveau] - RANG_NIVEAU[b.m.niveau] || a.i - b.i)
    .slice(0, n)
    .map(({ m }) => m);
}

/** « Vous en avez ouvert x sur N » : la part, de 0 à 1. */
export function partOuverte(ouverts: number, total: number): number {
  return total > 0 ? Math.min(1, Math.max(0, ouverts / total)) : 0;
}

/** Quand un module a été ouvert, dit court (« il y a 4 min », « 12 min », « ce matin », « hier »). */
export type Moment =
  | { cle: 'instant' }
  | { cle: 'minutes'; n: number }
  | { cle: 'heures'; n: number }
  | { cle: 'matin' }
  | { cle: 'hier' }
  | { cle: 'date'; date: Date };

export function momentDOuverture(le: number, maintenant: Date): Moment {
  const minutes = Math.floor((maintenant.getTime() - le) / 60_000);
  if (minutes < 1) return { cle: 'instant' };
  if (minutes < 60) return { cle: 'minutes', n: minutes };
  const d = new Date(le);
  if (d.toDateString() === maintenant.toDateString()) {
    if (d.getHours() < 12 && maintenant.getHours() >= 12) return { cle: 'matin' };
    return { cle: 'heures', n: Math.floor(minutes / 60) };
  }
  const hier = new Date(maintenant);
  hier.setDate(hier.getDate() - 1);
  if (d.toDateString() === hier.toDateString()) return { cle: 'hier' };
  return { cle: 'date', date: d };
}

/* ═══ Le clavier ═══ */

/** La ligne voisine dans la grille : ↑ ↓ dans la colonne, ← → vers la ligne la plus proche de la colonne voisine. */
export function ligneVoisine(lignes: readonly { colonne: number; haut: number }[], index: number, touche: string): number {
  if (index < 0 || index >= lignes.length) return -1;
  const ici = lignes[index];
  if (touche === 'Home') return 0;
  if (touche === 'End') return lignes.length - 1;
  if (touche === 'ArrowDown') return index + 1 < lignes.length && lignes[index + 1].colonne === ici.colonne ? index + 1 : index;
  if (touche === 'ArrowUp') return index > 0 && lignes[index - 1].colonne === ici.colonne ? index - 1 : index;
  if (touche === 'ArrowLeft' || touche === 'ArrowRight') {
    const cible = ici.colonne + (touche === 'ArrowRight' ? 1 : -1);
    let meilleur = -1;
    let ecart = Infinity;
    lignes.forEach((l, i) => {
      if (l.colonne !== cible) return;
      const e = Math.abs(l.haut - ici.haut);
      if (e < ecart) {
        ecart = e;
        meilleur = i;
      }
    });
    return meilleur >= 0 ? meilleur : index;
  }
  return index;
}
