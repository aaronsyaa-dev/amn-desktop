/**
 * LES BRIQUES PARTAGÉES (v3, STATUT §1.10 point 1) : la tuile d'icône, le compteur, la tuile de module, la grille
 * de groupes et la tuile « + Ajouter un module ». Leur feuille (`briques-partagees.css`) est chargée par `briques.css`
 * (`@import`), donc par `Ambiance.tsx`, en édition interne seulement. Mode d'emploi : docs/refonte-socle.md.
 */
export { IconTile, type IconTileProps, type TailleIconTile, type TonIconTile, type PartIconTile } from './IconTile';
export { CountBadge, PLAFOND_COMPTE, type CountBadgeProps, type VarianteCountBadge } from './CountBadge';
export { ModuleTile, ModuleGroupGrid, AddModuleTile, type ModuleTileProps, type ModuleGroupGridProps, type AddModuleTileProps, type VarianteModuleTile } from './ModuleTile';
