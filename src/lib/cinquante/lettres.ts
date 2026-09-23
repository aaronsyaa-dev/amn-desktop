/**
 * LES PETITS NOMBRES EN TOUTES LETTRES — pour les phrases d'en-tête.
 *
 * Les chapôs des quarante-cinq modules du chantier des cinquante sont des
 * phrases (« Trente-huit paniers ouverts ce mois, vingt-deux payés »), pas des
 * relevés : un chiffre en mono au milieu d'une phrase d'en-tête casse la
 * lecture, et les relevés chiffrés ont déjà leur place juste en dessous.
 *
 * Jusqu'à 99, on écrit ; au-delà, on rend le nombre en chiffres — une phrase
 * qui dirait « quatre cent douze » se lit plus mal que « 412 ».
 */
export type LangueLettres = 'fr' | 'en';

const UNITES_FR = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix',
  'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
const DIZAINES_FR = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante', 'quatre-vingt', 'quatre-vingt'];

const UNITES_EN = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const DIZAINES_EN = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

function francais(n: number): string {
  if (n < 20) return UNITES_FR[n];
  const d = Math.floor(n / 10);
  const u = n % 10;
  // 70–79 et 90–99 se construisent sur la dizaine précédente : soixante-dix, quatre-vingt-dix.
  if (d === 7 || d === 9) {
    const reste = 10 + u;
    const lien = d === 7 && u === 1 ? ' et ' : '-';
    return `${DIZAINES_FR[d]}${lien}${UNITES_FR[reste]}`;
  }
  if (u === 0) return d === 8 ? 'quatre-vingts' : DIZAINES_FR[d];
  if (u === 1 && d !== 8) return `${DIZAINES_FR[d]} et un`;
  return `${DIZAINES_FR[d]}-${UNITES_FR[u]}`;
}

function anglais(n: number): string {
  if (n < 20) return UNITES_EN[n];
  const d = Math.floor(n / 10);
  const u = n % 10;
  return u === 0 ? DIZAINES_EN[d] : `${DIZAINES_EN[d]}-${UNITES_EN[u]}`;
}

/** `n` en toutes lettres jusqu'à 99, en chiffres au-delà ; `majuscule` pour un début de phrase. */
export function enLettres(n: number, langue: LangueLettres = 'fr', majuscule = false): string {
  const entier = Math.round(n);
  const texte =
    entier < 0 || entier > 99 ? String(entier) : langue === 'fr' ? francais(entier) : anglais(entier);
  return majuscule ? texte.charAt(0).toUpperCase() + texte.slice(1) : texte;
}
