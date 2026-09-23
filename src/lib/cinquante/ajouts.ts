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

/* ══════════════════════════════════════════════════════════════════════════
   39c · ITINÉRAIRES — la carte des deux routes
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * « Positions des arrêts en pourcentage du plan, routes en `viewBox` de même
 * proportion » : le plan fait 1000 × 360, un arrêt à (18 %, 62 %) est tracé
 * en (180, 223,2).
 */
export const PLAN = { largeur: 1000, hauteur: 360 } as const;
export const versPlan = (p: { xPct: number; yPct: number }) => ({
  x: Math.round(p.xPct * (PLAN.largeur / 100) * 100) / 100,
  y: Math.round(p.yPct * (PLAN.hauteur / 100) * 100) / 100,
});

export interface PointPlan {
  id: string;
  nom: string;
  /** Le nom court posé sur le plan. */
  court?: string;
  xPct: number;
  yPct: number;
}

export interface ArretItineraire extends PointPlan {
  adresse?: string;
  /** Le créneau imposé par le client, « HH:MM » ; l'un ou l'autre peut manquer. */
  creneau?: { debut?: string; fin?: string };
  dureeMin: number;
}

/** Un trajet réel, calculé par un routeur — jamais mesuré sur le tracé. */
export interface Trajet {
  de: string;
  a: string;
  km: number;
  min: number;
}

export interface CoursDEau {
  nom: string;
  /** Les points de la rive médiane, en pourcentage du plan. */
  points: Array<[number, number]>;
  largeur: number;
}

export interface PlanItineraire {
  kind: 'plan';
  jour: string;
  depart: string;
  depot: PointPlan;
  arrets: ArretItineraire[];
  ordreHabituel: string[];
  trajets: Trajet[];
  envoyeLe?: string;
  /** Les gains enregistrés au moment de l'envoi, pour le bilan du mois. */
  gains?: { km: number; min: number };
}

export interface ReglageItineraire {
  kind: 'reglage';
  coursDEau: CoursDEau[];
  consoL100: number;
}

export type EnregistrementItineraire = PlanItineraire | ReglageItineraire;

const enMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + (m || 0);
};

export interface Evaluation {
  km: number;
  min: number;
  /** Les minutes d'arrivée après la fin d'un créneau, cumulées. */
  retardMin: number;
  /** Les arrêts dont le créneau est tenu. */
  tenus: string[];
  complet: boolean;
}

/** Une boucle dépôt → arrêts → dépôt, avec les trajets réels. */
export function evaluer(plan: Pick<PlanItineraire, 'depart' | 'depot' | 'arrets' | 'trajets'>, ordre: string[]): Evaluation {
  const trajet = (de: string, a: string) => plan.trajets.find((t) => (t.de === de && t.a === a) || (t.de === a && t.a === de));
  const parId = new Map(plan.arrets.map((a) => [a.id, a]));
  let km = 0;
  let route = 0;
  let horloge = enMin(plan.depart);
  let retardMin = 0;
  let complet = true;
  const tenus: string[] = [];
  const etapes = [plan.depot.id, ...ordre, plan.depot.id];
  for (let i = 1; i < etapes.length; i += 1) {
    const t = trajet(etapes[i - 1], etapes[i]);
    if (!t) {
      complet = false;
      continue;
    }
    km += t.km;
    route += t.min;
    horloge += t.min;
    const a = parId.get(etapes[i]);
    if (!a) continue;
    if (a.creneau?.debut) horloge = Math.max(horloge, enMin(a.creneau.debut));
    if (a.creneau?.fin && horloge > enMin(a.creneau.fin)) retardMin += horloge - enMin(a.creneau.fin);
    else if (a.creneau) tenus.push(a.id);
    horloge += a.dureeMin;
  }
  return { km: Math.round(km * 10) / 10, min: Math.round(route), retardMin, tenus, complet };
}

function* permutations<T>(xs: T[]): Generator<T[]> {
  if (xs.length <= 1) {
    yield xs;
    return;
  }
  for (let i = 0; i < xs.length; i += 1) {
    const reste = [...xs.slice(0, i), ...xs.slice(i + 1)];
    for (const p of permutations(reste)) yield [xs[i], ...p];
  }
}

/**
 * « L'optimisation respecte d'abord les créneaux imposés par les clients, et
 * seulement ensuite la distance » : on compare d'abord le retard sur les
 * créneaux, puis les kilomètres. Toutes les permutations jusqu'à huit arrêts
 * (40 320) ; au-delà, le plus proche voisin amélioré par 2-opt, au même ordre
 * de comparaison.
 */
