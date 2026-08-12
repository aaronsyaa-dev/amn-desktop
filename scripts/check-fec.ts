/**
 * Contrôle de l'export FEC.
 *
 * Même raison d'être que `check:money` : ce fichier-là ne se relit pas à l'œil.
 * Un FEC se donne à l'administration fiscale, qui le passe dans un outil de
 * contrôle automatique — et cet outil ne dit pas « attention », il rejette. Un
 * en-tête à dix-sept colonnes, une date en `11/08/2026`, un débit négatif, une
 * tabulation cachée dans une raison sociale : chacun de ces détails suffit, et
 * aucun ne se voit en ouvrant le fichier.
 *
 *   npm run check:fec
 *
 * Le module est chargé tel qu'il sera livré : `esbuild` le résout exactement
 * comme le bundler de l'application, dépendances comprises (`src/lib/money.ts`
 * en particulier, dont l'arithmétique en centimes est ce qui rend l'équilibre
 * de la partie double EXACT et non « exact à l'arrondi près »). On contrôle
 * donc le vrai code, pas une copie réécrite pour l'occasion.
 */

import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * Charge un module de `src/` en le faisant résoudre par esbuild.
 *
 * `src/lib/fec.ts` importe `./money` sans extension, comme tout le code de
 * l'application : c'est ce que veut le bundler et ce que refuse le retrait de
 * types de Node. Plutôt que d'assouplir les imports de `src/` pour le confort
 * d'un script de contrôle — ce qui reviendrait à modifier le code livré pour
 * pouvoir le tester —, on lui applique le même résolveur qu'à la compilation.
 */
async function loadFromSrc(entry: string): Promise<Record<string, any>> {
  const built = await esbuild.build({
    entryPoints: [path.join(here, '..', entry)],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'neutral',
    target: 'node22',
    charset: 'utf8',
  });
  const code = built.outputFiles[0].text;
  return import(`data:text/javascript;charset=utf-8;base64,${Buffer.from(code, 'utf8').toString('base64')}`);
}

const fec = await loadFromSrc('src/lib/fec.ts');
const {
  ACCOUNTS,
  FEC_COLUMNS,
  asciiPunctuation,
  buildFec,
  closingDay,
  fecAmount,
  fecDate,
  fecFileName,
  fecText,
  isValidDay,
  toFecFile,
} = fec;

const failures: string[] = [];

function check(name: string, run: () => void) {
  try {
    run();
    console.log(`  ok   ${name}`);
  } catch (err) {
    failures.push(name);
    console.error(`  ÉCHEC ${name}`);
    console.error(`         ${err instanceof Error ? err.message.split('\n')[0] : String(err)}`);
  }
}

/* ------------------------------- Les fixtures ------------------------------ */

let lineSeq = 0;
function line(quantity: number, unitPriceCents: number, vatRate: number) {
  lineSeq += 1;
  return { id: `l${lineSeq}`, label: `Prestation ${lineSeq}`, quantity, unitPriceCents, vatRate };
}

interface InvoiceOverrides {
  number?: string;
  clientId?: number;
  issuedAt?: string;
  status?: string;
  company?: string;
  lines?: ReturnType<typeof line>[];
}

function invoice(overrides: InvoiceOverrides = {}): any {
  return {
    id: `inv-${overrides.number ?? Math.random().toString(36).slice(2)}`,
    number: overrides.number ?? 'F2026-0001',
    clientId: overrides.clientId ?? 7,
    billTo: {
      name: 'Marie Durand',
      company: overrides.company ?? 'Durand Conseil',
      email: 'marie@durand.test',
      address: '12 rue des Lilas, 75011 Paris',
      vatNumber: '',
    },
    issuedAt: overrides.issuedAt ?? '2026-03-14',
    dueAt: '2026-04-13',
    lines: overrides.lines ?? [line(1, 100000, 20)],
    status: overrides.status ?? 'issued',
    paidAt: '',
    paymentMethod: '',
    cancelReason: '',
    notes: '',
    quoteId: null,
    createdAt: '2026-03-14T09:00:00.000Z',
    updatedAt: '2026-03-14T09:00:00.000Z',
  };
}

