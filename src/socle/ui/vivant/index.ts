/**
 * Briques du groupe « vivant » (v3, 01-SOCLE-DESIGN §0.4) : voyant vivant, curseur, niveaux, puces de filtre,
 * demi-jauge, case de chaleur, lien qui avance, suggestion en ligne. Leur mouvement vient de la couche commune
 * (`src/socle/mouvement.css`, §0.2) ; leur feuille est `vivant.css`, chargée par `Ambiance.tsx`.
 */
export { LiveDot, Caret, Severity, NIVEAUX_SEVERITE, type LiveDotProps, type SeverityProps, type NiveauSeverite } from './Signaux';
export { Gauge, HeatCell, opaciteChaleur, OPACITE_CHALEUR, type GaugeProps, type HeatCellProps } from './Mesures';
export { FlowLine, cheminFlux, type FlowLineProps } from './FlowLine';
export { FilterChips, type FilterChipsProps, type PuceFiltre } from './FilterChips';
export { InlineSuggestion, type InlineSuggestionProps } from './InlineSuggestion';
export { TONS_VIVANT, type TonVivant, type TonVivantNeutre } from './tons';
