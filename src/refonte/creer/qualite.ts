/**
 * MR11 · QUALITÉ ET CONTRÔLES — logique pure (verdicts, conformité, Pareto, conformité du mois).
 *
 * Règles de la fiche MR11, rubrique 6. La conformité d'un contrôle est PROVISOIRE tant que
 * des points sont « À vérifier » et définitive à la signature. Le Pareto compte TOUS les
 * écarts du mois (ouverts ou clos), pas seulement les ouverts.
 */

import { grouper, pourcentDe, type Jour } from './commun';

export type Verdict = 'conforme' | 'non-conforme' | 'sans-objet' | 'a-verifier';

export interface ResultatEntree {
  pointId: string;
  /** Jeux fictifs : `true` / `false` / `null` (non renseigné). */
  conforme?: boolean | null;
  sansObjet?: boolean;
}

export const verdictDuPoint = (r: ResultatEntree | undefined): Verdict =>
  !r ? 'a-verifier' : r.sansObjet ? 'sans-objet' : r.conforme === true ? 'conforme' : r.conforme === false ? 'non-conforme' : 'a-verifier';

export interface ControleEntree {
  id: string;
  /** Identifiants de tous les points du modèle, dans l'ordre. */
  pointsIds: readonly string[];
  resultats: readonly ResultatEntree[];
  le: Jour;
  signeLe?: Jour | null;
  chantierOuClient?: string | null;
}

export interface Compteurs { conformes: number; nonConformes: number; sansObjet: number; aVerifier: number; total: number }

/** Conformes, non conformes, à vérifier (17 + 2 + 3 = 22). */
export function compterLesPoints(c: Pick<ControleEntree, 'pointsIds' | 'resultats'>): Compteurs {
  const par = new Map(c.resultats.map((r) => [r.pointId, r]));
  const out: Compteurs = { conformes: 0, nonConformes: 0, sansObjet: 0, aVerifier: 0, total: c.pointsIds.length };
  for (const id of c.pointsIds) {
    const v = verdictDuPoint(par.get(id));
    if (v === 'conforme') out.conformes += 1;
    else if (v === 'non-conforme') out.nonConformes += 1;
    else if (v === 'sans-objet') out.sansObjet += 1;
    else out.aVerifier += 1;
  }
  return out;
}

export type TonConformite = 'vert' | 'orange' | 'rouge';

/** Vert ≥ 90 %, orange de 70 à 89 %, rouge en dessous. */
export const tonDeConformite = (pct: number): TonConformite => (pct >= 90 ? 'vert' : pct >= 70 ? 'orange' : 'rouge');

/** Conformité = conformes ÷ (points − sans objet), arrondie ; provisoire tant que des points sont à vérifier, définitive à la signature. */
export function conformiteDuControle(c: ControleEntree): { pct: number; provisoire: boolean; ton: TonConformite } {
  const k = compterLesPoints(c);
  const pct = pourcentDe(k.conformes, k.total - k.sansObjet);
  return { pct, provisoire: !c.signeLe, ton: tonDeConformite(pct) };
}

/** La signature n'est possible que lorsqu'aucun point n'est « À vérifier » ; les écarts peuvent rester ouverts (ils ont une action corrective). */
export const peutSigner = (c: Pick<ControleEntree, 'pointsIds' | 'resultats' | 'signeLe'>): { ok: boolean; restants: number } => {
  const restants = compterLesPoints(c).aVerifier;
  return { ok: restants === 0 && !c.signeLe, restants };
};

/** Contrôles du mois par date décroissante, pour « 2 sur 26 » (celui du jour est le 1). */
export function controlesDuMois<T extends ControleEntree>(controles: readonly T[], aujourdhui: Jour): T[] {
  return controles.filter((c) => c.le.slice(0, 7) === aujourdhui.slice(0, 7)).sort((a, b) => b.le.localeCompare(a.le));
}

/** Conformité du mois = moyenne des conformités des contrôles SIGNÉS du mois ; « validés du premier coup » = signés sans aucun écart. */
export function conformiteDuMois(controles: readonly ControleEntree[], ecartsParControle: Readonly<Record<string, number>>, aujourdhui: Jour): { pct: number | null; signes: number; premierCoup: number } {
  const signes = controlesDuMois(controles, aujourdhui).filter((c) => c.signeLe);
  if (signes.length === 0) return { pct: null, signes: 0, premierCoup: 0 };
  const moyenne = signes.reduce((s, c) => s + conformiteDuControle(c).pct, 0) / signes.length;
  return { pct: Math.round(moyenne), signes: signes.length, premierCoup: signes.filter((c) => (ecartsParControle[c.id] ?? 0) === 0).length };
}

/* -------- Pareto -------- */

export interface EcartEntree { id: string; cause: string; releveLe: Jour; lieu?: string | null }

export interface BarrePareto {
  cause: string;
  nombre: number;
  /** Cumul en % entier du total. */
  cumulPct: number;
  /** Colorée : jusqu'au premier cumul ≥ 80 % compris. */
  coloree: boolean;
  ton: 'rouge' | 'orange' | null;
}

export const SEUIL_PARETO_PCT = 80;

/**
 * Diagramme de Pareto des écarts relevés dans le mois (ouverts OU clos) : causes triées
 * par nombre décroissant, cumul, seuil de 80 %. La première barre colorée est rouge, les
 * suivantes orange. Phrase : « n causes font x % des écarts ».
 */
export function pareto(ecarts: readonly EcartEntree[], aujourdhui: Jour): { barres: BarrePareto[]; total: number; causesDominantes: number; partDominantesPct: number } {
  const duMois = ecarts.filter((e) => e.releveLe.slice(0, 7) === aujourdhui.slice(0, 7));
  const total = duMois.length;
  const groupes = [...grouper(duMois, (e) => e.cause).entries()].map(([cause, l]) => ({ cause, nombre: l.length })).sort((a, b) => b.nombre - a.nombre || a.cause.localeCompare(b.cause, 'fr'));
  let cumul = 0;
  let atteint = false;
  const barres: BarrePareto[] = groupes.map((g, i) => {
    cumul += g.nombre;
    const cumulPct = pourcentDe(cumul, total);
    const coloree = !atteint;
    if (cumulPct >= SEUIL_PARETO_PCT) atteint = true;
    return { cause: g.cause, nombre: g.nombre, cumulPct, coloree, ton: coloree ? (i === 0 ? 'rouge' : 'orange') : null };
  });
  const dominantes = barres.filter((b) => b.coloree);
  return { barres, total, causesDominantes: dominantes.length, partDominantesPct: dominantes.length ? dominantes[dominantes.length - 1].cumulPct : 0 };
}

/** « Où ils arrivent » : mêmes écarts par chantier ou client, les 3 plus fréquents plus « Autres ». */
export function ouIlsArrivent(ecarts: readonly EcartEntree[], aujourdhui: Jour, garder = 3): { lieu: string; nombre: number }[] {
  const duMois = ecarts.filter((e) => e.releveLe.slice(0, 7) === aujourdhui.slice(0, 7));
  const g = [...grouper(duMois, (e) => e.lieu ?? '')].map(([lieu, l]) => ({ lieu, nombre: l.length })).sort((a, b) => b.nombre - a.nombre || a.lieu.localeCompare(b.lieu, 'fr'));
  const tete = g.slice(0, garder);
  const reste = g.slice(garder).reduce((s, x) => s + x.nombre, 0);
  return reste > 0 ? [...tete, { lieu: '', nombre: reste }] : tete;
}