/** Les lignes d'une écriture donnée, dans l'ordre où elles ont été écrites. */
function entryOf(result: any, number: string) {
  return result.lines.filter((l: any) => l.EcritureNum === number);
}

function centsOf(text: string): number {
  const [whole, frac] = text.split(',');
  return Number(whole) * 100 + Number(frac);
}

/* -------------------------------- Les formats ------------------------------ */

check('fecDate produit AAAAMMJJ', () => {
  assert.equal(fecDate('2026-03-14'), '20260314');
  assert.equal(fecDate('2026-03-14T09:00:00.000Z'), '20260314');
  assert.equal(fecDate(''), '');
});

check('fecAmount : virgule décimale, deux décimales, jamais de signe', () => {
  assert.equal(fecAmount(0), '0,00');
  assert.equal(fecAmount(5), '0,05');
  assert.equal(fecAmount(50), '0,50');
  assert.equal(fecAmount(100), '1,00');
  assert.equal(fecAmount(123456), '1234,56');
  assert.equal(fecAmount(12345678), '123456,78');
  // Un débit négatif fait rejeter le fichier : le signe s'exprime par la
  // colonne, jamais par un moins.
  assert.equal(fecAmount(-123456), '1234,56');
  assert.equal(fecAmount(Number.NaN), '0,00');
});

check('isValidDay refuse les jours qui n’existent pas', () => {
  assert.equal(isValidDay('2026-03-14'), true);
  assert.equal(isValidDay('2024-02-29'), true, 'année bissextile');
  assert.equal(isValidDay('2025-02-29'), false, 'année non bissextile');
  assert.equal(isValidDay('2026-02-30'), false);
  assert.equal(isValidDay('2026-13-01'), false);
  assert.equal(isValidDay('2026-00-10'), false);
  assert.equal(isValidDay('2026-3-14'), false, 'mois non paddé');
  assert.equal(isValidDay(''), false);
  assert.equal(isValidDay('n’importe quoi'), false);
});

check('asciiPunctuation rend le texte transcodable en ISO 8859-15', () => {
  assert.equal(asciiPunctuation('Durand — Conseil'), 'Durand - Conseil');
  assert.equal(asciiPunctuation('L’Atelier'), "L'Atelier");
  assert.equal(asciiPunctuation('« Studio »'), '" Studio "');
  assert.equal(asciiPunctuation('et…'), 'et...');
  assert.equal(asciiPunctuation('1 000 €'), '1 000 €', 'espace insécable ramenée à une espace');
  // Les accents, eux, restent : ISO 8859-15 les porte, et les retirer
  // écrirait « Societe Generale » sur une pièce comptable.
  assert.equal(asciiPunctuation('Société Générale'), 'Société Générale');
});

check('fecText neutralise ce qui décalerait les colonnes', () => {
  assert.equal(fecText('Durand\tConseil'), 'Durand Conseil');
  assert.equal(fecText('Durand\r\nConseil'), 'Durand Conseil');
  assert.equal(fecText('  Durand   Conseil  '), 'Durand Conseil');
  assert.equal(fecText('x'.repeat(200)).length, 100, 'tronqué à la longueur demandée');
  assert.equal(fecText('x'.repeat(200), 20).length, 20);
  assert.equal(fecText(undefined as any), '');
});

/* ------------------------------ La forme du fichier ------------------------ */

check('l’en-tête est exactement les dix-huit colonnes de l’article A47 A-1', () => {
  const expected = [
    'JournalCode', 'JournalLib', 'EcritureNum', 'EcritureDate', 'CompteNum', 'CompteLib',
    'CompAuxNum', 'CompAuxLib', 'PieceRef', 'PieceDate', 'EcritureLib', 'Debit', 'Credit',
    'EcritureLet', 'DateLet', 'ValidDate', 'Montantdevise', 'Idevise',
  ];
  assert.deepEqual([...FEC_COLUMNS], expected);
  const file = toFecFile(buildFec([invoice()]).lines);
  assert.equal(file.split('\r\n')[0], expected.join('\t'));
});

