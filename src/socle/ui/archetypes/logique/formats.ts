/**
 * LES FORMATS À LA FRANÇAISE — pourcentage, montant, date, heure.
 * ═══════════════════════════════════════════════════════════════
 *
 * Mode d'emploi : `formaterPourcent(0.78)` donne « 78 % », `formaterMontant(1250)` « 1 250 € », avec les
 * espaces insécables du français (règle A5 des écarts). Rien n'est écrit en dur : la langue vient de `locale`
 * (`fr-FR` par défaut), les dates de l'argument. Le module n'importe rien.
 */

export type Locale = string;

export function formaterPourcent(valeur: number, locale: Locale = 'fr-FR'): string {
  const v = Number.isFinite(valeur) ? Math.min(1, Math.max(0, valeur)) : 0;
  return new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 }).format(v);
}

/** Un montant : sans décimales s'il est rond (« 1 250 € »), avec deux sinon (« 1 250,50 € »). */
export function formaterMontant(valeur: number, devise = 'EUR', locale: Locale = 'fr-FR'): string {
  const rond = Number.isInteger(valeur);
  return new Intl.NumberFormat(locale, { style: 'currency', currency: devise, minimumFractionDigits: rond ? 0 : 2, maximumFractionDigits: 2 }).format(valeur);
}

export function formaterDate(date: Date | number | string, options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }, locale: Locale = 'fr-FR'): string {
  return new Intl.DateTimeFormat(locale, options).format(new Date(date));
}

export function formaterHeure(date: Date | number | string, locale: Locale = 'fr-FR'): string {
  return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(new Date(date));
}

/** La forme machine d'une date, pour `<time dateTime>`. */
export function dateIso(date: Date | number | string): string {
  const d = new Date(date);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString();
}
