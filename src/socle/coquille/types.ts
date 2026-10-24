import type { Famille } from '../familles';

/** Un module dans la barre latérale : déjà libellé, déjà compté. */
export interface ModuleLateral {
  cle: string;
  libelle: string;
  vers: string;
  badge: number;
  /** Le module où l'on est (une entrée regroupe parfois plusieurs écrans). */
  courant: boolean;
}

/** Une famille de la barre latérale : ses modules, et la somme de leurs compteurs. */
export interface FamilleLaterale {
  cle: string;
  nom: string;
  /** La teinte de la pastille. */
  famille: Famille;
  modules: ModuleLateral[];
  badge: number;
  /** Le module courant est dans cette famille. */
  active: boolean;
}

export interface PersonneEnLigne {
  cle: string;
  nom: string;
  /** Où elle est : le module ouvert. */
  lieu: string;
}

export interface MiettePain {
  libelle: string;
  /** Absent : une étiquette, pas un lien (la dernière miette, et les familles). */
  vers?: string;
}

export type EtatGarde = 'calme' | 'attention' | 'critique' | 'inconnu';

/** Une ligne de la palette ⌘J. */
export interface Proposition {
  id: string;
  libelle: string;
  /** Une précision à droite : le verbe qui a fait trouver le module. */
  detail?: string;
  famille?: Famille;
  executer: () => void;
}

export interface GroupePropositions {
  titre: string;
  propositions: Proposition[];
}