check('toutes les lignes ont dix-huit champs, fins de ligne comprises', () => {
  const result = buildFec([
    invoice({ number: 'F2026-0001', lines: [line(1, 100000, 20), line(2, 5000, 5.5)] }),
    invoice({ number: 'F2026-0002', company: 'Studio\tBoréal\nSAS' }),
  ]);
  const file = toFecFile(result.lines);
  assert.ok(file.endsWith('\r\n'), 'le fichier se termine par une fin de ligne');
  assert.ok(!/(?<!\r)\n/.test(file), 'aucun \\n isolé : tout est en \\r\\n');
  const rows = file.slice(0, -2).split('\r\n');
  assert.equal(rows.length, result.lines.length + 1, 'en-tête + une ligne par écriture-ligne');
  for (const [i, row] of rows.entries()) {
    assert.equal(row.split('\t').length, 18, `ligne ${i} : dix-huit champs`);
  }
});

check('un nom de société hostile n’injecte ni colonne ni ligne', () => {
  // Une raison sociale collée depuis un tableur peut contenir n'importe quoi.
  const nasty = 'Studio\tBoréal\r\n\t20260101\t411000';
  const file = toFecFile(buildFec([invoice({ company: nasty })]).lines);
  const rows = file.slice(0, -2).split('\r\n');
  assert.equal(rows.length, 4, 'en-tête + trois lignes, pas une de plus');
  for (const row of rows) assert.equal(row.split('\t').length, 18);
});

check('le fichier ne contient aucune ponctuation typographique', () => {
  const file = toFecFile(buildFec([invoice({ company: 'L’Atelier — « Design »…' })]).lines);
  for (const forbidden of ['—', '–', '’', '«', '»', '…', ' ']) {
    assert.ok(!file.includes(forbidden), `caractère ${escape(forbidden)} présent`);
  }
});

/* --------------------------- La partie double ------------------------------ */

check('cas connu : 1 000,00 € HT à 20 %', () => {
  const result = buildFec([invoice({ number: 'F2026-0001', lines: [line(1, 100000, 20)] })]);
  assert.equal(result.invoiceCount, 1);
  const entry = entryOf(result, 'F2026-0001');
  assert.equal(entry.length, 3);

  assert.equal(entry[0].CompteNum, ACCOUNTS.clients.num);
  assert.equal(entry[0].Debit, '1200,00');
  assert.equal(entry[0].Credit, '0,00');

  assert.equal(entry[1].CompteNum, ACCOUNTS.sales.num);
  assert.equal(entry[1].Credit, '1000,00');
  assert.equal(entry[1].Debit, '0,00');

  assert.equal(entry[2].CompteNum, ACCOUNTS.vat.num);
  assert.equal(entry[2].Credit, '200,00');

  assert.equal(result.totalDebitCents, 120000);
  assert.equal(result.totalCreditCents, 120000);
});

check('cas connu : arrondi d’une quantité décimale (2,5 × 33,33 €)', () => {
  // 2,5 × 33,33 = 83,325 → 83,33 ; TVA 20 % = 16,666 → 16,67 ; TTC = 100,00.
  const result = buildFec([invoice({ number: 'F2026-0009', lines: [line(2.5, 3333, 20)] })]);
  const entry = entryOf(result, 'F2026-0009');
  assert.equal(entry[0].Debit, '100,00');
  assert.equal(entry[1].Credit, '83,33');
  assert.equal(entry[2].Credit, '16,67');
  assert.equal(result.totalDebitCents, result.totalCreditCents);
});

