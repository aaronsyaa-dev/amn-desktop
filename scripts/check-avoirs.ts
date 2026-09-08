/**
 * Contrôle des AVOIRS ET DE LA DETTE NETTE — facturation avancée, Bloc 3.
 *
 * `src/lib/fec.ts` documentait depuis son écriture une limite honnête : « une
 * annulation se comptabilise par un avoir, que cette application ne sait pas
 * encore émettre ». Ce chantier comble ce manque : un avoir est une facture
 * comme une autre (`kind: 'creditNote'`), avec sa propre séquence de
 * numérotation légale (`AV-AAAA-NNNN`, jamais mélangée à celle des factures),
 * et il réduit ce qui reste réellement dû sur la facture qu'il vise.
 *
 * Ce contrôle porte sur les fonctions PURES de `src/state/useInvoices.ts` —
 * celles qu'on peut exercer sans React ni synchronisation : la numérotation,
 * le calcul de la dette nette, et le retard qui doit s'éteindre quand un
 * avoir a tout compensé.
 *
 *   npm run check:avoirs
 */

import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const here = path.dirname(fileURLToPath(import.meta.url));

async function loadFromSrc<T>(entry: string): Promise<T> {
  const built = await esbuild.build({
    entryPoints: [path.join(here, '..', entry)],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'neutral',
    target: 'node22',
    charset: 'utf8',
    // `useInvoices.ts` importe `./SyncContext` (React) pour le hook lui-même,
    // mais les fonctions contrôlées ici (nextNumber, netDueCents, isOverdue,
    // creditNotesFor, creditedCents) n'en dépendent pas : une coquille vide
    // suffit à satisfaire l'import sans installer React ni JSDOM pour ce test.
    plugins: [
      {
        name: 'stub-sync-context',
        setup(build) {
          build.onResolve({ filter: /^\.\/SyncContext$/ }, (args) => ({ path: args.path, namespace: 'stub-sync' }));
          build.onLoad({ filter: /.*/, namespace: 'stub-sync' }, () => ({
            contents: `
              export function useSync() { throw new Error('non simulé dans ce contrôle'); }
              export function useCollection() { throw new Error('non simulé dans ce contrôle'); }
              export function uid(p) { return p + '-test'; }
              export function stripMeta(x) { return x; }
            `,
            loader: 'js',
          }));
        },
      },
    ],
  });
  return (await import(
    `data:text/javascript;charset=utf-8;base64,${Buffer.from(built.outputFiles[0].text, 'utf8').toString('base64')}`
  )) as T;
}

interface Invoice {
  id: string;
  number: string;
  clientId: number;
  billTo: { name: string; company: string; email: string; address: string; vatNumber: string };
  issuedAt: string;
  dueAt: string;
  lines: { id: string; label: string; quantity: number; unitPriceCents: number; vatRate: number }[];
  status: 'draft' | 'issued' | 'paid' | 'cancelled';
  paidAt: string;
  paymentMethod: string;
  cancelReason: string;
  notes: string;
  quoteId: number | null;
  kind?: 'invoice' | 'creditNote';
  creditNoteFor?: string;
  createdAt: string;
  updatedAt: string;
}

const { nextNumber, netDueCents, isOverdue, creditNotesFor, creditedCents, invoiceTotals } = await loadFromSrc<{
  nextNumber: (existing: Invoice[], year?: number, kind?: 'invoice' | 'creditNote') => string;
  netDueCents: (invoice: Invoice, invoices: Invoice[]) => number;
  isOverdue: (invoice: Invoice, today?: string, invoices?: Invoice[]) => boolean;
  creditNotesFor: (invoiceId: string, invoices: Invoice[]) => Invoice[];
  creditedCents: (invoiceId: string, invoices: Invoice[]) => number;
  invoiceTotals: (invoice: Invoice) => { grossCents: number };
}>('src/state/useInvoices.ts');

let vus = 0;
const dit = (nom: string, fn: () => void) => {
  fn();
  vus += 1;
  console.log(`  ✓ ${nom}`);
};

