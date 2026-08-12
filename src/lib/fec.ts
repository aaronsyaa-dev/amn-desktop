/**
 * Export FEC — Fichier des Écritures Comptables.
 *
 * ## Pourquoi ce fichier n'est pas une option
 *
 * Article L47 A du Livre des procédures fiscales : une entreprise qui tient sa
 * comptabilité au moyen de systèmes informatisés doit, en cas de contrôle,
 * remettre ses écritures dans un format normalisé. Le format lui-même est fixé
 * par l'article A47 A-1 : dix-huit colonnes, dans cet ordre, séparées par des
 * tabulations, avec une ligne d'en-tête aux intitulés exacts.
 *
 * Un logiciel de facturation qui ne sait pas produire ce fichier met sa
 * cliente en défaut le jour du contrôle. Ce n'est donc pas une fonctionnalité
 * de confort — c'est la condition pour que les factures émises ici soient
 * défendables.
 *
 * ## Ce que ce module produit, et ce qu'il ne produit pas
 *
 * Il produit le **journal des ventes** : une écriture par facture émise, en
 * partie double. C'est ce qu'un outil de facturation doit savoir sortir.
 *
 * Il ne produit PAS le journal de banque (les encaissements) : l'application
 * sait qu'une facture est payée et par quel moyen, mais elle ne tient aucun
 * compte bancaire, et inventer des écritures de trésorerie à partir de rien
 * produirait un fichier qui a l'air complet et qui est faux. Le manque est
 * annoncé dans `warnings` plutôt que comblé par une approximation.
 *
 * ## L'invariant qui compte
 *
 * En partie double, la somme des débits égale la somme des crédits — pour
 * chaque écriture, et pour le fichier entier. Tout est calculé en centimes
 * entiers (voir `src/lib/money.ts`) précisément pour que cette égalité soit
 * exacte et non « exacte à l'arrondi près ». `npm run check:fec` la vérifie,
 * y compris sur des factures à plusieurs taux et sur des montants négatifs.
 *
 * ## Encodage
 *
 * Le fichier est écrit en UTF-8 sans BOM. Les caractères typographiques que
 * produisent les traitements de texte (tiret cadratin, apostrophe courbe,
 * guillemets français, espace insécable) sont ramenés à leurs équivalents
 * ASCII : le fichier reste ainsi transcodable en ISO 8859-15, l'autre encodage
 * accepté, et un nom de société recopié depuis un mail ne fait pas échouer le
 * contrôle sur un caractère invisible.
 */

import { documentTotals } from './money';
import type { Invoice } from '../shared/api';

/* ------------------------------ Le plan comptable ------------------------- */

/**
 * Les comptes utilisés, en plan comptable général français.
 *
 * Volontairement peu nombreux et standards : un export FEC sert à être relu
 * par un comptable ou par l'administration, pas à refléter un plan analytique
 * qui n'existe pas dans cette application.
 */
export const ACCOUNTS = {
  /** 411 — Clients. Compte COLLECTIF : c'est le seul qui porte un auxiliaire. */
  clients: { num: '411000', lib: 'Clients' },
  /** 706 — Prestations de services. Crédité du montant HT. */
  sales: { num: '706000', lib: 'Prestations de services' },
  /** 44571 — TVA collectée. Créditée de la taxe. */
  vat: { num: '445710', lib: 'TVA collectée' },
} as const;

const JOURNAL = { code: 'VE', lib: 'Journal des ventes' };

/** Les dix-huit colonnes de l'article A47 A-1, dans l'ordre imposé. */
export const FEC_COLUMNS = [
  'JournalCode',
  'JournalLib',
  'EcritureNum',
  'EcritureDate',
  'CompteNum',
  'CompteLib',
  'CompAuxNum',
  'CompAuxLib',
  'PieceRef',
  'PieceDate',
  'EcritureLib',
  'Debit',
  'Credit',
  'EcritureLet',
  'DateLet',
  'ValidDate',
  'Montantdevise',
  'Idevise',
] as const;

export type FecColumn = (typeof FEC_COLUMNS)[number];

export type FecLine = Record<FecColumn, string>;

export interface FecResult {
  lines: FecLine[];
  /** Ce que l'export n'a PAS pu représenter — affiché, jamais tu. */
  warnings: string[];
  totalDebitCents: number;
  totalCreditCents: number;
  /** Nombre de factures effectivement écrites (une écriture chacune). */
  invoiceCount: number;
}

