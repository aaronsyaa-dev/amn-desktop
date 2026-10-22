import type { Personne } from './logique';

/** Bac à sable : une menuiserie fictive. Personnes, numéros et titres inventés. */
export const PERSONNES: Personne[] = [
  { id: 'p1', nom: 'Lefort', prenoms: 'Camille', nationalite: 'française', titreExige: false, dateNaissance: '1984-03-12', sexe: 'F', emploi: 'Menuisière', qualification: 'Ouvrière qualifiée N3', contrat: 'cdi', entree: '2015-09-01' },
  { id: 'p2', nom: 'Durand', prenoms: 'Hugo', nationalite: 'française', titreExige: false, dateNaissance: '1990-07-02', sexe: 'M', emploi: 'Poseur', qualification: 'Ouvrier N2', contrat: 'cdd', entree: '2019-04-15', sortie: '2020-10-14' },
  { id: 'p3', nom: 'Benali', prenoms: 'Yasmine', nationalite: 'algérienne', titreExige: true, dateNaissance: '1996-11-23', sexe: 'F', emploi: 'Dessinatrice', qualification: 'ETAM', contrat: 'cdi', entree: '2023-02-06', titreType: 'Carte de séjour pluriannuelle « salarié »', titreNumero: 'FICTIF-0042', titreExpiration: '2026-12-05' },
  { id: 'p4', nom: 'Moreau', prenoms: 'Lucas', nationalite: 'française', titreExige: false, dateNaissance: '2007-05-30', sexe: 'M', emploi: 'Apprenti menuisier', qualification: 'CAP en préparation', contrat: 'apprentissage', entree: '2025-09-01' },
  { id: 'p5', nom: 'Petit', prenoms: 'Inès', nationalite: 'belge', titreExige: false, dateNaissance: '1999-01-17', sexe: 'F', emploi: 'Assistante administrative', qualification: '', contrat: 'cdiPartiel', entree: '2026-03-02' },
  { id: 'p6', nom: 'Garnier', prenoms: 'Tom', nationalite: 'française', titreExige: false, dateNaissance: '2004-08-08', sexe: 'M', emploi: 'Stagiaire bureau d’études', qualification: '', contrat: 'stage', entree: '2026-09-14', sortie: '2026-12-11' },
  { id: 'p7', nom: 'Roux', prenoms: 'Marc', nationalite: 'française', titreExige: false, dateNaissance: '1962-02-01', sexe: 'M', emploi: 'Chef d’atelier', qualification: 'Agent de maîtrise', contrat: 'cdi', entree: '1998-01-05', sortie: '2021-06-30' },
];
