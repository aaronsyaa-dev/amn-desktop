/**
 * LES ONZE AJOUTS — des modules rangés dans les familles existantes (`39a` → `39k`).
 * ═════════════════════════════════════════════════════════════════════════════════
 *
 * Chacun a son instrument, qui ne reprend pas celui de son voisin. Les
 * formules et les règles des fiches (MODULES-NOUVEAUX §35 → §45) sont écrites
 * ici telles quelles, et testées par `npm run check:cinquante`.
 */

const JOUR_MS = 86_400_000;
const borne = (x: number, min: number, max: number) => Math.min(max, Math.max(min, x));

/* ══════════════════════════════════════════════════════════════════════════
   39a · TABLEAU DE BORD — le pupitre
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * La géométrie des cadrans, relevée sur le HTML du cahier : un arc de 270°
 * qui part en bas à gauche (135°, repère SVG) et tourne dans le sens horaire
 * jusqu'en bas à droite (45°). Grand cadran r 120, aiguille 106, trait 14 ;
 * petit cadran r 40, aiguille 34, trait 6.
 */
export const PUPITRE = {
  departDeg: 135,
  balayageDeg: 270,
  grand: { r: 120, aiguille: 106, trait: 14, moyeu: 9, viewBox: '-134 -134 268 230.48' },
  petit: { r: 40, aiguille: 34, trait: 6, moyeu: 4, viewBox: '-46 -46 92 79.12' },
  /** « Le bandeau contient au plus six cadrans. » */
  bandeauMax: 6,
} as const;

const r1 = (x: number) => Math.round(x * 10) / 10;

/** Le point du cadran pour une part `0 → 1`, à la distance `r` du centre. */
export function pointCadran(part: number, r: number) {
  const a = ((PUPITRE.departDeg + PUPITRE.balayageDeg * borne(part, 0, 1)) * Math.PI) / 180;
  return { x: r1(r * Math.cos(a)), y: r1(r * Math.sin(a)) };
}

/** L'arc du cadran de 0 à `part` — `null` à zéro, où il n'y a rien à tracer. */
export function arcCadran(part: number, r: number): string | null {
  const p = borne(part, 0, 1);
  if (p <= 0) return null;
  const a = pointCadran(0, r);
  const b = pointCadran(p, r);
  const grand = PUPITRE.balayageDeg * p > 180 ? 1 : 0;
  return `M${a.x} ${a.y} A${r} ${r} 0 ${grand} 1 ${b.x} ${b.y}`;
}

/** Le pupitre d'UNE personne — « celui de Léa n'est pas celui de Nour ». */
export interface Pupitre {
  kind: 'pupitre';
  /** L'identifiant du compte qui l'a composé. */
  utilisateur: string;
  centre: string;
  bandeau: string[];
  modifieLe: string;
  /** Chaque passage au centre, pour « le plus souvent au centre ». */
  centres: Array<{ cle: string; le: string }>;
  /** Les objectifs que la personne s'est fixés, par indicateur. */
  objectifs?: Record<string, number>;
}

/**
 * « Un seul cadran central, toujours ; en ajouter un second en remplace un. »
 * « L'ancien cadran central rejoint alors le bandeau » — à la place que
 * libère le nouveau s'il en venait, sinon en tête ; le bandeau ne dépasse
 * jamais six cadrans.
 */
export function mettreAuCentre(p: Pupitre, cle: string, maintenant: Date): Pupitre {
  if (cle === p.centre) return p;
  const i = p.bandeau.indexOf(cle);
  const bandeau = [...p.bandeau];
  if (i >= 0) bandeau[i] = p.centre;
  else bandeau.unshift(p.centre);
  return {
    ...p,
    centre: cle,
    bandeau: bandeau.slice(0, PUPITRE.bandeauMax),
    modifieLe: maintenant.toISOString(),
    centres: [...p.centres, { cle, le: maintenant.toISOString() }],
  };
}

/** Ajouter un petit cadran : refusé (`null`) quand le bandeau en porte déjà six. */
export function ajouterAuBandeau(p: Pupitre, cle: string, maintenant: Date): Pupitre | null {
  if (cle === p.centre || p.bandeau.includes(cle)) return p;
  if (p.bandeau.length >= PUPITRE.bandeauMax) return null;
  return { ...p, bandeau: [...p.bandeau, cle], modifieLe: maintenant.toISOString() };
}

export function retirerDuBandeau(p: Pupitre, cle: string, maintenant: Date): Pupitre {
  return { ...p, bandeau: p.bandeau.filter((c) => c !== cle), modifieLe: maintenant.toISOString() };
}

/** L'indicateur le plus souvent mis au centre ; à égalité, le plus récent. */
export function lePlusSouventAuCentre(p: Pick<Pupitre, 'centres' | 'centre'>): string {
  const n = new Map<string, { n: number; dernier: string }>();
  for (const c of p.centres) {
    const x = n.get(c.cle) ?? { n: 0, dernier: '' };
    n.set(c.cle, { n: x.n + 1, dernier: c.le > x.dernier ? c.le : x.dernier });
  }
  const tri = [...n.entries()].sort((a, b) => b[1].n - a[1].n || b[1].dernier.localeCompare(a[1].dernier));
  return tri[0]?.[0] ?? p.centre;
}

/** Les jours qui restent dans le mois, aujourd'hui compris. */
export function joursRestantsDuMois(maintenant: Date): number {
  const fin = new Date(maintenant.getFullYear(), maintenant.getMonth() + 1, 0).getDate();
  return fin - maintenant.getDate() + 1;
}

/** Le lundi de la semaine en cours, à minuit. */
export function lundiDe(maintenant: Date): Date {
  const d = new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

export { JOUR_MS, borne };
