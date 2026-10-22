import type { Risque, Unite } from './logique';

/** Bac à sable : une menuiserie fictive de 14 salariés, document mis à jour il y a plus d'un an. */
export const ENTREPRISE = { nom: 'Menuiserie des Tilleuls (fictive)', effectif: 14, derniereMiseAJour: '2025-09-30' };

export const UNITES: readonly Unite[] = [
  { id: 'atelier', nom: 'Atelier de fabrication' },
  { id: 'chantier', nom: 'Pose sur chantier' },
  { id: 'route', nom: 'Déplacements' },
  { id: 'bureau', nom: 'Bureau et accueil' },
];

const r = (
  id: string,
  uniteId: string,
  categorie: Risque['categorie'],
  danger: string,
  gravite: number,
  probabilite: number,
  mesuresExistantes: string,
  actionPrevue: string,
  responsable: string,
  echeance: string,
  faite = false,
): Risque => ({ id, uniteId, categorie, danger, gravite, probabilite, mesuresExistantes, actionPrevue, responsable, echeance, faite });

export const RISQUES: readonly Risque[] = [
  r('r1', 'atelier', 'machines', 'Coupure à la scie circulaire sur table', 4, 3, 'Protecteur de lame, poussoir', 'Former les deux apprentis au poste de sciage', 'Lucie Fabre', '2026-11-15'),
  r('r2', 'atelier', 'bruit', 'Bruit des machines au-delà de 85 dB(A)', 3, 4, 'Bouchons d’oreilles fournis', 'Mesurer le bruit et capoter la raboteuse', 'Lucie Fabre', '2026-09-30'),
  r('r3', 'atelier', 'chimique', 'Poussières de bois et vernis en atelier', 3, 3, 'Aspiration centralisée', 'Remplacer les filtres et commander des masques FFP2', 'Karim Benali', '2026-12-01'),
  r('r4', 'chantier', 'hauteur', 'Pose de placards hauts sur escabeau', 4, 3, '', 'Louer une plateforme individuelle roulante', 'Karim Benali', '2026-10-10'),
  r('r5', 'chantier', 'manutention', 'Port de portes et plans de travail lourds', 3, 3, 'Diable et sangles dans chaque camion', 'Acheter des ventouses de manutention', 'Karim Benali', '2027-01-15'),
  r('r6', 'route', 'routier', 'Trajets quotidiens vers les chantiers', 4, 2, 'Entretien des camions suivi', 'Interdire le téléphone au volant dans le règlement intérieur', 'Lucie Fabre', '2026-06-30', true),
  r('r7', 'bureau', 'ecran', 'Travail prolongé sur écran pour les devis', 1, 3, 'Écrans réglables', '', '', ''),
  r('r8', 'bureau', 'psychosocial', 'Clients mécontents au téléphone en fin de chantier', 2, 3, '', 'Écrire une procédure de réclamation', 'Lucie Fabre', '2027-02-28'),
  r('r9', 'atelier', 'incendie', 'Copeaux et solvants stockés près de l’atelier', 4, 2, 'Extincteurs vérifiés', '', '', ''),
];