export function optimiser(plan: Pick<PlanItineraire, 'depart' | 'depot' | 'arrets' | 'trajets'>): string[] {
  const ids = plan.arrets.map((a) => a.id);
  const mieux = (a: Evaluation, b: Evaluation) => a.retardMin < b.retardMin || (a.retardMin === b.retardMin && a.km < b.km);
  if (ids.length <= 8) {
    let best = ids;
    let e = evaluer(plan, ids);
    for (const p of permutations(ids)) {
      const x = evaluer(plan, p);
      if (x.complet && mieux(x, e)) {
        best = p;
        e = x;
      }
    }
    return best;
  }
  let ordre = [...ids];
  let e = evaluer(plan, ordre);
  for (let progres = true; progres; ) {
    progres = false;
    for (let i = 0; i < ordre.length - 1; i += 1) {
      for (let j = i + 1; j < ordre.length; j += 1) {
        const essai = [...ordre.slice(0, i), ...ordre.slice(i, j + 1).reverse(), ...ordre.slice(j + 1)];
        const x = evaluer(plan, essai);
        if (x.complet && mieux(x, e)) {
          ordre = essai;
          e = x;
          progres = true;
        }
      }
    }
  }
  return ordre;
}

/** La rive médiane d'un cours d'eau, lissée (Catmull-Rom) — la même courbe pour le dessin et pour les traversées. */
export function courbeCoursDEau(c: Pick<CoursDEau, 'points'>, pas = 12): Array<{ x: number; y: number }> {
  const pts = c.points.map(([xPct, yPct]) => versPlan({ xPct, yPct }));
  if (pts.length < 2) return pts;
  const r: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < pts.length - 1; i += 1) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let k = 0; k < pas; k += 1) {
      const t = k / pas;
      const t2 = t * t;
      const t3 = t2 * t;
      r.push({
        x: 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y: 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
      });
    }
  }
  r.push(pts[pts.length - 1]);
  return r;
}

const coupe = (a: { x: number; y: number }, b: { x: number; y: number }, c: { x: number; y: number }, d: { x: number; y: number }) => {
  const o = (p: typeof a, q: typeof a, r: typeof a) => Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x));
  return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
};

/** Combien de fois une boucle traverse un cours d'eau. */
export function traversees(plan: Pick<PlanItineraire, 'depot' | 'arrets'>, ordre: string[], c: Pick<CoursDEau, 'points'>): number {
  const parId = new Map<string, PointPlan>([[plan.depot.id, plan.depot], ...plan.arrets.map((a) => [a.id, a] as [string, PointPlan])]);
  const etapes = [plan.depot.id, ...ordre, plan.depot.id].map((id) => versPlan(parId.get(id) as PointPlan));
  const rive = courbeCoursDEau(c);
  let n = 0;
  for (let i = 1; i < etapes.length; i += 1) for (let j = 1; j < rive.length; j += 1) if (coupe(etapes[i - 1], etapes[i], rive[j - 1], rive[j])) n += 1;
  return n;
}

/** Le tracé d'une boucle dans la `viewBox` du plan. */
export function traceBoucle(plan: Pick<PlanItineraire, 'depot' | 'arrets'>, ordre: string[]): string {
  const parId = new Map<string, PointPlan>([[plan.depot.id, plan.depot], ...plan.arrets.map((a) => [a.id, a] as [string, PointPlan])]);
  return [plan.depot.id, ...ordre, plan.depot.id]
    .map((id, i) => {
      const p = versPlan(parId.get(id) as PointPlan);
      return `${i ? 'L' : 'M'}${Math.round(p.x * 10) / 10} ${Math.round(p.y * 10) / 10}`;
    })
    .join(' ');
}

/* ══════════════════════════════════════════════════════════════════════════
   39d · PRÉVISION DE STOCK — la mèche
   ══════════════════════════════════════════════════════════════════════════ */

/** « L'échelle de 40 jours est commune à toutes les mèches. » */
export const ECHELLE_MECHE_J = 40;

export interface SuiviStock {
  kind: 'suivi';
  /** Le nom de l'article dans Stock. */
  article: string;
  /** Le nom du fournisseur dans Fournisseurs. */
  fournisseur: string;
}

export interface ComposantKit {
  label: string;
  quantity: number;
  components?: ComposantKit[];
}

