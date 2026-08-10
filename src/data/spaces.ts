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

/** Sections d'un espace, dans l'ordre du catalogue. */
export function sectionsForSpace(space: SpaceKey): NavSection[] {
  // Une section sans espace appartient au Poste de travail : c'est le cas de
  // l'édition Business, qui n'en a qu'un et n'a donc rien à déclarer.
  return NAV_SECTIONS.filter((section) => (section.space ?? 'workspace') === space);
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
