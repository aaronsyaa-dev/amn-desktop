/**
 * LA CARTE DE SITUATION — la géométrie, pure et déterministe (S3).
 *
 * Une carte stylisée, pas une carte du monde : aucune tuile, aucune requête.
 * Le Capitaine au centre ; autour, un anneau découpé en autant de quartiers
 * que d'équipes, chaque garde un point sur l'arc de son équipe ; au-delà, les
 * sites, posés en spirale d'or (même principe que l'ancien mur : un site a sa
 * place, la même à chaque ouverture, rangé par nom).
 *
 * L'ellipse (`ETIREMENT`) occupe un écran large sans déformer les distances
 * au point de mentir : elle n'étire que l'horizontale.
 */
export const LARGEUR = 1200;
export const HAUTEUR = 800;
export const CX = LARGEUR / 2;
export const CY = HAUTEUR / 2;
export const ETIREMENT = 1.42;

export const R_CAPITAINE = 30;
export const R_AGENTS = 128;
export const R_QUARTIER_INT = 92;
export const R_QUARTIER_EXT = 162;
export const R_ETIQUETTE = 188;
export const R_SITES_MIN = 236;
export const R_SITES_MAX = 372;

const NOMBRE_D_OR = 137.50776405003785;

export interface Point {
  x: number;
  y: number;
}

export function polaire(rayon: number, angleDeg: number, etire = true): Point {
  const a = (angleDeg * Math.PI) / 180;
  return { x: CX + rayon * Math.cos(a) * (etire ? ETIREMENT : 1), y: CY + rayon * Math.sin(a) };
}

/** Le quartier de l'équipe `i` sur `n` : début, milieu, fin (en degrés, midi en haut). */
export function quartier(i: number, n: number, ecart = 5): { debut: number; milieu: number; fin: number } {
  const pas = 360 / Math.max(n, 1);
  const debut = -90 + i * pas + ecart / 2;
  const fin = -90 + (i + 1) * pas - ecart / 2;
  return { debut, milieu: (debut + fin) / 2, fin };
}

/** Le chemin SVG d'un quartier d'anneau (arc extérieur, arc intérieur). */
export function cheminQuartier(debut: number, fin: number, rInt = R_QUARTIER_INT, rExt = R_QUARTIER_EXT): string {
  const p1 = polaire(rExt, debut);
  const p2 = polaire(rExt, fin);
  const p3 = polaire(rInt, fin);
  const p4 = polaire(rInt, debut);
  const grand = fin - debut > 180 ? 1 : 0;
  const f = (n: number) => n.toFixed(1);
  return [
    `M${f(p1.x)} ${f(p1.y)}`,
    `A${f(rExt * ETIREMENT)} ${f(rExt)} 0 ${grand} 1 ${f(p2.x)} ${f(p2.y)}`,
    `L${f(p3.x)} ${f(p3.y)}`,
    `A${f(rInt * ETIREMENT)} ${f(rInt)} 0 ${grand} 0 ${f(p4.x)} ${f(p4.y)}`,
    'Z',
  ].join(' ');
}

/** Les `n` gardes d'une équipe, réparties sur l'arc de son quartier. */
export function pointsDAgents(n: number, debut: number, fin: number): Point[] {
  if (n <= 0) return [];
  const marge = (fin - debut) * 0.12;
  return Array.from({ length: n }, (_, k) => polaire(R_AGENTS, n === 1 ? (debut + fin) / 2 : debut + marge + ((fin - debut - 2 * marge) * k) / (n - 1)));
}

/** La place de chaque site : spirale d'or dans l'anneau extérieur, ordonnée par nom. */
export function placesDesSites<T extends { id: string; name?: string }>(sites: T[], max = 160): { site: T; p: Point }[] {
  const tries = [...sites].sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id)).slice(0, max);
  const n = Math.max(tries.length, 12);
  return tries.map((site, i) => {
    const r = R_SITES_MIN + (R_SITES_MAX - R_SITES_MIN) * Math.sqrt((i + 0.5) / n);
    return { site, p: polaire(r, i * NOMBRE_D_OR) };
  });
}

/** L'angle (en degrés) d'un point de la carte, en défaisant l'étirement horizontal. */
export function angleDe(p: Point): number {
  return (Math.atan2(p.y - CY, (p.x - CX) / ETIREMENT) * 180) / Math.PI;
}

/** L'anneau de circulation des lignes, entre les étiquettes et les sites ; un rail par équipe. */
export const R_RAIL = 210;

/**
 * Une ligne discrète d'une équipe vers un site, à la manière d'un plan de
 * métro : elle sort de son quartier tout droit, suit l'anneau par le plus
 * court chemin, puis rejoint le site. Jamais à travers le centre : les
 * quartiers et le Capitaine restent lisibles quel que soit le nombre de lignes.
 */
export function cheminLien(angleEquipe: number, rail: number, vers: Point): string {
  const r = R_RAIL + rail * 1.6;
  const b = angleDe(vers);
  const delta = ((((b - angleEquipe) % 360) + 540) % 360) - 180;
  const p0 = polaire(R_QUARTIER_EXT + 2, angleEquipe);
  const p1 = polaire(r, angleEquipe);
  const p2 = polaire(r, angleEquipe + delta);
  const f = (n: number) => n.toFixed(1);
  return `M${f(p0.x)} ${f(p0.y)} L${f(p1.x)} ${f(p1.y)} A${f(r * ETIREMENT)} ${f(r)} 0 0 ${delta >= 0 ? 1 : 0} ${f(p2.x)} ${f(p2.y)} L${f(vers.x)} ${f(vers.y)}`;
}

/** Une phase stable par identifiant : les points respirent sans clignoter d'un bloc. */
export function phaseDe(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) % 4000;
  return h;
}
