/**
 * Les mots du groupe « briques partagées » du socle (v3, STATUT §1.10 point 1 : `ModuleTile`, `ModuleGroupGrid`,
 * `AddModuleTile`, `CountBadge`). Même schéma que `src/socle/i18n.ts` : l'anglais est la base, le français est typé
 * contre lui. Fusionnés dans `i18n.ts`.
 */
export const EN_BRIQUES = {
  'briques.ajouterModule': 'Add a module',
  'briques.ajouter': 'Add',
  'briques.groupe.effectif': '{n} modules',
  'briques.groupe.effectif.un': '1 module',
  'briques.tuile.actif': 'current module',
  'briques.compte': '{n} to see',
  'briques.compte.critique': '{n} critical alerts',
} as const;

export const FR_BRIQUES: Readonly<Record<keyof typeof EN_BRIQUES, string>> = {
  'briques.ajouterModule': 'Ajouter un module',
  'briques.ajouter': 'Ajouter',
  'briques.groupe.effectif': '{n} modules',
  'briques.groupe.effectif.un': '1 module',
  'briques.tuile.actif': 'module ouvert',
  'briques.compte': '{n} à voir',
  'briques.compte.critique': '{n} alertes critiques',
};
