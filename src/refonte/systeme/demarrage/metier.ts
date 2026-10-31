import { useSyncExternalStore } from 'react';
import { JEU_GENERAL, TAILLE_DEFAUT, estTaille, type TailleEquipe } from './modeles';

/**
 * LE MÉTIER CHOISI (H47) — un réglage PERSONNEL, gardé par compte sur ce poste.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Le poste n'a pas de réglage d'espace : le choix du métier ne change pas ce que voient les autres. Il s'écrit
 *   · ici, dans un magasin local par compte (`amn.metier.<adresse>`, comme `src/refonte/coquille/drapeau.ts` :
 *     `useSyncExternalStore`, un événement de fenêtre, l'événement `storage` des autres fenêtres) ;
 *   · et, quand le serveur répond, dans les préférences du compte (clé `metier`) — le geste est dans
 *     `useDemarrage.ts`, ce fichier-ci ne parle à aucun réseau.
 *
 * Il décide aussi, par `calculerAllegements`, quels modules la barre de la personne « allège » : un affichage,
 * jamais un accès. Aucun module n'est supprimé, tous restent dans « Tous les modules ».
 */

export const CLE_PREFS_METIER = 'metier';
export const cleMetier = (email: string): string => `amn.metier.${email || 'anonyme'}`;
const EVENEMENT = 'amn:metier';

export interface ChoixMetier {
  /** Le modèle choisi ; `null` quand la personne a utilisé « Passer ». */
  modele: string | null;
  taille: TailleEquipe;
  /** Les modules activés : des identifiants d'ENTRÉE du registre. */
  modules: string[];
  /** « Passer » : l'étape « Choisir votre métier » est « passée » (comptée comme faite). */
  passe: boolean;
  /** Date de l'enregistrement (ISO). */
  le: string;
}

/** Un choix validé, ou `null` : ce qui vient du stockage ou du serveur n'est jamais cru sur parole. */
export function lireChoix(brut: unknown): ChoixMetier | null {
  if (typeof brut !== 'object' || brut === null) return null;
  const o = brut as Record<string, unknown>;
  const modele = o.modele === null ? null : typeof o.modele === 'string' && o.modele ? o.modele : undefined;
  if (modele === undefined) return null;
  if (!Array.isArray(o.modules) || !o.modules.every((m) => typeof m === 'string')) return null;
  const passe = o.passe === true;
  if (modele === null && !passe) return null;
  return {
    modele,
    taille: estTaille(o.taille) ? o.taille : TAILLE_DEFAUT,
    modules: [...new Set(o.modules as string[])],
    passe,
    le: typeof o.le === 'string' ? o.le : '',
  };
}

export function choixDepuisSelection(modele: string, taille: TailleEquipe, modules: readonly string[], le = new Date().toISOString()): ChoixMetier {
  return { modele, taille, modules: [...new Set(modules)], passe: false, le };
}

/** « Passer » : le jeu général de modules, et l'étape marquée « passée ». */
export function choixPasse(taille: TailleEquipe = TAILLE_DEFAUT, le = new Date().toISOString()): ChoixMetier {
  return { modele: null, taille, modules: [...JEU_GENERAL], passe: true, le };
}

/* ── Le magasin local ─────────────────────────────────────────────────────── */

const memoire = new Map<string, { brut: string | null; valeur: ChoixMetier | null }>();

function lireBrut(cle: string): string | null {
  try {
    return window.localStorage.getItem(cle);
  } catch {
    return null;
  }
}

/** Le choix gardé pour ce compte, ou `null`. La MÊME référence tant que le texte stocké ne change pas (`useSyncExternalStore`). */
export function lireMetier(email: string): ChoixMetier | null {
  const cle = cleMetier(email);
  const brut = lireBrut(cle);
  const vu = memoire.get(cle);
  if (vu && vu.brut === brut) return vu.valeur;
  let valeur: ChoixMetier | null = null;
  if (brut) {
    try {
      valeur = lireChoix(JSON.parse(brut));
    } catch {
      valeur = null;
    }
  }
  memoire.set(cle, { brut, valeur });
  return valeur;
}

/** Garde le choix. `false` quand le stockage refuse (mode privé, disque plein) : l'écran le dit, le choix n'est alors pas perdu en silence. */
export function ecrireMetier(email: string, choix: ChoixMetier): boolean {
  try {
    window.localStorage.setItem(cleMetier(email), JSON.stringify(choix));
  } catch {
    return false;
  }
  window.dispatchEvent(new Event(EVENEMENT));
  return true;
}

const abonner = (rappel: () => void) => {
  window.addEventListener(EVENEMENT, rappel);
  window.addEventListener('storage', rappel);
  return () => {
    window.removeEventListener(EVENEMENT, rappel);
    window.removeEventListener('storage', rappel);
  };
};

/** Le choix de ce compte, à jour quand il change (cette fenêtre ou une autre). */
export function useMetierStocke(email: string): ChoixMetier | null {
  return useSyncExternalStore(
    abonner,
    () => lireMetier(email),
    () => null,
  );
}

/* ── L'activation : quels modules la barre allège ─────────────────────────── */

export interface EntreeAvecVues {
  id: string;
  vues: readonly { id: string }[];
}

/**
 * Les clés de CATALOGUE à alléger pour n'avoir que les modules activés.
 *
 *   · une entrée du registre non activée allège TOUTES ses vues (clés du catalogue) ; une entrée activée n'allège aucune des siennes ;
 *   · les modules qui ne s'allègent jamais (`toujoursOuverts` : `ALWAYS_ON_MODULES`) et ceux qui sont fermés à l'organisation
 *     (`fermes`) ne sont jamais dans la liste ;
 *   · une vue qui n'est pas au catalogue (une vue « remplacée ») n'y entre pas non plus ;
 *   · sans aucun module activé, rien n'est allégé : au moins un module reste toujours activé.
 *
 * La liste est sans doublon, dans l'ordre du registre. Elle se pose d'un coup par `useNavAlleges().remplacer`.
 */
export function calculerAllegements(
  modulesActifs: readonly string[],
  registre: { entrees: readonly EntreeAvecVues[] },
  catalogue: readonly string[],
  options: { toujoursOuverts?: readonly string[]; fermes?: readonly string[] } = {},
): string[] {
  const actifs = new Set(modulesActifs);
  if (actifs.size === 0) return [];
  const auCatalogue = new Set(catalogue);
  const intouchables = new Set([...(options.toujoursOuverts ?? []), ...(options.fermes ?? [])]);
  const sortie = new Set<string>();
  for (const entree of registre.entrees) {
    if (actifs.has(entree.id)) continue;
    for (const vue of entree.vues) {
      if (auCatalogue.has(vue.id) && !intouchables.has(vue.id)) sortie.add(vue.id);
    }
  }
  return [...sortie];
}