export interface InterventionPlanifiee {
  title: string;
  at: string;
  closedAt: string;
  consommations: Array<{ label: string; quantity: number }>;
}

const memeNom = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** La quantité d'un article dans un kit — la quantité d'une boîte multiplie son contenu. */
export function quantiteDansKit(composants: ComposantKit[], article: string, facteur = 1): number {
  return composants.reduce(
    (s, c) => s + (memeNom(c.label, article) ? c.quantity * facteur : 0) + (c.components ? quantiteDansKit(c.components, article, c.quantity * facteur) : 0),
    0,
  );
}

/**
 * Ce qu'une intervention planifiée consommera : ses consommations prévues si
 * la fiche les porte, sinon la nomenclature du kit dont le produit figure
 * dans son titre.
 */
export function consommationPrevue(
  i: InterventionPlanifiee,
  article: string,
  kits: Array<{ product: string; components: ComposantKit[] }>,
): number {
  const prevue = i.consommations.filter((c) => memeNom(c.label, article)).reduce((s, c) => s + c.quantity, 0);
  if (i.consommations.length) return prevue;
  const kit = kits.find((k) => i.title.toLowerCase().includes(k.product.toLowerCase()));
  return kit ? quantiteDansKit(kit.components, article) : 0;
}

export interface Meche {
  article: string;
  stock: number;
  /** Le jour de la rupture prévue (0 = aujourd'hui) ; `null` au-delà de l'échelle. */
  ruptureJ: number | null;
  delaiJ: number | null;
  /** « Point de commande = rupture − délai fournisseur ». Négatif : déjà passé. */
  cranJ: number | null;
  /** Consommation prévue, ramenée à la semaine. */
  parSemaine: number;
  /** Les interventions qui tomberont sans l'article, même en commandant aujourd'hui. */
  interventionsSans: number;
}

/**
 * La mèche d'un article. La consommation vient des interventions planifiées
 * jour par jour ; au-delà du DERNIER jour planifié seulement, la moyenne des
 * huit dernières semaines prend le relais — « pas d'une moyenne historique
 * seule ».
 */
export function meche(
  article: string,
  stock: number,
  delaiJ: number | null,
  interventions: InterventionPlanifiee[],
  kits: Array<{ product: string; components: ComposantKit[] }>,
  maintenant: Date,
): Meche {
  const minuit = new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate()).getTime();
  const jourDe = (iso: string) => Math.floor((new Date(iso).getTime() - minuit) / JOUR_MS);
  const planifiees = interventions.filter((i) => !i.closedAt && jourDe(i.at) >= 0 && jourDe(i.at) < ECHELLE_MECHE_J);
  const parJour = Array.from({ length: ECHELLE_MECHE_J }, () => 0);
  for (const i of planifiees) parJour[jourDe(i.at)] += consommationPrevue(i, article, kits);
  const dernierPlanifie = planifiees.reduce((m, i) => Math.max(m, jourDe(i.at)), -1);
  const passees = interventions.filter((i) => i.closedAt && jourDe(i.at) < 0 && jourDe(i.at) >= -56);
  const moyenne = passees.reduce((s, i) => s + consommationPrevue(i, article, kits), 0) / 56;
  for (let j = dernierPlanifie + 1; j < ECHELLE_MECHE_J; j += 1) parJour[j] += moyenne;

  let reste = stock;
  let ruptureJ: number | null = stock <= 0 ? 0 : null;
  for (let j = 0; j < ECHELLE_MECHE_J && ruptureJ === null; j += 1) {
    reste -= parJour[j];
    if (reste < 0) ruptureJ = j;
  }
  const arrivee = delaiJ ?? 0;
  const interventionsSans = ruptureJ === null ? 0 : planifiees.filter((i) => jourDe(i.at) >= (ruptureJ as number) && jourDe(i.at) < arrivee && consommationPrevue(i, article, kits) > 0).length;
  const total = parJour.reduce((s, x) => s + x, 0);
  return {
    article,
    stock,
    ruptureJ,
    delaiJ,
    cranJ: ruptureJ === null || delaiJ === null ? null : ruptureJ - delaiJ,
    parSemaine: Math.round((total / ECHELLE_MECHE_J) * 7 * 10) / 10,
    interventionsSans,
  };
}

/** Une position sur l'échelle commune, en % ; « un cran négatif se dessine au bord gauche ». */
export const surEchelle = (j: number) => (borne(j, 0, ECHELLE_MECHE_J) / ECHELLE_MECHE_J) * 100;

