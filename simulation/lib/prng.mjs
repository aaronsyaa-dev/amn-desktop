/**
 * Générateur pseudo-aléatoire à GRAINE FIXE — reproductibilité avant tout.
 *
 * mulberry32 : 32 bits d'état, rapide, suffisant pour peupler un bac à sable.
 * La même graine rend EXACTEMENT la même population et les mêmes tirages, donc
 * un constat se rejoue à l'identique. On n'utilise jamais `Math.random()` dans
 * la simulation : il briserait cette garantie.
 */
export function prng(graine = 424242) {
  let a = graine >>> 0;
  const suivant = () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    /** Réel dans [0,1). */
    reel: suivant,
    /** Entier dans [min, max]. */
    entier: (min, max) => min + Math.floor(suivant() * (max - min + 1)),
    /** Un élément du tableau. */
    choix: (tableau) => tableau[Math.floor(suivant() * tableau.length)],
    /** Vrai avec la probabilité p. */
    chance: (p) => suivant() < p,
    /** Mélange en place (Fisher-Yates), déterministe. */
    melanger: (tableau) => {
      for (let i = tableau.length - 1; i > 0; i -= 1) {
        const j = Math.floor(suivant() * (i + 1));
        [tableau[i], tableau[j]] = [tableau[j], tableau[i]];
      }
      return tableau;
    },
  };
}
