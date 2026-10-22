/**
 * Les nombres de l'atelier : argent en CENTIMES entiers, dates en `AAAA-MM-JJ`.
 *
 * Aucun module ne calcule de l'argent en flottant : un montant entre en euros
 * (ce que la personne tape), devient des centimes, et ne repasse en euros qu'à
 * l'affichage. Les dates restent des chaînes ISO calculées en UTC : pas de
 * fuseau qui décale un jour d'échéance à minuit.
 */

export type Centimes = number;

/** « 12,5 » ou « 12.5 » ou 12.5 → 1250. `NaN` pour une saisie illisible. */
export function versCentimes(euros: number | string): Centimes {
  const n = typeof euros === 'number' ? euros : Number(String(euros).replace(/\s/g, '').replace(',', '.'));
  if (!Number.isFinite(n)) return Number.NaN;
  return Math.round(n * 100);
}

/** Arrondi d'un produit ou d'un quotient en centimes, au centime le plus proche (demi vers le haut). */
export function arrondiCentime(x: number): Centimes {
  return Math.sign(x) * Math.round(Math.abs(x));
}

const EUROS_FR = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
const EUROS_EN = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'EUR' });

export function euros(c: Centimes, langue: 'fr' | 'en' = 'fr'): string {
  return (langue === 'fr' ? EUROS_FR : EUROS_EN).format(c / 100).replace(/\u202f/g, '\u00a0');
}

export function nombre(x: number, decimales = 2, langue: 'fr' | 'en' = 'fr'): string {
  return new Intl.NumberFormat(langue === 'fr' ? 'fr-FR' : 'en-GB', { maximumFractionDigits: decimales })
    .format(x)
    .replace(/\u202f/g, '\u00a0');
}

/** Répartit `total` en `n` parts entières dont la somme fait exactement `total` (le reste va aux premières). */
export function repartir(total: Centimes, n: number): Centimes[] {
  if (!Number.isInteger(n) || n < 1) return [];
  const base = Math.trunc(total / n);
  let reste = total - base * n;
  return Array.from({ length: n }, () => {
    const pas = reste > 0 ? 1 : reste < 0 ? -1 : 0;
    reste -= pas;
    return base + pas;
  });
}

/* ── Dates ──────────────────────────────────────────────────────────────── */

const JOUR_MS = 86_400_000;
const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

export function estDateIso(s: string): boolean {
  const m = ISO.exec(s);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}

function versUtc(s: string): number {
  const m = ISO.exec(s);
  if (!m) throw new Error(`date illisible : ${s}`);
  return Date.UTC(+m[1], +m[2] - 1, +m[3]);
}

function versIso(t: number): string {
  return new Date(t).toISOString().slice(0, 10);
}

/** Nombre de jours de `a` à `b` (positif si `b` est après `a`). */
export function joursEntre(a: string, b: string): number {
  return Math.round((versUtc(b) - versUtc(a)) / JOUR_MS);
}

export function ajouterJours(s: string, n: number): string {
  return versIso(versUtc(s) + n * JOUR_MS);
}

/** Ajoute `n` mois ; un 31 qui n'existe pas devient le dernier jour du mois (31 janvier + 1 mois = 28 ou 29 février). */
export function ajouterMois(s: string, n: number): string {
  const m = ISO.exec(s);
  if (!m) throw new Error(`date illisible : ${s}`);
  const total = +m[1] * 12 + (+m[2] - 1) + n;
  const annee = Math.floor(total / 12);
  const mois = total - annee * 12;
  const dernier = new Date(Date.UTC(annee, mois + 1, 0)).getUTCDate();
  return versIso(Date.UTC(annee, mois, Math.min(+m[3], dernier)));
}

export function estBissextile(annee: number): boolean {
  return (annee % 4 === 0 && annee % 100 !== 0) || annee % 400 === 0;
}

export function dateLisible(s: string, langue: 'fr' | 'en' = 'fr'): string {
  return new Intl.DateTimeFormat(langue === 'fr' ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(versUtc(s)),
  );
}

/** La date du jour du bac à sable : fixe, pour que l'écran et les tests disent la même chose. */
export const AUJOURDHUI_BAC_A_SABLE = '2026-10-22';
