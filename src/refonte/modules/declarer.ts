import type React from 'react';
import type { Famille as Teinte } from '../../socle/familles';

/**
 * DÉCLARER UNE FAMILLE OU UN MODULE — édition interne, refonte S5.
 * ═══════════════════════════════════════════════════════════════
 *
 * Le registre des modules se lit dans `src/refonte/modules/declarations/` :
 * chaque fichier de ce dossier est ramassé seul (`registre.ts`), sans liste à
 * tenir ailleurs. Ajouter une famille ou un module, c'est donc écrire UN
 * fichier, ou une entrée dans le fichier de sa famille :
 *
 *   · une famille : `export default declarerFamille({ id, ordre, teinte, nom,
 *     actions, modules })` ;
 *   · un module seul, rangé dans une famille qui existe déjà :
 *     `export default declarerModule({ famille, action, niveau, vues })`.
 *
 * Le rail du moment (essentiels), la vue « Tous les modules », la recherche
 * par intention et, pour un écran neuf (`nouveau`), le catalogue et les
 * routes de l'édition interne se calculent depuis ces fichiers. Rien d'autre
 * à toucher.
 *
 * UNE ENTRÉE, PLUSIEURS VUES. Une entrée du registre regroupe une ou
 * plusieurs vues (« Facturation » : Facturation, Relances, Acompte). Chaque
 * vue garde sa route et ses données ; la première est la vue principale, et
 * son identifiant est celui de l'entrée. Regrouper ne supprime rien.
 *
 * `npm run check:navigation` refuse un module sans famille, sans action ou
 * avec une action que sa famille ne déclare pas, une vue sans verbe, une vue
 * en double, et une vue du catalogue qu'aucune entrée ne range.
 */

/** Un texte dans les deux langues de l'application. */
export interface Libelle {
  fr: string;
  en: string;
}

/** Les trois niveaux : les essentiels vont dans le rail, les avancés sous « Plus ». */
export const NIVEAUX = ['essentiel', 'courant', 'avance'] as const;
export type Niveau = (typeof NIVEAUX)[number];

/** Un écran qui n'est pas (encore) au catalogue : le registre l'y ajoute, et monte sa route. */
export interface EcranNeuf {
  icone: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  ecran: () => Promise<{ default: React.ComponentType }>;
  /** Une ligne, montrée sous le nom. */
  indice: Libelle;
}

export interface VueDeclaree {
  /** La clé du module au catalogue — et sa clé de traduction. */
  id: string;
  /** La route ; identique au catalogue pour une vue qui y est (vérifié). */
  route: string;
  /** Ce qu'on veut faire, à l'infinitif : « envoyer une facture ». */
  verbes: readonly string[];
  /** Ce qu'on pourrait taper d'autre : synonymes, objets, sigles. */
  motsCles: readonly string[];
  /**
   * Les mêmes verbes et mots-clés en anglais, pour la recherche quand l'application
   * parle anglais. Absent : l'anglais retombe sur le français.
   */
  en?: { verbes: readonly string[]; motsCles: readonly string[] };
  /** Le nom de la vue dans son entrée, s'il diffère du catalogue (Journal : « Pro », « Perso »). */
  etiquette?: Libelle;
  /** Présent seulement pour un écran absent du catalogue. */
  nouveau?: EcranNeuf;
}

export interface ModuleDeclare<A extends string = string> {
  action: A;
  niveau: Niveau;
  /** Le nom de l'entrée. Absent : le nom de la vue principale, pris au catalogue. */
  nom?: Libelle;
  vues: readonly VueDeclaree[];
}

/**
 * Une vue qui n'est plus une entrée ni un module du catalogue : sa route reste
 * (un lien, un signet, un onglet mémorisé y arrivent encore), et quelque chose
 * la remplace.
 */
export interface VueRemplacee {
  id: string;
  route: string;
  /** Ce qui la remplace, à lire après « est devenu » : « le panneau assistant, ouvert par ⌘J ». */
  par: Libelle;
  /**
   * Où la route mène maintenant, montée par le registre (`routesDuRegistre`) :
   * on arrive sur `vers`, et le panneau assistant (⌘J) s'ouvre si `assistant`.
   */
  redirection: { vers: string; assistant?: true };
}

export interface FamilleDeclaree<A extends string = string> {
  type: 'famille';
  /** Identifiant stable, en minuscules. */
  id: string;
  /** Place dans la vue « Tous les modules » et dans le rail (croissant). */
  ordre: number;
  /** La couleur, prise aux sept teintes du socle (`data-famille`), en petit point. */
  teinte: Teinte;
  nom: Libelle;
  /** Réservée à l'équipe AMN : jamais au catalogue client, rangée à part dans le rail. */
  amnSeulement?: boolean;
  actions: Readonly<Record<A, Libelle>>;
  modules: readonly ModuleDeclare<A>[];
  remplacees?: readonly VueRemplacee[];
}

export interface ModuleSeulDeclare extends ModuleDeclare {
  type: 'module';
  /** La famille où il se range ; elle doit exister. */
  famille: string;
}

export type Declaration = FamilleDeclaree | ModuleSeulDeclare;

/** Une famille et ses modules. Une action que la famille ne déclare pas ne compile pas. */
export function declarerFamille<const A extends string>(
  famille: Omit<FamilleDeclaree<A>, 'type' | 'modules'> & { modules: readonly ModuleDeclare<NoInfer<A>>[] },
): FamilleDeclaree<A> {
  return { type: 'famille', ...famille };
}

/** Un module seul, dans un fichier à lui, rangé dans une famille existante. */
export function declarerModule(module: Omit<ModuleSeulDeclare, 'type'>): ModuleSeulDeclare {
  return { type: 'module', ...module };
}

/** Une vue : sa clé, sa route, ses verbes et ses mots-clés. */
export function vue(
  id: string,
  route: string,
  verbes: readonly string[],
  motsCles: readonly string[],
  plus: Pick<VueDeclaree, 'etiquette' | 'nouveau' | 'en'> = {},
): VueDeclaree {
  return { id, route, verbes, motsCles, ...plus };
}