function facture(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: overrides.id ?? 'inv-1',
    number: overrides.number ?? '2026-0001',
    clientId: 7,
    billTo: { name: 'Marie Durand', company: 'Durand Conseil', email: '', address: '', vatNumber: '' },
    issuedAt: overrides.issuedAt ?? '2026-03-01',
    dueAt: overrides.dueAt ?? '2026-04-01',
    lines: overrides.lines ?? [{ id: 'l1', label: 'Prestation', quantity: 1, unitPriceCents: 100000, vatRate: 20 }],
    status: overrides.status ?? 'issued',
    paidAt: '',
    paymentMethod: '',
    cancelReason: '',
    notes: '',
    quoteId: null,
    kind: overrides.kind,
    creditNoteFor: overrides.creditNoteFor,
    createdAt: '2026-03-01T09:00:00.000Z',
    updatedAt: '2026-03-01T09:00:00.000Z',
    ...overrides,
  };
}

/* ─── Numérotation : deux séquences, jamais mélangées ────────────────────── */

dit('une facture et un avoir ne partagent pas la même séquence', () => {
  const existing = [facture({ number: '2026-0001' }), facture({ number: '2026-0002' })];
  assert.equal(nextNumber(existing, 2026, 'invoice'), '2026-0003');
  assert.equal(nextNumber(existing, 2026, 'creditNote'), 'AV-2026-0001', 'aucun avoir encore émis : on repart à 1');
});

dit('la séquence des avoirs progresse indépendamment de celle des factures', () => {
  const existing = [
    facture({ number: '2026-0001' }),
    facture({ number: 'AV-2026-0001', kind: 'creditNote' }),
    facture({ number: 'AV-2026-0002', kind: 'creditNote' }),
  ];
  assert.equal(nextNumber(existing, 2026, 'creditNote'), 'AV-2026-0003');
  assert.equal(nextNumber(existing, 2026, 'invoice'), '2026-0002', 'les avoirs ne consomment aucun numéro de facture');
});

dit('le défaut (sans kind) reste le comportement d’avant ce chantier : la séquence facture', () => {
  const existing = [facture({ number: '2026-0007' })];
  assert.equal(nextNumber(existing, 2026), '2026-0008');
});

/* ─── LE CŒUR DU CORRECTIF : la dette nette après avoir ──────────────────── */

dit('sans avoir, la dette nette est le montant brut de la facture', () => {
  const f = facture({ id: 'inv-A' });
  assert.equal(netDueCents(f, [f]), invoiceTotals(f).grossCents);
});

dit('LE CAS CENTRAL : un avoir total ramène la dette nette à zéro', () => {
  const f = facture({ id: 'inv-A', number: '2026-0010' });
  const avoir = facture({
    id: 'av-A',
    number: 'AV-2026-0001',
    kind: 'creditNote',
    creditNoteFor: 'inv-A',
    lines: f.lines,
  });
  assert.equal(netDueCents(f, [f, avoir]), 0);
});

dit('un avoir PARTIEL réduit la dette nette d’exactement son propre montant', () => {
  const f = facture({ id: 'inv-B', lines: [{ id: 'l1', label: 'Mission', quantity: 1, unitPriceCents: 100000, vatRate: 20 }] });
  const avoirPartiel = facture({
    id: 'av-B',
    number: 'AV-2026-0002',
    kind: 'creditNote',
    creditNoteFor: 'inv-B',
    lines: [{ id: 'l1', label: 'Remise commerciale', quantity: 1, unitPriceCents: 20000, vatRate: 20 }],
  });
  const totalF = invoiceTotals(f).grossCents;
  const totalAv = invoiceTotals(avoirPartiel).grossCents;
  assert.equal(netDueCents(f, [f, avoirPartiel]), totalF - totalAv);
});

dit('un avoir EN BROUILLON ne réduit rien : seul un avoir ÉMIS engage quelque chose', () => {
  const f = facture({ id: 'inv-C' });
  const brouillon = facture({ id: 'av-C', number: '', status: 'draft', kind: 'creditNote', creditNoteFor: 'inv-C', lines: f.lines });
  assert.equal(netDueCents(f, [f, brouillon]), invoiceTotals(f).grossCents);
  assert.deepEqual(creditNotesFor('inv-C', [f, brouillon]), []);
});

