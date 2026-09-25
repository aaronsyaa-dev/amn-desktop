/** Petites écritures communes aux bureaux — un seul endroit pour les signes, les heures et les jours. */

/** « +3 », « −9 », « 0 » — le vrai signe moins, jamais un tiret. */
export function signe(n: number): string {
  if (n > 0) return `+${n}`;
  if (n < 0) return `−${Math.abs(n)}`;
  return '0';
}

export const deuxChiffres = (n: number) => String(n).padStart(2, '0');

export function hhmm(iso: string | number | Date | null | undefined): string {
  if (iso === null || iso === undefined || iso === '') return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${deuxChiffres(d.getHours())}:${deuxChiffres(d.getMinutes())}`;
}

export function hhmmss(d: Date, utc = false): string {
  return utc
    ? `${deuxChiffres(d.getUTCHours())}:${deuxChiffres(d.getUTCMinutes())}:${deuxChiffres(d.getUTCSeconds())}`
    : `${deuxChiffres(d.getHours())}:${deuxChiffres(d.getMinutes())}:${deuxChiffres(d.getSeconds())}`;
}

const JOURS = ['DIM', 'LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM'];
const JOURS_LONGS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const MOIS_COURTS = ['JANV', 'FÉVR', 'MARS', 'AVR', 'MAI', 'JUIN', 'JUIL', 'AOÛT', 'SEPT', 'OCT', 'NOV', 'DÉC'];

const date = (x: string | number | Date) => (typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x) ? new Date(`${x}T00:00:00`) : new Date(x));

/** « SAM 27 » */
export function jourCourt(x: string | number | Date): string {
  const d = date(x);
  return `${JOURS[d.getDay()]} ${d.getDate()}`;
}
/** « samedi » */
export function jourLong(x: string | number | Date): string {
  return JOURS_LONGS[date(x).getDay()];
}
/** « 27 septembre » */
export function jourMois(x: string | number | Date): string {
  const d = date(x);
  return `${d.getDate()} ${MOIS[d.getMonth()]}`;
}
/** « 15 SEPT » */
export function jourMoisCourt(x: string | number | Date): string {
  const d = date(x);
  return `${d.getDate()} ${MOIS_COURTS[d.getMonth()]}`;
}
export function moisLong(x: string | number | Date): string {
  const d = date(x);
  return `${MOIS[d.getMonth()]} ${d.getFullYear()}`;
}

/** « il y a deux heures », « il y a 12 min » — pour les phrases, pas pour les colonnes. */
export function ilYA(iso: string | number, maintenant = Date.now()): string {
  const ms = maintenant - new Date(iso).getTime();
  const min = Math.round(ms / 60_000);
  if (min < 1) return 'à l’instant';
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `il y a ${h === 1 ? 'une heure' : h === 2 ? 'deux heures' : `${h} h`}`;
  const j = Math.round(h / 24);
  return `il y a ${j === 1 ? 'un jour' : `${j} jours`}`;
}

/** « 50 min », « 3 h 10 », « 2 j » — un délai restant, sans signe. */
export function duree(ms: number): string {
  const abs = Math.abs(ms);
  const min = Math.round(abs / 60_000);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return min % 60 ? `${h} h ${deuxChiffres(min % 60)}` : `${h} h`;
  return `${Math.round(h / 24)} j`;
}

export const pluriel = (n: number, un: string, des: string) => `${n} ${n > 1 ? des : un}`;

const NOMBRES = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf', 'vingt'];
/** « Douze », « Trois » en tête de phrase ; au-delà de vingt, le chiffre. */
const DIZAINES: Record<number, string> = { 30: 'trente', 40: 'quarante', 50: 'cinquante', 60: 'soixante' };
export function enLettres(n: number, majuscule = false): string {
  const m = n >= 0 && n <= 20 ? NOMBRES[n] : DIZAINES[n] ?? String(n);
  return majuscule ? m.charAt(0).toUpperCase() + m.slice(1) : m;
}
/** Féminin : « une », pour les pièces, les organisations. */
export function enLettresF(n: number, majuscule = false): string {
  return n === 1 ? (majuscule ? 'Une' : 'une') : enLettres(n, majuscule);
}

/** Le prénom d'un compte (« harun@… » → « Harun »), quand aucun profil ne le dit. */
export function prenomDe(email: string | null | undefined): string {
  if (!email) return '—';
  const base = email.split('@')[0].split(/[._-]/)[0];
  return base.charAt(0).toUpperCase() + base.slice(1);
}

/** « du Jardin d’Élise », « de la Cave », « des Halles », « d’Atelier Vermeil », « de Studio Nord ». */
export function deNom(nom: string): string {
  const m = /^(le|la|les)\s+(.*)$/i.exec(nom.trim());
  if (m) {
    const a = m[1].toLowerCase();
    return a === 'le' ? `du ${m[2]}` : a === 'les' ? `des ${m[2]}` : `de la ${m[2]}`;
  }
  return /^[aeiouyàâéèêëîïôöùû]/i.test(nom.trim()) ? `d’${nom.trim()}` : `de ${nom.trim()}`;
}
