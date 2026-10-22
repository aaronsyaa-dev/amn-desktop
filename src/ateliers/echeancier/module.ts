import { manifeste } from '../_commun/manifeste';

export const MODULE = manifeste({
  id: 'echeancier',
  route: '/echeancier',
  famille: 'argent',
  action: 'argent.facturer',
  verbes: ['proposer un paiement en plusieurs fois', 'faire un échéancier', 'étaler un paiement', 'suivre les échéances d’un client'],
  motsCles: ['échéancier', 'paiement en plusieurs fois', 'mensualités', 'échéance', 'étalement', 'reste dû', 'facilités de paiement'],
  niveau: 'courant',
  nom: 'Paiement en plusieurs fois',
  pourQui: 'artisans et commerces qui laissent payer une grosse facture en plusieurs mois',
});
