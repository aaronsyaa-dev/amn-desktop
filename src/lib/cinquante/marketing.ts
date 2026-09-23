/**
 * MARKETING — créer, diffuser, écouter (`35a` → `35i`).
 * ═════════════════════════════════════════════════════
 *
 * Neuf moteurs, un par module, sur le modèle du Guichet : chacun prend les
 * enregistrements réels de sa collection et rend la géométrie de son
 * instrument. Les règles de `MODULES-NOUVEAUX.md` (§ 7 à 15) y sont écrites
 * telles quelles ; `check:cinquante` les éprouve sur des données qui ne sont
 * pas celles des captures.
 */
import { type Id, jourLocal } from './guichet';

const JOUR_MS = 86_400_000;
const borne = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));

export function medianeNombres(valeurs: number[]): number {
  if (valeurs.length === 0) return 0;
  const v = [...valeurs].sort((a, b) => a - b);
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : Math.round((v[m - 1] + v[m]) / 2);
}

/* ══════════════════════════════════════════════════════════════════════════
   35a · MONTAGE VIDÉO — la bobine
   ══════════════════════════════════════════════════════════════════════════ */

/** « L'échelle de la pellicule est fixe (45 s) pour tous les montages. » */
export const ECHELLE_BOBINE_S = 45;
/** Les crans de la règle des formats : la durée maximale de chaque format visé. */
export const FORMATS_VIDEO = { story: { nom: 'Story', maxS: 15 }, reel: { nom: 'Reel', maxS: 30 } } as const;
export type FormatVideo = keyof typeof FORMATS_VIDEO;
/** La géométrie de la pellicule : 96 px, deux bandes de perforations de 14 px. */
export const PELLICULE = { hauteur: 96, perforations: 14 } as const;
/** Un plan ne se raccourcit jamais sous deux secondes : en dessous, il ne se lit plus. */
export const PLAN_MIN_S = 2;

export interface PlanVideo {
  nom: string;
  dureeS: number;
  /** Un plan « gardé » (l'avant, l'après…) n'est jamais proposé à la coupe. */
  garde?: boolean;
}
export interface MontageVideo {
  kind: 'montage';
  titre: string;
  format: FormatVideo;
  etat: 'a-monter' | 'en-cours' | 'publie';
  plans: PlanVideo[];
  creeLe: string;
  publieLe?: string;
  vues?: number;
}
export type EnregistrementVideo = MontageVideo;

export const dureeMontage = (m: Pick<MontageVideo, 'plans'>) => m.plans.reduce((s, p) => s + p.dureeS, 0);

export interface Bobine {
  plans: Array<PlanVideo & { gauchePct: number; largeurPct: number }>;
  totalS: number;
  cranPct: number;
  /** Secondes au-delà du format visé (0 si le film tient). */
  depasseS: number;
  /** La zone ambre : du cran exactement à la fin du film exactement. */
  zone: { gauchePct: number; largeurPct: number } | null;
  /** La fin du film au-delà de l'échelle : la pellicule s'arrête au bord, et le dit. */
  horsEchelle: boolean;
}

export function bobine(m: Pick<MontageVideo, 'plans' | 'format'>): Bobine {
  const pct = (s: number) => (Math.min(s, ECHELLE_BOBINE_S) / ECHELLE_BOBINE_S) * 100;
  let t = 0;
  const plans = m.plans.map((p) => {
    const gauchePct = pct(t);
    t += p.dureeS;
    return { ...p, gauchePct, largeurPct: pct(t) - gauchePct };
  });
  const cran = FORMATS_VIDEO[m.format].maxS;
  const depasseS = Math.max(0, t - cran);
  return {
    plans,
    totalS: t,
    cranPct: pct(cran),
    depasseS,
    zone: depasseS > 0 ? { gauchePct: pct(cran), largeurPct: pct(t) - pct(cran) } : null,
    horsEchelle: t > ECHELLE_BOBINE_S,
  };
}

/**
 * LA COUPE SUGGÉRÉE — « ramener le film à la durée du format, à la seconde
 * près ». Les plans gardés ne sont jamais touchés ; aucun plan ne descend sous
 * `PLAN_MIN_S`. On coupe dans le MOINS de plans possible, pris par marge
 * décroissante (à égalité, le plus tardif) ; les plus petites marges sont
 * prises entières, la plus grande prend le reste. Pour « Vitres d'hiver »
 * (8 s de trop) : le logo va à 2 s, « Le geste » à 5 s.
 */
