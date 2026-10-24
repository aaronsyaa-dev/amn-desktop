/**
 * Les briques communes de la refonte. Mode d'emploi : docs/refonte-socle.md.
 *
 *   import { Bouton, Carte, Modale, Saisie } from '../socle/ui';
 */
export { Bouton, type BoutonProps, type VarianteBouton, type TailleBouton } from './Bouton';
export { Carte, type CarteProps } from './Carte';
export { Modale, type ModaleProps } from './Modale';
export { Saisie, type SaisieProps } from './Saisie';
export { BarreProgression, AnneauProgression, TuileKpi, TuileAjouter, type BarreProgressionProps, type AnneauProgressionProps, type TuileKpiProps, type TonVariation } from './Indicateurs';
export { Etiquette, PastilleEtat, Avatar, PileAvatars, Raccourci, initiales, type EtatPastille } from './Pastilles';
export { CaseACocher, LigneTache, type CaseACocherProps, type LigneTacheProps } from './Taches';
export { EtatVide, Squelette, Chargement } from './Etats';
export { LigneActivite, EtapeFranchie } from './Activite';
