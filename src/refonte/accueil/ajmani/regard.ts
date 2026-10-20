/**
 * LE REGARD ET LE CLIGNEMENT — les calculs, sans React.
 *
 * Les yeux suivent la souris, mais de loin : ils se décalent de quelques
 * unités au plus, et d'autant moins que la souris est proche (sinon il louche).
 * Le clignement tombe toutes les 3 à 6 secondes, jamais à intervalle
 * régulier, et parfois deux fois de suite.
 */

export const REGARD_MAX = { x: 6, y: 4 } as const;

/** Distance (px) à partir de laquelle le regard est au plus loin. */
const PORTEE = 320;

/**
 * Le décalage des yeux (en unités du dessin) pour une souris en `souris`,
 * l'œil étant en `centre` (coordonnées d'écran).
 */
export function decalageRegard(centre: { x: number; y: number }, souris: { x: number; y: number }, max: { x: number; y: number } = REGARD_MAX): { x: number; y: number } {
  const dx = souris.x - centre.x;
  const dy = souris.y - centre.y;
  const dist = Math.hypot(dx, dy);
  if (!Number.isFinite(dist) || dist < 1) return { x: 0, y: 0 };
  const force = Math.min(1, dist / PORTEE);
  const r = (n: number) => Math.round(n * 100) / 100;
  return { x: r((dx / dist) * force * max.x), y: r((dy / dist) * force * max.y) };
}

/** Le délai avant le prochain clignement : entre 3 et 6 secondes, tiré au sort. */
export function delaiClignement(hasard: () => number = Math.random): number {
  return 3000 + Math.floor(Math.min(0.999, Math.max(0, hasard())) * 3000);
}

/** Un clignement sur sept environ est double. */
export function clignementDouble(hasard: () => number = Math.random): boolean {
  return hasard() < 0.15;
}

/** Un coup d'œil au hasard quand la souris dort : le regard bouge, il est vivant. */
export function coupDOeil(hasard: () => number = Math.random): { x: number; y: number } {
  return { x: Math.round((hasard() * 2 - 1) * REGARD_MAX.x * 0.7), y: Math.round((hasard() * 2 - 1) * REGARD_MAX.y * 0.5) };
}
