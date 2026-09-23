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

/* ══════════════════════════════════════════════════════════════════════════
   39b · SCORING DES LEADS — la donne
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * « La main montre sept cartes au plus, de 104 px de large, posées tous les
 * 112 px et inclinées de 1° par rang : elles ne se recouvrent jamais. »
 * La carte sortie est relevée (haut 4 px) ; les autres descendent de 10 px par
 * rang à partir de 34 px (relevé du cahier : 34, 44, 54).
 */
export const DONNE = { carteMax: 7, largeur: 104, pas: 112, inclinaisonDeg: 1, hauteur: 206, hautSortie: 4, hautRang1: 34, descenteParRang: 10, seuilFort: 80 } as const;

export interface CritereLead {
  kind: 'critere';
  cle: string;
  nom: string;
  /** Le poids posé à la main, faute d'historique pour l'apprendre. */
  poidsInitial: number;
}

export interface FaitLead {
  critere: string;
  /** La raison, écrite en clair : « 4 sites à entretenir ». */
  texte: string;
  /** 0 → 1 : à quel point le fait porte le critère. */
  force: number;
  le: string;
}

export interface Lead {
  kind: 'lead';
  nom: string;
  telephone?: string;
  ouvertLe: string;
  faits: FaitLead[];
  /** Clos : signé ou perdu. Un lead clos sert à apprendre, jamais à jouer. */
  closLe?: string;
  signe?: boolean;
  /** Quand la carte a été jouée en premier (« Appeler le premier »). */
  joueEnPremierLe?: string;
}

export type EnregistrementLead = CritereLead | Lead;

/**
 * « Les critères sont appris sur les signatures des douze derniers mois. »
 * Le poids d'un critère est l'avance de signature des leads clos qui le
 * portaient sur le taux de signature global, ramenée à 100 % au total.
 * Sans historique (ou sans aucun écart), les poids posés à la main valent.
 */
export function poidsAppris(criteres: CritereLead[], leads: Lead[], maintenant: Date): Map<string, number> {
  const depuis = maintenant.getTime() - 365 * JOUR_MS;
  const clos = leads.filter((l) => l.closLe && new Date(l.closLe).getTime() >= depuis);
  const global = clos.length ? clos.filter((l) => l.signe).length / clos.length : 0;
  const brut = new Map<string, number>();
  for (const c of criteres) {
    const avec = clos.filter((l) => l.faits.some((f) => f.critere === c.cle));
    const taux = avec.length ? avec.filter((l) => l.signe).length / avec.length : 0;
    brut.set(c.cle, Math.max(0, taux - global));
  }
  let total = [...brut.values()].reduce((s, x) => s + x, 0);
  if (clos.length < criteres.length || total <= 0) {
    brut.clear();
    for (const c of criteres) brut.set(c.cle, c.poidsInitial);
    total = criteres.reduce((s, c) => s + c.poidsInitial, 0);
  }
  const r = new Map<string, number>();
  for (const [k, v] of brut) r.set(k, total > 0 ? Math.round((v / total) * 100) : 0);
  return r;
}

export interface Carte {
  lead: Lead & { id: string };
  score: number;
  /** Les trois raisons, de la plus lourde à la plus légère. */
  raisons: string[];
}

/**
 * Le score : la somme, critère par critère, du poids × la force du fait le
 * plus fort. « Le score ne s'affiche jamais sans ses trois raisons » : un
 * lead qui n'a pas trois faits n'a pas de carte.
 */
export function carteDe(lead: Lead & { id: string }, poids: Map<string, number>): Carte | null {
  const parCritere = new Map<string, FaitLead>();
  for (const f of lead.faits) {
    const x = parCritere.get(f.critere);
    if (!x || f.force > x.force) parCritere.set(f.critere, f);
  }
  const contributions = lead.faits
    .map((f) => ({ f, c: (poids.get(f.critere) ?? 0) * borne(f.force, 0, 1) }))
    .sort((a, b) => b.c - a.c || b.f.force - a.f.force);
  if (contributions.length < 3) return null;
  const score = Math.round([...parCritere.values()].reduce((s, f) => s + (poids.get(f.critere) ?? 0) * borne(f.force, 0, 1), 0));
  return { lead, score: borne(score, 1, 99), raisons: contributions.slice(0, 3).map((x) => x.f.texte) };
}

/**
 * La donne : la plus forte au centre, puis alternativement à gauche et à
 * droite, de plus en plus loin — « plus une carte est faible, plus elle
 * s'éloigne vers les bords ». Au-delà de `max`, la pioche.
 */
export function donne(cartes: Carte[], max: number = DONNE.carteMax) {
  const tri = [...cartes].sort((a, b) => b.score - a.score || a.lead.nom.localeCompare(b.lead.nom, 'fr'));
  const main = tri.slice(0, Math.min(max, DONNE.carteMax)).map((carte, i) => {
    const rangAbs = Math.ceil(i / 2);
    const rang = i === 0 ? 0 : i % 2 === 1 ? -rangAbs : rangAbs;
    return {
      carte,
      rang,
      dxPx: rang * DONNE.pas,
      rotationDeg: rang * DONNE.inclinaisonDeg,
      hautPx: rang === 0 ? DONNE.hautSortie : DONNE.hautRang1 + (Math.abs(rang) - 1) * DONNE.descenteParRang,
      z: rang === 0 ? 9 : 5 - Math.abs(rang),
    };
  });
  return { main: main.sort((a, b) => a.rang - b.rang), pioche: tri.slice(main.length), sortie: tri[0] ?? null };
}

/** Deux cartes voisines ne se recouvrent jamais : le pas dépasse la largeur. */
export const recouvrement = () => DONNE.pas < DONNE.largeur;

/**
 * « Le score se recalcule chaque nuit, et à chaque nouvel événement. » Le
 * dernier recalcul est donc le plus récent de la nuit (6 h) et du dernier
 * fait posé sur un lead ouvert.
 */
export function dernierRecalcul(leads: Lead[], maintenant: Date): { le: Date; parEvenement: boolean } {
  const nuit = new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate(), 6);
  if (nuit > maintenant) nuit.setDate(nuit.getDate() - 1);
  const dernier = leads
    .filter((l) => !l.closLe)
    .flatMap((l) => l.faits.map((f) => new Date(f.le)))
    .filter((d) => d <= maintenant)
    .sort((a, b) => b.getTime() - a.getTime())[0];
  return dernier && dernier > nuit ? { le: dernier, parEvenement: true } : { le: nuit, parEvenement: false };
}

export { JOUR_MS, borne };
