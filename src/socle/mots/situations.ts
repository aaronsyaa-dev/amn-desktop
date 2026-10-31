/**
 * Les mots du groupe « situations » du socle (LOT-00). Même schéma que `src/socle/i18n.ts` :
 * l'anglais est la base, le français est typé contre lui. Fusionnés dans `i18n.ts`.
 */
export const EN_SITUATIONS = {} as const;
export const FR_SITUATIONS: Record<keyof typeof EN_SITUATIONS, string> = {};