/* --------------------------------- Formats -------------------------------- */

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Une date exploitable : `AAAA-MM-JJ`, et un jour qui existe vraiment. */
export function isValidDay(isoDay: string): boolean {
  const value = String(isoDay ?? '').slice(0, 10);
  if (!ISO_DAY.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  // Un 31 février se relit `2026-03-03` : la recomposition est le seul contrôle
  // qui attrape les jours qui n'existent pas, années bissextiles comprises.
  const probe = new Date(Date.UTC(y, m - 1, d));
  return probe.getUTCFullYear() === y && probe.getUTCMonth() === m - 1 && probe.getUTCDate() === d;
}

/** `2026-08-11` → `20260811`. Le format FEC n'accepte rien d'autre. */
export function fecDate(isoDay: string): string {
  return String(isoDay ?? '').slice(0, 10).replace(/-/g, '');
}

/**
 * Centimes → `1234,56`.
 *
 * Virgule décimale : c'est la convention française, et c'est celle que
 * l'administration attend dans un FEC. Un point ferait lire « 123456 » par
 * certains outils de contrôle.
 *
 * Toujours positif : en partie double, un montant négatif s'exprime en
 * changeant de colonne, pas en mettant un signe moins. Un `Debit` à `-100,00`
 * fait rejeter le fichier.
 */
export function fecAmount(cents: number): string {
  const safe = Number.isFinite(cents) ? Math.abs(Math.round(cents)) : 0;
  return `${Math.floor(safe / 100)},${String(safe % 100).padStart(2, '0')}`;
}

/**
 * Ramène les caractères typographiques à leurs équivalents ASCII.
 *
 * Exporté pour être contrôlé : c'est ce qui garantit qu'un fichier écrit en
 * UTF-8 reste transcodable en ISO 8859-15 sans perte, et qu'aucune espace
 * insécable ne se retrouve au milieu d'une raison sociale.
 */
export function asciiPunctuation(value: string): string {
  return (
    String(value ?? '')
      // Tirets : U+2010 à U+2015 (dont cadratin et demi-cadratin) et le moins
      // mathématique U+2212, que les tableurs insèrent devant un montant.
      .replace(/[\u2010-\u2015\u2212]/g, '-')
      // Apostrophes et primes.
      .replace(/[\u2018\u2019\u201B\u2032]/g, "'")
      // Guillemets, français compris.
      .replace(/[\u201C\u201D\u201E\u00AB\u00BB\u2033]/g, '"')
      .replace(/\u2026/g, '...')
      // Espaces insécables et fines : invisibles à l'œil, absentes de l'ASCII,
      // et parfaitement capables de faire échouer un contrôle automatique.
      .replace(/[\u00A0\u2007\u2009\u202F]/g, ' ')
  );
}

/**
 * Nettoie un libellé pour un fichier à colonnes tabulées.
 *
 * Une tabulation ou un retour à la ligne dans une raison sociale décalerait
 * toutes les colonnes suivantes — le fichier resterait lisible à l'œil et
 * serait rejeté par le contrôle.
 */
export function fecText(value: string, max = 100): string {
  return asciiPunctuation(value)
    .replace(/[\t\r\n]+/g, ' ')
    .replace(/ {2,}/g, ' ')
    .trim()
    .slice(0, max);
}

/** Un taux de TVA lisible dans un libellé : `5.5` → « 5,5 % ». */
function formatRate(rate: number): string {
  const safe = Number.isFinite(rate) ? rate : 0;
  return `${String(safe).replace('.', ',')} %`;
}

/* ------------------------------- La construction --------------------------- */

/** Le compte auxiliaire d'un client : `C` + son identifiant, sur 6 chiffres. */
function auxNum(clientId: number): string {
  const safe = Number.isFinite(clientId) && clientId > 0 ? Math.floor(clientId) : 0;
  return `C${String(safe).padStart(6, '0')}`;
}

/**
 * Une écriture en construction : le montant est SIGNÉ et le côté « naturel »
 * est celui d'une facture ordinaire. `postings` s'occupe ensuite de basculer
 * de colonne quand le signe l'exige, ce qui est le seul traitement correct
 * d'un avoir.
 */
interface Posting {
  account: { num: string; lib: string };
  /** Compte collectif : lui seul porte le compte auxiliaire du client. */
  collective: boolean;
  label: string;
  /** Positif = sens naturel (débit pour `naturalDebit`, crédit sinon). */
  cents: number;
  naturalDebit: boolean;
}

/**
 * Construit les écritures du journal des ventes.
 *
 * Une facture donne une écriture équilibrée :
 *   - un DÉBIT du compte client, du montant TTC ;
 *   - un CRÉDIT du compte de produits, du montant HT, par taux de TVA ;
 *   - un CRÉDIT de la TVA collectée, par taux.
 *
 * Ce qui est écarté l'est explicitement, et compté dans `warnings` :
 * brouillons (pas de numéro, donc pas de pièce comptable), annulées (une
 * annulation se comptabilise par un avoir, que l'application ne sait pas
 * émettre), factures sans ligne, dates d'émission inexploitables.
 */
export function buildFec(
  invoices: Invoice[],
  options: { year?: number; validDate?: string } = {},
): FecResult {
  const warnings: string[] = [];
  const lines: FecLine[] = [];
  let totalDebitCents = 0;
  let totalCreditCents = 0;

  const list = Array.isArray(invoices) ? invoices : [];
  const year = options.year;
  const inYear = (iso: string) => (year === undefined ? true : String(iso).startsWith(`${year}-`));

  const drafts = list.filter((i) => i.status === 'draft').length;
  const cancelled = list.filter((i) => i.status === 'cancelled' && inYear(i.issuedAt)).length;

  const candidates = list
    .filter((i) => i.status === 'issued' || i.status === 'paid')
    .filter((i) => inYear(i.issuedAt));

  let badDates = 0;
  let noNumber = 0;
  let empty = 0;
  let anonymousClient = 0;

  const eligible = candidates
    .filter((invoice) => {
      if (!invoice.number) {
        noNumber += 1;
        return false;
      }
      if (!isValidDay(invoice.issuedAt)) {
        badDates += 1;
        return false;
      }
      if (!Array.isArray(invoice.lines) || invoice.lines.length === 0) {
        empty += 1;
        return false;
      }
      return true;
    })
    .sort((a, b) => a.issuedAt.localeCompare(b.issuedAt) || a.number.localeCompare(b.number));

  const seenNumbers = new Set<string>();
  const duplicates = new Set<string>();

  for (const invoice of eligible) {
    const totals = documentTotals(invoice.lines);
    const ecritureNum = fecText(invoice.number, 20);
    if (seenNumbers.has(ecritureNum)) duplicates.add(ecritureNum);
    seenNumbers.add(ecritureNum);

    const date = fecDate(invoice.issuedAt);
    // `ValidDate` est la date à laquelle l'écriture est validée, donc figée.
    // Ici, l'émission : c'est exactement le moment où la facture cesse d'être
    // modifiable dans l'application (voir `useInvoices`).
    const validDate =
      options.validDate && isValidDay(options.validDate) ? fecDate(options.validDate) : date;
    const clientLabel = fecText(invoice.billTo?.company || invoice.billTo?.name || 'Client');
    if (!(Number.isFinite(invoice.clientId) && invoice.clientId > 0)) anonymousClient += 1;

    const postings: Posting[] = [
      {
        account: ACCOUNTS.clients,
        collective: true,
        label: `Facture ${ecritureNum} - ${clientLabel}`,
        cents: totals.grossCents,
        naturalDebit: true,
      },
    ];

    // Un crédit de produits et un crédit de TVA PAR TAUX. Agréger tous les taux
    // sur une seule ligne rendrait la ventilation de TVA impossible à relire,
    // alors que c'est précisément ce qu'un contrôle vérifie.
    for (const bucket of totals.vatBuckets) {
      postings.push({
        account: ACCOUNTS.sales,
        collective: false,
        label: `Facture ${ecritureNum} - HT ${formatRate(bucket.rate)}`,
        cents: bucket.netCents,
        naturalDebit: false,
      });
      // Un taux à 0 % ne produit pas de ligne de taxe : une écriture à zéro
      // n'apporte rien et encombre le fichier.
      if (bucket.vatCents !== 0) {
        postings.push({
          account: ACCOUNTS.vat,
          collective: false,
          label: `Facture ${ecritureNum} - TVA ${formatRate(bucket.rate)}`,
          cents: bucket.vatCents,
          naturalDebit: false,
        });
      }
    }

    for (const posting of postings) {
      // Le signe décide de la colonne, jamais du contenu de la colonne : un
      // avoir bascule le débit client en crédit et le produit en débit, ce qui
      // conserve l'équilibre de l'écriture avec des montants tous positifs.
      const debit = posting.cents >= 0 ? posting.naturalDebit : !posting.naturalDebit;
      const amount = Math.abs(posting.cents);
      lines.push({
        JournalCode: JOURNAL.code,
        JournalLib: JOURNAL.lib,
        EcritureNum: ecritureNum,
        EcritureDate: date,
        CompteNum: posting.account.num,
        CompteLib: posting.account.lib,
        // Le compte auxiliaire n'a de sens que sur un compte COLLECTIF. En
        // porter un sur le 706 ou le 44571 est une erreur de tenue que les
        // outils de contrôle relèvent.
        CompAuxNum: posting.collective ? auxNum(invoice.clientId) : '',
        CompAuxLib: posting.collective ? clientLabel : '',
        PieceRef: ecritureNum,
        PieceDate: date,
        EcritureLib: fecText(posting.label),
        Debit: debit ? fecAmount(amount) : '0,00',
        Credit: debit ? '0,00' : fecAmount(amount),
        // Lettrage : non tenu par l'application. Les colonnes existent et
        // restent vides, ce que le format autorise — les remplir au hasard
        // serait pire.
        EcritureLet: '',
        DateLet: '',
        ValidDate: validDate,
        Montantdevise: '',
        Idevise: '',
      });
      if (debit) totalDebitCents += amount;
      else totalCreditCents += amount;
    }
  }

  /* ------------------------------ Ce qui manque ---------------------------- */

  const plural = (n: number, singular: string, pluralForm: string) => (n > 1 ? pluralForm : singular);

  if (drafts > 0) {
    warnings.push(
      `${drafts} ${plural(drafts, 'brouillon non inclus', 'brouillons non inclus')} : sans numéro ni date d'émission, ce ne sont pas des pièces comptables.`,
    );
  }
  if (cancelled > 0) {
    warnings.push(
      `${cancelled} ${plural(cancelled, 'facture annulée non incluse', 'factures annulées non incluses')} : une annulation se comptabilise par un avoir, que cette application ne sait pas encore émettre. À signaler à votre comptable.`,
    );
  }
  if (noNumber > 0) {
    warnings.push(
      `${noNumber} ${plural(noNumber, 'facture émise sans numéro a été écartée', 'factures émises sans numéro ont été écartées')} : une pièce comptable sans numéro ne peut pas être référencée.`,
    );
  }
  if (badDates > 0) {
    warnings.push(
      `${badDates} ${plural(badDates, 'facture a une date d’émission inexploitable', 'factures ont une date d’émission inexploitable')} et ${plural(badDates, 'a été écartée', 'ont été écartées')}. Corrigez-la avant de remettre le fichier.`,
    );
  }
  if (empty > 0) {
    warnings.push(
      `${empty} ${plural(empty, 'facture sans aucune ligne a été écartée', 'factures sans aucune ligne ont été écartées')} : il n'y a rien à comptabiliser.`,
    );
  }
  if (anonymousClient > 0) {
    warnings.push(
      `${anonymousClient} ${plural(anonymousClient, 'écriture porte le compte auxiliaire C000000', 'écritures portent le compte auxiliaire C000000')} : la facture n'est rattachée à aucune fiche client.`,
    );
  }
  if (duplicates.size > 0) {
    warnings.push(
      `Numéro de facture en double : ${[...duplicates].join(', ')}. La numérotation doit être unique et continue — à corriger avant tout contrôle.`,
    );
  }
  warnings.push(
    "Ce fichier contient le journal des ventes. Les encaissements (journal de banque) n'y figurent pas : l'application ne tient aucun compte bancaire.",
  );

  return { lines, warnings, totalDebitCents, totalCreditCents, invoiceCount: eligible.length };
}

/* --------------------------------- Le fichier ------------------------------ */

/**
 * Sérialise en fichier FEC : en-tête puis lignes, séparateur tabulation.
 *
 * Les fins de ligne sont en `\r\n` : c'est ce qu'attendent les outils de
 * contrôle de l'administration, et un fichier en `\n` seul se fait rejeter sur
 * un détail qui n'a rien à voir avec la comptabilité.
 */
export function toFecFile(lines: FecLine[]): string {
  const rows = [FEC_COLUMNS.join('\t')];
  for (const line of lines) {
    rows.push(FEC_COLUMNS.map((column) => line[column] ?? '').join('\t'));
  }
  return `${rows.join('\r\n')}\r\n`;
}

/**
 * Le nom de fichier normalisé : `<SIREN>FEC<AAAAMMJJ>.txt`.
 *
 * Le SIREN est constitué des neuf premiers chiffres du SIRET. Sans SIRET
 * renseigné on retombe sur un nom explicite plutôt que sur un faux numéro :
 * un identifiant inventé dans un nom de fichier fiscal est exactement le genre
 * de détail qui fait mal commencer un contrôle.
 */
export function fecFileName(siret: string, closingDay: string): string {
  const digits = String(siret ?? '').replace(/\D/g, '');
  const siren = digits.length >= 9 ? digits.slice(0, 9) : '';
  const day = isValidDay(closingDay) ? fecDate(closingDay) : fecDate(`${new Date().getFullYear()}-12-31`);
  return siren ? `${siren}FEC${day}.txt` : `FEC${day}-SIRET-A-RENSEIGNER.txt`;
}

/** Le 31 décembre de l'exercice — date de clôture par défaut, celle du nom de fichier. */
export function closingDay(year: number): string {
  return `${year}-12-31`;
}