/** La mèche en ambre : la plus urgente de celles dont le cran est déjà passé. */
export function mecheEnAmbre(meches: Meche[]): Meche | null {
  return meches.filter((m) => m.cranJ !== null && m.cranJ < 0 && m.stock > 0).sort((a, b) => (a.ruptureJ ?? 99) - (b.ruptureJ ?? 99))[0] ?? null;
}

/* ══════════════════════════════════════════════════════════════════════════
   39e · FLOTTE — les odomètres
   ══════════════════════════════════════════════════════════════════════════ */

/** Les tambours du compteur : six chiffres, le dernier en clair. */
export const TAMBOURS = 6;
const isoLocal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const tambours = (km: number) => String(Math.max(0, Math.floor(km))).padStart(TAMBOURS, '0').slice(-TAMBOURS).split('');

export interface Echeance {
  nom: string;
  /** Pour l'article : « la vidange », « le contrôle technique ». */
  feminin?: boolean;
  /** « en kilomètres ou en jours selon sa nature » */
  nature: 'km' | 'jours';
  /** 15 000 km pour une vidange, 730 jours (deux ans) pour un contrôle technique. */
  intervalle: number;
  /** Le compteur à la dernière échéance faite (nature km). */
  dernierKm?: number;
  /** La date de la dernière échéance faite (nature jours). */
  dernierLe?: string;
  rendezVous?: string;
}

export interface Vehicule {
  kind: 'vehicule';
  nom: string;
  immatriculation?: string;
  /** Le compteur au jour où le suivi a commencé ; les tournées pointées s'y ajoutent. */
  kmDepart: number;
  departLe: string;
  echeances: Echeance[];
  couts: Array<{ le: string; montantCents: number; nature: 'carburant' | 'entretien' | 'assurance' }>;
}

/** Une tournée telle que Tournées l'écrit, avec le véhicule qui la fait. */
export interface TourneeFlotte {
  day: string;
  vehiculeId?: string;
  stops: Array<{ km?: number; doneAt: string | null }>;
}

/** « Chaque tournée ajoute sa distance calculée » — seulement ses arrêts pointés. */
export const kmPointes = (t: TourneeFlotte) => t.stops.reduce((s, a) => s + (a.doneAt && typeof a.km === 'number' ? a.km : 0), 0);

export function compteur(v: Vehicule & { id: string }, tournees: TourneeFlotte[]) {
  const siennes = tournees.filter((t) => t.vehiculeId === v.id && t.day >= v.departLe.slice(0, 10) && kmPointes(t) > 0);
  const km = v.kmDepart + siennes.reduce((s, t) => s + kmPointes(t), 0);
  const releve = siennes.map((t) => t.day).sort().pop() ?? v.departLe.slice(0, 10);
  return { km: Math.round(km), releveLe: releve };
}

export interface EtatEcheance {
  e: Echeance;
  /** 0 → 1 : la jauge se remplit sur l'intervalle de l'échéance. */
  part: number;
  /** Ce qu'il reste, dans l'unité de l'échéance. */
  reste: number;
  /** La date où elle tombe (estimée au rythme des 30 derniers jours pour une échéance en km). */
  tombeLe: Date | null;
}

export function etatEcheance(e: Echeance, km: number, kmParJour: number, maintenant: Date): EtatEcheance {
  if (e.nature === 'km') {
    const fait = km - (e.dernierKm ?? 0);
    const reste = e.intervalle - fait;
    return {
      e,
      part: borne(fait / e.intervalle, 0, 1),
      reste,
      tombeLe: kmParJour > 0 ? new Date(maintenant.getTime() + Math.max(0, reste / kmParJour) * JOUR_MS) : reste <= 0 ? maintenant : null,
    };
  }
  const depuis = e.dernierLe ? (maintenant.getTime() - new Date(e.dernierLe).getTime()) / JOUR_MS : 0;
  const tombe = e.dernierLe ? new Date(new Date(e.dernierLe).getTime() + e.intervalle * JOUR_MS) : null;
  return { e, part: borne(depuis / e.intervalle, 0, 1), reste: Math.ceil(e.intervalle - depuis), tombeLe: tombe };
}

/** Le rythme du véhicule : les kilomètres pointés sur les 30 derniers jours, par jour. */
export function kmParJour(v: { id: string }, tournees: TourneeFlotte[], maintenant: Date): number {
  const depuis = isoLocal(new Date(maintenant.getTime() - 30 * JOUR_MS));
  return tournees.filter((t) => t.vehiculeId === v.id && t.day >= depuis).reduce((s, t) => s + kmPointes(t), 0) / 30;
}

