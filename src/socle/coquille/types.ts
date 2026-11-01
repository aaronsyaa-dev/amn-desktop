import type { Famille } from '../familles';

/** Un module dans la barre latérale : déjà libellé, déjà compté. */
export interface ModuleLateral {
  cle: string;
  libelle: string;
  vers: string;
  badge: number;
  /** Le module où l'on est (une entrée regroupe parfois plusieurs écrans). */
  courant: boolean;
  /**
   * La famille du module (identifiant du registre : `jour`, `argent`, `garde`, `cyber`…) : un module épinglé
   * prend l'icône de sa famille. Inutile dans la sous-liste d'une famille.
   */
  famille?: string;
}

/** Une famille de la barre latérale : ses modules, et la somme de leurs compteurs. */
export interface FamilleLaterale {
  /** L'identifiant du registre (`jour`, `contacts`… `garde`, `cyber`) : il choisit l'icône de trait de la famille. */
  cle: string;
  nom: string;
  /** La teinte de la famille : la couleur de son icône quand elle est active (v3 : plus aucune pastille). */
  famille: Famille;
  modules: ModuleLateral[];
  /** Ce qui attend dans la famille. La barre v3 ne l'écrit plus sur la famille (§0.1) : il reste sur ses modules. */
  badge: number;
  /** Le module courant est dans cette famille. */
  active: boolean;
  /** « Vue d'ensemble » : la page d'accueil de la famille, première ligne de toute famille sauf Ma journée (qui a l'Accueil). */
  ensemble?: ModuleLateral;
  /** Les modules de la famille qui ne sont pas dans la liste : « + N autres » mène à Tous les modules. */
  autres?: number;
  /** Une famille sans sous-liste (Cyber hors de ses écrans) : la ligne est un lien vers cette adresse. */
  vers?: string;
  /** Un compteur écrit à droite de la famille, dans une pastille (Cyber : les alertes ouvertes du SOC). `null` : aucun. */
  compteur?: number | null;
  /** Ce que compte `compteur`, en mots (« 5 alertes ouvertes »), pour l'infobulle et les lecteurs d'écran. */
  compteurAide?: string;
}

export interface PersonneEnLigne {
  cle: string;
  nom: string;
  /** Où elle est : le libellé du module ouvert (registre ou page système), ou `null` — jamais une adresse. */
  lieu: string | null;
}

/** La carte « Aujourd'hui » du bas de la barre latérale (§0.1) : les mêmes chiffres que l'Accueil. */
export interface CarteAujourdhui {
  /** Ce qui est fait dans la journée, sur ce qu'elle compte (le « x sur y fait » de l'Accueil). */
  faites: number;
  total: number;
  /** La série en cours, en jours (0 : pas de série). */
  serie: number;
  /** Le prochain rendez-vous du jour, déjà mis en mots (« 11:00 », « dans 18 min »), ou `null`. */
  rendezVous: { titre: string; heure: string; dans: string } | null;
  /** Les collègues en ligne (deux au plus sont montrés) et le module où chacun se trouve. */
  collegues: PersonneEnLigne[];
  presenceMontree: boolean;
  /** Où mène la carte : l'Accueil, qui porte les mêmes chiffres. */
  vers: string;
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
