/**
 * LES EXPRESSIONS D'AJMANI — des chiffres, pas des dessins.
 * ═════════════════════════════════════════════════════════
 *
 * Chaque émotion est une POSE : l'ouverture de chaque œil (paupière du haut,
 * paupière du bas), la pente des paupières, la bouche, l'inclinaison de la
 * tête, la torsion de l'antenne, et la couleur du visage. Le composant ne
 * connaît que la pose ; il anime de l'une à l'autre.
 *
 * Pas de nez, pas de sourcils : ce sont les paupières et l'inclinaison qui
 * disent tout (fiche de style). Le visage est blanc chaud ; l'ambre est
 * réservé à l'alerte et à la décision, comme partout dans l'app.
 *
 * Module sans React : il s'éprouve hors application (`npm run check:ajmani`),
 * et la session des robots à métiers (S4) peut composer ses propres poses
 * avec les mêmes chiffres.
 */

export const EMOTIONS = [
  'neutre',
  'curieux',
  'content',
  'tres-content',
  'concentre',
  'surpris',
  'inquiet',
  'taquin',
  'fatigue',
  'alerte',
] as const;

export type Emotion = (typeof EMOTIONS)[number];

/** Un œil : la part fermée par la paupière du haut, puis par celle du bas (0 = ouvert, 0,5 + 0,5 = fermé). */
export interface Oeil {
  haut: number;
  bas: number;
}

export interface Bouche {
  /** Largeur du trait, en unités du dessin (le visage fait 112 de large). */
  largeur: number;
  /** Courbure : positif = sourire, négatif = moue. */
  courbe: number;
  /** 0 = un trait, 1 = grande ouverte. */
  ouverture: number;
  /** Bouche de travers : le coin droit monte quand c'est positif. */
  pente: number;
}

export interface Pose {
  oeilG: Oeil;
  oeilD: Oeil;
  /** Pente des paupières du haut, en unités : positif = coins intérieurs bas (décidé), négatif = intérieurs hauts (inquiet). */
  pente: number;
  /** Taille des yeux (1 = normale). */
  echelleYeux: number;
  /** Où regarde-t-il quand personne ne bouge : décalage vertical de repos. */
  regardY: number;
  bouche: Bouche;
  /** Inclinaison de la tête, en degrés. */
  tete: number;
  /** Torsion de l'antenne, en degrés (positif = elle tombe vers la droite). */
  antenne: number;
  /** L'écran grésille (rire, panique). */
  glitch: boolean;
  /** La lumière du visage. */
  lumiere: 'chaud' | 'ambre';
}

const o = (haut: number, bas: number): Oeil => ({ haut, bas });
const b = (largeur: number, courbe: number, ouverture = 0, pente = 0): Bouche => ({ largeur, courbe, ouverture, pente });

export const POSES: Record<Emotion, Pose> = {
  neutre: { oeilG: o(0.08, 0.08), oeilD: o(0.08, 0.08), pente: 0, echelleYeux: 1, regardY: 0, bouche: b(16, 2), tete: 0, antenne: 0, glitch: false, lumiere: 'chaud' },
  curieux: { oeilG: o(0, 0.04), oeilD: o(0.16, 0.06), pente: -2, echelleYeux: 1.08, regardY: -1, bouche: b(9, 0, 0.35), tete: -8, antenne: 14, glitch: false, lumiere: 'chaud' },
  content: { oeilG: o(0.04, 0.34), oeilD: o(0.04, 0.34), pente: 0, echelleYeux: 1, regardY: 0, bouche: b(22, 7), tete: 3, antenne: -4, glitch: false, lumiere: 'chaud' },
  'tres-content': { oeilG: o(0, 0.5), oeilD: o(0, 0.5), pente: 0, echelleYeux: 1.04, regardY: 0, bouche: b(26, 8, 0.85), tete: 0, antenne: -12, glitch: true, lumiere: 'chaud' },
  concentre: { oeilG: o(0.24, 0.16), oeilD: o(0.24, 0.16), pente: 2.5, echelleYeux: 0.96, regardY: 2, bouche: b(11, 0, 0, 1.5), tete: 0, antenne: 4, glitch: false, lumiere: 'chaud' },
  surpris: { oeilG: o(0, 0), oeilD: o(0, 0), pente: 0, echelleYeux: 1.2, regardY: -1, bouche: b(10, 0, 1), tete: -2, antenne: -20, glitch: true, lumiere: 'chaud' },
  inquiet: { oeilG: o(0.18, 0.04), oeilD: o(0.18, 0.04), pente: -9, echelleYeux: 1.02, regardY: 0, bouche: b(15, -4), tete: -4, antenne: 22, glitch: false, lumiere: 'chaud' },
  taquin: { oeilG: o(0.04, 0.1), oeilD: o(0.42, 0.3), pente: 2, echelleYeux: 1, regardY: 0, bouche: b(18, 5, 0, -3), tete: 6, antenne: 8, glitch: false, lumiere: 'chaud' },
  fatigue: { oeilG: o(0.48, 0.04), oeilD: o(0.5, 0.04), pente: -2, echelleYeux: 0.98, regardY: 2.5, bouche: b(11, -1), tete: 5, antenne: 36, glitch: false, lumiere: 'chaud' },
  alerte: { oeilG: o(0, 0.06), oeilD: o(0, 0.06), pente: 5, echelleYeux: 1.04, regardY: 0, bouche: b(18, -1), tete: 0, antenne: -6, glitch: false, lumiere: 'ambre' },
};

