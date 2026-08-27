import type React from 'react';
import { Briefcase, MonitorDot } from 'lucide-react';
import { NAV_SECTIONS, type NavItem, type NavSection, type SpaceKey } from './navigation';

/**
 * Les deux espaces du contexte AMN DevSec.
 *
 * Pas deux rubriques d'une même barre latérale : deux navigations distinctes,
 * entre lesquelles on bascule explicitement. Le Poste de travail répond à
 * « qu'est-ce que je fais aujourd'hui » ; la Tour de contrôle à « qu'est-ce qui
 * se passe sur le parc et chez les clientes ». Mélanger les deux, c'est ce qui
 * avait fini par rendre la barre latérale illisible.
 *
 * L'espace actif se DÉDUIT du chemin courant plutôt que d'être un état à part.
 * C'est ce qui fait qu'un lien profond, la palette de commandes, une
 * notification ou la mémoire d'onglet arrivent toujours dans le bon espace,
 * sans que chacun ait à penser à le régler.
 */

export interface Space {
  key: SpaceKey;
  label: string;
  /** Une ligne, affichée dans le sélecteur. */
  hint: string;
  /** Où mène la bascule vers cet espace. */
  home: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
}

export const SPACES: Space[] = [
  {
    key: 'workspace',
    label: 'Poste de travail',
    hint: 'Le quotidien : clients, tâches, notes, agenda',
    home: '/',
    icon: Briefcase,
  },
  {
    key: 'control',
    label: 'Tour de contrôle',
    hint: 'Le transverse : incidents, produits, organisations',
    home: '/tour',
    icon: MonitorDot,
  },
];

/**
 * Les modules ouverts à l'organisation connectée (BLOC E), ou `null` = tous.
 *
 * Un registre au niveau du module, réglé par `AuthContext` à partir de ce que
 * le serveur affirme. Le poste ne choisit rien : il applique.
 *
 * Pourquoi ici, et pas un filtre à chaque endroit qui affiche la navigation :
 * il y en a cinq — barre latérale, lanceur, barre du pouce, palette de
 * commandes, étiquettes — et l'histoire de ce dépôt est pleine de listes qu'on
 * a oublié de filtrer à un endroit sur cinq. Le catalogue est déjà résolu
 * globalement à la compilation selon l'édition ; les modules d'une organisation
 * sont la même idée, un cran plus bas.
 *
 * ATTENTION : ceci retire des ÉCRANS, ce n'est pas une frontière de sécurité.
 * L'isolation des données reste celle d'amn-api, par `org_id`.
 */
let enabledModules: string[] | null = null;

export function setEnabledModules(modules: string[] | null | undefined): void {
  enabledModules = Array.isArray(modules) ? modules : null;
}

/**
 * LES MODULES QUI NE SE FERMENT PAS.
 *
 * Deux familles, et deux raisons différentes :
 *
 *   - `home` et `settings` : une organisation sans accueil ni paramètres n'est
 *     pas dégradée, elle est cassée.
 *   - `budget` et `courses` (module Personnel, BLOC 2) : un bonus inclus dans
 *     les desktops business déjà payés. Ils n'ont AUCUNE clé dans `ORG_MODULES`
 *     côté amn-api — il n'existe donc rien à consulter pour savoir s'ils sont
 *     ouverts, parce qu'il n'existe aucun geste pour les fermer, donc aucun
 *     pour les vendre.
 *
 * Cette liste est la SEULE source : `scripts/check-modules.mjs` la relit dans
 * ce fichier plutôt que d'en tenir une copie. C'est ce qui a manqué la
 * première fois — la règle vivait dans le contrôle, l'application l'ignorait,
 * et la section « Personnel » ne s'affichait chez personne dont les modules
 * sont listés explicitement.
 */
export const ALWAYS_ON_MODULES = ['home', 'settings', 'budget', 'courses'];

/** Un module est-il ouvert ? */
export function isModuleEnabled(key: string): boolean {
  if (ALWAYS_ON_MODULES.includes(key)) return true;
  if (!enabledModules) return true;
  return enabledModules.includes(key);
}

/** Sections d'un espace, dans l'ordre du catalogue. */
export function sectionsForSpace(space: SpaceKey): NavSection[] {
  // Une section sans espace appartient au Poste de travail : c'est le cas de
  // l'édition Business, qui n'en a qu'un et n'a donc rien à déclarer.
  return NAV_SECTIONS.filter((section) => (section.space ?? 'workspace') === space)
    .map((section) => ({ ...section, items: section.items.filter((item) => isModuleEnabled(item.key)) }))
    // Une section vidée de tous ses modules disparaît : un intitulé seul dans
    // le lanceur dirait « il y a autre chose, mais pas pour vous ».
    .filter((section) => section.items.length > 0);
}

export function itemsForSpace(space: SpaceKey): NavItem[] {
  return sectionsForSpace(space).flatMap((section) => section.items);
}

/**
 * L'espace auquel appartient un chemin.
 *
 * Correspondance par préfixe le plus long, pour que `/tracker/site/:id` tombe
 * dans le même espace que `/tracker` au lieu du défaut. La racine `/` est
 * traitée à part : tout chemin commence par elle.
 */
export function spaceForPath(pathname: string): SpaceKey {
  let best: { length: number; space: SpaceKey } | null = null;
  for (const section of NAV_SECTIONS) {
    const space = section.space ?? 'workspace';
    for (const item of section.items) {
      if (item.to === '/') continue;
      if (pathname === item.to || pathname.startsWith(`${item.to}/`)) {
        if (!best || item.to.length > best.length) best = { length: item.to.length, space };
      }
    }
  }
  return best?.space ?? 'workspace';
}

export function spaceByKey(key: SpaceKey): Space {
  return SPACES.find((s) => s.key === key) ?? SPACES[0];
}
