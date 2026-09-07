import type { InvoiceLine, Quote } from '../shared/api';

/**
 * La FORME du devis chiffré : ses lignes, leur relecture, leur repli.
 *
 * Aucun import de valeur — seulement des types — donc ce module s'exécute tel
 * quel sous Node et `scripts/check-quote.ts` éprouve le vrai code plutôt
 * qu'une copie. C'est la même règle que `outbox.ts` et `mirrorBudget.ts`, et
 * c'est pour ça que l'ARITHMÉTIQUE (totaux, TVA, acompte) vit dans
 * `money.ts` : là-bas elle est déjà testée au centime.
 *
 * ## Pourquoi le devis a des lignes
 *
 * Il n'en avait pas. Un devis, c'était un titre et UN prix. Ça suffit pour
 * vendre un forfait de supervision — l'offre a un nom, un montant, et c'est
 * tout. Ça ne suffit pas pour vendre un chantier : un maçon chiffre des
 * mètres carrés, des matériaux et de la main-d'œuvre séparément, réclame un
 * acompte à la commande, et doit porter son assurance décennale sur le
 * document. Un devis d'une ligne se fait écarter en trente secondes.
 *
 * Les lignes ont EXACTEMENT la forme de `InvoiceLine`, délibérément : c'est
 * ce qui rend la conversion devis → facture fidèle, au lieu d'aplatir le
 * chiffrage sur une ligne unique au moment précis où il compte le plus.
 *
 * ## Ce qui ne change pas
 *
 * `lines` est facultatif. Un devis créé avant cette version, ou un forfait
 * vendu en bloc, n'en a pas : `quoteLines` retombe sur la ligne de secours
 * que lui donne l'appelant, et le document sort comme avant. Aucun devis
 * existant n'est réécrit, aucune migration n'est nécessaire.
 */

/** Un devis porte-t-il un chiffrage détaillé, ou juste un prix ? */
export function hasDetailedLines(quote: Pick<Quote, 'lines'>): boolean {
  return Array.isArray(quote.lines) && quote.lines.length > 0;
}

/**
 * Relit des lignes venues de la couche de synchronisation.
 *
 * Ce qui revient d'amn-api est du JSON quelconque : un nombre peut arriver en
 * texte, un champ peut manquer, le tableau peut ne pas en être un. Sans ce
 * filtre, une seule ligne malformée fait afficher « NaN € » sur un document
 * qui part chez un client.
 */
export function normalizeQuoteLines(raw: unknown): InvoiceLine[] {
  if (!Array.isArray(raw)) return [];
  const lines: InvoiceLine[] = [];
  for (let i = 0; i < raw.length; i += 1) {
    const item = raw[i];
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const quantity = Number(row.quantity);
    const unitPriceCents = Number(row.unitPriceCents);
    const vatRate = Number(row.vatRate);
    lines.push({
      id: typeof row.id === 'string' && row.id ? row.id : `line-${i}`,
      label: typeof row.label === 'string' ? row.label : '',
      quantity: Number.isFinite(quantity) ? quantity : 0,
      // Un prix unitaire est un ENTIER de centimes. Une valeur fractionnaire
      // venue d'un autre poste propagerait des fractions de centime dans tous
      // les totaux ; on la ramène ici, une fois.
      unitPriceCents: Number.isFinite(unitPriceCents) ? Math.round(unitPriceCents) : 0,
      vatRate: Number.isFinite(vatRate) ? vatRate : 0,
    });
  }
  return lines;
}

/**
 * Les lignes à afficher : le détail s'il existe, sinon la ligne de secours.
 *
 * L'appelant fournit `secours` parce que lui seul sait quoi y écrire — le nom
 * de l'offre du catalogue de son édition — et parce que le prix d'un devis
 * d'avant est en euros, donc converti chez lui, là où `money.ts` est importé.
 *
 * La ligne de secours doit porter un taux de TVA nul : un devis d'avant ne
 * dit rien de sa TVA, et lui en inventer une ferait apparaître une taxe sur
 * un document qui n'en a jamais mentionné.
 */
export function quoteLines(quote: Pick<Quote, 'lines'>, secours: InvoiceLine): InvoiceLine[] {
  return hasDetailedLines(quote) ? (quote.lines as InvoiceLine[]) : [secours];
}

/** Une ligne vierge, prête à être remplie. */
export function emptyQuoteLine(id: string, vatRate = 0): InvoiceLine {
  return { id, label: '', quantity: 1, unitPriceCents: 0, vatRate };
}

/**
 * Les lignes prêtes à être ENVOYÉES : sans les vides, et rien d'autre.
 *
 * Une ligne sans intitulé ET sans montant est une ligne que l'utilisatrice a
 * ouverte puis laissée telle quelle. L'imprimer produit une rangée vide au
 * milieu d'un chiffrage ; la refuser l'empêcherait d'enregistrer son brouillon.
 * On l'écarte donc silencieusement à l'enregistrement.
 */
export function usableLines(lines: InvoiceLine[]): InvoiceLine[] {
  return lines.filter((l) => l.label.trim() !== '' || l.unitPriceCents !== 0);
}
