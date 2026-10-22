import { manifeste } from '../_commun/manifeste';

export const MODULE = manifeste({
  id: 'penalites',
  route: '/penalites-de-retard',
  famille: 'argent',
  action: 'argent.facturer',
  verbes: ['calculer des pénalités de retard', 'réclamer l’indemnité de 40 €', 'écrire une mise en demeure', 'faire payer un retard'],
  motsCles: ['pénalités', 'intérêts de retard', 'indemnité forfaitaire', '40 €', 'mise en demeure', 'retard de paiement', 'impayé', 'l441-10'],
  niveau: 'courant',
  nom: 'Pénalités de retard',
  pourQui: 'toute entreprise qui facture d’autres professionnels et attend d’être payée',
});
