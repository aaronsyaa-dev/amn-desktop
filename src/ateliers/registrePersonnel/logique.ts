import { ajouterJours, ajouterMois, estDateIso } from '../_commun/nombres';

/**
 * LE REGISTRE UNIQUE DU PERSONNEL — tenu dans l'ordre des embauches.
 *
 * Sources (Code du travail) :
 *   · L1221-13 : un registre dans tout établissement employant des salariés ;
 *     les stagiaires y figurent dans une partie spécifique ;
 *   · D1221-23 : les mentions par salarié (nom, prénoms, nationalité, date de
 *     naissance, sexe, emploi, qualification, dates d'entrée et de sortie,
 *     nature du contrat quand il n'est pas un CDI à temps plein, et pour un
 *     travailleur étranger le type et le numéro du titre valant autorisation
 *     de travail) ;
 *   · R1221-26 : conservation cinq ans à compter de la date du départ.
 *
 * Le module NE remplace PAS le registre légal (mentions indélébiles, tenu à
 * disposition) : il aide à le tenir complet, et prévient de ce qui manque ou
 * expire. La date d'expiration du titre n'est pas une mention du registre ;
 * elle est suivie ici parce que l'employeur doit s'assurer que l'autorisation
 * de travail reste valable.
 */
export type Contrat = 'cdi' | 'cdiPartiel' | 'cdd' | 'apprentissage' | 'interim' | 'stage';
export type Sexe = 'F' | 'M';

export interface Personne {
  id: string;
  nom: string;
  prenoms: string;
  nationalite: string;
  /** Vrai si la nationalité n'est ni française, ni d'un pays de l'UE / EEE / Suisse (titre exigé). */
  titreExige: boolean;
  dateNaissance: string;
  sexe: Sexe;
  emploi: string;
  qualification: string;
  contrat: Contrat;
  entree: string;
  sortie?: string;
  titreType?: string;
  titreNumero?: string;
  titreExpiration?: string;
}

export type Manque = 'nom' | 'prenoms' | 'nationalite' | 'dateNaissance' | 'emploi' | 'qualification' | 'entree' | 'sortie' | 'titreType' | 'titreNumero';
export type Alerte = 'titreExpire' | 'titreBientot' | 'conservationEchue';

export interface Ligne {
  personne: Personne;
  /** Numéro d'ordre dans sa partie du registre (salariés, ou stagiaires). */
  numero: number;
  present: boolean;
  manques: Manque[];
  alertes: Alerte[];
}

export const DELAI_ALERTE_TITRE_JOURS = 60;
export const CONSERVATION_ANS = 5;

export function manques(p: Personne): Manque[] {
  const m: Manque[] = [];
  if (!p.nom.trim()) m.push('nom');
  if (!p.prenoms.trim()) m.push('prenoms');
  if (!p.nationalite.trim()) m.push('nationalite');
  if (!estDateIso(p.dateNaissance)) m.push('dateNaissance');
  if (!p.emploi.trim()) m.push('emploi');
  if (p.contrat !== 'stage' && !p.qualification.trim()) m.push('qualification');
  if (!estDateIso(p.entree)) m.push('entree');
  if (p.sortie !== undefined && (!estDateIso(p.sortie) || (estDateIso(p.entree) && p.sortie < p.entree))) m.push('sortie');
  if (p.titreExige) {
    if (!p.titreType?.trim()) m.push('titreType');
    if (!p.titreNumero?.trim()) m.push('titreNumero');
  }
  return m;
}

export function alertes(p: Personne, aujourdhui: string): Alerte[] {
  const a: Alerte[] = [];
  const present = !p.sortie || p.sortie >= aujourdhui;
  if (present && p.titreExige && p.titreExpiration && estDateIso(p.titreExpiration)) {
    if (p.titreExpiration < aujourdhui) a.push('titreExpire');
    else if (p.titreExpiration <= ajouterJours(aujourdhui, DELAI_ALERTE_TITRE_JOURS)) a.push('titreBientot');
  }
  if (p.sortie && estDateIso(p.sortie) && ajouterMois(p.sortie, CONSERVATION_ANS * 12) < aujourdhui) a.push('conservationEchue');
  return a;
}

/** Les deux parties du registre, chacune dans l'ordre des entrées (puis du nom, à date égale). */
export function registre(personnes: readonly Personne[], aujourdhui: string): { salaries: Ligne[]; stagiaires: Ligne[] } {
  const tri = [...personnes].sort((x, y) => x.entree.localeCompare(y.entree) || x.nom.localeCompare(y.nom, 'fr') || x.id.localeCompare(y.id));
  const ligne = (p: Personne, i: number): Ligne => ({
    personne: p,
    numero: i + 1,
    present: !p.sortie || p.sortie >= aujourdhui,
    manques: manques(p),
    alertes: alertes(p, aujourdhui),
  });
  return {
    salaries: tri.filter((p) => p.contrat !== 'stage').map(ligne),
    stagiaires: tri.filter((p) => p.contrat === 'stage').map(ligne),
  };
}

export function effectifPresent(r: { salaries: Ligne[] }): number {
  return r.salaries.filter((l) => l.present).length;
}
