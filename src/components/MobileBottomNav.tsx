import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutGrid } from 'lucide-react';
import { itemsForSpace, spaceForPath } from '../data/spaces';
import type { NavItem } from '../data/navigation';
import { useNavFavorites } from '../state/useNavFavorites';

/**
 * La navigation du pouce (B.2).
 *
 * Sur téléphone, toute la navigation vivait en haut de l'écran, derrière un
 * bouton de 36 px : deux problèmes d'un coup, la cible trop petite et la zone
 * la moins atteignable d'un écran tenu à une main. Cette barre met les modules
 * épinglés là où le pouce arrive, avec des cibles de 56 px de haut.
 *
 * Elle ne duplique aucune logique : les épinglés viennent de `useNavFavorites`
 * (le même magasin que la barre latérale) et la liste des modules de
 * `itemsForSpace`, filtrée par l'espace déduit du chemin courant. Épingler
 * depuis le lanceur change donc les deux surfaces à la fois, et un module qui
 * n'existe pas dans l'édition Business n'apparaît nulle part.
 *
 * L'espace actif (Poste de travail / Tour de contrôle) reste distinct : la
 * barre ne montre que les modules de l'espace courant, jamais les deux
 * aplatis ensemble. Le changement d'espace reste dans le tiroir, qui est le
 * geste rare.
 */

/** Combien d'entrées tiennent sans devenir illisibles sur un écran de 360 px. */
const MAX_ITEMS = 4;

export function MobileBottomNav({
  onOpenLauncher,
  /**
   * Catalogue à afficher, quand ce n'est pas celui de l'édition compilée.
   *
   * Le seul cas est le contexte client : la barre y doit lister les modules de
   * la CLIENTE, pas les nôtres. Sans ce paramètre, `itemsForSpace` renverrait
   * la liste interne — Sites, Équipe, Trackers — au milieu du dossier d'une
   * organisation où ces écrans n'existent pas.
   */
  items: override,
  /** Ce que fait le dernier bouton. « Modules » ouvre le lanceur, sinon le tiroir. */
  moreLabel = 'Modules',
}: {
  onOpenLauncher: () => void;
  items?: NavItem[];
  moreLabel?: string;
}) {
  const location = useLocation();
  const { favorites } = useNavFavorites();

  const space = spaceForPath(location.pathname);
  const available = override ?? itemsForSpace(space);
  // L'ordre du catalogue, pas celui des épinglages : la barre ne doit jamais se
  // réorganiser sous le pouce d'une visite à l'autre.
  const pinned = available.filter((item) => favorites.includes(item.key)).slice(0, MAX_ITEMS);
  // Un compte qui n'a rien épinglé garde une barre utile plutôt que vide.
  const items = pinned.length > 0 ? pinned : available.slice(0, MAX_ITEMS);

  const isActive = (to: string) =>
    to === '/' ? location.pathname === '/' : location.pathname.startsWith(to);

  return (
    <nav
      aria-label="Navigation principale"
      className="flex flex-shrink-0 items-stretch border-t border-border bg-[#0d0d0d] md:hidden"
    >
      {items.map((item) => {
        const Icon = item.icon;
        const active = isActive(item.to);
        return (
          <Link
            key={item.key}
            to={item.to}
            aria-label={item.label}
            aria-current={active ? 'page' : undefined}
            // 56 px de haut : au-dessus du minimum de 44, parce qu'une barre
            // basse se touche en diagonale et sans regarder.
            className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-1 py-2.5 transition-colors ${
              active ? 'text-text-primary' : 'text-text-muted'
            }`}
            style={{ minHeight: 56 }}
          >
            <span className="relative">
              <Icon size={20} strokeWidth={active ? 2 : 1.75} />
              {active && (
                <span
                  className="absolute -top-2.5 left-1/2 h-0.5 w-5 -translate-x-1/2 rounded-full bg-accent"
                  aria-hidden
                />
              )}
            </span>
            <span className="w-full truncate px-1 text-center text-[10px] leading-none">
              {item.label}
            </span>
          </Link>
        );
      })}

      <button
        type="button"
        onClick={onOpenLauncher}
        aria-label={moreLabel === 'Modules' ? 'Tous les modules' : moreLabel}
        aria-haspopup="dialog"
        className="flex min-w-0 flex-1 flex-col items-center justify-center gap-1 py-2.5 text-text-muted transition-colors"
        style={{ minHeight: 56 }}
      >
        <LayoutGrid size={20} strokeWidth={1.75} />
        <span className="w-full truncate px-1 text-center text-[10px] leading-none">{moreLabel}</span>
      </button>
    </nav>
  );
}