/**
 * « L'ambre va à la première échéance qui tombe avant un chantier planifié
 * avec ce véhicule » : une tournée prévue (non faite) ce jour-là ou après.
 */
export function echeanceEnAmbre(
  etats: Array<{ v: { id: string }; etat: EtatEcheance }>,
  tournees: TourneeFlotte[],
  maintenant: Date,
): { v: { id: string }; etat: EtatEcheance; chantiers: string[] } | null {
  const aujourdhui = isoLocal(maintenant);
  const candidats = etats
    .filter((x) => x.etat.tombeLe && !x.etat.e.rendezVous)
    .map((x) => {
      const le = isoLocal(x.etat.tombeLe as Date);
      const chantiers = tournees
        .filter((t) => t.vehiculeId === x.v.id && t.day >= le && t.day >= aujourdhui && t.stops.some((a) => !a.doneAt))
        .map((t) => t.day)
        .sort();
      return { ...x, chantiers };
    })
    .filter((x) => x.chantiers.length > 0)
    .sort((a, b) => (a.etat.tombeLe as Date).getTime() - (b.etat.tombeLe as Date).getTime());
  return candidats[0] ?? null;
}

/**
 * Le jour du rendez-vous : le dernier jour ouvré avant l'échéance où le
 * véhicule n'a pas de tournée — à partir de demain.
 */
export function jourDeRendezVous(v: { id: string }, tombeLe: Date, tournees: TourneeFlotte[], maintenant: Date): Date | null {
  const occupes = new Set(tournees.filter((t) => t.vehiculeId === v.id).map((t) => t.day));
  const demain = new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate() + 1);
  for (let d = new Date(tombeLe.getFullYear(), tombeLe.getMonth(), tombeLe.getDate() - 1); d >= demain; d.setDate(d.getDate() - 1)) {
    if (d.getDay() !== 0 && d.getDay() !== 6 && !occupes.has(isoLocal(d))) return new Date(d);
  }
  return null;
}

/* ══════════════════════════════════════════════════════════════════════════
   39f · CLASSEUR — le palimpseste
   ══════════════════════════════════════════════════════════════════════════ */

export interface DocumentClasseur {
  kind: 'document';
  titre: string;
  /** Le numéro de la version signée — « une version signée est figée ». */
  signeeVersion?: number;
  signeeLe?: string;
  signataire?: string;
  /** Sans signature : « en vigueur » ou « brouillon ». */
  etat?: 'en vigueur' | 'brouillon';
  envoyeeASignerLe?: string;
}

export interface VersionClasseur {
  kind: 'version';
  documentId: string;
  numero: number;
  paragraphes: Array<{ titre: string; texte: string }>;
  auteur: string;
  deposeLe: string;
  octets: number;
}

export type EnregistrementClasseur = DocumentClasseur | VersionClasseur;

/** « La comparaison se fait par phrase. » */
export function phrases(texte: string): string[] {
  return texte
    .split(/(?<=[.!?…])\s+(?=[A-ZÀ-ÖØ-Þ0-9«])/u)
    .map((x) => x.trim())
    .filter(Boolean);
}

/**
 * Les mots d'une phrase — un montant (« 1 800 € ») reste UN mot : barrer
 * « 800 » seul dans « 1 800 € » ferait lire un autre nombre.
 */
export const mots = (phrase: string) => phrase.match(/\d{1,3}(?:[ \u00a0\u202f]\d{3})+(?:,\d+)?(?:[ \u00a0\u202f]?€)?|\d+(?:,\d+)?[ \u00a0\u202f]?€|\S+/gu) ?? [];

/** Le passage qui diffère entre deux phrases : on retire les mots communs en tête et en queue. */
export function ecart(a: string, b: string): { tete: string; avant: string; apres: string; queue: string } {
  const x = mots(a);
  const y = mots(b);
  let i = 0;
  while (i < x.length && i < y.length && x[i] === y[i]) i += 1;
  let j = 0;
  while (j < x.length - i && j < y.length - i && x[x.length - 1 - j] === y[y.length - 1 - j]) j += 1;
  return {
    tete: y.slice(0, i).join(' '),
    avant: x.slice(i, x.length - j).join(' '),
    apres: y.slice(i, y.length - j).join(' '),
    queue: y.slice(y.length - j).join(' '),
  };
}

