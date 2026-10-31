/**
 * Les mots du groupe « archetypes » du socle (LOT-00). Même schéma que `src/socle/i18n.ts` :
 * l'anglais est la base, le français est typé contre lui. Fusionnés dans `i18n.ts`.
 */
export const EN_ARCHETYPES = {} as const;
export const FR_ARCHETYPES: Record<keyof typeof EN_ARCHETYPES, string> = {};