dit('un avoir ne peut pas rendre une facture « créditrice » : la dette nette ne descend jamais sous zéro', () => {
  const f = facture({ id: 'inv-D', lines: [{ id: 'l1', label: 'Petit forfait', quantity: 1, unitPriceCents: 10000, vatRate: 20 }] });
  const avoirTropGrand = facture({
    id: 'av-D',
    number: 'AV-2026-0003',
    kind: 'creditNote',
    creditNoteFor: 'inv-D',
    lines: [{ id: 'l1', label: 'Erreur de saisie', quantity: 1, unitPriceCents: 999999, vatRate: 20 }],
  });
  assert.equal(netDueCents(f, [f, avoirTropGrand]), 0);
});

dit('un avoir n’est lui-même jamais « dû » — même s’il porte des lignes', () => {
  const avoir = facture({ id: 'av-E', kind: 'creditNote', creditNoteFor: 'inv-E' });
  assert.equal(netDueCents(avoir, [avoir]), 0);
});

dit('creditedCents additionne plusieurs avoirs émis sur la même facture', () => {
  const f = facture({ id: 'inv-F', lines: [{ id: 'l1', label: 'Forfait annuel', quantity: 1, unitPriceCents: 240000, vatRate: 20 }] });
  const av1 = facture({ id: 'av-F1', number: 'AV-2026-0004', kind: 'creditNote', creditNoteFor: 'inv-F', lines: [{ id: 'l1', label: 'Mois 1', quantity: 1, unitPriceCents: 20000, vatRate: 20 }] });
  const av2 = facture({ id: 'av-F2', number: 'AV-2026-0005', kind: 'creditNote', creditNoteFor: 'inv-F', lines: [{ id: 'l1', label: 'Mois 2', quantity: 1, unitPriceCents: 20000, vatRate: 20 }] });
  assert.equal(creditedCents('inv-F', [f, av1, av2]), invoiceTotals(av1).grossCents + invoiceTotals(av2).grossCents);
});

/* ─── Le retard s'éteint quand la dette nette s'éteint ───────────────────── */

dit('LE CAS CENTRAL : une facture en retard mais totalement compensée par un avoir n’est plus « en retard »', () => {
  const f = facture({ id: 'inv-G', number: '2026-0020', dueAt: '2026-01-01' }); // largement échue
  const avoir = facture({ id: 'av-G', number: 'AV-2026-0006', kind: 'creditNote', creditNoteFor: 'inv-G', lines: f.lines });
  assert.equal(isOverdue(f, '2026-06-01'), true, 'sans regarder les avoirs, elle est bien en retard');
  assert.equal(isOverdue(f, '2026-06-01', [f, avoir]), false, 'en tenant compte de l’avoir, elle ne l’est plus');
});

dit('LE BOGUE TROUVÉ EN CAPTURE D’ÉCRAN : un avoir lui-même n’est jamais « en retard », même avec une échéance passée', () => {
  const avoir = facture({ id: 'av-I', kind: 'creditNote', creditNoteFor: 'inv-I', dueAt: '2026-01-01', status: 'issued' });
  assert.equal(isOverdue(avoir, '2026-06-01'), false);
});

dit('une facture en retard partiellement compensée reste en retard', () => {
  const f = facture({ id: 'inv-H', number: '2026-0021', dueAt: '2026-01-01', lines: [{ id: 'l1', label: 'Mission', quantity: 1, unitPriceCents: 100000, vatRate: 20 }] });
  const avoirPartiel = facture({ id: 'av-H', number: 'AV-2026-0007', kind: 'creditNote', creditNoteFor: 'inv-H', lines: [{ id: 'l1', label: 'Remise', quantity: 1, unitPriceCents: 10000, vatRate: 20 }] });
  assert.equal(isOverdue(f, '2026-06-01', [f, avoirPartiel]), true);
});

console.log(`\nOK — ${vus} contrôles.\n`);
