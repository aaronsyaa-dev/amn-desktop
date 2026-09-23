/*
  LES NOMBRES EN TOUTES LETTRES — pour les phrases (« un trou de
  soixante-quinze minutes »). Orthographe de 1990 : traits d'union partout.
  Jusqu'à 999 ; au-delà, les chiffres.
*/
const UNITES = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize'];
const DIZAINES = ['', 'dix', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante'];

function sousCent(n: number): string {
  if (n <= 16) return UNITES[n];
  if (n < 20) return `dix-${UNITES[n - 10]}`;
  if (n < 70) {
    const d = Math.floor(n / 10);
    const u = n % 10;
    return u === 0 ? DIZAINES[d] : u === 1 ? `${DIZAINES[d]}-et-un` : `${DIZAINES[d]}-${UNITES[u]}`;
  }
  if (n < 80) return n === 71 ? 'soixante-et-onze' : `soixante-${sousCent(n - 60)}`;
  if (n === 80) return 'quatre-vingts';
  return `quatre-vingt-${sousCent(n - 80)}`;
}

export function enLettres(n: number): string {
  const v = Math.round(n);
  if (v < 0 || v > 999) return String(v);
  if (v < 100) return sousCent(v);
  const c = Math.floor(v / 100);
  const r = v % 100;
  const cents = c === 1 ? 'cent' : `${UNITES[c]}-cent${r === 0 ? 's' : ''}`;
  return r === 0 ? cents : `${cents}-${sousCent(r)}`;
}