export interface Couche {
  /** Le texte antérieur, seulement le passage qui diffère. */
  texte: string;
  de: number;
  vers: number;
  auteur: string;
  le: string;
  /** Réécrite APRÈS la version signée. */
  apresSignature: boolean;
}

export interface PhrasePalimpseste {
  tete: string;
  couches: Couche[];
  actuel: string;
  queue: string;
}

export interface ParagraphePalimpseste {
  titre: string;
  phrases: PhrasePalimpseste[];
  reecritures: Couche[];
  apresSignature: boolean;
}

/**
 * Le document courant, avec sous lui ses versions antérieures — « là où le
 * texte a changé », jamais le document entier en double. Une phrase
 * identique d'une version à l'autre reste nette ; une phrase plusieurs fois
 * réécrite porte ses couches successives, de la plus ancienne à la plus
 * récente.
 */
export function palimpseste(versions: VersionClasseur[], signee: number | null): ParagraphePalimpseste[] {
  const tri = [...versions].sort((a, b) => a.numero - b.numero);
  const courante = tri[tri.length - 1];
  if (!courante) return [];
  return courante.paragraphes.map((p) => {
    const parVersion = tri.map((v) => phrases(v.paragraphes.find((q) => q.titre === p.titre)?.texte ?? ''));
    const actuelles = parVersion[parVersion.length - 1];
    const reecritures: Couche[] = [];
    const ph = actuelles.map((actuel, i) => {
      const couches: Couche[] = [];
      for (let k = 0; k < tri.length - 1; k += 1) {
        const avant = parVersion[k][i];
        const apres = parVersion[k + 1][i];
        if (avant !== undefined && apres !== undefined && avant !== apres) {
          const e = ecart(avant, actuel);
          const c = { texte: e.avant, de: tri[k].numero, vers: tri[k + 1].numero, auteur: tri[k + 1].auteur, le: tri[k + 1].deposeLe, apresSignature: signee !== null && tri[k].numero >= signee };
          couches.push(c);
          reecritures.push(c);
        }
      }
      if (!couches.length) return { tete: actuel, couches, actuel: '', queue: '' };
      /* Le passage commun à TOUTES les couches reste net, une seule fois. */
      const variantes = [...couches.map((c) => parVersion[tri.findIndex((v) => v.numero === c.de)][i]), actuel];
      const decoupe = variantes.map((v) => mots(v));
      let t = 0;
      while (decoupe.every((m) => t < m.length && m[t] === decoupe[0][t])) t += 1;
      let q = 0;
      while (decoupe.every((m) => q < m.length - t && m[m.length - 1 - q] === decoupe[0][decoupe[0].length - 1 - q])) q += 1;
      const milieu = (m: string[]) => m.slice(t, m.length - q).join(' ');
      return {
        tete: decoupe[decoupe.length - 1].slice(0, t).join(' '),
        couches: couches.map((c, n) => ({ ...c, texte: milieu(decoupe[n]) })),
        actuel: milieu(decoupe[decoupe.length - 1]),
        queue: decoupe[decoupe.length - 1].slice(decoupe[decoupe.length - 1].length - q).join(' '),
      };
    });
    return { titre: p.titre, phrases: ph, reecritures, apresSignature: reecritures.some((c) => c.apresSignature) };
  });
}

/* ══════════════════════════════════════════════════════════════════════════
   39g · ÉDITEUR PARTAGÉ — les papillons
   ══════════════════════════════════════════════════════════════════════════ */

/** « Au-delà de trois jours sans réponse, le plus ancien passe en ambre. » */
export const SEUIL_PAPILLON_J = 3;

export interface DocumentPartage {
  kind: 'document';
  titre: string;
  paragraphes: Array<{ id: string; texte: string }>;
}

export interface Papillon {
  kind: 'papillon';
  documentId: string;
  paragrapheId: string;
  auteur: string;
  /** Ce qu'on lit sur le papillon : « “entre 8 h et 10 h” ? ». */
  note: string;
  /** Le passage visé et son remplacement ; sans passage, on ajoute à la fin. */
  cible?: string;
  par: string;
  poseLe: string;
  statut: 'attente' | 'acceptee' | 'refusee' | 'caduque';
  reponduLe?: string;
}

export type EnregistrementPartage = DocumentPartage | Papillon;

/** « NO · Nour » : les deux premières lettres du prénom. */
export const initiales = (nom: string) => nom.trim().slice(0, 2).toLocaleUpperCase('fr');