check('plusieurs taux : une ventilation par taux, triée, sans ligne de TVA à zéro', () => {
  const result = buildFec([
    invoice({
      number: 'F2026-0002',
      lines: [line(1, 100000, 20), line(1, 20000, 5.5), line(1, 5000, 0), line(1, 50000, 20)],
    }),
  ]);
  const entry = entryOf(result, 'F2026-0002');
  const sales = entry.filter((l: any) => l.CompteNum === ACCOUNTS.sales.num);
  const vat = entry.filter((l: any) => l.CompteNum === ACCOUNTS.vat.num);

  assert.equal(sales.length, 3, 'trois taux utilisés → trois lignes de produits');
  assert.equal(vat.length, 2, 'le taux à 0 % ne produit pas de ligne de taxe');

  // Triées par taux croissant : 0, 5,5 puis 20.
  assert.ok(sales[0].EcritureLib.includes('HT 0 %'));
  assert.ok(sales[1].EcritureLib.includes('HT 5,5 %'));
  assert.ok(sales[2].EcritureLib.includes('HT 20 %'));
  assert.equal(sales[2].Credit, '1500,00', 'les deux lignes à 20 % sont agrégées');

  // 1 500 × 20 % = 300 ; 200 × 5,5 % = 11 ; TTC = 1750 + 311 = 2061.
  assert.equal(entry[0].Debit, '2061,00');
  assert.equal(result.totalDebitCents, 206100);
  assert.equal(result.totalCreditCents, 206100);
});

check('avoir : un montant négatif change de colonne, il ne devient pas un débit négatif', () => {
  const result = buildFec([invoice({ number: 'A2026-0001', lines: [line(1, -100000, 20)] })]);
  const entry = entryOf(result, 'A2026-0001');

  assert.equal(entry[0].CompteNum, ACCOUNTS.clients.num);
  assert.equal(entry[0].Debit, '0,00');
  assert.equal(entry[0].Credit, '1200,00', 'le client est crédité');

  assert.equal(entry[1].CompteNum, ACCOUNTS.sales.num);
  assert.equal(entry[1].Debit, '1000,00', 'le produit est débité');
  assert.equal(entry[1].Credit, '0,00');

  assert.equal(entry[2].Debit, '200,00', 'la TVA aussi');
  assert.equal(result.totalDebitCents, result.totalCreditCents);

  const file = toFecFile(result.lines);
  const amounts = file.split('\r\n').slice(1).filter(Boolean).flatMap((r) => [r.split('\t')[11], r.split('\t')[12]]);
  assert.ok(amounts.every((a) => !a.includes('-')), 'aucun montant signé dans le fichier');
});

check('l’équilibre tient écriture par écriture, sur un lot varié', () => {
  const result = buildFec([
    invoice({ number: 'F2026-0001', issuedAt: '2026-01-05', lines: [line(3, 33333, 20)] }),
    invoice({ number: 'F2026-0002', issuedAt: '2026-02-11', lines: [line(1, 1, 5.5), line(7, 999, 2.1)] }),
    invoice({ number: 'F2026-0003', issuedAt: '2026-03-01', lines: [line(1, 0, 20)] }),
    invoice({ number: 'F2026-0004', issuedAt: '2026-04-02', status: 'paid', lines: [line(1.5, 45678, 10), line(1, -5000, 10)] }),
    invoice({ number: 'A2026-0001', issuedAt: '2026-05-09', lines: [line(2, -12345, 20), line(1, -678, 5.5)] }),
  ]);
  assert.equal(result.invoiceCount, 5);

  const byEntry = new Map<string, { d: number; c: number }>();
  for (const l of result.lines) {
    const acc = byEntry.get(l.EcritureNum) ?? { d: 0, c: 0 };
    acc.d += centsOf(l.Debit);
    acc.c += centsOf(l.Credit);
    byEntry.set(l.EcritureNum, acc);
  }
  assert.equal(byEntry.size, 5);
  for (const [num, { d, c }] of byEntry) {
    assert.equal(d, c, `écriture ${num} déséquilibrée : ${d} ≠ ${c}`);
  }

  const totalD = [...byEntry.values()].reduce((s, x) => s + x.d, 0);
  const totalC = [...byEntry.values()].reduce((s, x) => s + x.c, 0);
  assert.equal(totalD, totalC, 'fichier déséquilibré');
  assert.equal(totalD, result.totalDebitCents, 'le total annoncé est celui du fichier');
  assert.equal(totalC, result.totalCreditCents);
});

/* ---------------------------- Les comptes auxiliaires ---------------------- */

