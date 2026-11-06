/**
 * LES FORMATS À LA FRANÇAISE — pourcentage, montant, date, heure.
 * ═══════════════════════════════════════════════════════════════
 *
 * Mode d'emploi : `formaterPourcent(0.78)` donne « 78 % », `formaterMontant(1250)` « 1 250 € », avec les
 * espaces insécables du français (règle A5 des écarts). Rien n'est écrit en dur : la langue vient de `locale`
 * (`fr-FR` par défaut), les dates de l'argument. Le module n'importe rien.
 *
 * Une valeur illisible (NaN, ±Infinity, une date invalide) donne « — », comme les formats des graphiques : un tiret
 * se lit, « NaN € », « 0 % » pour un ratio inconnu ou une exception au rendu, non. `dateIso` rend alors « » (la forme
 * machine d'une date absente est vide).
 */

export type Locale = string;

/** Ce qu'on affiche à la place d'une valeur illisible (le même tiret que `graphiques/format.ts`, sans l'importer). */
const TIRET_ABSENT = '—';

export function formaterPourcent(valeur: number, locale: Locale = 'fr-FR'): string {
  if (!Number.isFinite(valeur)) return TIRET_ABSENT;
  const v = Math.min(1, Math.max(0, valeur));
  return new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 }).format(v);
}

/** Un montant : sans décimales s'il est rond (« 1 250 € »), avec deux sinon (« 1 250,50 € ») ; jamais « -0 € ». */
export function formaterMontant(valeur: number, devise = 'EUR', locale: Locale = 'fr-FR'): string {
  if (!Number.isFinite(valeur)) return TIRET_ABSENT;
  const v = valeur === 0 ? 0 : valeur;
  const rond = Number.isInteger(v);
  return new Intl.NumberFormat(locale, { style: 'currency', currency: devise, minimumFractionDigits: rond ? 0 : 2, maximumFractionDigits: 2 }).format(v);
}

export function formaterDate(date: Date | number | string, options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }, locale: Locale = 'fr-FR'): string {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return TIRET_ABSENT;
  return new Intl.DateTimeFormat(locale, options).format(d);
}

export function formaterHeure(date: Date | number | string, locale: Locale = 'fr-FR'): string {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return TIRET_ABSENT;
  return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(d);
}

/** La forme machine d'une date, pour `<time dateTime>`. */
export function dateIso(date: Date | number | string): string {
  const d = new Date(date);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString();
}
