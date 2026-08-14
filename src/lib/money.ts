/**
 * L'argent, en centimes entiers.
 *
 * Une facture est un document comptable : si un total affiché diffère d'un
 * centime de la somme de ses lignes, le document est faux, et personne ne
 * saura dire pourquoi. C'est exactement ce que produisent les flottants —
 * `0.1 + 0.2` vaut `0.30000000000000004`, et trois lignes à 19,99 € facturées
 * en euros décimaux ne redonnent pas toujours 59,97 €.
 *
 * Tout ce module travaille donc sur des entiers de centimes, et l'arrondi
 * n'arrive qu'à un seul endroit : le calcul de la TVA, qui est le seul moment
 * où une division est inévitable. Les devis existants stockent un prix en
 * euros (`Quote.priceEuro`) ; `eurosToCents` est la frontière entre les deux
 * mondes.
 */

/** Arrondi commercial (0,5 s'éloigne de zéro), celui qu'attend un comptable. */
export function roundHalfAwayFromZero(value: number): number {
  return value < 0 ? -Math.round(-value) : Math.round(value);
}

/** Euros décimaux → centimes entiers. Tolère `1 234,56`, `1234.56`, `1234`. */
export function eurosToCents(input: string | number): number {
  if (typeof input === 'number') {
    return Number.isFinite(input) ? roundHalfAwayFromZero(input * 100) : 0;
  }
  // `\s` couvre déjà l'espace insécable et l'espace fine insécable (catégorie
  // Zs) : c'est exactement ce qu'`Intl` insère comme séparateur de milliers,
  // donc un montant recopié depuis l'écran se relit sans rien casser.
  const cleaned = input
    .replace(/\s/g, '')
    .replace(',', '.')
    .replace(/[^0-9.-]/g, '');
  const value = Number.parseFloat(cleaned);
  return Number.isFinite(value) ? roundHalfAwayFromZero(value * 100) : 0;
}

/**
 * Comme {@link eurosToCents}, mais un montant négatif vaut zéro.
 *
 * Pour tout ce qui ne PEUT pas être négatif : une dépense, un budget, un tarif
 * horaire. Un `-40` tapé par erreur y deviendrait sinon une recette, et le
 * total du mois baisserait sans que rien ne le signale. Les factures, elles,
 * continuent d'utiliser `eurosToCents` : un avoir est légitimement négatif.
 */
export function parsePositiveAmount(input: string | number): number {
  return Math.max(0, eurosToCents(input));
}

/** Centimes → chaîne éditable dans un champ (`1234.56`), sans séparateur de milliers. */
export function centsToInput(cents: number): string {
  if (!Number.isFinite(cents) || cents === 0) return '';
  return (cents / 100).toFixed(2);
}

/**
 * Centimes → « 1 234,56 € ».
 *
 * `Intl` porte la convention française complète (espace insécable avant le
 * symbole, virgule décimale) ; la réécrire à la main est le genre de détail
 * qu'on rate une fois sur deux.
 */
export function formatCents(cents: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format((Number.isFinite(cents) ? cents : 0) / 100);
}

/** Comme {@link formatCents}, sans les décimales quand elles sont nulles — pour les totaux d'écran. */
export function formatCentsCompact(cents: number): string {
  const safe = Number.isFinite(cents) ? cents : 0;
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: safe % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(safe / 100);
}

/** Un taux de TVA lisible : `20` → « 20 % », `5.5` → « 5,5 % ». */
export function formatVatRate(rate: number): string {
  const safe = Number.isFinite(rate) ? rate : 0;
  return `${safe.toString().replace('.', ',')} %`;
}

export interface LineAmounts {
  /** Base hors taxes de la ligne, en centimes. */
  netCents: number;
  /** TVA de la ligne, en centimes, arrondie une seule fois. */
  vatCents: number;
  /** Toutes taxes comprises. */
  grossCents: number;
}

/**
 * Le montant d'une ligne.
 *
 * La quantité peut être décimale (2,5 jours, 1,5 h), d'où l'arrondi du net :
 * une ligne de 2,5 × 33,33 € vaut 83,325 € et doit devenir 83,33 €, pas
 * 83,32 € ni un total qui traîne trois décimales jusqu'au pied de page.
 */
export function lineAmounts(quantity: number, unitPriceCents: number, vatRate: number): LineAmounts {
  const qty = Number.isFinite(quantity) ? quantity : 0;
  const unit = Number.isFinite(unitPriceCents) ? unitPriceCents : 0;
  const rate = Number.isFinite(vatRate) ? vatRate : 0;
  const netCents = roundHalfAwayFromZero(qty * unit);
  const vatCents = roundHalfAwayFromZero((netCents * rate) / 100);
  return { netCents, vatCents, grossCents: netCents + vatCents };
}

export interface VatBucket {
  rate: number;
  netCents: number;
  vatCents: number;
}

export interface DocumentTotals {
  netCents: number;
  vatCents: number;
  grossCents: number;
  /** Une entrée par taux réellement utilisé, triée par taux croissant. */
  vatBuckets: VatBucket[];
}

/**
 * Les totaux d'un document.
 *
 * La TVA est agrégée PAR TAUX, pas globalement : une facture qui mélange 20 %
 * et 5,5 % doit détailler chaque base et chaque montant de taxe — c'est une
 * mention obligatoire, et c'est aussi ce que le comptable recopie.
 */
export function documentTotals(
  lines: { quantity: number; unitPriceCents: number; vatRate: number }[],
): DocumentTotals {
  const buckets = new Map<number, VatBucket>();
  let netCents = 0;
  let vatCents = 0;

  for (const line of lines) {
    const amounts = lineAmounts(line.quantity, line.unitPriceCents, line.vatRate);
    netCents += amounts.netCents;
    vatCents += amounts.vatCents;
    const rate = Number.isFinite(line.vatRate) ? line.vatRate : 0;
    const bucket = buckets.get(rate) ?? { rate, netCents: 0, vatCents: 0 };
    bucket.netCents += amounts.netCents;
    bucket.vatCents += amounts.vatCents;
    buckets.set(rate, bucket);
  }

  return {
    netCents,
    vatCents,
    grossCents: netCents + vatCents,
    vatBuckets: [...buckets.values()].sort((a, b) => a.rate - b.rate),
  };
}