export function agePapillon(poseLe: string, maintenant: Date): string {
  const ms = maintenant.getTime() - new Date(poseLe).getTime();
  const h = Math.floor(ms / 3_600_000);
  if (h < 1) return 'à l’instant';
  if (h < 24) return `il y a ${h} h`;
  const j = Math.floor(ms / JOUR_MS);
  return j === 1 ? 'hier' : `il y a ${j} j`;
}

/** Le papillon en ambre : le plus ancien en attente, s'il attend depuis plus de trois jours. */
export function papillonEnAmbre<T extends Papillon>(papillons: T[], maintenant: Date): T | null {
  const plusVieux = papillons.filter((p) => p.statut === 'attente').sort((a, b) => a.poseLe.localeCompare(b.poseLe))[0];
  if (!plusVieux) return null;
  return (maintenant.getTime() - new Date(plusVieux.poseLe).getTime()) / JOUR_MS > SEUIL_PAPILLON_J ? plusVieux : null;
}

/** « Le texte, lui, ne change qu'à l'acceptation. » */
export function appliquer(texte: string, p: Pick<Papillon, 'cible' | 'par'>): string {
  if (p.cible && texte.includes(p.cible)) return texte.replace(p.cible, p.par);
  if (p.cible) return texte;
  return `${texte.replace(/\s+$/, '')} ${p.par}`.trim();
}

/* ══════════════════════════════════════════════════════════════════════════
   39h · SALLES — le plan d'étage
   ══════════════════════════════════════════════════════════════════════════ */

/** « Une réservation sans présence au bout de 30 minutes passe en ambre et se libère au bout d'une heure. » */
export const FANTOME = { ambreMin: 30, liberationMin: 60 } as const;

export interface PlanEtage {
  kind: 'plan';
  /** « Le plan se dessine en grille à zones nommées, sans position absolue. » */
  colonnes: string;
  rangees: number[];
  zones: string[];
  pieces: Array<{ zone: string; nom: string; court?: string }>;
}

export interface ReservationSalle {
  kind: 'reservation';
  piece: string;
  debut: string;
  fin: string;
  motif: string;
  pour: string;
  contact?: string;
  prevenuLe?: string;
}

/** Une présence RÉELLE : arrivée pointée, badge, ouverture d'une intervention. */
export interface PresenceSalle {
  kind: 'presence';
  piece: string;
  qui: string;
  arriveeLe: string;
  departLe?: string;
  source: 'pointage' | 'badge' | 'intervention';
}

export type EnregistrementSalle = PlanEtage | ReservationSalle | PresenceSalle;

const chevauche = (p: PresenceSalle, debut: number, fin: number) =>
  new Date(p.arriveeLe).getTime() < fin && (!p.departLe || new Date(p.departLe).getTime() > debut);

export type EtatPiece =
  | { etat: 'occupee'; presence: PresenceSalle; jusqua: string | null }
  | { etat: 'fantome'; reservation: ReservationSalle; videDepuisMin: number; liberationLe: Date }
  | { etat: 'reservee'; reservation: ReservationSalle }
  | { etat: 'libre'; prochaine: ReservationSalle | null };

/**
 * L'état d'une pièce À L'INSTANT. « L'occupation vient d'une présence réelle,
 * jamais de la seule réservation » : une réservation sans présence n'occupe
 * rien ; au bout de 30 minutes elle est fantôme (ambre), au bout d'une heure
 * elle est libérée — la pièce redevient libre.
 */
export function etatPiece(piece: string, reservations: ReservationSalle[], presences: PresenceSalle[], maintenant: Date): EtatPiece {
  const t = maintenant.getTime();
  const ici = presences.filter((p) => p.piece === piece && chevauche(p, t, t + 1));
  const courante = reservations.find((r) => r.piece === piece && new Date(r.debut).getTime() <= t && new Date(r.fin).getTime() > t);
  if (ici.length) return { etat: 'occupee', presence: ici[0], jusqua: courante?.fin ?? null };
  if (courante) {
    const debut = new Date(courante.debut).getTime();
    const venue = presences.some((p) => p.piece === piece && chevauche(p, debut, t));
    const min = Math.floor((t - debut) / 60_000);
    if (!venue && min >= FANTOME.liberationMin) {
      /* Libérée : la pièce est libre, la réservation compte comme fantôme. */
    } else if (!venue && min >= FANTOME.ambreMin) {
      return { etat: 'fantome', reservation: courante, videDepuisMin: min, liberationLe: new Date(debut + FANTOME.liberationMin * 60_000) };
    } else if (!venue) {
      return { etat: 'reservee', reservation: courante };
    }
  }
  const prochaine = reservations.filter((r) => r.piece === piece && new Date(r.debut).getTime() > t).sort((a, b) => a.debut.localeCompare(b.debut))[0] ?? null;
  return { etat: 'libre', prochaine };
}

