import type { Installation } from './logique';

/** Bac à sable : le parc fictif d'un chauffagiste de l'est lyonnais. Clients inventés. */
export const PARC: Installation[] = [
  { id: 'i01', client: 'M. et Mme Perrin', type: 'chaudiere', commune: 'Bron', derniereVisite: '2025-09-15', periodiciteMois: 12 },
  { id: 'i02', client: 'Boulangerie des Tilleuls', type: 'chaudiere', commune: 'Villeurbanne', derniereVisite: '2025-10-28', periodiciteMois: 12 },
  { id: 'i03', client: 'Cabinet Lemoine', type: 'climatisation', commune: 'Villeurbanne', derniereVisite: '2026-04-05', periodiciteMois: 6 },
  { id: 'i04', client: 'Garage du Parc', type: 'extincteurs', commune: 'Vénissieux', derniereVisite: '2025-11-12', periodiciteMois: 12 },
  { id: 'i05', client: 'Résidence Les Érables', type: 'vmc', commune: 'Bron', derniereVisite: '2025-10-30', periodiciteMois: 12 },
  { id: 'i06', client: 'M. Garnier', type: 'pompeAChaleur', commune: 'Caluire-et-Cuire', derniereVisite: '2026-03-20', periodiciteMois: 12 },
  { id: 'i07', client: 'Mme Roux', type: 'chaudiere', commune: 'Vénissieux', derniereVisite: '2025-12-02', periodiciteMois: 12 },
  { id: 'i08', client: 'Hôtel du Square', type: 'adoucisseur', commune: 'Villeurbanne', derniereVisite: '2026-04-21', periodiciteMois: 6 },
  { id: 'i09', client: 'Pharmacie des Platanes', type: 'climatisation', commune: 'Caluire-et-Cuire', derniereVisite: '2026-05-10', periodiciteMois: 6 },
  { id: 'i10', client: 'M. Bernard', type: 'chaudiere', commune: 'Bron', derniereVisite: '2024-10-01', periodiciteMois: 12 },
  { id: 'i11', client: 'École Les Pins', type: 'extincteurs', commune: 'Villeurbanne', derniereVisite: '2025-10-22', periodiciteMois: 12 },
  { id: 'i12', client: 'Atelier Brun', type: 'vmc', commune: 'Vénissieux', derniereVisite: '2026-01-31', periodiciteMois: 9 },
];
