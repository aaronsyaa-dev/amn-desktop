/**
 * LES PRÉRÉGLAGES DE LA BARRE — trois façons de l'alléger d'un geste.
 *
 * Alléger module par module marchait, mais soixante tuiles une à une, c'est
 * long (Bloc 1 de la Garde). Un préréglage dit ce qu'on GARDE ; tout le reste
 * du catalogue s'allège, sauf ce qui ne s'allège jamais (`ALWAYS_ON_MODULES`).
 * Les clés absentes de l'édition construite sont simplement ignorées : la
 * même liste sert aux deux éditions.
 */
export type PrereglageBarre = 'leger' | 'commerce' | 'service';

export const PREREGLAGES_BARRE: Record<PrereglageBarre, readonly string[]> = {
  // Le strict quotidien : l'agenda, les gens, ce qu'il reste à faire, ce qu'on facture.
  leger: ['agenda', 'clients', 'tasks', 'notes', 'invoices', 'orders', 'reports'],
  // Vendre : la relation, la vente, le stock, la caisse, la fidélité, la vitrine.
  commerce: ['agenda', 'clients', 'pipeline', 'invoices', 'orders', 'stock', 'suppliers', 'expenses', 'cashCount', 'loyalty', 'subscriptions', 'reminders', 'minisite', 'newsletter', 'media', 'calculators'],
  // Servir : les rendez-vous, les projets, le temps passé, les contrats, les comptes rendus.
  service: ['agenda', 'booking', 'clients', 'tasks', 'projects', 'time', 'contracts', 'reports', 'esign', 'forms', 'notes', 'media', 'reviews', 'aftersales'],
};

/** Ce qu'il faut alléger pour n'avoir que le préréglage : tout le catalogue moins ce qu'il garde. */
export function allegementsPourPrereglage(prereglage: PrereglageBarre, catalogue: readonly string[], toujoursOuverts: readonly string[]): string[] {
  const garde = new Set(PREREGLAGES_BARRE[prereglage]);
  return catalogue.filter((k) => !garde.has(k) && !toujoursOuverts.includes(k));
}