/** Les yeux fermés, pour le clignement : la même pose, paupières jointes. */
export function poseCligne(pose: Pose): Pose {
  return { ...pose, oeilG: o(0.5, 0.5), oeilD: o(0.5, 0.5) };
}

/** L'émotion qui convient à l'heure, quand rien d'autre ne la dicte : fatigué tard le soir. */
export function emotionDeLHeure(heure: number, sinon: Emotion = 'neutre'): Emotion {
  return heure >= 21 || heure < 6 ? 'fatigue' : sinon;
}

/* ── La géométrie du visage, partagée par le dessin et les contrôles ────── */

/** Le centre des yeux et leur taille, dans le repère du dessin (200 × 220). */
export const OEIL = { gaucheX: 80, droitX: 120, y: 88, largeur: 15, hauteur: 21 } as const;
export const BOUCHE_Y = 112;

/**
 * Le polygone de découpe d'un œil : ce que les paupières laissent voir.
 * `cote` vaut -1 pour l'œil gauche, +1 pour le droit (la pente s'inverse).
 */
export function decoupeOeil(cx: number, oeil: Oeil, pente: number, cote: -1 | 1, echelle = 1): string {
  const w = (OEIL.largeur / 2) * echelle + 2;
  const h = OEIL.hauteur * echelle;
  const top = OEIL.y - h / 2;
  const fermeHaut = Math.min(0.5, Math.max(0, oeil.haut)) * h;
  const fermeBas = Math.min(0.5, Math.max(0, oeil.bas)) * h;
  // Le coin intérieur est du côté du nez : à droite pour l'œil gauche.
  const interieur = cote === -1 ? cx + w : cx - w;
  const exterieur = cote === -1 ? cx - w : cx + w;
  const yHautExt = top + fermeHaut - pente / 2;
  const yHautInt = top + fermeHaut + pente / 2;
  const yBas = top + h - fermeBas;
  const g = cote === -1 ? [exterieur, yHautExt, interieur, yHautInt] : [interieur, yHautInt, exterieur, yHautExt];
  const r = (n: number) => Math.round(n * 100) / 100;
  // Un œil qui sourit : la paupière du bas se bombe vers le haut (« ^ »),
  // au lieu de couper l'œil à plat.
  const bombe = Math.max(0, oeil.bas - 0.2) * h * 1.4;
  const basG = Math.max(yBas, g[1]);
  const basD = Math.max(yBas, g[3]);
  // Même suite de commandes pour toutes les poses : framer-motion peut interpoler.
  return `M ${r(g[0])} ${r(g[1])} L ${r(g[2])} ${r(g[3])} L ${r(g[2])} ${r(basD)} Q ${r(cx)} ${r(Math.max(Math.min(g[1], g[3]), (basG + basD) / 2 - bombe))} ${r(g[0])} ${r(basG)} Z`;
}

/** Le tracé de la bouche : un trait courbe qui s'ouvre. Même suite de commandes pour toutes les poses. */
export function traceBouche(bouche: Bouche): string {
  const r = (n: number) => Math.round(n * 100) / 100;
  const x1 = 100 - bouche.largeur / 2;
  const x2 = 100 + bouche.largeur / 2;
  const y1 = BOUCHE_Y + bouche.pente / 2;
  const y2 = BOUCHE_Y - bouche.pente / 2;
  const haut = BOUCHE_Y + bouche.courbe;
  const bas = haut + Math.max(0, bouche.ouverture) * 11;
  return `M ${r(x1)} ${r(y1)} Q 100 ${r(haut)} ${r(x2)} ${r(y2)} Q 100 ${r(bas)} ${r(x1)} ${r(y1)} Z`;
}
