/**
 * « AUJOURD'HUI » — un seul calcul pour la barre latérale et l'Accueil.
 *
 *   · `useAujourdhui()` : les chiffres (faites / total, série, prochain rendez-vous, fil, présence) et les gestes
 *     (`cocher`, `retoucher`) ; lit le fournisseur quand il y en a un, sinon calcule localement ;
 *   · `FournisseurAujourdhui` : monté une fois dans la coque (`AppLayout`, par `@edition/coquille`) ;
 *   · `calculerAujourdhui` : la fonction pure, pour les contrôles ;
 *   · `useCarteAujourdhui`, `delaiAvant`, `heureDe` : la mise en mots pour la carte de la barre latérale.
 */
export { calculerAujourdhui, type AujourdhuiCalcule, type LibellesAujourdhui, type SourcesAujourdhui } from './calculer';
export { useAujourdhui, useCalculAujourdhui, ContexteAujourdhui, type Aujourdhui, type PersonneAujourdhui } from './useAujourdhui';
export { FournisseurAujourdhui } from './Fournisseur';
export { useCarteAujourdhui, delaiAvant, heureDe } from './carte';
