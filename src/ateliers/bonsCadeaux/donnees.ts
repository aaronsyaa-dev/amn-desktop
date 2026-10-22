import { genererCode, type Bon } from './logique';

/** Bac à sable : un salon de coiffure fictif. Les bénéficiaires sont inventés. */
export const NUMERO_DE_DEPART = 1000;

export const BONS_EXEMPLE: Bon[] = [
  { code: genererCode(1000), beneficiaire: 'Camille D.', montant: 5_000, emission: '2025-09-14', valableJusquau: '2026-09-13', utilisations: [{ date: '2025-11-02', montant: 3_200 }] },
  { code: genererCode(1001), beneficiaire: 'Yanis B.', montant: 8_000, emission: '2025-12-20', valableJusquau: '2026-12-19', utilisations: [] },
  { code: genererCode(1002), beneficiaire: 'Léa M.', montant: 3_000, emission: '2026-02-10', valableJusquau: '2027-02-09', utilisations: [{ date: '2026-03-01', montant: 3_000 }] },
  { code: genererCode(1003), beneficiaire: 'Noah P.', montant: 12_000, emission: '2026-06-05', valableJusquau: '2027-06-04', utilisations: [{ date: '2026-07-12', montant: 4_500 }] },
  { code: genererCode(1004), beneficiaire: 'Inès R.', montant: 4_000, emission: '2026-10-01', valableJusquau: '2027-09-30', utilisations: [] },
];
