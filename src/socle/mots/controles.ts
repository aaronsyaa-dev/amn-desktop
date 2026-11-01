/**
 * Les mots du groupe « controles » du socle (LOT-00). Même schéma que `src/socle/i18n.ts` :
 * l'anglais est la base, le français est typé contre lui. Fusionnés dans `i18n.ts`.
 */
export const EN_CONTROLES = {
  'ludique.xSurYFait': '{x} of {y} done',
  'ludique.xSurY': '{x} of {y}',
  'ludique.joursDeSuite': '{n} days in a row',
  'ludique.jourFait': '{jour}: done',
  'ludique.jourPasFait': '{jour}: not done',
  'suggestion.titre': "Ajmani's suggestion",
  'urgent': 'Urgent',
  'recherche.effacer': 'Clear the search',
  'onglets.compteur': '{n} items',
} as const;

export const FR_CONTROLES: Record<keyof typeof EN_CONTROLES, string> = {
  'ludique.xSurYFait': '{x} sur {y} fait',
  'ludique.xSurY': '{x} sur {y}',
  'ludique.joursDeSuite': '{n} jours de suite',
  'ludique.jourFait': '{jour} : fait',
  'ludique.jourPasFait': '{jour} : pas fait',
  'suggestion.titre': 'Suggestion d’Ajmani',
  'urgent': 'Urgent',
  'recherche.effacer': 'Effacer la recherche',
  'onglets.compteur': '{n} éléments',
};