check('le compte auxiliaire ne figure QUE sur le compte collectif', () => {
  const result = buildFec([invoice({ number: 'F2026-0001', clientId: 42, company: 'Durand Conseil' })]);
  for (const l of result.lines) {
    if (l.CompteNum === ACCOUNTS.clients.num) {
      assert.equal(l.CompAuxNum, 'C000042');
      assert.equal(l.CompAuxLib, 'Durand Conseil');
    } else {
      assert.equal(l.CompAuxNum, '', `${l.CompteNum} ne doit pas porter d’auxiliaire`);
      assert.equal(l.CompAuxLib, '');
    }
  }
});

check('une facture sans fiche client est signalée, pas maquillée', () => {
  const result = buildFec([invoice({ number: 'F2026-0001', clientId: 0 })]);
  const client = result.lines.find((l: any) => l.CompteNum === ACCOUNTS.clients.num);
  assert.equal(client.CompAuxNum, 'C000000');
  assert.ok(
    result.warnings.some((w: string) => w.includes('C000000')),
    'l’export le dit',
  );
});

/* ------------------------------ Ce qui est écarté -------------------------- */

check('brouillons et annulées sont écartés, et comptés dans les avertissements', () => {
  const result = buildFec([
    invoice({ number: 'F2026-0001' }),
    invoice({ number: '', status: 'draft' }),
    invoice({ number: '', status: 'draft' }),
    invoice({ number: 'F2026-0003', status: 'cancelled' }),
  ]);
  assert.equal(result.invoiceCount, 1);
  assert.equal(new Set(result.lines.map((l: any) => l.EcritureNum)).size, 1);
  assert.ok(result.warnings.some((w: string) => w.startsWith('2 brouillons')));
  assert.ok(result.warnings.some((w: string) => w.startsWith('1 facture annulée')));
});

check('une émise sans numéro ou à date invalide est écartée et signalée', () => {
  const result = buildFec([
    invoice({ number: 'F2026-0001' }),
    invoice({ number: '', status: 'issued' }),
    invoice({ number: 'F2026-0007', issuedAt: '2026-02-30' }),
    invoice({ number: 'F2026-0008', issuedAt: '' }),
  ]);
  assert.equal(result.invoiceCount, 1);
  assert.ok(result.warnings.some((w: string) => w.includes('sans numéro')));
  assert.ok(result.warnings.some((w: string) => w.includes('inexploitable')));
});

check('une facture sans aucune ligne est écartée plutôt qu’écrite à zéro', () => {
  const result = buildFec([invoice({ number: 'F2026-0001', lines: [] })]);
  assert.equal(result.invoiceCount, 0);
  assert.equal(result.lines.length, 0, 'pas d’écriture orpheline à une seule ligne');
  assert.ok(result.warnings.some((w: string) => w.includes('sans aucune ligne')));
});

check('un numéro en double est nommé dans les avertissements', () => {
  const result = buildFec([
    invoice({ number: 'F2026-0001', issuedAt: '2026-01-05' }),
    invoice({ number: 'F2026-0001', issuedAt: '2026-02-05' }),
  ]);
  assert.ok(
    result.warnings.some((w: string) => w.includes('double') && w.includes('F2026-0001')),
    'le numéro fautif est cité',
  );
});

check('le manque du journal de banque est toujours annoncé', () => {
  for (const input of [[], [invoice()]]) {
    const result = buildFec(input as any);
    assert.ok(
      result.warnings.some((w: string) => w.includes('encaissements')),
      'même sur un export vide',
    );
  }
});

check('un export sans facture éligible ne produit qu’un en-tête', () => {
  const result = buildFec([]);
  assert.equal(result.lines.length, 0);
  assert.equal(result.totalDebitCents, 0);
  const file = toFecFile(result.lines);
  assert.equal(file, `${FEC_COLUMNS.join('\t')}\r\n`);
});

/* -------------------------------- L'exercice ------------------------------- */

