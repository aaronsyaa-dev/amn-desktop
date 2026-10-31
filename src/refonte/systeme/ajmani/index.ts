/**
 * AJMANI, LA PALETTE ⌘J (G05) — la charte d'Ajmani pour toute l'application, interne seulement.
 *
 *   import { PaletteAjmaniBranchee } from '../systeme/ajmani';
 *
 * Logique pure (sans React) : `intentions`, `niveaux`, `historique`, `journal`, `lancer`, `navigation`, `etat`,
 * `sensibles`. Composants : `PaletteAjmaniRefonte` (aux props explicites), `PaletteAjmaniBranchee` (données réelles).
 */
export { PaletteAjmaniRefonte, type PaletteAjmaniRefonteProps, type ContextePalette, type Analyseur } from './PaletteAjmaniRefonte';
export { PaletteAjmaniBranchee, type PaletteAjmaniBrancheeProps } from './PaletteAjmaniBranchee';
export { useDonneesAjmani } from './useDonneesAjmani';
export { useContextePalette } from './useContextePalette';
export { useActionsAjmani, type ActionsAjmani } from './useActionsAjmani';
export { lireJournal, type EntreeJournal } from './journal';
export type { DonneesAjmani, ContexteAjmani } from './intentions';