/** Une réservation fantôme : personne n'est venu dans la première heure. */
export function estFantome(r: ReservationSalle, presences: PresenceSalle[], maintenant: Date): boolean {
  const debut = new Date(r.debut).getTime();
  if (maintenant.getTime() < debut + FANTOME.liberationMin * 60_000) return false;
  return !presences.some((p) => p.piece === r.piece && chevauche(p, debut, debut + FANTOME.liberationMin * 60_000));
}

/* ══════════════════════════════════════════════════════════════════════════
   39i · RÉDACTION — les ratures
   ══════════════════════════════════════════════════════════════════════════ */

export type RaisonCorrection = 'plus court' | 'plus poli' | 'plus clair';
export type NatureEngagement = 'geste' | 'date' | 'prix';

export type MorceauBrouillon =
  | { type: 'texte'; texte: string }
  | {
      type: 'correction';
      /** Ce que l'assistant retire (barré), ce qu'il ajoute (souligné). */
      retire?: string;
      ajoute?: string;
      raison: RaisonCorrection;
      explication: string;
      /** Ce que vaut l'engagement, quand l'assistant a pu l'estimer : « un passage offert vaut 96 € ». */
      valeur?: string;
      decision?: 'acceptee' | 'refusee';
    };

export interface BrouillonRedaction {
  kind: 'brouillon';
  titre: string;
  /** Le texte auquel on répond, qui reste visible au-dessus. */
  source: { surtitre: string; texte: string; recuLe: string };
  morceaux: MorceauBrouillon[];
  creeLe: string;
  /** Publiée par VOUS — « l'assistant ne publie jamais ». */
  publieeLe?: string;
}

/**
 * « Toute correction qui ajoute un engagement (geste commercial, date, prix)
 * passe en ambre. » La reconnaissance est une liste fermée, écrite ici.
 */
export const ENGAGEMENTS: Array<{ nature: NatureEngagement; motif: RegExp }> = [
  { nature: 'geste', motif: /\b(offert|offerte|offerts|gratuit|gratuite|gracieu\w*|remise|réduction|rembours\w*|geste commercial|avoir)\b/iu },
  { nature: 'prix', motif: /\d[\d\s\u00a0\u202f]*(?:,\d+)?\s?(?:€|euros?\b)|\b\d+\s?%/iu },
  {
    nature: 'date',
    motif: /\b(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|demain|après-demain|d’ici|d'ici|avant le|sous \d+ (?:jours?|heures?)|\d{1,2}(?:er)? (?:janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre))\b/iu,
  },
];

export function engagementDe(ajout: string | undefined): NatureEngagement | null {
  if (!ajout) return null;
  return ENGAGEMENTS.find((e) => e.motif.test(ajout))?.nature ?? null;
}

/** Le numéro de ligne (de phrase) où tombe chaque correction. */
export function lignesDesCorrections(morceaux: MorceauBrouillon[]): number[] {
  let fins = 0;
  const r: number[] = [];
  for (const m of morceaux) {
    if (m.type === 'correction') r.push(fins + 1);
    const lu = m.type === 'texte' ? m.texte : m.decision === 'refusee' ? m.retire ?? '' : m.ajoute ?? '';
    fins += (lu.match(/[.!?](?=\s|$)/g) ?? []).length;
  }
  return r;
}

/** L'engagement en ambre : le premier qui n'a pas encore été accepté ou refusé. */
export function engagementEnAttente(morceaux: MorceauBrouillon[]): number | null {
  const i = morceaux.findIndex((m) => m.type === 'correction' && !m.decision && engagementDe(m.ajoute) !== null);
  return i >= 0 ? i : null;
}

/** Les corrections GARDÉES : toutes celles qui n'ont pas été refusées. */
export function correctionsGardees(morceaux: MorceauBrouillon[]) {
  const c = morceaux.filter((m): m is Extract<MorceauBrouillon, { type: 'correction' }> => m.type === 'correction');
  return { gardees: c.filter((m) => m.decision !== 'refusee').length, total: c.length };
}

export { JOUR_MS, borne };