check('le filtre d’exercice retient l’année d’émission, et rien d’autre', () => {
  const list = [
    invoice({ number: 'F2025-0100', issuedAt: '2025-12-31' }),
    invoice({ number: 'F2026-0001', issuedAt: '2026-01-01' }),
    invoice({ number: 'F2026-0002', issuedAt: '2026-12-31' }),
    invoice({ number: 'F2027-0001', issuedAt: '2027-01-01' }),
  ];
  const result = buildFec(list, { year: 2026 });
  assert.equal(result.invoiceCount, 2);
  assert.deepEqual(
    [...new Set(result.lines.map((l: any) => l.EcritureNum))],
    ['F2026-0001', 'F2026-0002'],
  );
  // `startsWith('2026')` seul laisserait passer un `20260-…` improbable mais
  // surtout ne dirait rien de la frontière : on vérifie les deux bords.
  assert.equal(buildFec(list, { year: 2025 }).invoiceCount, 1);
  assert.equal(buildFec(list).invoiceCount, 4, 'sans année, tout l’historique');
});

check('les écritures sortent triées par date puis par numéro', () => {
  const result = buildFec([
    invoice({ number: 'F2026-0003', issuedAt: '2026-03-01' }),
    invoice({ number: 'F2026-0001', issuedAt: '2026-01-15' }),
    invoice({ number: 'F2026-0002b', issuedAt: '2026-03-01' }),
    invoice({ number: 'F2026-0002a', issuedAt: '2026-03-01' }),
  ]);
  assert.deepEqual(
    [...new Set(result.lines.map((l: any) => l.EcritureNum))],
    ['F2026-0001', 'F2026-0002a', 'F2026-0002b', 'F2026-0003'],
  );
});

check('PieceDate, EcritureDate et ValidDate sont cohérentes', () => {
  const result = buildFec([invoice({ number: 'F2026-0001', issuedAt: '2026-03-14' })]);
  for (const l of result.lines) {
    assert.equal(l.EcritureDate, '20260314');
    assert.equal(l.PieceDate, '20260314');
    assert.equal(l.ValidDate, '20260314', 'validée à l’émission — le moment où elle se fige');
    assert.equal(l.PieceRef, 'F2026-0001');
  }
  // Une date de validation fournie mais aberrante ne doit pas s'écrire telle
  // quelle dans le fichier.
  const forced = buildFec([invoice({ number: 'F2026-0001' })], { validDate: 'pas une date' });
  assert.equal(forced.lines[0].ValidDate, '20260314', 'repli sur l’émission');
  const ok = buildFec([invoice({ number: 'F2026-0001' })], { validDate: '2026-12-31' });
  assert.equal(ok.lines[0].ValidDate, '20261231');
});

check('les colonnes non tenues restent vides plutôt que remplies au hasard', () => {
  const result = buildFec([invoice()]);
  for (const l of result.lines) {
    assert.equal(l.EcritureLet, '');
    assert.equal(l.DateLet, '');
    assert.equal(l.Montantdevise, '');
    assert.equal(l.Idevise, '');
    assert.equal(l.JournalCode, 'VE');
  }
});

/* ------------------------------- Le nom de fichier ------------------------- */

check('fecFileName suit <SIREN>FEC<AAAAMMJJ>.txt', () => {
  assert.equal(fecFileName('81234567800019', '2026-12-31'), '812345678FEC20261231.txt');
  assert.equal(fecFileName('812 345 678 00019', '2026-12-31'), '812345678FEC20261231.txt');
  assert.equal(fecFileName('812345678', '2026-12-31'), '812345678FEC20261231.txt', 'SIREN seul');
  // Pas de numéro inventé : le nom dit ce qui manque.
  assert.equal(fecFileName('', '2026-12-31'), 'FEC20261231-SIRET-A-RENSEIGNER.txt');
  assert.equal(fecFileName('12345', '2026-12-31'), 'FEC20261231-SIRET-A-RENSEIGNER.txt');
  assert.ok(fecFileName('81234567800019', 'n’importe quoi').endsWith('.txt'));
  assert.equal(closingDay(2026), '2026-12-31');
});

/* --------------------------------------------------------------------------- */

if (failures.length > 0) {
  console.error(`\n${failures.length} contrôle(s) en échec :`);
  for (const name of failures) console.error(`  - ${name}`);
  process.exit(1);
}
console.log('\nExport FEC : tous les contrôles passent.');
