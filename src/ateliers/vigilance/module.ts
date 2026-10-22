import { manifeste } from '../_commun/manifeste';

export const MODULE = manifeste({
  id: 'vigilance',
  route: '/vigilance-sous-traitants',
  famille: 'outils',
  action: 'outils.conformite',
  verbes: ['vérifier mes sous-traitants', 'relancer une attestation URSSAF', 'suivre les attestations de vigilance', 'voir les assurances qui expirent'],
  motsCles: ['vigilance', 'sous-traitant', 'attestation urssaf', 'kbis', 'décennale', 'assurance', 'travail dissimulé', 'donneur d’ordre'],
  niveau: 'expert',
  nom: 'Vigilance sous-traitants',
  pourQui: 'donneurs d’ordre et entreprises du bâtiment qui sous-traitent',
});
