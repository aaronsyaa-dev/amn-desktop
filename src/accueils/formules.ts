/**
 * LES FORMULES DES ACCUEILS — pures, sans React ni données, éprouvées par
 * `check:cinquante` (bloc « Accueils »). ACCUEILS.md les écrit ; elles sont
 * ici littéralement.
 */

/* ═══ C6 · le cadran (`40f`) ═══════════════════════════════════════════ */

export const CADRAN = { r: 150, c: 180, marge: 40, epaisseur: 22, debutH: 8, finH: 20 } as const;
export const CIRCONFERENCE = 2 * Math.PI * CADRAN.r;
/** Un douzième du cercle : une heure. */
export const PAR_HEURE = CIRCONFERENCE / 12;

/** « longueur = durée × (2πr / 12), décalage = −(début − 8) × (2πr / 12) » — début et durée en heures. */
export function arcCadran(debutH: number, dureeH: number): { longueur: number; decalage: number } {
  return { longueur: dureeH * PAR_HEURE, decalage: -(debutH - CADRAN.debutH) * PAR_HEURE };
}

/** « Un rendez-vous hors de 08 h–20 h n'apparaît pas sur le cadran. » Il doit y tenir tout entier. */
export function surLeCadran(debutH: number, dureeH: number): boolean {
  return debutH >= CADRAN.debutH && debutH + dureeH <= CADRAN.finH;
}

/** Le point du cadran à l'heure `h` (08 h en haut, sens horaire), à la distance `r` du moyeu. */
export function pointCadran(h: number, r: number): [number, number] {
  const a = ((h - CADRAN.debutH) / 12) * 2 * Math.PI;
  return [CADRAN.c + Math.sin(a) * r, CADRAN.c - Math.cos(a) * r];
}

/* ═══ C8 · les écarts (`40h`) ══════════════════════════════════════════ */

/** « L'habitude est la médiane des vingt derniers jours ouvrés de même jour de semaine. » */
export const HABITUDE_JOURS = 20;
/** « Un indicateur ne s'affiche qu'au-delà de ± 5 %. » */
export const SEUIL_ECART = 0.05;

export function mediane(valeurs: number[]): number | null {
  if (!valeurs.length) return null;
  const v = [...valeurs].sort((a, b) => a - b);
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

/**
 * Les vingt derniers jours ouvrés du même jour de semaine que `jour`, du plus
 * récent au plus ancien, sans remonter avant `depuis` (le premier jour où
 * l'espace a une donnée : un jour d'avant l'ouverture n'est pas « habituel »).
 */
export function joursDeReference(jour: Date, depuis: Date | null): Date[] {
  const r: Date[] = [];
  const d = new Date(jour);
  d.setHours(0, 0, 0, 0);
  const borne = depuis ? new Date(depuis.getFullYear(), depuis.getMonth(), depuis.getDate()).getTime() : -Infinity;
  for (let i = 0; i < HABITUDE_JOURS; i++) {
    d.setDate(d.getDate() - 7);
    if (d.getTime() < borne) break;
    r.push(new Date(d));
  }
  return r;
}

/** L'écart relatif à l'habitude ; une habitude nulle et une valeur positive donnent +∞. */
export function ecartRelatif(valeur: number, habitude: number): number {
  if (habitude === 0) return valeur === 0 ? 0 : Infinity;
  return (valeur - habitude) / habitude;
}

export const hors = (ecart: number) => Math.abs(ecart) > SEUIL_ECART;

/**
 * « La barre vaut min(|écart|, 100 %) / 2 de la largeur de piste ; au-delà de
 * 100 %, la flèche remplace la longueur. » Côté : gauche en dessous, droite
 * au-dessus. `largeur` est une fraction de la piste (0 → 0,5).
 */
export function barreEcart(ecart: number): { cote: 'gauche' | 'droite'; largeur: number; fleche: boolean } {
  return { cote: ecart < 0 ? 'gauche' : 'droite', largeur: Math.min(Math.abs(ecart), 1) / 2, fleche: Math.abs(ecart) > 1 };
}

/** L'ambre : l'écart le plus grand (en valeur absolue), parmi ceux qui s'affichent. */
export function plusGrandEcart<T extends { ecart: number }>(lignes: T[]): T | null {
  let m: T | null = null;
  for (const l of lignes) if (hors(l.ecart) && (!m || Math.abs(l.ecart) > Math.abs(m.ecart))) m = l;
  return m;
}