export function coupeSuggeree(m: Pick<MontageVideo, 'plans' | 'format'>): Array<{ index: number; deS: number; versS: number }> | null {
  const trop = dureeMontage(m) - FORMATS_VIDEO[m.format].maxS;
  if (trop <= 0) return null;
  const candidats = m.plans
    .map((p, index) => ({ index, marge: p.garde ? 0 : Math.max(0, p.dureeS - PLAN_MIN_S) }))
    .filter((c) => c.marge > 0)
    .sort((a, b) => b.marge - a.marge || b.index - a.index);
  const choisis: typeof candidats = [];
  let cumul = 0;
  for (const c of candidats) {
    if (cumul >= trop) break;
    choisis.push(c);
    cumul += c.marge;
  }
  if (cumul < trop) return null; // impossible sans toucher aux plans gardés
  const [plusGrand, ...autres] = choisis;
  let reste = trop;
  const coupes = new Map<number, number>();
  for (const c of autres) {
    coupes.set(c.index, c.marge);
    reste -= c.marge;
  }
  coupes.set(plusGrand.index, reste);
  return [...coupes.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([index, retire]) => ({ index, deS: m.plans[index].dureeS, versS: m.plans[index].dureeS - retire }));
}

export function statsVideos(montages: MontageVideo[], maintenant: Date) {
  const annee = maintenant.getFullYear();
  const publies = montages.filter((m) => m.etat === 'publie' && m.publieLe && new Date(m.publieLe).getFullYear() === annee);
  return {
    publiees: publies.length,
    dureeMoyenneS: publies.length ? Math.round(publies.reduce((s, m) => s + dureeMontage(m), 0) / publies.length) : 0,
    vuesMedianes: medianeNombres(publies.map((m) => m.vues ?? 0)),
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   35b · VISUELS PUB — l'imposition
   ══════════════════════════════════════════════════════════════════════════ */

/** « 1 px pour 6,4 px de pixel final » — commune à tous les formats. */
export const ECHELLE_IMPOSITION = 6.4;

/** Un rectangle en pixels FINAUX. */
export interface Rect {
  x: number;
  y: number;
  l: number;
  h: number;
}
/** La zone sûre, en fraction de chaque bord (la story garde 14 % en haut, 20 % en bas). */
export interface ZoneSure {
  haut: number;
  bas: number;
  gauche: number;
  droite: number;
}
/** Les zones sûres des plateformes, d'après leurs spécifications. */
export const ZONES_SURES: Record<string, ZoneSure> = {
  story: { haut: 0.14, bas: 0.2, gauche: 0.06, droite: 0.06 },
  feed: { haut: 0.053, bas: 0.053, gauche: 0.053, droite: 0.053 },
  carre: { haut: 0.053, bas: 0.053, gauche: 0.053, droite: 0.053 },
  banniere: { haut: 0.1, bas: 0.1, gauche: 0.0533, droite: 0.0533 },
};

export interface FormatVisuel {
  cle: keyof typeof ZONES_SURES;
  nom: string;
  largeurPx: number;
  hauteurPx: number;
  titre: Rect;
  produit: Rect;
}
export interface CampagneVisuels {
  kind: 'campagne';
  nom: string;
  titre: string;
  formats: FormatVisuel[];
  creeLe: string;
  /** Visuels produits pour cette campagne (un visuel = ses quatre formats). */
  visuels: number;
}
export type EnregistrementVisuels = CampagneVisuels;

export function rectZoneSure(f: Pick<FormatVisuel, 'cle' | 'largeurPx' | 'hauteurPx'>): Rect {
  const z = ZONES_SURES[f.cle];
  const x = f.largeurPx * z.gauche;
  const y = f.hauteurPx * z.haut;
  return { x, y, l: f.largeurPx * (1 - z.gauche - z.droite), h: f.hauteurPx * (1 - z.haut - z.bas) };
}

/**
 * « Le verdict “hors zone” se calcule par intersection de rectangles, pas à
 * l'œil. » Le titre est dans la zone si son rectangle est CONTENU dans celui de
 * la zone sûre ; sinon on rend le débord de chaque côté, en pixels finaux.
 */
export function horsZone(f: FormatVisuel) {
  const z = rectZoneSure(f);
  const t = f.titre;
  const d = {
    gauche: Math.max(0, z.x - t.x),
    haut: Math.max(0, z.y - t.y),
    droite: Math.max(0, t.x + t.l - (z.x + z.l)),
    bas: Math.max(0, t.y + t.h - (z.y + z.h)),
  };
  const pire = (Object.entries(d) as Array<[keyof typeof d, number]>).sort((a, b) => b[1] - a[1])[0];
  return { dehors: pire[1] > 0.5, cote: pire[0], px: Math.round(pire[1]), debords: d };
}

/** Un format à l'échelle de la planche : jamais redimensionné pour remplir sa colonne. */
export const aLEchelle = (px: number) => px / ECHELLE_IMPOSITION;

/** Recomposer : le titre est ramené dans la zone sûre, sans changer de taille si possible. */
export function recomposer(f: FormatVisuel): FormatVisuel {
  const z = rectZoneSure(f);
  const l = Math.min(f.titre.l, z.l);
  const h = Math.min(f.titre.h, z.h);
  const x = borne(f.titre.x, z.x, z.x + z.l - l);
  const y = borne(f.titre.y, z.y, z.y + z.h - h);
  return { ...f, titre: { x, y, l, h } };
}

/* ══════════════════════════════════════════════════════════════════════════
   35c · PLANIFICATEUR — l'horloge d'audience
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Le cadran : couronne de 24 secteurs, rayon intérieur 56, extérieur de 56 à
 * 100 selon l'audience, « sur une échelle commune aux trois cadrans (21 % =
 * 44 px) ». Au-delà de 12 %, un secteur est plus clair. `viewBox` -130 → 130.
 */
export const CADRAN = {
  viewBox: '-130 -130 260 260',
  rayonInterieur: 56,
  rayonMax: 100,
  pourcentEchelle: 21,
  pxEchelle: 44,
  seuilClair: 12,
  aiguille: 108,
  /** L'arc d'un secteur ne couvre pas tout son quart d'heure : un filet de 0,75° les sépare. */
  ouvertureDeg: 14.25,
} as const;

export interface ReseauPlanif {
  kind: 'reseau';
  nom: string;
  /** Part des abonnés en ligne à chaque heure (24 valeurs, en %), mesurée sur 28 jours. */
  audience: number[];
  ordre: number;
}
export interface PostPlanif {
  kind: 'post';
  reseau: string;
  le: string;
  sujet: string;
  publieLe?: string;
  portee?: number;
}
export type EnregistrementPlanif = ReseauPlanif | PostPlanif;

export const rayonSecteur = (part: number) =>
  Math.min(CADRAN.rayonMax, CADRAN.rayonInterieur + (Math.max(0, part) * CADRAN.pxEchelle) / CADRAN.pourcentEchelle);

/** « La position d'une aiguille est (heure + minutes / 60) × 15°. » Minuit en haut. */
export const angleAiguille = (d: Date) => (d.getHours() + d.getMinutes() / 60) * 15;

export function pointPolaire(rayon: number, angleDeg: number) {
  const a = (angleDeg * Math.PI) / 180;
  return { x: rayon * Math.sin(a), y: -rayon * Math.cos(a) };
}

export function cheminSecteur(heure: number, part: number): string {
  const r0 = CADRAN.rayonInterieur;
  const r1 = rayonSecteur(part);
  const a0 = heure * 15;
  const a1 = a0 + CADRAN.ouvertureDeg;
  const p0 = pointPolaire(r0, a0);
  const p1 = pointPolaire(r1, a0);
  const p2 = pointPolaire(r1, a1);
  const p3 = pointPolaire(r0, a1);
  const f = (n: number) => n.toFixed(1);
  return `M${f(p0.x)} ${f(p0.y)}L${f(p1.x)} ${f(p1.y)}A${r1} ${r1} 0 0 1 ${f(p2.x)} ${f(p2.y)}L${f(p3.x)} ${f(p3.y)}A${r0} ${r0} 0 0 0 ${f(p0.x)} ${f(p0.y)}Z`;
}

export const picAudience = (audience: number[]) => audience.reduce((best, v, h) => (v > audience[best] ? h : best), 0);
export const creuxAudience = (audience: number[]) => audience.reduce((best, v, h) => (v < audience[best] ? h : best), 0);

/**
 * L'AIGUILLE DANS LE CREUX — le post à venir qui tombe là où la couronne est
 * la plus fine, pourvu qu'il tombe dans un secteur sombre (sous 12 %). Un
 * post qui tombe dans un secteur clair n'est pas dans le vide.
 */
export function aiguilleDansLeCreux(reseaux: ReseauPlanif[], posts: Id<PostPlanif>[], maintenant: Date) {
  let pire: { post: Id<PostPlanif>; part: number; reseau: ReseauPlanif } | null = null;
  for (const p of posts) {
    if (p.publieLe || new Date(p.le) < maintenant) continue;
    const r = reseaux.find((x) => x.nom === p.reseau);
    if (!r) continue;
    const part = r.audience[new Date(p.le).getHours()] ?? 0;
    if (part >= CADRAN.seuilClair) continue;
    if (!pire || part < pire.part) pire = { post: p, part, reseau: r };
  }
  return pire;
}

/** Les posts d'une semaine (lundi → dimanche) qui contient `jour`. */
export function semaineDe(jour: Date) {
  const d = new Date(jour.getFullYear(), jour.getMonth(), jour.getDate());
  const lundi = new Date(d.getTime() - ((d.getDay() + 6) % 7) * JOUR_MS);
  return { debut: lundi, fin: new Date(lundi.getTime() + 7 * JOUR_MS) };
}

/* ══════════════════════════════════════════════════════════════════════════
   35d · PODCAST — l'onde et ses coupes
   ══════════════════════════════════════════════════════════════════════════ */

/** « 240 barres sur 120 px de haut, centrées sur l'axe. » */
export const ONDE = { barres: 240, hauteur: 120, silenceS: 2 } as const;

export interface Hesitation {
  s: number;
  dureeS: number;
  genre: 'euh' | 'reprise' | 'faux-depart';
}
export interface EpisodePodcast {
  kind: 'episode';
  numero: number;
  titre: string;
  dureeS: number;
  /** Amplitude brute par seconde (ou par tranche régulière) — l'onde est recalculée ici. */
  amplitudes: number[];
  chapitres: Array<{ titre: string; debutS: number }>;
  hesitations: Hesitation[];
  coupe: { debutS: number; finS: number; motif: string } | null;
  coupesValideesLe?: string;
  publieLe?: string;
  ecoutes?: number;
}
export interface ReglagePodcast {
  kind: 'podcast';
  abonnes: number;
  ecouteMoyenneS: number;
  jusquAuBoutPct: number;
}
export type EnregistrementPodcast = EpisodePodcast | ReglagePodcast;

/**
 * « La hauteur d'une barre est l'amplitude moyenne de sa tranche de 6 s,
 * normalisée sur l'épisode. » La tranche vaut durée / 240 (6,04 s pour
 * 24 min 10) ; la plus forte barre touche 100 %.
 */
export function onde(ep: Pick<EpisodePodcast, 'amplitudes' | 'dureeS'>): number[] {
  const n = ep.amplitudes.length;
  if (n === 0) return [];
  const brut: number[] = [];
  for (let i = 0; i < ONDE.barres; i += 1) {
    const a = Math.floor((i * n) / ONDE.barres);
    const b = Math.max(a + 1, Math.floor(((i + 1) * n) / ONDE.barres));
    let s = 0;
    for (let j = a; j < b; j += 1) s += ep.amplitudes[j] ?? 0;
    brut.push(s / (b - a));
  }
  const max = Math.max(...brut, 1e-9);
  return brut.map((v) => (v / max) * 100);
}

/** Toutes les positions sont des secondes rapportées à la durée totale. */
export const pctSeconde = (s: number, dureeS: number) => (dureeS > 0 ? borne((s / dureeS) * 100, 0, 100) : 0);

export function economiePodcast(ep: Pick<EpisodePodcast, 'coupe' | 'hesitations'>) {
  const coupe = ep.coupe ? ep.coupe.finS - ep.coupe.debutS : 0;
  const hesit = ep.hesitations.reduce((s, h) => s + h.dureeS, 0);
  return { coupeS: coupe, hesitationsS: Math.round(hesit), totalS: Math.round(coupe + hesit) };
}

/* ══════════════════════════════════════════════════════════════════════════
   35e · IDENTITÉ VISUELLE — l'échelle de lisibilité
   ══════════════════════════════════════════════════════════════════════════ */

/** « Aucun élément du logo ne doit descendre sous 6 px de corps. » */
export const CORPS_MIN_PX = 6;

export interface LogoKit {
  kind: 'logo';
  monogramme: string;
  mention: string;
  /** Corps du monogramme et de la mention, en fraction du côté du logo. */
  ratioMonogramme: number;
  ratioMention: number;
  couleurs: string[];
  polices: string[];
  declinaisons: string[];
}
export interface UsageLogo {
  kind: 'usage';
  nom: string;
  /** Taille réelle d'usage, en pixels CSS (l'enseigne : 220 px pour 3 m réels). */
  taillePx: number;
  reel: string;
  /** L'usage avec son article, pour la phrase (« l’enseigne », « le favicon »). */
  avecArticle?: string;
  declinaison: 'complete' | 'reduite';
  ordre: number;
}
export type EnregistrementIdentite = LogoKit | UsageLogo;

export function lisibilite(logo: Pick<LogoKit, 'ratioMonogramme' | 'ratioMention'>, u: Pick<UsageLogo, 'taillePx' | 'declinaison'>) {
  const corpsMonogramme = u.taillePx * logo.ratioMonogramme;
  const corpsMention = u.declinaison === 'complete' ? u.taillePx * logo.ratioMention : null;
  return {
    corpsMonogramme,
    corpsMention,
    mentionIllisible: corpsMention !== null && corpsMention < CORPS_MIN_PX,
    monogrammeIllisible: corpsMonogramme < CORPS_MIN_PX,
  };
}

/** La version réduite est proposée sous la taille où la mention passe sous 6 px. */
export const seuilVersionReduite = (logo: Pick<LogoKit, 'ratioMention'>) => CORPS_MIN_PX / logo.ratioMention;
/** La plus petite taille où le monogramme seul reste lisible. */
export const monogrammeLisibleJusqua = (logo: Pick<LogoKit, 'ratioMonogramme'>) => CORPS_MIN_PX / logo.ratioMonogramme;

/** L'usage ambre : parmi ceux dont un élément tombe sous 6 px, le plus petit. */
export function usageIllisible(logo: LogoKit, usages: Id<UsageLogo>[]) {
  return (
    usages
      .filter((u) => {
        const l = lisibilite(logo, u);
        return l.mentionIllisible || l.monogrammeIllisible;
      })
      .sort((a, b) => a.taillePx - b.taillePx)[0] ?? null
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   35f · IMAGES PRODUITS — la tournette
   ══════════════════════════════════════════════════════════════════════════ */

/** « Positions en couronne : 50 % + 38 % · cos θ en largeur, 200 + 148 · sin θ en hauteur, dans un conteneur de 400 px. » */
export const TOURNETTE = { hauteur: 400, centreY: 200, rayonXPct: 38, rayonY: 148, vignetteL: 118, vignetteH: 86 } as const;
export const ZONES_FIXES = ['etiquette', 'forme', 'bouchon'] as const;
export type ZoneFixe = (typeof ZONES_FIXES)[number];

export interface ProduitReference {
  kind: 'produit';
  nom: string;
  reference: Record<ZoneFixe, string>;
  ordre: number;
}
export interface SceneProduit {
  kind: 'scene';
  produitId: string;
  numero: number;
  decor: string;
  /** Ce que l'image générée montre sur chaque zone fixe. */
  zones: Record<ZoneFixe, string>;
  verdict: 'gardee' | 'a-revoir' | 'ecartee' | 'a-trier';
  motif?: string;
  genereeLe: string;
  publieeLe?: string;
  regenerationDemandeeLe?: string;
}
export type EnregistrementImages = ProduitReference | SceneProduit;

export function positionScene(i: number, n = 8) {
  const theta = -Math.PI / 2 + (i * 2 * Math.PI) / n;
  return {
    xPct: 50 + TOURNETTE.rayonXPct * Math.cos(theta),
    y: TOURNETTE.centreY + TOURNETTE.rayonY * Math.sin(theta),
    /** Le même point dans le `viewBox` 1000 × 400 des rayons. */
    xVb: 500 + TOURNETTE.rayonXPct * 10 * Math.cos(theta),
  };
}

/**
 * « Un écart sur une zone fixe classe l'image “altérée”, quelle que soit sa
 * qualité. » La comparaison ignore la casse et les espaces, rien d'autre.
 */
export function alteration(produit: ProduitReference, scene: SceneProduit): { zone: ZoneFixe; avant: string; apres: string } | null {
  const n = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
  for (const z of ZONES_FIXES) {
    if (n(scene.zones[z] ?? '') !== n(produit.reference[z] ?? '')) {
      return { zone: z, avant: produit.reference[z], apres: scene.zones[z] };
    }
  }
  return null;
}

/* ══════════════════════════════════════════════════════════════════════════
   35g · SENTIMENT — la phrase-mère
   ══════════════════════════════════════════════════════════════════════════ */

export type SourceTexte = 'nps' | 'chatbot' | 'message' | 'avis';
export interface TexteClient {
  kind: 'texte';
  source: SourceTexte;
  texte: string;
  le: string;
  phraseId: string | null;
}
export interface PhraseMere {
  kind: 'phrase';
  phrase: string;
  polarite: 'positive' | 'negative' | 'neutre';
}
export type EnregistrementSentiment = TexteClient | PhraseMere;

export const FENETRE_SENTIMENT_J = 90;

const mots = (s: string) =>
  s
    .toLowerCase()
    .replace(/[’']/g, ' ')
    .split(/[^a-zà-öø-ÿœæ0-9-]+/i)
    .filter((m) => m.length > 0);

/**
 * « La phrase-mère est une synthèse MOT POUR MOT : elle n'emploie que des
 * tournures présentes dans ses variantes. » Rend les mots de la phrase qu'on
 * ne retrouve dans aucune variante — une liste vide, et la phrase est tenue.
 */
export function motsAbsents(phrase: string, variantes: string[]): string[] {
  const vus = new Set(variantes.flatMap(mots));
  return [...new Set(mots(phrase).filter((m) => !vus.has(m)))];
}

export interface GroupeSentiment {
  phrase: Id<PhraseMere>;
  /** La phrase affichée : la phrase-mère si elle est tenue, sinon sa variante la plus récente, mot pour mot. */
  affichee: string;
  tenue: boolean;
  variantes: Id<TexteClient>[];
}

export function phrasesMeres(enr: Id<EnregistrementSentiment>[], maintenant: Date) {
  const depuis = maintenant.getTime() - FENETRE_SENTIMENT_J * JOUR_MS;
  const textes = enr.filter((e): e is Id<TexteClient> => e.kind === 'texte' && new Date(e.le).getTime() >= depuis);
  const phrases = enr.filter((e): e is Id<PhraseMere> => e.kind === 'phrase');
  const groupes: GroupeSentiment[] = phrases
    .map((p) => {
      const variantes = textes.filter((t) => t.phraseId === p.id).sort((a, b) => b.le.localeCompare(a.le));
      const tenue = variantes.length > 0 && motsAbsents(p.phrase, variantes.map((v) => v.texte)).length === 0;
      return { phrase: p, variantes, tenue, affichee: tenue ? p.phrase : variantes[0]?.texte ?? p.phrase };
    })
    .filter((g) => g.variantes.length > 0)
    .sort((a, b) => b.variantes.length - a.variantes.length);
  /** « L'ambre va à la phrase-mère la plus fréquente parmi les négatives ; sans phrase négative, l'écran n'a pas d'ambre. » */
  const ambre = groupes.find((g) => g.phrase.polarite === 'negative') ?? null;
  const dominante = ambre ?? groupes[0] ?? null;
  const parSource = (['nps', 'chatbot', 'message', 'avis'] as const)
    .map((s) => ({ source: s, n: textes.filter((t) => t.source === s).length }))
    .sort((a, b) => b.n - a.n);
  const polarites = {
    positive: groupes.filter((g) => g.phrase.polarite === 'positive').length,
    negative: groupes.filter((g) => g.phrase.polarite === 'negative').length,
    neutre: groupes.filter((g) => g.phrase.polarite === 'neutre').length,
  };
  return { textes, groupes, dominante, ambre, autres: groupes.filter((g) => g !== dominante), parSource, polarites };
}

/* ══════════════════════════════════════════════════════════════════════════
   35h · VEILLE — le relevé des prix
   ══════════════════════════════════════════════════════════════════════════ */

export interface Concurrent {
  kind: 'concurrent';
  nom: string;
  initiale: string;
}
export interface PrestationVeille {
  kind: 'prestation';
  nom: string;
  votrePrixCents: number;
  /** Les bornes du marché relevé pour cette prestation (sa propre règle). */
  marcheBasCents?: number;
  marcheHautCents?: number;
  ordre: number;
}
export interface ReleveVeille {
  kind: 'releve';
  concurrentId: string;
  prestationId: string;
  prixCents: number;
  le: string;
}
export type EnregistrementVeille = Concurrent | PrestationVeille | ReleveVeille;

export interface LigneVeille {
  prestation: Id<PrestationVeille>;
  basCents: number;
  hautCents: number;
  vousPct: number;
  jetons: Array<{
    concurrent: Id<Concurrent>;
    prixCents: number;
    pct: number;
    avant: { prixCents: number; pct: number; le: string } | null;
    le: string;
  }>;
}

export function releveDesPrix(enr: Id<EnregistrementVeille>[]) {
  const concurrents = enr.filter((e): e is Id<Concurrent> => e.kind === 'concurrent');
  const prestations = enr.filter((e): e is Id<PrestationVeille> => e.kind === 'prestation').sort((a, b) => a.ordre - b.ordre);
  const releves = enr.filter((e): e is Id<ReleveVeille> => e.kind === 'releve');
  const lignes: LigneVeille[] = prestations.map((p) => {
    const rel = releves.filter((r) => r.prestationId === p.id);
    const tous = [p.votrePrixCents, ...rel.map((r) => r.prixCents)];
    /* Sans bornes relevées, la règle s'étend de 10 % de part et d'autre, à la dizaine d'euros. */
    const bas = p.marcheBasCents ?? Math.floor((Math.min(...tous) * 0.9) / 1000) * 1000;
    const haut = p.marcheHautCents ?? Math.ceil((Math.max(...tous) * 1.1) / 1000) * 1000;
    const pct = (c: number) => (haut > bas ? borne(((c - bas) / (haut - bas)) * 100, 0, 100) : 50);
    const jetons = concurrents.flatMap((c) => {
      const siens = rel.filter((r) => r.concurrentId === c.id).sort((a, b) => b.le.localeCompare(a.le));
      if (siens.length === 0) return []; // « Un prix non relevé n'a pas de jeton — il n'est jamais estimé. »
      const [dernier, precedent] = siens;
      const bouge = precedent && precedent.prixCents !== dernier.prixCents;
      return [{
        concurrent: c,
        prixCents: dernier.prixCents,
        pct: pct(dernier.prixCents),
        le: dernier.le,
        avant: bouge ? { prixCents: precedent.prixCents, pct: pct(precedent.prixCents), le: precedent.le } : null,
      }];
    });
    return { prestation: p, basCents: bas, hautCents: haut, vousPct: pct(p.votrePrixCents), jetons };
  });
  return { concurrents, prestations, releves, lignes };
}

/** Les mouvements des trente derniers jours, du plus récent au plus ancien. */
export function mouvements(lignes: LigneVeille[], maintenant: Date, jours = 30) {
  const depuis = maintenant.getTime() - jours * JOUR_MS;
  return lignes
    .flatMap((l) => l.jetons.filter((j) => j.avant && new Date(j.le).getTime() >= depuis).map((j) => ({ ligne: l, jeton: j })))
    .sort((a, b) => b.jeton.le.localeCompare(a.jeton.le));
}

/**
 * L'ambre : « le mouvement de la semaine qui passe sous votre prix » — une
 * BAISSE relevée cette semaine qui finit sous votre prix. L'exemple du cahier
 * (ProClean, canapé, 135 → 120 € sous vos 144 €) partait déjà d'en dessous :
 * c'est le mouvement vers le bas qui compte, pas le franchissement.
 */
export function passeSousVous(lignes: LigneVeille[], maintenant: Date) {
  return (
    mouvements(lignes, maintenant, 7).find(
      ({ ligne, jeton }) => jeton.avant && jeton.prixCents < jeton.avant.prixCents && jeton.prixCents < ligne.prestation.votrePrixCents,
    ) ?? null
  );
}

/** Votre position moyenne : la part des prix relevés sous les vôtres. */
export function positionMoyenne(lignes: LigneVeille[]): 'en dessous' | 'au milieu' | 'au-dessus' | null {
  const parts = lignes
    .filter((l) => l.jetons.length > 0)
    .map((l) => l.jetons.filter((j) => j.prixCents < l.prestation.votrePrixCents).length / l.jetons.length);
  if (parts.length === 0) return null;
  const m = parts.reduce((s, x) => s + x, 0) / parts.length;
  return m < 1 / 3 ? 'en dessous' : m > 2 / 3 ? 'au-dessus' : 'au milieu';
}

/* ══════════════════════════════════════════════════════════════════════════
   35i · NPS — la corde
   ══════════════════════════════════════════════════════════════════════════ */

export const FENETRE_NPS_J = 90;
export interface ReponseNps {
  kind: 'reponse';
  note: number;
  le: string;
  client: string;
  motif?: string;
}
export interface EnvoiNps {
  kind: 'envoi';
  le: string;
}
export interface ReglageNps {
  kind: 'reglage';
  delaiEnvoiH: number;
}
export type EnregistrementNps = ReponseNps | EnvoiNps | ReglageNps;

export const groupeNps = (note: number): 'detracteur' | 'passif' | 'promoteur' =>
  note <= 6 ? 'detracteur' : note <= 8 ? 'passif' : 'promoteur';

export function scoreNps(reponses: Array<Pick<ReponseNps, 'note'>>) {
  const d = reponses.filter((r) => groupeNps(r.note) === 'detracteur').length;
  const p = reponses.filter((r) => groupeNps(r.note) === 'promoteur').length;
  const n = reponses.length;
  /** « Le score s'arrondit à l'unité. » */
  return { score: n ? Math.round(((p - d) / n) * 100) : 0, detracteurs: d, passifs: n - d - p, promoteurs: p, n };
}

/** « Position du nœud : 50 % + score / 2. » */
export const positionNoeud = (score: number) => 50 + borne(score, -100, 100) / 2;

/** Le trimestre CIVIL précédent : T2 = avril → juin. */
export function trimestrePrecedent(maintenant: Date) {
  const t = Math.floor(maintenant.getMonth() / 3); // 0 → T1
  const annee = t === 0 ? maintenant.getFullYear() - 1 : maintenant.getFullYear();
  const tp = (t + 3) % 4;
  return { numero: tp + 1, debut: new Date(annee, tp * 3, 1), fin: new Date(annee, tp * 3 + 3, 1) };
}

export function corde(enr: EnregistrementNps[], maintenant: Date) {
  const depuis = maintenant.getTime() - FENETRE_NPS_J * JOUR_MS;
  const reponses = enr.filter((e): e is ReponseNps => e.kind === 'reponse');
  const fenetre = reponses.filter((r) => new Date(r.le).getTime() >= depuis && new Date(r.le) <= maintenant);
  const envois = enr.filter((e): e is EnvoiNps => e.kind === 'envoi' && new Date(e.le).getTime() >= depuis).length;
  const s = scoreNps(fenetre);
  const tp = trimestrePrecedent(maintenant);
  const avant = reponses.filter((r) => new Date(r.le) >= tp.debut && new Date(r.le) < tp.fin);
  const sAvant = avant.length ? scoreNps(avant) : null;
  const motifs = new Map<string, { motif: string; groupe: ReturnType<typeof groupeNps>; n: number }>();
  for (const r of fenetre) {
    if (!r.motif) continue;
    const g = groupeNps(r.note);
    const cle = `${g}|${r.motif}`;
    const m = motifs.get(cle) ?? { motif: r.motif, groupe: g, n: 0 };
    m.n += 1;
    motifs.set(cle, m);
  }
  return {
    ...s,
    noeudPct: positionNoeud(s.score),
    precedent: sAvant ? { trimestre: tp.numero, score: sAvant.score, pct: positionNoeud(sAvant.score) } : null,
    tauxReponsePct: envois > 0 ? Math.round((fenetre.length / envois) * 100) : null,
    motifs: [...motifs.values()].sort((a, b) => b.n - a.n),
    detracteursListe: fenetre.filter((r) => groupeNps(r.note) === 'detracteur'),
  };
}

export { jourLocal };
