import type { OrgPlan } from '../shared/api';

/**
 * LA GRILLE TARIFAIRE — la même que côté serveur (amn-api, db/tenancy.js
 * PLAN_FORMULAS), pour l'affichage seulement : le montant réellement
 * facturé vient toujours du prix Stripe posé côté serveur, jamais d'ici.
 *
 * `business_standard`/`business_premium` restent lisibles (une organisation
 * qui les porte encore doit voir un nom, pas une clé brute) mais ne sont
 * plus proposées à la souscription — `PALIER_PRIX_EUR` ne les porte pas.
 */
export const PALIER_LABELS: Record<string, string> = {
  solo: 'Solo',
  equipe: 'Équipe',
  business: 'Business',
  business_standard: 'Standard (ancien)',
  business_premium: 'Premium (ancien)',
  internal: 'Interne',
};

export const PALIER_PRIX_EUR: Partial<Record<OrgPlan, number>> = { solo: 59, equipe: 129, business: 249 };
export const PALIER_PLACES_INCLUSES: Partial<Record<OrgPlan, number>> = { solo: 1, equipe: 5, business: 10 };
export const PRIX_PLACE_SUPPLEMENTAIRE_EUR = 15;

/** Les trois paliers proposés à la souscription, dans l'ordre d'affichage. */
export const PALIERS: ReadonlyArray<{ plan: 'solo' | 'equipe' | 'business'; label: string; prixEur: number; placesIncluses: number }> = [
  { plan: 'solo', label: PALIER_LABELS.solo, prixEur: 59, placesIncluses: 1 },
  { plan: 'equipe', label: PALIER_LABELS.equipe, prixEur: 129, placesIncluses: 5 },
  { plan: 'business', label: PALIER_LABELS.business, prixEur: 249, placesIncluses: 10 },
];

export const nomPalier = (plan: string | null | undefined): string => (plan ? PALIER_LABELS[plan] ?? plan : '—');

export const MODULE_TARIF_LABELS: Record<'simple' | 'standard' | 'premium', string> = { simple: 'Simple', standard: 'Standard', premium: 'Premium' };
