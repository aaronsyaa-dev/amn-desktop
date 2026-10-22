import { AUJOURDHUI_BAC_A_SABLE } from '../_commun/nombres';
import type { Debiteur, FactureImpayee, Parametres } from './logique';

/** Bac à sable : une menuiserie fictive et trois débiteurs fictifs. */
export const CREANCIER = 'Menuiserie Exemple (fictive)';

export const DEBITEURS: readonly Debiteur[] = [
  { id: 'alpha', nom: 'Société Fictive Alpha', type: 'pro' },
  { id: 'beta', nom: 'Société Fictive Bêta', type: 'pro' },
  { id: 'part', nom: 'Client particulier fictif', type: 'particulier', dateMiseEnDemeure: '2026-09-10' },
];

export const FACTURES: readonly FactureImpayee[] = [
  { id: 'f1', debiteur: 'alpha', numero: 'F-2026-0112', montantTTC: 288_000, echeance: '2026-07-31' },
  { id: 'f2', debiteur: 'alpha', numero: 'F-2026-0140', montantTTC: 145_080, echeance: '2026-09-15' },
  { id: 'f3', debiteur: 'alpha', numero: 'F-2026-0171', montantTTC: 95_000, echeance: '2026-11-05' },
  { id: 'f4', debiteur: 'beta', numero: 'F-2026-0098', montantTTC: 624_000, echeance: '2026-06-30' },
  { id: 'f5', debiteur: 'part', numero: 'F-2026-0150', montantTTC: 120_000, echeance: '2026-08-20' },
];

/**
 * Taux d'EXEMPLE, à vérifier avant tout usage réel :
 *   · tauxBce 2,15 % : taux des opérations principales de refinancement de la
 *     BCE après sa décision du 5 juin 2025 (en vigueur au 11 juin 2025). Le taux
 *     à retenir est celui en vigueur au 1er janvier ou au 1er juillet du
 *     semestre (banque-france.fr).
 *   · tauxLegal 3,15 % : ordre de grandeur du taux de l'intérêt légal « autres
 *     cas » (créancier professionnel) publié pour le second semestre 2025 ;
 *     valeur non confirmée, à reprendre de l'arrêté du semestre en cours.
 */
export const PARAMETRES: Parametres = {
  dateCalcul: AUJOURDHUI_BAC_A_SABLE,
  tauxBce: 2.15,
  tauxLegal: 3.15,
};
